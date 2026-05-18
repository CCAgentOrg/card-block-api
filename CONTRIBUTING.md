# Contributing to Card Block API

Thank you for contributing! This project helps Indian consumers quickly find blocking instructions for lost or stolen bank cards.

## Project Overview

- **Frontend:** Flask + Jinja2 templates + Alpine.js — https://cardblock.cashlessconsumer.in
- **API:** Flask-RESTx — `/api/v1/` endpoints
- **Data:** `app/data/banks.json` — single source of truth for 115+ banks
- **Deploy:** Fly.io via GitHub Actions CI/CD
- **Testing:** pytest

## Development Workflow

### Branch Strategy

```
main        ← Production (stable)
  ↑
dev         ← Integration (auto-deployed to cardblockapi-dev.fly.dev)
  ↑
feature/*   ← Individual features (PR deploy previews)
```

1. **Create a feature branch from `dev`:**
   ```bash
   git checkout dev
   git checkout -b feature/my-feature
   ```

2. **Push and create a PR to `dev`:**
   ```bash
   git push origin feature/my-feature
   gh pr create --base dev
   ```

3. **Every PR to `dev` or `main` gets a live preview at:**
   ```
   https://cardblock-pr-{N}.fly.dev
   ```

### Local Development

```bash
# Set up the dev environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the server
python -m flask --app app run --debug
# → http://localhost:5000

# Run tests (46 tests)
python -m pytest tests/ -v
```

### CI/CD Pipeline

All PRs run automatically:
1. **Lint** → flake8
2. **Test** → pytest (46 tests, must all pass)
3. **Docker build** → validates container
4. **Deploy preview** → ephemeral Fly.io app for PRs

Merging to `dev` auto-deploys to `cardblockapi-dev.fly.dev`.

## Adding a New Bank

1. Add entry to `app/data/banks.json`:
   ```json
   {
     "bank_name": {
       "id": "bank_name",
       "name": "Bank Display Name",
       "logo": "/static/logos/bank_name.svg",
       "ifsc": "BANKIN0001",
       "blockingInstructions": {
         "credit": {
           "tollFree": "1800-XXX-XXXX",
           "number1": "1800-XXX-XXXX",
           "email": "support@bank.in",
           "website": "https://bank.in"
         },
         "debit": { ... }
       },
       "sources": [
         {"label": "Source Name", "url": "https://..."},
         {"label": "Second Source", "url": "https://..."}
       ],
       "lastVerified": "YYYY-MM-DD"
     }
   }
   ```

2. Create logo in `app/static/logos/bank_name.svg`
   - 100x100 viewBox, transparent background

3. Run tests:
   ```bash
   python -m pytest tests/ -v
   ```

4. All 46+ tests must pass.

## Data Validation Rules

- Bank IDs must be lowercase snake_case
- `tollFree` is required for every card type
- at least 2 sources for top banks
- URLs must be valid format
- Logo files must exist in the logos folder

### API Changes

1. Update Pydantic model in `app/models/bank.py`
2. Update Flask-RESTx schema in `app/api/banks.py`
3. Update test coverage
4. All tests must pass

## Code Style

- Python: flake8 for linting, no E501 line length limit
- HTML/JS: 2-space indentation
- Commits: conventional-ish — `feat:`, `fix:`, `docs:`, `test:`, `ci:` prefixes

## Releasing to Production

1. Merge feature PRs → `dev` (auto-deploys to dev env)
2. QA on `cardblockapi-dev.fly.dev`
3. Create PR `dev` → `main`
4. Merge → triggers production deploy to `cardblockapi.fly.dev`

## Questions?

- Check `AGENTS.md` for autonomous agent workflows
- Check `ROADMAP.md` for planned features
- Open an issue for anything unclear