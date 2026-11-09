import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { emailFinderService } from '../tools/emailFinderService.js';
import { store } from '../services/store.js';
import { Lead } from '../types/index.js';

const router = Router();

const searchSchema = z.object({
  mode: z.enum(['single_company', 'keyword_discovery']).default('single_company'),
  website: z.string().optional(),
  keywords: z.array(z.string()).default(['Management', 'Sales', 'Marketing', 'Operations', 'CEO', 'Founder']),
  targetIndustry: z.string().optional(),
  targetLocation: z.string().optional(),
  targetRoles: z.array(z.string()).optional(),
  limit: z.number().min(5).max(500).default(100)
});

const enrichSchema = z.object({
  searchId: z.string().min(1, 'searchId is required'),
  contactIds: z.array(z.string()).min(1, 'contactIds array is required')
});

// POST /api/email-finder/search - Execute LinkedIn People Discovery
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = searchSchema.parse(req.body);
    const result = await emailFinderService.discoverPeople(params);
    res.json({
      success: true,
      run: result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/email-finder/enrich-contacts - On-Demand Email Enrichment via Hunter
router.post('/enrich-contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId, contactIds } = enrichSchema.parse(req.body);
    const result = await emailFinderService.enrichContactsWithEmails(searchId, contactIds);
    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// POST /api/email-finder/enrich-single - On-Demand Email Enrichment for single contact
router.post('/enrich-single', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId, contactId } = req.body;
    if (!searchId || !contactId) {
      return res.status(400).json({ success: false, error: 'searchId and contactId required' });
    }
    const result = await emailFinderService.enrichContactsWithEmails(searchId, [contactId]);
    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/email-finder/searches - List Search History
router.get('/searches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searches = await store.getEmailSearches();
    res.json(searches);
  } catch (err) {
    next(err);
  }
});

// GET /api/email-finder/searches/:id - Single Search Run
router.get('/searches/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = await store.getEmailSearch(req.params.id);
    if (!search) return res.status(404).json({ error: 'Search run not found' });
    res.json(search);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/email-finder/searches/:id - Delete Search Run
router.delete('/searches/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await store.deleteEmailSearch(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Search run not found' });
    res.json({ success: true, message: 'Search deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/email-finder/import-to-leads - Import selected contacts into Prospecting workspace
router.post('/import-to-leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contacts, companyId } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array required' });
    }

    const importedLeads: Lead[] = contacts.map(c => {
      const cleanCompanyId = companyId || `comp_${(c.domain || 'imported').replace(/[^a-z0-9]/g, '_')}`;
      return {
        id: `lead_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        companyId: cleanCompanyId,
        companyName: c.company || c.domain,
        website: c.website || `https://${c.domain}`,
        industry: c.industry || c.department || 'Commercial',
        location: c.location || c.domain,
        fitScore: c.linkedinUrl ? 92 : 80,
        fitReasons: [`Imported from LinkedIn People Finder (${c.discoveryKeyword})`],
        qualificationBreakdown: {
          icpMatch: 25,
          serviceRelevance: 20,
          locationMatch: 15,
          operationalNeedEvidence: 20,
          totalScore: c.linkedinUrl ? 92 : 80,
          reasons: [`Verified LinkedIn Decision-Maker (${c.discoverySource})`]
        },
        decisionMakers: [
          {
            name: c.name,
            title: c.title,
            department: c.department,
            linkedinUrl: c.linkedinUrl,
            linkedinStatus: c.linkedinUrl ? 'found' : 'not_found',
            email: c.email || undefined,
            emailConfidence: c.confidence || 'medium',
            verificationStatus: c.emailStatus === 'Verified' ? 'verified' : 'unverified',
            emailStatus: c.emailStatus,
            emailSource: c.discoverySource,
            contactEvidence: [
              {
                title: `${c.name} (${c.company})`,
                url: c.sourceUrl || c.website,
                sourceType: 'live_web',
                retrievedAt: new Date().toISOString(),
                extractedSnippet: `${c.title} at ${c.company}. LinkedIn: ${c.linkedinUrl || 'N/A'}. Email: ${c.email || 'Not found'}`,
                confidence: c.confidence
              }
            ],
            researchedAt: new Date().toISOString()
          }
        ],
        status: 'Qualified',
        sources: [c.sourceUrl],
        evidenceSources: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    await store.saveLeads(importedLeads);
    res.json({
      success: true,
      importedCount: importedLeads.length,
      leads: importedLeads
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/email-finder/export.csv - CSV Export
router.get('/export.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId } = req.query;
    let contacts: any[] = [];
    if (typeof searchId === 'string') {
      const search = await store.getEmailSearch(searchId);
      contacts = search?.contacts || [];
    } else {
      const searches = await store.getEmailSearches();
      contacts = searches.flatMap(s => s.contacts);
    }

    const headers = [
      'Person Name',
      'Job Title',
      'Company',
      'Industry',
      'Location',
      'Department',
      'LinkedIn Profile',
      'Professional Email',
      'Email Status',
      'Evidence Source',
      'Source URL',
      'Discovered At'
    ];

    const escapeCsv = (val: string | number | undefined | null) => {
      if (val === undefined || val === null || val === '') return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = contacts.map(c => [
      escapeCsv(c.name),
      escapeCsv(c.title),
      escapeCsv(c.company),
      escapeCsv(c.industry || 'Commercial Enterprise'),
      escapeCsv(c.location || 'Global / US'),
      escapeCsv(c.department),
      escapeCsv(c.linkedinUrl || 'N/A'),
      escapeCsv(c.email || 'Email not found'),
      escapeCsv(c.emailStatus || 'Unavailable'),
      escapeCsv(c.discoverySource),
      escapeCsv(c.sourceUrl),
      escapeCsv(c.discoveredAt)
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=marketmate_linkedin_prospects_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// GET /api/email-finder/export.xlsx - Excel Export
router.get('/export.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { searchId } = req.query;
    let contacts: any[] = [];
    if (typeof searchId === 'string') {
      const search = await store.getEmailSearch(searchId);
      contacts = search?.contacts || [];
    } else {
      const searches = await store.getEmailSearches();
      contacts = searches.flatMap(s => s.contacts);
    }

    const excelModule: any = await import('exceljs');
    const ExcelJS = excelModule.default || excelModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MarketMate AI - LinkedIn People Finder';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('LinkedIn Decision-Makers');
    sheet.columns = [
      { header: 'Person Name', key: 'name', width: 22 },
      { header: 'Job Title', key: 'title', width: 28 },
      { header: 'Company', key: 'company', width: 24 },
      { header: 'Industry', key: 'industry', width: 20 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'LinkedIn Profile', key: 'linkedin', width: 38 },
      { header: 'Professional Email', key: 'email', width: 28 },
      { header: 'Email Status', key: 'status', width: 18 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Evidence Source', key: 'source', width: 25 },
      { header: 'Source URL', key: 'sourceUrl', width: 42 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A66C2' } // LinkedIn blue
    };

    for (const c of contacts) {
      sheet.addRow({
        name: c.name,
        title: c.title,
        company: c.company,
        industry: c.industry || 'Commercial Enterprise',
        location: c.location || 'Global / US',
        linkedin: c.linkedinUrl || 'N/A',
        email: c.email || 'Email not found',
        status: c.emailStatus || 'Unavailable',
        department: c.department,
        source: c.discoverySource,
        sourceUrl: c.sourceUrl
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=marketmate_linkedin_prospects_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
