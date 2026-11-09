import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { analyzeWebsiteSeo } from '../tools/websiteAnalysis.js';
import { geminiService } from '../services/gemini.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const seoAnalyzeSchema = z.object({
  url: z.string().url('Please provide a valid HTTP or HTTPS URL')
});

const generateMetaSchema = z.object({
  pageContent: z.string().min(10, 'Page content is required'),
  targetKeywords: z.string().optional(),
  brandName: z.string().optional()
});

// POST /api/seo/analyze - Live SEO and GEO audit
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = seoAnalyzeSchema.parse(req.body);
    const audit = await analyzeWebsiteSeo(url);
    res.json(audit);
  } catch (err) {
    next(err);
  }
});

// POST /api/seo/generate-meta - Generate optimized metadata
router.post('/generate-meta', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageContent, targetKeywords, brandName } = generateMetaSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const prompt = `You are a Technical SEO and Conversion Copywriting specialist.
Based on this page summary: "${pageContent.substring(0, 1500)}"
Target Keywords: "${targetKeywords || 'None specified'}"
Brand Name: "${brandName || 'MarketMate AI'}"

Generate:
1. Three high-CTR Title Tags (strictly between 50-60 characters each).
2. Two compelling Meta Descriptions (strictly between 140-155 characters each with a strong CTA).
3. Five high-intent secondary keyword opportunities.
4. One GEO/AEO snippet for AI search engines (under 50 words).

Format as clear Markdown with character counts indicated.`;

    const generated = await geminiService.generateText(prompt);
    res.json({ result: generated });
  } catch (err) {
    next(err);
  }
});

export default router;
