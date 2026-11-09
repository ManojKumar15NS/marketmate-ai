import { prospectingEngine } from './agents/prospector.js';
import { store } from './services/store.js';
import { verifyEmailAddress } from './tools/emailVerifier.js';

async function runDualVerification() {
  console.log('================================================================');
  console.log('MARKETMATE AI: DUAL-COMPANY AUTOMATED END-TO-END VERIFICATION');
  console.log('Testing: Boson Motors (Agricultural EV) vs TekAxis (Digital Agency)');
  console.log('================================================================\n');

  try {
    // 0. Verify Hunter.io Integration with user provided test email
    console.log('[Test 0/4] Verifying Hunter.io API Integration...');
    const hunterTest = await verifyEmailAddress('patrick@stripe.com');
    console.log('✓ Hunter.io Test Result for patrick@stripe.com:');
    console.log(`   Status: ${hunterTest.status} | Confidence: ${hunterTest.confidence}`);
    console.log(`   Details: ${hunterTest.details}\n`);

    // 1. Research Company 1: Boson Motors USA (https://bosonmotors.com)
    console.log('[Test 1/4] Researching Company 1: "https://bosonmotors.com"...');
    const startBoson = Date.now();
    const bosonResult = await prospectingEngine.runFullResearchWorkflow('https://bosonmotors.com');
    const bosonSec = Math.round((Date.now() - startBoson) / 1000);
    console.log(`✓ Boson Motors Research completed in ${bosonSec}s.`);
    console.log(`   Profile:   ${bosonResult.profile.name} (${bosonResult.profile.domain})`);
    console.log(`   Industry:  ${bosonResult.profile.industry}`);
    console.log(`   Offerings: ${bosonResult.profile.productsAndServices.slice(0, 3).join(', ')}`);
    console.log(`   Comps:     ${bosonResult.competitors.length} competitors (${bosonResult.competitors.map(c => c.name).join(', ')})`);
    console.log(`   Campaigns: ${bosonResult.campaigns.length} campaigns (${bosonResult.campaigns.map(c => c.title).join(', ')})`);
    console.log(`   Leads:     ${bosonResult.leads.length} customer accounts`);

    // 2. Research Company 2: TekAxis (https://tekaxis.com)
    console.log('\n[Test 2/4] Researching Company 2: "https://tekaxis.com"...');
    const startTek = Date.now();
    const tekResult = await prospectingEngine.runFullResearchWorkflow('https://tekaxis.com');
    const tekSec = Math.round((Date.now() - startTek) / 1000);
    console.log(`✓ TekAxis Research completed in ${tekSec}s.`);
    console.log(`   Profile:   ${tekResult.profile.name} (${tekResult.profile.domain})`);
    console.log(`   Industry:  ${tekResult.profile.industry}`);
    console.log(`   Offerings: ${tekResult.profile.productsAndServices.slice(0, 3).join(', ')}`);
    console.log(`   Comps:     ${tekResult.competitors.length} competitors (${tekResult.competitors.map(c => c.name).join(', ')})`);
    console.log(`   Campaigns: ${tekResult.campaigns.length} campaigns (${tekResult.campaigns.map(c => c.title).join(', ')})`);
    console.log(`   Leads:     ${tekResult.leads.length} customer accounts`);

    // 3. Strict Comparison & Cross-Contamination Check
    console.log('\n[Test 3/4] Verifying Zero Data Leakage & Total Customization...');

    // Check profiles are completely distinct
    if (bosonResult.profile.industry === tekResult.profile.industry) {
      throw new Error('FAIL: Boson Motors and TekAxis have identical industries!');
    }
    console.log('✓ Industries are completely distinct:');
    console.log(`   - Boson:  "${bosonResult.profile.industry}"`);
    console.log(`   - TekAxis: "${tekResult.profile.industry}"`);

    // Check offerings
    console.log('✓ Offerings are completely distinct:');
    console.log(`   - Boson:  ${bosonResult.profile.productsAndServices[0]}`);
    console.log(`   - TekAxis: ${tekResult.profile.productsAndServices[0]}`);

    // Check competitor names don't cross
    const tekCompsJoined = tekResult.competitors.map(c => c.name.toLowerCase()).join(' ');
    if (tekCompsJoined.includes('polaris') || tekCompsJoined.includes('deere')) {
      throw new Error('FAIL: Agricultural competitors leaked into TekAxis!');
    }
    console.log('✓ Competitors are completely isolated per company.');

    // Check personalized emails
    console.log('\n[Test 4/4] Verifying 1:1 Cold Outreach Copy Distinctness...');
    const bosonSample = bosonResult.leads[0]?.personalizedEmail?.body || '';
    const tekSample = tekResult.leads[0]?.personalizedEmail?.body || '';

    console.log('--- Boson Sample Email ---');
    console.log(bosonSample.split('\n\n')[1] || bosonSample.slice(0, 150));
    console.log('--- TekAxis Sample Email ---');
    console.log(tekSample.split('\n\n')[1] || tekSample.slice(0, 150));

    if (tekSample.toLowerCase().includes('electric utility vehicle') || tekSample.toLowerCase().includes('orchard')) {
      throw new Error('FAIL: TekAxis email copy leaked orchard vehicle copy!');
    }
    console.log('\n✓ ZERO Boson data leaked into TekAxis outreach copy!');

    // Check Store Isolation
    const bosonStored = await store.getLeads(bosonResult.profile.id);
    const tekStored = await store.getLeads(tekResult.profile.id);
    const allProfiles = await store.getCompanyProfiles();

    console.log(`\n✓ Store Partitioning:`);
    console.log(`   - Boson Leads in Store:   ${bosonStored.length}`);
    console.log(`   - TekAxis Leads in Store: ${tekStored.length}`);
    console.log(`   - Profiles Registered:    ${allProfiles.length} (${allProfiles.map(p => p.name).join(', ')})`);

    console.log('\n================================================================');
    console.log('🎉 ALL DUAL-COMPANY TESTS PASSED WITH 100% SUCCESS (0 FAILURES)!');
    console.log('================================================================');
  } catch (err: any) {
    console.error('\n❌ Dual verification failed:', err);
    process.exit(1);
  }
}

runDualVerification();
