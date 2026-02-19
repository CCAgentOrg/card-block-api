const fs = require('fs');
const path = require('path');

// Load banknames mapping
const banknames = JSON.parse(fs.readFileSync('node_modules/ifsc/src/banknames.json', 'utf8'));

// Also load top500 mapping for any extra names (though banknames seems comprehensive)
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

const today = new Date().toISOString().split('T')[0];

let createdCount = 0;
let errorCount = 0;

batchCodes.forEach(code => {
  const filename = code.toLowerCase() + '.json';
  const filepath = path.join('data/banks', filename);

  if (fs.existsSync(filepath)) {
    return; // skip existing
  }

  // Determine name
  let name = banknames[code] || top500Map[code] || code;
  // For unknown, maybe add "Bank" suffix? Not needed.

  const bankData = {
    id: code.toLowerCase(),
    name: name,
    type: "", // could infer from banknames? skip.
    blocking_methods: {
      sms: false,
      phone: false,
      app: false,
      website: false
    },
    contact: {
      phone: "",
      toll_free: "",
      email: "",
      website: "",
      app_url_android: "",
      app_url_ios: ""
    },
    cards: {
      visa: false,
      mastercard: false,
      rupay: false,
      other: []
    },
    verification_level: "unverified",
    notes: "",
    last_updated: today,
    sources: ["Batch-3 processing"]
  };

  try {
    fs.writeFileSync(filepath, JSON.stringify(bankData, null, 2));
    createdCount++;
    console.log(`Created ${filename}: ${name}`);
  } catch (err) {
    errorCount++;
    console.error(`Error creating ${filename}:`, err.message);
  }
});

console.log(`\nSummary: Created ${createdCount} files, ${errorCount} errors`);
