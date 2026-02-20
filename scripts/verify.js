// Agent verification script for card-block-api
// Run with: node verify.js

const fs = require('fs');
const https = require('https');
const path = require('path');

const banksDir = './data/banks';

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(false);
      return;
    }
    const protocol = url.startsWith('https') ? https : require('http');
    const req = protocol.get(url, { timeout: 10000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function verifyBankFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const bank = data;
  
  console.log(`\n🤖 Verifying: ${bank.name}`);
  
  const results = {
    bank: bank.name,
    slug: bank.slug,
    verified: false,
    confidence: 0,
    sources: [],
    issues: []
  };

  // Check website is accessible
  if (bank.website) {
    try {
      const websiteWorks = await checkUrl(bank.website);
      if (websiteWorks) {
        results.sources.push({ type: 'website', url: bank.website, status: 'ok' });
        results.confidence += 0.2;
      } else {
        results.issues.push(`Website not accessible: ${bank.website}`);
      }
    } catch (e) {
      results.issues.push(`Website check failed: ${e.message}`);
    }
  }

  // Check blocking page URL
  if (bank.blocking_page) {
    try {
      const urlWorks = await checkUrl(bank.blocking_page);
      if (urlWorks) {
        results.sources.push({ type: 'blocking_page', url: bank.blocking_page, status: 'ok' });
        results.confidence += 0.3;
      } else {
        results.issues.push(`Blocking page not accessible: ${bank.blocking_page}`);
      }
    } catch (e) {
      results.issues.push(`Blocking page check failed: ${e.message}`);
    }
  }

  // Check each blocking method URL
  for (const card of bank.cards || []) {
    for (const method of card.blocking_methods || []) {
      if (method.url) {
        try {
          const urlWorks = await checkUrl(method.url);
          if (urlWorks) {
            results.sources.push({ type: method.channel, url: method.url, status: 'ok' });
            results.confidence += 0.15;
          } else {
            results.issues.push(`Blocking URL not accessible: ${method.url}`);
          }
        } catch (e) {
          results.issues.push(`URL check failed for ${method.channel}: ${e.message}`);
        }
      }
    }
  }

  // Cap confidence at 1.0
  results.confidence = Math.min(results.confidence, 1.0);
  results.verified = results.confidence >= 0.5;

  console.log(`   Confidence: ${(results.confidence * 100).toFixed(0)}%`);
  console.log(`   Verified: ${results.verified ? '✅' : '❌'}`);
  if (results.issues.length > 0) {
    console.log(`   Issues: ${results.issues.join(', ')}`);
  }

  // Update the bank data
  bank.verification = {
    status: results.verified ? 'agent_verified' : 'unverified',
    last_verified: new Date().toISOString().split('T')[0],
    sources: results.sources.map(s => s.url),
    verified_by: 'agent',
    confidence: results.confidence
  };

  // Update each blocking method
  for (const card of bank.cards || []) {
    for (const method of card.blocking_methods || []) {
      method.verification = {
        status: results.verified ? 'agent_verified' : 'unverified',
        confidence: results.confidence
      };
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(bank, null, 2));
  
  return results;
}

async function main() {
  console.log('🔍 Card Block API - Agent Verification');
  console.log('=====================================\n');

  const files = fs.readdirSync(banksDir).filter(f => f.endsWith('.json') && f !== 'index.json');
  
  let verified = 0;
  let total = 0;
  
  for (const file of files) {
    total++;
    const filePath = path.join(banksDir, file);
    try {
      const result = await verifyBankFile(filePath);
      if (result.verified) verified++;
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }

  // Update index
  const indexData = JSON.parse(fs.readFileSync('./data/banks/index.json', 'utf8'));
  indexData.metadata.total_banks = total;
  indexData.metadata.last_verified = new Date().toISOString().split('T')[0];
  indexData.metadata.verification_stats = {
    agent_verified: verified,
    unverified: total - verified
  };
  fs.writeFileSync('./data/banks/index.json', JSON.stringify(indexData, null, 2));

  console.log('\n=====================================');
  console.log(`📊 Summary: ${verified}/${total} banks verified`);
  console.log('✅ Data updated with verification results');
}

main().catch(console.error);
