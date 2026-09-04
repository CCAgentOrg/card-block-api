# VISION.md — Card Block API

> Continuously up-to-date, exact, precise information on how to block cards and other payment instruments. Pilot: India. Eventually: universal. **API-first:** this project ships the data and the API surface; UIs, agents, MCP servers, and apps are derived surfaces that consume it.

**Status:** Vision, 2026-09-04. Drives the loop-engineering setup (three-loop architecture below).

---

## 1. The problem

A card is stolen. The holder needs one thing: the exact, working way to block it — an SMS format, a hotlist number, an app path — for *their* bank, *right now*.

Today that information exists but is unusable at the moment of need:

- **140+ banks each publish their own instructions** on pages that move, renumber, and go stale silently. No one can check 140 pages at 2 AM.
- **SEO content farms** (BankBazaar, Paisabazaar, Paytm blog, indiacustomercare.com, and long-tail scrapers) republish bank content with no timestamps, no sources, no verification. A wrong hotlist number there is a financial-loss event — and none of them treat it that way.
- **LLMs and answer engines** (ChatGPT, Gemini, Perplexity) now answer "how do I block my HDFC card" by synthesizing that stale content. The structured data layer they *should* pull from does not exist.

## 2. What this project is

The **verified, machine-readable data + API surface** for payment-instrument blocking:

- Per-bank blocking methods across every channel: `sms`, `phone`, `app`, `website`, `email`, `branch` (schema in AGENTS.md)
- Per-field verification: `status`, `confidence`, `last_verified`, `sources` — freshness and confidence are first-class API fields, not silent failures
- Open API surface: stable JSON endpoints (index, per-bank `/data/banks/*.json`, report endpoints) — the contract every consumer builds against
- Never asks users for card numbers, PINs, or OTPs — we publish channels, we don't intermediarize blocks

**Non-goals (current project):** first-party website UI, MCP server, agent tooling, consumer/mobile apps. These are *derived surfaces* — separate projects, other teams, and third parties that build on the API. The measure of the API is that derived surfaces are cheap to build: stable schema, per-field freshness and confidence, machine-readable everywhere.

**Pilot scope:** India (public + private banks, RRBs, co-ops; card + UPI + netbanking lock channels). **Universal scope:** same schema per country; card-network global services included as first-class entries (see §3).

## 3. Why it wins

Every existing option is static. Continuously-updated is the product, and it requires an always-running verification loop — which is what loop engineering provides. The differentiation:

|  | Banks | SEO farms | Card networks | This project |
| --- | --- | --- | --- | --- |
| Cross-bank, one place | ✗ | ✓ | partial | ✓ |
| Exact SMS format / app path | ✓ (fragmented) | stale | ✗ | ✓ |
| Per-field timestamps + sources | ✗ | ✗ | ✗ | ✓ |
| Machine-readable API | ✗ | ✗ | ✗ | ✓ |
| Continuously re-verified | ✗ | ✗ | n/a | ✓ |

Card networks (Visa Global Customer Assistance, Mastercard Global Service) are the closest thing to universal infrastructure — 24/7 worldwide lost/stolen reporting, blocks within \~30 minutes, per-country toll-free numbers. They can't be beaten for a traveler abroad, so they are **included** in the dataset (per issuer country) rather than competed with. They remain phone-only, issuer-country-based, and blind to bank-level channels like SMS formats and temporary freezes.

Government rails in India (1930/cybercrime.gov.in for in-flight fraud freezes, RBI 14440/14448, zero-liability framework) answer "money already left" — a different moment. Every India page surfaces them alongside bank channels. UPI freeze channels are in scope; no competitor covers them at all.

**Freshness is the product; displaying it is a derived surface's job.** The API exposes `last_verified`, `confidence`, and confirmation counts so any client can render "Verified 3 days ago · 12 user confirmations" vs a content farm's silent 2022 article.

## 4. Three-loop architecture

The project runs on three loops. All data changes flow through verification; nothing user- or agent-submitted reaches published fields directly.

### Loop 1 — Build loop (software)

Labeled issue → fix branch → verify (lint/test/build) → PR → adversarial review agent → merge → auto-close.

### Loop 2 — Data loop (freshness — the core product)

Scheduled agent re-verification of each bank's official blocking page → diff → flag/update stale entries → publish with fresh `last_verified` per field. Stale `agent_verified` entries visibly decay; multi-source disagreements escalate to human review.

### Loop 3 — Feedback loop (users + agents in the wild)

Capture is part of the **API surface** — report/confirmation endpoints, not a first-party UI. Derived surfaces (the site, MCP servers, apps) are thin clients of these endpoints.

Two capture signals:

1. **One-click confirmation** per blocking method ("This worked" / "This didn't work") → raises/decays per-method confidence, bumps the bank up the re-verification queue.
2. **Structured correction report** per bank: channel, what's wrong, optional source URL. Explicit rule: never enter card numbers, PIN, OTP, account details; the API rejects numeric-heavy free text and client forms mirror that.

**Sanctity guardrails (non-negotiable):**

- Reports **never** mutate `blocking_methods` directly. A report flips the bank to `disputed`/`needs_reverify` and enqueues it in the Data loop.
- Only the Data loop changes fields, and every change lands as a git commit — git history is the audit trail.
- **Escalation gate:** N independent reports (2–3) on the same field → suppress the method from display ("hidden pending re-verification") + human review required to restore. Wrong-number exposure is worse than missing data.
- Rate-limit + dedupe; corrections require a GitHub account (confirmations can be anonymous, weighted lower).

**Closing the loop visibly:** the API returns correction provenance per method ("corrected on &lt;date&gt; after user report", reporter credit where a GitHub handle is given) so any derived surface can display it. Visible closure is what sustains reporting.

**Agents as sensors:** the same report endpoints serve agents in the wild — an MCP server (`reportBankIssue`) or any consumer tool is a thin client over the API, and lives outside this project.

## 5. Scope ladder (payment instruments)

Same schema, channel-based, so expansion is additive:

1. **Debit + credit cards** (pilot, India)
2. **UPI** — freeze/block via bank app, 1930 flow
3. **Netbanking / mobile-banking lock**, card on/off switches
4. **Other instruments** — wallets, FASTag, e-mandates
5. **Other countries** — country file per schema + network-level GCAS/MGS entries

## 6. Honest risk

High stakes for wrong data: a dead hotlist number on this site is worse than none, because we claim verification. Mitigations are structural — verification tiers, per-field timestamps, the escalation gate, and the Data loop making `human_verified` grow over time. If we can't keep a field fresh, the honest output is "unverified — call your bank's number on the card" not a plausible guess.