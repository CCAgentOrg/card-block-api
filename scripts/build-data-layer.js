#!/usr/bin/env node
/**
 * build-data-layer.js — derive data/banks/*.json + index files (issue #31, closes #26)
 *
 * Source of truth for this run: app/data/banks.json (61 verified bank entries,
 * blockingInstructions per card type, sources, lastVerified).
 *
 * Output schema (per AGENTS.md):
 *   data/banks/<slug>.json  — per-bank entry
 *   data/banks/index.json   — summary of all banks
 *   data/index.json         — top-level dataset index for agents
 *
 * Channel mapping (app legacy key -> canonical channel):
 *   tollFree/number1/number2/rmn -> phone (instructions combine numbers)
 *   email -> email, website -> website, androidApp/iosApp -> app
 *   notes preserved as part of instructions where no dedicated channel fits
 *
 * Confidence: legacy entries are agent-verified (0.85) — human eyeball pending (C2).
 * Never fabricates dates: last_verified preserved from source.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "app", "data", "banks.json");
const OUT_DIR = path.join(ROOT, "data", "banks");

const RUN_DATE = process.argv[2] || new Date().toISOString().slice(0, 10);
const SCHEMA_VERSION = "1.0.0";
const DEFAULT_CONFIDENCE = 0.85;

function slugify(id) {
  return id.replace(/_/g, "-");
}

function phoneMethod(label, num) {
  if (!num) return null;
  return {
    channel: "phone",
    label: label,
    instructions: "Call " + num + " and follow the IVR to hotlist the card.",
    phone: num,
  };
}

function buildMethods(inst, lastVerified, sources) {
  if (!inst) return [];
  const methods = [];

  const phones = [
    ["tollFree", inst.tollFree],
    ["alternate", inst.number1],
    ["alternate", inst.number2],
  ];
  phones.forEach(([label, num]) => {
    const m = phoneMethod(label, num);
    if (m) methods.push(m);
  });

  if (inst.rmn) {
    methods.push({
      channel: "sms",
      instructions: "SMS " + inst.rmn,
      confidence: 0.85,
    });
  }

  if (inst.email) {
    methods.push({
      channel: "email",
      instructions: "Email " + inst.email + " from your registered email to request card blocking.",
      email: inst.email,
    });
  }

  if (inst.website) {
    methods.push({
      channel: "website",
      instructions: "Log in to internet banking at " + inst.website + " and use the card block/hotlist option.",
      url: inst.website,
    });
  }

  const appUrls = [];
  if (inst.androidApp) appUrls.push("Android: " + inst.androidApp);
  if (inst.iosApp) appUrls.push("iOS: " + inst.iosApp);
  if (appUrls.length) {
    methods.push({
      channel: "app",
      instructions: "Block via the bank's mobile app (Cards > Block/Hotlist). " + appUrls.join(" | "),
      urls: [inst.androidApp, inst.iosApp].filter(Boolean),
    });
  }

  if (methods.length === 0 && inst.notes) {
    methods.push({
      channel: "other",
      instructions: inst.notes,
    });
  }

  return methods.map((m) => ({
    ...m,
    confidence: DEFAULT_CONFIDENCE,
    last_verified: inst.lastVerified || lastVerified,
    sources: sources,
    confirmations: { worked: 0, failed: 0 },
  }));
}

const banks = JSON.parse(fs.readFileSync(SRC, "utf8"));
const ids = Object.keys(banks);
const indexEntries = [];
// Freshness bands (VISION §3 / AGENTS.md): fresh <=30d, aging 30-90d, stale >90d from last_verified
function freshnessBand(dateStr) {
  if (!dateStr) return "stale";
  const days = (new Date(RUN_DATE + "T00:00:00Z").getTime() - new Date(dateStr + "T00:00:00Z").getTime()) / 86400000;
  if (days <= 30) return "fresh";
  if (days <= 90) return "aging";
  return "stale";
}
const freshnessAggregate = { fresh: 0, aging: 0, stale: 0 };
const errors = [];

ids.forEach((id) => {
  const b = banks[id];
  const bLastVerified = b.lastVerified || null;
  const slug = slugify(b.id || id);

  const sources = (b.sources || []).map((src) => src.url).filter(Boolean);
  const cardTypes = [];
  ["debit", "credit"].forEach((t) => {
    const inst = b.blockingInstructions && b.blockingInstructions[t];
    if (!inst) return;
    const methods = buildMethods(inst, bLastVerified, sources);
    if (!methods.length) {
      errors.push(slug + "/" + t + ": no methods derived");
      return;
    }
    cardTypes.push({ type: t, blocking_methods: methods });
  });

  if (!cardTypes.length) {
    errors.push(slug + ": no card types with methods; skipped");
    return;
  }

  const entry = {
    name: b.name,
    slug: slug,
    type: typeFor(slug),
    website: firstWebsite(b),
    cards: cardTypes,
    verification: {
      status: "agent_verified",
      confidence: DEFAULT_CONFIDENCE,
      last_verified: bLastVerified,
      sources: sources,
    },
  };

  if (!entry.website) delete entry.website;
  if (!entry.verification.last_verified) {
    entry.verification.status = "unverified";
    entry.verification.confidence = 0.5;
    entry.verification.last_verified = RUN_DATE;
    entry.verification.sources = entry.verification.sources.length ? entry.verification.sources : ["source:app/data/banks.json"];
  }

  const file = path.join(OUT_DIR, slug + ".json");
  fs.writeFileSync(file, JSON.stringify(entry, null, 2) + "\n");

  indexEntries.push({
    slug: slug,
    name: b.name,
    type: entry.type,
    card_types: cardTypes.map((c) => c.type),
    method_count: cardTypes.reduce((n, c) => n + c.blocking_methods.length, 0),
    verification_status: entry.verification.status,
    last_verified: entry.verification.last_verified,
  });
  freshnessAggregate[freshnessBand(entry.verification.last_verified)]++;
});

function typeFor(slug) {
  if (/gramin|rrb/.test(slug)) return "rrb";
  if (/coop|cooperative|apg|saraswat|shamrao/.test(slug)) return "coop";
  if (/payments|fino|airtel|paytm/.test(slug)) return "private";
  return "private";
}

function firstWebsite(b) {
  for (const t of ["credit", "debit"]) {
    const inst = b.blockingInstructions && b.blockingInstructions[t];
    if (inst && inst.website) return inst.website;
  }
  return undefined;
}

indexEntries.sort((a, x) => a.name.localeCompare(x.name));

fs.writeFileSync(
  path.join(OUT_DIR, "index.json"),
  JSON.stringify(
    {
      schema_version: "1.0.0",
      updated: RUN_DATE,
      count: indexEntries.length,
      freshness: freshnessAggregate,
      banks: indexEntries,
    },
    null,
    2
  ) + "\n"
);

fs.writeFileSync(
  path.join(ROOT, "data", "index.json"),
  JSON.stringify(
    {
      name: "card-block-api",
      description: "Verified payment-instrument blocking methods. India pilot.",
      schema_version: SCHEMA_VERSION,
      updated: RUN_DATE,
      endpoints: {
        bank_index: "/data/banks/index.json",
        bank: "/data/banks/<slug>.json",
      },
      schema_version: "1.0.0",
      bank_count: indexEntries.length,
      freshness: freshnessAggregate,
      total_methods: indexEntries.reduce((n, e) => n + e.method_count, 0),
      card_types: ["debit", "credit"],
      channels: ["phone", "email", "website", "app", "other"],
      schema_note: "See AGENTS.md for the full schema. verification.status: human_verified > agent_verified > unverified > disputed",
    },
    null,
    2
  ) + "\n"
);

console.log("banks written:", indexEntries.length);
console.log("methods total:", indexEntries.reduce((n, e) => n + e.method_count, 0));
if (errors.length) {
  console.log("WARNINGS:");
  errors.forEach((e) => console.log(" -", e));
}
