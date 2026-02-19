const fs = require('fs');
const path = require('path');

// Load Razorpay banknames mapping (code -> name)
const bankNames = JSON.parse(fs.readFileSync('node_modules/ifsc/src/banknames.json', 'utf8'));
const nameToCode = {};
Object.entries(bankNames).forEach(([code, name]) => {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  nameToCode[normalized] = code;
});

// Read all bank files
const banksDir = 'data/banks';
const files = fs.readdirSync(banksDir).filter(f => f.endsWith('.json') && f !== 'index.json');

let converted = 0, skipped = 0, errors = 0;

files.forEach(file => {
  const filepath = path.join(banksDir, file);
  try {
    const bank = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    // Skip if already new schema (has code at top level)
    if (bank.code) {
      skipped++;
      return;
    }

    // Old schema: has id, name, type, etc.
    const name = bank.name || '';
    const normalized = name.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const code = nameToCode[normalized];

    if (!code) {
      // Could not map; skip or preserve as-is? We'll skip conversion for now.
      skipped++;
      return;
    }

    // Build new schema
    const typeMap = {
      'cooperative-bank': 'O-UCB',
      'payments-bank': 'PAYMENT',
      'private-bank': 'PRIVATE',
      'public-bank': 'PSB',
      'regional-rural-bank': 'RRB'
    };
    const newType = typeMap[bank.type] || (bank.type ? bank.type.toUpperCase() : 'UNKNOWN');

    // Extract blocking methods from old structure if available
    let blocking_methods = { sms: false, phone: false, app: false, website: false };
    let contact = { phone: '', toll_free: '', email: '', website: '', app_url_android: '', app_url_ios: '' };
    let cards = { visa: false, mastercard: false, rupay: false, other: [] };
    let notes = '';

    if (bank.cards && Array.isArray(bank.cards)) {
      // Old schema: cards array with network string like "Visa, Mastercard, RuPay"
      const networks = bank.cards[0]?.network || '';
      cards.visa = networks.includes('Visa');
      cards.mastercard = networks.includes('Mastercard');
      cards.rupaj = networks.includes('RuPay'); // will fix below
      cards.rupay = networks.includes('RuPay');
    }

    // Extract blocking methods
    if (bank.cards && bank.cards[0] && Array.isArray(bank.cards[0].blocking_methods)) {
      bank.cards[0].blocking_methods.forEach(m => {
        if (m.channel === 'sms') blocking_methods.sms = true;
        if (m.channel === 'phone') {
          blocking_methods.phone = true;
          if (m.numbers && m.numbers[0]) contact.phone = m.numbers[0];
        }
        if (m.channel === 'website') {
          blocking_methods.website = true;
          if (m.url) contact.website = m.url;
        }
        if (m.channel === 'mobile' || m.channel === 'app') blocking_methods.app = true;
      });
    }

    // Website
    if (bank.website) contact.website = bank.website;

    // Build new bank object
    const newBank = {
      id: code,
      name: bank.name,
      type: newType,
      code: code,
      blocking_methods,
      contact,
      cards,
      verification_level: 'unverified',
      notes: notes || 'Converted from old schema',
      last_updated: new Date().toISOString().split('T')[0],
      sources: bank.website ? [bank.website] : [],
      slug: bank.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    };

    // Write to same file with code as filename (if different)
    const newFilename = `${code.toLowerCase()}.json`;
    if (file !== newFilename) {
      // Write new file
      fs.writeFileSync(path.join(banksDir, newFilename), JSON.stringify(newBank, null, 2));
      // Optionally delete old file? Keep for now.
      converted++;
      console.log(`Converted ${bank.name} (${file}) -> ${newFilename}`);
    } else {
      // Same filename (unlikely) - just update content
      fs.writeFileSync(filepath, JSON.stringify(newBank, null, 2));
      converted++;
    }
  } catch (e) {
    console.error(`Error processing ${file}: ${e.message}`);
    errors++;
  }
});

console.log(`\nConverted: ${converted}, Skipped: ${skipped}, Errors: ${errors}`);
