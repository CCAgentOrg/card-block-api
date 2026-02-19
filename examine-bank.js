const fs = require('fs');
const data = JSON.parse(fs.readFileSync('banks-from-razorpay.json', 'utf8'));

// Pick a code that exists but shows N/A
const code = 'APMC';
if (data[code]) {
  console.log(JSON.stringify(data[code], null, 2));
}

// Also check a NOT FOUND one
console.log('\nChecking RDCB:');
console.log(data['RDCB'] || 'NOT FOUND');
