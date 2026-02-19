const fs = require('fs');

// Read the IFSC list (array of codes)
const ifscList = JSON.parse(fs.readFileSync('IFSC-list.json', 'utf8'));

console.log(`Total IFSCs: ${ifscList.length}`);

// Count IFSCs per bank code (first 4 chars)
const bankCounts = {};
ifscList.forEach(code => {
  if (typeof code === 'string' && code.length >= 4) {
    const bankCode = code.substring(0, 4);
    bankCounts[bankCode] = (bankCounts[bankCode] || 0) + 1;
  }
});

console.log(`Unique bank codes: ${Object.keys(bankCounts).length}`);

// Sort by count descending
const sortedBanks = Object.entries(bankCounts)
  .map(([code, count]) => ({ code, count }))
  .sort((a, b) => b.count - a.count);

console.log('Top 10 banks by IFSC count:');
sortedBanks.slice(0, 10).forEach(b => console.log(`  ${b.code}: ${b.count}`));

// Take top 500
const top500 = sortedBanks.slice(0, 500);
console.log(`\nSelected top 500 banks`);

// Load bank names from Razorpay mapping to include names
const banksIndex = JSON.parse(fs.readFileSync('data/banks/index.json', 'utf8'));
const bankMap = {};
banksIndex.forEach(b => { bankMap[b.code] = b; });

// Build list with names
const top500WithNames = top500.map(b => ({
  code: b.code,
  count: b.count,
  name: bankMap[b.code] ? bankMap[b.code].name : 'UNKNOWN'
}));

// Write list for agents
fs.writeFileSync('top500-banks.json', JSON.stringify(top500WithNames, null, 2));
console.log('Wrote top500-banks.json');

// Also create a simple list of just codes
fs.writeFileSync('top500-codes.txt', top500WithNames.map(b => b.code).join('\n'));
console.log('Wrote top500-codes.txt');
