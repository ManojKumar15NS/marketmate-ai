import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { geminiService } from '../services/gemini.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const emailGenerateSchema = z.object({
  campaignType: z.string().default('Cold Outreach'),
  targetAudience: z.string().min(2, 'Target audience is required'),
  productService: z.string().min(2, 'Product or service description is required'),
  tone: z.enum(['Professional', 'Friendly', 'Persuasive', 'Informative', 'Promotional']).default('Professional'),
  touchpoints: z.number().min(1).max(5).default(3),
  callToAction: z.string().optional()
});

// POST /api/email/generate - Generate multi-touch email campaigns
router.post('/generate', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignType, targetAudience, productService, tone, touchpoints, callToAction } =
      emailGenerateSchema.parse(req.body);

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const prompt = `You are an elite Cold Email Copywriter and Conversion Rate Optimization Strategist.
Create a ${touchpoints}-touchpoint ${campaignType} email sequence for:
- Target Persona: ${targetAudience}
- Offering: ${productService}
- Tone of Voice: ${tone}
- Desired CTA: ${callToAction || 'A brief 15-minute discovery call or reply'}

For EACH email in the sequence, provide:
1. Touchpoint # and Objective (e.g., Problem-Agitation, Value-Proof, Breakup)
2. 3 High-converting Subject Lines (with curiosity, benefit, and personalization tokens like {{FirstName}})
3. 1 Preheader text
4. Email Body (concise, scannable, under 120 words per email, using {{FirstName}} and {{CompanyName}})
5. Strong single CTA

Format with clean Markdown. Do not send emails automatically.`;

    const sequence = await geminiService.generateText(prompt);
    res.json({
      campaignType,
      targetAudience,
      tone,
      touchpoints,
      sequence
    });
  } catch (err) {
    next(err);
  }
});

export default router;
