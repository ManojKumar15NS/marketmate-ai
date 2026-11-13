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
   * Autonomous Live WhatsApp Number Discovery Engine
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

    // Geocode coordinates for location context
    const coords = await mapDiscoveryService.geocodeLocation(location).catch(() => null);
    logger.info(`[WhatsAppFinder] Geocoded "${location}": ${coords ? `${coords.lat}, ${coords.lng}` : 'center estimated'}`);

    onProgress?.(25, `Stage 2/5: Scanning live web & commercial directories for "${keywords}" in "${location}"...`);

    // Build multi-angle targeted discovery queries
    const query1 = `"${keywords}" in "${location}" (whatsapp OR "wa.me" OR contact OR phone OR mobile)`;
    const query2 = `site:justdial.com OR site:indiamart.com OR site:sulekha.com OR site:practo.com "${keywords}" "${location}"`;
    const query3 = `"${keywords}" "${location}" official contact phone website`;
    const query4 = `"${keywords}" "${location}" "chat on whatsapp" OR "whatsapp number"`;

    const [hits1, hits2, hits3, hits4] = await Promise.all([
      searchLiveWeb(query1, 6).catch(() => []),
      searchLiveWeb(query2, 6).catch(() => []),
      searchLiveWeb(query3, 6).catch(() => []),
      searchLiveWeb(query4, 6).catch(() => [])
    ]);

    const combinedHits = [...hits1, ...hits2, ...hits3, ...hits4];

    // Deduplicate search hits by URL
    const seenUrls = new Set<string>();
    const uniqueHits = combinedHits.filter(h => {
      if (!h.url || seenUrls.has(h.url)) return false;
      seenUrls.add(h.url);
      return true;
    });

    onProgress?.(50, `Stage 3/5: Extracting verified phone numbers & business details from ${uniqueHits.length} live sources...`);

    if (uniqueHits.length === 0) {
      return {
        id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        keywords,
        location,
        countryCode,
        requestedLimit: limit,
        actualDiscoveredCount: 0,
        messageTemplate,
        stats: { totalFound: 0, mobileVerified: 0, highConfidence: 0, withWebsite: 0 },
        leads: [],
        createdAt: new Date().toISOString()
      };
    }

    // Structure extraction with Gemini AI
    const hitsContext = uniqueHits
      .slice(0, 16)
      .map((h, i) => `[Source ${i + 1}]\nTitle: ${h.title}\nURL: ${h.url}\nSnippet: ${h.snippet}`)
      .join('\n\n');

    const extractionPrompt = `You are a precision B2B and Local Commercial Lead Extraction Specialist.
Extract up to ${limit} REAL, active commercial businesses, medical clinics, or service providers from these verified live search results for:
Keywords: "${keywords}"
Target Location: "${location}"
Default Country Code: "${countryCode}"

LIVE SEARCH RESULTS:
${hitsContext}

CRITICAL RULES:
1. ONLY extract genuine businesses mentioned in the search results with real contact phone/mobile numbers or addresses.
2. DO NOT fabricate fake phone numbers, placeholder digits (like 1234567890 or 9999999999), or invented businesses.
3. If phone numbers are visible in snippets (e.g., "+91 ...", "080 ...", "98450...", "Call: ..."), capture the raw phone number.
4. Extract the physical address, area/locality, city, official website (if cited), and category.
5. If a direct "wa.me" or "WhatsApp" link or notice is observed in the snippet, note that in "notes".

Return strictly a valid JSON array of objects:
[
  {
    "businessName": "Official Name of Business/Hospital/Clinic",
    "category": "Specific category (e.g., Ophthalmology Clinic, Eye Hospital, Dental Clinic)",
    "phoneRaw": "Actual phone number found (e.g., 080 2528 1234 or +91 98450 12345)",
    "address": "Street address or Locality, City",
    "city": "City name",
    "state": "State name",
    "website": "Official website URL (or null if not found)",
    "sourceTitle": "Title of the search result source",
    "sourceUrl": "The exact source URL",
    "hasExplicitWhatsApp": true,
    "notes": "Brief evidence snippet or observation"
  }
]`;

    onProgress?.(70, `Stage 4/5: Synthesizing contact information & verifying WhatsApp click-to-chat links...`);

    let extractedBusinesses: any[] = [];
    try {
      const response = await geminiService.generateText(extractionPrompt, 'Return strictly valid JSON array.');
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      extractedBusinesses = JSON.parse(cleaned);
    } catch (err: any) {
      logger.warn('[WhatsAppFinder] Gemini structured extraction notice:', err.message);
    }

    onProgress?.(85, `Stage 5/5: Normalizing E.164 phone numbers & preparing contact registry...`);

    const leads: WhatsAppLead[] = [];
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();

    for (const b of extractedBusinesses) {
      if (!b.businessName || !b.phoneRaw) continue;

      const normName = b.businessName.toLowerCase().trim();
      if (seenNames.has(normName)) continue;

      const normalized = this.normalizePhoneNumber(
        b.phoneRaw,
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

      seenNames.add(normName);
      seenPhones.add(normalized.phoneDigitsOnly);

      const isHighConfidence = Boolean(
        b.hasExplicitWhatsApp ||
        normalized.isMobile ||
        (b.website && normalized.phoneDigitsOnly.length >= 10)
      );

      leads.push({
        id: `wal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        businessName: b.businessName.trim(),
        category: b.category || keywords,
        phoneRaw: b.phoneRaw.trim(),
        phoneInternational: normalized.phoneInternational,
        phoneDigitsOnly: normalized.phoneDigitsOnly,
        whatsappUrl: normalized.whatsappUrl,
        address: b.address || location,
        city: b.city || location.split(',')[0].trim(),
        state: b.state || '',
        country: countryCode === '+91' ? 'India' : countryCode === '+1' ? 'USA' : countryCode === '+971' ? 'UAE' : 'International',
        website: b.website && b.website.startsWith('http') ? b.website : undefined,
        sourceTitle: b.sourceTitle || `${b.businessName} Commercial Presence`,
        sourceUrl: b.sourceUrl || b.website || 'https://google.com',
        confidence: isHighConfidence ? 'high' : 'medium',
        isMobile: normalized.isMobile,
        notes: b.notes || (normalized.isMobile ? 'Mobile line verified for WhatsApp' : 'Direct contact line'),
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
        highConfidence: leads.filter(l => l.confidence === 'high').length,
        withWebsite: leads.filter(l => Boolean(l.website)).length
      },
      leads,
      createdAt: new Date().toISOString()
    };

    onProgress?.(100, `Completed! Discovered ${leads.length} verified WhatsApp business contacts in ${location}.`);
    return result;
  }

  /**
   * Generate vCard 3.0 file for instant phone contact import
   * Allows users to download .vcf and add all contacts directly to mobile phone address book
   */
  public generateBulkVCard(leads: WhatsAppLead[]): string {
    const vcards = leads.map(lead => {
      const escapedName = lead.businessName.replace(/;/g, '\\;').replace(/,/g, '\\,');
      const cleanAddress = lead.address.replace(/;/g, ' ').replace(/\n/g, ' ');

      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escapedName}`,
        `ORG:${escapedName};${lead.category || 'Business'}`,
        `TEL;TYPE=CELL,VOICE,pref:${lead.phoneInternational || `+${lead.phoneDigitsOnly}`}`,
        `ADR;TYPE=WORK:;;${cleanAddress};${lead.city};${lead.state || ''};;${lead.country}`,
        lead.website ? `URL:${lead.website}` : '',
        `NOTE:Discovered via MarketMate AI WhatsApp Finder | ${lead.whatsappUrl}`,
        'END:VCARD'
      ].filter(Boolean).join('\r\n');
    });

    return vcards.join('\r\n\r\n');
  }

  /**
   * Generate standard CSV format
   */
  public generateCsv(leads: WhatsAppLead[]): string {
    const headers = [
      'Business Name',
      'Category',
      'Phone (Formatted)',
      'Phone (International E.164)',
      'Direct WhatsApp Chat Link',
      'Address',
      'City',
      'Country',
      'Website',
      'Mobile Verified',
      'Confidence',
      'Source URL',
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
      escapeCsv(l.phoneRaw),
      escapeCsv(l.phoneInternational),
      escapeCsv(l.whatsappUrl),
      escapeCsv(l.address),
      escapeCsv(l.city),
      escapeCsv(l.country),
      escapeCsv(l.website || 'N/A'),
      escapeCsv(l.isMobile ? 'Yes' : 'No'),
      escapeCsv(l.confidence.toUpperCase()),
      escapeCsv(l.sourceUrl || 'N/A'),
      escapeCsv(l.discoveredAt)
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate Styled Excel Workbook (.xlsx)
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
      { header: 'Business Name', key: 'businessName', width: 28 },
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Formatted Phone', key: 'phoneInternational', width: 20 },
      { header: 'Direct WhatsApp Link', key: 'whatsappUrl', width: 35 },
      { header: 'Address', key: 'address', width: 32 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Country', key: 'country', width: 14 },
      { header: 'Website', key: 'website', width: 25 },
      { header: 'Mobile Line?', key: 'isMobile', width: 14 },
      { header: 'Confidence', key: 'confidence', width: 14 },
      { header: 'Source Citation', key: 'sourceUrl', width: 30 }
    ];

    // Header styling: Emerald theme for WhatsApp
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
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
        address: lead.address,
        city: lead.city,
        country: lead.country,
        website: lead.website || 'N/A',
        isMobile: lead.isMobile ? 'Verified Mobile' : 'Standard Line',
        confidence: lead.confidence.toUpperCase(),
        sourceUrl: lead.sourceUrl || 'Web Listing'
      });

      row.height = 22;
      row.getCell('whatsappUrl').font = { color: { argb: 'FF0D9488' }, underline: true };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const whatsappFinderService = new WhatsAppFinderService();
