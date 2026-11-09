import dns from 'dns/promises';

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', '10minutemail.com', 'tempmail.com', 'guerrillamail.com',
  'sharklasers.com', 'throwawaymail.com', 'yopmail.com', 'getnada.com',
  'trashmail.com', 'dispostable.com', 'temp-mail.org'
]);

export interface EmailVerificationResult {
  email: string;
  domain: string;
  isValidSyntax: boolean;
  isDisposable: boolean;
  hasMxRecords: boolean;
  mxServers: string[];
  emailProvider?: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'verified' | 'pattern_derived' | 'risky' | 'invalid';
  details: string;
}

/**
 * Validates email syntax strictly according to standard RFC patterns
 */
export function validateEmailSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

/**
 * Extracts clean domain name from URL or raw domain string
 */
export function extractCleanDomain(input: string): string {
  try {
    let clean = input.trim().toLowerCase();
    if (clean.includes('@')) {
      clean = clean.split('@')[1];
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim().toLowerCase();
  }
}

/**
 * Identifies the mail service provider based on MX exchange hostnames
 */
function identifyMailProvider(mxServers: string[]): string {
  const joined = mxServers.join(' ').toLowerCase();
  if (joined.includes('google') || joined.includes('aspmx') || joined.includes('l.google.com')) {
    return 'Google Workspace';
  }
  if (joined.includes('outlook') || joined.includes('microsoft') || joined.includes('office365')) {
    return 'Microsoft 365 / Exchange';
  }
  if (joined.includes('zoho')) return 'Zoho Mail';
  if (joined.includes('proton')) return 'ProtonMail Business';
  if (joined.includes('mimecast')) return 'Mimecast Gateway';
  if (joined.includes('barracuda')) return 'Barracuda Gateway';
  if (joined.includes('cloudflare')) return 'Cloudflare Email Routing';
  if (joined.includes('amazon') || joined.includes('aws')) return 'Amazon SES / WorkMail';
  return 'Corporate Mail Server';
}

/**
 * Verifies email address via syntax checks, disposable blacklist, Hunter.io (if configured), and live DNS MX resolution
 */
export async function verifyEmailAddress(email: string): Promise<EmailVerificationResult> {
  const trimmed = email.trim().toLowerCase();
  const isValidSyntax = validateEmailSyntax(trimmed);

  if (!isValidSyntax) {
    return {
      email: trimmed,
      domain: '',
      isValidSyntax: false,
      isDisposable: false,
      hasMxRecords: false,
      mxServers: [],
      confidence: 'low',
      status: 'invalid',
      details: 'Failed standard email syntax validation format.'
    };
  }

  const parts = trimmed.split('@');
  const domain = parts[1];

  // Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      email: trimmed,
      domain,
      isValidSyntax: true,
      isDisposable: true,
      hasMxRecords: false,
      mxServers: [],
      confidence: 'low',
      status: 'risky',
      details: 'Detected temporary or disposable email service provider.'
    };
  }

  // Hunter.io API Verification (if HUNTER_API_KEY available)
  const hunterKey = process.env.HUNTER_API_KEY;
  if (hunterKey) {
    try {
      const hunterUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(trimmed)}&api_key=${encodeURIComponent(hunterKey)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const hRes = await fetch(hunterUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (hRes.ok) {
        const hData: any = await hRes.json();
        const d = hData?.data;
        if (d) {
          const isDeliverable = d.status === 'valid' || d.result === 'deliverable';
          const isRisky = d.status === 'accept_all' || d.result === 'risky';
          const isInvalid = d.status === 'invalid' || d.result === 'undeliverable';

          return {
            email: trimmed,
            domain,
            isValidSyntax: true,
            isDisposable: d.disposable || false,
            hasMxRecords: d.mx_records || true,
            mxServers: [],
            emailProvider: 'Hunter Verified',
            confidence: isDeliverable ? 'high' : (isRisky ? 'medium' : 'low'),
            status: isDeliverable ? 'verified' : (isRisky ? 'risky' : 'invalid'),
            details: `Hunter.io Verification: ${d.status || d.result} (score: ${d.score || 0}%). MX: ${d.mx_records ? 'Active' : 'None'}, SMTP check: ${d.smtp_check ? 'Passed' : 'Failed'}`
          };
        }
      }
    } catch {
      // Continue to DNS fallback
    }
  }

  // Live DNS MX record resolution fallback
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        email: trimmed,
        domain,
        isValidSyntax: true,
        isDisposable: false,
        hasMxRecords: false,
        mxServers: [],
        confidence: 'low',
        status: 'risky',
        details: `Domain ${domain} has no active DNS Mail Exchanger (MX) records.`
      };
    }

    // Sort by priority
    mxRecords.sort((a, b) => a.priority - b.priority);
    const mxServers = mxRecords.map(m => m.exchange);
    const provider = identifyMailProvider(mxServers);

    return {
      email: trimmed,
      domain,
      isValidSyntax: true,
      isDisposable: false,
      hasMxRecords: true,
      mxServers,
      emailProvider: provider,
      confidence: 'medium',
      status: 'pattern_derived',
      details: `Active MX host resolved (${provider}: ${mxServers[0]}). Domain receives email, but individual mailbox unverified without SMTP challenge.`
    };
  } catch (err: any) {
    return {
      email: trimmed,
      domain,
      isValidSyntax: true,
      isDisposable: false,
      hasMxRecords: false,
      mxServers: [],
      confidence: 'low',
      status: 'risky',
      details: `DNS lookup warning for domain (${err.code || err.message}).`
    };
  }
}

/**
 * Predicts corporate email patterns for a person given their name and company domain
 */
export async function deriveCorporateEmail(fullName: string, companyDomain: string): Promise<{
  primaryEmail: string;
  pattern: string;
  variations: string[];
  verification: EmailVerificationResult;
}> {
  const cleanDomain = extractCleanDomain(companyDomain);
  const nameParts = fullName.trim().toLowerCase().split(/\s+/).filter(Boolean);

  let first = 'contact';
  let last = 'team';

  if (nameParts.length === 1) {
    first = nameParts[0].replace(/[^a-z]/g, '');
  } else if (nameParts.length >= 2) {
    first = nameParts[0].replace(/[^a-z]/g, '');
    last = nameParts[nameParts.length - 1].replace(/[^a-z]/g, '');
  }

  const variations = [
    `${first}.${last}@${cleanDomain}`,
    `${first}@${cleanDomain}`,
    `${first[0]}${last}@${cleanDomain}`,
    `${first}${last[0]}@${cleanDomain}`,
    `${first}_${last}@${cleanDomain}`
  ];

  const primaryEmail = variations[0];
  const pattern = `{first}.{last}@${cleanDomain}`;

  const verification = await verifyEmailAddress(primaryEmail);

  return {
    primaryEmail,
    pattern,
    variations,
    verification
  };
}
