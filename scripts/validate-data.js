#!/usr/bin/env node
// Validate the per-bank data layer (data/banks/*.json) against the AGENTS.md schema.
// Exit 1 on any error; print warnings for soft issues.

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "data", "banks");
const REQUIRED_BANK = ["name", "slug", "type", "website", "cards", "verification"];
const BANK_TYPES = ["public", "private", "rrb", "coop"];
const CHANNELS = ["sms", "phone", "app", "website", "email", "branch", "upi", "network", "govt", "other"];
const STATUSES = ["human_verified", "agent_verified", "unverified", "disputed"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let errors = 0;
let warnings = 0;
const warn = (m) => { warnings++; console.error("WARN: " + m); };
const fail = (m) => { errors++; console.error("ERROR: " + m); };

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
if (!files.length) fail("no per-bank files found in data/banks/");

const slugs = new Set();
for (const file of files) {
  const rel = "data/banks/" + file;
  let bank;
  try { bank = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")); }
  catch (e) { fail(rel + ": invalid JSON (" + e.message + ")"); continue; }

  for (const k of REQUIRED_BANK) if (!(k in bank)) fail(rel + ": missing required field " + k);
  if (!BANK_TYPES.includes(bank.type)) fail(rel + ": bad type " + bank.type);
  if (slugs.has(bank.slug)) fail(rel + ": duplicate slug " + bank.slug);
  slugs.add(bank.slug);

  const v = bank.verification || {};
  if (!STATUSES.includes(v.status)) fail(rel + ": bad verification.status " + v.status);
  if (v.status !== "disputed" && !v.last_verified) fail(rel + ": missing verification.last_verified");
  if (v.last_verified && !DATE_RE.test(v.last_verified)) fail(rel + ": bad last_verified date format");
  if (typeof v.confidence !== "number" || v.confidence < 0 || v.confidence > 1) warn(rel + ": verification.confidence missing/out of range");
  if (!Array.isArray(v.sources) || !v.sources.length) warn(rel + ": no sources listed");
  if (!Array.isArray(bank.cards) || !bank.cards.length) fail(rel + ": cards empty");

  let methodCount = 0;
  for (const card of bank.cards || []) {
    if (!["debit", "credit"].includes(card.type)) fail(rel + ": unknown card type " + card.type);
    if (!Array.isArray(card.blocking_methods) || !card.blocking_methods.length) warn(rel + ": card " + card.type + " has no blocking_methods");
    for (const [i, m] of (card.blocking_methods || []).entries()) {
      methodCount++;
      const at = rel + " card " + card.type + " method[" + i + "]";
      if (!CHANNELS.includes(m.channel)) fail(at + ": bad channel " + m.channel);
      if (!m.instructions || !String(m.instructions).trim()) fail(at + ": empty instructions");
      if (typeof m.confidence !== "number" || m.confidence < 0 || m.confidence > 1) warn(at + ": confidence missing/out of range");
      if (!m.last_verified || !DATE_RE.test(m.last_verified)) fail(at + ": missing/bad last_verified");
      const hasContact = m.phone || m.email || m.url || (Array.isArray(m.urls) && m.urls.length);
      if (!hasContact && m.channel !== "branch" && m.channel !== "sms") warn(at + ": no contact target (phone/email/url)");
    }
  }
  if (methodCount === 0) fail(rel + ": zero blocking methods");
}

// index.json consistency
const indexPath = path.join(DIR, "index.json");
try {
  const idx = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (idx.count !== files.length) fail("index.json count (" + idx.count + ") != file count (" + files.length + ")");
  for (const b of idx.banks || []) {
    if (!slugs.has(b.slug)) fail("index.json: unknown slug " + b.slug);
    if (!fs.existsSync(path.join(DIR, b.slug + ".json"))) fail("index.json: missing file for " + b.slug);
  }
  const missingFromIndex = [...slugs].filter((s) => !(idx.banks || []).some((b) => b.slug === s));
  if (missingFromIndex.length) fail("index.json missing slugs: " + missingFromIndex.join(", "));
} catch (e) {
  fail("index.json missing or invalid: " + e.message);
}

const totalMethods = files.length;
console.log(`validated ${files.length} bank files`);
if (errors || warnings) console.log(`errors: ${errors}, warnings: ${warnings}`);
process.exit(errors ? 1 : 0);
