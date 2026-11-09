import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { geminiService } from '../services/gemini.js';
import { store } from '../services/store.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';
import { searchLiveWeb } from '../tools/webFetcher.js';

const router = Router();

const researchRequestSchema = z.object({
  topic: z.string().min(2, 'Research topic cannot be empty').trim(),
  industry: z.string().optional(),
  targetRegion: z.string().optional()
});

// POST /api/research - Conduct live web research with multi-angle grounding
router.post('/', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic, industry, targetRegion } = researchRequestSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const cleanTopic = topic.trim();
    const cleanIndustry = industry && industry.trim() ? industry.trim() : '';
    const regionTerm = targetRegion && targetRegion !== 'Global' ? targetRegion : '';

    // 1. Execute Multi-Angle Targeted Web Searches
    const query1 = `"${cleanTopic}" ${cleanIndustry} ${regionTerm} market size revenue CAGR number of hospitals clinics statistics`.trim();
    const query2 = `top leading "${cleanTopic}" chains companies brands in ${regionTerm} market share centers locations`.trim();

    const [hits1, hits2] = await Promise.all([
      searchLiveWeb(query1, 6).catch(() => []),
      searchLiveWeb(query2, 6).catch(() => [])
    ]);

    const allHits = [...hits1, ...hits2];

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueHits = allHits.filter(h => {
      if (!h.url || seenUrls.has(h.url)) return false;
      seenUrls.add(h.url);
      return true;
    });

    let contextSnippet = '';
    const sources: Array<{ title: string; url: string; snippet?: string }> = [];

    if (uniqueHits.length > 0) {
      uniqueHits.forEach((h, i) => {
        sources.push({ title: h.title, url: h.url, snippet: h.snippet });
        contextSnippet += `[Source ${i + 1}] Title: ${h.title}\nURL: ${h.url}\nSummary: ${h.snippet}\n\n`;
      });
    } else {
      // Fallback to grounded search
      const fallbackQuery = `"${cleanTopic}" ${cleanIndustry} ${regionTerm} market size industry overview competitors`.trim();
      const fallbackData = await geminiService.searchWithGrounding(fallbackQuery);
      contextSnippet = fallbackData.summary;
      sources.push(...fallbackData.sources);
    }

    // 2. Synthesize structured, in-depth market research report
    const synthesisPrompt = `You are an elite Senior Market Research Analyst & Strategy Director.
Conduct an in-depth, rigorous, data-driven market research report on: "${cleanTopic}" in ${targetRegion || 'Global'}${cleanIndustry ? ` (Industry Sector: ${cleanIndustry})` : ''}.

STRICT ACCURACY RULES:
1. FOCUS DIRECTLY ON "${cleanTopic}": Analyze the actual businesses, institutions, facilities, and patients/customers of this specific sector. DO NOT drift into generic auxiliary topics (such as cloud computing, IT outsourcing, or DevOps) unless the topic itself explicitly requested IT infrastructure.
2. EXTRACT CONCRETE DATA: Report actual market figures, market sizes (in USD and local currency e.g. INR/EUR), CAGR percentages, surgical/patient volumes, facility counts, and percentage shares.
3. PROFILE REAL INDUSTRY LEADERS: Name the actual leading organizations, hospital chains, or brands operating in this sector (with number of centers, geographic footprint, and business models).

Provide your report in structured, detailed Markdown:

# Comprehensive Market Research & Competitive Intelligence Report: ${cleanTopic} (${targetRegion || 'Global'})

## 1. Executive Summary & Market Snapshot
- High-level overview of the ${cleanTopic} sector in ${targetRegion || 'Global'}.
- Market maturity stage (emerging, high-growth, consolidating, mature).
- Industry structure & fragmentation (e.g. split between standalone unorganized providers vs. organized chains).

## 2. Market Size, Valuation & Financial Projections
- Current Market Size / Valuation (provide both USD and local currency figures where available).
- Forecasted Growth & CAGR (projected timeline, e.g., 2024–2030).
- Key revenue segments (e.g., surgical procedures, outpatient diagnostics, optical/pharmacy sales, elective vs. non-elective care).

## 3. Industry Scale, Volume & Facility Breakdown
- Estimated total number of hospitals, clinics, or dedicated specialty centers in ${targetRegion || 'Global'}.
- Chain penetration rate: % share of organized chains vs. standalone unorganized practices.
- Operational & procedure volume metrics (e.g. annual surgeries, footfalls, bed occupancy, doctor-to-patient ratios).

## 4. Key Demand Drivers & Market Tailwinds
- Core growth catalysts (aging demographics, rising prevalence of chronic conditions, increased digital screen time, lifestyle shifts).
- Economic tailwinds (rising disposable income, private health insurance penetration, corporate wellness).
- Government schemes & regulatory policies supporting sector expansion.

## 5. Competitive Landscape & Top Market Players
- Detailed breakdown of the top 5–7 leading chains / companies in this sector.
- For each player:
  * Name & Overview
  * Estimated Centers / Network Size & Footprint
  * Core Specialties & Service Positioning
  * Business Model (e.g., Corporate/Private Equity backed vs. Charitable Trust/Non-profit)
  * Estimated Market Share or Competitive Advantage

## 6. Customer & Patient Segmentation (Ideal Customer Profiles)
- Profile 1: Core / High-Volume Need Segment (demographics, needs, purchasing behavior, payment source).
- Profile 2: High-Margin / Elective Treatment Segment (e.g. advanced refractive, premium technology, aesthetic).
- Profile 3: Under-served / Tier-2 & Tier-3 Segment (affordability constraints, access barriers).
- Medical Tourism / Cross-Border Patient Potential (if applicable to ${targetRegion || 'Global'}).

## 7. Market Challenges, Gaps & Unmet Needs
- Key operational and structural pain points (e.g., doctor/specialist shortages, high capex for equipment, tier-2/3 penetration barriers).
- Quality and standardization variance across providers.
- Pricing pressure vs. rising operational costs.

## 8. Strategic Marketing & Growth Playbook
- High-impact patient acquisition channels (local hyper-targeted SEO, community outreach camps, digital booking engines).
- Doctor & Clinician Referral Network strategies (building trust with primary care physicians).
- Expansion Playbook: Hub-and-Spoke model into Tier-2/3 cities.
- High-Margin Service Upselling (patient counseling, premium lens/technology adoption).

VERIFIED SEARCH EVIDENCE:
${contextSnippet}

Ground your insights in the verified web evidence above and industry facts. Write authoritatively and thoroughly without placeholders. Cite sources where appropriate.`;

    const report = await geminiService.generateText(synthesisPrompt);

    // Save as persistent task
    const task = await store.saveTask({
      id: `res_${Date.now()}`,
      instruction: `Market Research: ${cleanTopic}`,
      category: 'Market & Competitor Research',
      status: 'completed',
      startTime: new Date().toISOString(),
      completionTime: new Date().toISOString(),
      result: report
    });

    res.json({
      taskId: task.id,
      topic: cleanTopic,
      report,
      sources
    });
  } catch (err) {
    next(err);
  }
});

export default router;
