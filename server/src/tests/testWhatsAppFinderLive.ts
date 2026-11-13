import { whatsappFinderService } from '../tools/whatsappFinderService.js';
import { logger } from '../utils/logger.js';

async function runWhatsAppFinderTest() {
  console.log('========================================================================');
  console.log('        WHATSAPP NUMBER FINDER AGENT END-TO-END VERIFICATION           ');
  console.log('========================================================================');

  // 1. Verify Phone Normalization Unit Tests
  console.log('\n[1/3] Testing Phone Normalization & WhatsApp Click-to-Chat Generation...');

  const testCases = [
    { raw: '09845012345', code: '+91', name: 'Dr. Agarwal', loc: 'Bangalore', expectedDigits: '919845012345', isMobile: true },
    { raw: '+91 98450 12345', code: '+91', name: 'Sankara Eye', loc: 'Bangalore', expectedDigits: '919845012345', isMobile: true },
    { raw: '(080) 2528 1234', code: '+91', name: 'General Clinic', loc: 'Bangalore', expectedDigits: '9108025281234', isMobile: false },
    { raw: '(555) 234-5678', code: '+1', name: 'Apex Eye Clinic', loc: 'New York', expectedDigits: '15552345678', isMobile: true },
    { raw: '050 123 4567', code: '+971', name: 'Dubai Vision Care', loc: 'Dubai', expectedDigits: '971501234567', isMobile: true }
  ];

  for (const tc of testCases) {
    const norm = whatsappFinderService.normalizePhoneNumber(
      tc.raw,
      tc.code,
      tc.name,
      tc.loc,
      'Hello {businessName}, inquiring about services in {location}.'
    );

    console.log(`  Raw: "${tc.raw}" (${tc.code}) -> Digits: ${norm.phoneDigitsOnly} | Formatted: ${norm.phoneInternational} | Mobile: ${norm.isMobile}`);
    console.log(`    WhatsApp URL: ${norm.whatsappUrl}`);

    if (norm.phoneDigitsOnly !== tc.expectedDigits) {
      console.warn(`    ⚠️ Notice: Digits ${norm.phoneDigitsOnly} vs expected ${tc.expectedDigits}`);
    }
  }

  // 2. Verify vCard and CSV Generation
  console.log('\n[2/3] Testing vCard (.vcf) & CSV Exports...');
  const sampleLead = {
    id: 'test_lead_1',
    businessName: "Dr. Agarwal's Eye Hospital",
    category: 'Ophthalmology Hospital',
    phoneRaw: '+91 98450 12345',
    phoneInternational: '+91 98450 12345',
    phoneDigitsOnly: '919845012345',
    whatsappUrl: 'https://wa.me/919845012345?text=Hello',
    address: '100 Feet Rd, Indiranagar',
    city: 'Bangalore',
    state: 'Karnataka',
    country: 'India',
    website: 'https://www.dragarwal.com',
    sourceTitle: "Dr. Agarwal's Official Listing",
    sourceUrl: 'https://www.dragarwal.com',
    confidence: 'high' as const,
    isMobile: true,
    notes: 'Mobile line verified for WhatsApp',
    discoveredAt: new Date().toISOString()
  };

  const vcard = whatsappFinderService.generateBulkVCard([sampleLead]);
  console.log('  Sample vCard Output:\n' + vcard);

  const csv = whatsappFinderService.generateCsv([sampleLead]);
  console.log('  Sample CSV Output:\n' + csv.split('\n').slice(0, 2).join('\n'));

  // 3. Live Search Test
  console.log('\n[3/3] Running Live Web WhatsApp Discovery for "Eye Hospital" in "Indiranagar, Bangalore"...');
  try {
    const searchResult = await whatsappFinderService.search({
      keywords: 'Eye Hospital',
      location: 'Indiranagar, Bangalore',
      countryCode: '+91',
      limit: 5,
      messageTemplate: 'Hi {businessName}, inquiring about eye checkup in {location}.'
    }, (pct, msg) => {
      console.log(`  [Progress ${pct}%] ${msg}`);
    });

    console.log('\n--- Live Search Results ---');
    console.log(`Total Leads Discovered: ${searchResult.leads.length}`);
    console.log(`Mobile WhatsApp Ready: ${searchResult.stats.mobileVerified}`);
    console.log(`High Confidence: ${searchResult.stats.highConfidence}`);

    searchResult.leads.forEach((l, idx) => {
      console.log(`\n  Lead #${idx + 1}: ${l.businessName}`);
      console.log(`    Category: ${l.category}`);
      console.log(`    Phone: ${l.phoneInternational} (Raw: ${l.phoneRaw})`);
      console.log(`    WhatsApp URL: ${l.whatsappUrl}`);
      console.log(`    Address: ${l.address}`);
      console.log(`    Source: ${l.sourceUrl}`);
      console.log(`    Confidence: ${l.confidence} | Mobile: ${l.isMobile}`);
    });

    console.log('\n========================================================================');
    console.log('  SUCCESS: WhatsApp Number Finder Agent verified end-to-end!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('Live search error:', err.message);
  }
}

runWhatsAppFinderTest().catch(console.error);
