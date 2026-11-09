import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { contentGeneratorService, calculateWordCount, calculateCharCount, calculateReadingTime } from '../tools/contentGenerator.js';
import { jobService } from '../services/jobService.js';
import { generateDocxBuffer } from '../utils/docxExporter.js';
import { db } from '../db/index.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const targetAudienceSchema = z.object({
  role: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  location: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
  notes: z.string().optional()
}).optional();

const contentGenerateSchema = z.object({
  topic: z.string().min(2, 'Topic or brief is required').trim(),
  contentType: z.string().default('blog article'),
  targetAudience: targetAudienceSchema,
  wordCountTarget: z.number().int().min(20).max(10000).optional(),
  minWordCount: z.number().int().min(20).max(10000).optional(),
  maxWordCount: z.number().int().min(20).max(10000).optional(),
  tone: z.string().default('Professional & Authoritative'),
  language: z.string().default('en'),
  readingLevel: z.string().default('Professional / College'),
  primaryKeywords: z.array(z.string()).optional(),
  secondaryKeywords: z.array(z.string()).optional(),
  cta: z.string().optional(),
  brandVoice: z.string().optional(),
  thingsToAvoid: z.string().optional(),
  variantsCount: z.number().int().min(1).max(5).default(1),
  asyncJob: z.boolean().optional().default(false)
});

const refineSchema = z.object({
  body: z.string().min(10, 'Body text is required'),
  action: z.enum(['shorter', 'longer', 'change_tone', 'regenerate']),
  targetTone: z.string().optional(),
  currentTitle: z.string().optional()
});

const versionSaveSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  changeSummary: z.string().optional().default('Manual inline edit')
});

// POST /api/content/generate - Generate variants with word-count enforcement
router.post('/generate', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = contentGenerateSchema.parse(req.body);

    if (params.asyncJob) {
      const job = jobService.enqueueJob({
        agentId: 'content',
        input: params
      });
      res.status(202).json({
        success: true,
        jobId: job.jobId,
        status: job.status,
        message: 'Content creation job queued in background pipeline.'
      });
      return;
    }

    const result = await contentGeneratorService.generateContent(params);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/content/refine - Action: shorter, longer, change_tone, regenerate
router.post('/refine', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body, action, targetTone, currentTitle } = refineSchema.parse(req.body);
    const refined = await contentGeneratorService.refineOption(body, action, { targetTone, currentTitle });
    res.json({
      success: true,
      data: refined
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/items - List saved content library items
router.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await db.getContentItems();
    res.json({
      success: true,
      data: items
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/items/:id - Get single content item with versions
router.get('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await db.getContentItem(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Content item not found.' });
      return;
    }
    const versions = await db.getContentVersions(req.params.id);
    res.json({
      success: true,
      data: {
        ...item,
        versions
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/content/items/:id/versions - Save new version
router.post('/items/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, body, changeSummary } = versionSaveSchema.parse(req.body);
    const item = await db.getContentItem(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Content item not found.' });
      return;
    }

    const words = calculateWordCount(body);
    const chars = calculateCharCount(body);
    const readTime = calculateReadingTime(words);
    const versions = await db.getContentVersions(req.params.id);
    const nextVer = versions.length + 1;

    // Save version
    const versionRow = await db.saveContentVersion({
      id: `ver_${Date.now()}_${nextVer}`,
      contentId: req.params.id,
      versionNumber: nextVer,
      title,
      body,
      wordCount: words,
      characterCount: chars,
      readingTimeMinutes: readTime,
      changeSummary
    });

    // Update main item
    await db.saveContentItem({
      ...item,
      title,
      body,
      actualWordCount: words,
      characterCount: chars,
      readingTimeMinutes: readTime,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      data: versionRow
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/content/items/:id - Delete content item
router.delete('/items/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await db.deleteContentItem(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Content item not found.' });
      return;
    }
    res.json({ success: true, message: 'Content item deleted.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/items/:id/export/:format - Export as md, docx, txt
router.get('/items/:id/export/:format', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, format } = req.params;
    const item = await db.getContentItem(id);
    if (!item) {
      res.status(404).json({ error: 'Content item not found.' });
      return;
    }

    const cleanTitle = (item.title || 'marketing_content').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'docx') {
      const buffer = await generateDocxBuffer(item.title, item.body);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.docx"`);
      res.send(buffer);
      return;
    }

    if (format === 'md') {
      const mdContent = `# ${item.title}\n\n**Topic:** ${item.topic}\n**Type:** ${item.contentType}\n**Word Count:** ${item.actualWordCount}\n\n---\n\n${item.body}`;
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.md"`);
      res.send(mdContent);
      return;
    }

    // Default: txt
    const txtContent = `${item.title.toUpperCase()}\n\n${item.body.replace(/<[^>]+>/g, '').replace(/[#*`_]/g, '')}`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.txt"`);
    res.send(txtContent);
  } catch (err) {
    next(err);
  }
});

export default router;
