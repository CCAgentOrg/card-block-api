# Card Block API — Roadmap

## Milestone 1: Production Readiness ✅
- [x] Flask + Flask-RESTx API with list, detail, search, stats
- [x] 61 banks with blocking instructions
- [x] 50+ banks with Android/iOS app links
- [x] Docker + Fly.io deployment (prod + dev environments)
- [x] Branch protection on main
- [x] AGENTS.md for agent workflows

## Milestone 2: Data & Coverage (Current)
- [ ] **[#5]** Add remaining ~200 banks from top500 IFSC — batches of 50
- [ ] **[#9]** Verify all app URLs with self-hosted gplayapi
- [ ] **[#7]** Replace placeholder logos with official bank logos
- [ ] **[#11]** Add unit tests for business logic (>80% coverage)
- [ ] **[#4]** Self-host gplayapi locally for reliable lookup

## Milestone 3: Developer Experience
- [ ] **[#12]** Data export: JSON, CSV, JSON Schema download endpoints
- [ ] **[#14]** BIN/IIN range support — lookup by card number prefix
- [ ] **[#16]** CI/CD via GitHub Actions (auto-deploy dev + prod)

## Milestone 4: User Experience
- [ ] **[#15]** SEO: semantic HTML, meta tags, sitemap, structured data
- [ ] **[#8]** Rate limiting, /health, /metrics endpoints

## Milestone 5: Internationalization
- [ ] **[#13]** Multi-lingual UI (Hindi, Tamil, Telugu, Bengali)
- [ ] API Accept-Language header support
- [ ] Translated bank data in banks.json

## Milestone 6: Production Domain
- [ ] **[#15]** Deploy to cardblock.cashlessconsumer.in with HTTPS
- [ ] Google Search Console setup, sitemap submission
- [ ] PageSpeed > 90

## Priority Order

| Priority | Work | Impact |
|----------|------|--------|
| P0 | More banks (milestone 2) | Core value proposition |
| P0 | Verify app URLs | Data quality |
| P1 | Data export formats | Developer adoption |
| P1 | BIN range lookup | UX improvement |
| P1 | CI/CD automation | Team velocity |
| P2 | SEO + custom domain | User discovery |
| P2 | Multi-lingual | India-wide reach |
| P3 | Fraud reporting section | Adjacent feature |
