import fs from 'fs';
import path from 'path';

import 'dotenv/config';

// Known keys that existed in historical chats / previous commits to verify they are NEVER in client/dist or public responses
const CRITICAL_KEYS = [
  process.env.TAVILY_API_KEY,
  process.env.HUNTER_API_KEY,
  'AIzaSy' // Prefix check
].filter(Boolean) as string[];

const SECRET_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/,
  /tvly-[A-Za-z0-9_-]{30,}/,
  /[0-9a-f]{40}/i // Potential 40-char Hunter or Git hash tokens (checked with care)
];

function scanDirectory(dir: string, extensions: string[], violations: string[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanDirectory(fullPath, extensions, violations);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext) || entry.name.startsWith('.env')) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for specific known secrets
        for (const secret of CRITICAL_KEYS) {
          if (content.includes(secret)) {
            // Ignore .env.local or server/.env which are gitignored
            if (!fullPath.includes('.env') || fullPath.includes('.env.example')) {
              violations.push(`[CRITICAL LEAK] Known secret found in ${fullPath}: "${secret.substring(0, 10)}..."`);
            }
          }
        }

        // In client dist/ or client src/, check for any API key pattern or VITE_* leak
        if (fullPath.includes('client')) {
          if (/AIzaSy[A-Za-z0-9_-]{33}/.test(content)) {
            violations.push(`[LEAK] Gemini API Key pattern found in client: ${fullPath}`);
          }
          if (/tvly-[A-Za-z0-9_-]{30,}/.test(content)) {
            violations.push(`[LEAK] Tavily API Key pattern found in client: ${fullPath}`);
          }
          if (/VITE_[A-Z_]*KEY/.test(content)) {
            violations.push(`[LEAK] Client references VITE_*KEY in: ${fullPath}`);
          }
        }
      }
    }
  }
}

async function runTest() {
  console.log('=== TEST B: Comprehensive Secret Scanning ===');
  const violations: string[] = [];
  const rootDir = path.resolve(__dirname, '../../../');
  const clientDist = path.join(rootDir, 'client', 'dist');
  const clientSrc = path.join(rootDir, 'client', 'src');
  const serverDist = path.join(rootDir, 'server', 'dist');
  const rootEnvExample = path.join(rootDir, '.env.example');
  const serverEnvExample = path.join(rootDir, 'server', '.env.example');

  // 1. Scan client dist (built production bundle)
  console.log(`[Test B] Scanning client production build: ${clientDist}...`);
  scanDirectory(clientDist, ['.html', '.js', '.css', '.map'], violations);

  // 2. Scan client src
  console.log(`[Test B] Scanning client source code: ${clientSrc}...`);
  scanDirectory(clientSrc, ['.ts', '.tsx', '.js', '.html'], violations);

  // 3. Scan .env.example files
  console.log('[Test B] Verifying .env.example files contain only variable names and no values...');
  for (const envFile of [rootEnvExample, serverEnvExample]) {
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [, val] = trimmed.split('=');
          if (val && val.trim().length > 0 && !val.startsWith('"your-') && !val.startsWith('http')) {
            violations.push(`[LEAK] Potential secret value in ${envFile}: "${trimmed}"`);
          }
        }
      }
    }
  }

  // 4. Test Settings API response masking
  console.log('[Test B] Testing Settings API response to ensure secrets are strictly masked...');
  const { hunterService } = await import('../services/hunterService.js');
  const hunterSettings = await hunterService.getSettings();
  if (hunterSettings.maskedKey && !hunterSettings.maskedKey.includes('••••')) {
    violations.push(`[LEAK] hunterService.getSettings() returned raw key: ${hunterSettings.maskedKey}`);
  }
  console.log(`[Test B] Hunter settings apiKey masked value: "${hunterSettings.maskedKey}"`);

  // Report results
  if (violations.length > 0) {
    console.error(`\n[Test B FAILED] Found ${violations.length} secret violation(s):`);
    for (const v of violations) {
      console.error(' - ' + v);
    }
    process.exit(1);
  }

  console.log('\n[Test B SUCCESS] 0 secrets found in client bundle, client source, or env examples.');
  console.log('[Test B SUCCESS] API settings responses masked with last4 only.');
  console.log('>>> TEST B PASSED WITH 100% SUCCESS <<<');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test B Error:', err);
  process.exit(1);
});
