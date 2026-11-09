import fs from 'fs/promises';
import path from 'path';
import { HunterSettings } from '../types/index.js';

const SETTINGS_FILE = path.resolve(__dirname, '../../data/settings.json');
const ENV_FILE = path.resolve(__dirname, '../../.env');

export class HunterService {
  private cachedSettings: HunterSettings | null = null;
  private apiKey: string = process.env.HUNTER_API_KEY || '';
  private emailDiscoveryEnabled: boolean = Boolean(process.env.HUNTER_API_KEY && process.env.HUNTER_API_KEY.trim() !== '');

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.hunterApiKey) {
        this.apiKey = parsed.hunterApiKey;
        process.env.HUNTER_API_KEY = parsed.hunterApiKey;
      }
      if (typeof parsed.emailDiscoveryEnabled === 'boolean') {
        this.emailDiscoveryEnabled = parsed.emailDiscoveryEnabled;
      }
    } catch {
      // settings.json will be created on save
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  public isEnabled(): boolean {
    return this.isConfigured() && this.emailDiscoveryEnabled;
  }

  public getMaskedKey(): string | null {
    if (!this.apiKey || this.apiKey.length < 4) return null;
    return `••••••••••••${this.apiKey.substring(this.apiKey.length - 4)}`;
  }

  public getLast4(): string | null {
    if (!this.apiKey || this.apiKey.length < 4) return null;
    return this.apiKey.substring(this.apiKey.length - 4);
  }

  /**
   * Retrieves public safe settings (never leaks raw key, returns only status and last 4 characters)
   */
  public async getSettings(): Promise<HunterSettings> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        emailDiscoveryEnabled: false,
        maskedKey: null,
        last4: null,
        status: 'not_configured',
        details: 'Hunter API key is not configured.'
      };
    }

    const last4 = this.getLast4();
    const maskedKey = this.getMaskedKey();

    // Try testing account to get real-time credit status
    try {
      const test = await this.testConnection(this.apiKey);
      return {
        configured: true,
        emailDiscoveryEnabled: this.emailDiscoveryEnabled,
        maskedKey,
        last4,
        status: test.creditsExhausted ? 'credits_exhausted' : test.success ? 'configured' : 'invalid_key',
        remainingCredits: test.remainingCredits,
        remainingSearches: test.remainingSearches,
        remainingVerifications: test.remainingVerifications,
        planName: test.planName,
        message: test.message,
        details: test.message
      };
    } catch {
      return {
        configured: true,
        emailDiscoveryEnabled: this.emailDiscoveryEnabled,
        maskedKey,
        last4,
        status: 'configured',
        details: 'API key configured.'
      };
    }
  }

  /**
   * Test connection to Hunter Account API
   */
  public async testConnection(keyToTest?: string): Promise<{
    success: boolean;
    creditsExhausted?: boolean;
    planName?: string;
    remainingCredits?: number;
    remainingSearches?: number;
    remainingVerifications?: number;
    message: string;
  }> {
    const key = keyToTest || this.apiKey;
    if (!key || key.trim() === '') {
      return {
        success: false,
        message: 'No Hunter API key provided.'
      };
    }

    try {
      const res = await fetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(key.trim())}`, {
        headers: { 'User-Agent': 'MarketMate-AI/1.0' }
      });

      if (res.status === 401) {
        return {
          success: false,
          message: 'Invalid Hunter API key. Authentication failed.'
        };
      }

      if (res.status === 402 || res.status === 429) {
        return {
          success: false,
          creditsExhausted: true,
          message: 'Hunter credits exhausted or rate limit reached.'
        };
      }

      if (!res.ok) {
        return {
          success: false,
          message: `Hunter API responded with status ${res.status}`
        };
      }

      const data: any = await res.json();
      const planName = data?.data?.plan_name || 'Free';
      const credits = data?.data?.requests?.credits?.remaining ?? 0;
      const searches = data?.data?.requests?.searches?.remaining ?? 0;
      const verifications = data?.data?.requests?.verifications?.remaining ?? 0;

      const creditsExhausted = (searches <= 0 && credits <= 0);

      return {
        success: !creditsExhausted,
        creditsExhausted,
        planName,
        remainingCredits: credits,
        remainingSearches: searches,
        remainingVerifications: verifications,
        message: creditsExhausted
          ? `Connected (${planName} Plan), but search credits are exhausted (${searches} searches, ${verifications} verifications remaining).`
          : `Connected successfully (${planName} Plan): ${searches} searches & ${verifications} verifications remaining.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection test failed: ${err.message}`
      };
    }
  }

  /**
   * Saves and persists the Hunter API key
   */
  public async saveApiKey(apiKey: string, enable: boolean = true): Promise<{ success: boolean; message: string; settings: HunterSettings }> {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      throw new Error('API key cannot be empty');
    }

    // Test first
    const test = await this.testConnection(cleanKey);
    if (!test.success && !test.creditsExhausted) {
      throw new Error(test.message || 'Validation failed. Please verify your Hunter API key.');
    }

    this.apiKey = cleanKey;
    this.emailDiscoveryEnabled = enable;
    process.env.HUNTER_API_KEY = cleanKey;

    // Save to settings.json
    try {
      let existingSettings: any = {};
      try {
        existingSettings = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf-8'));
      } catch {
        existingSettings = {};
      }
      existingSettings.hunterApiKey = cleanKey;
      existingSettings.emailDiscoveryEnabled = enable;
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(existingSettings, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[HunterService] Failed to persist to settings.json:', err);
    }

    // Also update server/.env if present
    try {
      const envContent = await fs.readFile(ENV_FILE, 'utf-8');
      let newEnv: string;
      if (envContent.includes('HUNTER_API_KEY=')) {
        newEnv = envContent.replace(/HUNTER_API_KEY=.*/g, `HUNTER_API_KEY=${cleanKey}`);
      } else {
        newEnv = `${envContent.trim()}\nHUNTER_API_KEY=${cleanKey}\n`;
      }
      await fs.writeFile(ENV_FILE, newEnv, 'utf-8');
    } catch {
      // non-fatal
    }

    const settings = await this.getSettings();
    return {
      success: true,
      message: 'Hunter API key saved and verified successfully!',
      settings
    };
  }

  /**
   * Disables and removes Hunter key
   */
  public async clearApiKey(): Promise<HunterSettings> {
    this.apiKey = '';
    this.emailDiscoveryEnabled = false;
    process.env.HUNTER_API_KEY = '';

    try {
      let existingSettings: any = {};
      try {
        existingSettings = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf-8'));
      } catch {
        existingSettings = {};
      }
      delete existingSettings.hunterApiKey;
      existingSettings.emailDiscoveryEnabled = false;
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(existingSettings, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[HunterService] Failed to clear settings.json:', err);
    }

    try {
      const envContent = await fs.readFile(ENV_FILE, 'utf-8');
      const newEnv = envContent.replace(/HUNTER_API_KEY=.*/g, 'HUNTER_API_KEY=');
      await fs.writeFile(ENV_FILE, newEnv, 'utf-8');
    } catch {
      // non-fatal
    }

    return this.getSettings();
  }

  /**
   * Toggle email discovery enabled
   */
  public async toggleEnabled(enabled: boolean): Promise<HunterSettings> {
    this.emailDiscoveryEnabled = enabled;
    try {
      let existingSettings: any = {};
      try {
        existingSettings = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf-8'));
      } catch {
        existingSettings = {};
      }
      existingSettings.emailDiscoveryEnabled = enabled;
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(existingSettings, null, 2), 'utf-8');
    } catch {
      // non-fatal
    }
    return this.getSettings();
  }

  /**
   * Find professional email for a specific individual on demand
   */
  public async findEmailForPerson(
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<{
    email: string | null;
    score?: number;
    verificationStatus?: string;
    sourceUrl?: string;
    creditsExhausted?: boolean;
    error?: string;
  }> {
    if (!this.isEnabled()) {
      return { email: null, error: 'Hunter API is not enabled or configured' };
    }

    try {
      const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${this.apiKey}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MarketMate-AI/1.0' } });

      if (res.status === 402 || res.status === 429) {
        return { email: null, creditsExhausted: true, error: 'Hunter search credits exhausted' };
      }

      if (!res.ok) {
        return { email: null, error: `Hunter API status: ${res.status}` };
      }

      const data: any = await res.json();
      const email = data?.data?.email || null;
      const score = data?.data?.score || 0;
      const verificationStatus = data?.data?.verification?.status || 'unverified';
      const sourceUrl = data?.data?.sources?.[0]?.uri || undefined;

      return {
        email,
        score,
        verificationStatus,
        sourceUrl
      };
    } catch (err: any) {
      return { email: null, error: err.message };
    }
  }

  /**
   * Search domain for public emails using Hunter Domain Search
   */
  public async searchDomain(
    domain: string,
    limit: number = 20
  ): Promise<{
    emails: Array<{
      value: string;
      type: string;
      confidence: number;
      firstName?: string;
      lastName?: string;
      position?: string;
      department?: string;
      linkedin?: string;
      sources: Array<{ uri: string }>;
    }>;
    creditsExhausted?: boolean;
    organization?: string;
    error?: string;
  }> {
    if (!this.isEnabled()) {
      return { emails: [], error: 'Hunter API is not enabled or configured' };
    }

    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=${Math.min(limit, 50)}&api_key=${this.apiKey}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MarketMate-AI/1.0' } });

      if (res.status === 402 || res.status === 429) {
        return { emails: [], creditsExhausted: true, error: 'Hunter search credits exhausted' };
      }

      if (!res.ok) {
        return { emails: [], error: `Hunter API status: ${res.status}` };
      }

      const data: any = await res.json();
      const emails = (data?.data?.emails || []).map((e: any) => ({
        value: e.value,
        type: e.type,
        confidence: e.confidence,
        firstName: e.first_name,
        lastName: e.last_name,
        position: e.position,
        department: e.department,
        linkedin: e.linkedin,
        sources: e.sources || []
      }));

      return {
        emails,
        organization: data?.data?.organization
      };
    } catch (err: any) {
      return { emails: [], error: err.message };
    }
  }
}

export const hunterService = new HunterService();
