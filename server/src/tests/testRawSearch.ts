import { searchLiveWeb } from '../tools/webFetcher.js';
import { emailFinderService } from '../tools/emailFinderService.js';

async function test() {
  console.log('=== TEST RAW SEARCH FOR TEKAXIS LINKEDIN ===');
  const query = 'site:linkedin.com/in/ ("TekAxis" OR "tekaxis.com") (CEO OR Founder OR Director OR Manager)';
  console.log('Query:', query);
  
  const rawHits = await searchLiveWeb(query, 10);
  console.log('Raw search hits returned:', rawHits.length);
  for (const hit of rawHits) {
    console.log('--- HIT ---');
    console.log('Title:', hit.title);
    console.log('URL:', hit.url);
    console.log('Snippet:', hit.snippet);
  }

  console.log('\n=== RUNNING emailFinderService.discoverPeople FOR TEKAXIS ===');
  const result = await emailFinderService.discoverPeople({
    mode: 'single_company',
    website: 'https://tekaxis.com',
    keywords: ['CEO', 'Founder', 'Director'],
    limit: 10
  });

  console.log('Discovered contacts count:', result.contacts.length);
  for (const c of result.contacts) {
    console.log('--- CONTACT ---');
    console.log('Name:', c.name);
    console.log('Title:', c.title);
    console.log('Company:', c.company);
    console.log('LinkedIn URL:', c.linkedinUrl);
    console.log('Source URL:', c.sourceUrl);
  }
}

test().catch(console.error);
