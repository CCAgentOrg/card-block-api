const fs = require('fs');
const path = require('path');

// Load bank code to name mapping from ifsc package
const bankNames = JSON.parse(fs.readFileSync('node_modules/ifsc/src/banknames.json', 'utf8'));

// Load Razorpay banks.json
const razorpayBanks = JSON.parse(fs.readFileSync('banks-from-razorpay.json', 'utf8'));

console.log(`Razorpay banks: ${Object.keys(razorpayBanks).length}`);
console.log(`Bank names mapping: ${Object.keys(bankNames).length}`);

// Build unified bank list
const banks = [];
const missingNames = [];

Object.entries(razorpayBanks).forEach(([code, data]) => {
  const name = bankNames[code];
  if (!name) {
    missingNames.push(code);
    // fallback: use code as name or try to infer
    // We'll keep the code and maybe placeholder name
  }
  banks.push({
    code: code,
    name: name || code, // use code if name missing
    type: data.type || '',
    ifsc_example: data.ifsc || '',
    micr_pattern: data.micr || '',
    upi: data.upi || false,
    rtgs: data.rtgs || false,
    neft: data.neft || false,
    imps: data.imps || false,
    apbs: data.apbs || false,
    ach_credit: data.ach_credit || false,
    ach_debit: data.ach_debit || false,
    nach_debit: data.nach_debit || false,
    iin: data.iin || ''
  });
});

console.log(`Total banks generated: ${banks.length}`);
console.log(`Missing names: ${missingNames.length}`);
if (missingNames.length > 0) {
  console.log('Sample missing names:', missingNames.slice(0, 20));
}

// Write master file
fs.writeFileSync('data/banks/index.json', JSON.stringify(banks.sort((a,b) => a.name.localeCompare(b.name)), null, 2));
console.log('Wrote data/banks/index.json');

// Ensure data/banks directory exists
if (!fs.existsSync('data/banks')) {
  fs.mkdirSync('data/banks', { recursive: true });
}

// Write individual files (only for banks not already present? or all)
banks.forEach(bank => {
  // Skip entries that look like sublet or internal codes? Keep all.
  const filename = `${bank.code.toLowerCase()}.json`;
  const filepath = path.join('data/banks', filename);
  // If file exists, skip to preserve manual edits
  if (fs.existsSync(filepath)) {
    return;
  }
  // Create bank JSON with our schema
  const bankJson = {
    id: bank.code,
    name: bank.name,
    type: bank.type,
    blocking_methods: {
      sms: false,
      phone: false,
      app: false,
      website: false
    },
    contact: {
      phone: '',
      toll_free: '',
      email: '',
      website: '',
      app_url_android: '',
      app_url_ios: ''
    },
    cards: {
      visa: false,
      mastercard: false,
      rupay: false,
      other: []
    },
    verification_level: 'unverified',
    notes: '',
    last_updated: new Date().toISOString().split('T')[0],
    sources: ['Razorpay IFSC Repository']
  };
  fs.writeFileSync(filepath, JSON.stringify(bankJson, null, 2));
});

console.log('Individual bank files written.');

// Write report of missing names for manual research
if (missingNames.length > 0) {
  fs.writeFileSync('missing-bank-names.json', JSON.stringify(missingNames, null, 2));
  console.log('Missing names list saved to missing-bank-names.json');
}
