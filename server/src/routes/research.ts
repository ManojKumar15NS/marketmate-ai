import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { geminiService } from '../services/gemini.js';
import { store } from '../services/store.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const researchRequestSchema = z.object({
  topic: z.string().min(2, 'Research topic cannot be empty').trim(),
  industry: z.string().optional(),
  targetRegion: z.string().optional()
});

// POST /api/research - Conduct live web research with search grounding
router.post('/', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic, industry, targetRegion } = researchRequestSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const searchQuery = `${topic} ${industry || ''} ${targetRegion || ''} companies services analysis competitors market report`.trim();
    
    // 1. Perform Grounded Web Search
    const searchData = await geminiService.searchWithGrounding(searchQuery);

    // 2. Synthesize structured competitor / market report
    const synthesisPrompt = `You are a Senior Market Research Analyst.
Based on the following verified search findings:
"${searchData.summary}"

Prepare an executive market research report on: "${topic}" (${targetRegion || 'Global'}).

Format your response in structured Markdown:
## 1. Executive Summary
## 2. Top Companies / Competitor Landscape (Include services, target audience, and positioning)
## 3. Ideal Customer Profile (ICP) & Target Audience Breakdown
## 4. Market Gaps & Strategic Differentiators
## 5. Strategic Recommendations

Do not invent facts. Use the provided search evidence.`;

    const report = await geminiService.generateText(synthesisPrompt);

    // Save as persistent task
    const task = await store.saveTask({
      id: `res_${Date.now()}`,
      instruction: `Market Research: ${topic}`,
      category: 'Market & Competitor Research',
      status: 'completed',
      startTime: new Date().toISOString(),
      completionTime: new Date().toISOString(),
      result: report
    });

    res.json({
      taskId: task.id,
      topic,
      report,
      sources: searchData.sources
    });
  } catch (err) {
    next(err);
  }
});

export default router;
