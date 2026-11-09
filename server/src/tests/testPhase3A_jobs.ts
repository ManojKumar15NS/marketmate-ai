import { sqliteDb } from '../db/sqlite.js';
import { jobService } from '../services/jobService.js';
import { initBackgroundWorkers } from '../workers/index.js';

async function runTest() {
  console.log('=== TEST A: Background Jobs, Concurrency & Interrupted Recovery ===');

  // Initialize workers
  initBackgroundWorkers();

  // 1. Enqueue concurrent jobs
  console.log('[Test A] Enqueueing Job 1 (B2B Prospector)...');
  const job1 = jobService.enqueueJob({
    agentId: 'prospector',
    input: { url: 'https://tekaxis.com' }
  });

  console.log('[Test A] Enqueueing Job 2 (SEO Agent)...');
  const job2 = jobService.enqueueJob({
    agentId: 'seo',
    input: { url: 'https://shgtechnologies.com/' }
  });

  console.log('[Test A] Enqueueing Job 3 (LinkedIn Finder)...');
  const job3 = jobService.enqueueJob({
    agentId: 'email_finder',
    input: { mode: 'single_company', website: 'https://tekaxis.com', limit: 3 }
  });

  console.log(`[Test A] Enqueued 3 concurrent jobs:`);
  console.log(` - Job 1 (${job1.agentId}): ${job1.jobId} [${job1.status}]`);
  console.log(` - Job 2 (${job2.agentId}): ${job2.jobId} [${job2.status}]`);
  console.log(` - Job 3 (${job3.agentId}): ${job3.jobId} [${job3.status}]`);

  // Verify all 3 jobs exist in SQLite
  const list = sqliteDb.listJobs();
  const ids = list.map(j => j.jobId);
  if (!ids.includes(job1.jobId) || !ids.includes(job2.jobId) || !ids.includes(job3.jobId)) {
    throw new Error('Not all jobs were recorded in SQLite database!');
  }
  console.log('[Test A] Verified all 3 jobs persisted in SQLite.');

  // 2. Test Per-Job Cancellation
  console.log(`[Test A] Cancelling Job 3 (${job3.jobId})...`);
  const cancelled = jobService.cancelJob(job3.jobId);
  if (!cancelled) throw new Error('Job 3 cancellation failed');
  const job3After = sqliteDb.getJob(job3.jobId);
  if (job3After?.status !== 'cancelled') {
    throw new Error(`Expected Job 3 to be 'cancelled', got '${job3After?.status}'`);
  }
  console.log(`[Test A] Confirmed Job 3 cancelled independently. Status: ${job3After.status}`);

  // 3. Simulate Server Restart / Crash
  console.log('[Test A] Simulating unexpected server restart while jobs are running/queued...');
  // Manually update Job 1 to 'running' to simulate an active job during crash
  sqliteDb.updateJob(job1.jobId, { status: 'running', currentStage: 'Stage 3 in progress...' });
  
  // Re-run the startup crash recovery routine that runs on boot
  // (In sqlite.ts, runMigrations marks any running or queued jobs as 'interrupted')
  sqliteDb.close();

  // Reopen DB to simulate fresh server startup
  const freshDb = new (require('../db/sqlite.js').SqliteDb)();
  const recoveredJob1 = freshDb.getJob(job1.jobId);
  console.log(`[Test A] Server reboot complete. Job 1 status: ${recoveredJob1?.status} (Error: "${recoveredJob1?.error}")`);

  if (recoveredJob1?.status !== 'interrupted') {
    throw new Error(`Expected interrupted status after crash, got ${recoveredJob1?.status}`);
  }

  // 4. Test One-Click Retry of Interrupted Job
  console.log('[Test A] Testing one-click Retry button on interrupted job...');
  const retried = jobService.retryJob(job1.jobId);
  if (!retried || retried.status !== 'queued') {
    throw new Error(`Expected retried job to be 'queued', got ${retried?.status}`);
  }
  console.log(`[Test A] Job successfully re-queued for execution! Status: ${retried.status}`);

  console.log('\n>>> TEST A PASSED WITH 100% SUCCESS <<<');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test A Failed:', err);
  process.exit(1);
});
