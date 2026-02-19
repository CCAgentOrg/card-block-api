const fs = require('fs');
const path = require('path');

const unknownCodes = [
  'RDCB','ADBK','SJSB','AKJB','BARA','AJAR','DEOB','SVSH','PUCB',
  'NCUB','TCBR','MSLM','MDBK','DMKJ','URBN','PSBL','HUSB','KOLH',
  'TPSC','AJHC','RSBL'
];

console.log('Checking for existing JSON files for unknown codes:');
unknownCodes.forEach(code => {
  const filePath = path.join('data/banks', code + '.json');
  if (fs.existsSync(filePath)) {
    console.log(code + '.json EXISTS');
  } else {
    console.log(code + '.json not found');
  }
});
