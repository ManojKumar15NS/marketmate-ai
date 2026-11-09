import { jobService } from '../services/jobService.js';
import { sqliteDb } from '../db/sqlite.js';
import { initBackgroundWorkers } from '../workers/index.js';

async function runTest() {
  console.log('=== TEST D: Agent Routing, Input Validation & Isolation ===');
  initBackgroundWorkers();

  // 1. Test SEO input validation: Must reject missing URL
  console.log('[Test D] Testing SEO input validation with missing URL...');
  const seoInvalidJob = jobService.enqueueJob({
    agentId: 'seo',
    input: {} // Missing URL
  });

  // Give job worker a moment to process and reject
  await new Promise(r => setTimeout(r, 200));
  const seoChecked = sqliteDb.getJob(seoInvalidJob.jobId);
  console.log(`[Test D] SEO invalid job status: ${seoChecked?.status}, error: "${seoChecked?.error}"`);
  if (seoChecked?.status !== 'failed' || !seoChecked?.error?.includes('requires a valid')) {
    throw new Error(`SEO did not reject invalid input! Status: ${seoChecked?.status}, Error: ${seoChecked?.error}`);
  }
  console.log('[Test D] Confirmed SEO rejects missing/invalid URL strictly.');

  // 2. Test Document Analyzer input validation: Must reject missing document
  console.log('[Test D] Testing Document Analyzer validation with missing documentId...');
  const docInvalidJob = jobService.enqueueJob({
    agentId: 'document',
    input: {} // Missing documentId and content
  });

  await new Promise(r => setTimeout(r, 200));
  const docChecked = sqliteDb.getJob(docInvalidJob.jobId);
  console.log(`[Test D] Document invalid job status: ${docChecked?.status}, error: "${docChecked?.error}"`);
  if (docChecked?.status !== 'failed' || !docChecked?.error?.includes('requires an explicitly selected')) {
    throw new Error(`Document Analyzer did not reject invalid input! Status: ${docChecked?.status}`);
  }
  console.log('[Test D] Confirmed Document Analyzer rejects missing document.');

  // 3. Test Agent Cache Isolation in SQLite
  console.log('[Test D] Testing cache isolation between agents...');
  sqliteDb.setCache('doc_finance_q3', 'document', { confidentialRevenue: '$10M', summary: 'Confidential Doc' });
  sqliteDb.setCache('seo_tekaxis', 'seo', { publicUrl: 'https://tekaxis.com', metaScore: 88 });

  const docCache = sqliteDb.getCache('doc_finance_q3');
  const seoCache = sqliteDb.getCache('seo_tekaxis');

  if (!docCache || docCache.confidentialRevenue !== '$10M') {
    throw new Error('Failed to retrieve document cache');
  }
  if (!seoCache || seoCache.metaScore !== 88) {
    throw new Error('Failed to retrieve SEO cache');
  }

  // Clear SEO cache, verify document cache is untouched
  sqliteDb.clearAgentCache('seo');
  const seoAfterClear = sqliteDb.getCache('seo_tekaxis');
  const docAfterClear = sqliteDb.getCache('doc_finance_q3');

  if (seoAfterClear !== null) {
    throw new Error('SEO cache was not cleared');
  }
  if (!docAfterClear || docAfterClear.confidentialRevenue !== '$10M') {
    throw new Error('Document cache was unintentionally contaminated or deleted by SEO cache clear!');
  }
  console.log('[Test D] Confirmed agent cache isolation: clearing SEO cache preserved Document Analyzer cache completely.');

  // 4. Test SSRF URL validation across agents
  console.log('[Test D] Testing SSRF protection: attempting to target internal IP...');
  const { validateSafeUrl } = await import('../tools/webFetcher.js');
  const privateIps = [
    'http://127.0.0.1:8080/admin',
    'http://localhost:3000',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/router',
    'http://10.0.0.1'
  ];

  for (const privUrl of privateIps) {
    let blocked = false;
    try {
      await validateSafeUrl(privUrl);
    } catch {
      blocked = true;
    }
    if (!blocked) {
      throw new Error(`SSRF validation failed: ${privUrl} was marked as safe!`);
    }
  }
  console.log('[Test D] Confirmed SSRF protection blocked all internal IP and loopback targets.');

  console.log('\n>>> TEST D PASSED WITH 100% SUCCESS <<<');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test D Error:', err);
  process.exit(1);
});
