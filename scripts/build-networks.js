#!/usr/bin/env node
/**
 * build-networks.js — generate data/networks/index.json (issue #33)
 *
 * Hand-maintained per-network files (Visa GCAS, Mastercard MGS, RuPay/DigiSaathi)
 * are validated here and summarized into an index for machine discovery.
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "data", "networks");
const GOVT_DIR = path.join(__dirname, "..", "data", "govt");
const RUN_DATE = new Date().toISOString().slice(0, 10);
const files = [
  ...fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => path.join(DIR, f)),
  ...(fs.existsSync(GOVT_DIR) ? fs.readdirSync(GOVT_DIR).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => path.join(GOVT_DIR, f)) : []),
];
if (!files.length) {
  console.error("FAIL: no network/govt files");
  process.exit(1);
}

const CHANNELS = ["phone", "sms", "app", "website", "email", "upi", "network", "govt", "branch", "other"];
const entries = [];
let methodCount = 0;

for (const f of files) {
  const p = f;
  let n;
  try {
    n = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.error("FAIL " + f + ": " + e.message);
    process.exit(1);
  }
  for (const req of ["name", "slug", "type", "website", "cards", "verification"]) {
    if (!(req in n)) { console.error("FAIL " + f + ": missing " + req); process.exit(1); }
  }
  if (!["network", "govt"].includes(n.type)) { console.error("FAIL " + f + ": type must be network|govt"); process.exit(1); }
  const v = n.verification || {};
  if (!v.last_verified || !/^\d{4}-\d{2}-\d{2}$/.test(v.last_verified)) {
    console.error("FAIL " + f + ": verification.last_verified missing/malformed");
    process.exit(1);
  }
  for (const card of n.cards) {
    for (const [i, m] of card.blocking_methods.entries()) {
      methodCount++;
      if (!CHANNELS.includes(m.channel)) {
        console.error("FAIL " + f + " card " + card.type + " method[" + i + "]: bad channel " + m.channel);
        process.exit(1);
      }
      if (!m.phone && !m.url && !m.email) {
        console.error("FAIL " + f + " card " + card.type + " method[" + i + "]: no contact target");
        process.exit(1);
      }
      if (!m.last_verified) {
        console.error("FAIL " + f + " card " + card.type + " method[" + i + "]: missing last_verified");
        process.exit(1);
      }
    }
  }
  entries.push({
    slug: n.slug,
    name: n.name,
    method_count: n.cards.reduce((acc, c) => acc + c.blocking_methods.length, 0),
    last_verified: v.last_verified,
  });
}

fs.writeFileSync(
  path.join(DIR, "index.json"),
  JSON.stringify(
    {
      schema_version: "1.0.0",
      updated: RUN_DATE,
      count: entries.length,
      method_count: methodCount,
      networks: entries,
      note: "Network-level channels (Visa GCAS, Mastercard MGS, RuPay/DigiSaathi) and national govt rails (1930, NPCI UPI redressal). These work even when the issuing bank's own lines are jammed. Per-bank data lives in /data/banks/.",
    },
    null,
    2
  ) + "\n"
);
console.log("networks written: " + entries.length + ", methods: " + methodCount);
