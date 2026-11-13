import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { whatsappFinderService } from '../tools/whatsappFinderService.js';
import { jobService } from '../services/jobService.js';
import { store } from '../services/store.js';
import { logger } from '../utils/logger.js';

const router = Router();

const searchSchema = z.object({
  keywords: z.string().min(2, 'Keywords / Business category must be at least 2 characters'),
  location: z.string().min(2, 'Location must be at least 2 characters'),
  countryCode: z.string().default('+91'),
  limit: z.number().int().min(1).max(50).default(15),
  messageTemplate: z.string().optional(),
  asyncJob: z.boolean().optional().default(false)
});

// POST /api/whatsapp/search - Search for WhatsApp business numbers
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = searchSchema.parse(req.body);

    if (validated.asyncJob) {
      const job = await jobService.enqueueJob({
        agentId: 'whatsapp',
        input: {
          keywords: validated.keywords,
          location: validated.location,
          countryCode: validated.countryCode,
          limit: validated.limit,
          messageTemplate: validated.messageTemplate
        }
      });

      res.status(202).json({
        success: true,
        data: {
          jobId: job.jobId,
          status: 'queued',
          message: `WhatsApp Number Discovery job enqueued for ${validated.keywords} in ${validated.location}.`
        }
      });
      return;
    }

    const result = await whatsappFinderService.search({
      keywords: validated.keywords,
      location: validated.location,
      countryCode: validated.countryCode,
      limit: validated.limit,
      messageTemplate: validated.messageTemplate
    });

    await store.saveWhatsAppSearch(result);

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.errors[0].message } });
      return;
    }
    next(err);
  }
});

// GET /api/whatsapp/searches - List past WhatsApp searches
router.get('/searches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searches = await store.getWhatsAppSearches();
    res.json({
      success: true,
      data: searches
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/searches/:id - Get specific search with leads
router.get('/searches/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = await store.getWhatsAppSearch(req.params.id);
    if (!search) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'WhatsApp search run not found' } });
      return;
    }
    res.json({
      success: true,
      data: search
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/whatsapp/searches/:id - Delete saved search
router.delete('/searches/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await store.deleteWhatsAppSearch(req.params.id);
    res.json({
      success: deleted,
      message: deleted ? 'Search deleted' : 'Search not found'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/export.csv - Download CSV
router.get('/export.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId } = req.query;
    let leads: any[] = [];
    if (typeof searchId === 'string') {
      const search = await store.getWhatsAppSearch(searchId);
      leads = search?.leads || [];
    } else {
      const searches = await store.getWhatsAppSearches();
      leads = searches.flatMap(s => s.leads);
    }

    const csvContent = whatsappFinderService.generateCsv(leads);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=whatsapp_leads_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/export.vcf - Download vCard for instant phone contacts import
router.get('/export.vcf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId } = req.query;
    let leads: any[] = [];
    if (typeof searchId === 'string') {
      const search = await store.getWhatsAppSearch(searchId);
      leads = search?.leads || [];
    } else {
      const searches = await store.getWhatsAppSearches();
      leads = searches.flatMap(s => s.leads);
    }

    const vcfContent = whatsappFinderService.generateBulkVCard(leads);
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=whatsapp_contacts_${Date.now()}.vcf`);
    res.send(vcfContent);
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/export.xlsx - Download Excel spreadsheet
router.get('/export.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId } = req.query;
    let leads: any[] = [];
    let searchInfo = { keywords: 'All Searches', location: 'Multiple' };

    if (typeof searchId === 'string') {
      const search = await store.getWhatsAppSearch(searchId);
      leads = search?.leads || [];
      if (search) {
        searchInfo = { keywords: search.keywords, location: search.location };
      }
    } else {
      const searches = await store.getWhatsAppSearches();
      leads = searches.flatMap(s => s.leads);
    }

    const buffer = await whatsappFinderService.generateExcel(leads, searchInfo);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=whatsapp_leads_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
