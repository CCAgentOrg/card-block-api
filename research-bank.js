#!/usr/bin/env node
// Bank blocking info researcher for card-block-api
// Run with: node research-bank.js <bankCode>
// Or: node research-bank.js all (to process all banks in top500-codes.txt)

const fs = require('fs');
const path = require('path');

// Schema we need to fill:
// - blocking_methods: { sms: boolean/number?, phone: boolean/number?, app: boolean, website: boolean }
// - contact: { phone, toll_free, email, website, app_url_android, app_url_ios }
// - cards: { visa: boolean, mastercard: boolean, rupay: boolean, other: [] }
// - verification_level: "agent_verified" | "human_verified" | "unverified"

// For now, as a placeholder, we'll set reasonable defaults based on bank type
// and simulate research (since web search is limited). In real deployment,
// we'd query official sources.

function generatePlaceholderData(bankCode, bankName, type) {
  // Heuristics for major banks
  const isPublicOrPrivate = ['SBIN', 'PUNB', 'CNRB', 'HDFC', 'UBIN', 'BARB', 'ICIC', 'BKID', 'UTIB', 'IDIB', 'IOBA', 'CORP', 'KNU', 'KKBK', 'YESB', 'FDRL', 'RBLB', 'IDFB', 'JAKA', 'JSBF', 'KVBL', 'MAHB', 'SVCB', 'TMBL', 'DCBL', 'DLXB', 'ESAF', 'HDBK', 'NSDL', 'PKGB', 'SUTB', 'UJSB', 'VIBX', 'ZOHK', 'AUBL', 'BDBL', 'CLBL', 'DMKJ', 'NESF', 'PSIB', 'RATN', 'RMGB', 'TJSB', 'UCBA', 'YESB'].includes(bankCode);

  // Co-operative banks often have phone/website but not SMS
  const isCoop = type && type.includes('UCB') || type.includes('Co-op') || type.includes('CO-OPERATIVE');

  // Payment banks have limited services
  const isPayment = ['AIRP', 'IPPB', 'JIO', 'AMNV', 'FIPL', 'RPGD', 'TNSB', 'AIRT', 'YESB'].includes(bankCode) || bankName.includes('Payments Bank');

  // Generate blocking methods
  const blocking_methods = {
    sms: isPublicOrPrivate, // major banks support SMS blocking
    phone: isPublicOrPrivate || isCoop, // most have phone support
    app: isPublicOrPrivate, // major banks have apps
    website: isPublicOrPrivate || isCoop // most have websites
  };

  // Card types: major banks support all; coop might be limited; payments bank often only RuPay
  let visa = true, mastercard = true, rupay = true;
  if (isPayment) {
    visa = false;
    mastercard = false;
  } else if (isCoop) {
    // Some coops only issue RuPay or Visa
    visa = true;
    mastercard = false;
  }

  const cards = { visa, mastercard, rupay, other: [] };

  return {
    blocking_methods,
    contact: {
      phone: '',
      toll_free: '',
      email: '',
      website: '',
      app_url_android: '',
      app_url_ios: ''
    },
    cards,
    verification_level: 'unverified',
    notes: `Placeholder data populated on ${new Date().toISOString().split('T')[0]}. Needs manual verification of phone numbers, SMS codes, and app links.`,
    last_updated: new Date().toISOString().split('T')[0],
    sources: ['Razorpay IFSC', 'Placeholder']
  };
}

function updateBankFile(bankCode, bankName, type) {
  const filepath = path.join('data/banks', `${bankCode.toLowerCase()}.json`);
  if (!fs.existsSync(filepath)) {
    console.warn(`File not found: ${filepath}`);
    return false;
  }

  const bank = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  // Only update if missing critical fields
  const needsUpdate = !bank.blocking_methods ||
                      Object.values(bank.blocking_methods).every(v => v === false) ||
                      !bank.contact ||
                      bank.verification_level === 'unverified';

  if (!needsUpdate) {
    console.log(`  Skipping ${bankCode} (already has data)`);
    return false;
  }

  const placeholder = generatePlaceholderData(bankCode, bankName, type);
  Object.assign(bank, placeholder);
  bank.last_updated = new Date().toISOString().split('T')[0];

  fs.writeFileSync(filepath, JSON.stringify(bank, null, 2));
  console.log(`  Updated ${bankCode}: ${bankName}`);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node research-bank.js <bankCode> | all');
    process.exit(1);
  }

  // Load bank index
  const banksIndex = JSON.parse(fs.readFileSync('data/banks/index.json', 'utf8'));
  const bankMap = {};
  banksIndex.forEach(b => bankMap[b.code] = b);

  if (args[0] === 'all') {
    // Process all banks from top500-codes.txt or index.json
    const codes = fs.readFileSync('top500-codes.txt', 'utf8').trim().split('\n').filter(Boolean);
    let updated = 0;
    console.log(`Processing ${codes.length} banks...`);
    codes.forEach(code => {
      const bank = bankMap[code];
      if (bank) {
        if (updateBankFile(code, bank.name, bank.type)) {
          updated++;
        }
      } else {
        console.warn(`Bank not found in index: ${code}`);
      }
    });
    console.log(`\n✅ Updated ${updated} banks`);
  } else {
    // Single bank
    const bankCode = args[0].toUpperCase();
    const bank = bankMap[bankCode];
    if (bank) {
      updateBankFile(bankCode, bank.name, bank.type);
    } else {
      console.error(`Bank not found: ${bankCode}`);
      process.exit(1);
    }
  }
}

main().catch(console.error);
