const fs = require('fs');
const path = require('path');

const batchCodes = [
  'RDCB','APMC','NGSB','JJSB','JPCB','KJSB','ADBK','PMEC','SJSB','AKJB',
  'BARA','TAUB','AJAR','AMCB','ZSBL','DEOB','HSBC','SPCB','SVSH','TGMB',
  'ORCB','TBSB','VSBL','DEUT','PUCB','SUSB','JANA','TNSC','VARA','NCUB',
  'TCBR','MSLM','JSBL','MDBK','DMKJ','URBN','NNSB','PSBL','GBCB','MUBL',
  'HCBL','VVSB','CITI','SUTB','HUSB','KOLH','TPSC','ZCBL','AJHC','RSBL'
];

console.log('Missing files:');
batchCodes.forEach(code => {
  const filePath = path.join('data/banks', code.toLowerCase() + '.json');
  if (!fs.existsSync(filePath)) {
    console.log(code);
  }
});
