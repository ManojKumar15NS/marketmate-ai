import { emailFinderService } from '../tools/emailFinderService.js';
import { hunterService } from '../services/hunterService.js';
import { store } from '../services/store.js';
import { EmailSearchRun, DiscoveredContact } from '../types/index.js';

async function runTest() {
  console.log('=== TEST E: LinkedIn Discovery Preservation & Hunter 402 Simulation ===');

  // Setup sample test search run with verified LinkedIn profiles
  const searchId = `search_test_hunter_${Date.now()}`;
  const contact1: DiscoveredContact = {
    id: `cont_satya_${Date.now()}`,
    name: 'Satya Nadella',
    email: null,
    title: 'Chairman and CEO',
    department: 'Executive Leadership',
    company: 'Microsoft',
    domain: 'microsoft.com',
    website: 'https://microsoft.com',
    industry: 'Software & Cloud Computing',
    location: 'Redmond, WA',
    linkedinUrl: 'https://www.linkedin.com/in/satyanadella',
    discoveryKeyword: 'CEO',
    discoverySource: 'Public LinkedIn Profile',
    sourceUrl: 'https://www.linkedin.com/in/satyanadella',
    emailStatus: 'Unavailable',
    confidence: 'high',
    verificationDetails: 'Verified public LinkedIn profile',
    discoveredAt: new Date().toISOString()
  };

  const contact2: DiscoveredContact = {
    id: `cont_brad_${Date.now()}`,
    name: 'Brad Smith',
    email: null,
    title: 'Vice Chair & President',
    department: 'Executive Leadership',
    company: 'Microsoft',
    domain: 'microsoft.com',
    website: 'https://microsoft.com',
    industry: 'Software & Cloud Computing',
    location: 'Redmond, WA',
    linkedinUrl: 'https://www.linkedin.com/in/bradao',
    discoveryKeyword: 'President',
    discoverySource: 'Public LinkedIn Profile',
    sourceUrl: 'https://www.linkedin.com/in/bradao',
    emailStatus: 'Unavailable',
    confidence: 'high',
    verificationDetails: 'Verified public LinkedIn profile',
    discoveredAt: new Date().toISOString()
  };

  const initialRun: EmailSearchRun = {
    id: searchId,
    mode: 'single_company',
    targetUrl: 'https://microsoft.com',
    domain: 'microsoft.com',
    companyName: 'MICROSOFT',
    keywords: ['CEO', 'President'],
    requestedLimit: 10,
    actualDiscoveredCount: 2,
    stats: {
      totalFound: 2,
      linkedinProfilesFound: 2,
      emailsFound: 0,
      verified: 0,
      publiclyListed: 0,
      unverified: 0,
      invalidOrRisky: 0,
      duplicatesRemoved: 0
    },
    sourcesUsed: ['Public LinkedIn Profiles'],
    contacts: [contact1, contact2],
    createdAt: new Date().toISOString()
  };

  await store.saveEmailSearch(initialRun);
  console.log(`[Test E] Seeded search run ${searchId} with 2 LinkedIn contacts.`);

  // 1. Scenario 1: Hunter Disabled
  console.log('[Test E] Scenario 1: Testing when Hunter API is disabled...');
  const originalIsEnabled = hunterService.isEnabled.bind(hunterService);
  (hunterService as any).isEnabled = () => false;

  let disabledCaught = false;
  try {
    await emailFinderService.enrichContactsWithEmails(searchId, [contact1.id]);
  } catch (err: any) {
    disabledCaught = true;
    console.log(`[Test E] Expected error when Hunter is disabled: "${err.message}"`);
  }

  if (!disabledCaught) {
    throw new Error('Hunter disabled did not throw or notify user!');
  }

  // Verify contacts still intact after failure
  const runAfterDisabled = await store.getEmailSearch(searchId);
  if (!runAfterDisabled || runAfterDisabled.contacts.length !== 2) {
    throw new Error('Contacts were modified or dropped when Hunter was disabled!');
  }
  console.log('[Test E] Confirmed LinkedIn contacts fully preserved when Hunter is disabled.');

  // 2. Scenario 2: Hunter 402 Payment Required / Credits Exhausted
  console.log('[Test E] Scenario 2: Simulating Hunter 402 Payment Required (Credits Exhausted)...');
  (hunterService as any).isEnabled = () => true;

  // Mock findEmailForPerson to return creditsExhausted (mimicking HTTP 402)
  const originalFindEmail = hunterService.findEmailForPerson.bind(hunterService);
  (hunterService as any).findEmailForPerson = async () => {
    return {
      email: null,
      creditsExhausted: true,
      error: 'Hunter search credits exhausted'
    };
  };

  const enrichmentResult = await emailFinderService.enrichContactsWithEmails(searchId, [contact1.id, contact2.id]);
  console.log(`[Test E] Enrichment result: creditsExhausted=${enrichmentResult.creditsExhausted}, enrichedCount=${enrichmentResult.enrichedCount}`);

  if (!enrichmentResult.creditsExhausted) {
    throw new Error('Hunter 402 was not flagged as creditsExhausted!');
  }

  // Check saved contacts in store
  const runAfter402 = await store.getEmailSearch(searchId);
  if (!runAfter402 || runAfter402.contacts.length !== 2) {
    throw new Error('Contacts were dropped during Hunter 402 error!');
  }

  for (const c of runAfter402.contacts) {
    console.log(`[Test E] Contact: ${c.name} | LinkedIn: ${c.linkedinUrl} | Email: ${c.email} | Status: ${c.emailStatus} | Note: "${c.verificationDetails}"`);

    // Verify critical assertions:
    // 1. LinkedIn profile URL MUST NOT be lost
    if (!c.linkedinUrl || !c.linkedinUrl.includes('linkedin.com/in/')) {
      throw new Error(`LinkedIn URL was lost for ${c.name}!`);
    }
    // 2. Name and Title MUST NOT be lost
    if (!c.name || !c.title) {
      throw new Error(`Name or title was lost for ${c.name}!`);
    }
    // 3. Email MUST NOT be fabricated
    if (c.email !== null) {
      throw new Error(`Fabricated email found: "${c.email}"! Email must be null when credits exhausted.`);
    }
    // 4. Status must honestly indicate unavailable / credits exhausted
    if (c.emailStatus !== 'Unavailable') {
      throw new Error(`Expected emailStatus 'Unavailable', got '${c.emailStatus}'`);
    }
  }

  // Restore mocks
  (hunterService as any).isEnabled = originalIsEnabled;
  (hunterService as any).findEmailForPerson = originalFindEmail;

  console.log('\n[Test E SUCCESS] LinkedIn contacts 100% preserved during Hunter 402.');
  console.log('[Test E SUCCESS] Zero fabricated emails.');
  console.log('>>> TEST E PASSED WITH 100% SUCCESS <<<');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test E Error:', err);
  process.exit(1);
});
