import { b2bDiscoveryEngine } from './b2bDiscoveryEngine.js';
import { b2bExportService } from './b2bExportService.js';
import { WhatsAppLead, WhatsAppSearchParams, WhatsAppSearchRun } from '../types/index.js';

export class WhatsAppFinderService {
  /**
   * Phone Normalizer - delegates to B2B engine with E.164 standardization
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
    const norm = b2bDiscoveryEngine.normalizePhone(rawPhone, defaultCountryCode, businessName, location, messageTemplate);
    return {
      phoneDigitsOnly: norm.digitsOnly,
      phoneInternational: norm.e164Number,
      isMobile: norm.lineType === 'mobile',
      whatsappUrl: norm.whatsappUrl || ''
    };
  }

  /**
   * Autonomous Large-Scale Multi-Zone B2B Lead Discovery & Decision-Maker Intelligence
   */
  public async search(
    params: WhatsAppSearchParams,
    onProgress?: (percent: number, stage: string) => void
  ): Promise<WhatsAppSearchRun> {
    return b2bDiscoveryEngine.search(params, onProgress);
  }

  /**
   * Generate vCard 3.0 file for instant phone contact import
   */
  public generateBulkVCard(leads: WhatsAppLead[]): string {
    return b2bExportService.generateBulkVCard(leads);
  }

  /**
   * Generate standard CSV format
   */
  public generateCsv(leads: WhatsAppLead[]): string {
    return b2bExportService.generateCsv(leads);
  }

  /**
   * Generate CRM-specific CSV format (HubSpot, Salesforce, Zoho)
   */
  public generateCrmCsv(leads: WhatsAppLead[], format: 'hubspot' | 'salesforce' | 'zoho'): string {
    return b2bExportService.generateCrmCsv(leads, format);
  }

  /**
   * Generate Multi-Sheet Styled Excel Workbook (.xlsx)
   */
  public async generateExcel(leads: WhatsAppLead[]): Promise<Buffer> {
    return b2bExportService.generateExcel(leads);
  }
}

export const whatsappFinderService = new WhatsAppFinderService();
