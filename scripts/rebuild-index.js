const fs = require('fs');
const path = require('path');

const banksDir = 'data/banks';
const files = fs.readdirSync(banksDir).filter(f => f.endsWith('.json') && f !== 'index.json');

const banks = [];
const seenCodes = new Set();

files.forEach(file => {
  const filepath = path.join(banksDir, file);
  try {
    const bank = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    // Only include banks with a valid code
    if (bank.code && typeof bank.code === 'string') {
      if (!seenCodes.has(bank.code)) {
        banks.push(bank);
        seenCodes.add(bank.code);
      }
    }
  } catch (e) {
    console.warn(`Skipped ${file}: ${e.message}`);
  }
});

// Sort by name
banks.sort((a, b) => a.name.localeCompare(b.name));

const index = {
  banks: banks,
  metadata: {
    total_banks: banks.length,
    last_updated: new Date().toISOString().split('T')[0],
    source: 'Razorpay IFSC Repository + Card Block API manual entries'
  }
};

fs.writeFileSync(path.join(banksDir, 'index.json'), JSON.stringify(index, null, 2));
console.log(`✅ Index built with ${banks.length} unique banks`);

// Stats
const byVerification = {};
banks.forEach(b => {
  const v = b.verification_level || 'unverified';
  byVerification[v] = (byVerification[v] || 0) + 1;
});
console.log('Verification levels:', byVerification);

const withBlocking = banks.filter(b => b.blocking_methods && Object.values(b.blocking_methods).some(v => v === true)).length;
console.log(`Banks with blocking methods: ${withBlocking}`);
