import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { seoEditorService } from '../tools/seoEditorService.js';
import { generateDocxBuffer } from '../utils/docxExporter.js';
import { db } from '../db/index.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const documentSaveSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required').trim(),
  content: z.string().default(''),
  htmlContent: z.string().optional().default(''),
  targetKeyword: z.string().optional().default(''),
  metaDescription: z.string().optional().default(''),
  createVersion: z.boolean().optional().default(false)
});

const analyzeSchema = z.object({
  content: z.string().default(''),
  targetKeyword: z.string().optional().default(''),
  title: z.string().optional().default(''),
  metaDescription: z.string().optional().default('')
});

const suggestionsSchema = z.object({
  content: z.string().min(10, 'Content must contain at least 10 characters'),
  targetKeyword: z.string().optional().default(''),
  title: z.string().optional().default(''),
  metaDescription: z.string().optional().default('')
});

const livePageSchema = z.object({
  url: z.string().url('A valid HTTP or HTTPS URL is required').trim()
});

const geoSchema = z.object({
  content: z.string().min(10, 'Content required'),
  title: z.string().optional().default(''),
  targetKeyword: z.string().optional().default(''),
  organizationName: z.string().optional().default('MarketMate AI')
});

// POST /api/editor/analyze - Deterministic real-time code calculation (debounced by client)
router.post('/analyze', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, targetKeyword, title, metaDescription } = analyzeSchema.parse(req.body);
    const analysis = seoEditorService.analyzeContent(content, targetKeyword, title, metaDescription);
    res.json({
      success: true,
      data: analysis
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/editor/suggestions - Gemini proposals grounded strictly in user text
router.post('/suggestions', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, targetKeyword, title, metaDescription } = suggestionsSchema.parse(req.body);
    const suggestions = await seoEditorService.generateSuggestions(content, targetKeyword, title, metaDescription);
    res.json({
      success: true,
      data: suggestions
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/editor/live-page - SSRF-safe load of live page for comparison
router.post('/live-page', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = livePageSchema.parse(req.body);
    const page = await seoEditorService.extractLivePage(url);
    res.json({
      success: true,
      data: page
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to extract live webpage.'
    });
  }
});

// POST /api/editor/geo-schemas - FAQ section & JSON-LD schemas
router.post('/geo-schemas', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, title, targetKeyword, organizationName } = geoSchema.parse(req.body);
    const result = await seoEditorService.generateGeoSchemas(content, title, targetKeyword, organizationName);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/editor/documents - List editor documents
router.get('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await db.getEditorDocuments();
    res.json({
      success: true,
      data: docs
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/editor/documents/:id - Single document with versions
router.get('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await db.getEditorDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found.' });
      return;
    }
    const versions = await db.getEditorDocumentVersions(req.params.id);
    res.json({
      success: true,
      data: {
        ...doc,
        versions
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/editor/documents - Create or Autosave Document
router.post('/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = documentSaveSchema.parse(req.body);
    const docId = params.id || `ed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Compute metrics
    const analysis = seoEditorService.analyzeContent(
      params.content,
      params.targetKeyword,
      params.title,
      params.metaDescription
    );

    const docRow = {
      id: docId,
      title: params.title,
      content: params.content,
      htmlContent: params.htmlContent,
      targetKeyword: params.targetKeyword,
      metaDescription: params.metaDescription,
      wordCount: analysis.wordCount,
      characterCount: analysis.characterCount,
      readingTimeMinutes: analysis.readingTimeMinutes,
      fleschScore: analysis.fleschReadingEase,
      seoScore: analysis.overallScore,
      analysisBreakdown: analysis.breakdown,
      faqSections: [],
      jsonLdSchemas: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await db.saveEditorDocument(docRow);

    // Save initial version or milestone version if requested
    if (params.createVersion) {
      const versions = await db.getEditorDocumentVersions(docId);
      await db.saveEditorDocumentVersion({
        id: `ed_ver_${Date.now()}_${versions.length + 1}`,
        documentId: docId,
        versionNumber: versions.length + 1,
        title: params.title,
        content: params.content,
        htmlContent: params.htmlContent,
        seoScore: analysis.overallScore,
        savedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: saved,
      analysis
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/editor/documents/:id - Update Document with versioning
router.put('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = documentSaveSchema.parse({ ...req.body, id: req.params.id });
    const existing = await db.getEditorDocument(req.params.id);

    const analysis = seoEditorService.analyzeContent(
      params.content,
      params.targetKeyword,
      params.title,
      params.metaDescription
    );

    const docRow = {
      id: req.params.id,
      title: params.title,
      content: params.content,
      htmlContent: params.htmlContent,
      targetKeyword: params.targetKeyword,
      metaDescription: params.metaDescription,
      wordCount: analysis.wordCount,
      characterCount: analysis.characterCount,
      readingTimeMinutes: analysis.readingTimeMinutes,
      fleschScore: analysis.fleschReadingEase,
      seoScore: analysis.overallScore,
      analysisBreakdown: analysis.breakdown,
      faqSections: existing?.faqSections || [],
      jsonLdSchemas: existing?.jsonLdSchemas || {},
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await db.saveEditorDocument(docRow);

    if (params.createVersion) {
      const versions = await db.getEditorDocumentVersions(req.params.id);
      await db.saveEditorDocumentVersion({
        id: `ed_ver_${Date.now()}_${versions.length + 1}`,
        documentId: req.params.id,
        versionNumber: versions.length + 1,
        title: params.title,
        content: params.content,
        htmlContent: params.htmlContent,
        seoScore: analysis.overallScore,
        savedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: saved,
      analysis
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/editor/documents/:id/restore/:versionId - Restore Previous Version
router.post('/documents/:id/restore/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await db.restoreEditorDocumentVersion(req.params.id, req.params.versionId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document or version not found.' });
      return;
    }
    res.json({
      success: true,
      message: 'Version restored successfully.',
      data: doc
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/editor/documents/:id - Delete Document
router.delete('/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await db.deleteEditorDocument(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Document not found.' });
      return;
    }
    res.json({ success: true, message: 'Document deleted.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/editor/documents/:id/export/:format - Export as HTML, Markdown, DOCX
router.get('/documents/:id/export/:format', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, format } = req.params;
    const doc = await db.getEditorDocument(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const cleanTitle = (doc.title || 'seo_optimized_document').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'docx') {
      const buffer = await generateDocxBuffer(doc.title, doc.content);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.docx"`);
      res.send(buffer);
      return;
    }

    if (format === 'html') {
      const htmlOutput = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <meta name="description" content="${doc.metaDescription || ''}">
  <meta name="keywords" content="${doc.targetKeyword || ''}">
</head>
<body>
  ${doc.htmlContent || doc.content}
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.html"`);
      res.send(htmlOutput);
      return;
    }

    // Default: Markdown (.md)
    const mdOutput = `# ${doc.title}\n\n**Target Keyword:** ${doc.targetKeyword || 'None'}\n**Meta Description:** ${doc.metaDescription || 'None'}\n**SEO Score:** ${doc.seoScore}/100\n\n---\n\n${doc.content}`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.md"`);
    res.send(mdOutput);
  } catch (err) {
    next(err);
  }
});

export default router;
