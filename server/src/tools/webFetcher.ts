import dns from 'dns/promises';
import * as cheerio from 'cheerio';

// SSRF Protection: Deny private, loopback, and link-local IP addresses
function isPrivateIp(ip: string): boolean {
  // IPv4 private & loopback ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 127) return true; // 127.0.0.0/8
    if (parts[0] === 10) return true;  // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (link-local / AWS metadata)
    if (parts[0] === 0) return true; // 0.0.0.0
  }
  // IPv6 loopback & unique local
  if (ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true;
  }
  return false;
}

export async function validateSafeUrl(urlString: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL format: ${urlString}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${parsed.protocol}. Only http and https are allowed.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Deny localhost and cloud metadata hostnames
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254' ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    throw new Error(`Access to internal/private hosts (${hostname}) is blocked for security.`);
  }

  // Resolve hostname and check IP
  try {
    const lookup = await dns.lookup(hostname);
    if (isPrivateIp(lookup.address)) {
      throw new Error(`DNS resolution resolved to private IP (${lookup.address}). Access blocked.`);
    }
  } catch (err: any) {
    if (err.message.includes('Access blocked')) throw err;
    throw new Error(`Unable to resolve host: ${hostname}`);
  }

  return parsed;
}

/**
 * Universal SSRF-safe fetch wrapper. Validates protocol, hostname, and resolved IP before connecting.
 */
export async function safeFetch(urlString: string, init?: RequestInit, maxRedirects: number = 5): Promise<Response> {
  let currentUrl = urlString;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safeUrl = await validateSafeUrl(currentUrl);
    const response = await fetch(safeUrl.toString(), {
      ...init,
      redirect: 'manual'
    });
    // Intercept redirects and re-validate destination URL against SSRF policy
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return response;
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}

export interface FetchedWebpage {
  url: string;
  title: string;
  description: string;
  text: string;
  htmlLength: number;
}

export async function fetchWebpage(urlString: string): Promise<FetchedWebpage> {
  const safeUrl = await validateSafeUrl(urlString);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MarketMateAI/1.0 (Marketing Assistant Bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
      throw new Error(`Unsupported content type: ${contentType}. Expected HTML.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise scripts, styles, iframes
    $('script, style, noscript, svg, nav, footer, iframe').remove();

    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    
    // Extract main text content
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const truncatedText = bodyText.length > 8000 ? bodyText.substring(0, 8000) + '... [content truncated]' : bodyText;

    return {
      url: safeUrl.toString(),
      title,
      description,
      text: truncatedText,
      htmlLength: html.length
    };
  } finally {
    clearTimeout(timeout);
  }
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Live web search using Tavily Search API (primary) with DuckDuckGo fallback
 * Ensures verified real-time sources and links even if API grounding quota is reached
 */
export async function searchLiveWeb(query: string, maxResults: number = 8): Promise<WebSearchResultItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  // 1. Tavily Search API (when TAVILY_API_KEY configured)
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const tRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: maxResults,
          search_depth: 'basic'
        }),
        signal: controller.signal
      });

      if (tRes.ok) {
        const tData: any = await tRes.json();
        if (Array.isArray(tData.results) && tData.results.length > 0) {
          clearTimeout(timeout);
          return tData.results.map((r: any) => ({
            title: r.title || query,
            url: r.url,
            snippet: r.content || ''
          }));
        }
      }
    } catch (err: any) {
      console.warn('[searchLiveWeb] Tavily notice, falling back to html search:', err.message);
    }
  }

  // 2. Fallback: DuckDuckGo HTML endpoint
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      throw new Error(`Web search failed with status ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: WebSearchResultItem[] = [];

    $('.result').each((_, el) => {
      if (results.length >= maxResults) return;
      const title = $(el).find('.result__title a').text().trim();
      let link = $(el).find('.result__url').attr('href') || $(el).find('.result__title a').attr('href') || '';
      const snippet = $(el).find('.result__snippet').text().trim();

      if (link.includes('uddg=')) {
        const match = link.match(/uddg=([^&]+)/);
        if (match) link = decodeURIComponent(match[1]);
      }

      if (title && link.startsWith('http')) {
        results.push({ title, url: link, snippet });
      }
    });

    return results;
  } catch (err: any) {
    console.warn('[searchLiveWeb] Live search warning:', err.message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

