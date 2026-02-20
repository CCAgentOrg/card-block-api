const fs = require('fs');

// Load top500 banks
const top500 = JSON.parse(fs.readFileSync('top500-banks.json', 'utf8'));
const top500Map = {};
top500.forEach(b => top500Map[b.code] = b.name);

// Also load banks-from-razorpay to get more details
const razorpay = JSON.parse(fs.readFileSync('banks-from-razorpay.json', 'utf8'));

const batchCodes = [
  'RDCB','APMC','NGSB','JJSB','JPCB','KJSB','ADBK','PMEC','SJSB','AKJB',
  'BARA','TAUB','AJAR','AMCB','ZSBL','DEOB','HSBC','SPCB','SVSH','TGMB',
  'ORCB','TBSB','VSBL','DEUT','PUCB','SUSB','JANA','TNSC','VARA','NCUB',
  'TCBR','MSLM','JSBL','MDBK','DMKJ','URBN','NNSB','PSBL','GBCB','MUBL',
  'HCBL','VVSB','CITI','SUTB','HUSB','KOLH','TPSC','ZCBL','AJHC','RSBL'
];

console.log('Bank code mapping:');
batchCodes.forEach(code => {
  const name = top500Map[code] || 'UNKNOWN';
  const razor = razorpay[code] || {};
  const website = razor.website || (name ? `https://${code.toLowerCase()}.com` : '');
  console.log(`${code}: ${name}${website ? ' - ' + website : ''}`);
});
