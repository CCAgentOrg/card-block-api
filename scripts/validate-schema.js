#!/usr/bin/env node
/**
 * Schema validator — validates every data/banks/*.json + index.json against
 * schemas/bank.schema.json and schemas/index.schema.json (draft 2020-12).
 * Usage: node scripts/validate-schema.js
 * Exit 1 on any failure. Wired into Data CI (schema contract, issue #36).
 */
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const bankSchema = ajv.compile(JSON.parse(fs.readFileSync(path.join(__dirname, "../schemas/bank.schema.json"), "utf8")));
const indexSchema = ajv.compile(JSON.parse(fs.readFileSync(path.join(__dirname, "../schemas/index.schema.json"), "utf8")));

const dir = path.join(__dirname, "../data/banks");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json");

let failures = 0;
let methodCount = 0;

files.forEach((f) => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  if (!bankSchema(data)) {
    failures++;
    console.error(`FAIL ${f}: ${ajv.errorsText(bankSchema.errors)}`);
  } else {
    methodCount += data.cards.reduce((n, c) => n + c.blocking_methods.length, 0);
  }
});

const indexPath = path.join(dir, "index.json");
if (fs.existsSync(indexPath)) {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (!indexSchema(index)) {
    failures++;
    console.error(`FAIL index.json: ${ajv.errorsText(indexSchema.errors)}`);
  } else if (index.count !== files.length) {
    failures++;
    console.error(`FAIL index.json: count ${index.count} != ${files.length} bank files`);
  }
} else {
  console.error("warn: data/banks/index.json missing");
}

if (failures > 0) {
  console.error(`schema validation: ${failures} failed files`);
  process.exit(1);
}
console.log(`schema validation: ${files.length} bank files + index OK (${methodCount} methods)`);
