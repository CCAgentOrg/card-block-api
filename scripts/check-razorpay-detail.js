const fs = require('fs');
const data = JSON.parse(fs.readFileSync('banks-from-razorpay.json', 'utf8'));

// Check a few codes: HSBC, CITI, DEUT, and some unknowns
const codes = ['HSBC', 'CITI', 'DEUT', 'APMC', 'NGSB', 'JJSB', 'RDCB', 'ADBK'];
codes.forEach(code => {
  if (data[code]) {
    console.log(`${code}: ${JSON.stringify(data[code], null, 2)}`);
  } else {
    console.log(`${code}: NOT FOUND`);
  }
});
