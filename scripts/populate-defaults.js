const fs = require('fs');
const path = require('path');

// Load index
const index = JSON.parse(fs.readFileSync('data/banks/index.json', 'utf8'));
const banks = index.banks || [];
console.log(`Total banks in index: ${banks.length}`);

// Known large banks with specific card/blocking patterns (only those needing overrides)
const knownBanks = {
  SBIN: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  HDFC: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  ICIC: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  PUNB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  CNRB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  UBIN: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  BARB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  BKID: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  UTIB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  IDIB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  YESB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  KKBK: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  FDRL: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  RBLB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  AIRP: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: false, mastercard: false, rupay: true } },
  IPPB: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: false, mastercard: false, rupay: true } },
  AUBL: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  IOBA: { blocking_methods: { sms: false, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: false } },
  ALLA: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  ANCB: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  BOB: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  BOI: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  BOM: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  CAN: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  CBI: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  IOB: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  PSB: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
  UCO: { blocking_methods: { sms: true, phone: true, app: true, website: true }, cards: { visa: true, mastercard: true, rupay: true } },
};

// Heuristics by bank type
function getDefaultsByType(type) {
  const typeUpper = (type || '').toUpperCase();
  const isCoop = typeUpper.includes('UCB') || typeUpper.includes('CO-OP') || typeUpper.includes('COOPERATIVE');
  const isPSB = typeUpper === 'PSB';
  const isPrivate = typeUpper.includes('PRIVATE') || typeUpper.includes('PVT');
  const isRRB = typeUpper.includes('RRB') || typeUpper.includes('GRAMIN') || typeUpper.includes('RURAL');
  const isForeign = typeUpper.includes('FOREIGN') || typeUpper.includes('WBC');
  const isPayment = typeUpper.includes('PAYMENT') || ['AIRP', 'IPPB', 'JIO', 'AMNV', 'FIPL', 'RPGD', 'TNSB'].some(code => code === typeUpper);

  let blocking_methods, cards;

  if (isPayment) {
    blocking_methods = { sms: false, phone: true, app: true, website: true };
    cards = { visa: false, mastercard: false, rupay: true, other: [] };
  } else if (isCoop) {
    blocking_methods = { sms: false, phone: true, app: false, website: true };
    cards = { visa: true, mastercard: false, rupay: true, other: [] };
  } else if (isPSB || isPrivate) {
    blocking_methods = { sms: true, phone: true, app: true, website: true };
    cards = { visa: true, mastercard: true, rupay: true, other: [] };
  } else if (isForeign) {
    blocking_methods = { sms: false, phone: true, app: true, website: true };
    cards = { visa: true, mastercard: true, rupay: false, other: [] };
  } else if (isRRB) {
    blocking_methods = { sms: false, phone: true, app: false, website: true };
    cards = { visa: true, mastercard: false, rupay: true, other: [] };
  } else {
    blocking_methods = { sms: false, phone: true, app: false, website: true };
    cards = { visa: true, mastercard: true, rupay: false, other: [] };
  }

  return { blocking_methods, cards };
}

// Process banks
let updated = 0, skipped = 0;
banks.forEach(bank => {
  const code = bank.code;
  if (!code) {
    skipped++;
    return;
  }

  const filepath = path.join('data/banks', `${code.toLowerCase()}.json`);
  if (!fs.existsSync(filepath)) {
    skipped++;
    return;
  }

  // Check if already has at least one true blocking method
  const existing = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  if (existing.blocking_methods && Object.values(existing.blocking_methods).some(v => v === true)) {
    skipped++;
    return;
  }

  const known = knownBanks[code];
  let newData;

  if (known) {
    newData = {
      blocking_methods: known.blocking_methods,
      contact: { phone: '', toll_free: '', email: '', website: '', app_url_android: '', app_url_ios: '' },
      cards: known.cards,
      verification_level: 'unverified',
      notes: `Known profile for ${bank.name}`,
      last_updated: new Date().toISOString().split('T')[0],
      sources: ['Razorpay IFSC', 'Known bank profile']
    };
  } else {
    const defaults = getDefaultsByType(bank.type);
    newData = {
      blocking_methods: defaults.blocking_methods,
      contact: { phone: '', toll_free: '', email: '', website: '', app_url_android: '', app_url_ios: '' },
      cards: defaults.cards,
      verification_level: 'unverified',
      notes: `Intelligent defaults based on bank type (${bank.type}). Requires verification.`,
      last_updated: new Date().toISOString().split('T')[0],
      sources: ['Razorpay IFSC', 'Type-based defaults']
    };
  }

  Object.assign(existing, newData);
  fs.writeFileSync(filepath, JSON.stringify(existing, null, 2));
  updated++;
});

console.log(`✅ Populated defaults for ${updated} banks (skipped ${skipped})`);
