const fs = require('fs');

const top500 = JSON.parse(fs.readFileSync('top500-banks.json', 'utf8'));
const top500Map = {};
top500.forEach(b => top500Map[b.code] = b.name);

const batchCodes = [
  'RDCB','APMC','NGSB','JJSB','JPCB','KJSB','ADBK','PMEC','SJSB','AKJB',
  'BARA','TAUB','AJAR','AMCB','ZSBL','DEOB','HSBC','SPCB','SVSH','TGMB',
  'ORCB','TBSB','VSBL','DEUT','PUCB','SUSB','JANA','TNSC','VARA','NCUB',
  'TCBR','MSLM','JSBL','MDBK','DMKJ','URBN','NNSB','PSBL','GBCB','MUBL',
  'HCBL','VVSB','CITI','SUTB','HUSB','KOLH','TPSC','ZCBL','AJHC','RSBL'
];

console.log('Checking which codes are in top500-banks.json:');
batchCodes.forEach(code => {
  if (top500Map[code]) {
    console.log(`${code}: ${top500Map[code]} (from top500)`);
  } else {
    console.log(`${code}: NOT IN top500`);
  }
});
