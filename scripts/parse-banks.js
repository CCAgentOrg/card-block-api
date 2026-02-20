const ifsc = require('ifsc');
const fs = require('fs');

// Read the IFSC list
const ifscList = JSON.parse(fs.readFileSync('IFSC-list.json', 'utf8'));

console.log(`Total IFSCs: ${ifscList.length}`);

// Extract unique bank codes (first 4 chars)
const bankCodes = new Set();
ifscList.forEach(code => {
  if (typeof code === 'string' && code.length >= 4) {
    bankCodes.add(code.substring(0, 4));
  }
});

console.log(`Unique bank codes: ${bankCodes.size}`);

// Map bank code to bank details
const banks = [];
let mapped = 0;
let unmapped = [];

bankCodes.forEach(code => {
  try {
    // Try to get bank details from ifsc package
    const bankDetail = ifsc.bank[code];
    if (bankDetail) {
      banks.push({
        code: code,
        name: bankDetail.name || bankDetail.Bank || '',
        type: bankDetail.type || '',
        bank_code: bankDetail.bank_code || '',
        micr: bankDetail.micr || '',
        upi: bankDetail.upi || false,
        rtgs: bankDetail.rtgs || false,
        neft: bankDetail.neft || false,
        imps: bankDetail.imps || false,
        apbs: bankDetail.apbs || false,
        ach_credit: bankDetail.ach_credit || false,
        ach_debit: bankDetail.ach_debit || false,
        nach_debit: bankDetail.nach_debit || false
      });
      mapped++;
    } else {
      unmapped.push(code);
    }
  } catch (e) {
    unmapped.push(code);
  }
});

console.log(`Mapped: ${mapped}, Unmapped: ${unmapped.length}`);
if (unmapped.length > 0) {
  console.log('Unmapped codes sample:', unmapped.slice(0, 20));
}

// Sort banks by code
banks.sort((a, b) => a.code.localeCompare(b.code));

// Write to file
fs.writeFileSync('banks-from-ifsc.json', JSON.stringify(banks, null, 2));
console.log('Wrote banks-from-ifsc.json');

// Also write unmapped codes for manual research
if (unmapped.length > 0) {
  fs.writeFileSync('unmapped-bank-codes.json', JSON.stringify(unmapped, null, 2));
  console.log('Wrote unmapped-bank-codes.json');
}
