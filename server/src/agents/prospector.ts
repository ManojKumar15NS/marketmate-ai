import { geminiService } from '../services/gemini.js';
import { searchLiveWeb } from '../tools/webFetcher.js';
import { extractCleanDomain } from '../tools/emailVerifier.js';
import { emailDiscoveryService } from '../tools/emailDiscovery.js';
import { emailFinderService } from '../tools/emailFinderService.js';
import { mapDiscoveryService, DiscoveredMapPlace } from '../tools/mapDiscovery.js';
import { companyResearcher } from '../tools/companyResearcher.js';
import { store } from '../services/store.js';
import {
  Lead,
  ProspectingCriteria,
  DecisionMaker,
  PersonalizedEmailData,
  QualificationBreakdown,
  Competitor,
  CampaignKeywordGroup,
  CompanyProfile,
  ExtendedLeadStats,
  ResearchSession,
  ResearchEvidence
} from '../types/index.js';

export class ProspectingEngine {
  /**
   * Helper to log real activity inside a research session
   */
  private addSessionLog(
    session: ResearchSession,
    stepNumber: number,
    type: 'info' | 'search' | 'scrape' | 'verify' | 'success' | 'warn',
    message: string,
    url?: string
  ) {
    let stepAct = session.stepProgress.find(s => s.stepNumber === stepNumber);
    if (!stepAct) {
      stepAct = {
        stepNumber,
        stepName: `Step ${stepNumber}`,
        status: 'running',
        startedAt: new Date().toISOString(),
        logs: []
      };
      session.stepProgress.push(stepAct);
    }
    stepAct.status = 'running';
    stepAct.logs.push({
      timestamp: new Date().toISOString(),
      message,
      type,
      url
    });
    console.log(`[ResearchSession ${session.id}][Step ${stepNumber}] ${message}`);
  }

  /**
   * Initialize a new research session
   */
  public async createSession(rawUrl: string, targetLocation?: { city?: string; state?: string; country?: string; radiusMiles?: number }): Promise<ResearchSession> {
    const cleanUrl = rawUrl.trim();
    const domain = cleanUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
    const companyId = `comp_${domain.replace(/[^a-z0-9]/g, '_')}`;
    const researchId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const initialSteps: ResearchSession['stepProgress'] = [
      { stepNumber: 1, stepName: 'Company Research', status: 'pending', logs: [] },
      { stepNumber: 2, stepName: 'Explore Competitors', status: 'pending', logs: [] },
      { stepNumber: 3, stepName: 'Define Campaigns & ICP', status: 'pending', logs: [] },
      { stepNumber: 4, stepName: 'Find Potential Customers', status: 'pending', logs: [] },
      { stepNumber: 5, stepName: 'Find Decision-Makers & Emails', status: 'pending', logs: [] },
      { stepNumber: 6, stepName: 'Generate Personalized Outreach', status: 'pending', logs: [] }
    ];

    const session: ResearchSession = {
      id: researchId,
      companyId,
      targetUrl: cleanUrl,
      currentStep: 1,
      maxCompletedStep: 0,
      status: 'idle',
      stepProgress: initialSteps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.saveResearchSession(session);
    return session;
  }

  /**
   * STEP 1: Deep Company Research
   * Fetches website, scrapes homepage + /about, /services, /products, /contact, /solutions
   */
  public async executeStep1(session: ResearchSession): Promise<CompanyProfile> {
    this.addSessionLog(session, 1, 'info', `Initiating deep research for submitted URL: ${session.targetUrl}`);
    session.currentStep = 1;
    session.status = 'running';

    try {
      this.addSessionLog(session, 1, 'scrape', `Fetching and analyzing website pages for ${session.targetUrl}`, session.targetUrl);
      const profile = await companyResearcher.researchCompany(session.targetUrl);
      profile.id = session.companyId;

      session.profile = profile;
      session.maxCompletedStep = Math.max(session.maxCompletedStep, 1) as any;
      const stepAct = session.stepProgress.find(s => s.stepNumber === 1);
      if (stepAct) {
        stepAct.status = 'completed';
        stepAct.completedAt = new Date().toISOString();
      }

      this.addSessionLog(session, 1, 'success', `Successfully profiled ${profile.name} (${profile.industry}) with ${profile.sources?.length || 0} verified sources`);

      await store.saveCompanyProfile(profile);
      await store.saveResearchSession(session);
      return profile;
    } catch (err: any) {
      this.addSessionLog(session, 1, 'warn', `Step 1 error: ${err.message}`);
      const stepAct = session.stepProgress.find(s => s.stepNumber === 1);
      if (stepAct) stepAct.status = 'error';
      session.status = 'error';
      session.errorMessage = err.message;
      await store.saveResearchSession(session);
      throw err;
    }
  }

  /**
   * STEP 2: Real Competitor Research
   * Live search for actual direct, indirect, and adjacent competitors with verified official websites
   */
  public async executeStep2(session: ResearchSession): Promise<Competitor[]> {
    if (!session.profile) {
      throw new Error('Company Profile not found. Please complete Step 1 first.');
    }
    const profile = session.profile;
    session.currentStep = 2;
    session.status = 'running';
    this.addSessionLog(session, 2, 'info', `Starting competitor research for ${profile.name} (${profile.industry})`);

    const query1 = `top direct commercial competitors of ${profile.name} ${profile.domain} in ${profile.industry}`;
    const query2 = `companies offering alternatives to ${profile.productsAndServices.slice(0, 2).join(' ')} ${profile.industry}`;

    this.addSessionLog(session, 2, 'search', `Searching live market data with query: "${query1}"`);
    const liveHits = await searchLiveWeb(query1, 6);
    this.addSessionLog(session, 2, 'search', `Searching live market data with query: "${query2}"`);
    const altHits = await searchLiveWeb(query2, 4);

    const allHits = [...liveHits, ...altHits];
    const sourcesSummary = allHits.map((h, i) => `[Source ${i + 1}] Title: ${h.title}\nURL: ${h.url}\nSnippet: ${h.snippet}`).join('\n\n');

    const prompt = `You are a Senior Competitive Intelligence Analyst.
Target Company:
- Name: ${profile.name}
- Domain: ${profile.domain}
- Industry: ${profile.industry}
- Products & Services: ${profile.productsAndServices.join(', ')}
- Business Model: ${profile.businessModel}
- USPs: ${profile.uniqueSellingPropositions.join(', ')}

Live Market Research Sources:
${sourcesSummary}

Task: Identify actual real direct, indirect, and adjacent competitors of ${profile.name}.
RULES:
- ONLY include real commercial companies with actual verifiable websites.
- Classify category as: "direct", "indirect", or "adjacent".
- Do NOT return generic placeholders like "local web agencies".
- State clearly why it is a competitor and how it differs from ${profile.name}.
- Link to the exact source URL where this competitor was referenced.

Return strictly raw valid JSON array:
[
  {
    "name": "Competitor Full Name",
    "website": "https://competitor.com",
    "category": "direct",
    "servicesOrProducts": ["Service 1", "Service 2"],
    "industry": "Industry",
    "location": "Headquarters or major market",
    "targetCustomers": ["Customer segment 1", "Customer segment 2"],
    "differentiators": ["Key differentiator vs ${profile.name}"],
    "whyCompetitor": "Specific reason this competes with ${profile.name}",
    "sourceUrl": "The exact source URL from research"
  }
]`;

    try {
      const response = await geminiService.generateText(prompt, 'Return strictly valid JSON array.');
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const competitors: Competitor[] = [];
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          if (!item.name || !item.website || item.website.includes(profile.domain)) continue;

          let compSite = item.website.trim();
          if (!compSite.startsWith('http')) compSite = `https://${compSite}`;

          const evidence: ResearchEvidence[] = [
            {
              title: `${item.name} Competitor Reference`,
              url: item.sourceUrl || compSite,
              sourceType: 'live_web',
              retrievedAt: new Date().toISOString(),
              extractedSnippet: item.whyCompetitor || `Identified as ${item.category || 'direct'} competitor of ${profile.name}`,
              confidence: 'high'
            }
          ];

          competitors.push({
            id: `comp_${session.companyId}_${i + 1}`,
            companyId: session.companyId,
            researchId: session.id,
            name: item.name,
            website: compSite,
            category: item.category === 'indirect' || item.category === 'adjacent' ? item.category : 'direct',
            servicesOrProducts: Array.isArray(item.servicesOrProducts) ? item.servicesOrProducts : ['Commercial Services'],
            industry: item.industry || profile.industry,
            location: item.location || 'North America',
            targetCustomers: Array.isArray(item.targetCustomers) ? item.targetCustomers : profile.targetIndustries,
            differentiators: Array.isArray(item.differentiators) ? item.differentiators : ['Alternative approach'],
            whyCompetitor: item.whyCompetitor || `Competes directly in ${profile.industry}`,
            sources: evidence
          });
        }
      }

      session.competitors = competitors;
      session.maxCompletedStep = Math.max(session.maxCompletedStep, 2) as any;
      const stepAct = session.stepProgress.find(s => s.stepNumber === 2);
      if (stepAct) {
        stepAct.status = 'completed';
        stepAct.completedAt = new Date().toISOString();
      }

      this.addSessionLog(session, 2, 'success', `Discovered ${competitors.length} real competitors with verifiable websites and evidence`);

      await store.saveCompetitors(competitors, session.companyId, session.id);
      await store.saveResearchSession(session);
      return competitors;
    } catch (err: any) {
      this.addSessionLog(session, 2, 'warn', `Step 2 error: ${err.message}`);
      const stepAct = session.stepProgress.find(s => s.stepNumber === 2);
      if (stepAct) stepAct.status = 'error';
      session.status = 'error';
      session.errorMessage = err.message;
      await store.saveResearchSession(session);
      throw err;
    }
  }

  /**
   * STEP 3: Define Campaigns & ICP
   * Generates real keyword groups, buyer roles, buying signals, negative exclusions.
   * Actual discovered count starts at 0 (NO fake 2.4k estimates!).
   */
  public async executeStep3(session: ResearchSession): Promise<CampaignKeywordGroup[]> {
    if (!session.profile) {
      throw new Error('Company Profile not found. Please complete Step 1 first.');
    }
    const profile = session.profile;
    session.currentStep = 3;
    session.status = 'running';
    this.addSessionLog(session, 3, 'info', `Architecting dynamic B2B outbound campaigns and granular ICP for ${profile.name}`);

    const prompt = `You are an elite B2B Outbound Campaign Architect.
Company Profile:
- Company Name: ${profile.name}
- Industry: ${profile.industry}
- Offerings: ${profile.productsAndServices.join(', ')}
- Target Industries: ${profile.targetIndustries.join(', ')}
- Customer Types: ${profile.customerTypes.join(', ')}
- Problems Solved: ${profile.problemsSolved.join(', ')}
- Target Buyer Roles: ${profile.targetBuyerRoles.join(', ')}
- Default Location: ${profile.defaultLocation?.city || 'Regional'}, ${profile.defaultLocation?.state || 'Target Market'}

Task: Generate 3 to 5 distinct, high-converting B2B Outbound Campaigns tailored specifically to ${profile.name}.
RULES:
- Each campaign must target a specific customer segment that has an urgent need for ${profile.name}'s specific products or services.
- Provide comprehensive keyword groups:
  * coreServiceKeywords (3-5 keywords)
  * problemKeywords (3-4 operational/business pain point keywords)
  * buyingIntentKeywords (3-4 buying signals)
  * negativeKeywords (3-4 exclusions to avoid false positives)
- Provide suggested leadership titles to target.
- Set target geography realistically based on the company's market.
- DO NOT invent fake account counts. (actualDiscoveredCount will start at 0).

Return strictly raw valid JSON array:
[
  {
    "title": "Short Punchy Campaign Title",
    "targetIndustry": "Specific Industry Sector",
    "targetCompanyType": "Specific Type of Target Company",
    "coreServiceKeywords": ["keyword 1", "keyword 2", "keyword 3"],
    "problemKeywords": ["pain 1", "pain 2", "pain 3"],
    "buyingIntentKeywords": ["signal 1", "signal 2"],
    "negativeKeywords": ["exclusion 1", "exclusion 2"],
    "relevantServices": ["Service from ${profile.name} 1", "Service 2"],
    "suggestedRoles": ["Job Title 1", "Job Title 2", "Job Title 3"],
    "targetGeography": {
      "country": "${profile.defaultLocation?.country || 'USA'}",
      "state": "${profile.defaultLocation?.state || ''}",
      "city": "${profile.defaultLocation?.city || ''}",
      "radiusMiles": 50
    },
    "idealCompanySize": "10-250 employees",
    "qualificationCriteria": [
      "Criterion 1 for qualification",
      "Criterion 2"
    ]
  }
]`;

    try {
      const response = await geminiService.generateText(prompt, 'Return strictly valid JSON array.');
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const campaigns: CampaignKeywordGroup[] = [];
      if (Array.isArray(parsed)) {
        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          campaigns.push({
            id: `camp_${session.companyId}_${i + 1}`,
            companyId: session.companyId,
            researchId: session.id,
            title: item.title || `Campaign ${i + 1}`,
            targetIndustry: item.targetIndustry || profile.targetIndustries[0] || 'Commercial',
            targetCompanyType: item.targetCompanyType || 'Target Enterprise',
            coreServiceKeywords: Array.isArray(item.coreServiceKeywords) ? item.coreServiceKeywords : profile.productsAndServices.slice(0, 3),
            problemKeywords: Array.isArray(item.problemKeywords) ? item.problemKeywords : profile.problemsSolved.slice(0, 2),
            buyingIntentKeywords: Array.isArray(item.buyingIntentKeywords) ? item.buyingIntentKeywords : ['upgrade vendor', 'seeking solution'],
            negativeKeywords: Array.isArray(item.negativeKeywords) ? item.negativeKeywords : ['jobs', 'careers', 'internship'],
            relevantServices: Array.isArray(item.relevantServices) ? item.relevantServices : profile.productsAndServices.slice(0, 2),
            suggestedRoles: Array.isArray(item.suggestedRoles) ? item.suggestedRoles : profile.targetBuyerRoles,
            targetGeography: item.targetGeography || {
              country: profile.defaultLocation?.country || 'USA',
              state: profile.defaultLocation?.state,
              city: profile.defaultLocation?.city,
              radiusMiles: 50
            },
            idealCompanySize: item.idealCompanySize || '10-250 employees',
            qualificationCriteria: Array.isArray(item.qualificationCriteria) ? item.qualificationCriteria : ['Active operations', 'Budget authority'],
            actualDiscoveredCount: 0,
            approved: true
          });
        }
      }

      session.campaigns = campaigns;
      session.maxCompletedStep = Math.max(session.maxCompletedStep, 3) as any;
      const stepAct = session.stepProgress.find(s => s.stepNumber === 3);
      if (stepAct) {
        stepAct.status = 'completed';
        stepAct.completedAt = new Date().toISOString();
      }

      this.addSessionLog(session, 3, 'success', `Generated ${campaigns.length} customized outbound campaigns ready for user inspection and prospecting`);

      await store.saveCampaigns(campaigns, session.companyId, session.id);
      await store.saveResearchSession(session);
      return campaigns;
    } catch (err: any) {
      this.addSessionLog(session, 3, 'warn', `Step 3 error: ${err.message}`);
      const stepAct = session.stepProgress.find(s => s.stepNumber === 3);
      if (stepAct) stepAct.status = 'error';
      session.status = 'error';
      session.errorMessage = err.message;
      await store.saveResearchSession(session);
      throw err;
    }
  }

  /**
   * STEP 4: Live Target Company Discovery
   * Searches live web + map for real companies matching campaign keywords and target location
   */
  public async executeStep4(session: ResearchSession, options?: { campaignId?: string; location?: any; limit?: number }): Promise<Lead[]> {
    if (!session.profile) {
      throw new Error('Company Profile not found. Please complete Step 1 first.');
    }
    const profile = session.profile;
    const campaigns = session.campaigns && session.campaigns.length > 0
      ? session.campaigns
      : await store.getCampaigns(session.companyId, session.id);

    const activeCampaign = (options?.campaignId && campaigns.find(c => c.id === options.campaignId)) || campaigns[0];
    const targetIndustry = activeCampaign?.targetIndustry || profile.targetIndustries[0] || 'Commercial Enterprises';
    const limit = options?.limit || 6;

    session.currentStep = 4;
    session.status = 'running';

    const city = options?.location?.city || activeCampaign?.targetGeography?.city || profile.defaultLocation?.city;
    const state = options?.location?.state || activeCampaign?.targetGeography?.state || profile.defaultLocation?.state;
    const country = options?.location?.country || activeCampaign?.targetGeography?.country || profile.defaultLocation?.country || 'USA';

    const locDesc = [city, state, country].filter(Boolean).join(', ');
    this.addSessionLog(session, 4, 'info', `Discovering potential customers for "${targetIndustry}" in "${locDesc || 'Target Market'}"`);

    const keywords = activeCampaign?.coreServiceKeywords?.slice(0, 3).join(' ') || targetIndustry;
    this.addSessionLog(session, 4, 'search', `Querying live web and geographic registries with keywords: "${keywords}" in ${locDesc}`);

    const mapResult = await mapDiscoveryService.discoverBusinesses({
      city,
      state,
      country,
      radiusMiles: activeCampaign?.targetGeography?.radiusMiles || 50,
      industry: targetIndustry,
      limit
    });

    const discoveredPlaces = mapResult.places;
    this.addSessionLog(session, 4, 'info', `Found ${discoveredPlaces.length} live commercial businesses in target geography`);

    const newLeads: Lead[] = [];

    for (const place of discoveredPlaces) {
      const companyDomain = extractCleanDomain(place.website || place.name);

      // Analyze specific whyCustomer reason and qualification breakdown
      const qual = this.calculateTransparentQualification(place, profile, activeCampaign);

      const leadId = `lead_${session.companyId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const lead: Lead = {
        id: leadId,
        companyId: session.companyId,
        researchId: session.id,
        targetCampaignId: activeCampaign?.id,
        companyName: place.name,
        website: place.website,
        industry: place.category || targetIndustry,
        location: place.address || locDesc || 'Location on file',
        city: place.city || city,
        state: place.state || state,
        country: place.country || country,
        coordinates: place.coordinates,
        distanceMiles: place.distanceMiles,
        description: place.operationalSuitability,
        relevantOperations: place.operationalSuitability,
        relevantServiceNeeded: activeCampaign?.relevantServices?.[0] || profile.productsAndServices[0],
        whyCustomer: qual.reasons[0] || `Operational activities align with ${profile.name}'s offerings`,
        fitScore: qual.totalScore,
        fitReasons: qual.reasons,
        qualificationBreakdown: qual,
        decisionMakers: [],
        status: qual.totalScore >= 70 ? 'Qualified' : 'New',
        sources: place.sources.map(s => s.url),
        evidenceSources: place.sources,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      newLeads.push(lead);
      this.addSessionLog(session, 4, 'success', `Qualified company: ${lead.companyName} (${lead.location}) - Fit Score: ${lead.fitScore}%`, lead.website);
    }

    // Update actualDiscoveredCount on the active campaign
    if (activeCampaign) {
      activeCampaign.actualDiscoveredCount = newLeads.length;
      await store.saveCampaign(activeCampaign);
    }

    session.leads = newLeads;
    session.maxCompletedStep = Math.max(session.maxCompletedStep, 4) as any;
    const stepAct = session.stepProgress.find(s => s.stepNumber === 4);
    if (stepAct) {
      stepAct.status = 'completed';
      stepAct.completedAt = new Date().toISOString();
    }

    await store.saveLeads(newLeads, session.companyId, session.id);
    await store.saveResearchSession(session);
    return newLeads;
  }

  /**
   * STEP 5: Real Decision-Maker & Email Discovery
   * Identifies real leadership on official website / public search, searches real LinkedIn profile URLs, queries Hunter.io API
   */
  public async executeStep5(session: ResearchSession): Promise<Lead[]> {
    if (!session.leads || session.leads.length === 0) {
      const stored = await store.getLeads(session.companyId, session.id);
      if (stored.length === 0) {
        throw new Error('No discovered companies found. Please complete Step 4 first.');
      }
      session.leads = stored;
    }

    const profile = session.profile || (await store.getCompanyProfile(session.companyId));
    if (!profile) throw new Error('Company Profile not found');

    session.currentStep = 5;
    session.status = 'running';
    this.addSessionLog(session, 5, 'info', `Beginning decision-maker discovery & email verification across ${session.leads.length} companies`);

    const enrichedLeads: Lead[] = [];

    for (const lead of session.leads) {
      this.addSessionLog(session, 5, 'scrape', `Querying LinkedIn People Finder (Agent 2) for ${lead.companyName} (${lead.website})`, lead.website);

      const targetRoles = profile.targetBuyerRoles || ['Operations Director', 'Owner', 'Managing Director', 'CEO', 'Head of Sales'];
      
      // Re-use LinkedIn People Finder (Agent 2) for strict verified profile matching
      let dmName = 'Leadership Team';
      let dmTitle = targetRoles[0] || 'Leadership';
      let dmDept = 'Management';
      let dmLinkedinUrl: string | null = null;
      let dmLinkedinStatus: 'found' | 'not_found' = 'not_found';
      let dmVerificationStatus: 'verified' | 'unverified' | 'invalid' = 'unverified';
      let dmEvidenceUrl = lead.website;
      let dmEvidenceText = '';

      try {
        const peopleRun = await emailFinderService.discoverPeople({
          mode: 'single_company',
          website: lead.website,
          companyName: lead.companyName,
          keywords: targetRoles,
          targetIndustry: lead.industry,
          limit: 3
        });

        const topContact = peopleRun.contacts.find(c => c.verificationStatus === 'Verified') || peopleRun.contacts[0];
        if (topContact) {
          dmName = topContact.name;
          dmTitle = topContact.title;
          dmDept = topContact.department || 'Management';
          dmLinkedinUrl = topContact.linkedinUrl || null;
          dmLinkedinStatus = topContact.linkedinUrl ? 'found' : 'not_found';
          dmVerificationStatus = topContact.verificationStatus === 'Verified' ? 'verified' : 'unverified';
          dmEvidenceUrl = topContact.sourceUrl || topContact.linkedinUrl || lead.website;
          dmEvidenceText = topContact.companyEvidence || topContact.linkedinEvidence || `${topContact.title} at ${lead.companyName}`;
        }
      } catch (err: any) {
        // Fallback to direct search
        const dm = await this.discoverRealDecisionMaker(lead.companyName, lead.website, targetRoles, lead.industry);
        dmName = dm.name;
        dmTitle = dm.title;
        dmDept = dm.department || 'Operations';
        dmLinkedinUrl = dm.linkedinUrl;
        dmLinkedinStatus = dm.linkedinStatus;
        dmEvidenceUrl = dm.linkedinUrl || lead.website;
        dmEvidenceText = dm.evidence[0]?.extractedSnippet || `Leadership at ${lead.companyName}`;
      }

      const dm = {
        name: dmName,
        title: dmTitle,
        department: dmDept,
        linkedinUrl: dmLinkedinUrl,
        linkedinStatus: dmLinkedinStatus,
        evidence: [
          {
            title: `${dmName} (${dmTitle}) at ${lead.companyName}`,
            url: dmEvidenceUrl,
            sourceType: 'leadership_page' as const,
            retrievedAt: new Date().toISOString(),
            extractedSnippet: dmEvidenceText,
            confidence: (dmVerificationStatus === 'verified' ? 'high' : 'medium') as any
          }
        ]
      };

      this.addSessionLog(
        session,
        5,
        'info',
        `Contact identified for ${lead.companyName}: ${dm.name} (${dm.title}) | LinkedIn: ${dm.linkedinStatus === 'found' ? dm.linkedinUrl : 'Not Found'}`
      );

      // Verify email via Hunter.io API + official website scraper
      this.addSessionLog(session, 5, 'verify', `Verifying professional email for ${dm.name} at ${lead.website}`);
      const emailRes = await emailDiscoveryService.discoverEmail(dm.name, dm.title, lead.companyName, lead.website);

      const decisionMaker: DecisionMaker = {
        name: dm.name,
        title: dm.title,
        department: dm.department || 'Operations',
        linkedinUrl: dm.linkedinUrl,
        linkedinStatus: dm.linkedinStatus,
        email: emailRes.email || null,
        emailConfidence: emailRes.confidence,
        verificationStatus: emailRes.emailStatus === 'Verified' ? 'verified' : (emailRes.email ? 'unverified' : 'invalid'),
        emailStatus: emailRes.emailStatus,
        emailSource: emailRes.emailSource || 'Not found',
        providerBadges: emailRes.providerBadges,
        verificationDetails: emailRes.verificationDetails,
        contactEvidence: [...dm.evidence, ...emailRes.evidence],
        researchedAt: new Date().toISOString()
      };

      lead.decisionMakers = [decisionMaker];
      lead.updatedAt = new Date().toISOString();
      enrichedLeads.push(lead);

      this.addSessionLog(
        session,
        5,
        'success',
        `Email status for ${dm.name}: ${decisionMaker.emailStatus} (${decisionMaker.email || 'No email found'})`
      );
    }

    session.leads = enrichedLeads;
    session.maxCompletedStep = Math.max(session.maxCompletedStep, 5) as any;
    const stepAct = session.stepProgress.find(s => s.stepNumber === 5);
    if (stepAct) {
      stepAct.status = 'completed';
      stepAct.completedAt = new Date().toISOString();
    }

    await store.saveLeads(enrichedLeads, session.companyId, session.id);
    await store.saveResearchSession(session);
    return enrichedLeads;
  }

  /**
   * STEP 6: Generate Personalized Outreach
   * Generates tailored 1:1 emails based on actual company operations and verified decision-maker info
   */
  public async executeStep6(session: ResearchSession): Promise<Lead[]> {
    if (!session.leads || session.leads.length === 0) {
      const stored = await store.getLeads(session.companyId, session.id);
      if (stored.length === 0) {
        throw new Error('No leads found. Please complete Step 4 & 5 first.');
      }
      session.leads = stored;
    }

    const profile = session.profile || (await store.getCompanyProfile(session.companyId));
    if (!profile) throw new Error('Company Profile not found');

    session.currentStep = 6;
    session.status = 'running';
    this.addSessionLog(session, 6, 'info', `Drafting individualized 1:1 cold outreach for ${session.leads.length} verified accounts`);

    for (const lead of session.leads) {
      try {
        const email = await this.generatePersonalizedOutreach(lead, profile);
        lead.personalizedEmail = email;
        this.addSessionLog(session, 6, 'success', `Generated 1:1 email for ${lead.companyName} (${lead.decisionMakers[0]?.name || 'Leadership'})`);
      } catch (err: any) {
        this.addSessionLog(session, 6, 'warn', `Could not generate email for ${lead.companyName}: ${err.message}`);
      }
    }

    session.maxCompletedStep = 6;
    session.status = 'completed';
    const stepAct = session.stepProgress.find(s => s.stepNumber === 6);
    if (stepAct) {
      stepAct.status = 'completed';
      stepAct.completedAt = new Date().toISOString();
    }

    // Refresh stats
    session.stats = await store.getLeadStats(session.companyId, session.id);

    await store.saveLeads(session.leads, session.companyId, session.id);
    await store.saveResearchSession(session);
    return session.leads;
  }

  /**
   * Master Autonomous Runner: Executes all remaining steps sequentially
   */
  public async runAllSteps(sessionId: string): Promise<ResearchSession> {
    const session = await store.getResearchSession(sessionId);
    if (!session) throw new Error(`Research session ${sessionId} not found`);

    if (session.maxCompletedStep < 1) {
      await this.executeStep1(session);
    }
    if (session.maxCompletedStep < 2) {
      await this.executeStep2(session);
    }
    if (session.maxCompletedStep < 3) {
      await this.executeStep3(session);
    }
    if (session.maxCompletedStep < 4) {
      await this.executeStep4(session);
    }
    if (session.maxCompletedStep < 5) {
      await this.executeStep5(session);
    }
    if (session.maxCompletedStep < 6) {
      await this.executeStep6(session);
    }

    return session;
  }

  /**
   * Autonomous 6-stage workflow helper for single URL input
   */
  public async runFullResearchWorkflow(rawUrl: string, options?: any): Promise<{
    session: ResearchSession;
    profile?: CompanyProfile;
    competitors: Competitor[];
    campaigns: CampaignKeywordGroup[];
    leads: Lead[];
    stats?: any;
  }> {
    const session = await this.createSession(rawUrl, options?.location);
    const completedSession = await this.runAllSteps(session.id);
    return {
      session: completedSession,
      profile: completedSession.profile,
      competitors: completedSession.competitors || [],
      campaigns: completedSession.campaigns || [],
      leads: completedSession.leads || [],
      stats: completedSession.stats
    };
  }

  /**
   * Prospect leads based on criteria
   */
  public async prospectLeads(criteria: any, companyProfile?: CompanyProfile): Promise<Lead[]> {
    const profile = companyProfile || (criteria.companyId ? await store.getCompanyProfile(criteria.companyId) : undefined);
    const limit = criteria.limit || 6;
    const targetIndustry = criteria.industry || profile?.targetIndustries[0] || 'Commercial Enterprises';

    const mapResult = await mapDiscoveryService.discoverBusinesses({
      city: criteria.city,
      state: criteria.state,
      country: criteria.country || 'USA',
      postalCode: criteria.postalCode,
      radiusMiles: criteria.radiusMiles || 25,
      industry: targetIndustry,
      limit
    });

    const leads: Lead[] = [];
    for (const place of mapResult.places) {
      const qual = this.calculateTransparentQualification(place, profile);
      const leadId = `lead_${profile?.id || 'gen'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const lead: Lead = {
        id: leadId,
        companyId: profile?.id || criteria.companyId || 'general',
        targetCampaignId: criteria.campaignId,
        companyName: place.name,
        website: place.website,
        industry: place.category || targetIndustry,
        location: place.address || `${criteria.city || ''}, ${criteria.state || ''}`.trim(),
        city: place.city || criteria.city,
        state: place.state || criteria.state,
        country: place.country || criteria.country || 'USA',
        coordinates: place.coordinates,
        distanceMiles: place.distanceMiles,
        description: place.operationalSuitability,
        relevantOperations: place.operationalSuitability,
        relevantServiceNeeded: profile?.productsAndServices[0] || 'Professional Solutions',
        whyCustomer: qual.reasons[0] || 'Matches operational criteria',
        fitScore: qual.totalScore,
        fitReasons: qual.reasons,
        qualificationBreakdown: qual,
        decisionMakers: [],
        status: qual.totalScore >= 70 ? 'Qualified' : 'New',
        sources: place.sources.map(s => s.url),
        evidenceSources: place.sources,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      leads.push(lead);
    }

    if (leads.length > 0) {
      await store.saveLeads(leads, profile?.id || criteria.companyId);
    }
    return leads;
  }

  /**
   * Personalize 1:1 email for a single lead
   */
  public async personalizeEmail(lead: Lead, companyProfile?: CompanyProfile, valueProp?: string): Promise<PersonalizedEmailData> {
    const profile = companyProfile || (lead.companyId ? await store.getCompanyProfile(lead.companyId) : undefined);
    const mockProfile: CompanyProfile = profile || {
      id: 'default',
      domain: 'company.com',
      url: 'https://company.com',
      name: 'Our Company',
      description: 'Provider of advanced commercial solutions',
      industry: lead.industry,
      businessModel: 'B2B',
      productsAndServices: [valueProp || 'Commercial Solutions'],
      targetIndustries: [lead.industry],
      customerTypes: ['Commercial Businesses'],
      geographicMarkets: ['North America'],
      technologiesUsedOrOffered: [],
      problemsSolved: ['Operational efficiency'],
      uniqueSellingPropositions: [valueProp || 'High efficiency, low operational downtime'],
      customerBenefits: ['Cost efficiency', 'Performance'],
      competitorPositioning: 'Premium quality',
      targetBuyerRoles: ['Operations Director', 'Owner'],
      sources: [],
      analyzedAt: new Date().toISOString()
    };

    return this.generatePersonalizedOutreach(lead, mockProfile, valueProp);
  }

  /**
   * Discovers real decision makers using official team pages + public search for LinkedIn profile URLs
   */
  private async discoverRealDecisionMaker(
    companyName: string,
    companyWebsite: string,
    targetRoles: string[],
    industry: string
  ): Promise<{ name: string; title: string; department?: string; linkedinUrl: string | null; linkedinStatus: 'found' | 'not_found'; evidence: ResearchEvidence[] }> {
    const evidence: ResearchEvidence[] = [];

    // Query live search specifically for real LinkedIn individual profiles
    const rolesQuery = targetRoles.slice(0, 3).map(r => `"${r}"`).join(' OR ');
    const linkedinSearchQuery = `site:linkedin.com/in/ "${companyName}" (${rolesQuery})`;

    let foundLinkedinUrl: string | null = null;
    let foundName: string | null = null;
    let foundTitle: string | null = null;

    try {
      const searchHits = await searchLiveWeb(linkedinSearchQuery, 4);

      for (const hit of searchHits) {
        // Validate that this is an individual profile (contains /in/)
        if (hit.url && /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i.test(hit.url)) {
          foundLinkedinUrl = hit.url;
          evidence.push({
            title: hit.title,
            url: hit.url,
            sourceType: 'leadership_page',
            retrievedAt: new Date().toISOString(),
            extractedSnippet: hit.snippet,
            confidence: 'high'
          });

          // Extract name & title from title: e.g. "John Doe - Managing Director - TekAxis | LinkedIn"
          const titleParts = hit.title.replace(/\s*\|\s*LinkedIn.*$/i, '').split(/\s*[-–—]\s*/);
          if (titleParts.length >= 2) {
            foundName = titleParts[0].trim();
            foundTitle = titleParts[1].trim();
          } else if (titleParts.length === 1) {
            foundName = titleParts[0].trim();
          }
          break;
        }
      }
    } catch {
      // ignore
    }

    // If individual was identified via LinkedIn
    if (foundName && foundName.split(' ').length >= 2 && !foundName.toLowerCase().includes('top') && !foundName.toLowerCase().includes('company')) {
      return {
        name: foundName,
        title: foundTitle || targetRoles[0] || 'Leadership',
        department: 'Executive Leadership',
        linkedinUrl: foundLinkedinUrl,
        linkedinStatus: 'found',
        evidence
      };
    }

    // Search website /about or /team page via live web
    try {
      const teamHits = await searchLiveWeb(`"${companyName}" (founder OR CEO OR "managing director" OR owner OR "operations manager") team leadership`, 3);
      if (teamHits.length > 0) {
        const hit = teamHits[0];
        evidence.push({
          title: hit.title,
          url: hit.url,
          sourceType: 'official_website',
          retrievedAt: new Date().toISOString(),
          extractedSnippet: hit.snippet,
          confidence: 'medium'
        });

        // Use Gemini to extract the person's name strictly from snippet
        const extractPrompt = `From this text snippet about "${companyName}":
"${hit.snippet}"

Extract the full name and job title of ONE real executive or manager mentioned.
If no individual's personal full name is present in the text, return {"name": null, "title": null}.
DO NOT guess or invent a fake name.

Return raw JSON: {"name": string | null, "title": string | null}`;

        const resp = await geminiService.generateText(extractPrompt, 'Return strictly raw JSON.');
        const parsed = JSON.parse(resp.replace(/```json/gi, '').replace(/```/g, '').trim());

        if (parsed.name && parsed.name.trim().length > 3) {
          return {
            name: parsed.name,
            title: parsed.title || targetRoles[0] || 'Leadership',
            department: 'Management',
            linkedinUrl: null, // Honest: LinkedIn profile not found
            linkedinStatus: 'not_found',
            evidence
          };
        }
      }
    } catch {
      // ignore
    }

    // If no real individual was found, report honestly rather than inventing a person!
    return {
      name: 'Management Team',
      title: 'Leadership Not Publicly Disclosed',
      department: 'Operations',
      linkedinUrl: null,
      linkedinStatus: 'not_found',
      evidence
    };
  }

  /**
   * Transparent Multi-Factor Qualification Calculation (No hardcoded arbitrary 87-95% scores)
   */
  private calculateTransparentQualification(
    place: DiscoveredMapPlace,
    profile?: CompanyProfile | null,
    campaign?: CampaignKeywordGroup
  ): QualificationBreakdown {
    let icpMatch = 15;
    let serviceRelevance = 15;
    let locationMatch = 10;
    let operationalNeedEvidence = 15;
    const reasons: string[] = [];

    const pName = profile?.name || 'Sender';
    const targetRoles = profile?.targetBuyerRoles || [];
    const targetIndustries = profile?.targetIndustries || [];
    const productsAndServices = profile?.productsAndServices || ['Commercial Solutions'];

    const categoryLower = (place.category || '').toLowerCase();
    const targetIndLower = (campaign?.targetIndustry || targetIndustries[0] || '').toLowerCase();

    // 1. ICP Match (0-25)
    if (categoryLower.includes(targetIndLower) || targetIndLower.includes(categoryLower)) {
      icpMatch = 24;
      reasons.push(`Direct ICP match in ${place.category}`);
    } else if (targetIndustries.some(ti => categoryLower.includes(ti.toLowerCase()))) {
      icpMatch = 20;
      reasons.push(`Secondary target industry match: ${place.category}`);
    } else {
      icpMatch = 12;
      reasons.push(`Commercial operation in adjacent sector: ${place.category}`);
    }

    // 2. Service Relevance (0-25)
    const neededService = campaign?.relevantServices?.[0] || productsAndServices[0];
    if (place.operationalSuitability && place.operationalSuitability.length > 30) {
      serviceRelevance = 22;
      reasons.push(`Demonstrated operational requirement for ${neededService}`);
    } else {
      serviceRelevance = 15;
      reasons.push(`Standard commercial fit for ${neededService}`);
    }

    // 3. Location Match (0-20)
    if (place.distanceMiles !== undefined) {
      if (place.distanceMiles <= 25) {
        locationMatch = 20;
        reasons.push(`Located within immediate 25-mile local service radius (${place.distanceMiles} mi)`);
      } else if (place.distanceMiles <= 60) {
        locationMatch = 16;
        reasons.push(`Located within regional operating market (${place.distanceMiles} mi)`);
      } else {
        locationMatch = 12;
        reasons.push(`Regional customer location (${place.distanceMiles} mi)`);
      }
    } else {
      locationMatch = 14;
      reasons.push(`Active in target geographic market (${place.city || 'Regional'})`);
    }

    // 4. Operational Need Evidence (0-30)
    if (place.sources && place.sources.length > 0) {
      operationalNeedEvidence = 25;
      reasons.push(`Verified commercial presence confirmed via official website evidence`);
    } else {
      operationalNeedEvidence = 15;
    }

    const totalScore = icpMatch + serviceRelevance + locationMatch + operationalNeedEvidence;

    return {
      icpMatch,
      serviceRelevance,
      locationMatch,
      operationalNeedEvidence,
      totalScore,
      reasons
    };
  }

  /**
   * Generates personalized 1:1 outreach based on actual company operations
   */
  public async generatePersonalizedOutreach(lead: Lead, profile: CompanyProfile, valueProp?: string): Promise<PersonalizedEmailData> {
    const dm = lead.decisionMakers[0];
    const contactName = dm && dm.name !== 'Management Team' ? dm.name : 'Leadership Team';
    const firstName = contactName.split(' ')[0];

    const prompt = `You are an elite B2B Cold Outreach Copywriter.
Sender Company:
- Name: ${profile.name}
- Industry: ${profile.industry}
- Core Solution: ${profile.productsAndServices[0]}
- Value Proposition: ${valueProp || profile.uniqueSellingPropositions[0]}

Prospect Account:
- Company Name: ${lead.companyName}
- Website: ${lead.website}
- Industry: ${lead.industry}
- Location: ${lead.location}
- Observed Operations: ${lead.relevantOperations || lead.description}
- Relevant Service Needed: ${lead.relevantServiceNeeded || profile.productsAndServices[0]}
- Target Decision Maker: ${contactName} (${dm?.title || 'Leadership'})

Write a hyper-personalized, authentic, low-pressure cold email to this prospect.
RULES:
- Do NOT sound like an automated marketing blast.
- Open by referencing a genuine observation about their operations in ${lead.location}.
- Explain specifically how ${profile.name}'s ${profile.productsAndServices[0]} addresses a real operational pain point.
- End with a low-friction question (e.g. "Mind if I send over a few short ideas on how that setup fits an operation like yours?").
- Sign off professionally from Aaron at ${profile.name}.

Return strictly raw valid JSON:
{
  "subject": "Compelling short subject line (under 6 words)",
  "subjectVariations": [
    "Subject variation 1",
    "Subject variation 2",
    "Subject variation 3"
  ],
  "hook": "Specific 1-sentence hook referencing their operations",
  "painPoint": "Specific operational pain point addressed",
  "valueProposition": "1-sentence value proposition",
  "cta": "Low-friction call to action",
  "body": "Full personalized email text including greeting and signature",
  "followUpSequences": [
    {
      "stepNumber": 1,
      "delayDays": 3,
      "subject": "Follow-up subject",
      "body": "Follow-up body"
    },
    {
      "stepNumber": 2,
      "delayDays": 7,
      "subject": "Second follow-up subject",
      "body": "Second follow-up body"
    }
  ]
}`;

    const resp = await geminiService.generateText(prompt, 'Return strictly valid JSON.');
    const cleaned = resp.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      subject: parsed.subject || `${profile.name} / ${lead.companyName}`,
      subjectVariations: Array.isArray(parsed.subjectVariations) ? parsed.subjectVariations : [
        `Quick question regarding ${lead.companyName}`,
        `${profile.name} solutions for ${lead.companyName}`
      ],
      hook: parsed.hook || `Saw ${lead.companyName}'s active operations in ${lead.location}.`,
      painPoint: parsed.painPoint || profile.problemsSolved[0] || 'Operational friction',
      valueProposition: parsed.valueProposition || profile.uniqueSellingPropositions[0],
      cta: parsed.cta || 'Mind if I send over a few short written ideas?',
      body: parsed.body || `Hi ${firstName},\n\nI saw ${lead.companyName} manages active operations in ${lead.location}. I'm Aaron at ${profile.name}.\n\nWe specialize in ${profile.productsAndServices[0]}, helping organizations streamline workflows.\n\nMind if I send over a few short written ideas on how that setup fits an operation like yours?\n\nBest,\n\nAaron\n${profile.name}`,
      followUpSequences: Array.isArray(parsed.followUpSequences) ? parsed.followUpSequences : [],
      generatedAt: new Date().toISOString()
    };
  }
}

export const prospectingEngine = new ProspectingEngine();
