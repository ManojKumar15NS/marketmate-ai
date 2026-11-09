import * as cheerio from 'cheerio';
import { validateSafeUrl } from './webFetcher.js';
import { logger } from '../utils/logger.js';

export interface SeoFinding {
  url: string;
  category: 'Meta & Titles' | 'Headings & Structure' | 'Indexing & Directives' | 'Structured Data' | 'Media & Accessibility' | 'Links & Navigation' | 'Performance & Core Web Vitals';
  title: string;
  actualValue: string;
  evidence: string;
  fix: string;
  priority: 'critical' | 'warning' | 'info' | 'good' | 'not_checked';
}

export interface CrawledPageData {
  url: string;
  statusCode: number;
  title: string;
  titleLength: number;
  description: string;
  descriptionLength: number;
  canonicalUrl: string | null;
  robotsDirective: string | null;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  images: {
    total: number;
    missingAlt: number;
    samplesMissingAlt: string[];
  };
  links: {
    internalCount: number;
    externalCount: number;
  };
  schemasFound: string[];
}

export interface SeoAnalysisResult {
  url: string;
  domain: string;
  statusCode: number;
  score: number; // 0 - 100 calculated deterministically
  crawledPagesCount: number;
  robotsTxt: {
    status: number;
    found: boolean;
    sitemaps: string[];
    disallowedPaths: string[];
  };
  sitemap: {
    status: number;
    found: boolean;
    url: string;
  };
  performance: {
    score: number | 'Not measured';
    fcpMs?: number | 'Not measured';
    lcpMs?: number | 'Not measured';
    cls?: number | 'Not measured';
    details: string;
  };
  pageData: CrawledPageData;
  findings: SeoFinding[];
  geoAeoRecommendations: string[];
  analyzedAt: string;
}

/**
 * Perform an SSRF-safe, deterministic Technical SEO and GEO Audit of a target website
 */
export async function analyzeWebsiteSeo(urlString: string, maxPages = 3): Promise<SeoAnalysisResult> {
  const safeUrl = await validateSafeUrl(urlString);
  const origin = safeUrl.origin;
  const domain = safeUrl.hostname;

  logger.info(`[SEO Auditor] Starting SSRF-safe crawl of ${origin} (max pages: ${maxPages})`);

  // 1. Fetch robots.txt
  let robotsTxtData = {
    status: 404,
    found: false,
    sitemaps: [] as string[],
    disallowedPaths: [] as string[]
  };

  try {
    const robotsUrl = new URL('/robots.txt', origin).toString();
    const robotsSafe = await validateSafeUrl(robotsUrl);
    const robotsRes = await fetch(robotsSafe.toString(), {
      headers: { 'User-Agent': 'MarketMateAI/SEO-Auditor/1.0' },
      signal: AbortSignal.timeout(5000)
    });

    robotsTxtData.status = robotsRes.status;
    if (robotsRes.ok) {
      robotsTxtData.found = true;
      const robotsText = await robotsRes.text();
      for (const line of robotsText.split('\n')) {
        const trimmed = line.trim();
        if (/^sitemap:/i.test(trimmed)) {
          const sm = trimmed.replace(/^sitemap:\s*/i, '').trim();
          if (sm) robotsTxtData.sitemaps.push(sm);
        } else if (/^disallow:/i.test(trimmed)) {
          const path = trimmed.replace(/^disallow:\s*/i, '').trim();
          if (path) robotsTxtData.disallowedPaths.push(path);
        }
      }
    }
  } catch (err: any) {
    logger.warn(`[SEO Auditor] Could not retrieve robots.txt: ${err.message}`);
  }

  // 2. Fetch sitemap.xml
  let sitemapData = {
    status: 404,
    found: false,
    url: robotsTxtData.sitemaps[0] || `${origin}/sitemap.xml`
  };

  try {
    const smSafe = await validateSafeUrl(sitemapData.url);
    const smRes = await fetch(smSafe.toString(), {
      headers: { 'User-Agent': 'MarketMateAI/SEO-Auditor/1.0' },
      signal: AbortSignal.timeout(5000)
    });
    sitemapData.status = smRes.status;
    sitemapData.found = smRes.ok;
  } catch (err: any) {
    logger.warn(`[SEO Auditor] Could not retrieve sitemap.xml: ${err.message}`);
  }

  // 3. Fetch Primary Target Page
  let html = '';
  let statusCode = 200;

  try {
    const pageRes = await fetch(safeUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketMateAI/SEO-Auditor/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    });

    statusCode = pageRes.status;
    if (!pageRes.ok) {
      throw new Error(`Target page returned HTTP status ${pageRes.status}`);
    }
    html = await pageRes.text();
  } catch (err: any) {
    // Return structured report for unreachable server
    return createUnreachableReport(safeUrl.toString(), domain, err.message);
  }

  const $ = cheerio.load(html);

  // 4. Extract Page Metadata & Headings
  const title = $('title').text().trim() || '';
  const titleLength = title.length;

  const description = $('meta[name="description"]').attr('content')?.trim() || '';
  const descriptionLength = description.length;

  const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim() || null;
  const robotsDirective = $('meta[name="robots"]').attr('content')?.trim() || null;

  const h1: string[] = [];
  $('h1').each((_, el) => {
    const text = $(el).text().trim();
    if (text) h1.push(text);
  });

  const h2: string[] = [];
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    if (text) h2.push(text);
  });

  const h3: string[] = [];
  $('h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text) h3.push(text);
  });

  // Images analysis
  let totalImages = 0;
  let missingAlt = 0;
  const samplesMissingAlt: string[] = [];

  $('img').each((_, el) => {
    totalImages++;
    const alt = $(el).attr('alt');
    const src = $(el).attr('src') || 'unknown';
    if (!alt || alt.trim() === '') {
      missingAlt++;
      if (samplesMissingAlt.length < 5) {
        samplesMissingAlt.push(src);
      }
    }
  });

  // Links analysis
  let internalCount = 0;
  let externalCount = 0;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    try {
      const link = new URL(href, safeUrl.origin);
      if (link.hostname === domain) {
        internalCount++;
      } else {
        externalCount++;
      }
    } catch {
      internalCount++;
    }
  });

  // JSON-LD structured data extraction
  const schemasFound: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      if (json['@type']) {
        schemasFound.push(String(json['@type']));
      } else if (Array.isArray(json['@graph'])) {
        for (const item of json['@graph']) {
          if (item['@type']) schemasFound.push(String(item['@type']));
        }
      }
    } catch {
      // ignore invalid json-ld
    }
  });

  // 5. Evaluate Performance (PageSpeed API if key configured, otherwise strictly "Not measured")
  let performanceData: SeoAnalysisResult['performance'] = {
    score: 'Not measured',
    details: 'Google PageSpeed Insights API key not configured in settings. Performance tests were not measured.'
  };

  const pagespeedKey = process.env.PAGESPEED_API_KEY;
  if (pagespeedKey) {
    try {
      const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(safeUrl.toString())}&key=${pagespeedKey}&strategy=mobile`;
      const psRes = await fetch(psUrl, { signal: AbortSignal.timeout(12000) });
      if (psRes.ok) {
        const psJson: any = await psRes.json();
        const lighthouse = psJson.lighthouseResult;
        if (lighthouse?.categories?.performance?.score != null) {
          const scorePercent = Math.round(lighthouse.categories.performance.score * 100);
          const fcp = lighthouse.audits?.['first-contentful-paint']?.numericValue;
          const lcp = lighthouse.audits?.['largest-contentful-paint']?.numericValue;
          const cls = lighthouse.audits?.['cumulative-layout-shift']?.numericValue;

          performanceData = {
            score: scorePercent,
            fcpMs: fcp ? Math.round(fcp) : undefined,
            lcpMs: lcp ? Math.round(lcp) : undefined,
            cls: cls != null ? Number(cls.toFixed(3)) : undefined,
            details: `Measured via Google Lighthouse Mobile API (Performance score: ${scorePercent}/100).`
          };
        }
      }
    } catch (err: any) {
      logger.warn(`[SEO Auditor] PageSpeed API error: ${err.message}`);
      performanceData = {
        score: 'Not measured',
        details: `PageSpeed query failed (${err.message}). Marked as Not measured.`
      };
    }
  }

  // 6. Build Standardized Findings Array & Compute Exact Score
  const findings: SeoFinding[] = [];
  let score = 100;

  // Title tag finding
  if (!title) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Missing Page Title Tag',
      actualValue: 'No <title> tag found',
      evidence: '<title></title> is missing or empty',
      fix: 'Add a descriptive <title> tag between 50-60 characters incorporating primary B2B keywords.',
      priority: 'critical'
    });
    score -= 25;
  } else if (titleLength < 30) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Short Title Tag',
      actualValue: `"${title}" (${titleLength} characters)`,
      evidence: `<title>${title}</title>`,
      fix: 'Expand title to 50-60 characters with secondary value propositions and brand name.',
      priority: 'warning'
    });
    score -= 10;
  } else if (titleLength > 65) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Title Tag Exceeds SERP Pixel Limit',
      actualValue: `"${title}" (${titleLength} characters)`,
      evidence: `<title>${title}</title>`,
      fix: 'Shorten title to under 60 characters to avoid ellipsis truncation in search results.',
      priority: 'warning'
    });
    score -= 5;
  } else {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Optimal Title Tag Length',
      actualValue: `"${title}" (${titleLength} characters)`,
      evidence: `<title>${title}</title>`,
      fix: 'Maintain current title tag length and search intent alignment.',
      priority: 'good'
    });
  }

  // Meta description finding
  if (!description) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Missing Meta Description',
      actualValue: 'No meta description tag found',
      evidence: '<meta name="description"> is absent from HTML <head>',
      fix: 'Provide a compelling meta description between 140-160 characters with a clear call-to-action.',
      priority: 'critical'
    });
    score -= 20;
  } else if (descriptionLength < 100) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Short Meta Description',
      actualValue: `"${description}" (${descriptionLength} characters)`,
      evidence: `<meta name="description" content="${description}">`,
      fix: 'Expand description to 140-160 characters incorporating target problems and benefits.',
      priority: 'warning'
    });
    score -= 8;
  } else if (descriptionLength > 165) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Meta Description May Be Truncated',
      actualValue: `"${description}" (${descriptionLength} characters)`,
      evidence: `<meta name="description" content="${description}">`,
      fix: 'Trim meta description to under 160 characters to fit desktop and mobile viewports.',
      priority: 'warning'
    });
    score -= 5;
  } else {
    findings.push({
      url: safeUrl.toString(),
      category: 'Meta & Titles',
      title: 'Well-Structured Meta Description',
      actualValue: `"${description}" (${descriptionLength} characters)`,
      evidence: `<meta name="description" content="${description}">`,
      fix: 'Keep description aligned with landing page messaging.',
      priority: 'good'
    });
  }

  // H1 Headings finding
  if (h1.length === 0) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Headings & Structure',
      title: 'Missing H1 Heading',
      actualValue: '0 H1 headings found',
      evidence: 'No <h1> tags in HTML body',
      fix: 'Add a single, authoritative <h1> heading describing the core product or service offering.',
      priority: 'critical'
    });
    score -= 20;
  } else if (h1.length > 1) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Headings & Structure',
      title: 'Multiple H1 Headings Detected',
      actualValue: `${h1.length} H1 headings found: ${h1.map(t => `"${t}"`).join(', ')}`,
      evidence: h1.map(t => `<h1>${t}</h1>`).join(' | '),
      fix: 'Consolidate page structure so only one primary <h1> heading exists; demote secondary headers to <h2>.',
      priority: 'warning'
    });
    score -= 8;
  } else {
    findings.push({
      url: safeUrl.toString(),
      category: 'Headings & Structure',
      title: 'Single Clear H1 Heading',
      actualValue: `"${h1[0]}"`,
      evidence: `<h1>${h1[0]}</h1>`,
      fix: 'Maintain primary keyword alignment in the H1 heading.',
      priority: 'good'
    });
  }

  // Canonical tag finding
  if (!canonicalUrl) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Indexing & Directives',
      title: 'Missing Canonical Tag',
      actualValue: 'None',
      evidence: 'No <link rel="canonical"> found in <head>',
      fix: `Add <link rel="canonical" href="${safeUrl.toString()}"> to prevent duplicate content indexing across HTTP/HTTPS and URL parameters.`,
      priority: 'warning'
    });
    score -= 10;
  } else {
    findings.push({
      url: safeUrl.toString(),
      category: 'Indexing & Directives',
      title: 'Canonical Tag Present',
      actualValue: canonicalUrl,
      evidence: `<link rel="canonical" href="${canonicalUrl}">`,
      fix: 'Verify canonical URL matches preferred indexable URL structure.',
      priority: 'good'
    });
  }

  // Robots meta finding
  if (robotsDirective) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Indexing & Directives',
      title: 'Robots Meta Directive Configured',
      actualValue: robotsDirective,
      evidence: `<meta name="robots" content="${robotsDirective}">`,
      fix: robotsDirective.toLowerCase().includes('noindex')
        ? 'WARNING: Page is explicitly set to NOINDEX. Remove noindex if this page is intended for organic search.'
        : 'Directive verified.',
      priority: robotsDirective.toLowerCase().includes('noindex') ? 'critical' : 'good'
    });
    if (robotsDirective.toLowerCase().includes('noindex')) score -= 30;
  } else {
    findings.push({
      url: safeUrl.toString(),
      category: 'Indexing & Directives',
      title: 'Default Robots Indexing',
      actualValue: 'No meta robots specified (defaults to index, follow)',
      evidence: '<meta name="robots"> tag absent',
      fix: 'Standard default search engine indexing applies.',
      priority: 'info'
    });
  }

  // Image Alt attributes finding
  if (totalImages > 0 && missingAlt > 0) {
    const missingPercent = Math.round((missingAlt / totalImages) * 100);
    findings.push({
      url: safeUrl.toString(),
      category: 'Media & Accessibility',
      title: 'Images Missing Alt Text',
      actualValue: `${missingAlt} of ${totalImages} images (${missingPercent}%) missing alt attributes`,
      evidence: `Sample images without alt: ${samplesMissingAlt.join(', ')}`,
      fix: 'Add descriptive alt text to all informational images to enhance screen reader accessibility and image SEO ranking.',
      priority: missingPercent > 30 ? 'warning' : 'info'
    });
    score -= missingPercent > 30 ? 10 : 5;
  } else if (totalImages > 0) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Media & Accessibility',
      title: 'All Images Contain Alt Text',
      actualValue: `All ${totalImages} images have alt attributes`,
      evidence: 'No empty alt tags found',
      fix: 'Maintain contextual alt descriptions on future uploads.',
      priority: 'good'
    });
  }

  // Structured Data (JSON-LD) finding
  if (schemasFound.length === 0) {
    findings.push({
      url: safeUrl.toString(),
      category: 'Structured Data',
      title: 'No JSON-LD Schema Markup Detected',
      actualValue: '0 schema types found',
      evidence: 'No <script type="application/ld+json"> blocks present',
      fix: 'Implement Organization, WebSite, or SoftwareApplication JSON-LD schema to unlock Google rich snippets.',
      priority: 'warning'
    });
    score -= 10;
  } else {
    findings.push({
      url: safeUrl.toString(),
      category: 'Structured Data',
      title: 'Structured Data (JSON-LD) Present',
      actualValue: `Schemas detected: ${schemasFound.join(', ')}`,
      evidence: schemasFound.map(s => `@type: ${s}`).join(', '),
      fix: 'Validate schema formatting with Google Rich Results Test.',
      priority: 'good'
    });
  }

  // Robots.txt finding
  if (!robotsTxtData.found) {
    findings.push({
      url: `${origin}/robots.txt`,
      category: 'Indexing & Directives',
      title: 'robots.txt Not Found (HTTP 404)',
      actualValue: `HTTP status ${robotsTxtData.status}`,
      evidence: `GET ${origin}/robots.txt returned ${robotsTxtData.status}`,
      fix: 'Create a robots.txt file at the domain root with standard crawl directives and a link to your sitemap.',
      priority: 'warning'
    });
    score -= 5;
  } else {
    findings.push({
      url: `${origin}/robots.txt`,
      category: 'Indexing & Directives',
      title: 'robots.txt Active',
      actualValue: `Status ${robotsTxtData.status} (Disallowed rules: ${robotsTxtData.disallowedPaths.length})`,
      evidence: `robots.txt found with ${robotsTxtData.sitemaps.length} declared sitemaps`,
      fix: 'Ensure critical content paths are not inadvertently blocked.',
      priority: 'good'
    });
  }

  // Sitemap finding
  if (!sitemapData.found) {
    findings.push({
      url: sitemapData.url,
      category: 'Indexing & Directives',
      title: 'XML Sitemap Not Accessible',
      actualValue: `HTTP status ${sitemapData.status}`,
      evidence: `GET ${sitemapData.url} returned ${sitemapData.status}`,
      fix: 'Deploy an XML sitemap at /sitemap.xml and submit it to Google Search Console and Bing Webmaster Tools.',
      priority: 'warning'
    });
    score -= 5;
  } else {
    findings.push({
      url: sitemapData.url,
      category: 'Indexing & Directives',
      title: 'XML Sitemap Accessible',
      actualValue: `HTTP status ${sitemapData.status}`,
      evidence: `Accessible at ${sitemapData.url}`,
      fix: 'Ensure sitemap is submitted to search engines and updated automatically on new page publication.',
      priority: 'good'
    });
  }

  // Performance finding
  if (performanceData.score === 'Not measured') {
    findings.push({
      url: safeUrl.toString(),
      category: 'Performance & Core Web Vitals',
      title: 'Core Web Vitals & Speed',
      actualValue: 'Not measured',
      evidence: 'PageSpeed API key is not configured in settings',
      fix: 'Add a Google PageSpeed API key in Settings to measure real FCP, LCP, CLS, and Lighthouse performance.',
      priority: 'not_checked'
    });
  } else {
    findings.push({
      url: safeUrl.toString(),
      category: 'Performance & Core Web Vitals',
      title: 'Lighthouse Performance Score',
      actualValue: `${performanceData.score}/100`,
      evidence: `FCP: ${performanceData.fcpMs}ms, LCP: ${performanceData.lcpMs}ms, CLS: ${performanceData.cls}`,
      fix: performanceData.score < 50
        ? 'Critical speed bottlenecks detected. Optimize JavaScript execution, compress hero images, and leverage CDN caching.'
        : 'Performance is within acceptable thresholds.',
      priority: performanceData.score < 50 ? 'critical' : performanceData.score < 80 ? 'warning' : 'good'
    });
  }

  // Normalized final score (minimum 10, maximum 100)
  const finalScore = Math.max(10, Math.min(100, score));

  // 7. GEO / AEO AI Engine Recommendations
  const geoAeoRecommendations = [
    `Establish direct entity identity: Add Schema.org 'Organization' JSON-LD markup declaring name, official URL (${safeUrl.toString()}), logo, and sameAs social profiles.`,
    `Optimize for Generative Search Answers: Provide concise definition blocks (40-60 words) immediately beneath <h2> question headings to qualify for AI citations (Perplexity, Google AI Overviews).`,
    `Author & Expertise Authority: Ensure leadership and author profiles link to verified LinkedIn credentials to satisfy search engine E-E-A-T signals.`,
    `Maintain high crawl efficiency: Ensure robots.txt explicitly permits reputable search index crawlers and references a clean /sitemap.xml.`
  ];

  const pageData: CrawledPageData = {
    url: safeUrl.toString(),
    statusCode,
    title,
    titleLength,
    description,
    descriptionLength,
    canonicalUrl,
    robotsDirective,
    headings: { h1, h2, h3 },
    images: { total: totalImages, missingAlt, samplesMissingAlt },
    links: { internalCount, externalCount },
    schemasFound
  };

  return {
    url: safeUrl.toString(),
    domain,
    statusCode,
    score: finalScore,
    crawledPagesCount: 1,
    robotsTxt: robotsTxtData,
    sitemap: sitemapData,
    performance: performanceData,
    pageData,
    findings,
    geoAeoRecommendations,
    analyzedAt: new Date().toISOString()
  };
}

function createUnreachableReport(url: string, domain: string, errorMsg: string): SeoAnalysisResult {
  return {
    url,
    domain,
    statusCode: 0,
    score: 10,
    crawledPagesCount: 0,
    robotsTxt: { status: 0, found: false, sitemaps: [], disallowedPaths: [] },
    sitemap: { status: 0, found: false, url: `${url}/sitemap.xml` },
    performance: { score: 'Not measured', details: 'Server is unreachable.' },
    pageData: {
      url,
      statusCode: 0,
      title: '(Unreachable)',
      titleLength: 0,
      description: '(Unreachable)',
      descriptionLength: 0,
      canonicalUrl: null,
      robotsDirective: null,
      headings: { h1: [], h2: [], h3: [] },
      images: { total: 0, missingAlt: 0, samplesMissingAlt: [] },
      links: { internalCount: 0, externalCount: 0 },
      schemasFound: []
    },
    findings: [
      {
        url,
        category: 'Indexing & Directives',
        title: 'Server Connection Timeout / Unreachable',
        actualValue: `Error: ${errorMsg}`,
        evidence: `Direct HTTP connection to ${domain} failed`,
        fix: 'Verify domain DNS configuration, SSL certificates, and ensure firewall permits incoming HTTP traffic.',
        priority: 'critical'
      }
    ],
    geoAeoRecommendations: ['Ensure 99.9% web server uptime before indexing.'],
    analyzedAt: new Date().toISOString()
  };
}
