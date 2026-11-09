import { execSync } from 'child_process';
import path from 'path';

const tests = [
  { name: 'Test A: Jobs Concurrency & Recovery', file: 'testPhase3A_jobs.ts' },
  { name: 'Test B: Comprehensive Secret Scanning', file: 'testPhase3B_secrets.ts' },
  { name: 'Test C: Deterministic SEO Audit (SHG)', file: 'testPhase3C_seo_shg.ts' },
  { name: 'Test D: Agent Routing, Input Validation & Isolation', file: 'testPhase3D_isolation.ts' },
  { name: 'Test E: Hunter 402 Simulation & LinkedIn Preservation', file: 'testPhase3E_hunter_402.ts' },
  { name: 'Test F: Production Health, Readiness, Auth & API', file: 'testPhase3F_prod.ts' }
];

console.log('================================================================');
console.log('       RUNNING COMPLETE MARKETMATE AI VERIFICATION SUITE        ');
console.log('================================================================\n');

let allPassed = true;

for (const t of tests) {
  console.log(`\n▶ EXECUTING: ${t.name} (${t.file})`);
  try {
    const output = execSync(`npx tsx src/tests/${t.file}`, {
      cwd: path.resolve(__dirname, '../../'),
      encoding: 'utf8'
    });
    console.log(output.trim());
    console.log(`✔ ${t.name} PASSED\n`);
  } catch (err: any) {
    console.error(`✖ ${t.name} FAILED!`);
    console.error(err.stdout || err.message);
    allPassed = false;
    break;
  }
}

if (!allPassed) {
  console.error('\n❌ VERIFICATION SUITE ENCOUNTERED FAILURES');
  process.exit(1);
} else {
  console.log('================================================================');
  console.log('       ALL 6 TESTS PASSED WITH 100% ACCURACY AND SUCCESS        ');
  console.log('================================================================');
  process.exit(0);
}
