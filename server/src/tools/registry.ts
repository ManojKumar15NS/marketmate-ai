import { Type } from '@google/genai';
import { geminiService } from '../services/gemini.js';
import { store } from '../services/store.js';
import { fetchWebpage } from './webFetcher.js';
import { analyzeWebsiteSeo } from './websiteAnalysis.js';
import { prospectingEngine } from '../agents/prospector.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: any;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
}

// 1. Tool Function Declarations for Gemini
export const toolDeclarations: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Searches the live web using Google Search to research companies, competitors, news, industry trends, and products. Returns real sources, links, and verified findings.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query to look up on the live web.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'fetch_webpage',
    description: 'Safely retrieves and extracts readable text and meta tags from a public webpage URL with SSRF protection.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'The HTTP or HTTPS URL of the website to retrieve.'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'analyze_website',
    description: 'Runs a deep technical and on-page SEO audit on a website URL: evaluates title, meta description, H1-H3 headings, image alt tags, canonicals, links, and GEO/AEO readiness.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'The website URL to audit for SEO.'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'extract_keywords',
    description: 'Extracts primary keywords, key phrases (1, 2, 3-word n-grams), and calculates keyword density from text content.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: 'The content text from which to extract keywords.'
        },
        limit: {
          type: Type.NUMBER,
          description: 'Maximum number of keywords to return (default 10).'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'generate_email',
    description: 'Generates a high-converting multi-step cold outreach sequence, subject lines, preheaders, and follow-ups with selected tone.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetAudience: { type: Type.STRING, description: 'Target persona (e.g. CTOs, VP Marketing)' },
        valueProposition: { type: Type.STRING, description: 'Core offer and benefits' },
        tone: { type: Type.STRING, description: 'Tone: Professional, Friendly, Persuasive, Informative, Promotional' },
        touchpoints: { type: Type.NUMBER, description: 'Number of sequence emails (1 to 5)' }
      },
      required: ['targetAudience', 'valueProposition']
    }
  },
  {
    name: 'generate_social_post',
    description: 'Generates structured social media content for LinkedIn, X (Twitter), or Instagram with engaging hooks, takeaways, and hashtags.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platform: { type: Type.STRING, description: 'Platform: LinkedIn, Twitter, Instagram' },
        topic: { type: Type.STRING, description: 'The topic or theme of the post' },
        audience: { type: Type.STRING, description: 'Target audience' },
        tone: { type: Type.STRING, description: 'Tone of voice' }
      },
      required: ['platform', 'topic']
    }
  },
  {
    name: 'analyze_data',
    description: 'Performs mathematical calculations on marketing metrics: calculates CTR, Conversion Rate, CPC, CPA, ROAS, and generates performance insights.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        impressions: { type: Type.NUMBER, description: 'Total impressions' },
        clicks: { type: Type.NUMBER, description: 'Total clicks' },
        conversions: { type: Type.NUMBER, description: 'Total conversions' },
        spend: { type: Type.NUMBER, description: 'Total ad spend or campaign cost' },
        revenue: { type: Type.NUMBER, description: 'Total revenue generated (optional)' }
      },
      required: ['clicks']
    }
  },
  {
    name: 'create_report',
    description: 'Generates and saves a structured market research or marketing strategy report with sections and source links.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Report title' },
        executiveSummary: { type: Type.STRING, description: 'Executive summary' },
        findings: { type: Type.STRING, description: 'Detailed findings and analysis' },
        sources: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'List of source URLs and citations'
        }
      },
      required: ['title', 'findings']
    }
  },
  {
    name: 'save_task',
    description: 'Updates and saves task execution progress, steps, and results into persistent storage.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING, description: 'Task ID' },
        status: { type: Type.STRING, description: 'pending, running, completed, or failed' },
        result: { type: Type.STRING, description: 'Summary of the completed task result' }
      },
      required: ['taskId', 'status']
    }
  },
  {
    name: 'discover_leads',
    description: 'Discovers target B2B companies, maps key decision-makers (CEOs, CTOs, VP Marketing), derives verified corporate email addresses with live DNS MX checking, and computes ICP fit scores.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        industry: { type: Type.STRING, description: 'Target industry or vertical (e.g. Cloud Migration, FinTech, SaaS)' },
        geography: { type: Type.STRING, description: 'Target geography or country (e.g. India, North America, UK)' },
        targetRoles: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Target roles/titles to map (e.g. ["CTO", "Head of Engineering", "CEO"])'
        },
        limit: { type: Type.NUMBER, description: 'Number of verified companies/leads to discover (default 5, max 15)' },
        query: { type: Type.STRING, description: 'Optional custom search query for niche prospecting' }
      },
      required: ['industry']
    }
  }
];

// Helper: Stop words for keyword extractor
const STOP_WORDS = new Set([
  'the', 'and', 'to', 'of', 'a', 'in', 'that', 'is', 'for', 'it', 'with', 'as', 'was', 'on', 'at', 'by',
  'an', 'be', 'this', 'which', 'or', 'from', 'but', 'not', 'are', 'your', 'all', 'have', 'new', 'more',
  'can', 'we', 'our', 'will', 'an', 'they', 'their', 'has', 'about', 'out', 'up', 'one', 'what', 'so'
]);

// 2. Tool Execution Dispatcher
export async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'web_search': {
        const query = args.query;
        if (!query) throw new Error('Search query is required.');
        const result = await geminiService.searchWithGrounding(query);
        return {
          tool: name,
          success: true,
          data: result
        };
      }

      case 'fetch_webpage': {
        const url = args.url;
        if (!url) throw new Error('URL is required.');
        const page = await fetchWebpage(url);
        return {
          tool: name,
          success: true,
          data: page
        };
      }

      case 'analyze_website': {
        const url = args.url;
        if (!url) throw new Error('Website URL is required.');
        const audit = await analyzeWebsiteSeo(url);
        return {
          tool: name,
          success: true,
          data: audit
        };
      }

      case 'extract_keywords': {
        const text = args.text || '';
        const limit = args.limit || 10;
        const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        const filtered = words.filter((w: string) => !STOP_WORDS.has(w));
        const freq: Record<string, number> = {};
        filtered.forEach((w: string) => { freq[w] = (freq[w] || 0) + 1; });

        const totalWords = words.length || 1;
        const sorted = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([keyword, count]) => ({
            keyword,
            count,
            density: Number(((count / totalWords) * 100).toFixed(2)) + '%'
          }));

        return {
          tool: name,
          success: true,
          data: { totalWords, uniqueKeywords: Object.keys(freq).length, topKeywords: sorted }
        };
      }

      case 'generate_email': {
        const { targetAudience, valueProposition, tone = 'Professional', touchpoints = 3 } = args;
        const emailPrompt = `Generate a ${touchpoints}-step cold email sequence for ${targetAudience} promoting: "${valueProposition}". Tone: ${tone}. Include Subject lines, preheaders, and strong CTAs.`;
        const generated = await geminiService.generateText(emailPrompt);
        return {
          tool: name,
          success: true,
          data: { sequence: generated, tone, touchpoints }
        };
      }

      case 'generate_social_post': {
        const { platform = 'LinkedIn', topic, audience = 'B2B Professionals', tone = 'Engaging' } = args;
        const postPrompt = `Create 2 high-converting ${platform} posts about "${topic}" targeted at ${audience}. Tone: ${tone}. Include attention-grabbing hooks, clean bulleted insights, and relevant hashtags.`;
        const generated = await geminiService.generateText(postPrompt);
        return {
          tool: name,
          success: true,
          data: { platform, content: generated }
        };
      }

      case 'analyze_data': {
        const impressions = Number(args.impressions) || 0;
        const clicks = Number(args.clicks) || 0;
        const conversions = Number(args.conversions) || 0;
        const spend = Number(args.spend) || 0;
        const revenue = Number(args.revenue) || 0;

        const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null;
        const conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : null;
        const cpc = clicks > 0 && spend > 0 ? Number((spend / clicks).toFixed(2)) : null;
        const cpa = conversions > 0 && spend > 0 ? Number((spend / conversions).toFixed(2)) : null;
        const roas = spend > 0 && revenue > 0 ? Number((revenue / spend).toFixed(2)) : null;

        const insights: string[] = [];
        if (ctr !== null) {
          if (ctr < 1.0) insights.push(`CTR of ${ctr}% is below industry average (1.5-2.5%). Test stronger visual hooks and subject lines.`);
          else insights.push(`Strong CTR of ${ctr}%, indicating high audience relevance and engaging copy.`);
        }
        if (conversionRate !== null) {
          if (conversionRate < 2.0) insights.push(`Conversion rate (${conversionRate}%) suggests landing page drop-off. Simplify form fields and clarify value proposition.`);
          else insights.push(`Healthy conversion rate (${conversionRate}%).`);
        }
        if (roas !== null) {
          insights.push(`ROAS of ${roas}x (${roas > 3.0 ? 'Highly profitable' : roas > 1.0 ? 'Positive return' : 'Loss-making; requires CPA reduction'}).`);
        }

        return {
          tool: name,
          success: true,
          data: {
            metrics: { impressions, clicks, conversions, spend, revenue },
            calculated: {
              ctr: ctr !== null ? `${ctr}%` : 'N/A',
              conversionRate: conversionRate !== null ? `${conversionRate}%` : 'N/A',
              cpc: cpc !== null ? `$${cpc}` : 'N/A',
              cpa: cpa !== null ? `$${cpa}` : 'N/A',
              roas: roas !== null ? `${roas}x` : 'N/A'
            },
            insights
          }
        };
      }

      case 'create_report': {
        const { title, executiveSummary, findings, sources = [] } = args;
        const reportId = `rep_${Date.now()}`;
        return {
          tool: name,
          success: true,
          data: {
            reportId,
            title,
            executiveSummary,
            findings,
            sources,
            generatedAt: new Date().toISOString()
          }
        };
      }

      case 'save_task': {
        const { taskId, status, result } = args;
        const existing = await store.getTask(taskId);
        if (existing) {
          existing.status = status;
          existing.result = result;
          if (status === 'completed' || status === 'failed') {
            existing.completionTime = new Date().toISOString();
          }
          await store.saveTask(existing);
        }
        return {
          tool: name,
          success: true,
          data: { taskId, updated: Boolean(existing) }
        };
      }

      case 'discover_leads': {
        const { industry, geography, targetRoles, limit = 5 } = args;
        const leads = await prospectingEngine.prospectLeads({
          industry: industry || 'Technology & Cloud',
          location: geography || 'Global',
          targetRoles: Array.isArray(targetRoles) ? targetRoles : (targetRoles ? [String(targetRoles)] : ['CTO', 'VP Engineering', 'Founder']),
          limit: Math.min(Number(limit) || 5, 15)
        });
        return {
          tool: name,
          success: true,
          data: {
            discoveredCount: leads.length,
            leads
          }
        };
      }

      default:
        throw new Error(`Tool "${name}" is not registered in MarketMate AI tool registry.`);
    }
  } catch (err: any) {
    return {
      tool: name,
      success: false,
      error: err.message || String(err)
    };
  }
}
