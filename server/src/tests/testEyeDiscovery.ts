import 'dotenv/config';
import { b2bDiscoveryEngine } from '../tools/b2bDiscoveryEngine.js';

async function testEye() {
  const t0 = Date.now();
  console.log('Testing Discovery for keyword "eye" in Bangalore...');

  const res = await b2bDiscoveryEngine.search({
    keywords: 'eye',
    location: 'Bangalore, India',
    countryCode: '+91',
    includeDecisionMakers: true
  }, (pct, stage) => {
    console.log(`[${pct}%] ${stage}`);
  });

  console.log('\n================ Discovery Summary ================');
  console.log('Total Leads Discovered:', res.leads.length);
  console.log('Total Decision-Makers:', res.decisionMakers?.length || 0);
  console.log('Duration:', (Date.now() - t0) / 1000, 'seconds');
  console.log('Coverage Note:', res.coverage?.remainingCoverageNote || 'Complete');
  console.log('\nLocalities Covered:');
  const locs = Array.from(new Set(res.leads.map(l => l.locality)));
  console.log(locs.join(', '));

  console.log('\nSample Leads:');
  res.leads.slice(0, 12).forEach((l, i) => {
    console.log(`${i + 1}. ${l.businessName} [${l.locality}] - Phone: ${l.phoneInternational || l.phoneRaw || 'N/A'} - Website: ${l.website || 'N/A'}`);
  });

  console.log('\nSample Decision-Makers:');
  (res.decisionMakers || []).slice(0, 10).forEach((dm, i) => {
    console.log(`${i + 1}. ${dm.name} (${dm.designation}) @ ${dm.companyName} - LinkedIn: ${dm.linkedinUrl || 'N/A'}`);
  });
}

testEye().catch(console.error);
