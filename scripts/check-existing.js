const fs = require('fs');
const path = require('path');

const batchCodes = [
  'RDCB','APMC','NGSB','JJSB','JPCB','KJSB','ADBK','PMEC','SJSB','AKJB',
  'BARA','TAUB','AJAR','AMCB','ZSBL','DEOB','HSBC','SPCB','SVSH','TGMB',
  'ORCB','TBSB','VSBL','DEUT','PUCB','SUSB','JANA','TNSC','VARA','NCUB',
  'TCBR','MSLM','JSBL','MDBK','DMKJ','URBN','NNSB','PSBL','GBCB','MUBL',
  'HCBL','VVSB','CITI','SUTB','HUSB','KOLH','TPSC','ZCBL','AJHC','RSBL'
];

console.log('Existing files for batch codes:');
batchCodes.forEach(code => {
  const filePath = path.join('data/banks', code + '.json');
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      console.log(`${code}.json exists - Name: ${data.name || data.id || 'unknown'}`);
    } catch (e) {
      console.log(`${code}.json exists - Error reading`);
    }
  }
});
