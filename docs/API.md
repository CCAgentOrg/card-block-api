# API Reference — Card Block API

Static JSON surface on GitHub Pages. No auth, no rate limits beyond Pages' own CDN. All data is versioned in git; the git history is the audit trail.

Base URL: `https://ccagentorg.github.io/card-block-api/`

## Endpoints

### `GET /data/index.json`

API manifest.

```json
{
  "name": "card-block-api",
  "description": "Verified payment-instrument blocking methods. India pilot.",
  "schema_version": "1.0.0",
  "updated": "2026-09-04",
  "endpoints": {
    "bank_index": "/data/banks/index.json",
    "bank": "/data/banks/<slug>.json"
  },
  "bank_count": 61,
  "freshness": { "fresh": 0, "aging": 0, "stale": 61 },
  "total_methods": 569,
  "card_types": ["debit", "credit"],
  "channels": ["phone", "email", "website", "app", "other"],
  "schema_note": "See AGENTS.md for the full schema. verification.status: human_verified > agent_verified > unverified > disputed"
}
```

### `GET /data/banks/index.json`

Summary of every bank. Use this to enumerate slugs and check freshness before fetching full entries.

```json
{
  "schema_version": "1.0.0",
  "updated": "2026-09-04",
  "count": 61,
  "freshness": { "fresh": 0, "aging": 0, "stale": 61 },
  "banks": [
    {
      "slug": "axis",
      "name": "Axis Bank",
      "type": "private",
      "card_types": ["debit", "credit"],
      "method_count": 12,
      "verification_status": "agent_verified",
      "last_verified": "2026-05-12"
    }
  ]
}
```

Validated against `schemas/index.schema.json`.

### `GET /data/banks/{slug}.json`

Full blocking data for one bank. Validated against `schemas/bank.schema.json`.

```json
{
  "name": "Axis Bank",
  "slug": "axis",
  "type": "private",
  "website": "https://www.axisbank.com",
  "cards": [
    {
      "type": "debit",
      "blocking_methods": [
        {
          "channel": "phone",
          "label": "tollFree",
          "instructions": "Call 1800-209-5577 and follow the IVR to hotlist the card.",
          "phone": "1800-209-5577",
          "confidence": 0.85,
          "last_verified": "2026-05-12",
          "sources": ["https://www.axisbank.com/contact-us"],
          "confirmations": { "worked": 0, "failed": 0 }
        }
      ]
    }
  ],
  "verification": {
    "status": "agent_verified",
    "confidence": 0.85,
    "last_verified": "2026-05-12",
    "sources": ["https://www.axisbank.com/contact-us"]
  }
}
```

Method `channel` enum: `sms`, `phone`, `app`, `website`, `email`, `branch`, `upi`, `network`, `govt`.
Bank `type` enum: `public`, `private`, `rrb`, `coop`, `payments`, `sfb`, `foreign`.
Card `type` enum: `debit`, `credit`, `prepaid`, `forex`.

### `GET /schemas/bank.schema.json`, `GET /schemas/index.schema.json`

JSON Schema (draft 2020-12) contracts. Machine clients can validate responses locally.

## Client-side freshness computation

No server round-trip needed. Given `last_verified` (ISO date `YYYY-MM-DD`):

```
age_days = (today - last_verified) in days
fresh: age_days <= 30
aging: 30 < age_days <= 90
stale: age_days > 90
```

Index files carry a pre-computed `freshness` aggregate so agents can triage without fetching every bank.

## Verification status ladder

`human_verified` > `agent_verified` > `unverified` > `disputed`.

- `human_verified` — a human confirmed against the bank's official page.
- `agent_verified` — automated pipeline verified against official sources; carries `confidence` (0–1).
- `unverified` — data present but not yet verified; treat with caution.
- `disputed` — user reports contradict the entry; suppressed from recommendations pending re-verification.

## Report flow (feedback loop)

Reports are GitHub issues on `CCAgentOrg/card-block-api`, labeled `data-report`. The flow:

1. Client detects a wrong/stale method (or a user reports it).
2. Client (or human) files an issue titled `data-report: <bank slug> — <what is wrong>`, body naming the specific field and the correct value, with a source URL if available.
3. A maintainer/agent labels it `data-report` + `needs-reverify`.
4. The data loop re-verifies against official sources and lands the correction as a PR (fresh `last_verified` + sources). The issue closes when the PR merges.

Guardrails (see AGENTS.md):

- Reports never mutate data directly; corrections only via PRs.
- 2–3 independent reports on the same field → method is suppressed (`disputed`) and flagged for human review.
- Never include card numbers, PINs, OTPs, CVV, or passwords in reports.

Issue template: `.github/ISSUE_TEMPLATE/data-report.md`.

## Versioning

`schema_version` follows semver: patch = doc-only, minor = additive fields (old clients keep working), major = breaking (fields removed/renamed or enum values dropped). Clients should pin to a major and check `/data/index.json` before bulk reads. Breaking changes are announced in release notes at least 14 days before the switch.
