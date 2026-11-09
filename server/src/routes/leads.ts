import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { store } from '../services/store.js';
import { prospectingEngine } from '../agents/prospector.js';
import { verifyEmailAddress } from '../tools/emailVerifier.js';
import { emailDiscoveryService } from '../tools/emailDiscovery.js';
import { mapDiscoveryService } from '../tools/mapDiscovery.js';
import { Lead } from '../types/index.js';

const router = Router();

const researchCompanySchema = z.object({
  url: z.string().min(3, 'A valid company website URL is required'),
  forceRefresh: z.boolean().optional()
});

const prospectCriteriaSchema = z.object({
  industry: z.string().min(2, 'Industry is required'),
  location: z.string().optional().default('Seattle, Washington'),
  targetRoles: z.array(z.string()).optional().default(['Operations Director', 'Managing Director', 'Owner']),
  companySize: z.string().optional().default('20-500'),
  techKeywords: z.array(z.string()).optional().default([]),
  limit: z.number().min(1).max(20).optional().default(6),
  campaignId: z.string().optional(),
  companyId: z.string().optional(),
  country: z.string().optional().default('USA'),
  state: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  radiusMiles: z.number().optional().default(25)
});

const verifyEmailSchema = z.object({
  email: z.string().email('Valid email address required')
});

const personalizeEmailSchema = z.object({
  valueProp: z.string().optional(),
  companyId: z.string().optional()
});

// POST /api/leads/research-company - Autonomous 6-Stage B2B Pipeline from single URL
router.post('/research-company', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = researchCompanySchema.parse(req.body);
    const result = await prospectingEngine.runFullResearchWorkflow(url);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/sessions - List all research sessions
router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await store.getResearchSessions();
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions - Create new session and start Step 1
router.post('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, autoRun, location } = req.body;
    if (!url || typeof url !== 'string' || url.trim().length < 3) {
      return res.status(400).json({ error: 'A valid company website URL is required' });
    }
    const session = await prospectingEngine.createSession(url.trim(), location);
    // Execute Step 1 (Company Research) immediately
    await prospectingEngine.executeStep1(session);

    if (autoRun) {
      await prospectingEngine.runAllSteps(session.id);
    }

    const refreshed = await store.getResearchSession(session.id);
    res.json({
      success: true,
      session: refreshed || session
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/sessions/:id - Get full session state with all steps, logs, and data
router.get('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Research session not found' });

    if (!session.profile) {
      session.profile = (await store.getCompanyProfile(session.companyId)) || undefined;
    }
    if (!session.competitors || session.competitors.length === 0) {
      session.competitors = await store.getCompetitors(session.companyId, session.id);
    }
    if (!session.campaigns || session.campaigns.length === 0) {
      session.campaigns = await store.getCampaigns(session.companyId, session.id);
    }
    if (!session.leads || session.leads.length === 0) {
      session.leads = await store.getLeads(session.companyId, session.id);
    }
    if (!session.stats) {
      session.stats = await store.getLeadStats(session.companyId, session.id);
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions/:id/step1 - Run Step 1 (Company Research)
router.post('/sessions/:id/step1', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const profile = await prospectingEngine.executeStep1(session);
    res.json({ success: true, profile, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions/:id/step2 - Run Step 2 (Competitor Research)
router.post('/sessions/:id/step2', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const competitors = await prospectingEngine.executeStep2(session);
    res.json({ success: true, competitors, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions/:id/step3 - Run Step 3 (Campaigns & ICP)
router.post('/sessions/:id/step3', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const campaigns = await prospectingEngine.executeStep3(session);
    res.json({ success: true, campaigns, session });
  } catch (err) {
    next(err);
  }
});

// PUT /api/leads/sessions/:id/campaigns - Update/edit campaigns before running Step 4
router.put('/sessions/:id/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { campaigns } = req.body;
    if (!Array.isArray(campaigns)) return res.status(400).json({ error: 'Campaigns array required' });

    session.campaigns = campaigns;
    await store.saveCampaigns(campaigns, session.companyId, session.id);
    await store.saveResearchSession(session);
    res.json({ success: true, campaigns });
  } catch (err) {
    next(err);
  }
});

// PUT /api/leads/sessions/:id/company - Update/edit company profile
router.put('/sessions/:id/company', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { profile } = req.body;
    if (!profile) return res.status(400).json({ error: 'Profile object required' });

    session.profile = profile;
    await store.saveCompanyProfile(profile);
    await store.saveResearchSession(session);
    res.json({ success: true, profile });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions/:id/step4 - Run Step 4 (Target Company Discovery)
router.post('/sessions/:id/step4', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { campaignId, location, limit } = req.body;
    const leads = await prospectingEngine.executeStep4(session, { campaignId, location, limit });
    res.json({ success: true, leads, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions/:id/step5 - Run Step 5 (Decision-Maker & Email Discovery)
router.post('/sessions/:id/step5', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const leads = await prospectingEngine.executeStep5(session);
    res.json({ success: true, leads, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions/:id/step6 - Run Step 6 (Personalized Outreach Emails)
router.post('/sessions/:id/step6', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await store.getResearchSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const leads = await prospectingEngine.executeStep6(session);
    res.json({ success: true, leads, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/sessions/:id/run-all - Autonomous execution of all remaining steps
router.post('/sessions/:id/run-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await prospectingEngine.runAllSteps(req.params.id);
    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/companies - List all researched company profiles
router.get('/companies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profiles = await store.getCompanyProfiles();
    res.json(profiles);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/company/:id - Get specific company profile and its associated data
router.get('/company/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await store.getCompanyProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Company profile not found' });

    const [competitors, campaigns, leads, stats] = await Promise.all([
      store.getCompetitors(profile.id),
      store.getCampaigns(profile.id),
      store.getLeads(profile.id),
      store.getLeadStats(profile.id)
    ]);

    res.json({
      profile,
      competitors,
      campaigns,
      leads,
      stats
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads - List leads with optional companyId filter & search
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, status, search, minScore, emailStatus, role } = req.query;
    let leads = await store.getLeads(typeof companyId === 'string' ? companyId : undefined);

    if (status && typeof status === 'string' && status !== 'all') {
      leads = leads.filter(l => l.status.toLowerCase() === status.toLowerCase());
    }

    if (emailStatus && typeof emailStatus === 'string' && emailStatus !== 'all') {
      leads = leads.filter(l =>
        l.decisionMakers.some(dm =>
          (dm.emailStatus || dm.verificationStatus || '').toLowerCase() === emailStatus.toLowerCase()
        )
      );
    }

    if (role && typeof role === 'string' && role !== 'all') {
      leads = leads.filter(l =>
        l.decisionMakers.some(dm => dm.title.toLowerCase().includes(role.toLowerCase()))
      );
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      leads = leads.filter(l =>
        l.companyName.toLowerCase().includes(q) ||
        l.industry.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.state && l.state.toLowerCase().includes(q)) ||
        l.decisionMakers.some(dm =>
          dm.name.toLowerCase().includes(q) ||
          dm.title.toLowerCase().includes(q) ||
          (dm.email && dm.email.toLowerCase().includes(q))
        )
      );
    }

    if (minScore && !isNaN(Number(minScore))) {
      leads = leads.filter(l => l.fitScore >= Number(minScore));
    }

    res.json(leads);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/stats - Extended pipeline analytics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query;
    const stats = await store.getLeadStats(typeof companyId === 'string' ? companyId : undefined);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/competitors - Discovered competitors
router.get('/competitors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query;
    const competitors = await store.getCompetitors(typeof companyId === 'string' ? companyId : undefined);
    res.json(competitors);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/campaigns - Dynamic Keyword Campaign Groups
router.get('/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query;
    const campaigns = await store.getCampaigns(typeof companyId === 'string' ? companyId : undefined);
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/map-discover - Map-based business discovery with radius and coordinates
router.post('/map-discover', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      city = 'Yakima',
      state = 'Washington',
      country = 'USA',
      postalCode,
      radiusMiles = 25,
      industry = 'Commercial apple orchards',
      limit = 6
    } = req.body;

    const result = await mapDiscoveryService.discoverBusinesses({
      city,
      state,
      country,
      postalCode,
      radiusMiles: Number(radiusMiles) || 25,
      industry,
      limit: Number(limit) || 6
    });

    res.json({
      success: true,
      center: result.centerCoordinates,
      radiusMiles,
      count: result.places.length,
      places: result.places
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/export /export.csv - CSV export
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query;
    const leads = await store.getLeads(typeof companyId === 'string' ? companyId : undefined);
    const headers = [
      'ID',
      'Company Name',
      'Website',
      'Industry / Category',
      'Address',
      'City',
      'State',
      'Postal Code',
      'Latitude',
      'Longitude',
      'Distance (Miles)',
      'Fit Score',
      'Pipeline Status',
      'Decision Maker',
      'Title',
      'Email',
      'Email Source',
      'Email Status',
      'Personalized Subject',
      'Personalized Body'
    ];

    const escapeCsv = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leads.map(l => {
      const dm = l.decisionMakers?.[0] || {
        name: '',
        title: '',
        email: '',
        emailSource: '',
        emailStatus: 'Not found' as const,
        verificationStatus: 'unverified' as const
      };
      return [
        escapeCsv(l.id),
        escapeCsv(l.companyName),
        escapeCsv(l.website),
        escapeCsv(l.industry),
        escapeCsv(l.address || l.location),
        escapeCsv(l.city),
        escapeCsv(l.state),
        escapeCsv(l.postalCode),
        escapeCsv(l.coordinates?.lat),
        escapeCsv(l.coordinates?.lng),
        escapeCsv(l.distanceMiles),
        escapeCsv(l.fitScore),
        escapeCsv(l.status),
        escapeCsv(dm.name),
        escapeCsv(dm.title),
        escapeCsv(dm.email),
        escapeCsv(dm.emailSource),
        escapeCsv(dm.emailStatus || dm.verificationStatus),
        escapeCsv(l.personalizedEmail?.subject),
        escapeCsv(l.personalizedEmail?.body)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=marketmate_leads_${companyId || 'export'}_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/export.xlsx - Real Excel spreadsheet export with formatting
router.get('/export.xlsx', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query;
    const leads = await store.getLeads(typeof companyId === 'string' ? companyId : undefined);
    const excelModule: any = await import('exceljs');
    const ExcelJS = excelModule.default || excelModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MarketMate AI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('B2B Prospect Leads');

    sheet.columns = [
      { header: 'Company Name', key: 'companyName', width: 28 },
      { header: 'Website', key: 'website', width: 25 },
      { header: 'Category / Vertical', key: 'industry', width: 30 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'State', key: 'state', width: 16 },
      { header: 'Fit Score', key: 'fitScore', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Decision Maker', key: 'dmName', width: 22 },
      { header: 'Title', key: 'dmTitle', width: 25 },
      { header: 'Email Address', key: 'dmEmail', width: 28 },
      { header: 'Email Status', key: 'emailStatus', width: 18 },
      { header: 'Email Source', key: 'emailSource', width: 24 },
      { header: 'Personalized Subject', key: 'emailSubject', width: 35 },
      { header: 'Personalized Email Body', key: 'emailBody', width: 50 }
    ];

    // Style Header Row
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // slate-800
    };

    for (const l of leads) {
      const dm = l.decisionMakers?.[0] || {
        name: '',
        title: '',
        email: '',
        emailSource: '',
        emailStatus: 'Not found' as const,
        verificationStatus: 'unverified' as const
      };
      sheet.addRow({
        companyName: l.companyName,
        website: l.website,
        industry: l.industry,
        city: l.city || l.location.split(',')[0],
        state: l.state || l.location.split(',')[1]?.trim(),
        fitScore: `${l.fitScore}%`,
        status: l.status,
        dmName: dm.name,
        dmTitle: dm.title,
        dmEmail: dm.email || 'Not found',
        emailStatus: dm.emailStatus || dm.verificationStatus || 'Pending',
        emailSource: dm.emailSource || 'Sequential Provider Cascade',
        emailSubject: l.personalizedEmail?.subject || '',
        emailBody: l.personalizedEmail?.body || ''
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=marketmate_leads_${companyId || 'export'}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id - Single lead
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await store.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/prospect - Autonomous prospecting with Map & Keyword Groups
router.post('/prospect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const criteria = prospectCriteriaSchema.parse(req.body);
    let profile = undefined;
    if (criteria.companyId) {
      profile = (await store.getCompanyProfile(criteria.companyId)) || undefined;
    }
    const discovered = await prospectingEngine.prospectLeads(criteria as any, profile);
    res.json({
      success: true,
      count: discovered.length,
      leads: discovered
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/verify-email - Verify single email address via DNS MX
router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = verifyEmailSchema.parse(req.body);
    const result = await verifyEmailAddress(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/:id/enrich-email - Run the sequential 8-step email discovery cascade on a lead
router.post('/:id/enrich-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await store.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const dm = lead.decisionMakers?.[0] || { name: 'Operations Leadership', title: 'Operations Manager' };

    const emailResult = await emailDiscoveryService.discoverEmail(
      dm.name,
      dm.title,
      lead.companyName,
      lead.website
    );

    const updatedDm = {
      ...dm,
      email: emailResult.email || dm.email,
      emailConfidence: emailResult.confidence,
      verificationStatus: emailResult.emailStatus === 'Verified' ? ('verified' as const) : (emailResult.email ? ('unverified' as const) : ('invalid' as const)),
      emailStatus: emailResult.emailStatus,
      emailSource: emailResult.emailSource || 'Sequential Provider Cascade',
      providerBadges: emailResult.providerBadges,
      verificationDetails: emailResult.verificationDetails
    };

    lead.decisionMakers[0] = updatedDm;
    if (emailResult.emailStatus === 'Verified') {
      lead.fitScore = Math.min(100, lead.fitScore + 10);
      lead.status = 'Qualified';
    }
    lead.updatedAt = new Date().toISOString();

    await store.saveLead(lead);

    res.json({
      success: true,
      lead,
      emailResult
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/:id/personalize-email - Generate 1-to-1 personalized cold email
router.post('/:id/personalize-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await store.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { valueProp, companyId } = personalizeEmailSchema.parse(req.body);
    const targetCompanyId = companyId || lead.companyId;
    let profile = undefined;
    if (targetCompanyId) {
      profile = (await store.getCompanyProfile(targetCompanyId)) || undefined;
    }

    const personalized = await prospectingEngine.personalizeEmail(lead, profile, valueProp);

    res.json({
      success: true,
      leadId: lead.id,
      personalizedEmail: personalized
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/leads/:id - Update lead status or notes
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await store.getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const updates = req.body;
    const updatedLead: Lead = {
      ...lead,
      ...updates,
      id: lead.id,
      updatedAt: new Date().toISOString()
    };

    await store.saveLead(updatedLead);
    res.json(updatedLead);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/leads/:id - Delete lead
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await store.deleteLead(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
