const fs = require('fs');
const path = require('path');

// Read current index (array of banks)
const banks = JSON.parse(fs.readFileSync('data/banks/index.json', 'utf8'));

// Add slug if missing
banks.forEach(bank => {
  if (!bank.slug && bank.name) {
    bank.slug = bank.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  // Also ensure we have an id for those that may rely on it (prefer code, else slug)
  if (!bank.id && bank.code) {
    bank.id = bank.code.toLowerCase();
  }
});

// Write new index with metadata wrapper
const indexWithMeta = {
  banks: banks,
  metadata: {
    total_banks: banks.length,
    last_updated: new Date().toISOString().split('T')[0],
    source: 'Razorpay IFSC Repository + Card Block API manual entries'
  }
};

fs.writeFileSync('data/banks/index.json', JSON.stringify(indexWithMeta, null, 2));
console.log('Updated index.json with metadata and slugs');

// Also ensure all individual bank files have slugs
let count = 0;
banks.forEach(bank => {
  if (!bank.code) return; // skip old schema for now
  const filepath = path.join('data/banks', `${bank.code.toLowerCase()}.json`);
  if (fs.existsSync(filepath)) {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    if (!data.slug && bank.name) {
      data.slug = bank.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      count++;
    }
  }
});
console.log(`Added slugs to ${count} individual files`);
