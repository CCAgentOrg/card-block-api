/* zcode-workflow
description: "Loop-2 UPI-freeze verification for card-block-api (issue #34):
  researches each bank's UPI block/freeze paths from live official pages and
  merges a per-bank blockingInstructions.upi section into data/overrides/
  (preserving existing debit/credit sections byte-exact), then rebuilds and
  validates the data layer with the same gates Data CI runs."
whenToUse: Run a C4 UPI-coverage batch when banks still lack a upi section, or
  to (re)verify specific banks' UPI paths via onlySlugs.
args:
  verifyDate:
    type: string
    required: true
    description: Date of this verification cycle (YYYY-MM-DD); stamped as the upi section's lastVerified.
  batchSize:
    type: number
    default: 10
    description: How many banks to add/verify UPI paths for in this run.
  onlySlugs:
    type: json
    description: Optional JSON array of slugs to restrict the batch to.
  excludeSlugs:
    type: json
    description: Optional JSON array of slugs to skip (in addition to the built-in excludes).
*/

/**
 * verify-upi-paths — Loop 2 C4 UPI coverage (issue #34).
 *
 * Per bank: researcher verifies UPI block/freeze paths from the bank's LIVE
 * official pages (in-app menu path with exact steps, netbanking path, *99#
 * USSD if published, phone fallback, SMS block if published) and merges ONLY
 * a blockingInstructions.upi section into data/overrides/<seed_id>.json —
 * existing debit/credit sections and bank-level fields must be preserved
 * byte-exact (auditor enforces via git diff). Banks without an override get
 * one constructed from their seed entry first. The upi section carries its
 * own lastVerified so card-card and UPI freshness stay independent.
 * Paytm Payments Bank is permanently excluded (wound up, issue #62).
 */

interface Finding {
  /** Workspace-relative path, with a line when it applies: "src/a.ts:42". */
  where: string;
  /** One sentence: what is wrong, or what was found. */
  what: string;
  /** What showed it: the lines read, or the command and the output that proved it. */
  evidence: string;
  /** "verified" when an independent subagent or a deterministic check confirmed it; "unconfirmed" when confirmation failed or was not attempted. */
  status: "verified" | "unconfirmed";
  /** How much it matters. Reserve "high" for data loss or a crash. */
  severity: "low" | "medium" | "high";
}

interface WorkflowReport {
  /** Two or three sentences answering what the user asked for. */
  conclusion: string;
  findings: Finding[];
  /** What the run checked and how: the commands it ran, the files it covered. */
  verified: string[];
  /** What the run did not look at or could not check, and why. */
  notCovered: string[];
}

interface BankTarget {
  /** Seed key in app/data/banks.json — equals the override filename stem. */
  id: string;
  /** Published slug. */
  slug: string;
  /** Display name. */
  name: string;
  /** True when data/overrides/<id>.json exists (merge; else construct from seed). */
  hasOverride: boolean;
  /** Exact path the researcher writes. */
  ovrPath: string;
}

interface ResearchOutcome {
  /** "wrote" = override file written/merged; "escalated" = nothing written. */
  outcome: "wrote" | "escalated";
  /** One sentence: what UPI channels were found (or why escalation). */
  changes: string;
  /** Official source URLs fetched live this cycle that support the upi section. */
  sources: string[];
  /** Why, when escalated. */
  reason?: string;
}

interface Confirmation {
  /** "confirmed" = upi claims traced to live-fetched pages AND preservation verified. */
  verdict: "confirmed" | "issues";
  /** Precise mismatches. */
  issues: string[];
}

interface BankResult {
  slug: string;
  name: string;
  status: "verified" | "unconfirmed" | "escalated";
  changes: string;
  issues: string[];
  sources: string[];
  ovrPath: string;
}

// Args reach a run via CreateWorkflow; an AmendWorkflow that replaces the
// script starts with none — fall back with a log line instead of aborting.
const argsDate = String(args.verifyDate ?? "");
const verifyDate = /^\d{4}-\d{2}-\d{2}$/.test(argsDate) ? argsDate : "2026-10-31";
if (argsDate !== verifyDate) {
  log(`verifyDate arg missing/invalid (${argsDate || "none"}) — using ${verifyDate}`);
}
const batchSize = typeof args.batchSize === "number" ? args.batchSize : 10;
const onlySlugs = Array.isArray(args.onlySlugs) ? args.onlySlugs.map(String) : null;
const excludeSlugs = Array.isArray(args.excludeSlugs) ? args.excludeSlugs.map(String) : [];

const idx = JSON.parse(await files.read("data/banks/index.json")) as {
  banks: Array<{ slug: string; name: string }>;
};
const seed = JSON.parse(await files.read("app/data/banks.json")) as Record<
  string,
  { name?: string; blockingInstructions?: Record<string, unknown> }
>;

const idForSlug = new Map<string, string>();
for (const id of Object.keys(seed)) idForSlug.set(id.replace(/_/g, "-"), id);

// UPI-volume priority (issue #34: top-30 PSPs/banks). Entries not matching a
// real seed key are ignored; everything else falls back to index order.
const upiPriority = [
  "sbi", "hdfc", "yes_bank", "axis", "icici", "kotak", "pnb", "bob", "canara",
  "union", "indusind", "idfc_first", "airtel_payments", "fino", "au_small_finance",
  "equitas_small_finance", "idbi", "indian_bank", "federal_bank", "dbs", "bandhan",
  "karnataka_bank", "karur_vysya_bank", "city_union", "south_indian_bank",
  "j_k_bank", "csb", "dhanlaxmi_bank", "rbl",
];
const priorityPos = new Map<string, number>();
upiPriority.forEach((id, i) => {
  if (idForSlug.has(id.replace(/_/g, "-"))) priorityPos.set(id, i);
});

// Permanently excluded: wound-up / escalated entities with no UPI surface.
const builtInExcludes = new Set(["paytm-payments"]);

// Which banks already have a upi section in their override?
const ovrFiles = await files.glob("data/overrides/*.json");
const upiDone = new Set<string>();
for (const p of ovrFiles) {
  const stem = (p.split("/").pop() ?? p).replace(/\.json$/, "");
  try {
    const o = JSON.parse(await files.read(p)) as { blockingInstructions?: Record<string, unknown> };
    if (o.blockingInstructions && o.blockingInstructions.upi) upiDone.add(stem.replace(/_/g, "-"));
  } catch {
    // unreadable override: treat as done to avoid clobbering it
    upiDone.add(stem.replace(/_/g, "-"));
  }
}

const batch: BankTarget[] = [];
const pool = idx.banks.filter((b) => idForSlug.has(b.slug) && !upiDone.has(b.slug));
pool.sort((a, b) => {
  const pa = priorityPos.get(idForSlug.get(a.slug) ?? "") ?? 999;
  const pb = priorityPos.get(idForSlug.get(b.slug) ?? "") ?? 999;
  return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
});
for (const b of pool) {
  if (batch.length >= batchSize) break;
  if (builtInExcludes.has(b.slug)) continue;
  if (excludeSlugs.includes(b.slug)) continue;
  if (onlySlugs && !onlySlugs.includes(b.slug)) continue;
  const id = idForSlug.get(b.slug);
  if (!id) continue;
  batch.push({
    id,
    slug: b.slug,
    name: b.name,
    hasOverride: ovrFiles.some((p) => (p.split("/").pop() ?? p).replace(/\.json$/, "") === id),
    ovrPath: `data/overrides/${id}.json`,
  });
}

log(`UPI batch: ${batch.length} bank(s) — ${batch.map((b) => b.name).join(", ")}`);

if (!batch.length) {
  return {
    conclusion: "Nothing to do: every eligible bank already has a upi section (or none qualify).",
    findings: [],
    verified: [],
    notCovered: ["no bank was selected"],
  };
}

artifact.board("upi-banks", {
  title: "UPI coverage progress",
  key: "slug",
  status: "status",
  columns: ["verified", "unconfirmed", "escalated"],
  cardTitle: "name",
  detail: [{ field: "changes", label: "UPI channels found" }],
});

const RESEARCH_PERSONA =
  "You research UPI block/freeze paths for a public API that fraud victims rely on in an emergency. " +
  "You work only from official sources: the bank's own web pages on its own domain (UPI help/FAQ, " +
  "mobile-banking, netbanking and security pages) and official app-store links as they appear there. " +
  "Third-party aggregators are never citable evidence. Every menu path, USSD string or number you " +
  "record must appear on an official page you fetched live during this task. UPI blocking means: " +
  "freezing/disabling UPI transactions (VPA/linked-account), the in-app UPI lock, disabling UPI on a " +
  "debit card, or deregistering — NOT card hotlisting. If official sources conflict or you cannot " +
  "reach any official page, escalate rather than guess. Never accept or record card numbers, PINs, " +
  "UPI PINs or OTPs. If the task is impossible to satisfy, escalate and say so plainly.";

const AUDIT_PERSONA =
  "You are an independent auditor for a public UPI-blocking API. You re-fetch every cited source " +
  "yourself and check each claim against what the page actually says, and you verify that the merge " +
  "preserved everything else in the file (git diff shows only the upi section and appended sources). " +
  "You never edit files. Formatting differences are acceptable; different menu items, digits or steps " +
  "are not. A cited page that will not load is an issue, not a pass. If the audit is impossible, " +
  "escalate and say so plainly.";

function researchAsk(b: BankTarget): string {
  return (
    `Bank: ${b.name} (slug: ${b.slug}, seed key: ${b.id}). Verification date: ${verifyDate}.\n\n` +
    `GOAL: add a "upi" card-type section to this bank's override file describing how to block/freeze UPI.\n\n` +
    `1. Read data/banks/${b.slug}.json (published entry, old).\n` +
    (b.hasOverride
      ? `2. Read ${b.ovrPath} — the existing override. You will MERGE into it: every existing key and section (id, name, blockingInstructions.debit/.credit, existing sources, lastVerified) must be preserved byte-exact.\n`
      : `2. No override exists. Construct ${b.ovrPath} from the seed: copy the bank's entry from app/data/banks.json (key "${b.id}") — id, name, blockingInstructions (debit/credit verbatim), sources, lastVerified — then add the upi section below. Do not alter the copied content.\n`) +
    `3. Research this bank's UPI block/freeze channels from live official pages:\n` +
    `- In-app UPI lock/freeze: the exact menu path in the bank's own mobile app (e.g. "Cards > Manage > UPI transactions off", or a dedicated UPI/Switch section), as published on the bank's FAQ/support/mobile-banking pages\n` +
    `- Netbanking UPI manage/disable path, if published\n` +
    `- SMS/USSD channels for UPI (some banks publish SMS keywords; *99# only if a bank page mentions it)\n` +
    `- Phone fallback: customer-care number for UPI issues (the bank's own pages)\n` +
    `4. Write the merge: inside blockingInstructions, add or replace ONLY a "upi" object:\n` +
    `{ "androidApp": "official store URL from the bank's pages (if published)", "iosApp": "...", "tollFree": "UPI-relevant customer-care number", "website": "netbanking URL if a UPI manage path is published", "notes": "exact in-app menu path + steps, other channels, caveats — one tight paragraph, verbatim wording where possible", "lastVerified": "${verifyDate}" }\n` +
    `and append the upi sources to the top-level sources array: { "url": "...", "label": "UPI freeze live fetch ${verifyDate}: what this page proved" }. Keep 1-3 upi source entries.\n` +
    `Rules:\n` +
    `- Include a key only when an official page you fetched supports it; omit what you cannot verify.\n` +
    `- The upi section has its OWN lastVerified ("${verifyDate}") — do not touch the top-level lastVerified.\n` +
    `- Do not edit blockingInstructions.debit, .credit, id, name, or existing source entries.\n` +
    `- 2-space indent, no trailing commas. Do not edit any other file.\n` +
    `5. Return the structured outcome: what UPI channels you found (or dropped), and the URLs fetched live.\n\n` +
    `If the bank's official pages publish no UPI block/freeze information at all, or pages conflict, write nothing and return outcome "escalated" with the reason.`
  );
}

function auditAsk(b: BankTarget): string {
  return (
    `Audit the upi section added for ${b.name} in ${b.ovrPath}. Verification date: ${verifyDate}.\n\n` +
    `1. Read ${b.ovrPath} and run git diff on it (git diff -- ${b.ovrPath}).\n` +
    `2. PRESERVATION CHECK: the diff must show only (a) a new/changed blockingInstructions.upi object and (b) appended entries in the top-level sources array${b.hasOverride ? "" : " — for a seed-constructed file instead verify its debit/credit sections and sources match app/data/banks.json key \"" + b.id + "\" exactly"}. Any other change is an issue.\n` +
    `3. Fetch each upi source URL live. Confirm the menu path, numbers and channels in blockingInstructions.upi appear on the cited pages (verbatim menu wording where quoted; formatting differences fine, different steps/digits not).\n` +
    `4. Confirm the upi section's lastVerified is "${verifyDate}", that no claim lacks a cited source, and that androidApp/iosApp/website values belong to the bank's official domain or its app-store listings.\n` +
    `5. Return verdict "confirmed" only if everything holds; otherwise "issues" with one precise line per problem.`
  );
}

async function verifyBank(b: BankTarget, tag: string): Promise<BankResult> {
  const researcher = agent(`upi-researcher-${b.slug}${tag}`, { system: RESEARCH_PERSONA });
  let research = await researcher.ask<ResearchOutcome>(researchAsk(b));
  if (research.outcome !== "wrote") {
    return {
      slug: b.slug,
      name: b.name,
      status: "escalated",
      changes: "",
      issues: [research.reason ?? "no reason given"],
      sources: [],
      ovrPath: b.ovrPath,
    };
  }
  let audit = await agent(`upi-auditor-${b.slug}${tag}`, { system: AUDIT_PERSONA }).ask<Confirmation>(auditAsk(b));
  let round = 0;
  while (audit.verdict === "issues" && round < 2) {
    round += 1;
    research = await researcher.ask<ResearchOutcome>(
      `The independent auditor found these issues in the upi section of ${b.ovrPath}:\n` +
        audit.issues.map((i) => `- ${i}`).join("\n") +
        `\nFix them against official pages and rewrite the file (same merge rules: only the upi section and appended sources may change` +
        `${b.hasOverride ? "" : ", or seed-construct the whole file preserving copied content"}). ` +
        `If you cannot resolve an issue, restore the file to its exact prior content and return outcome "escalated" with the reason. Do not edit any other file.`,
    );
    if (research.outcome !== "wrote") break;
    audit = await agent(`upi-auditor-${b.slug}${tag}-r${round}`, { system: AUDIT_PERSONA }).ask<Confirmation>(auditAsk(b));
  }
  const ok = research.outcome === "wrote" && audit.verdict === "confirmed";
  return {
    slug: b.slug,
    name: b.name,
    status: ok ? "verified" : "unconfirmed",
    changes: research.changes,
    issues: ok ? [] : audit.verdict === "issues" ? audit.issues : ["fix round ended in escalation: " + (research.reason ?? "no reason")],
    sources: research.sources,
    ovrPath: b.ovrPath,
  };
}

phase("Research each bank's UPI freeze paths");
// One join at the end: the rebuild gate needs every merged override written.
// A failed subagent turn costs one bank (one fresh retry, then escalated), never the batch.
const results = await Promise.all(
  batch.map(async (b): Promise<BankResult> => {
    let result: BankResult;
    try {
      result = await verifyBank(b, "");
    } catch (err) {
      log(`${b.name}: a subagent turn failed (${String(err).slice(0, 160)}) — retrying once with fresh agents`);
      try {
        result = await verifyBank(b, "-retry");
      } catch (err2) {
        result = {
          slug: b.slug,
          name: b.name,
          status: "escalated",
          changes: "",
          issues: [`workflow error, bank skipped: ${String(err2).slice(0, 300)}`],
          sources: [],
          ovrPath: b.ovrPath,
        };
      }
    }
    report(result, "upi-banks");
    return result;
  }),
);

const verifiedCount = results.filter((r) => r.status === "verified").length;
const unconfirmedCount = results.filter((r) => r.status === "unconfirmed").length;
const escalatedCount = results.filter((r) => r.status === "escalated").length;
log(`UPI batch settled: ${verifiedCount} verified, ${unconfirmedCount} unconfirmed, ${escalatedCount} escalated.`);

phase("Rebuild the data layer and run the full validation gate");
const fixer = agent("upi-validator-fixer", {
  system:
    "You fix validation failures in bank-override JSON files for card-block-api. You edit only files " +
    "under data/overrides/ — data/banks/*.json and the index files are generated and must never be " +
    "edited directly. When fixing a upi merge, preserve every non-upi section byte-exact. If a failure " +
    "is impossible to fix without guessing data, escalate and say so plainly.",
});
let gateOk = false;
for (let round = 1; round <= 3; round += 1) {
  log(`Rebuild + validation, attempt ${round}`);
  const build = await world.run("node", ["scripts/build-data-layer.js"]);
  const networks = await world.run("node", ["scripts/build-networks.js"]);
  const dataCheck = await world.run("node", ["scripts/validate-data.js"]);
  const schemaCheck = await world.run("node", ["scripts/validate-schema.js"]);
  gateOk = [build, networks, dataCheck, schemaCheck].every((r) => r.exitCode === 0);
  if (gateOk || round === 3) break;
  const failing = [build, networks, dataCheck, schemaCheck]
    .filter((r) => r.exitCode !== 0)
    .map((r) => (r.stdout + r.stderr).slice(0, 2000))
    .join("\n---\n");
  try {
    await fixer.ask(
      `A validation gate failed after UPI overrides were merged:\n${failing}\n` +
        `Fix the offending override file(s) under data/overrides/ (slug → override: ${batch
          .map((b) => `${b.slug} → ${b.ovrPath}`)
          .join("; ")}). The script re-runs the generators and validators after you.`,
    );
  } catch (err) {
    log(`upi-validator-fixer turn failed (${String(err).slice(0, 160)}) — stopping fix attempts; gates stand as measured`);
    break;
  }
}

try {
  await artifact.markdown(
    "upi-batch-report",
    [
      `# C4 UPI batch report — ${verifyDate}`,
      "",
      `**${verifiedCount} verified · ${unconfirmedCount} unconfirmed · ${escalatedCount} escalated** (of ${results.length} selected)`,
      "",
      `| Bank | Status | UPI channels found | Sources |`,
      `| --- | --- | --- | --- |`,
      ...results.map(
        (r) => `| ${r.name} | ${r.status} | ${r.changes || "—"} | ${r.sources.slice(0, 2).join("<br>") || "—"} |`,
      ),
      "",
      `Validation gate: ${gateOk ? "passed (build-data-layer, build-networks, validate-data, validate-schema)" : "FAILED after 3 attempts — see findings"}.`,
    ].join("\n"),
    { title: `C4 UPI batch report — ${verifyDate}`, description: "Per-bank outcomes of the UPI freeze-path batch.", primary: true },
  );
} catch {
  log("upi-batch-report artifact could not be published; the returned report carries all findings");
}

const finalReport: WorkflowReport = {
  conclusion:
    `UPI freeze-path batch: ${results.length} bank(s) researched — ${verifiedCount} confirmed by an independent ` +
    `auditor (merge preservation + live sources), ${unconfirmedCount} unconfirmed, ${escalatedCount} escalated ` +
    `(nothing written). Validation gate ${gateOk ? "passed" : "FAILED"}.`,
  findings: results.map((r) => ({
    where: r.ovrPath,
    what:
      r.status === "escalated"
        ? `Escalated: ${r.issues.join("; ")}`
        : `${r.status === "verified" ? "UPI verified" : "UPI UNCONFIRMED"} — ${r.changes || "no change summary"}`,
    evidence: r.sources.join(" | "),
    status: r.status === "verified" ? ("verified" as const) : ("unconfirmed" as const),
    severity: r.status === "verified" ? ("low" as const) : ("medium" as const),
  })),
  verified: [
    "node scripts/build-data-layer.js + node scripts/build-networks.js — deterministic rebuild",
    "node scripts/validate-data.js — structural validation",
    "node scripts/validate-schema.js — JSON Schema contract",
    `independent auditor re-fetched every UPI source and verified merge preservation for ${verifiedCount} bank(s)`,
  ],
  notCovered: [
    ...results.filter((r) => r.status !== "verified").map((r) => `${r.name}: ${r.status} — ${r.issues.join("; ")}`),
    "banks already having a upi section were not re-verified this run",
  ],
};
return finalReport;
