const fs = require('fs');
const path = require('path');

// Load Razorpay banks (our new base)
const razorpayBanks = JSON.parse(fs.readFileSync('data/banks/index.json', 'utf8'));

// Read all existing individual bank files in data/banks
const banksDir = 'data/banks';
const existingBanks = {};

fs.readdirSync(banksDir).forEach(file => {
  if (file === 'index.json') return;
  if (path.extname(file) !== '.json') return;
  const filepath = path.join(banksDir, file);
  try {
    const bank = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (bank.id) {
      existingBanks[bank.id] = bank;
    }
  } catch (e) {
    console.warn(`Error reading ${file}: ${e.message}`);
  }
});

console.log(`Existing banks loaded: ${Object.keys(existingBanks).length}`);

// Merge: start with Razorpay list as base, then overlay existing banks (which have more detail)
const merged = razorpayBanks
  .filter(b => b && b.code) // skip invalid entries
  .map(bank => {
  if (existingBanks[bank.code]) {
    const existing = existingBanks[bank.code];
    // Merge: keep all Razorpay fields, but take name from existing if present? Actually existing likely has name too.
    // We want to preserve existing blocking methods, contact, etc.
    return {
      ...bank,
      // Overlay these from existing if present
      blocking_methods: existing.blocking_methods || bank.blocking_methods || { sms: false, phone: false, app: false, website: false },
      contact: existing.contact || bank.contact || { phone: '', toll_free: '', email: '', website: '', app_url_android: '', app_url_ios: '' },
      cards: existing.cards || bank.cards || { visa: false, mastercard: false, rupay: false, other: [] },
      verification_level: existing.verification_level || bank.verification_level || 'unverified',
      notes: existing.notes || bank.notes || '',
      last_updated: existing.last_updated || new Date().toISOString().split('T')[0],
      sources: existing.sources || bank.sources || ['Razorpay IFSC']
    };
  } else {
    // New bank: create a new bank entry with defaults
    return {
      id: bank.code,
      name: bank.name,
      type: bank.type,
      ifsc_example: bank.ifsc_example,
      micr_pattern: bank.micr_pattern,
      upi: bank.upi,
      rtgs: bank.rtgs,
      neft: bank.neft,
      imps: bank.imps,
      apbs: bank.apbs,
      ach_credit: bank.ach_credit,
      ach_debit: bank.ach_debit,
      nach_debit: bank.nach_debit,
      iin: bank.iin,
      blocking_methods: { sms: false, phone: false, app: false, website: false },
      contact: { phone: '', toll_free: '', email: '', website: '', app_url_android: '', app_url_ios: '' },
      cards: { visa: false, mastercard: false, rupay: false, other: [] },
      verification_level: 'unverified',
      notes: '',
      last_updated: new Date().toISOString().split('T')[0],
      sources: ['Razorpay IFSC']
    };
  }
});

// Also include any existing banks that are NOT in Razorpay list (maybe special ones we added manually)
const razorpayCodes = new Set(razorpayBanks.map(b => b.code));
Object.entries(existingBanks).forEach(([code, bank]) => {
  if (!razorpayCodes.has(code)) {
    merged.push(bank);
  }
});

console.log(`Merged bank count: ${merged.length}`);

// Sort by name
merged.sort((a, b) => a.name.localeCompare(b.name));

// Write new index.json
fs.writeFileSync('data/banks/index.json', JSON.stringify(merged, null, 2));
console.log('Merged index written.');

// Option: we could rewrite individual bank files to match merged data. But we already preserved existing ones; new ones will be written next.

// Write individual files for new banks that didn't exist before
merged.filter(b => b && b.id).forEach(bank => {
  const filename = `${bank.id.toLowerCase()}.json`;
  const filepath = path.join(banksDir, filename);
  if (!fs.existsSync(filepath)) {
    // Write this new bank
    const bankJson = {
      id: bank.id,
      name: bank.name,
      type: bank.type,
      blocking_methods: bank.blocking_methods,
      contact: bank.contact,
      cards: bank.cards,
      verification_level: bank.verification_level,
      notes: bank.notes,
      last_updated: bank.last_updated,
      sources: bank.sources
    };
    fs.writeFileSync(filepath, JSON.stringify(bankJson, null, 2));
  }
});

console.log('Individual files synchronized.');
