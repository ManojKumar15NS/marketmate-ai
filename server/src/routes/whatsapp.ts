import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { whatsappFinderService } from '../tools/whatsappFinderService.js';
import { jobService } from '../services/jobService.js';
import { store } from '../services/store.js';
import { logger } from '../utils/logger.js';

const router = Router();

const searchSchema = z.object({
  keywords: z.string().min(2, 'Keywords / Business category must be at least 2 characters'),
  industry: z.string().optional(),
  location: z.string().min(2, 'Location must be at least 2 characters'),
  city: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().default('+91'),
  limit: z.number().int().min(1).max(1000).optional(),
  localities: z.array(z.string()).optional(),
  messageTemplate: z.string().optional(),
  includeDecisionMakers: z.boolean().optional().default(true),
  deepEnrichment: z.boolean().optional().default(true),
  asyncJob: z.boolean().optional().default(false)
});

// POST /api/whatsapp/search - Search for B2B businesses, decision-makers & WhatsApp contacts
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = searchSchema.parse(req.body);

    if (validated.asyncJob) {
      const job = await jobService.enqueueJob({
        agentId: 'whatsapp',
        input: {
          keywords: validated.keywords,
          industry: validated.industry,
          location: validated.location,
          countryCode: validated.countryCode,
          limit: validated.limit,
          localities: validated.localities,
          messageTemplate: validated.messageTemplate,
          includeDecisionMakers: validated.includeDecisionMakers
        }
      });

      res.status(202).json({
        success: true,
        data: {
          jobId: job.jobId,
          status: 'queued',
          message: `B2B Discovery job enqueued for ${validated.keywords} in ${validated.location}.`
        }
      });
      return;
    }

    const result = await whatsappFinderService.search({
      keywords: validated.keywords,
      industry: validated.industry,
      location: validated.location,
      countryCode: validated.countryCode,
      limit: validated.limit,
      localities: validated.localities,
      messageTemplate: validated.messageTemplate,
      includeDecisionMakers: validated.includeDecisionMakers
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

// GET /api/whatsapp/export.csv - Download CSV or CRM format
router.get('/export.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId, format } = req.query;
    let leads: any[] = [];
    if (typeof searchId === 'string') {
      const search = await store.getWhatsAppSearch(searchId);
      leads = search?.leads || [];
    } else {
      const searches = await store.getWhatsAppSearches();
      leads = searches.flatMap(s => s.leads);
    }

    let csvContent = '';
    const crmFormat = String(format || '').toLowerCase();
    if (crmFormat === 'hubspot' || crmFormat === 'salesforce' || crmFormat === 'zoho') {
      csvContent = whatsappFinderService.generateCrmCsv(leads, crmFormat);
      res.setHeader('Content-Disposition', `attachment; filename=b2b_leads_${crmFormat}_${Date.now()}.csv`);
    } else {
      csvContent = whatsappFinderService.generateCsv(leads);
      res.setHeader('Content-Disposition', `attachment; filename=b2b_leads_${Date.now()}.csv`);
    }

    res.setHeader('Content-Type', 'text/csv');
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
    res.setHeader('Content-Disposition', `attachment; filename=b2b_contacts_${Date.now()}.vcf`);
    res.send(vcfContent);
  } catch (err) {
    next(err);
  }
});

// GET /api/whatsapp/export.xlsx - Download Multi-Sheet Excel spreadsheet
router.get('/export.xlsx', async (req: Request, res: Response, next: NextFunction) => {
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

    const buffer = await whatsappFinderService.generateExcel(leads);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=b2b_leads_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
