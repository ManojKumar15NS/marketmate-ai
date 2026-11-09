import '../config/env.js';
import { db } from '../db/index.js';

async function runNeonLiveTest() {
  console.log('========================================================================');
  console.log('      NEON POSTGRESQL LIVE END-TO-END VERIFICATION AUDIT                ');
  console.log('========================================================================\n');

  // 1. Initialize Database
  console.log('[1/4] Initializing Database connection to Neon...');
  await db.init();
  const isPg = db.isPostgres();
  console.log(` -> Engine active: ${isPg ? 'PostgreSQL (Neon)' : 'SQLite'}`);
  if (!isPg) {
    throw new Error('Database is NOT running in PostgreSQL mode!');
  }

  // 2. Ping Database
  console.log('[2/4] Testing ping to Neon PostgreSQL Pool...');
  const pingOk = await db.ping();
  console.log(` -> Ping status: ${pingOk ? 'SUCCESS (Connected to Neon Pool)' : 'FAILED'}`);
  if (!pingOk) {
    throw new Error('db.ping() failed on Neon connection!');
  }

  // 3. Test Transactional Job Creation & Physical DB Storage
  console.log('[3/4] Testing Neon transactional job create, read & update...');
  const testJobId = `neon_test_job_${Date.now()}`;
  const created = await db.createJob({
    jobId: testJobId,
    agentId: 'prospector',
    companyId: 'neon-test-company',
    researchId: 'neon-test-research',
    status: 'queued',
    progress: 15,
    currentStage: 'Neon E2E Testing',
    input: JSON.stringify({ websiteUrl: 'https://tekaxis.com' }),
    result: null,
    error: null,
    createdAt: new Date().toISOString()
  });
  console.log(` -> Job created with ID: ${created.jobId}`);

  // Wait 300ms for write-through
  await new Promise((r) => setTimeout(r, 400));

  // Retrieve job
  const retrieved = await db.getJob(testJobId);
  if (!retrieved || retrieved.jobId !== testJobId) {
    throw new Error(`Failed to retrieve job ${testJobId} from Neon!`);
  }
  console.log(' -> Retrieved job from Neon DB:', {
    jobId: retrieved.jobId,
    agentId: retrieved.agentId,
    status: retrieved.status,
    currentStage: retrieved.currentStage
  });

  // Update job
  await db.updateJob(testJobId, {
    status: 'completed',
    progress: 100,
    currentStage: 'Verification Complete',
    result: JSON.stringify({ verified: true, db: 'Neon PostgreSQL 16' })
  });

  const updated = await db.getJob(testJobId);
  if (updated?.status !== 'completed' || updated?.progress !== 100) {
    throw new Error('Failed to update job status in Neon PostgreSQL!');
  }
  console.log(' -> Job updated in Neon DB:', {
    jobId: updated.jobId,
    status: updated.status,
    progress: updated.progress,
    currentStage: updated.currentStage
  });

  // 4. Test Content Creator storage in Neon
  console.log('[4/4] Testing Content Items & SEO Editor storage in Neon...');
  const contentItem = await db.saveContentItem({
    id: `neon_content_${Date.now()}`,
    title: 'Neon Production Launch Brief',
    topic: 'Neon Production Launch Brief',
    brief: 'Testing Neon PostgreSQL content library persistence',
    contentType: 'blog_post',
    language: 'English',
    targetWordCount: 500,
    generatedContent: 'Neon PostgreSQL serverless storage is now active for MarketMate AI.',
    wordCount: 11,
    characterCount: 75,
    readingTimeMinutes: 1,
    seoScore: 92,
    variants: [],
    metadata: { version: '1.0' }
  });
  console.log(' -> Saved Content Item in Neon DB:', {
    id: contentItem.id,
    title: contentItem.title,
    contentType: contentItem.contentType,
    wordCount: contentItem.wordCount
  });

  const retrievedContent = await db.getContentItem(contentItem.id);
  if (!retrievedContent || retrievedContent.title !== 'Neon Production Launch Brief') {
    throw new Error('Failed to retrieve content item from Neon PostgreSQL!');
  }
  console.log(' -> Retrieved Content Item from Neon DB successfully.');

  // Clean up test records
  await db.deleteContentItem(contentItem.id);
  await db.cancelJob(testJobId);
  console.log(' -> Test records cleaned up.');

  console.log('\n========================================================================');
  console.log('>>> ALL NEON POSTGRESQL SERVICES VERIFIED AND OPERATIONAL (100% PASS) <<<');
  console.log('========================================================================\n');

  await db.close();
  process.exit(0);
}

runNeonLiveTest().catch((err) => {
  console.error('\nFATAL E2E VERIFICATION ERROR:', err);
  process.exit(1);
});
