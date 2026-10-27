/* zcode-workflow
description: "Loop-2 batch verification for card-block-api (issue #32):
  re-verifies the stalest bank entries against live official pages, writes
  per-bank data/overrides/ files, rebuilds and validates the data layer with the
  same gates Data CI runs. Hardened: per-bank error isolation with one fresh
  retry (a failed subagent turn costs one bank, never the batch), guarded
  fixer/artifact steps."
whenToUse: Run a C2 verification batch when bank entries age past their
  freshness window, when a new batch of stale banks is due, or to re-verify a
  specific set of banks via onlySlugs.
args:
  batchSize:
    type: number
    description: How many of the stalest banks to verify in this run.
    default: 10
  onlySlugs:
    type: json
    description: Optional JSON array of slugs to restrict the batch to (e.g.
      ["dbs","federal-bank"]).
  verifyDate:
    type: string
    description: Date of this verification cycle (YYYY-MM-DD); stamped as
      lastVerified on every override written. If missing/invalid (e.g. an
      AmendWorkflow submission), the script falls back to the batch cycle date
      with a log line.
    required: true
*/

/**
 * verify-stale-banks — Loop 2 batch verification for card-block-api (issue #32).
 *
 * Re-verifies the stalest per-bank entries against live official pages,
 * writes one data/overrides/<seed-id>.json per verified bank, then rebuilds
 * and validates the data layer with the same gates Data CI runs. Git/PR
 * steps happen outside the workflow (deliberate: review before merge).
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
  /** How much it matters. Reserve "high" for data loss, a crash, or a wrong result. */
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
  /** Override filename stem — must equal the seed key in app/data/banks.json. */
  id: string;
  /** Published slug, e.g. "abudhabi-commercial-bank". */
  slug: string;
  /** Display name of the bank. */
  name: string;
  /** True when data/overrides/<id>.json already exists (update, not create). */
  updating: boolean;
  /** Exact path the researcher writes. */
  ovrPath: string;
  /** The stale last_verified date that put this bank in the batch. */
  staleSince: string;
}

interface ResearchOutcome {
  /** "wrote" = override file written; "escalated" = nothing new written, prior content restored. */
  outcome: "wrote" | "escalated";
  /** One sentence: what changed vs the current published entry, dropped channels included. */
  changes: string;
  /** Official source URLs fetched live this cycle that support the entry. */
  sources: string[];
  /** Why, when escalated. */
  reason?: string;
}

interface Confirmation {
  /** "confirmed" = every claim traced to a live-fetched cited page. */
  verdict: "confirmed" | "issues";
  /** Precise mismatches: what the override claims vs what the page says. */
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

// Args reach a run via CreateWorkflow (inline/saved) and settings-only GUI
// supersede, but an AmendWorkflow that replaces the script starts with none —
// so fall back to this batch's cycle date (with a log line) instead of aborting.
const argsDate = String(args.verifyDate ?? "");
const verifyDate = /^\d{4}-\d{2}-\d{2}$/.test(argsDate) ? argsDate : "2026-10-27";
if (argsDate !== verifyDate) {
  log(`verifyDate arg missing/invalid (${argsDate || "none"}) — using batch-3 cycle date ${verifyDate}`);
}
const batchSize = typeof args.batchSize === "number" ? args.batchSize : 10;
const onlySlugs = Array.isArray(args.onlySlugs) ? args.onlySlugs.map(String) : null;

const idx = JSON.parse(await files.read("data/banks/index.json")) as {
  banks: Array<{ slug: string; name: string; last_verified?: string }>;
};
const seed = JSON.parse(await files.read("app/data/banks.json")) as Record<string, unknown>;

const idForSlug = new Map<string, string>();
for (const id of Object.keys(seed)) idForSlug.set(id.replace(/_/g, "-"), id);

const overridden = new Set(
  (await files.glob("data/overrides/*.json")).map((p) => (p.split("/").pop() ?? p).replace(/\.json$/, "")),
);

const pool = idx.banks.filter((b) => idForSlug.has(b.slug));
pool.sort((a, b) => String(a.last_verified ?? "").localeCompare(String(b.last_verified ?? "")));

const batch: BankTarget[] = [];
for (const b of pool) {
  if (batch.length >= batchSize) break;
  if (b.last_verified === verifyDate) continue;
  const id = idForSlug.get(b.slug);
  if (!id) continue;
  if (onlySlugs && !onlySlugs.includes(b.slug)) continue;
  batch.push({ id, slug: b.slug, name: b.name, updating: overridden.has(id), ovrPath: `data/overrides/${id}.json`, staleSince: String(b.last_verified ?? "?") });
}

log(`Selected ${batch.length} bank(s), stalest first: ${batch.map((b) => `${b.name} (since ${b.staleSince})`).join(", ")}`);

if (!batch.length) {
  return {
    conclusion: `Nothing to verify: no eligible bank has a last_verified older than ${verifyDate}.`,
    findings: [],
    verified: [],
    notCovered: ["no bank was selected, so no source was fetched this run"],
  };
}

artifact.board("banks", {
  title: "Batch progress",
  key: "slug",
  status: "status",
  columns: ["verified", "unconfirmed", "escalated"],
  cardTitle: "name",
  detail: [{ field: "changes", label: "What changed" }],
});

const RESEARCH_PERSONA =
  "You re-verify payment-card blocking channels for a public API that theft victims rely on in an " +
  "emergency. You work only from official sources: the bank's own web pages on its own domain, and official " +
  "app-store links as they appear on those pages. Third-party aggregators and blogs (bankbazaar, paisabazaar, " +
  "card-comparison sites, news articles, forums) may guide your search but are never citable evidence. Every " +
  "phone number, SMS format or instruction you record must appear on an official page you fetched live during " +
  "this task. If official sources conflict, or you cannot reach any official page, escalate rather than guess: " +
  "a wrong number published by this API costs a victim real money. Never accept or record card numbers, PINs or " +
  "OTPs. If the task is impossible to satisfy, escalate and say so plainly rather than working around it.";

const AUDIT_PERSONA =
  "You are an independent auditor for a public card-blocking API. You re-fetch every cited source yourself " +
  "and check each claim in the entry against what the page actually says. You never edit files. Report " +
  "mismatches precisely — the claim vs what the page shows. Formatting differences (spacing, country codes, " +
  "punctuation inside numbers) are acceptable; different digits are not. A cited page that will not load is " +
  "an issue, not a pass. If the audit is impossible to complete, escalate and say so plainly.";

function researchAsk(b: BankTarget): string {
  return (
    `Bank: ${b.name} (slug: ${b.slug}). Verification date: ${verifyDate}.\n\n` +
    `1. Read data/banks/${b.slug}.json — the API's current published entry (its dates are old; treat every claim in it as unverified).\n` +
    `2. ${b.updating ? `Read ${b.ovrPath} — the existing override you are about to replace.` : `There is no override file yet; you will create ${b.ovrPath}.`}\n` +
    `3. Research this bank's card-blocking channels from live official pages (start from the bank's website; look for customer care, lost/stolen card, hotlist and fraud-report pages). Establish, for BOTH debit and credit cards where the bank issues both:\n` +
    `- 24x7 hotline numbers (toll-free and alternate/chargeable), including overseas numbers if published\n` +
    `- SMS block format (keyword + short code), if the bank offers one\n` +
    `- netbanking path and mobile-app path for blocking a card\n` +
    `- official email for block requests, if published\n` +
    `4. Write ${b.ovrPath} — a single JSON object, 2-space indent, no trailing commas, exactly this shape:\n` +
    `{\n  "id": "${b.id}",\n  "name": "${b.name}",\n` +
    `  "blockingInstructions": {\n    "debit": { "tollFree": "...", "number1": "...", "number2": "...", "website": "https://...", "reference": "https://...", "notes": "..." },\n    "credit": { "...same keys as you can verify..." }\n  },\n` +
    `  "sources": [{ "url": "https://...", "label": "live fetch ${verifyDate}: what this page proved, with the numbers" }],\n` +
    `  "lastVerified": "${verifyDate}"\n}\n` +
    `File rules:\n` +
    `- "id" must be exactly "${b.id}" (it matches the filename stem).\n` +
    `- Include a key only when an official page you fetched supports it; omit keys you could not verify — never carry a channel over from the old entry without a live source.\n` +
    `- Keep numbers verbatim as the page shows them. "reference" = the strongest official page for blocking. "notes" = one tight paragraph: hours, overseas lines, app menu path, the 1930 national helpline only if the bank's own page mentions it.\n` +
    `- "rmn"/"sms" keys only with exact official wording; "email"/"androidApp"/"iosApp" only when official pages state them.\n` +
    `- 1-4 source entries; every claim in the file must be traceable to at least one of them.\n` +
    `- Do not edit any other file.\n` +
    `5. Return the structured outcome: what changed vs the old entry (including channels you dropped), and the URLs you fetched live.\n\n` +
    `If you cannot reach any official page for this bank, or official pages conflict on a channel, write nothing (leave any existing override untouched) and return outcome "escalated" with the reason.`
  );
}

function auditAsk(b: BankTarget): string {
  return (
    `Audit the fresh card-blocking entry for ${b.name}. Verification date: ${verifyDate}.\n\n` +
    `1. Read ${b.ovrPath}.\n` +
    `2. Fetch each URL in its sources[] live. For every phone number, SMS format and instruction in blockingInstructions, confirm it appears on at least one cited official page (verbatim digits; spacing/country-code formatting differences are fine).\n` +
    `3. Confirm "website" and "reference" resolve and belong to the bank's official domain; that "id" is exactly "${b.id}"; that "lastVerified" is exactly "${verifyDate}"; and that both "debit" and "credit" sections exist (credit may legitimately be absent only if the bank issues no credit cards — check the bank's site).\n` +
    `4. Return verdict "confirmed" only when every claim traces to a page you fetched yourself; otherwise "issues" with one precise line per problem (claim vs page).`
  );
}

async function verifyBank(b: BankTarget, tag: string): Promise<BankResult> {
  const researcher = agent(`researcher-${b.slug}${tag}`, { system: RESEARCH_PERSONA });
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
  let audit = await agent(`auditor-${b.slug}${tag}`, { system: AUDIT_PERSONA }).ask<Confirmation>(auditAsk(b));
  let round = 0;
  while (audit.verdict === "issues" && round < 2) {
    round += 1;
    research = await researcher.ask<ResearchOutcome>(
      `The independent auditor found these issues in ${b.ovrPath}:\n` +
        audit.issues.map((i) => `- ${i}`).join("\n") +
        `\nFix them against official pages and rewrite the file (same schema). If you cannot resolve an issue, restore the file to ` +
        `${b.updating ? "the exact content you first read" : "non-existent (delete it)"} and return outcome "escalated" with the reason. Do not edit any other file.`,
    );
    if (research.outcome !== "wrote") break;
    audit = await agent(`auditor-${b.slug}${tag}-r${round}`, { system: AUDIT_PERSONA }).ask<Confirmation>(auditAsk(b));
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

phase("Re-verify each bank against its live official pages");
// One join at the end: the rebuild gate needs every override written first.
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
    report(result, "banks");
    return result;
  }),
);

const verifiedCount = results.filter((r) => r.status === "verified").length;
const unconfirmedCount = results.filter((r) => r.status === "unconfirmed").length;
const escalatedCount = results.filter((r) => r.status === "escalated").length;
log(`Batch settled: ${verifiedCount} verified, ${unconfirmedCount} unconfirmed, ${escalatedCount} escalated.`);

phase("Rebuild the data layer and run the full validation gate");
const fixer = agent("validator-fixer", {
  system:
    "You fix validation failures in freshly written bank-override JSON files for card-block-api. You edit only " +
    "files under data/overrides/ — data/banks/*.json and the index files are generated and must never be edited " +
    "directly. If a failure is impossible to fix without guessing data, escalate and say so plainly.",
});
let gateOk = false;
let gateOutput = "";
for (let round = 1; round <= 3; round += 1) {
  log(`Rebuild + validation, attempt ${round}`);
  const build = await world.run("node", ["scripts/build-data-layer.js"]);
  const networks = await world.run("node", ["scripts/build-networks.js"]);
  const dataCheck = await world.run("node", ["scripts/validate-data.js"]);
  const schemaCheck = await world.run("node", ["scripts/validate-schema.js"]);
  gateOk = [build, networks, dataCheck, schemaCheck].every((r) => r.exitCode === 0);
  gateOutput = [build, networks, dataCheck, schemaCheck]
    .map((r) => r.stdout.trim().split("\n").slice(-2).join(" / "))
    .join("\n");
  if (gateOk || round === 3) break;
  const failing = [build, networks, dataCheck, schemaCheck]
    .filter((r) => r.exitCode !== 0)
    .map((r) => (r.stdout + r.stderr).slice(0, 2000))
    .join("\n---\n");
  try {
    await fixer.ask(
      `A validation gate failed after fresh overrides were written:\n${failing}\n` +
        `Fix the offending override file(s) under data/overrides/ (slug → override: ${batch
          .map((b) => `${b.slug} → ${b.ovrPath}`)
          .join("; ")}). The script re-runs the generators and validators after you.`,
    );
  } catch (err) {
    log(`validator-fixer turn failed (${String(err).slice(0, 160)}) — stopping fix attempts; gates stand as measured`);
    break;
  }
}

const changed = await git.changedFiles();
const unexpected = changed.filter(
  (p) => p.startsWith("data/") && !p.startsWith("data/overrides/") && !p.startsWith("data/banks/") && p !== "data/index.json",
);

try {
  await artifact.markdown(
    "batch-report",
    [
      `# C2 batch report — ${verifyDate}`,
      "",
      `**${verifiedCount} verified · ${unconfirmedCount} unconfirmed · ${escalatedCount} escalated** (of ${results.length} selected, stalest first)`,
      "",
      `| Bank | Status | What changed | Sources |`,
      `| --- | --- | --- | --- |`,
      ...results.map(
        (r) => `| ${r.name} | ${r.status} | ${r.changes || "—"} | ${r.sources.slice(0, 2).join("<br>") || "—"} |`,
      ),
      "",
      `Validation gate: ${gateOk ? "passed (build-data-layer, build-networks, validate-data, validate-schema)" : "FAILED after 3 attempts — see findings"}.`,
      ...(unexpected.length
        ? ["", `Unexpected changed files outside the expected paths: ${unexpected.join(", ")}`]
        : []),
    ].join("\n"),
    {
      title: `C2 batch report — ${verifyDate}`,
      description: `Per-bank outcomes of the ${verifyDate} re-verification batch.`,
      primary: true,
    },
  );
} catch {
  log("batch-report artifact could not be published; the returned report carries all findings");
}

const finalReport: WorkflowReport = {
  conclusion:
    `Re-verified ${results.length} bank(s) against live official pages: ${verifiedCount} confirmed by an independent ` +
    `auditor, ${unconfirmedCount} unconfirmed (override left in the tree — exclude from the commit if unresolved), ` +
    `${escalatedCount} escalated (nothing written). Validation gate ${gateOk ? "passed" : "FAILED"}.`,
  findings: results.map((r) => ({
    where: r.ovrPath,
    what:
      r.status === "escalated"
        ? `Escalated: ${r.issues.join("; ")}`
        : `${r.status === "verified" ? "Verified" : "UNCONFIRMED"} — ${r.changes || "no change summary"}`,
    evidence: r.sources.join(" | "),
    status: r.status === "verified" ? ("verified" as const) : ("unconfirmed" as const),
    severity: r.status === "verified" ? ("low" as const) : ("medium" as const),
  })),
  verified: [
    "node scripts/build-data-layer.js + node scripts/build-networks.js — deterministic rebuild",
    "node scripts/validate-data.js — structural validation",
    "node scripts/validate-schema.js — JSON Schema contract",
    `independent auditor re-fetched every cited source for each of the ${verifiedCount} confirmed bank(s)`,
  ],
  notCovered: [
    ...results.filter((r) => r.status !== "verified").map((r) => `${r.name}: ${r.status} — ${r.issues.join("; ")}`),
    "app store URLs (androidApp/iosApp) not independently verified (repo issue #9)",
    "UPI freeze paths (issue #34) are not part of this batch",
  ],
};
return finalReport;
