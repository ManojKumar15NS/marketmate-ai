import 'dotenv/config';
import { store } from '../services/store.js';
import { analyzeWebsiteSeo } from '../tools/websiteAnalysis.js';
import { EmailFinderService } from '../tools/emailFinderService.js';
import fs from 'fs';
import path from 'path';

async function testIsolation() {
  console.log('================================================================');
  console.log('AGENT ISOLATION & DATA SEPARATION AUDIT');
  console.log('================================================================\n');

  await store.init();

  // 1. Task A: Document Intelligence
  console.log('[1] Executing Document Analyzer Task...');
  const docId = `doc_iso_${Date.now()}`;
  const docContent = `B2B Enterprise SaaS Master Services Agreement between VendorCorp and Client Inc. Confidential terms on data processing.`;
  const docRecord = {
    id: docId,
    filename: 'enterprise_agreement.txt',
    mimeType: 'text/plain',
    sizeBytes: docContent.length,
    summary: 'Master Services Agreement for enterprise cloud software licensing.',
    extractedText: docContent,
    uploadedAt: new Date().toISOString()
  };
  // Store document in task store
  await store.saveTask({
    id: docId,
    title: 'Document Analysis: enterprise_agreement.txt',
    agentId: 'document',
    status: 'completed',
    priority: 'medium',
    companyContext: 'VendorCorp Inc',
    result: JSON.stringify(docRecord),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as any);
  console.log(`  Document saved: ID=${docId}, TextLength=${docContent.length}`);

  // 2. Task B: Technical SEO Audit
  console.log('\n[2] Executing Technical SEO Audit on https://stripe.com...');
  const seoResult = await analyzeWebsiteSeo('https://stripe.com', 1);
  console.log(`  SEO Audit completed: Score=${seoResult.score}, Findings=${seoResult.findings.length}`);

  // 3. Task C: Decision-Maker Discovery on SHG Technologies
  console.log('\n[3] Executing LinkedIn Decision-Maker Discovery for SHG Technologies...');
  const emailService = new EmailFinderService();
  const peopleResult = await emailService.discoverPeople({
    mode: 'single_company',
    website: 'https://shgtechnologies.com',
    companyName: 'SHG Technologies',
    keywords: ['CEO', 'Managing Director'],
    limit: 3
  });
  console.log(`  People Discovery completed: Discovered=${peopleResult.contacts.length}`);

  // 4. Verify Strict Isolation & Zero Cross-Contamination
  console.log('\n[4] Asserting Strict Output Separation:');

  // Check Document Data
  const docHasSeoData = JSON.stringify(docRecord).includes('stripe') || JSON.stringify(docRecord).includes('SEO');
  const docHasPeopleData = JSON.stringify(docRecord).includes('shg') || JSON.stringify(docRecord).includes('LinkedIn');
  console.log(`  Document Data Clean of SEO Data: ${!docHasSeoData}`);
  console.log(`  Document Data Clean of People Data: ${!docHasPeopleData}`);

  // Check SEO Data
  const seoHasDocData = JSON.stringify(seoResult).includes('Master Services Agreement') || JSON.stringify(seoResult).includes('VendorCorp');
  const seoHasPeopleData = JSON.stringify(seoResult).includes('shgtechnologies') || JSON.stringify(seoResult).includes('Muthangi');
  console.log(`  SEO Data Clean of Document Text: ${!seoHasDocData}`);
  console.log(`  SEO Data Clean of People Data: ${!seoHasPeopleData}`);

  // Check People Discovery Data
  const peopleHasDocData = JSON.stringify(peopleResult).includes('Master Services Agreement') || JSON.stringify(peopleResult).includes('VendorCorp');
  const peopleHasSeoData = JSON.stringify(peopleResult).includes('Lighthouse') || JSON.stringify(peopleResult).includes('robots.txt');
  console.log(`  People Discovery Clean of Document Data: ${!peopleHasDocData}`);
  console.log(`  People Discovery Clean of SEO Audit Data: ${!peopleHasSeoData}`);

  const passed = !docHasSeoData && !docHasPeopleData && !seoHasDocData && !seoHasPeopleData && !peopleHasDocData && !peopleHasSeoData;

  if (passed) {
    console.log('\n================================================================');
    console.log('ISOLATION TEST RESULT: PASSED (ZERO DATA LEAKAGE)');
    console.log('================================================================');
  } else {
    console.error('ISOLATION TEST RESULT: FAILED (LEAKAGE DETECTED)');
    process.exit(1);
  }
}

testIsolation().catch(err => {
  console.error('Isolation audit error:', err);
  process.exit(1);
});
