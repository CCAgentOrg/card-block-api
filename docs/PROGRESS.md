# PROGRESS — Card Block API

Running log of loop-executed work. One line per merged PR: date, issue, what landed.

| Date | PR | Issue | Summary |
| --- | --- | --- | --- |
| 2026-09-04 | #30 | — | API-first VISION.md + three-loop AGENTS.md guide |
| 2026-09-04 | #45 | #31, #26 | Per-bank data layer: 61 banks, 569 methods, generator + validator, Data CI (validate + rebuild-drift gate) |
| 2026-09-04 | #46 | #36 | JSON Schema contract (bank + index), ajv validator, schema gate in Data CI, schema_version 1.0.0 |
| 2026-09-04 | #47 | #37 | Freshness semantics (fresh/aging/stale), per-method confirmations, freshness aggregate in index |
| 2026-09-04 | #48 | #40 | Public API contract: llms.txt, docs/API.md, OpenAPI 3.1 spec, data-report issue template |
| 2026-09-04 | #49 | #41 | Loop wiring: loop-task issue template + this PROGRESS.md log |
| 2026-09-04 | #50 | #32 | C2 batch 1: top-10 banks verified against official pages, fresh 2026-09-04 |
| 2026-09-04 | #51 | #33 | Network-level entries: Visa GCAS, Mastercard MGS, RuPay/DigiSaathi |
| 2026-09-25 | #52 | #35 | National rails: 1930 cybercrime + NPCI UPI/BHIM redressal (govt entries); contract sync (upi card type, network/govt bank types), validate-schema covers rail entities, deterministic rebuild (RUN_DATE from data) |
| 2026-09-25 | #54 | #53 | CI: drop duplicate Pages deploy job (missing environment) — pages.yml is the single deploy path |

## Milestone state (2026-09-25)

- **M1 — Coverage**: 61 banks / 691 bank methods + 21 rail methods (Visa GCAS, Mastercard MGS, RuPay/DigiSaathi, 1930, NPCI UPI/BHIM) on main; top-10 banks verified (C2 batch 1). Remaining: C2 batches 2–5 (#32), per-PSP UPI freeze paths (C4, #34), RRB sweep.
- **M2 — Accuracy & Freshness**: schema contract + freshness semantics + API contract landed. Remaining: report capture API (A3, #38), sanctity gate (A4, #39).
- **M3 — Agentic Loops**: loop protocol exercised by hand (PRs #45–#52); Pages deploy fixed (#53/#54). Remaining: verification worker + scheduler (L2, #42), feedback triage (L3, #43), fork + legacy strip (L4, #44).
