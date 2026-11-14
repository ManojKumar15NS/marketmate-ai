import ExcelJS from 'exceljs';
import { WhatsAppLead, B2BDecisionMaker, CompanyLead, ContactPhone } from '../types/index.js';

export class B2BExportService {
  /**
   * Multi-Sheet Styled Excel Workbook (.xlsx)
   */
  public async generateExcel(leads: WhatsAppLead[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MarketMate AI B2B Intelligence';
    workbook.created = new Date();

    // =========================================================================
    // SHEET 1: Companies & Branches
    // =========================================================================
    const sheetCompanies = workbook.addWorksheet('Companies & Branches', {
      views: [{ showGridLines: true }]
    });

    sheetCompanies.columns = [
      { header: 'Business / Clinic Name', key: 'businessName', width: 32 },
      { header: 'Parent Brand', key: 'brandName', width: 24 },
      { header: 'Branch / Locality', key: 'locality', width: 22 },
      { header: 'Category / Specialty', key: 'category', width: 25 },
      { header: 'Primary Phone', key: 'phone', width: 20 },
      { header: 'Direct WhatsApp Link', key: 'whatsappUrl', width: 35 },
      { header: 'Mobile / WhatsApp Ready?', key: 'isMobile', width: 20 },
      { header: 'Decision-Makers Found', key: 'dmCount', width: 22 },
      { header: 'Lead Score (0-100)', key: 'totalScore', width: 18 },
      { header: 'Address', key: 'address', width: 35 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Rating & Reviews', key: 'rating', width: 20 },
      { header: 'Google Maps Link', key: 'googleProfileUrl', width: 32 },
      { header: 'Website', key: 'website', width: 28 },
      { header: 'Confidence', key: 'confidence', width: 14 }
    ];

    // Style Header Row (Emerald theme)
    this.styleHeaderRow(sheetCompanies.getRow(1), 'FF065F46');

    for (const lead of leads) {
      const row = sheetCompanies.addRow({
        businessName: lead.businessName,
        brandName: lead.brandName || lead.businessName,
        locality: lead.locality || lead.city,
        category: lead.category,
        phone: lead.phoneInternational || lead.phoneRaw,
        whatsappUrl: lead.whatsappUrl || 'N/A',
        isMobile: lead.isMobile ? 'Yes (Mobile Line)' : 'Standard Line',
        dmCount: lead.decisionMakers ? lead.decisionMakers.length : 0,
        totalScore: lead.scores?.totalScore || 75,
        address: lead.address,
        city: lead.city,
        rating: lead.rating || 'Verified',
        googleProfileUrl: lead.googleProfileUrl || 'N/A',
        website: lead.website || 'N/A',
        confidence: lead.confidence.toUpperCase()
      });
      row.height = 22;
      if (lead.whatsappUrl) {
        row.getCell('whatsappUrl').font = { color: { argb: 'FF0D9488' }, underline: true };
      }
      if (lead.googleProfileUrl) {
        row.getCell('googleProfileUrl').font = { color: { argb: 'FF2563EB' }, underline: true };
      }
    }

    // =========================================================================
    // SHEET 2: Decision-Makers & Leaders
    // =========================================================================
    const sheetDms = workbook.addWorksheet('Authorized Decision-Makers', {
      views: [{ showGridLines: true }]
    });

    sheetDms.columns = [
      { header: 'Decision-Maker Name', key: 'name', width: 26 },
      { header: 'Designation / Title', key: 'designation', width: 30 },
      { header: 'Role Category', key: 'roleCategory', width: 18 },
      { header: 'Company Name', key: 'companyName', width: 30 },
      { header: 'Branch / Locality', key: 'branchLocation', width: 20 },
      { header: 'LinkedIn Profile', key: 'linkedinUrl', width: 32 },
      { header: 'Public Business Email', key: 'email', width: 28 },
      { header: 'Direct Phone / Mobile', key: 'phone', width: 22 },
      { header: 'Employment Status', key: 'employmentStatus', width: 20 },
      { header: 'Confidence Score', key: 'confidenceScore', width: 18 },
      { header: 'Source Evidence', key: 'sourceEvidence', width: 35 }
    ];

    this.styleHeaderRow(sheetDms.getRow(1), 'FF1E3A8A'); // Indigo / Navy theme

    let totalDmsAdded = 0;
    for (const lead of leads) {
      if (lead.decisionMakers && lead.decisionMakers.length > 0) {
        for (const dm of lead.decisionMakers) {
          const row = sheetDms.addRow({
            name: dm.name,
            designation: dm.designation,
            roleCategory: dm.roleCategory.toUpperCase(),
            companyName: dm.companyName || lead.businessName,
            branchLocation: dm.branchLocation || lead.locality || lead.city,
            linkedinUrl: dm.linkedinUrl || 'N/A',
            email: dm.email || 'N/A',
            phone: dm.phone || lead.phoneInternational,
            employmentStatus: dm.employmentStatus.toUpperCase(),
            confidenceScore: `${dm.confidenceScore}%`,
            sourceEvidence: dm.sourceEvidence
          });
          row.height = 22;
          if (dm.linkedinUrl) {
            row.getCell('linkedinUrl').font = { color: { argb: 'FF2563EB' }, underline: true };
          }
          totalDmsAdded++;
        }
      }
    }

    // =========================================================================
    // SHEET 3: CRM Ready Export (HubSpot & Salesforce Mapping)
    // =========================================================================
    const sheetCrm = workbook.addWorksheet('CRM Import Ready', {
      views: [{ showGridLines: true }]
    });

    sheetCrm.columns = [
      { header: 'Company Name', key: 'company', width: 28 },
      { header: 'First Name', key: 'firstName', width: 16 },
      { header: 'Last Name', key: 'lastName', width: 16 },
      { header: 'Job Title', key: 'jobTitle', width: 25 },
      { header: 'Email Address', key: 'email', width: 26 },
      { header: 'Phone Number', key: 'phone', width: 20 },
      { header: 'Mobile Phone', key: 'mobile', width: 20 },
      { header: 'WhatsApp Link', key: 'whatsapp', width: 35 },
      { header: 'Website URL', key: 'website', width: 25 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Country', key: 'country', width: 14 },
      { header: 'Lead Score', key: 'leadScore', width: 12 },
      { header: 'Lead Status', key: 'leadStatus', width: 16 },
      { header: 'LinkedIn URL', key: 'linkedin', width: 30 }
    ];

    this.styleHeaderRow(sheetCrm.getRow(1), 'FF4338CA'); // Purple CRM theme

    for (const lead of leads) {
      const dm = lead.decisionMakers && lead.decisionMakers[0];
      const nameParts = (dm?.name || 'Authorized Representative').split(' ');
      const firstName = nameParts[0] || 'Representative';
      const lastName = nameParts.slice(1).join(' ') || '';

      sheetCrm.addRow({
        company: lead.businessName,
        firstName,
        lastName,
        jobTitle: dm?.designation || 'Head of Operations',
        email: dm?.email || lead.email || '',
        phone: lead.phoneInternational || lead.phoneRaw,
        mobile: lead.isMobile ? (lead.phoneInternational || lead.phoneRaw) : '',
        whatsapp: lead.whatsappUrl || '',
        website: lead.website || '',
        city: lead.city,
        country: lead.country,
        leadScore: lead.scores?.totalScore || 70,
        leadStatus: 'PROSPECT',
        linkedin: dm?.linkedinUrl || lead.linkedinUrl || ''
      }).height = 20;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Standard Universal CSV Export
   */
  public generateCsv(leads: WhatsAppLead[]): string {
    const headers = [
      'Business Name',
      'Brand / Parent Brand',
      'Branch / Locality',
      'Industry / Category',
      'Phone (Formatted)',
      'Phone (Digits)',
      'Line Type',
      'Direct WhatsApp Chat Link',
      'Decision-Maker Name',
      'Decision-Maker Title',
      'Decision-Maker LinkedIn',
      'Decision-Maker Email',
      'Lead Quality Score',
      'Company Fit Score',
      'Address',
      'City',
      'Country',
      'Google Profile / Maps URL',
      'Official Website',
      'Rating & Reviews',
      'Operating Hours',
      'Confidence',
      'Source Evidence',
      'Discovered At'
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null || val === '') return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leads.map(l => {
      const dm = l.decisionMakers && l.decisionMakers[0];
      return [
        escapeCsv(l.businessName),
        escapeCsv(l.brandName || l.businessName),
        escapeCsv(l.locality || l.city),
        escapeCsv(l.category),
        escapeCsv(l.phoneInternational),
        escapeCsv(l.phoneDigitsOnly),
        escapeCsv(l.isMobile ? 'Mobile' : 'Landline'),
        escapeCsv(l.whatsappUrl),
        escapeCsv(dm?.name || 'N/A'),
        escapeCsv(dm?.designation || 'N/A'),
        escapeCsv(dm?.linkedinUrl || 'N/A'),
        escapeCsv(dm?.email || l.email || 'N/A'),
        escapeCsv(l.scores?.contactQualityScore || 75),
        escapeCsv(l.scores?.companyFitScore || 75),
        escapeCsv(l.address),
        escapeCsv(l.city),
        escapeCsv(l.country),
        escapeCsv(l.googleProfileUrl || 'N/A'),
        escapeCsv(l.website || 'N/A'),
        escapeCsv(l.rating || 'N/A'),
        escapeCsv(l.operatingHours || 'N/A'),
        escapeCsv(l.confidence.toUpperCase()),
        escapeCsv(l.sourceEvidence || 'N/A'),
        escapeCsv(l.discoveredAt)
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Specialized CRM Exports (HubSpot, Salesforce, Zoho)
   */
  public generateCrmCsv(leads: WhatsAppLead[], format: 'hubspot' | 'salesforce' | 'zoho'): string {
    const escapeCsv = (val: any) => {
      if (val === undefined || val === null || val === '') return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    if (format === 'hubspot') {
      const headers = ['Company Name', 'First Name', 'Last Name', 'Job Title', 'Email', 'Phone Number', 'Mobile Phone Number', 'Website URL', 'City', 'Country/Region', 'Lead Status'];
      const rows = leads.map(l => {
        const dm = l.decisionMakers && l.decisionMakers[0];
        const parts = (dm?.name || 'Representative').split(' ');
        return [
          escapeCsv(l.businessName),
          escapeCsv(parts[0]),
          escapeCsv(parts.slice(1).join(' ')),
          escapeCsv(dm?.designation || 'Business Lead'),
          escapeCsv(dm?.email || l.email || ''),
          escapeCsv(l.phoneInternational || l.phoneRaw),
          escapeCsv(l.isMobile ? l.phoneInternational : ''),
          escapeCsv(l.website || ''),
          escapeCsv(l.city),
          escapeCsv(l.country),
          escapeCsv('NEW')
        ].join(',');
      });
      return [headers.join(','), ...rows].join('\n');
    }

    if (format === 'salesforce') {
      const headers = ['Company', 'FirstName', 'LastName', 'Title', 'Email', 'Phone', 'MobilePhone', 'Street', 'City', 'Country', 'Rating', 'LeadSource'];
      const rows = leads.map(l => {
        const dm = l.decisionMakers && l.decisionMakers[0];
        const parts = (dm?.name || 'Representative').split(' ');
        return [
          escapeCsv(l.businessName),
          escapeCsv(parts[0]),
          escapeCsv(parts.slice(1).join(' ')),
          escapeCsv(dm?.designation || 'Executive'),
          escapeCsv(dm?.email || l.email || ''),
          escapeCsv(l.phoneInternational || l.phoneRaw),
          escapeCsv(l.isMobile ? l.phoneInternational : ''),
          escapeCsv(l.address),
          escapeCsv(l.city),
          escapeCsv(l.country),
          escapeCsv(l.scores?.totalScore && l.scores.totalScore >= 75 ? 'Hot' : 'Warm'),
          escapeCsv('MarketMate AI Lead Intelligence')
        ].join(',');
      });
      return [headers.join(','), ...rows].join('\n');
    }

    // Default Zoho CRM format
    const headers = ['Company', 'Contact Name', 'Designation', 'Email', 'Phone', 'Mobile', 'Skype ID', 'Website', 'Street', 'City', 'Country', 'Lead Status'];
    const rows = leads.map(l => {
      const dm = l.decisionMakers && l.decisionMakers[0];
      return [
        escapeCsv(l.businessName),
        escapeCsv(dm?.name || 'Authorized Contact'),
        escapeCsv(dm?.designation || 'Manager'),
        escapeCsv(dm?.email || l.email || ''),
        escapeCsv(l.phoneInternational || l.phoneRaw),
        escapeCsv(l.isMobile ? l.phoneInternational : ''),
        escapeCsv(l.whatsappUrl || ''),
        escapeCsv(l.website || ''),
        escapeCsv(l.address),
        escapeCsv(l.city),
        escapeCsv(l.country),
        escapeCsv('Not Contacted')
      ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Bulk Smartphone Contacts vCard (.vcf)
   */
  public generateBulkVCard(leads: WhatsAppLead[]): string {
    const vcards = leads.map(lead => {
      const dm = lead.decisionMakers && lead.decisionMakers[0];
      const personName = dm ? dm.name : lead.businessName;
      const cleanName = personName.replace(/;/g, '\\;').replace(/,/g, '\\,');
      const cleanOrg = lead.businessName.replace(/;/g, '\\;').replace(/,/g, '\\,');
      const cleanAddress = lead.address.replace(/;/g, ' ').replace(/\n/g, ' ');

      const noteParts = [
        `Role: ${dm ? dm.designation : lead.category}`,
        lead.locality ? `Locality: ${lead.locality}` : null,
        lead.scores?.totalScore ? `Lead Score: ${lead.scores.totalScore}/100` : null,
        lead.rating ? `Rating: ${lead.rating}` : null,
        `WhatsApp Chat: ${lead.whatsappUrl}`,
        lead.googleProfileUrl ? `Google Maps: ${lead.googleProfileUrl}` : null,
        `Sourced via MarketMate AI B2B Intelligence`
      ].filter(Boolean);

      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${cleanName}`,
        `ORG:${cleanOrg};${lead.category || 'Business'}`,
        dm?.designation ? `TITLE:${dm.designation}` : '',
        `TEL;TYPE=CELL,VOICE,pref:${lead.phoneInternational || `+${lead.phoneDigitsOnly}`}`,
        `ADR;TYPE=WORK:;;${cleanAddress};${lead.city};${lead.state || ''};;${lead.country}`,
        lead.website ? `URL;TYPE=WORK:${lead.website}` : lead.googleProfileUrl ? `URL;TYPE=WORK:${lead.googleProfileUrl}` : '',
        dm?.linkedinUrl ? `X-SOCIALPROFILE;TYPE=linkedin:${dm.linkedinUrl}` : lead.linkedinUrl ? `X-SOCIALPROFILE;TYPE=linkedin:${lead.linkedinUrl}` : '',
        dm?.email ? `EMAIL;TYPE=WORK:${dm.email}` : lead.email ? `EMAIL;TYPE=WORK:${lead.email}` : '',
        `NOTE:${noteParts.join(' | ')}`,
        'END:VCARD'
      ].filter(Boolean).join('\r\n');
    });

    return vcards.join('\r\n\r\n');
  }

  private styleHeaderRow(row: ExcelJS.Row, hexColor: string) {
    row.height = 28;
    row.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexColor }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  }
}

export const b2bExportService = new B2BExportService();
