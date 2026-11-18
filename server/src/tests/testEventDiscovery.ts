import { eventDiscoveryService } from '../tools/eventDiscoveryService.js';

async function run() {
  console.log('=== TESTING EVENT DISCOVERY SERVICE ===');

  // Test 1: Query doctor and hospital events in India
  const res1 = await eventDiscoveryService.searchEvents({
    keyword: 'hospital doctor',
    location: 'India',
    limit: 50
  });

  console.log(`[Test 1] Found ${res1.totalCount} events for "hospital doctor" in India.`);
  if (res1.totalCount === 0) {
    throw new Error('Expected at least 1 verified event, got 0.');
  }

  for (const evt of res1.events) {
    console.log(`- [${evt.dates}] ${evt.title} | Org: ${evt.organizer} | City: ${evt.city} | Source: ${evt.sourceUrl}`);
    if (!evt.title || !evt.organizer || !evt.dates || !evt.sourceUrl) {
      throw new Error(`Incomplete event record: ${JSON.stringify(evt)}`);
    }
  }

  // Test 2: Query events in Bengaluru specifically
  const res2 = await eventDiscoveryService.searchEvents({
    location: 'Bengaluru',
    limit: 50
  });

  console.log(`\n[Test 2] Found ${res2.totalCount} events in Bengaluru.`);
  if (res2.totalCount === 0) {
    throw new Error('Expected events in Bengaluru, got 0.');
  }

  console.log('\n>>> EVENT DISCOVERY TESTS PASSED (100% SUCCESS) <<<');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
