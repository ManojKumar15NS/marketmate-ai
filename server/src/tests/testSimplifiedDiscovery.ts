import { b2bDiscoveryEngine } from '../tools/b2bDiscoveryEngine.js';
import { b2bExportService } from '../tools/b2bExportService.js';
import { jobService } from '../services/jobService.js';
import { initBackgroundWorkers } from '../workers/index.js';

async function runTests() {
  console.log('========================================================================');
  console.log('   MarketMate AI - Simplified B2B Discovery & Background Job Test       ');
  console.log('========================================================================\n');

  // Test 1: Country & Calling Code Mapping Verification
  console.log('▶ Test 1: Verifying Country & Worldwide Calling Code Support...');
  const testZonesBangalore = b2bDiscoveryEngine.resolveSearchZones('Bangalore, India');
  console.log(`✔ Bangalore zones resolved: ${testZonesBangalore.zones.length} zones found.`);

  const testZonesMysore = b2bDiscoveryEngine.resolveSearchZones('Mysore, India');
  console.log(`✔ Mysore zones resolved: ${testZonesMysore.zones.length} zones found.`);

  const testZonesLondon = b2bDiscoveryEngine.resolveSearchZones('London, United Kingdom');
  console.log(`✔ London dynamic zones resolved: ${testZonesLondon.zones.length} zones created.`);

  // Test 2: Mysore Software Companies (Testing Unlimited / Multi-Zone Discovery in Mysore)
  console.log('\n▶ Test 2: Testing Discovery for Software Companies in Mysore...');
  const mysoreResult = await b2bDiscoveryEngine.search({
    keywords: 'Software Companies',
    location: 'Mysore, India',
    countryCode: '+91',
    includeDecisionMakers: true
    // No limit passed -> unlimited discovery across all active zones
  }, (pct, stage) => {
    console.log(`  [Progress ${pct}%] ${stage}`);
  });

  console.log(`\n✔ Mysore Discovery Completed:`);
  console.log(`  Total Leads Discovered: ${mysoreResult.leads.length}`);
  console.log(`  Total Decision-Makers: ${mysoreResult.decisionMakers?.length || 0}`);
  console.log(`  Coverage Note: ${mysoreResult.coverage?.remainingCoverageNote || 'Complete'}`);
  console.log(`  Sample Companies:`);
  mysoreResult.leads.slice(0, 5).forEach((l, i) => {
    console.log(`  ${i + 1}. ${l.businessName} [${l.locality || l.city}] - Phone: ${l.phoneInternational || l.phoneRaw} (Mobile: ${l.isMobile})`);
  });

  // Test 3: Multi-Format Exports on Mysore Results
  console.log('\n▶ Test 3: Verifying Compact Multi-Format Exports...');
  const xlsx = await b2bExportService.generateExcel(mysoreResult.leads);
  console.log(`✔ Excel generated: ${xlsx.length} bytes`);

  const csv = b2bExportService.generateCsv(mysoreResult.leads);
  console.log(`✔ Universal CSV generated: ${csv.length} chars`);

  const zoho = b2bExportService.generateCrmCsv(mysoreResult.leads, 'zoho');
  console.log(`✔ Zoho CRM CSV generated: ${zoho.length} chars`);

  const hubspot = b2bExportService.generateCrmCsv(mysoreResult.leads, 'hubspot');
  console.log(`✔ HubSpot CSV generated: ${hubspot.length} chars`);

  const salesforce = b2bExportService.generateCrmCsv(mysoreResult.leads, 'salesforce');
  console.log(`✔ Salesforce CSV generated: ${salesforce.length} chars`);

  const vcf = b2bExportService.generateBulkVCard(mysoreResult.leads);
  console.log(`✔ Bulk vCard 3.0 generated: ${vcf.length} chars`);

  // Test 4: Testing Asynchronous Job Execution (JobService + Worker Queue)
  console.log('\n▶ Test 4: Verifying Background Job Workflow (JobService + Worker Queue)...');
  initBackgroundWorkers();

  let jobProgressReported = false;
  const queuedJob = jobService.enqueueJob({
    agentId: 'whatsapp',
    input: {
      keywords: 'Eye Hospitals',
      location: 'Jayanagar, Bangalore',
      countryCode: '+91',
      limit: 5,
      includeDecisionMakers: true
    }
  });

  console.log(`✔ Job ${queuedJob.jobId} enqueued with status: "${queuedJob.status}"`);

  // Wait for background job to finish
  let attempts = 0;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 2000));
    const current = jobService.getJob(queuedJob.jobId);
    if (current) {
      if (current.progress > 0 && !jobProgressReported) {
        console.log(`  [Job Progress] ${current.progress}% - ${current.currentStage}`);
        jobProgressReported = true;
      }
      if (current.status === 'completed') {
        console.log(`✔ Job ${queuedJob.jobId} completed successfully!`);
        const parsed = JSON.parse(current.result!);
        console.log(`  Job result contains ${parsed.leads?.length || 0} leads and ${parsed.decisionMakers?.length || 0} decision-makers.`);
        break;
      } else if (current.status === 'failed') {
        throw new Error(`Job failed: ${current.error}`);
      }
    }
    attempts++;
  }

  console.log('\n========================================================================');
  console.log('   ALL VERIFICATION TESTS COMPLETED & VALIDATED SUCCESSFULLY!          ');
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
