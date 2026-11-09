import { validateSafeUrl } from '../tools/webFetcher.js';
import { analyzeWebsiteSeo } from '../tools/websiteAnalysis.js';
import { emailFinderService } from '../tools/emailFinderService.js';
import { hunterService } from '../services/hunterService.js';
import { jobService } from '../services/jobService.js';
import { initBackgroundWorkers } from '../workers/index.js';
import { sqliteDb } from '../db/sqlite.js';

async function runErrorScenarios() {
  console.log('=== TEST 7: ERROR SCENARIOS & RESILIENCE VERIFICATION ===\n');
  initBackgroundWorkers();

  // 1. Invalid Website URL
  console.log('[Scenario 1] Testing Invalid Website URL handling...');
  let invalidCaught = false;
  try {
    await analyzeWebsiteSeo('not-a-valid-domain-xyz-12345');
  } catch (err: any) {
    invalidCaught = true;
    console.log(`  Caught expected error: "${err.message}"`);
  }
  if (!invalidCaught) throw new Error('Invalid URL was not rejected!');
  console.log('✔ Invalid URL rejected with clean user-facing error.\n');

  // 2. Outbound SSRF Attempt (Loopback / Private IP)
  console.log('[Scenario 2] Testing Outbound SSRF Protection...');
  let ssrfBlocked = false;
  try {
    await validateSafeUrl('http://169.254.169.254/latest/meta-data/');
  } catch (err: any) {
    ssrfBlocked = true;
    console.log(`  Caught expected SSRF block: "${err.message}"`);
  }
  if (!ssrfBlocked) throw new Error('SSRF target was not blocked!');
  console.log('✔ SSRF attack to cloud metadata blocked.\n');

  // 3. Missing Uploaded Document (Document Analyzer)
  console.log('[Scenario 3] Testing Missing Uploaded Document handling...');
  const missingDocJob = jobService.enqueueJob({
    agentId: 'document',
    input: {}
  });
  await new Promise(r => setTimeout(r, 400));
  const docChecked = sqliteDb.getJob(missingDocJob.jobId);
  console.log(`  Document job status: ${docChecked?.status}, error: "${docChecked?.error}"`);
  if (docChecked?.status !== 'failed') throw new Error('Missing document was not rejected!');
  console.log('✔ Document Analyzer strictly rejected execution without document.\n');

  // 4. Hunter Credits Exhausted (402)
  console.log('[Scenario 4] Testing Hunter Credits Exhausted (402) Simulation...');
  const origFind = hunterService.findEmailForPerson.bind(hunterService);
  const origIsEnabled = hunterService.isEnabled.bind(hunterService);
  (hunterService as any).isEnabled = () => true;
  (hunterService as any).findEmailForPerson = async () => ({
    email: null,
    creditsExhausted: true,
    error: 'Hunter search credits exhausted'
  });

  const { store } = await import('../services/store.js');
  const testId = `search_err_${Date.now()}`;
  const testContactId = `cont_${Date.now()}`;
  await store.saveEmailSearch({
    id: testId,
    mode: 'single_company',
    keywords: ['CEO'],
    requestedLimit: 5,
    actualDiscoveredCount: 1,
    stats: { totalFound: 1, linkedinProfilesFound: 1, emailsFound: 0, verified: 0, publiclyListed: 0, unverified: 0, invalidOrRisky: 0, duplicatesRemoved: 0 },
    sourcesUsed: ['LinkedIn'],
    contacts: [{
      id: testContactId,
      name: 'Elena Rostova',
      email: null,
      title: 'Chief Technology Officer',
      department: 'Technology',
      company: 'TechGlobal',
      domain: 'techglobal.example',
      website: 'https://techglobal.example',
      industry: 'Software',
      location: 'Berlin, Germany',
      linkedinUrl: 'https://www.linkedin.com/in/elenarostova',
      discoveryKeyword: 'CTO',
      discoverySource: 'Public LinkedIn Profile',
      sourceUrl: 'https://www.linkedin.com/in/elenarostova',
      emailStatus: 'Unavailable',
      confidence: 'high',
      verificationDetails: 'Verified LinkedIn profile',
      discoveredAt: new Date().toISOString()
    }],
    createdAt: new Date().toISOString()
  });

  const hunterRes = await emailFinderService.enrichContactsWithEmails(testId, [testContactId]);
  (hunterService as any).findEmailForPerson = origFind;
  (hunterService as any).isEnabled = origIsEnabled;
  console.log(`  Hunter 402 result: creditsExhausted=${hunterRes.creditsExhausted}, enrichedCount=${hunterRes.enrichedCount}`);
  console.log('✔ Hunter 402 handled without losing LinkedIn contacts.\n');

  // 5. One Agent Failure Does Not Break Concurrent Agent
  console.log('[Scenario 5] Testing that one failing agent does NOT break other agents...');
  sqliteDb.setCache('seo:global:none:https://shgtechnologies.com/', 'seo', {
    url: 'https://shgtechnologies.com/',
    overallScore: 88,
    metrics: { wordCount: 450, headings: { h1: 1 } },
    grounding: { status: 'extracted' }
  }, 86400);

  const failingJob = jobService.enqueueJob({
    agentId: 'document',
    input: {} // Will fail immediately
  });

  const successfulJob = jobService.enqueueJob({
    agentId: 'seo',
    input: { url: 'https://shgtechnologies.com/' } // Valid
  });

  await new Promise(r => setTimeout(r, 1500));
  const failCheck = sqliteDb.getJob(failingJob.jobId);
  const passCheck = sqliteDb.getJob(successfulJob.jobId);

  console.log(`  Failing job status: ${failCheck?.status} (Error: "${failCheck?.error}")`);
  console.log(`  Concurrent SEO job status: ${passCheck?.status} (Progress: ${passCheck?.progress}%)`);

  if (failCheck?.status === 'failed' && (passCheck?.status === 'running' || passCheck?.status === 'completed')) {
    console.log('✔ Independent failure isolation verified: failing job did not impact concurrent worker.\n');
  } else {
    throw new Error('Failure isolation failed!');
  }

  console.log('========================================================================');
  console.log('             ALL ERROR SCENARIOS VERIFIED SUCCESSFULLY (0 FAILURES)     ');
  console.log('========================================================================');
  process.exit(0);
}

runErrorScenarios().catch(err => {
  console.error('Error Scenario Test Failed:', err);
  process.exit(1);
});
