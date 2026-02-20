#!/usr/bin/env node
// Spawn parallel research agents for top banks

const fs = require('fs');

// Read top500 codes
const codes = fs.readFileSync('top500-codes.txt', 'utf8').trim().split('\n').filter(Boolean);
console.log(`Total banks to process: ${codes.length}`);

// Split into batches of ~50
const batchSize = 50;
const batches = [];
for (let i = 0; i < codes.length; i += batchSize) {
  batches.push(codes.slice(i, i + batchSize));
}

console.log(`Spawning ${batches.length} agent sessions...`);

// For each batch, spawn an agent session
batches.forEach((batchCodes, idx) => {
  const batchNum = idx + 1;
  const batchFile = `batch-${batchNum}.txt`;
  fs.writeFileSync(batchFile, batchCodes.join('\n'));

  // Spawn agent with a task to process this batch
  const prompt = `
You are a research agent for the Card Block API project.

Your task: Populate blocking information for the banks listed in the file: ${batchFile}

Steps:
1. Read the bank codes from ${batchFile}
2. For each bank code, read the JSON file at data/banks/<code>.json
3. Research the bank's official website to find:
   - SMS shortcode for card blocking (if available)
   - Customer service phone numbers (toll-free and regular)
   - Mobile app details (Android/iOS app names and store links)
   - Website URL for card blocking/login
   - Which card types they issue: Visa, Mastercard, RuPay
4. Update the bank JSON with accurate blocking_methods, contact info, and cards.
5. Use verification_level: "agent_verified" if you found official sources, otherwise leave as "unverified".
6. Save the updated file.

Important:
- Do not fabricate information. If you cannot find reliable info, leave fields blank/empty and set verification_level to "unverified".
- Prefer official bank websites over third-party sources.
- For SMS blocking, look for phrases like "SMS BLOCK to <number>" or "Send BLOCK to shortcode".
- For phone, look for 24x7 customer care numbers specifically for lost/stolen cards.
- For app, look for links to Google Play Store and Apple App Store.
- For website, find the card blocking page URL (often under services/help/security).

After processing all banks in the batch, write a summary report to: batch-${batchNum}-report.json with counts of verified/unverified and any errors.

Start now. Work quietly and efficiently. Do not ask for input.
`;

  console.log(`Spawning agent ${batchNum} with ${batchCodes.length} banks`);

  sessions_spawn({
    task: prompt,
    label: `bank-research-batch-${batchNum}`,
    cleanup: 'keep',
    timeoutSeconds: 1800, // 30 minutes max
    model: 'kilocode/minimax-m2.5:free'
  }).catch(err => console.error(`Failed to spawn agent ${batchNum}:`, err.message));
});

console.log('\n✅ All agents spawned. They will work in parallel.');
console.log('Monitor with: sessions_list');
console.log('Check results with: sessions_history <sessionKey>');
