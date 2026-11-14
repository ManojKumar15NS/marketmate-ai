import { b2bDiscoveryEngine } from '../tools/b2bDiscoveryEngine.js';
import { b2bExportService } from '../tools/b2bExportService.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

async function runB2BVerification() {
  console.log('========================================================================');
  console.log('   MarketMate AI - B2B Lead & Decision-Maker Intelligence Engine Test   ');
  console.log('========================================================================\n');

  console.log('▶ Test 1: Multi-Zone Discovery for Bangalore Eye Hospitals (Target Limit: 20)...');
  const startTime = Date.now();

  const results = await b2bDiscoveryEngine.search(
    {
      keywords: 'Eye Hospitals',
      location: 'Bangalore',
      countryCode: '+91',
      limit: 20,
      includeDecisionMakers: true
    },
    (pct, msg) => {
      console.log(`  [Progress ${pct}%] ${msg}`);
    }
  );

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✔ Discovery completed in ${durationSec}s!`);
  console.log(`Total Leads Discovered: ${results.leads.length}`);
  console.log(`Total Decision-Makers: ${results.decisionMakers?.length || 0}`);
  console.log(`Coverage Stats:`, results.coverage);

  if (results.leads.length === 0) {
    throw new Error('FAILED: No leads were discovered!');
  }

  console.log('\n--- Sample Discovered Companies & Branches ---');
  results.leads.slice(0, 8).forEach((l, i) => {
    console.log(`${i + 1}. [${l.locality || l.city}] ${l.businessName}`);
    console.log(`   Brand: ${l.brandName || 'Independent'} | Branch Info: ${JSON.stringify(l.branchInfo || 'N/A')}`);
    console.log(`   Phone: ${l.phoneInternational} (Mobile: ${l.isMobile ? 'YES - WhatsApp Ready' : 'Reception / Landline'})`);
    console.log(`   Fit Score: ${l.scores?.companyFitScore} | Quality Score: ${l.scores?.contactQualityScore} | Total: ${l.scores?.totalScore}`);
    console.log(`   Decision-Makers Count: ${l.decisionMakers?.length || 0}`);
  });

  if (results.decisionMakers && results.decisionMakers.length > 0) {
    console.log('\n--- Sample Discovered Authorized Decision-Makers ---');
    results.decisionMakers.slice(0, 8).forEach((dm, i) => {
      console.log(`${i + 1}. ${dm.name} - ${dm.designation} (${dm.roleCategory})`);
      console.log(`   Company: ${dm.companyName} | Branch: ${dm.branchLocation || 'Headquarters'}`);
      console.log(`   Status: ${dm.employmentStatus} | Confidence: ${dm.confidenceScore}%`);
      console.log(`   LinkedIn: ${dm.linkedinUrl || 'N/A'} | Email: ${dm.email || 'N/A'}`);
      console.log(`   Evidence: ${dm.sourceEvidence}`);
    });
  }

  console.log('\n▶ Test 2: Testing Multi-Format Export Capabilities...');
  const excelBuffer = await b2bExportService.generateExcel(results.leads);
  console.log(`✔ Excel Workbook generated (${excelBuffer.length} bytes, 3 styled sheets)`);

  const universalCsv = b2bExportService.generateCsv(results.leads);
  console.log(`✔ Universal CSV generated (${universalCsv.length} chars)`);

  const hubspotCsv = b2bExportService.generateCrmCsv(results.leads, 'hubspot');
  console.log(`✔ HubSpot CRM CSV generated (${hubspotCsv.length} chars)`);

  const salesforceCsv = b2bExportService.generateCrmCsv(results.leads, 'salesforce');
  console.log(`✔ Salesforce CRM CSV generated (${salesforceCsv.length} chars)`);

  const zohoCsv = b2bExportService.generateCrmCsv(results.leads, 'zoho');
  console.log(`✔ Zoho CRM CSV generated (${zohoCsv.length} chars)`);

  const vCard = b2bExportService.generateBulkVCard(results.leads);
  console.log(`✔ Bulk vCard 3.0 generated (${vCard.length} chars)`);

  console.log('\n========================================================================');
  console.log('   ALL B2B LEAD INTELLIGENCE VERIFICATION TESTS PASSED SUCCESSFULLY!    ');
  console.log('========================================================================');
}

runB2BVerification().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
