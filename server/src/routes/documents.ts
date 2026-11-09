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
