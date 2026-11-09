import 'dotenv/config';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

async function testSecurity() {
  console.log('================================================================');
  console.log('SECURITY & HARDENING AUDIT');
  console.log('================================================================\n');

  // 1. Check .gitignore contains .env
  console.log('[1] Checking .gitignore for secret exclusion...');
  const rootGitignore = fs.readFileSync(path.resolve(__dirname, '../../../.gitignore'), 'utf-8');
  const serverGitignore = fs.existsSync(path.resolve(__dirname, '../../.gitignore')) 
    ? fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf-8') 
    : '';

  const ignoresEnv = rootGitignore.includes('.env') || serverGitignore.includes('.env');
  console.log(`  .gitignore includes .env: ${ignoresEnv}`);

  // 2. Scan source code files for hardcoded API keys
  console.log('\n[2] Scanning source code for hardcoded API key patterns...');
  const srcDir = path.resolve(__dirname, '..');
  const sensitivePatterns = [
    /AIzaSy[0-9A-Za-z-_]{33}/,
    /tvly-[a-zA-Z0-9_-]{30,}/
  ];

  let violationsCount = 0;
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git' && entry.name !== 'tests') {
          scanDir(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const pattern of sensitivePatterns) {
          if (pattern.test(content)) {
            console.error(`  [VIOLATION] Hardcoded secret matched pattern in: ${fullPath}`);
            violationsCount++;
          }
        }
      }
    }
  }

  scanDir(srcDir);
  console.log(`  Source scan completed. Total hardcoded key violations in src (non-test): ${violationsCount}`);

  // 3. Test Structured Logger Scrubbing
  console.log('\n[3] Testing Logger redaction & scrubbing...');
  const fakeGemini = 'AIzaSy' + 'FakeTestingKeyString1234567890ABCDEF';
  const fakeTavily = 'tvly-' + 'dev-fake-testing-token-for-audit-redaction';
  const rawLog = `Connecting with Gemini key ${fakeGemini} and Tavily ${fakeTavily}`;
  const scrubbed = logger.scrub(rawLog);
  console.log('  Original: ' + rawLog.substring(0, 35) + '...');
  console.log('  Scrubbed: ' + scrubbed);
  const loggerSafe = !scrubbed.includes('FakeTestingKey') && !scrubbed.includes('fake-testing-token');
  console.log(`  Logger successfully scrubbed all keys: ${loggerSafe}`);

  // 4. Test API Settings Endpoint for Key Masking
  console.log('\n[4] Querying GET http://localhost:5000/api/settings for key masking...');
  try {
    const res = await fetch('http://localhost:5000/api/settings');
    const json: any = await res.json();
    console.log('  Settings payload:');
    console.log(`    Gemini Key Masked: ${json.maskedApiKey || json.geminiApiKey || 'Not returned (clean)'}`);
    console.log(`    Hunter Masked: ${json.hunter?.maskedKey || 'Not returned'}`);
    console.log(`    Tavily Masked: ${json.tavily?.maskedKey || 'Not returned'}`);
    
    // Ensure raw secret is NEVER in the response
    const jsonStr = JSON.stringify(json);
    const rawHunter = process.env.HUNTER_API_KEY || '';
    const rawTavily = process.env.TAVILY_API_KEY || '';
    const leaksSecret = (rawHunter && jsonStr.includes(rawHunter)) || (rawTavily && jsonStr.includes(rawTavily));
    console.log(`  Settings response clean of raw secrets: ${!leaksSecret}`);
  } catch (err: any) {
    console.warn('  Settings endpoint query warning:', err.message);
  }

  // 5. Test Rate Limiting
  console.log('\n[5] Testing Rate Limiting (120 rapid requests)...');
  let rateLimited = false;
  let requestsSent = 0;
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch('http://localhost:5000/api/health');
      requestsSent++;
      if (res.status === 429) {
        rateLimited = true;
        console.log(`  Rate limit triggered successfully at request #${requestsSent} (HTTP 429 Too Many Requests)`);
        break;
      }
    } catch {
      break;
    }
  }
  if (!rateLimited) {
    console.log(`  Rate limit not reached in ${requestsSent} requests (per-route limit may be higher or health exempt).`);
  }

  console.log('\n================================================================');
  console.log('SECURITY & HARDENING AUDIT COMPLETED');
  console.log('================================================================');
}

testSecurity().catch(err => {
  console.error('Security audit error:', err);
  process.exit(1);
});
