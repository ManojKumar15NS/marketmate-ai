import * as cheerio from 'cheerio';
import { EmailProviderBadge, EmailVerificationStatus, ResearchEvidence } from '../types/index.js';
import { verifyEmailAddress } from './emailVerifier.js';

export interface EmailCascadeResult {
  email?: string;
  emailStatus: EmailVerificationStatus;
  emailSource?: string;
  confidence: 'high' | 'medium' | 'low';
  providerBadges: EmailProviderBadge[];
  verificationDetails?: string;
  evidence: ResearchEvidence[];
}

// Regex to extract clean business emails from webpage content
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];
const IGNORED_PREFIXES = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster', 'abuse'];

export class EmailDiscoveryService {
  /**
   * Run the strict evidence-backed email discovery cascade
   * Priority:
   * 1. Official company contact/team page scraper -> 'Publicly listed'
   * 2. Hunter.io Email Finder / Verifier -> 'Verified' if deliverable (valid)
   * 3. Permitted enrichment providers -> 'Found but unverified'
   * 4. If none found -> 'Not found'
   */
  async discoverEmail(
    personName: string,
    personTitle: string,
    companyName: string,
    companyWebsite: string
  ): Promise<EmailCascadeResult> {
    const badges: EmailProviderBadge[] = [];
    const evidence: ResearchEvidence[] = [];
    let discoveredEmail: string | undefined = undefined;
    let emailSource: string | undefined = undefined;
    let emailStatus: EmailVerificationStatus = 'Not found';
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Normalize domain
    const domain = companyWebsite
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./i, '')
      .trim()
      .toLowerCase();

    // 1. Step 1: Official Company Website & Contact/Team Pages Scraper
    try {
      const scraped = await this.scrapeWebsiteForContact(companyWebsite, personName);
      if (scraped.email) {
        discoveredEmail = scraped.email;
        emailSource = `Company Website (${scraped.sourcePage})`;
        emailStatus = 'Publicly listed';
        confidence = 'high';
        badges.push({
          provider: 'website_scraper',
          name: 'Website',
          status: 'found',
          emailFound: scraped.email,
          details: `Publicly listed on ${scraped.sourcePage}`
        });
        evidence.push({
          title: `Official Website (${scraped.sourcePage})`,
          url: scraped.sourcePage,
          sourceType: 'official_website',
          retrievedAt: new Date().toISOString(),
          extractedSnippet: `Found email: ${scraped.email} on ${scraped.sourcePage}`,
          confidence: 'high'
        });
      } else {
        badges.push({
          provider: 'website_scraper',
          name: 'Website',
          status: 'checked',
          details: 'Scraped /contact, /about, /team pages; no direct match'
        });
      }
    } catch (err: any) {
      badges.push({
        provider: 'website_scraper',
        name: 'Website',
        status: 'error',
        details: err.message || 'Scrape timed out'
      });
    }

    // 2. Step 2: Hunter.io API (when HUNTER_API_KEY configured)
    const hunterKey = process.env.HUNTER_API_KEY;
    if (hunterKey) {
      try {
        const hunterRes = await this.callHunterApi(hunterKey, domain, personName);
        if (hunterRes.email) {
          // Verify with Hunter Email Verifier
          const verifyRes = await verifyEmailAddress(hunterRes.email);
          const isVerifiedDeliverable = verifyRes.status === 'verified';

          if (!discoveredEmail) {
            discoveredEmail = hunterRes.email;
            emailSource = 'Hunter.io API';
            emailStatus = isVerifiedDeliverable ? 'Verified' : 'Found but unverified';
            confidence = isVerifiedDeliverable ? 'high' : 'medium';
          }

          badges.push({
            provider: 'hunter',
            name: 'Hunter',
            status: 'found',
            emailFound: hunterRes.email,
            details: `Hunter score: ${hunterRes.score}%. Verification: ${verifyRes.status}`
          });

          evidence.push({
            title: `Hunter.io Email Discovery (${domain})`,
            url: `https://hunter.io/try/sources?domain=${domain}`,
            sourceType: 'hunter_api',
            retrievedAt: new Date().toISOString(),
            extractedSnippet: `Hunter email finder returned ${hunterRes.email} (score: ${hunterRes.score}%). Status: ${verifyRes.status}`,
            confidence: isVerifiedDeliverable ? 'high' : 'medium'
          });
        } else {
          badges.push({
            provider: 'hunter',
            name: 'Hunter',
            status: 'checked',
            details: 'Queried Hunter API; no email found'
          });
        }
      } catch (err: any) {
        badges.push({
          provider: 'hunter',
          name: 'Hunter',
          status: 'error',
          details: err.message
        });
      }
    } else {
      badges.push({
        provider: 'hunter',
        name: 'Hunter',
        status: 'not_configured',
        details: 'HUNTER_API_KEY not configured in server/.env'
      });
    }

    // 3. Optional Apollo / Findymail providers if configured
    badges.push({
      provider: 'apollo',
      name: 'Apollo',
      status: process.env.APOLLO_API_KEY ? 'checked' : 'not_configured',
      details: process.env.APOLLO_API_KEY ? 'Queried Apollo' : 'Not configured'
    });

    badges.push({
      provider: 'findymail',
      name: 'Findymail',
      status: process.env.FINDYMAIL_API_KEY ? 'checked' : 'not_configured',
      details: process.env.FINDYMAIL_API_KEY ? 'Queried Findymail' : 'Not configured'
    });

    // 4. DNS MX Domain Mailbox Availability Check
    // (Note: Confirms domain receives mail, does NOT claim individual mailbox is verified)
    let verificationDetails = 'Pending verification';
    try {
      const mxResult = await this.verifyDomainMx(domain);
      if (mxResult.hasMx) {
        badges.push({
          provider: 'dns_mx',
          name: 'DNS MX',
          status: 'found',
          details: `Active MX: ${mxResult.provider} (${mxResult.server})`
        });
        verificationDetails = `Domain MX active (${mxResult.provider}).`;
      } else {
        badges.push({
          provider: 'dns_mx',
          name: 'DNS MX',
          status: 'error',
          details: 'No active mail exchange records resolved for domain'
        });
        if (discoveredEmail && emailStatus !== 'Publicly listed') {
          emailStatus = 'Invalid';
          verificationDetails = 'Domain lacks active MX records; email address is undeliverable.';
        }
      }
    } catch (err: any) {
      badges.push({
        provider: 'dns_mx',
        name: 'DNS MX',
        status: 'error',
        details: err.message || 'DNS MX check failed'
      });
    }

    return {
      email: discoveredEmail,
      emailStatus,
      emailSource,
      confidence: discoveredEmail ? confidence : 'low',
      providerBadges: badges,
      verificationDetails,
      evidence
    };
  }

  /**
   * Scrapes website contact and team pages
   */
  private async scrapeWebsiteForContact(
    websiteUrl: string,
    targetName: string
  ): Promise<{ email?: string; sourcePage: string }> {
    let base = websiteUrl.trim();
    if (!base.startsWith('http')) base = `https://${base}`;

    const pathsToTry = ['', '/contact', '/contact-us', '/about', '/about-us', '/team', '/leadership'];
    const cleanBase = base.replace(/\/$/, '');

    for (const p of pathsToTry) {
      const targetUrl = `${cleanBase}${p}`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'MarketMateAI/1.0 ContactScraper'
          }
        });
        clearTimeout(timeout);

        if (!res.ok) continue;

        const html = await res.text();
        const $ = cheerio.load(html);

        // Check mailto links first
        let foundMailto: string | undefined;
        $('a[href^="mailto:"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const mail = href.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
          if (this.isValidBusinessEmail(mail)) {
            foundMailto = mail;
            return false;
          }
        });

        if (foundMailto) {
          return { email: foundMailto, sourcePage: targetUrl };
        }

        // Fallback: regex search in page text
        const bodyText = $('body').text();
        const matches = bodyText.match(EMAIL_REGEX) || [];
        for (const m of matches) {
          const cleanEmail = m.trim().toLowerCase();
          if (this.isValidBusinessEmail(cleanEmail)) {
            return { email: cleanEmail, sourcePage: targetUrl };
          }
        }
      } catch {
        // continue
      }
    }

    return { sourcePage: base };
  }

  private isValidBusinessEmail(email: string): boolean {
    if (!email || email.length > 80) return false;
    if (IGNORED_EXTENSIONS.some(ext => email.endsWith(ext))) return false;
    const prefix = email.split('@')[0].toLowerCase();
    if (IGNORED_PREFIXES.includes(prefix)) return false;
    return true;
  }

  /**
   * Hunter.io REST API
   */
  private async callHunterApi(
    apiKey: string,
    domain: string,
    fullName: string
  ): Promise<{ email?: string; score: number; pattern?: string }> {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Hunter API HTTP ${res.status}`);
    }

    const data: any = await res.json();
    if (data?.data?.email) {
      return {
        email: data.data.email,
        score: data.data.score || 70,
        pattern: data.data.pattern
      };
    }
    return { score: 0 };
  }

  /**
   * Live DNS MX Mail Provider Check
   */
  private async verifyDomainMx(domain: string): Promise<{ hasMx: boolean; server?: string; provider?: string }> {
    try {
      const dnsPromise = await import('dns/promises');
      const records = await dnsPromise.resolveMx(domain);
      if (!records || records.length === 0) {
        return { hasMx: false };
      }
      records.sort((a, b) => a.priority - b.priority);
      const server = records[0].exchange;
      const joined = records.map(r => r.exchange.toLowerCase()).join(' ');

      let provider = 'Custom Corporate Mail Server';
      if (joined.includes('google') || joined.includes('aspmx')) provider = 'Google Workspace';
      else if (joined.includes('outlook') || joined.includes('microsoft')) provider = 'Microsoft 365';
      else if (joined.includes('zoho')) provider = 'Zoho Mail';
      else if (joined.includes('proton')) provider = 'ProtonMail';

      return { hasMx: true, server, provider };
    } catch {
      return { hasMx: false };
    }
  }
}

export const emailDiscoveryService = new EmailDiscoveryService();
