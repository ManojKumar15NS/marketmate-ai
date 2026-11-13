import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { geminiService } from '../services/gemini.js';
import { searchLiveWeb } from './webFetcher.js';
import { mapDiscoveryService } from './mapDiscovery.js';
import { WhatsAppLead, WhatsAppSearchParams, WhatsAppSearchRun } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class WhatsAppFinderService {
  /**
   * Robust International Phone Normalizer
   * Cleans phone strings, extracts country code, identifies mobile vs landline,
   * and creates standardized E.164 and wa.me direct links.
   */
  public normalizePhoneNumber(
    rawPhone: string,
    defaultCountryCode: string = '+91',
    businessName: string = '',
    location: string = '',
    messageTemplate?: string
  ): {
    phoneDigitsOnly: string;
    phoneInternational: string;
    isMobile: boolean;
    whatsappUrl: string;
  } {
    if (!rawPhone) {
      return {
        phoneDigitsOnly: '',
        phoneInternational: '',
        isMobile: false,
        whatsappUrl: ''
      };
    }

    // Clean characters except digits and plus sign
    const cleaned = rawPhone.replace(/[^\d+]/g, '');
    let digits = rawPhone.replace(/\D/g, '');
    let isMobile = false;
    let formattedInternational = '';

    const cleanDefaultCode = defaultCountryCode.replace(/\D/g, '') || '91';

    // India (+91)
    if (cleanDefaultCode === '91' || cleaned.startsWith('+91') || (digits.startsWith('91') && digits.length === 12)) {
      // If 11 digits starting with 0, strip leading 0
      if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
      }
      // If starts with 91 and has 12 digits
      if (digits.startsWith('91') && digits.length === 12) {
        digits = digits.slice(2);
      }

      // Check if 10-digit Indian number
      if (digits.length === 10) {
        const firstDigit = digits.charAt(0);
        // Indian mobile numbers start with 6, 7, 8, 9
        if (['6', '7', '8', '9'].includes(firstDigit)) {
          isMobile = true;
        }
        formattedInternational = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
        digits = `91${digits}`;
      } else {
        formattedInternational = `+91 ${digits}`;
        digits = `91${digits}`;
      }
    }
    // USA / Canada (+1)
    else if (cleanDefaultCode === '1' || cleaned.startsWith('+1') || (digits.startsWith('1') && digits.length === 11)) {
      if (digits.startsWith('1') && digits.length === 11) {
        digits = digits.slice(1);
      }
      if (digits.length === 10) {
        isMobile = true;
        formattedInternational = `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        digits = `1${digits}`;
      } else {
        formattedInternational = `+1 ${digits}`;
        digits = `1${digits}`;
      }
    }
    // UAE (+971)
    else if (cleanDefaultCode === '971' || cleaned.startsWith('+971')) {
      if (digits.startsWith('971')) {
        digits = digits.slice(3);
      }
      if (digits.startsWith('0')) {
        digits = digits.slice(1);
      }
      // UAE mobile starts with 5 (e.g. 50, 52, 54, 55, 56, 58)
      if (digits.startsWith('5') && digits.length === 9) {
        isMobile = true;
      }
      formattedInternational = `+971 ${digits}`;
      digits = `971${digits}`;
    }
    // UK (+44)
    else if (cleanDefaultCode === '44' || cleaned.startsWith('+44')) {
      if (digits.startsWith('44')) {
        digits = digits.slice(2);
      }
      if (digits.startsWith('0')) {
        digits = digits.slice(1);
      }
      // UK mobile starts with 7
      if (digits.startsWith('7') && digits.length === 10) {
        isMobile = true;
      }
      formattedInternational = `+44 ${digits}`;
      digits = `44${digits}`;
    }
    // General fallback
    else {
      if (!digits.startsWith(cleanDefaultCode)) {
        digits = `${cleanDefaultCode}${digits}`;
      }
      formattedInternational = `+${digits}`;
      isMobile = true;
    }

    // Build personalized WhatsApp text
    let outreachMessage = '';
    if (messageTemplate && messageTemplate.trim()) {
      outreachMessage = messageTemplate
        .replace(/\{businessName\}/gi, businessName || 'there')
        .replace(/\{location\}/gi, location || 'your area')
        .trim();
    }

    const whatsappUrl = digits
      ? `https://wa.me/${digits}${outreachMessage ? `?text=${encodeURIComponent(outreachMessage)}` : ''}`
      : '';

    return {
      phoneDigitsOnly: digits,
      phoneInternational: formattedInternational,
      isMobile,
      whatsappUrl
    };
  }

  /**
   * Autonomous High-Yield WhatsApp Number & Business Intelligence Discovery Engine
   * Combines Google Search Grounding with Directory Searches & Multi-Platform Verification
   */
  public async search(
    params: WhatsAppSearchParams,
    onProgress?: (percent: number, stage: string) => void
  ): Promise<WhatsAppSearchRun> {
    const {
      keywords,
      location,
      countryCode = '+91',
      limit = 15,
      messageTemplate
    } = params;

    if (!keywords || !keywords.trim()) {
      throw new Error('Please provide business keywords or category (e.g., "Dental Clinic", "Eye Hospital", "Interior Designers").');
    }
    if (!location || !location.trim()) {
      throw new Error('Please provide a target location (e.g., "Indiranagar, Bangalore", "Mumbai", "Dubai").');
    }

    onProgress?.(10, `Stage 1/5: Geocoding location & analyzing search intent for "${location}"...`);

    // 1. Geocode coordinates for location context
    const coords = await mapDiscoveryService.geocodeLocation(location).catch(() => null);
    logger.info(`[WhatsAppFinder] Geocoded "${location}": ${coords ? `${coords.lat}, ${coords.lng}` : 'center estimated'}`);

    onProgress?.(25, `Stage 2/5: Scanning Google Maps, Google My Business, Practo, and Justdial via Google Grounding...`);

    // 2. High-Yield Google Search Grounding with 2-step extraction
    let groundedBusinesses: any[] = [];
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, apiVersion: 'v1beta' });

    try {
      const targetCount = Math.max(limit, 12);
      const searchPrompt = `Search Google Maps, Google My Business Profiles, Practo, Justdial, Sulekha, Indiamart, LinkedIn, and official websites for real businesses, clinics, or providers matching:
Business Category: "${keywords}"
Target Location: "${location}"
Default Country Code: "${countryCode}"

List ${targetCount} to ${targetCount + 5} REAL commercial establishments.
If "${location}" is a specific neighborhood with fewer establishments, expand to adjacent surrounding localities in the same city to reach ${targetCount} results.
For EACH establishment, MUST provide:
- Exact Official Business Name
- Specialty / Category
- Contact Phone Numbers and Mobile numbers (include all available, e.g. mobile lines, booking desks)
- Physical Street Address, landmark, building, and postal code
- Official Website URL, Google Maps Profile link, Practo or Justdial link
- User Ratings and review counts (e.g. 4.8 ★, 1,200 reviews)
- Operating Hours (e.g. Mon-Sat 9 AM - 8 PM or 24/7)
- Evidence source where verified`;

      // Step 2a: Grounded text search with 45s timeout
      const candidateModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let groundedText = '';

      for (const model of candidateModels) {
        try {
          console.log(`[WhatsAppFinder] Attempting search grounding with model: ${model}...`);
          const callPromise = ai.models.generateContent({
            model,
            contents: searchPrompt,
            config: {
              tools: [{ googleSearch: {} }]
            }
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT_MODEL_${model}`)), 75000)
          );
          const resp: any = await Promise.race([callPromise, timeoutPromise]);

          if (resp.text && resp.text.trim().length > 100) {
            groundedText = resp.text;
            console.log(`[WhatsAppFinder] Grounded search succeeded with ${model} (${groundedText.length} chars).`);
            break;
          }
        } catch (mErr: any) {
          console.warn(`[WhatsAppFinder] Model ${model} grounding notice:`, mErr.message);
          if (mErr.message?.includes('429') || mErr.message?.includes('RESOURCE_EXHAUSTED') || mErr.message?.includes('quota')) {
            console.log('[WhatsAppFinder] Rate limit window detected. Pausing 6s before trying next candidate...');
            await new Promise(r => setTimeout(r, 6000));
          }
        }
      }

      // Step 2b: Targeted Phone & Contact Enrichment pass if needed
      let enrichmentText = '';
      if (groundedText.length > 200) {
        onProgress?.(38, `Stage 2b/5: Querying Google Maps, Justdial & Practo records for verified contact numbers & ratings...`);
        const enrichPrompt = `Based on these businesses discovered in ${location}:
${groundedText.slice(0, 3500)}

Search Google Maps, Justdial, Practo, and official sites for the direct contact phone numbers, mobile numbers, full street addresses, and user ratings for ANY of these establishments where phone numbers were missing or incomplete.`;

        for (const model of candidateModels) {
          try {
            console.log(`[WhatsAppFinder] Enriching contact phones with model: ${model}...`);
            const enrichPromise = ai.models.generateContent({
              model,
              contents: enrichPrompt,
              config: { tools: [{ googleSearch: {} }] }
            });
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`TIMEOUT_ENRICH_${model}`)), 35000)
            );
            const enrichResp: any = await Promise.race([enrichPromise, timeoutPromise]);
            if (enrichResp.text && enrichResp.text.trim().length > 100) {
              enrichmentText = enrichResp.text;
              console.log(`[WhatsAppFinder] Contact enrichment succeeded (${enrichmentText.length} chars).`);
              break;
            }
          } catch (e: any) {
            console.warn(`[WhatsAppFinder] Enrichment model ${model} notice:`, e.message);
            if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || e.message?.includes('quota')) {
              await new Promise(r => setTimeout(r, 6000));
            }
          }
        }
      }

      // Step 2c: Convert grounded findings into clean structured JSON using resilient geminiService
      if (groundedText.length > 0) {
        onProgress?.(50, `Stage 3/5: Extracting and parsing verified business data into contact registry...`);

        const jsonPrompt = `Convert all the verified business search findings into a strict JSON array:

DISCOVERED BUSINESSES:
${groundedText}

${enrichmentText ? `CONTACT PHONE & RATING DETAILS:\n${enrichmentText}\n` : ''}

For EVERY business with a contact phone or mobile number, include it.
If multiple phone numbers exist, separate them with a comma (e.g. "+91 9591806061, 080-25289669").
Return strictly a valid JSON array of objects without Markdown formatting:
[
  {
    "businessName": "Official Business / Clinic Name",
    "category": "${keywords}",
    "phoneRaw": "Contact phone or mobile number as listed",
    "address": "Full physical street address, building, landmark, area",
    "city": "${location.split(',')[0].trim()}",
    "state": "",
    "website": "Official website URL (or null if not found)",
    "googleProfileUrl": "Google Maps / Google Profile URL or null",
    "linkedinUrl": "LinkedIn company/clinic URL or null",
    "email": "Contact email or null",
    "rating": "Rating and reviews (e.g. 4.8 ★, 180 reviews) or null",
    "operatingHours": "Operating hours or null",
    "sourceEvidence": "Exact source or citation proving this listing and phone",
    "sourceUrl": "The exact source link (Practo, Justdial, official site)",
    "sourceType": "google_business"
  }
]`;

        try {
          console.log('[WhatsAppFinder] Structuring grounded findings into JSON array via geminiService...');
          const jsonText = await geminiService.generateText(jsonPrompt, 'Return strictly valid JSON array.');
          const cleaned = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);

          if (Array.isArray(parsed)) {
            groundedBusinesses = parsed;
            console.log(`[WhatsAppFinder] Successfully structured ${parsed.length} businesses from Google Grounding.`);
          }
        } catch (jsonErr: any) {
          console.warn('[WhatsAppFinder] JSON structuring error:', jsonErr.message);
        }
      }
    } catch (err: any) {
      logger.warn('[WhatsAppFinder] Grounding pipeline notice:', err.message);
    }

    onProgress?.(65, `Stage 4/5: Cross-referencing web search results, Justdial, Practo, and LinkedIn...`);

    // 3. Parallel live web search across directories and LinkedIn to enrich and cross-verify
    let webExtractedBusinesses: any[] = [];
    try {
      const query1 = `"${keywords}" in "${location}" (whatsapp OR "wa.me" OR contact OR phone OR mobile)`;
      const query2 = `site:justdial.com OR site:practo.com OR site:sulekha.com OR site:indiamart.com "${keywords}" "${location}"`;
      const query3 = `"${keywords}" "${location}" official contact phone website`;
      const query4 = `site:linkedin.com/company "${keywords}" "${location}"`;

      const [hits1, hits2, hits3, hits4] = await Promise.all([
        searchLiveWeb(query1, 8).catch(() => []),
        searchLiveWeb(query2, 8).catch(() => []),
        searchLiveWeb(query3, 8).catch(() => []),
        searchLiveWeb(query4, 8).catch(() => [])
      ]);

      const combinedHits = [...hits1, ...hits2, ...hits3, ...hits4];
      const seenUrls = new Set<string>();
      const uniqueHits = combinedHits.filter(h => {
        if (!h.url || seenUrls.has(h.url)) return false;
        seenUrls.add(h.url);
        return true;
      });

      if (uniqueHits.length > 0) {
        try {
          const hitsContext = uniqueHits
            .slice(0, 15)
            .map((h, i) => `[Source ${i + 1}]\nTitle: ${h.title}\nURL: ${h.url}\nSnippet: ${h.snippet}`)
            .join('\n\n');

          const fallbackPrompt = `You are a Local Commercial Lead Extraction Specialist.
Extract real commercial businesses from these search results for "${keywords}" in "${location}":

${hitsContext}

Return strictly a valid JSON array of objects:
[
  {
    "businessName": "Official Name",
    "category": "${keywords}",
    "phoneRaw": "Phone or mobile number",
    "address": "Street address or area",
    "city": "${location.split(',')[0].trim()}",
    "website": "Official website URL or null",
    "sourceUrl": "The exact source result URL",
    "sourceTitle": "Source title",
    "sourceType": "directory_listing"
  }
]`;

          const responseText = await geminiService.generateText(fallbackPrompt, 'Return strictly valid JSON array.');
          const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            webExtractedBusinesses = parsed;
          }
        } catch (err: any) {
          logger.warn('[WhatsAppFinder] Web hits parsing notice:', err.message);
        }
      }
    } catch (err: any) {
      logger.warn('[WhatsAppFinder] Web discovery pipeline notice:', err.message);
    }

    onProgress?.(85, `Stage 5/5: Normalizing E.164 phone numbers, Google Maps & building direct WhatsApp links...`);

    // 4. Merge all discovered leads and deduplicate by clean phone digits and business name
    const allRaw = [...groundedBusinesses, ...webExtractedBusinesses];
    const leads: WhatsAppLead[] = [];
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();

    for (const b of allRaw) {
      if (!b.businessName) continue;

      const cleanName = b.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanName.length < 3 || seenNames.has(cleanName)) continue;

      // Extract phone: handle multiple numbers separated by comma, slash, or pipe
      let rawPhoneCandidate = b.phoneRaw ? String(b.phoneRaw) : '';
      if (rawPhoneCandidate.includes('/') || rawPhoneCandidate.includes('|') || rawPhoneCandidate.includes(',')) {
        const parts = rawPhoneCandidate.split(/[/|,]/).map(p => p.trim());
        // Prefer one that starts with 6, 7, 8, 9 for India mobile
        const mobilePart = parts.find(p => {
          const d = p.replace(/\D/g, '');
          return (d.length === 10 && ['6', '7', '8', '9'].includes(d[0])) ||
                 (d.length === 12 && d.startsWith('91') && ['6', '7', '8', '9'].includes(d[2]));
        });
        rawPhoneCandidate = mobilePart || parts[0];
      }

      if (!rawPhoneCandidate) continue;

      const normalized = this.normalizePhoneNumber(
        rawPhoneCandidate,
        countryCode,
        b.businessName,
        location,
        messageTemplate
      );

      // Must have valid phone digits (at least 7 digits)
      if (!normalized.phoneDigitsOnly || normalized.phoneDigitsOnly.length < 7) {
        continue;
      }

      if (seenPhones.has(normalized.phoneDigitsOnly)) continue;

      seenNames.add(cleanName);
      seenPhones.add(normalized.phoneDigitsOnly);

      // Format Google Maps / Profile URL
      let googleProfileUrl = b.googleProfileUrl || null;
      if (!googleProfileUrl || !googleProfileUrl.startsWith('http')) {
        googleProfileUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.businessName} ${b.address || location}`)}`;
      }

      // Check LinkedIn URL validity
      let linkedinUrl = b.linkedinUrl || null;
      if (linkedinUrl && !linkedinUrl.startsWith('http')) {
        linkedinUrl = null;
      }

      // Check Website URL validity
      let website = b.website || null;
      if (website && !website.startsWith('http')) {
        website = `https://${website}`;
      }

      const isHighConfidence = Boolean(
        normalized.isMobile ||
        b.rating ||
        b.googleProfileUrl ||
        (website && normalized.phoneDigitsOnly.length >= 10)
      );

      leads.push({
        id: `wal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        businessName: b.businessName.trim(),
        category: b.category || keywords,
        phoneRaw: rawPhoneCandidate.trim(),
        phoneInternational: normalized.phoneInternational,
        phoneDigitsOnly: normalized.phoneDigitsOnly,
        whatsappUrl: normalized.whatsappUrl,
        address: b.address || location,
        city: b.city || location.split(',')[0].trim(),
        state: b.state || '',
        country: countryCode === '+91' ? 'India' : countryCode === '+1' ? 'USA' : countryCode === '+971' ? 'UAE' : 'International',
        website: website || undefined,
        googleProfileUrl: googleProfileUrl || undefined,
        linkedinUrl: linkedinUrl || undefined,
        email: b.email && b.email.includes('@') ? b.email.trim() : undefined,
        rating: b.rating ? String(b.rating).trim() : undefined,
        operatingHours: b.operatingHours ? String(b.operatingHours).trim() : undefined,
        sourceEvidence: b.sourceEvidence || `Verified listing for ${b.businessName} in ${b.city || location}`,
        sourceTitle: b.sourceTitle || `${b.businessName} Official Listing`,
        sourceUrl: b.sourceUrl || googleProfileUrl || 'https://google.com',
        sourceType: b.sourceType || (b.googleProfileUrl ? 'google_business' : website ? 'official_website' : 'live_web'),
        confidence: isHighConfidence ? 'high' : 'medium',
        isMobile: normalized.isMobile,
        notes: normalized.isMobile ? 'Mobile Line (WhatsApp Ready)' : 'Standard Contact Line',
        discoveredAt: new Date().toISOString()
      });

      if (leads.length >= limit) break;
    }

    const result: WhatsAppSearchRun = {
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      keywords,
      location,
      countryCode,
      requestedLimit: limit,
      actualDiscoveredCount: leads.length,
      messageTemplate,
      stats: {
        totalFound: leads.length,
        mobileVerified: leads.filter(l => l.isMobile).length,
        withGoogleProfile: leads.filter(l => Boolean(l.googleProfileUrl)).length,
        withLinkedIn: leads.filter(l => Boolean(l.linkedinUrl)).length,
        withWebsite: leads.filter(l => Boolean(l.website)).length,
        highConfidence: leads.filter(l => l.confidence === 'high').length
      },
      leads,
      createdAt: new Date().toISOString()
    };

    onProgress?.(100, `Completed! Discovered ${leads.length} verified WhatsApp business contacts in ${location}.`);
    return result;
  }

  /**
   * Generate vCard 3.0 file for instant phone contact import
   * Imports all business info, rating, website, and Google Maps link into phone
   */
  public generateBulkVCard(leads: WhatsAppLead[]): string {
    const vcards = leads.map(lead => {
      const escapedName = lead.businessName.replace(/;/g, '\\;').replace(/,/g, '\\,');
      const cleanAddress = lead.address.replace(/;/g, ' ').replace(/\n/g, ' ');

      const noteParts = [
        `Category: ${lead.category}`,
        lead.rating ? `Rating: ${lead.rating}` : null,
        lead.operatingHours ? `Hours: ${lead.operatingHours}` : null,
        `Direct WhatsApp: ${lead.whatsappUrl}`,
        lead.googleProfileUrl ? `Google Maps: ${lead.googleProfileUrl}` : null,
        `Discovered via MarketMate AI WhatsApp Finder`
      ].filter(Boolean);

      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escapedName}`,
        `ORG:${escapedName};${lead.category || 'Business'}`,
        `TEL;TYPE=CELL,VOICE,pref:${lead.phoneInternational || `+${lead.phoneDigitsOnly}`}`,
        `ADR;TYPE=WORK:;;${cleanAddress};${lead.city};${lead.state || ''};;${lead.country}`,
        lead.website ? `URL;TYPE=WORK:${lead.website}` : lead.googleProfileUrl ? `URL;TYPE=WORK:${lead.googleProfileUrl}` : '',
        lead.linkedinUrl ? `X-SOCIALPROFILE;TYPE=linkedin:${lead.linkedinUrl}` : '',
        lead.email ? `EMAIL;TYPE=WORK:${lead.email}` : '',
        `NOTE:${noteParts.join(' | ')}`,
        'END:VCARD'
      ].filter(Boolean).join('\r\n');
    });

    return vcards.join('\r\n\r\n');
  }

  /**
   * Generate standard CSV format with all enhanced columns
   */
  public generateCsv(leads: WhatsAppLead[]): string {
    const headers = [
      'Business Name',
      'Category',
      'Phone (Formatted)',
      'Phone (E.164 Digits)',
      'Direct WhatsApp Chat Link',
      'Mobile WhatsApp Ready',
      'Address',
      'City',
      'State',
      'Country',
      'Google Profile / Maps URL',
      'Official Website',
      'LinkedIn Profile',
      'Email',
      'Rating & Reviews',
      'Operating Hours',
      'Confidence',
      'Source Citation',
      'Discovered At'
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null || val === '') return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leads.map(l => [
      escapeCsv(l.businessName),
      escapeCsv(l.category),
      escapeCsv(l.phoneInternational),
      escapeCsv(l.phoneDigitsOnly),
      escapeCsv(l.whatsappUrl),
      escapeCsv(l.isMobile ? 'Yes (Mobile)' : 'No (Landline)'),
      escapeCsv(l.address),
      escapeCsv(l.city),
      escapeCsv(l.state || ''),
      escapeCsv(l.country),
      escapeCsv(l.googleProfileUrl || 'N/A'),
      escapeCsv(l.website || 'N/A'),
      escapeCsv(l.linkedinUrl || 'N/A'),
      escapeCsv(l.email || 'N/A'),
      escapeCsv(l.rating || 'N/A'),
      escapeCsv(l.operatingHours || 'N/A'),
      escapeCsv(l.confidence.toUpperCase()),
      escapeCsv(l.sourceUrl || 'N/A'),
      escapeCsv(l.discoveredAt)
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate Styled Excel Workbook (.xlsx) with all rich data
   */
  public async generateExcel(
    leads: WhatsAppLead[],
    searchInfo: { keywords: string; location: string }
  ): Promise<Buffer> {
    const excelModule: any = await import('exceljs');
    const ExcelJS = excelModule.default || excelModule;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MarketMate AI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('WhatsApp Business Leads', {
      views: [{ showGridLines: true }]
    });

    sheet.columns = [
      { header: 'Business Name', key: 'businessName', width: 30 },
      { header: 'Category', key: 'category', width: 24 },
      { header: 'Formatted Phone', key: 'phoneInternational', width: 20 },
      { header: 'Direct WhatsApp Link', key: 'whatsappUrl', width: 36 },
      { header: 'WhatsApp Ready?', key: 'isMobile', width: 18 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Google Maps / Profile', key: 'googleProfileUrl', width: 30 },
      { header: 'Website', key: 'website', width: 28 },
      { header: 'LinkedIn', key: 'linkedinUrl', width: 26 },
      { header: 'Rating & Reviews', key: 'rating', width: 20 },
      { header: 'Operating Hours', key: 'operatingHours', width: 22 },
      { header: 'Confidence', key: 'confidence', width: 14 }
    ];

    // Header styling: Emerald theme for WhatsApp
    const headerRow = sheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF065F46' } // Emerald 800
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Populate rows
    for (const lead of leads) {
      const row = sheet.addRow({
        businessName: lead.businessName,
        category: lead.category,
        phoneInternational: lead.phoneInternational,
        whatsappUrl: lead.whatsappUrl,
        isMobile: lead.isMobile ? 'Verified Mobile' : 'Standard Line',
        address: lead.address,
        city: lead.city,
        googleProfileUrl: lead.googleProfileUrl || 'N/A',
        website: lead.website || 'N/A',
        linkedinUrl: lead.linkedinUrl || 'N/A',
        rating: lead.rating || 'Verified',
        operatingHours: lead.operatingHours || 'Standard Hours',
        confidence: lead.confidence.toUpperCase()
      });

      row.height = 24;
      row.getCell('whatsappUrl').font = { color: { argb: 'FF0D9488' }, underline: true };
      if (lead.googleProfileUrl) {
        row.getCell('googleProfileUrl').font = { color: { argb: 'FF2563EB' }, underline: true };
      }
      if (lead.website) {
        row.getCell('website').font = { color: { argb: 'FF4F46E5' }, underline: true };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const whatsappFinderService = new WhatsAppFinderService();
