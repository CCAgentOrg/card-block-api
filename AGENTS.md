# AGENTS.md - Card Block API (Agent Guide)

> Guidance for AI agents operating in this repository. Read VISION.md first — it defines what this project is and is not.

## Project Overview

**Card Block API is an API-first data project**: the verified, machine-readable data surface for payment-instrument blocking (how to block a lost/stolen card, UPI, netbanking). Pilot: India. Eventual: universal.

- **In scope (this repo):** data JSON, API contract/schema, report/feedback endpoints, verification tooling, CI.
- **Non-goals (derived surfaces, other projects):** first-party website UI, MCP server, agent tooling, consumer apps. Existing site HTML and MCP code are **parked reference demos** — do not invest in them.

**Repo:** `CCAgentOrg/card-block-api` (public). Branches: `main` (GitHub Pages source), `dev` (integration). Live: https://ccagentorg.github.io/card-block-api/

## Three-Loop Operating Model

All work is driven by three loops. Issues are labeled by loop: `loop:build`, `loop:data`, `loop:feedback`.

### Loop 1 — Build loop (software)

1. Pick a labeled open issue (ordered by milestone).
2. Create fix branch from `main`: `fix/<issue#>-<slug>` or `feat/<issue#>-<slug>`.
3. Implement; verify locally: JSON validation, `npm test`/pytest as applicable, build checks.
4. Open PR into `main` referencing the issue number in the title.
5. **Adversarial review agent** reviews the PR before merge (correctness, security, schema compliance).
6. Merge (squash) → auto-close issue → delete branch.

### Loop 2 — Data loop (freshness — the core product)

Scheduled agent re-verification of each bank's official blocking page → diff against published fields → flag/update stale entries → PR with fresh `last_verified` per field and sources. Stale `agent_verified` entries visibly decay. Multi-source disagreement → escalate to human review, never guess.

### Loop 3 — Feedback loop (users + agents)

Reports/confirmations arrive via API endpoints (GitHub issues as transport, labeled `data-report`). **Sanctity rule: reports never mutate `blocking_methods` directly.** A report flips the bank to `disputed`/`needs_reverify` and enqueues it in Loop 2. Only Loop 2 changes fields; every change is a git commit (the audit trail). Escalation gate: 2–3 independent reports on the same field → suppress method + human review to restore. Never accept card numbers/PIN/OTP in reports.

## Milestones

| Milestone | Goal |
| --- | --- |
| **M1 — Coverage** | India pilot data complete: per-bank JSON layer exists, top banks fully populated, RRBs + UPI + network entries covered |
| **M2 — Accuracy & Freshness** | Schema hardening (confidence/confirmations), report endpoints with sanctity guardrails, escalation gate, API contract docs |
| **M3 — Agentic Loops** | Build/data/feedback loops wired as automation; CI deploy fixed; fork + legacy strip (post-fork) |

Issue breakdown lives in GitHub Issues under these milestones.

## Parked Legacy (do NOT invest; strip after fork to CashlessConsumer/)

- `app/`, `run.py`, `tests/`, `requirements.txt`, `Dockerfile`, `fly.toml` — Flask MVP (reference demo of an API consumer)
- `index.html`, `about.html`, `policy.html`, `reports.html`, `404.html` — static site demo (UI is a non-goal)
- `mcp/` — MCP server reference (derived surface; lives outside this project)
- `scripts/*.js` — legacy one-off verification scripts; superseded by Loop 2 tooling (keep until replaced)

## Current Data Reality (2026-09-04)

- `data/` contains only 3 aggregate files: `IFSC-list.json` (Razorpay IFSC), `banks-from-razorpay.json` (1,344 entries), `release.json` (GitHub release metadata). **No per-bank files exist** — the demo UI fetches `/data/banks/*.json` and gets 404s (issue #26).
- 61 banks in the release aggregate; 13 RRBs added on `dev` (not yet in `main`).

## Data Schema

Per-bank file: `data/banks/<slug>.json`, plus `data/banks/index.json`.

Required fields: `name`, `slug`, `type` (`public`|`private`|`rrb`|`coop`), `website`, `cards` (array of card types), `blocking_methods` (array), `verification` object.

```json
{
  "name": "HDFC Bank",
  "slug": "hdfc-bank",
  "type": "private",
  "website": "https://hdfcbank.com",
  "verification": {
    "status": "agent_verified",
    "confidence": 0.95,
    "last_verified": "2026-09-04",
    "sources": ["https://..."]
  },
  "cards": [
    {
      "type": "debit",
      "blocking_methods": [
        {
          "channel": "sms",
          "instructions": "SMS BLOCK <last4> to 5676711",
          "confidence": 0.9,
          "last_verified": "2026-09-04"
        }
      ]
    }
  ]
}
```

Channels: `sms`, `phone`, `app`, `website`, `email`, `branch`, `upi`, `network` (Visa GCAS / Mastercard MGS), `govt` (1930, RBI 14440).

Verification status: `human_verified` > `agent_verified` > `unverified` > `disputed` (suppressed pending re-verification).

## Conventions

- JSON: 2-space indent, no trailing commas; every method needs a source URL and `last_verified`.
- JS: 2 spaces, semicolons, ES6+, try/catch on async; Python: follow existing app style.
- Commits: specific, e.g. `data: verify HDFC Bank blocking methods (sources + timestamps)`.
- Data PRs: one bank per PR where feasible; loop-batch PRs may group banks with per-bank commit separation.
- Never commit credentials; verification uses public pages only.
- CI: GitHub Actions validate + deploy; `main` deploys to Pages. Do not push broken JSON — CI is the last gate, not the only one.

## Contact

- GitHub Issues: https://github.com/CCAgentOrg/card-block-api/issues
- Email: contact@cashlessconsumer.in
