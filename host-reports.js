const fs = require('fs');
const path = require('path');

const reportsDir = 'reports';
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

// Collect all report files (*-report.json) in the project root
const reportFiles = fs.readdirSync('.').filter(f => f.endsWith('-report.json'));

// Copy them to reports/ and generate an index
const reports = reportFiles.map(file => {
  const content = fs.readFileSync(file, 'utf8');
  const dest = path.join(reportsDir, file);
  fs.writeFileSync(dest, content);
  
  // Parse basic stats if possible
  let stats = {};
  try {
    const data = JSON.parse(content);
    stats = {
      total_processed: data.total_processed || data.banks?.length || 0,
      verified_count: data.verified_count || data.verified || 0,
      errors: data.errors?.length || 0
    };
  } catch (e) {}
  
  return { filename: file, url: `/reports/${file}`, stats };
});

// Generate index.json for easy listing
const index = {
  generated: new Date().toISOString(),
  reports: reports
};
fs.writeFileSync(path.join(reportsDir, 'index.json'), JSON.stringify(index, null, 2));

console.log(`📊 Hosted ${reports.length} verification reports in /reports/`);
reports.forEach(r => console.log(`  - ${r.filename} (${r.stats.total_processed || '?'} banks)`));
