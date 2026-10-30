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
| 2026-09-25 | #56 | #32 | C2 batch 2: 6 banks re-verified against live official pages |
| 2026-10-27 | #57 | #32 | C2 batch 3: 8 banks re-verified (Airtel, AU, Bandhan, BoM, Capital SFB, City Union, CSB, DBS) via verify-stale-banks workflow (per-bank researcher + independent auditor + validation gate); ADCB escalated (India retail exit evidence — human decision needed), CBI deferred (infra error); freshness 8 fresh / 16 aging / 37 stale |
| 2026-10-27 | #59 | #32 | C2 batch 4: 7 banks re-verified (Equitas, ESAF, Federal, Fino, IDBI, Indian, J&K); escalated: ADCB (#58 — RBI gazette ceased ADCB PJSC in India 2023), CBI debit-SMS number conflict (#60), IOB overseas-hotline conflict (#61); freshness 15 fresh / 16 aging / 30 stale |
| 2026-10-30 | #62 | #32 | C2 batch 5: 10/10 banks re-verified (Jana, Karnataka, Karur Vysya, Nainital, NSDL, Paytm, Punjab & Sind, Saraswat, SVC, South Indian) — zero escalations; Paytm Payments entry rewritten to winding-up state (RBI licence cancelled 2026-04-24, Delhi HC wound up 2026-07-08); .bank.in domain migration captured for 6 more banks; freshness 25 fresh / 16 aging / 20 stale |
| 2026-10-31 | #64 | #63 | Generator boilerplate fixes: tollFree-only hotlist claim, (alternate line — see notes) phrasing, `inactive` bank handling (Paytm), NSDL Payments Bank name; excludeSlugs workflow arg |
| 2026-10-31 | #65 | #34 | C4 plumbing: upi card type in generator + validator, instrument-aware phrasing, derived card_types; verify-upi-paths saved workflow (researcher + auditor with merge-preservation git-diff check, UPI-volume priority order, Paytm excluded) |
| 2026-10-31 | #66 | #34 | C4 UPI batch 1: UPI freeze paths live for 9/10 top-UPI banks (SBI, Yes, Axis, ICICI, Kotak, PNB, BoB, Canara, Union) — in-app menu paths, SMS/email blocks, phone fallbacks, each with own lastVerified; HDFC deferred (escalated, no reason); index-schema card_types enum fixed (missed in #65); total methods 676 |

## Milestone state (2026-10-27)

- **M1 — Coverage**: 61 banks / 664 bank methods + 21 rail methods on main; 24 banks live-verified (C2 batches 1–3). Loop 2 wired as durable automation: saved workflow `verify-stale-banks` + every-2-days schedule with adversarial-review-before-merge. Remaining: C2 batches 4–5 (~37 stale, #32), ADCB suppression decision, per-PSP UPI freeze paths (C4, #34), RRB sweep.
- **M2 — Accuracy & Freshness**: schema contract + freshness semantics + API contract landed. Remaining: report capture API (A3, #38), sanctity gate (A4, #39).
- **M3 — Agentic Loops**: loop protocol exercised by hand (PRs #45–#52); Pages deploy fixed (#53/#54). Remaining: verification worker + scheduler (L2, #42), feedback triage (L3, #43), fork + legacy strip (L4, #44).
