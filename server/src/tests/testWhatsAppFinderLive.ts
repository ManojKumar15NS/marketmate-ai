import { whatsappFinderService } from '../tools/whatsappFinderService.js';

async function testLive() {
  console.log('Testing WhatsAppFinderService live...');

  try {
    const res = await whatsappFinderService.search({
      keywords: 'Eye Hospital',
      location: 'Indiranagar, Bangalore',
      countryCode: '+91',
      limit: 10
    }, (pct, msg) => {
      console.log(`[Progress ${pct}%] ${msg}`);
    });

    console.log(`\nDONE! Found ${res.leads.length} leads.`);
    res.leads.forEach((l, i) => {
      console.log(`\n#${i + 1}: ${l.businessName} (${l.category})`);
      console.log(`  Phone: ${l.phoneInternational} (Raw: ${l.phoneRaw}) | Mobile: ${l.isMobile}`);
      console.log(`  Address: ${l.address}`);
      console.log(`  Maps: ${l.googleProfileUrl}`);
      console.log(`  Website: ${l.website || 'N/A'}`);
      console.log(`  Rating: ${l.rating || 'N/A'}`);
      console.log(`  WhatsApp: ${l.whatsappUrl}`);
    });
  } catch (err: any) {
    console.error('ERROR in testLive:', err);
  }
}

testLive();
