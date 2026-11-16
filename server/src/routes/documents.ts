import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { parseDocumentBuffer } from '../tools/documentParser.js';
import { geminiService } from '../services/gemini.js';
import { aiGenerationLimiter } from '../middleware/rateLimiter.js';
import { db, StoredDocument } from '../db/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/documents/upload - Upload and extract text
router.post('/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Please upload a PDF, DOCX, CSV, XLSX, or TXT document.' });
      return;
    }

    const { originalname, mimetype, buffer } = req.file;

    // Validate allowed file extensions
    const ext = originalname.split('.').pop()?.toLowerCase() || '';
    const allowed = ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md'];
    if (!allowed.includes(ext)) {
      res.status(400).json({ error: `File type .${ext} is not supported. Please upload PDF, DOCX, CSV, XLSX, or TXT.` });
      return;
    }

    const parsed = await parseDocumentBuffer(buffer, originalname, mimetype);

    const doc: StoredDocument = {
      ...parsed,
      metadata: parsed.metadata || {},
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      uploadedAt: new Date().toISOString()
    };

    await db.saveDocument(doc);

    res.status(201).json({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      sizeBytes: doc.sizeBytes,
      wordCount: doc.wordCount,
      characterCount: doc.characterCount,
      uploadedAt: doc.uploadedAt,
      preview: doc.extractedText.substring(0, 500)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents - List uploaded documents
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await db.getDocuments();
    const summaries = docs.map(d => ({
      id: d.id,
      filename: d.filename,
      fileType: d.fileType,
      sizeBytes: d.sizeBytes,
      wordCount: d.wordCount,
      characterCount: d.characterCount,
      uploadedAt: d.uploadedAt,
      preview: d.extractedText.substring(0, 200) + '...'
    }));
    res.json(summaries);
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id - Get document details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await db.getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

const queryDocSchema = z.object({
  query: z.string().min(1, 'Question cannot be empty').trim()
});

// POST /api/documents/:id/query - Ask Gemini questions about document
router.post('/:id/query', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = queryDocSchema.parse(req.body);
    const doc = await db.getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const prompt = `You are an elite Document Intelligence and Research Analyst.
Context Document: "${doc.filename}" (${doc.wordCount} words)
Content:
"""
${doc.extractedText.substring(0, 15000)}
"""

User Question: "${query}"

Provide an authoritative, structured, and factual answer based strictly on the document text. Cite specific sections, numbers, or quotes where available. If the document does not contain the answer, state that clearly.`;

    const answer = await geminiService.generateText(prompt);
    res.json({
      documentId: doc.id,
      filename: doc.filename,
      query,
      answer
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id/dashboard - Generate intelligent analytics dashboard from uploaded document
router.get('/:id/dashboard', aiGenerationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await db.getDocument(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (!geminiService.isConfigured()) {
      res.status(400).json({ error: 'Gemini API key is not configured.' });
      return;
    }

    const prompt = `You are a Senior Data Analyst & Executive Dashboard Architect.
Analyze the following uploaded document:
Filename: "${doc.filename}" (${doc.fileType}, ${doc.wordCount} words)
Document Text:
"""
${doc.extractedText.substring(0, 15000)}
"""

Task: Extract and construct an executive Analytics Dashboard representing the real data, entities, categories, metrics, or insights contained in this document.
If the document is a spreadsheet/CSV with rows, compute counts, totals, or distribution across categories.
If the document is a text report, survey, or market study, extract key quantifiable findings, sentiment, or thematic breakdown.

Return strictly raw valid JSON matching this exact structure without markdown:
{
  "documentId": "${doc.id}",
  "filename": "${doc.filename}",
  "docType": "Short category of document (e.g. Sales Report, B2B Leads, Market Research, Financial Audit)",
  "summary": "2-3 sentence executive summary of the document's core contents and findings.",
  "kpis": [
    { "label": "Key Entity Count", "value": "120", "trend": "Active", "description": "Total identified entries" },
    { "label": "Primary Metric", "value": "84%", "trend": "High", "description": "Performance rate or total volume" },
    { "label": "Financial / Value Indicator", "value": "$45,000", "trend": "Positive", "description": "Key quantifiable figure" },
    { "label": "Action Items", "value": "18", "trend": "Attention", "description": "Priority points" }
  ],
  "chartData": [
    { "name": "Category 1", "value": 45 },
    { "name": "Category 2", "value": 30 },
    { "name": "Category 3", "value": 20 },
    { "name": "Category 4", "value": 15 },
    { "name": "Category 5", "value": 10 }
  ],
  "chartTitle": "Distribution Breakdown (e.g. by Segment, Status, or Type)",
  "keyInsights": [
    "Key concrete insight 1 found in document",
    "Key concrete insight 2 found in document",
    "Key concrete insight 3 found in document"
  ],
  "actionableRecommendations": [
    "Strategic recommendation 1 based on data",
    "Strategic recommendation 2 based on data"
  ]
}`;

    const jsonText = await geminiService.generateText(prompt, 'Return strictly valid JSON.');
    const cleaned = jsonText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const dashboard = JSON.parse(cleaned);

    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id - Delete document
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await db.deleteDocument(req.params.id);
    if (deleted) {
      res.json({ success: true, message: 'Document deleted' });
      return;
    }
    res.status(404).json({ error: 'Document not found' });
  } catch (err) {
    next(err);
  }
});

export default router;
