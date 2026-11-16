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

// POST /api/research - Conduct live web research with multi-angle grounding on any domain/area
router.post('/', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic, industry, targetRegion } = researchRequestSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const cleanTopic = topic.trim();
    const cleanIndustry = industry && industry.trim() ? industry.trim() : '';
    const regionTerm = targetRegion && targetRegion !== 'Global' ? targetRegion.trim() : '';

    // 1. Execute Multi-Angle Targeted Web Searches for the specific domain and target area
    const query1 = `"${cleanTopic}" ${cleanIndustry} ${regionTerm} market size valuation growth trends forecast revenue CAGR statistics`.trim();
    const query2 = `top leading companies competitors brands in "${cleanTopic}" ${cleanIndustry} ${regionTerm} market share`.trim();
    const query3 = `"${cleanTopic}" in ${regionTerm} industry report key players customer profile`.trim();

    const [hits1, hits2, hits3] = await Promise.all([
      searchLiveWeb(query1, 6).catch(() => []),
      searchLiveWeb(query2, 6).catch(() => []),
      searchLiveWeb(query3, 4).catch(() => [])
    ]);

    const allHits = [...hits1, ...hits2, ...hits3];

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const uniqueHits = allHits.filter(h => {
      if (!h.url || seenUrls.has(h.url)) return false;
      seenUrls.add(h.url);
      return true;
    });

    let contextSnippet = '';
    const sources: Array<{ title: string; url: string; snippet?: string }> = [];

    if (uniqueHits.length >= 2) {
      uniqueHits.forEach((h, i) => {
        sources.push({ title: h.title, url: h.url, snippet: h.snippet });
        contextSnippet += `[Source ${i + 1}] Title: ${h.title}\nURL: ${h.url}\nSummary: ${h.snippet}\n\n`;
      });
    } else {
      // Direct live search grounding with Gemini fallback
      const fallbackQuery = `comprehensive market research "${cleanTopic}" ${cleanIndustry} ${regionTerm} market size leading competitors companies ICP trends statistics`.trim();
      const fallbackData = await geminiService.searchWithGrounding(fallbackQuery);
      contextSnippet = fallbackData.summary;
      if (fallbackData.sources && fallbackData.sources.length > 0) {
        sources.push(...fallbackData.sources);
      }
    }

    // 2. Synthesize structured, domain-accurate market intelligence report
    const synthesisPrompt = `You are an elite Senior Market Research Analyst & Strategy Director.
Conduct an in-depth, rigorous, highly data-driven market research report on: "${cleanTopic}"${regionTerm ? ` in ${regionTerm}` : ''}${cleanIndustry ? ` (Domain/Sector: ${cleanIndustry})` : ''}.

STRICT ACCURACY & RELEVANCE RULES:
1. STRICT DOMAIN FOCUS: Analyze specifically the businesses, products, services, market dynamics, and customers of "${cleanTopic}". NEVER introduce unrelated industry domains (such as healthcare, cloud computing, or DevOps) unless the user's topic explicitly requested them.
2. REGIONAL FOCUS: If a target area or location was provided ("${regionTerm || 'Global'}"), tailor the competitive landscape, market size, regulatory context, and consumer behavior specifically to that geography.
3. CONCRETE DATA & MARKET METRICS: Report actual market figures, market valuations (in USD and local currency where relevant), CAGR projections, estimated unit volumes / customer counts, and percentage shares.
4. REAL COMMERCIAL PLAYERS: Name actual leading organizations, commercial providers, and brands active in this specific domain and geography.

Provide your report in clean, authoritative Markdown format:

# Comprehensive Market Research & Intelligence Brief: ${cleanTopic} ${regionTerm ? `(${regionTerm})` : ''}

## 1. Executive Summary & Domain Overview
- Overview of the "${cleanTopic}" domain and business ecosystem in ${regionTerm || 'the target market'}.
- Industry lifecycle stage (emerging, high-growth, consolidating, mature).
- Industry structure (distribution between organized market leaders vs. regional/independent providers).

## 2. Market Size, Valuation & Financial Growth Projections
- Current Market Size / Valuation (figures in USD and local currency where applicable).
- Forecasted Growth Rate & CAGR with timeline projections.
- Key revenue segments and value-driver product/service categories.

## 3. Competitive Landscape & Leading Market Players
- Detailed breakdown of 5 to 7 key companies, brands, or service providers operating in this space:
  * Company Name & Overview
  * Core Product/Service Offerings & Positioning
  * Geographic Footprint & Estimated Market Presence
  * Competitive Strengths & Differentiators

## 4. Target Audience & Ideal Customer Profiles (ICPs)
- Segment 1: Primary / High-Volume Customer Segment (demographics/firmographics, core needs, purchasing triggers).
- Segment 2: Premium / Enterprise / High-Margin Segment (specialized requirements, budget authority, willingness to pay).
- Segment 3: Underserved or Emerging Growth Niche.

## 5. Market Demand Drivers, Tailwinds & Trends
- Primary growth drivers fueling demand for ${cleanTopic}.
- Technological advancements, behavioral shifts, or economic tailwinds accelerating adoption.
- Regulatory, government, or macroeconomic factors impacting the domain.

## 6. Industry Challenges, Risks & Market Gaps
- Core operational, supply-chain, regulatory, or economic obstacles faced by businesses in this sector.
- Common customer complaints, quality gaps, or underserved market pain points.
- Pricing pressure, margin considerations, and competitive friction.

## 7. Strategic Growth Opportunities & Actionable Playbook
- High-impact go-to-market strategies and customer acquisition channels.
- Product/service expansion opportunities and competitive differentiation tactics.
- Actionable steps for capturing market share in ${regionTerm || 'this target market'}.

VERIFIED RESEARCH EVIDENCE:
${contextSnippet}

Ground your analysis strictly in verified facts and evidence. Write clearly, authoritatively, and without placeholders.`;

    const report = await geminiService.generateText(synthesisPrompt);

    // Save as persistent task
    const task = await store.saveTask({
      id: `res_${Date.now()}`,
      instruction: `Market Research: ${cleanTopic}${regionTerm ? ` (${regionTerm})` : ''}`,
      category: 'Market & Competitor Research',
      status: 'completed',
      startTime: new Date().toISOString(),
      completionTime: new Date().toISOString(),
      result: report
    });

    res.json({
      taskId: task.id,
      topic: cleanTopic,
      region: regionTerm,
      industry: cleanIndustry,
      report,
      sources
    });
  } catch (err) {
    next(err);
  }
});

export default router;
