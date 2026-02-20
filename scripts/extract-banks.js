const fs = require('fs');

// Read banks-from-razorpay.json
const data = JSON.parse(fs.readFileSync('banks-from-razorpay.json', 'utf8'));

const codes = [
  'RDCB','APMC','NGSB','JJSB','JPCB','KJSB','ADBK','PMEC','SJSB','AKJB',
  'BARA','TAUB','AJAR','AMCB','ZSBL','DEOB','HSBC','SPCB','SVSH','TGMB',
  'ORCB','TBSB','VSBL','DEUT','PUCB','SUSB','JANA','TNSC','VARA','NCUB',
  'TCBR','MSLM','JSBL','MDBK','DMKJ','URBN','NNSB','PSBL','GBCB','MUBL',
  'HCBL','VVSB','CITI','SUTB','HUSB','KOLH','TPSC','ZCBL','AJHC','RSBL'
];

console.log('Bank Codes found in banks-from-razorpay.json:');
codes.forEach(code => {
  if (data[code]) {
    const bank = data[code];
    console.log(`${code}: ${bank.name || 'N/A'} - Website: ${bank.website || 'N/A'}`);
  } else {
    console.log(`${code}: NOT FOUND`);
  }
});
