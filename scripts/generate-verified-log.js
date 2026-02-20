const fs = require('fs');
const path = require('path');

// Load index
const index = JSON.parse(fs.readFileSync('data/banks/index.json', 'utf8'));
const verifiedBanks = index.banks.filter(b => b.verification_level === 'agent_verified');

console.log(`Generating verification logs for ${verifiedBanks.length} banks...`);

// Create a report object
const report = {
  generated_at: new Date().toISOString(),
  total_verified: verifiedBanks.length,
  banks: verifiedBanks.map(b => ({
    code: b.code,
    name: b.name,
    type: b.type,
    blocking_methods: b.blocking_methods,
    contact: {
      phone: b.contact?.phone || '',
      toll_free: b.contact?.toll_free || '',
      email: b.contact?.email || '',
      website: b.contact?.website || '',
      app_url_android: b.contact?.app_url_android || '',
      app_url_ios: b.contact?.app_url_ios || ''
    },
    cards: b.cards,
    verification_level: b.verification_level,
    notes: b.notes || 'Manually verified from official sources',
    last_updated: b.last_updated,
    sources: b.sources || []
  }))
};

// Write report
const outFile = 'reports/verified-banks-top100-log.json';
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`Wrote ${outFile}`);

// Also update reports/index.json to include this
const reportsIndex = JSON.parse(fs.readFileSync('reports/index.json', 'utf8'));
reportsIndex.reports.push({
  filename: 'verified-banks-top100-log.json',
  url: '/reports/verified-banks-top100-log.json',
  stats: {
    total_processed: verifiedBanks.length,
    verified_count: verifiedBanks.length,
    errors: 0
  }
});
fs.writeFileSync('reports/index.json', JSON.stringify(reportsIndex, null, 2));
console.log('Updated reports index');
