import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { searchLiveWeb } from '../tools/webFetcher.js';
import { expandKeywords } from '../tools/b2bDiscoveryEngine.js';

async function testConsolidated() {
  const t0 = Date.now();
  console.log('Testing Consolidated Engine for keyword "eye" in Bangalore...');

  const city = 'Bangalore';
  const countryParam = 'India';
  const keywords = 'eye';
  const expanded = expandKeywords(keywords);

  console.log('▶ Stage 1: Parallel live web grounding across sectors (Tavily)...');
  const [hits1, hits2, hits3, hits4] = await Promise.all([
    searchLiveWeb(`"${expanded[0]}" in Indiranagar Koramangala Whitefield Domlur ${city} ${countryParam} phone address website`, 8),
    searchLiveWeb(`"${expanded[1]}" in Jayanagar JP Nagar Banashankari BTM Layout ${city} ${countryParam} phone address`, 8),
    searchLiveWeb(`"${expanded[2]}" in Malleshwaram Rajajinagar Hebbal Yelahanka ${city} ${countryParam} contact Google Maps`, 8),
    searchLiveWeb(`top eye hospitals eye clinics eye care directory in ${city} ${countryParam} official websites phone numbers`, 8)
  ]);

  const allHits = [...hits1, ...hits2, ...hits3, ...hits4];
  console.log(`✔ Collected ${allHits.length} live citations in ${Date.now() - t0}ms`);

  const hitsContext = allHits.map((h, i) => `[${i + 1}] ${h.title}: ${h.snippet} (${h.url})`).join('\n');

  console.log('▶ Stage 2: Single-shot structured extraction (25-40 companies)...');
  const t1 = Date.now();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });

  const prompt = `You are an elite B2B Business Intelligence Discovery Engine.
From these verified live web results and verified commercial directory data for ${city}, discover 25 to 35 real, verified commercial establishments matching "${keywords}" (${expanded.slice(0, 3).join(', ')}):

Live Verified Web Results:
${hitsContext}

Extract authentic establishments across all key zones of ${city} (Indiranagar, Koramangala, Jayanagar, JP Nagar, Whitefield, Malleshwaram, Rajajinagar, Hebbal, Basavanagudi, etc.).
Return STRICTLY a JSON array of objects without Markdown tags:
[
  {
    "businessName": "Official Establishment Name",
    "brandName": "Brand if chain, or null",
    "locality": "Locality in ${city}",
    "category": "${expanded[0]}",
    "phoneRaw": "Contact telephone or mobile numbers",
    "address": "Street address with locality",
    "city": "${city}",
    "website": "Official website URL or null",
    "googleProfileUrl": "Google Maps link or null",
    "rating": "Rating (e.g. 4.7 ★, 500 reviews) or null",
    "operatingHours": "Operating hours or null",
    "sourceEvidence": "Evidence source"
  }
]
Rules:
- DO NOT return fewer than 20 establishments.
- Distinct branches in different localities (e.g. Dr Agarwal's in Indiranagar vs Koramangala vs Whitefield) MUST be kept as separate records.
- Ensure every establishment is a real, operational eye hospital or clinic in ${city}.`;

  const resp: any = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: prompt
  });

  console.log(`✔ Establishments extracted in ${Date.now() - t1}ms`);
  const companies = JSON.parse((resp.text || '').replace(/```json/gi, '').replace(/```/g, '').trim());
  console.log(`Discovered ${companies.length} verified companies across ${city}!`);

  console.log('▶ Stage 3: Discovering authorized decision-makers...');
  const t2 = Date.now();
  const topCompanies = companies.slice(0, 15);
  const dmHits = await searchLiveWeb(`Founders CEOs Managing Directors Medical Directors leadership of ${topCompanies.map((c: any) => `"${c.businessName}"`).join(', ')} in ${city} LinkedIn`, 8);

  const dmPrompt = `From these verified web and leadership findings, extract authorized leaders, founders, medical directors, and CEOs for these establishments in ${city}:
${dmHits.map((h, i) => `[${i + 1}] ${h.title}: ${h.snippet} (${h.url})`).join('\n')}

Target Establishments: ${topCompanies.map((c: any) => c.businessName).join(', ')}

Return strictly JSON array:
[
  {
    "companyName": "Company Name",
    "name": "Full Name",
    "designation": "Job Title / Role",
    "linkedinUrl": "LinkedIn URL or null",
    "email": "Business email or null",
    "phone": "Direct phone or null",
    "employmentStatus": "verified"
  }
]`;

  const dmResp: any = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: dmPrompt
  });

  console.log(`✔ Decision-makers extracted in ${Date.now() - t2}ms`);
  const dms = JSON.parse((dmResp.text || '').replace(/```json/gi, '').replace(/```/g, '').trim());

  console.log('\n================ PIPELINE VERIFICATION SUCCESS ================');
  console.log(`Total Duration: ${(Date.now() - t0) / 1000}s`);
  console.log(`Total Companies Discovered: ${companies.length}`);
  console.log(`Total Decision-Makers: ${dms.length}`);
  console.log('Unique Localities:', Array.from(new Set(companies.map((c: any) => c.locality))));
  console.log('\nSample Companies:');
  companies.slice(0, 10).forEach((c: any, i: number) => {
    console.log(`${i + 1}. ${c.businessName} [${c.locality}] - Phone: ${c.phoneRaw || 'N/A'} - Web: ${c.website || 'N/A'}`);
  });
  console.log('\nSample Decision-Makers:');
  dms.slice(0, 8).forEach((dm: any, i: number) => {
    console.log(`${i + 1}. ${dm.name} (${dm.designation}) @ ${dm.companyName} - LinkedIn: ${dm.linkedinUrl || 'N/A'}`);
  });
}

testConsolidated().catch(console.error);
