# Contributing to Card Block API

Thank you for your interest in contributing! 🎉

## Ways to Contribute

1. **Add New Banks** - Add card blocking info for banks not yet covered
2. **Verify Information** - Help verify existing data
3. **Report Errors** - Let us know if something is wrong
4. **Improve Code** - HTML, verification scripts, CI/CD
5. **Documentation** - Improve docs and instructions

## Getting Started

### Prerequisites

- Git installed
- Text editor (VS Code recommended)
- Basic understanding of JSON

### Adding a New Bank

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/card-block-api.git
   cd card-block-api
   ```

3. **Add bank data** to the appropriate JSON file:
   ```json
   {
     "name": "Bank Name",
     "slug": "bank-name",
     "type": "public",
     "website": "https://bank.com",
     "verification": {
       "status": "unverified",
       "last_verified": "2026-02-19"
     },
     "cards": [{
       "type": "debit",
       "blocking_methods": [
         {
           "channel": "sms",
           "instructions": "SMS BLOCK <last4> to XXXXXX"
         },
         {
           "channel": "phone",
           "numbers": ["1800 XXX XXX"]
         }
       ]
     }]
   }
   ```

4. **Test locally** - Open `index.html` in a browser
5. **Submit PR** - Create a pull request

## Data Standards

### Required Fields

- `name` - Full bank name
- `slug` - URL-friendly identifier (e.g., `hdfc-bank`)
- `type` - `public` or `private`
- `website` - Official bank website
- `cards` - Array of card types
- `blocking_methods` - Array of blocking channels

### Verification Sources

Always include sources for verification:
- Official bank website URLs
- RBI disclosures
- Customer service confirmations

### Supported Channels

- `sms` - SMS blocking (include format)
- `phone` - Phone numbers (toll-free preferred)
- `app` - Mobile app instructions
- `website` - Online portal URL
- `email` - Email for blocking
- `branch` - Physical branch

## Running Verification

```bash
# Install dependencies
npm install

# Run verification
node verify.js
```

## Code Style

- Use 2 spaces for indentation
- JSON files: 2-space indent, trailing commas OK
- HTML: Standard semantic markup
- JS: ES6+ features OK

## Submitting Changes

1. Create a feature branch:
   ```bash
   git checkout -b add-bank-name
   ```

2. Make your changes

3. Commit with clear messages:
   ```bash
   git commit -m "Add Bank Name - card blocking info"
   ```

4. Push and create PR:
   ```bash
   git push origin add-bank-name
   ```

## PR Guidelines

- **Be specific** about what you're adding
- **Include sources** for verification
- **Test locally** before submitting
- **One bank per PR** - easier to review

## Reporting Issues

Found outdated info? Create an issue with:

- Bank name
- What's wrong
- Correct information (with source)
- Your verification method

## Questions?

- Open an issue for questions
- Email: contact@cashlessconsumer.in

---

*Thank you for helping consumers stay safe! 🦀*
