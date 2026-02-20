const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Ignore SSL errors
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.end();
  });
}

function normalizeName(name) {
  // Remove special characters, keep alphanumeric and spaces, lower case, remove spaces
  return name.replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase().replace(/\s+/g, '');
}

function looksLikeBankSite(text) {
  const lower = text.toLowerCase();
  return lower.includes('bank') || lower.includes('branch') || lower.includes('customer') || lower.includes('contact') || lower.includes('card');
}

function extractPhone(text) {
  // Look for +91 followed by 10 digits, possibly separated by space or hyphen
  let match = text.match(/\+91[-\s]?\d{10}/);
  if (match) return match[0];
  // Look for tel: links
  match = text.match(/tel:(\+91[-\s]?\d{10}|\d{10})/i);
  if (match) return match[1];
  // Look for 10-digit numbers with context like "phone", "call", "helpline"
  // Simple: just a 10-digit number might be too many false positives. We'll return empty if no +91 pattern.
  return '';
}

function extractSmsBlocking(text) {
  // Look for SMS blocking: e.g., "SMS BLOCK <last4> to 567676"
  const lower = text.toLowerCase();
  return /sms.*block|block.*sms/i.test(lower) || lower.includes('blocking') && lower.includes('sms');
}

function extractAppUrls(text) {
  const androidMatch = text.match(/https?:\/\/play\.google\.com\/store\/apps\/details\?id=[^"'\s]+/i);
  const iosMatch = text.match(/https?:\/\/apps\.apple\.com\/[^"'\s]+/i);
  return {
    android: androidMatch ? androidMatch[0] : '',
    ios: iosMatch ? iosMatch[0] : ''
  };
}

async function verifyBank(code, name) {
  const candidates = [];
  const lowerCode = code.toLowerCase();
  const normalized = normalizeName(name);
  const patterns = [
    `https://${lowerCode}.com`,
    `https://${lowerCode}.in`,
    `https://${normalized}.com`,
    `https://${normalized}.in`,
    `https://${normalized}bank.com`,
    `https://${normalized}bank.in`
  ];
  for (const url of patterns) {
    try {
      const res = await fetchUrl(url, 8000);
      if (res.status === 200 && res.body.length > 500 && looksLikeBankSite(res.body)) {
        const phone = extractPhone(res.body);
        const sms = extractSmsBlocking(res.body);
        const apps = extractAppUrls(res.body);
        return {
          code,
          name,
          website: url,
          phone,
          sms,
          apps,
          contentLength: res.body.length
        };
      }
    } catch (e) {
      // ignore errors, try next
    }
  }
  return { code, name, found: false };
}

async function main() {
  const codes = fs.readFileSync('batch-3-top100.txt', 'utf8').trim().split(/\s+/);
  const namesMap = JSON.parse(fs.readFileSync('batch3-names.json', 'utf8'));
  const results = [];
  for (const code of codes) {
    const name = namesMap[code] || 'UNKNOWN';
    console.log(`Processing ${code}: ${name}`);
    try {
      const result = await verifyBank(code, name);
      results.push(result);
    } catch (e) {
      console.error(`Error processing ${code}:`, e.message);
      results.push({ code, name, found: false, error: e.message });
    }
  }
  // Write results
  fs.writeFileSync('batch3-verification-results.json', JSON.stringify(results, null, 2));
  // Summary
  const verified = results.filter(r => r.found !== false);
  console.log(`\nSummary: ${verified.length}/${codes.length} banks verified.`);
}

main();
