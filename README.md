# 💳 Card Block API

> Emergency card blocking information for banks worldwide. For humans and AI agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/CashlessConsumer/card-block-api)](https://github.com/CashlessConsumer/card-block-api/stargazers)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

## 🌐 Live Site

**https://cashlessconsumer.github.io/card-block-api/**

## About

Card Block API is an open database of card blocking information for banks worldwide. It helps humans and AI agents quickly find how to block a lost or stolen debit or credit card.

Started in 2026 as part of the [CashlessConsumer](https://cashlessconsumer.in) initiative to improve consumer safety in India's digital payment ecosystem.

## Features

- 🤖 **AI Verified** - All information verified by AI agents
- 🌐 **Multi-Channel** - SMS, Phone, App, Website blocking
- 🔌 **AI Agent Ready** - Structured JSON for programmatic access
- 📱 **Mobile First** - Designed for emergency use
- 🔒 **Privacy First** - No data collection
- 🌍 **Open Source** - Free to use and contribute

## Quick Start

### Browse by Country

- [🇮🇳 India](./data/india.json) - 10+ banks

### API Endpoints

```bash
# Fetch all Indian banks
curl https://cashlessconsumer.github.io/card-block-api/data/india.json

# Filter by bank
curl https://cashlessconsumer.github.io/card-block-api/data/india.json | jq '.banks[] | select(.slug=="hdfc-bank")'
```

## Data Format

```json
{
  "country": "IN",
  "country_name": "India",
  "banks": [
    {
      "name": "HDFC Bank",
      "slug": "hdfc-bank",
      "type": "private",
      "website": "https://hdfcbank.com",
      "verification": {
        "status": "agent_verified",
        "confidence": 0.95,
        "last_verified": "2026-02-19",
        "sources": ["https://..."]
      },
      "cards": [
        {
          "type": "debit",
          "blocking_methods": [
            {
              "channel": "sms",
              "instructions": "SMS BLOCK <last4> to 5676711"
            },
            {
              "channel": "phone",
              "numbers": ["1800 123 4567"]
            }
          ]
        }
      ]
    }
  ]
}
```

## Verification Levels

| Status | Icon | Description |
|--------|------|-------------|
| `agent_verified` | 🤖 | AI verified through official sources |
| `human_verified` | ✅ | Manually verified by contributors |
| `unverified` | ❓ | Not yet verified |

## Contributing

### Adding a New Bank

1. Fork this repository
2. Edit the JSON file for the country (or create new)
3. Include official sources for all information
4. Submit a Pull Request

### Running Verification

```bash
# Install dependencies
npm install

# Run verification script
node verify.js

# Commit changes
git add data/
git commit -m "Verify and update bank data"
```

### Code Quality

- All JSON must be valid
- Include verification sources
- Follow the data schema
- Test locally before PR

## Verification

We use a multi-tier verification system:

1. **Agent Verification** - AI fetches and validates from official sources
2. **Human Verification** - Contributors manually check
3. **Community Reporting** - Users report issues, we verify

## Technology

- **Static Site** - GitHub Pages
- **Data** - JSON files
- **Verification** - Node.js scripts
- **CI/CD** - GitHub Actions

## CI/CD Pipeline

This project uses GitHub Actions for:

- ✅ JSON validation
- ✅ URL verification
- ✅ Auto-deployment to GitHub Pages

See [`.github/workflows/`](.github/workflows/) for details.

## Governance

### Decision Making

1. **Maintainers** - Core team from CashlessConsumer
2. **Contributors** - Community members who submit PRs
3. **Users** - Anyone using the data

### Code of Conduct

- Be respectful and inclusive
- Focus on consumer benefit
- Verify before submitting
- Credit sources

### License

MIT License - See [LICENSE](LICENSE)

## Contact

- 📧 Email: contact@cashlessconsumer.in
- 🐙 GitHub: [github.com/CashlessConsumer/card-block-api](https://github.com/CashlessConsumer/card-block-api)
- 🐘 Mastodon: [@cashlessconsumer@freeradical.zone](https://freeradical.zone/@cashlessconsumer)

## Related Projects

- [CashlessConsumer](https://cashlessconsumer.in) - Main organization
- [UPI QR Generator](https://srikanthlogic.github.io/CashlessConsumer/linkgen.html) - FOSS UPI tools
- [BBPS Study Circle](https://gitlab.com/CashlessConsumer/federal-bank-bbps-apis) - Banking research

---

*Built with ❤️ for consumer advocacy*
