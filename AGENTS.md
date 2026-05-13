# Card Block API — Autonomous Agent Guide

## What This Is

A public API + UI for Indian bank card blocking information. Helps users find toll-free numbers and blocking instructions for lost/stolen credit cards and debit cards across Indian banks.

## Target

- **End users:** Consumers who need to quickly block lost/stolen bank cards
- **Developers:** Apps that need programmatic access to bank card blocking data
- **Domain:** cardblock.cashlessconsumer.in (production), cardblockapi-dev.fly.dev (staging)

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.14, Flask + Flask-RESTx |
| Validation | Pydantic v2 |
| Frontend | Vanilla HTML/CSS/JS (no frameworks) |
| Deploy | Fly.io (Docker) |
| Testing | pytest |
| Data | Single JSON file: `app/data/banks.json` |

## Project Structure

```
card-block-api/
├── AGENTS.md                  # This file — agent workflow guide
├── ROADMAP.md                 # Feature roadmap & milestones
├── Dockerfile                 # Production: python:3.14-slim
├── fly.toml                   # Production Fly.io config
├── fly.dev.toml              # Dev/staging Fly.io config
├── .dockerignore
├── fly.dev.toml
├── requirements.txt
├── app/
│   ├── __init__.py            # Flask factory, loads banks.json
│   ├── config.py
│   ├── api/banks.py           # REST endpoints: list, detail, search, stats, export
│   ├── services/bank_service.py
│   ├── models/bank.py         # Pydantic: BankModel, BlockingInstructionModel
│   ├── data/banks.json        # Source of truth — all bank data
│   └── static/
│       ├── index.html         # Frontend UI
│       └── logos/             # Bank SVG logos (~65 files)
└── tests/
    ├── test_api.py            # Core API endpoint tests
    ├── test_api_integration.py # Edge cases
    └── test_banks_json.py     # Data validation tests
```

## Golden Rules

1. **Always run `pytest` before committing** — 34 tests must pass
2. **Never commit data without tests** — new banks need logos + test coverage
3. **banks.json is the source of truth** — API reads it, UI renders it
4. **One bank = data + logo + tests together** — no partial commits
5. **API fields go through model → schema → tests** — update all three
6. **Dev env ≠ Prod env** — `fly.dev.toml` for testing, `fly.toml` for production

## When Adding a New Bank

```
1. Add entry to app/data/banks.json with:
   - id (snake_case), name, logo (/static/logos/foo.svg), ifsc
   - blockingInstructions for "credit" and "debit" card types
   - sources (2+): [{label, url}]
   - lastVerified (ISO date YYYY-MM-DD)
2. Create SVG logo in app/static/logos/ (100x100 viewBox, transparent bg)
3. Run: cd /root/card-block-api && source .venv/bin/activate && python -m pytest tests/ -v
4. All 34 tests must pass before committing
```

## When Adding a New API Field

```
1. Update Pydantic model in app/models/bank.py
2. Update Flask-RESTx schema in app/api/banks.py
3. Update app/data/banks.json with the new field
4. Add/modify tests in tests/
5. Run pytest, all must pass
```

## Deploy Commands

```bash
# Dev (staging)
FLY_API_TOKEN="$FLY_IO_TOKEN" flyctl deploy --ha=false -c fly.dev.toml
# → https://cardblockapi-dev.fly.dev

# Production
FLY_API_TOKEN="$FLY_IO_TOKEN" flyctl deploy --ha=false
# → https://cardblockapi.fly.dev
```

## Branching Strategy

| Branch | Purpose | Deploys To |
|--------|---------|-----------|
| `main` | Production (reviewed, tested) | cardblockapi.fly.dev |
| `dev` | Integration branch for all work | cardblockapi-dev.fly.dev |
| `feature/...` | Individual features | N/A |

- All work → `feature/*` branches → PR to `dev` → auto-deploy → QA → PR to `main`
- `main` branch protection: requires 1+ review before merge

## Data Schema

```json
{
  "bank_id": {
    "id": "hdfc",
    "name": "HDFC Bank",
    "logo": "/static/logos/hdfc.svg",
    "ifsc": "HDFC0000001",
    "blockingInstructions": {
      "credit": {
        "tollFree": "1800-258-6456",
        "number1": "1800-266-6456",
        "email": "customercare@hdfcbank.com",
        "website": "https://www.hdfcbank.com/",
        "androidApp": "https://play.google.com/store/apps/details?id=com.hdfcbank.mobile",
        "iosApp": "https://apps.apple.com/in/app/hdfc-bank/id657927626",
        "notes": "Additional instructions here"
      },
      "debit": { ... }
    },
    "sources": [
      {"label": "HDFC Bank Customer Care", "url": "https://www.hdfcbank.com/..."},
      {"label": "RBI Ombudsman", "url": "https://sachet.rbi.org.in"}
    ],
    "lastVerified": "2025-05-13"
  }
}
```

## Common Pitfalls

- **Logo paths** must exactly match filenames in `app/static/logos/` — test_logo_files_exist will fail
- **Bank IDs** must be lowercase snake_case — test_bank_ids_are_lowercase validates
- **Toll-free is required** for every card type — test_blocking_instructions_have_tollfree
- **2+ sources for top banks** — test_at_least_2_sources_for_top_banks
- **URLs must have valid format** — test_all_urls_valid_format
- **Flask-RESTx pydantic mismatch** — the .abort() calls in app/api/banks.py trigger Pyright warnings but runtime works; ignore LSP diagnostics if pytest passes
