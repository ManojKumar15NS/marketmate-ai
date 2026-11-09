import 'dotenv/config';
import { EmailFinderService } from '../tools/emailFinderService.js';
import { searchLiveWeb } from '../tools/webFetcher.js';
import { store } from '../services/store.js';

interface AuditContactRecord {
  company: string;
  querySent: string;
  name: string;
  title: string;
  linkedinUrl: string;
  sourceUrl: string;
  verificationStatus: string;
  companyEvidence: string;
  linkedinEvidence: string;
  lastCheckedDate: string;
  timingMs: number;
}

async function runAudit() {
  console.log('================================================================');
  console.log('MARKETMATE AI: LIVE LINKEDIN DISCOVERY & ACCURACY AUDIT');
  console.log('================================================================\n');

  await store.init();
  const service = new EmailFinderService();

  // PART 1: AUDIT OF PREVIOUSLY REPORTED TEKAXIS CONTACTS
  console.log('--- PART 1: AUDITING PREVIOUSLY REPORTED TEKAXIS CONTACTS ---');
  const previousTekaxisContacts = [
    { name: 'Suresh Kumar', reportedUrl: 'https://www.linkedin.com/in/suresh-kumar-tekaxis' },
    { name: 'Praveen Sharma', reportedUrl: 'https://www.linkedin.com/in/praveen-sharma-tech' },
    { name: 'Ananya Sen', reportedUrl: 'https://www.linkedin.com/in/ananya-sen-marketing' },
    { name: 'David Miller', reportedUrl: 'https://www.linkedin.com/in/david-miller-bizdev' },
    { name: 'Ritu Patel', reportedUrl: 'https://www.linkedin.com/in/ritu-patel-operations' }
  ];

  for (const c of previousTekaxisContacts) {
    const q = `site:linkedin.com/in/ "${c.name}" TekAxis`;
    console.log(`Checking query: ${q}`);
    const hits = await searchLiveWeb(q, 3);
    const exactMatch = hits.find(h => h.url.toLowerCase().includes(c.reportedUrl.toLowerCase()));
    const anyHit = hits.find(h => h.title.toLowerCase().includes(c.name.toLowerCase()));
    
    if (exactMatch) {
      console.log(`  [FOUND EXACT] ${c.name} -> ${exactMatch.url}`);
    } else if (anyHit) {
      console.log(`  [PARTIAL HIT] ${c.name} found with URL ${anyHit.url} (Reported URL was synthetic/different)`);
      console.log(`    Snippet: ${anyHit.snippet.substring(0, 100)}...`);
    } else {
      console.log(`  [NOT FOUND / REJECTED] ${c.name} (${c.reportedUrl}) has NO genuine public LinkedIn profile matching TekAxis in search.`);
    }
  }

  // PART 2: LIVE DISCOVERY ON 3 REAL COMPANIES
  const targetCompanies = [
    { name: 'TekAxis', website: 'https://tekaxis.com', domain: 'tekaxis.com' },
    { name: 'SHG Technologies', website: 'https://shgtechnologies.com', domain: 'shgtechnologies.com' },
    { name: 'Stripe', website: 'https://stripe.com', domain: 'stripe.com' }
  ];

  const allAuditRecords: AuditContactRecord[] = [];

  for (const target of targetCompanies) {
    console.log(`\n================================================================`);
    console.log(`LIVE DISCOVERY FOR: ${target.name} (${target.domain})`);
    console.log(`================================================================`);
    const startTime = Date.now();

    const run = await service.discoverPeople({
      mode: 'single_company',
      website: target.website,
      companyName: target.name,
      keywords: ['CEO', 'Founder', 'Managing Director', 'Sales Director', 'CTO'],
      limit: 5
    }, (progress) => {
      const latest = progress.logs[progress.logs.length - 1];
      if (latest) {
        console.log(`  [${latest.type.toUpperCase()}] ${latest.message}`);
      }
    });

    const elapsed = Date.now() - startTime;
    console.log(`\nCompleted in ${elapsed}ms. Found ${run.contacts.length} candidate contacts.`);

    for (const c of run.contacts) {
      allAuditRecords.push({
        company: target.name,
        querySent: `site:linkedin.com/in/ ("${target.name}" OR "${target.domain}") (${c.discoveryKeyword})`,
        name: c.name,
        title: c.title,
        linkedinUrl: c.linkedinUrl || '',
        sourceUrl: c.sourceUrl || '',
        verificationStatus: c.verificationStatus || 'Unverified',
        companyEvidence: c.companyEvidence || '',
        linkedinEvidence: c.linkedinEvidence || '',
        lastCheckedDate: c.lastCheckedDate || new Date().toISOString(),
        timingMs: elapsed
      });

      console.log(`\n  Contact: ${c.name} | ${c.title} @ ${c.company}`);
      console.log(`    LinkedIn URL: ${c.linkedinUrl}`);
      console.log(`    Verification Status: ${c.verificationStatus}`);
      console.log(`    Company Evidence: ${c.companyEvidence}`);
      console.log(`    Raw Evidence Title: ${c.linkedinEvidence}`);
    }
  }

  console.log('\n================================================================');
  console.log('SUMMARY TABLE OF VERIFIED AND UNVERIFIED CONTACTS:');
  console.log('================================================================');
  console.table(allAuditRecords.map(r => ({
    Company: r.company,
    Name: r.name,
    Title: r.title,
    Status: r.verificationStatus,
    LinkedInUrl: r.linkedinUrl.substring(0, 45) + '...',
    Timing: `${r.timingMs}ms`
  })));
}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
