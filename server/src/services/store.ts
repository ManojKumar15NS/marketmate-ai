import fs from 'fs/promises';
import path from 'path';
import {
  Conversation,
  Task,
  Lead,
  Competitor,
  CampaignKeywordGroup,
  ExtendedLeadStats,
  CompanyProfile,
  ResearchSession,
  EmailSearchRun,
  WhatsAppSearchRun
} from '../types/index.js';
import { postgresDb } from '../db/postgres.js';
import { logger } from '../utils/logger.js';

const DATA_DIR = path.resolve(__dirname, '../../../data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const COMPETITORS_FILE = path.join(DATA_DIR, 'competitors.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const COMPANY_PROFILES_FILE = path.join(DATA_DIR, 'company_profiles.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const EMAIL_SEARCHES_FILE = path.join(DATA_DIR, 'email_searches.json');
const WHATSAPP_SEARCHES_FILE = path.join(DATA_DIR, 'whatsapp_searches.json');

function isPostgresActive(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

// Ensure data directory exists
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Atomic file writer to avoid corruption during process restart or concurrent writes
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  const jsonString = JSON.stringify(data, null, 2);
  await fs.writeFile(tempPath, jsonString, 'utf-8');
  await fs.rename(tempPath, filePath);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await atomicWriteJson(filePath, fallback);
      return fallback;
    }
    console.error(`Error reading ${filePath}:`, error);
    return fallback;
  }
}

// In-memory cache for ultra-fast response, synced with atomic writes
let conversationsCache: Conversation[] | null = null;
let tasksCache: Task[] | null = null;
let leadsCache: Lead[] | null = null;
let competitorsCache: Competitor[] | null = null;
let campaignsCache: CampaignKeywordGroup[] | null = null;
let companyProfilesCache: CompanyProfile[] | null = null;
let sessionsCache: ResearchSession[] | null = null;
let emailSearchesCache: EmailSearchRun[] | null = null;
let whatsappSearchesCache: WhatsAppSearchRun[] | null = null;

export const store = {
  async init(): Promise<void> {
    if (isPostgresActive()) {
      logger.info('[Store] Initializing PostgreSQL backend store...');
      await postgresDb.init();
      logger.info('[Store] PostgreSQL backend store ready.');
      return;
    }

    await ensureDir(DATA_DIR);
    conversationsCache = await readJson<Conversation[]>(CONVERSATIONS_FILE, []);
    tasksCache = await readJson<Task[]>(TASKS_FILE, []);
    leadsCache = await readJson<Lead[]>(LEADS_FILE, []);
    competitorsCache = await readJson<Competitor[]>(COMPETITORS_FILE, []);
    campaignsCache = await readJson<CampaignKeywordGroup[]>(CAMPAIGNS_FILE, []);
    companyProfilesCache = await readJson<CompanyProfile[]>(COMPANY_PROFILES_FILE, []);
    sessionsCache = await readJson<ResearchSession[]>(SESSIONS_FILE, []);
  },

  /* ---------------- Conversations ---------------- */
  async getConversations(): Promise<Conversation[]> {
    if (isPostgresActive()) {
      return postgresDb.getConversations();
    }
    if (!conversationsCache) {
      conversationsCache = await readJson<Conversation[]>(CONVERSATIONS_FILE, []);
    }
    return [...conversationsCache].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getConversation(id: string): Promise<Conversation | null> {
    if (isPostgresActive()) {
      return postgresDb.getConversation(id);
    }
    const convs = await this.getConversations();
    return convs.find(c => c.id === id) || null;
  },

  async saveConversation(conv: Conversation): Promise<Conversation> {
    if (isPostgresActive()) {
      return postgresDb.saveConversation(conv);
    }
    const convs = await this.getConversations();
    const idx = convs.findIndex(c => c.id === conv.id);
    conv.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      convs[idx] = conv;
    } else {
      convs.unshift(conv);
    }
    conversationsCache = convs;
    await atomicWriteJson(CONVERSATIONS_FILE, convs);
    return conv;
  },

  async deleteConversation(id: string): Promise<boolean> {
    if (isPostgresActive()) {
      return postgresDb.deleteConversation(id);
    }
    const convs = await this.getConversations();
    const filtered = convs.filter(c => c.id !== id);
    if (filtered.length !== convs.length) {
      conversationsCache = filtered;
      await atomicWriteJson(CONVERSATIONS_FILE, filtered);
      return true;
    }
    return false;
  },

  /* ---------------- Tasks ---------------- */
  async getTasks(): Promise<Task[]> {
    if (isPostgresActive()) {
      return postgresDb.getTasks();
    }
    if (!tasksCache) {
      tasksCache = await readJson<Task[]>(TASKS_FILE, []);
    }
    return [...tasksCache].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  },

  async getTask(id: string): Promise<Task | null> {
    if (isPostgresActive()) {
      return postgresDb.getTask(id);
    }
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === id) || null;
  },

  async saveTask(task: Task): Promise<Task> {
    if (isPostgresActive()) {
      return postgresDb.saveTask(task);
    }
    const tasks = await this.getTasks();
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = task;
    } else {
      tasks.unshift(task);
    }
    tasksCache = tasks;
    await atomicWriteJson(TASKS_FILE, tasks);
    return task;
  },

  async getStats() {
    if (isPostgresActive()) {
      return postgresDb.getStats();
    }
    const tasks = await this.getTasks();
    const conversations = await this.getConversations();
    const totalMessages = conversations.reduce((acc, c) => acc + (c.messages?.length || 0), 0);

    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      totalConversations: conversations.length,
      totalMessages
    };
  },

  /* ---------------- Research Sessions ---------------- */
  async getResearchSessions(): Promise<ResearchSession[]> {
    if (isPostgresActive()) {
      return postgresDb.getResearchSessions();
    }
    if (!sessionsCache) {
      sessionsCache = await readJson<ResearchSession[]>(SESSIONS_FILE, []);
    }
    return [...sessionsCache].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getResearchSession(id: string): Promise<ResearchSession | null> {
    if (isPostgresActive()) {
      return postgresDb.getResearchSession(id);
    }
    const sessions = await this.getResearchSessions();
    return sessions.find(s => s.id === id) || null;
  },

  async saveResearchSession(session: ResearchSession): Promise<ResearchSession> {
    if (isPostgresActive()) {
      return postgresDb.saveResearchSession(session);
    }
    const sessions = await this.getResearchSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    session.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.unshift(session);
    }
    sessionsCache = sessions;
    await atomicWriteJson(SESSIONS_FILE, sessions);
    return session;
  },

  async deleteResearchSession(id: string): Promise<boolean> {
    if (isPostgresActive()) {
      return postgresDb.deleteResearchSession(id);
    }
    const sessions = await this.getResearchSessions();
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length !== sessions.length) {
      sessionsCache = filtered;
      await atomicWriteJson(SESSIONS_FILE, filtered);
      return true;
    }
    return false;
  },

  /* ---------------- Company Profiles ---------------- */
  async getCompanyProfiles(): Promise<CompanyProfile[]> {
    if (isPostgresActive()) {
      return postgresDb.getCompanyProfiles();
    }
    if (!companyProfilesCache) {
      companyProfilesCache = await readJson<CompanyProfile[]>(COMPANY_PROFILES_FILE, []);
    }
    return companyProfilesCache;
  },

  async getCompanyProfile(id: string): Promise<CompanyProfile | null> {
    if (isPostgresActive()) {
      return postgresDb.getCompanyProfile(id);
    }
    const profiles = await this.getCompanyProfiles();
    return profiles.find(p => p.id === id || p.domain === id) || null;
  },

  async saveCompanyProfile(profile: CompanyProfile): Promise<CompanyProfile> {
    if (isPostgresActive()) {
      return postgresDb.saveCompanyProfile(profile);
    }
    const profiles = await this.getCompanyProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id || p.domain === profile.domain);
    if (idx >= 0) {
      profiles[idx] = profile;
    } else {
      profiles.unshift(profile);
    }
    companyProfilesCache = profiles;
    await atomicWriteJson(COMPANY_PROFILES_FILE, profiles);
    return profile;
  },

  /* ---------------- Leads / Discovered Accounts ---------------- */
  async getLeads(companyId?: string, researchId?: string): Promise<Lead[]> {
    if (isPostgresActive()) {
      return postgresDb.getLeads(companyId, researchId);
    }
    if (!leadsCache) {
      leadsCache = await readJson<Lead[]>(LEADS_FILE, []);
    }
    let result = [...leadsCache];
    if (companyId && companyId !== 'all') {
      result = result.filter(l => l.companyId === companyId);
    }
    if (researchId && researchId !== 'all') {
      result = result.filter(l => l.researchId === researchId);
    }
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getLead(id: string): Promise<Lead | null> {
    if (isPostgresActive()) {
      return postgresDb.getLead(id);
    }
    const leads = await this.getLeads();
    return leads.find(l => l.id === id) || null;
  },

  async saveLead(lead: Lead): Promise<Lead> {
    if (isPostgresActive()) {
      return postgresDb.saveLead(lead);
    }
    const leads = await this.getLeads();
    const idx = leads.findIndex(l => l.id === lead.id);
    lead.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      leads[idx] = lead;
    } else {
      leads.unshift(lead);
    }
    leadsCache = leads;
    await atomicWriteJson(LEADS_FILE, leads);
    return lead;
  },

  async saveLeads(newLeads: Lead[], companyId?: string, researchId?: string): Promise<Lead[]> {
    if (isPostgresActive()) {
      return postgresDb.saveLeads(newLeads, companyId, researchId);
    }
    const leads = await this.getLeads();
    for (const lead of newLeads) {
      if (companyId && !lead.companyId) lead.companyId = companyId;
      if (researchId && !lead.researchId) lead.researchId = researchId;
      const idx = leads.findIndex(
        l => l.id === lead.id || (l.website && l.website === lead.website && l.companyId === lead.companyId)
      );
      lead.updatedAt = new Date().toISOString();
      if (idx >= 0) {
        leads[idx] = { ...leads[idx], ...lead };
      } else {
        leads.unshift(lead);
      }
    }
    leadsCache = leads;
    await atomicWriteJson(LEADS_FILE, leads);
    return leads;
  },

  async deleteLead(id: string): Promise<boolean> {
    if (isPostgresActive()) {
      return postgresDb.deleteLead(id);
    }
    const leads = await this.getLeads();
    const filtered = leads.filter(l => l.id !== id);
    if (filtered.length !== leads.length) {
      leadsCache = filtered;
      await atomicWriteJson(LEADS_FILE, filtered);
      return true;
    }
    return false;
  },

  /* ---------------- Competitors ---------------- */
  async getCompetitors(companyId?: string, researchId?: string): Promise<Competitor[]> {
    if (isPostgresActive()) {
      return postgresDb.getCompetitors(companyId, researchId);
    }
    if (!competitorsCache) {
      competitorsCache = await readJson<Competitor[]>(COMPETITORS_FILE, []);
    }
    let result = [...competitorsCache];
    if (companyId && companyId !== 'all') {
      result = result.filter(c => c.companyId === companyId);
    }
    if (researchId && researchId !== 'all') {
      result = result.filter(c => c.researchId === researchId);
    }
    return result;
  },

  async saveCompetitors(competitors: Competitor[], companyId?: string, researchId?: string): Promise<Competitor[]> {
    if (isPostgresActive()) {
      return postgresDb.saveCompetitors(competitors, companyId, researchId);
    }
    const existing = await this.getCompetitors();
    let updated = [...existing];

    if (companyId) {
      updated = updated.filter(c => c.companyId !== companyId);
      for (const comp of competitors) {
        comp.companyId = companyId;
        if (researchId) comp.researchId = researchId;
        updated.push(comp);
      }
    } else {
      updated = competitors;
    }

    competitorsCache = updated;
    await atomicWriteJson(COMPETITORS_FILE, updated);
    return this.getCompetitors(companyId, researchId);
  },

  /* ---------------- Campaigns ---------------- */
  async getCampaigns(companyId?: string, researchId?: string): Promise<CampaignKeywordGroup[]> {
    if (isPostgresActive()) {
      return postgresDb.getCampaigns(companyId, researchId);
    }
    if (!campaignsCache) {
      campaignsCache = await readJson<CampaignKeywordGroup[]>(CAMPAIGNS_FILE, []);
    }
    let result = [...campaignsCache];
    if (companyId && companyId !== 'all') {
      result = result.filter(c => c.companyId === companyId);
    }
    if (researchId && researchId !== 'all') {
      result = result.filter(c => c.researchId === researchId);
    }
    return result;
  },

  async saveCampaigns(campaigns: CampaignKeywordGroup[], companyId?: string, researchId?: string): Promise<CampaignKeywordGroup[]> {
    if (isPostgresActive()) {
      return postgresDb.saveCampaigns(campaigns, companyId, researchId);
    }
    const existing = await this.getCampaigns();
    let updated = [...existing];

    if (companyId) {
      updated = updated.filter(c => c.companyId !== companyId);
      for (const camp of campaigns) {
        camp.companyId = companyId;
        if (researchId) camp.researchId = researchId;
        updated.push(camp);
      }
    } else {
      updated = campaigns;
    }

    campaignsCache = updated;
    await atomicWriteJson(CAMPAIGNS_FILE, updated);
    return this.getCampaigns(companyId, researchId);
  },

  async saveCampaign(campaign: CampaignKeywordGroup): Promise<CampaignKeywordGroup> {
    if (isPostgresActive()) {
      return postgresDb.saveCampaign(campaign);
    }
    const existing = await this.getCampaigns();
    const idx = existing.findIndex(c => c.id === campaign.id);
    if (idx >= 0) {
      existing[idx] = campaign;
    } else {
      existing.unshift(campaign);
    }
    campaignsCache = existing;
    await atomicWriteJson(CAMPAIGNS_FILE, existing);
    return campaign;
  },

  /* ---------------- Lead Stats ---------------- */
  async getLeadStats(companyId?: string, researchId?: string): Promise<ExtendedLeadStats> {
    const leads = await this.getLeads(companyId, researchId);
    const qualified = leads.filter(l => l.status === 'Qualified' || l.fitScore >= 70).length;
    const contacted = leads.filter(l => l.status === 'Contacted' || l.status === 'In Sequence').length;
    const converted = leads.filter(l => l.status === 'Converted').length;
    const avgScore = leads.length > 0
      ? Math.round(leads.reduce((acc, l) => acc + (l.fitScore || 0), 0) / leads.length)
      : 0;

    const companiesDiscovered = leads.length;
    const companiesMapped = leads.filter(l => Boolean(l.coordinates)).length;

    let decisionMakersIdentified = 0;
    let emailsFound = 0;
    let emailsVerified = 0;
    let emailsNotFound = 0;
    let personalizedEmailsGenerated = 0;

    for (const lead of leads) {
      if (lead.personalizedEmail) personalizedEmailsGenerated++;
      if (lead.decisionMakers && lead.decisionMakers.length > 0) {
        for (const dm of lead.decisionMakers) {
          if (dm.name && dm.name !== 'Management Team' && !dm.name.toLowerCase().includes('leadership')) {
            decisionMakersIdentified++;
          }
          if (dm.email && dm.email.trim() && !dm.email.includes('—')) {
            emailsFound++;
            if (dm.verificationStatus === 'verified' || dm.emailStatus === 'Verified') {
              emailsVerified++;
            }
          } else {
            emailsNotFound++;
          }
        }
      }
    }

    return {
      totalLeads: leads.length,
      qualified,
      contacted,
      converted,
      avgScore,
      companiesDiscovered,
      companiesMapped,
      decisionMakersIdentified,
      emailsFound,
      emailsVerified,
      emailsNotFound,
      personalizedEmailsGenerated
    };
  },

  // --- EMAIL FINDER SEARCH RUNS ---
  async getEmailSearches(): Promise<EmailSearchRun[]> {
    if (isPostgresActive()) {
      return postgresDb.getEmailSearches();
    }
    if (!emailSearchesCache) {
      emailSearchesCache = await readJson<EmailSearchRun[]>(EMAIL_SEARCHES_FILE, []);
    }
    return emailSearchesCache.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getEmailSearch(id: string): Promise<EmailSearchRun | null> {
    if (isPostgresActive()) {
      return postgresDb.getEmailSearch(id);
    }
    const list = await this.getEmailSearches();
    return list.find(s => s.id === id) || null;
  },

  async saveEmailSearch(search: EmailSearchRun): Promise<void> {
    if (isPostgresActive()) {
      return postgresDb.saveEmailSearch(search);
    }
    const list = await this.getEmailSearches();
    const idx = list.findIndex(s => s.id === search.id);
    if (idx >= 0) {
      list[idx] = search;
    } else {
      list.unshift(search);
    }
    emailSearchesCache = list;
    await atomicWriteJson(EMAIL_SEARCHES_FILE, list);
  },

  async deleteEmailSearch(id: string): Promise<boolean> {
    if (isPostgresActive()) {
      return postgresDb.deleteEmailSearch(id);
    }
    const list = await this.getEmailSearches();
    const filtered = list.filter(s => s.id !== id);
    if (filtered.length !== list.length) {
      emailSearchesCache = filtered;
      await atomicWriteJson(EMAIL_SEARCHES_FILE, filtered);
      return true;
    }
    return false;
  },

  // --- WHATSAPP BUSINESS NUMBER SEARCH RUNS ---
  async getWhatsAppSearches(): Promise<WhatsAppSearchRun[]> {
    if (isPostgresActive()) {
      return postgresDb.getWhatsAppSearches();
    }
    if (!whatsappSearchesCache) {
      whatsappSearchesCache = await readJson<WhatsAppSearchRun[]>(WHATSAPP_SEARCHES_FILE, []);
    }
    return whatsappSearchesCache.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getWhatsAppSearch(id: string): Promise<WhatsAppSearchRun | null> {
    if (isPostgresActive()) {
      return postgresDb.getWhatsAppSearch(id);
    }
    const list = await this.getWhatsAppSearches();
    return list.find(s => s.id === id) || null;
  },

  async saveWhatsAppSearch(search: WhatsAppSearchRun): Promise<void> {
    if (isPostgresActive()) {
      return postgresDb.saveWhatsAppSearch(search);
    }
    const list = await this.getWhatsAppSearches();
    const idx = list.findIndex(s => s.id === search.id);
    if (idx >= 0) {
      list[idx] = search;
    } else {
      list.unshift(search);
    }
    whatsappSearchesCache = list;
    await atomicWriteJson(WHATSAPP_SEARCHES_FILE, list);
  },

  async deleteWhatsAppSearch(id: string): Promise<boolean> {
    if (isPostgresActive()) {
      return postgresDb.deleteWhatsAppSearch(id);
    }
    const list = await this.getWhatsAppSearches();
    const filtered = list.filter(s => s.id !== id);
    if (filtered.length !== list.length) {
      whatsappSearchesCache = filtered;
      await atomicWriteJson(WHATSAPP_SEARCHES_FILE, filtered);
      return true;
    }
    return false;
  }
};
