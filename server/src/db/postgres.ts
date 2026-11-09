import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { INITIAL_SCHEMA_SQL, GTM_PLATFORM_SCHEMA_SQL } from './migrations/schemaSql.js';
import {
  CompanyProfile,
  ResearchSession,
  Competitor,
  CampaignKeywordGroup,
  Lead,
  EmailSearchRun,
  Conversation,
  Task,
  ExtendedLeadStats
} from '../types/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export interface JobRow {
  jobId: string;
  agentId: string;
  companyId: string | null;
  researchId: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  progress: number;
  currentStage: string | null;
  input: string; // JSON
  result: string | null; // JSON
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface StoredDocument {
  id: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  extractedText: string;
  wordCount: number;
  characterCount: number;
  metadata: Record<string, any>;
  uploadedAt: string;
}

export class PostgresDb {
  private pool: pg.Pool | null = null;
  private isConnected = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialized on-demand
  }

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._initInternal();
    return this.initPromise;
  }

  private async _initInternal(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.');
    }

    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    this.pool = new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: true },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    this.pool.on('error', (err) => {
      logger.error('[PostgreSQL] Unexpected client pool error:', err.message);
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      this.isConnected = true;
      logger.info('[PostgreSQL] Successfully connected to database (Pool active).');
    } finally {
      client.release();
    }

    // Run migrations
    await this.runMigrations();

    // Mark in-flight jobs from prior crashes as interrupted
    await this.recoverInterruptedJobs();
  }

  public async runMigrations(): Promise<void> {
    const client = await this.pool!.connect();
    try {
      // 1. Ensure migrations tracking table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const migrationFiles = ['001_initial_schema.sql', '002_gtm_platform_schema.sql'];
      const migrationsDir = path.resolve(__dirname, 'migrations');

      for (const file of migrationFiles) {
        const check = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
        if (check.rowCount === 0) {
          const filePath = path.join(migrationsDir, file);
          let sql = '';
          if (fs.existsSync(filePath)) {
            sql = fs.readFileSync(filePath, 'utf-8');
          } else if (file === '001_initial_schema.sql') {
            sql = INITIAL_SCHEMA_SQL;
          } else if (file === '002_gtm_platform_schema.sql') {
            sql = GTM_PLATFORM_SCHEMA_SQL;
          }

          if (sql) {
            logger.info(`[PostgreSQL] Applying migration: ${file}...`);
            await client.query('BEGIN');
            try {
              await client.query(sql);
              await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
              await client.query('COMMIT');
              logger.info(`[PostgreSQL] Migration ${file} applied successfully.`);
            } catch (err: any) {
              await client.query('ROLLBACK');
              logger.error(`[PostgreSQL] Failed applying migration ${file}:`, err.message);
              throw err;
            }
          }
        }
      }
    } finally {
      client.release();
    }
  }

  private async recoverInterruptedJobs(): Promise<void> {
    const res = await this.query(`
      UPDATE jobs 
      SET status = 'interrupted',
          error = 'Process interrupted due to server restart or shutdown.',
          updated_at = NOW()
      WHERE status IN ('running', 'queued')
      RETURNING job_id;
    `);

    if (res.rowCount && res.rowCount > 0) {
      logger.info(`[PostgreSQL] Marked ${res.rowCount} in-flight jobs as 'interrupted'.`);
    }
  }

  public async ping(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      const res = await this.pool.query('SELECT 1');
      return Boolean(res.rowCount && res.rowCount > 0);
    } catch {
      return false;
    }
  }

  public async query(text: string, params: any[] = []): Promise<pg.QueryResult<any>> {
    await this.init();
    return this.pool!.query(text, params);
  }

  // ============================================================================
  // JOB OPERATIONS
  // ============================================================================

  public async createJob(job: Omit<JobRow, 'updatedAt' | 'startedAt' | 'completedAt'>): Promise<JobRow> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO jobs (
        job_id, agent_id, company_id, research_id, status, progress,
        current_stage, input, result, error, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
      RETURNING *;
    `;

    const res = await this.query(sql, [
      job.jobId,
      job.agentId,
      job.companyId ?? null,
      job.researchId ?? null,
      job.status,
      job.progress ?? 0,
      job.currentStage ?? null,
      job.input,
      job.result ?? null,
      job.error ?? null,
      job.createdAt || now,
      now
    ]);

    return this.mapJobRow(res.rows[0]);
  }

  public async getJob(jobId: string): Promise<JobRow | null> {
    const res = await this.query('SELECT * FROM jobs WHERE job_id = $1', [jobId]);
    return res.rows[0] ? this.mapJobRow(res.rows[0]) : null;
  }

  public async listJobs(filter?: { agentId?: string; companyId?: string; status?: string; limit?: number }): Promise<JobRow[]> {
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filter?.agentId) {
      sql += ` AND agent_id = $${idx++}`;
      params.push(filter.agentId);
    }
    if (filter?.companyId) {
      sql += ` AND company_id = $${idx++}`;
      params.push(filter.companyId);
    }
    if (filter?.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filter.status);
    }

    sql += ' ORDER BY created_at DESC';
    const limit = filter?.limit || 100;
    sql += ` LIMIT $${idx++}`;
    params.push(limit);

    const res = await this.query(sql, params);
    return res.rows.map(r => this.mapJobRow(r));
  }

  public async updateJob(jobId: string, updates: Partial<JobRow>): Promise<JobRow | null> {
    const current = await this.getJob(jobId);
    if (!current) return null;

    const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };
    const sql = `
      UPDATE jobs SET
        status = $1,
        progress = $2,
        current_stage = $3,
        result = $4::jsonb,
        error = $5,
        started_at = $6,
        completed_at = $7,
        updated_at = $8
      WHERE job_id = $9
      RETURNING *;
    `;

    const res = await this.query(sql, [
      merged.status,
      merged.progress,
      merged.currentStage,
      merged.result ? (typeof merged.result === 'string' ? merged.result : JSON.stringify(merged.result)) : null,
      merged.error,
      merged.startedAt,
      merged.completedAt,
      merged.updatedAt,
      jobId
    ]);

    return res.rows[0] ? this.mapJobRow(res.rows[0]) : null;
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;
    if (job.status === 'completed' || job.status === 'failed') return false;

    await this.updateJob(jobId, {
      status: 'cancelled',
      error: 'Job was cancelled by the user.',
      completedAt: new Date().toISOString()
    });
    return true;
  }

  public async retryJob(jobId: string): Promise<JobRow | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    return this.updateJob(jobId, {
      status: 'queued',
      progress: 0,
      currentStage: 'Queued for retry...',
      error: null,
      result: null,
      startedAt: null,
      completedAt: null
    });
  }

  private mapJobRow(row: any): JobRow {
    return {
      jobId: row.job_id,
      agentId: row.agent_id,
      companyId: row.company_id,
      researchId: row.research_id,
      status: row.status,
      progress: Number(row.progress),
      currentStage: row.current_stage,
      input: typeof row.input === 'string' ? row.input : JSON.stringify(row.input),
      result: row.result ? (typeof row.result === 'string' ? row.result : JSON.stringify(row.result)) : null,
      error: row.error,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
    };
  }

  // ============================================================================
  // AGENT CACHE OPERATIONS
  // ============================================================================

  public async getCache(cacheKey: string): Promise<any | null> {
    const res = await this.query('SELECT * FROM agent_cache WHERE cache_key = $1', [cacheKey]);
    if (!res.rows[0]) return null;
    const row = res.rows[0];

    if (row.expires_at && Date.now() > Number(row.expires_at)) {
      await this.deleteCache(cacheKey);
      return null;
    }

    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  }

  public async setCache(cacheKey: string, agentId: string, data: any, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    const jsonStr = JSON.stringify(data);

    await this.query(`
      INSERT INTO agent_cache (cache_key, agent_id, data, expires_at, created_at)
      VALUES ($1, $2, $3::jsonb, $4, NOW())
      ON CONFLICT(cache_key) DO UPDATE SET
        data = EXCLUDED.data,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();
    `, [cacheKey, agentId, jsonStr, expiresAt]);
  }

  public async deleteCache(cacheKey: string): Promise<void> {
    await this.query('DELETE FROM agent_cache WHERE cache_key = $1', [cacheKey]);
  }

  public async clearAgentCache(agentId: string): Promise<void> {
    await this.query('DELETE FROM agent_cache WHERE agent_id = $1', [agentId]);
  }

  // ============================================================================
  // COMPANY PROFILES
  // ============================================================================

  public async getCompanyProfiles(): Promise<CompanyProfile[]> {
    const res = await this.query('SELECT data FROM company_profiles ORDER BY analyzed_at DESC');
    return res.rows.map(r => r.data);
  }

  public async getCompanyProfile(idOrDomain: string): Promise<CompanyProfile | null> {
    const res = await this.query(
      'SELECT data FROM company_profiles WHERE id = $1 OR domain = $1',
      [idOrDomain]
    );
    return res.rows[0] ? res.rows[0].data : null;
  }

  public async saveCompanyProfile(profile: CompanyProfile): Promise<CompanyProfile> {
    await this.query(`
      INSERT INTO company_profiles (
        id, domain, name, url, tagline, description, industry, business_model, data, analyzed_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW())
      ON CONFLICT(domain) DO UPDATE SET
        name = EXCLUDED.name,
        url = EXCLUDED.url,
        tagline = EXCLUDED.tagline,
        description = EXCLUDED.description,
        industry = EXCLUDED.industry,
        business_model = EXCLUDED.business_model,
        data = EXCLUDED.data,
        analyzed_at = EXCLUDED.analyzed_at,
        updated_at = NOW();
    `, [
      profile.id,
      profile.domain,
      profile.name,
      profile.url,
      profile.tagline || null,
      profile.description,
      profile.industry,
      profile.businessModel,
      JSON.stringify(profile),
      profile.analyzedAt || new Date().toISOString()
    ]);
    return profile;
  }

  // ============================================================================
  // RESEARCH SESSIONS
  // ============================================================================

  public async getResearchSessions(): Promise<ResearchSession[]> {
    const res = await this.query('SELECT * FROM research_sessions ORDER BY updated_at DESC');
    return res.rows.map(r => this.mapSessionRow(r));
  }

  public async getResearchSession(id: string): Promise<ResearchSession | null> {
    const res = await this.query('SELECT * FROM research_sessions WHERE id = $1', [id]);
    return res.rows[0] ? this.mapSessionRow(res.rows[0]) : null;
  }

  public async saveResearchSession(session: ResearchSession): Promise<ResearchSession> {
    session.updatedAt = new Date().toISOString();
    await this.query(`
      INSERT INTO research_sessions (
        id, company_id, target_url, current_step, max_completed_step, status,
        step_progress, profile, competitors, campaigns, leads, stats, error_message, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15)
      ON CONFLICT(id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        target_url = EXCLUDED.target_url,
        current_step = EXCLUDED.current_step,
        max_completed_step = EXCLUDED.max_completed_step,
        status = EXCLUDED.status,
        step_progress = EXCLUDED.step_progress,
        profile = EXCLUDED.profile,
        competitors = EXCLUDED.competitors,
        campaigns = EXCLUDED.campaigns,
        leads = EXCLUDED.leads,
        stats = EXCLUDED.stats,
        error_message = EXCLUDED.error_message,
        updated_at = EXCLUDED.updated_at;
    `, [
      session.id,
      session.companyId,
      session.targetUrl,
      session.currentStep,
      session.maxCompletedStep,
      session.status,
      JSON.stringify(session.stepProgress || []),
      session.profile ? JSON.stringify(session.profile) : null,
      session.competitors ? JSON.stringify(session.competitors) : null,
      session.campaigns ? JSON.stringify(session.campaigns) : null,
      session.leads ? JSON.stringify(session.leads) : null,
      session.stats ? JSON.stringify(session.stats) : null,
      session.errorMessage || null,
      session.createdAt || new Date().toISOString(),
      session.updatedAt
    ]);
    return session;
  }

  public async deleteResearchSession(id: string): Promise<boolean> {
    const res = await this.query('DELETE FROM research_sessions WHERE id = $1', [id]);
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  private mapSessionRow(r: any): ResearchSession {
    return {
      id: r.id,
      companyId: r.company_id,
      targetUrl: r.target_url,
      currentStep: r.current_step,
      maxCompletedStep: r.max_completed_step,
      status: r.status,
      stepProgress: r.step_progress || [],
      profile: r.profile || undefined,
      competitors: r.competitors || undefined,
      campaigns: r.campaigns || undefined,
      leads: r.leads || undefined,
      stats: r.stats || undefined,
      errorMessage: r.error_message || undefined,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    };
  }

  // ============================================================================
  // LEADS
  // ============================================================================

  public async getLeads(companyId?: string, researchId?: string): Promise<Lead[]> {
    let sql = 'SELECT data FROM leads WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (companyId && companyId !== 'all') {
      sql += ` AND company_id = $${idx++}`;
      params.push(companyId);
    }
    if (researchId && researchId !== 'all') {
      sql += ` AND research_id = $${idx++}`;
      params.push(researchId);
    }

    sql += ' ORDER BY created_at DESC';
    const res = await this.query(sql, params);
    return res.rows.map(r => r.data);
  }

  public async getLead(id: string): Promise<Lead | null> {
    const res = await this.query('SELECT data FROM leads WHERE id = $1', [id]);
    return res.rows[0] ? res.rows[0].data : null;
  }

  public async saveLead(lead: Lead): Promise<Lead> {
    lead.updatedAt = new Date().toISOString();
    await this.query(`
      INSERT INTO leads (
        id, company_id, research_id, company_name, website, industry, location,
        fit_score, status, data, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
      ON CONFLICT(id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        research_id = EXCLUDED.research_id,
        company_name = EXCLUDED.company_name,
        website = EXCLUDED.website,
        industry = EXCLUDED.industry,
        location = EXCLUDED.location,
        fit_score = EXCLUDED.fit_score,
        status = EXCLUDED.status,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at;
    `, [
      lead.id,
      lead.companyId || 'default',
      lead.researchId || null,
      lead.companyName,
      lead.website,
      lead.industry,
      lead.location,
      lead.fitScore || 0,
      lead.status || 'New',
      JSON.stringify(lead),
      lead.createdAt || new Date().toISOString(),
      lead.updatedAt
    ]);
    return lead;
  }

  public async saveLeads(leads: Lead[], companyId?: string, researchId?: string): Promise<Lead[]> {
    for (const lead of leads) {
      if (companyId && !lead.companyId) lead.companyId = companyId;
      if (researchId && !lead.researchId) lead.researchId = researchId;
      await this.saveLead(lead);
    }
    return this.getLeads(companyId, researchId);
  }

  public async deleteLead(id: string): Promise<boolean> {
    const res = await this.query('DELETE FROM leads WHERE id = $1', [id]);
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  // ============================================================================
  // COMPETITORS
  // ============================================================================

  public async getCompetitors(companyId?: string, researchId?: string): Promise<Competitor[]> {
    let sql = 'SELECT data FROM competitors WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (companyId && companyId !== 'all') {
      sql += ` AND company_id = $${idx++}`;
      params.push(companyId);
    }
    if (researchId && researchId !== 'all') {
      sql += ` AND research_id = $${idx++}`;
      params.push(researchId);
    }

    const res = await this.query(sql, params);
    return res.rows.map(r => r.data);
  }

  public async saveCompetitors(competitors: Competitor[], companyId?: string, researchId?: string): Promise<Competitor[]> {
    if (companyId) {
      await this.query('DELETE FROM competitors WHERE company_id = $1', [companyId]);
    }
    for (const comp of competitors) {
      if (companyId) comp.companyId = companyId;
      if (researchId) comp.researchId = researchId;
      await this.query(`
        INSERT INTO competitors (id, company_id, research_id, name, website, category, data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
        ON CONFLICT(id) DO UPDATE SET
          company_id = EXCLUDED.company_id,
          research_id = EXCLUDED.research_id,
          name = EXCLUDED.name,
          website = EXCLUDED.website,
          category = EXCLUDED.category,
          data = EXCLUDED.data;
      `, [comp.id, comp.companyId, comp.researchId || null, comp.name, comp.website, comp.category, JSON.stringify(comp)]);
    }
    return this.getCompetitors(companyId, researchId);
  }

  // ============================================================================
  // CAMPAIGNS
  // ============================================================================

  public async getCampaigns(companyId?: string, researchId?: string): Promise<CampaignKeywordGroup[]> {
    let sql = 'SELECT data FROM campaigns WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (companyId && companyId !== 'all') {
      sql += ` AND company_id = $${idx++}`;
      params.push(companyId);
    }
    if (researchId && researchId !== 'all') {
      sql += ` AND research_id = $${idx++}`;
      params.push(researchId);
    }

    const res = await this.query(sql, params);
    return res.rows.map(r => r.data);
  }

  public async saveCampaigns(campaigns: CampaignKeywordGroup[], companyId?: string, researchId?: string): Promise<CampaignKeywordGroup[]> {
    if (companyId) {
      await this.query('DELETE FROM campaigns WHERE company_id = $1', [companyId]);
    }
    for (const camp of campaigns) {
      if (companyId) camp.companyId = companyId;
      if (researchId) camp.researchId = researchId;
      await this.saveCampaign(camp);
    }
    return this.getCampaigns(companyId, researchId);
  }

  public async saveCampaign(campaign: CampaignKeywordGroup): Promise<CampaignKeywordGroup> {
    await this.query(`
      INSERT INTO campaigns (id, company_id, research_id, title, target_industry, data, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
      ON CONFLICT(id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        research_id = EXCLUDED.research_id,
        title = EXCLUDED.title,
        target_industry = EXCLUDED.target_industry,
        data = EXCLUDED.data;
    `, [campaign.id, campaign.companyId, campaign.researchId || null, campaign.title, campaign.targetIndustry, JSON.stringify(campaign)]);
    return campaign;
  }

  // ============================================================================
  // EMAIL SEARCH RUNS
  // ============================================================================

  public async getEmailSearches(): Promise<EmailSearchRun[]> {
    const res = await this.query('SELECT data FROM email_searches ORDER BY created_at DESC');
    return res.rows.map(r => r.data);
  }

  public async getEmailSearch(id: string): Promise<EmailSearchRun | null> {
    const res = await this.query('SELECT data FROM email_searches WHERE id = $1', [id]);
    return res.rows[0] ? res.rows[0].data : null;
  }

  public async saveEmailSearch(search: EmailSearchRun): Promise<void> {
    await this.query(`
      INSERT INTO email_searches (id, mode, target_url, domain, company_name, data, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      ON CONFLICT(id) DO UPDATE SET
        mode = EXCLUDED.mode,
        target_url = EXCLUDED.target_url,
        domain = EXCLUDED.domain,
        company_name = EXCLUDED.company_name,
        data = EXCLUDED.data;
    `, [
      search.id,
      search.mode,
      search.targetUrl || null,
      search.domain || null,
      search.companyName || null,
      JSON.stringify(search),
      search.createdAt || new Date().toISOString()
    ]);
  }

  public async deleteEmailSearch(id: string): Promise<boolean> {
    const res = await this.query('DELETE FROM email_searches WHERE id = $1', [id]);
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  // ============================================================================
  // CONVERSATIONS
  // ============================================================================

  public async getConversations(): Promise<Conversation[]> {
    const res = await this.query('SELECT * FROM conversations ORDER BY updated_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      title: r.title,
      messages: r.messages || [],
      metadata: r.metadata || {},
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    }));
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    const res = await this.query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      title: r.title,
      messages: r.messages || [],
      metadata: r.metadata || {},
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    };
  }

  public async saveConversation(conv: Conversation): Promise<Conversation> {
    const now = new Date().toISOString();
    conv.updatedAt = now;
    await this.query(`
      INSERT INTO conversations (id, title, messages, metadata, created_at, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
      ON CONFLICT(id) DO UPDATE SET
        title = EXCLUDED.title,
        messages = EXCLUDED.messages,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at;
    `, [conv.id, conv.title, JSON.stringify(conv.messages || []), JSON.stringify(conv.metadata || {}), conv.createdAt || now, now]);
    return conv;
  }

  public async deleteConversation(id: string): Promise<boolean> {
    const res = await this.query('DELETE FROM conversations WHERE id = $1', [id]);
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  // ============================================================================
  // TASKS
  // ============================================================================

  public async getTasks(): Promise<Task[]> {
    const res = await this.query('SELECT * FROM tasks ORDER BY start_time DESC');
    return res.rows.map(r => ({
      id: r.id,
      instruction: r.data?.instruction || r.title,
      category: r.data?.category || 'general',
      status: r.status,
      startTime: new Date(r.start_time).toISOString(),
      completionTime: r.end_time ? new Date(r.end_time).toISOString() : undefined,
      plan: r.data?.plan,
      steps: r.data?.steps,
      result: r.result,
      error: r.data?.error,
      title: r.title,
      agentId: r.agent_id
    } as any));
  }

  public async getTask(id: string): Promise<Task | null> {
    const res = await this.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      instruction: r.data?.instruction || r.title,
      category: r.data?.category || 'general',
      status: r.status,
      startTime: new Date(r.start_time).toISOString(),
      completionTime: r.end_time ? new Date(r.end_time).toISOString() : undefined,
      plan: r.data?.plan,
      steps: r.data?.steps,
      result: r.result,
      error: r.data?.error,
      title: r.title,
      agentId: r.agent_id
    } as any;
  }

  public async saveTask(task: Task): Promise<Task> {
    const now = new Date().toISOString();
    const title = task.instruction || (task as any).title || 'Task';
    await this.query(`
      INSERT INTO tasks (
        id, title, agent_id, status, priority, company_context, result, data, start_time, end_time, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
      ON CONFLICT(id) DO UPDATE SET
        title = EXCLUDED.title,
        agent_id = EXCLUDED.agent_id,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        company_context = EXCLUDED.company_context,
        result = EXCLUDED.result,
        data = EXCLUDED.data,
        end_time = EXCLUDED.end_time,
        updated_at = EXCLUDED.updated_at;
    `, [
      task.id,
      title,
      (task as any).agentId || null,
      task.status,
      (task as any).priority || 'medium',
      (task as any).companyContext || null,
      task.result || null,
      JSON.stringify(task),
      task.startTime || now,
      task.completionTime || null,
      now,
      now
    ]);
    return task;
  }

  public async getStats(): Promise<{ totalTasks: number; completedTasks: number; totalConversations: number; totalMessages: number }> {
    const tasksRes = await this.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'completed\') as completed FROM tasks');
    const convsRes = await this.query('SELECT COUNT(*) as total FROM conversations');
    const convs = await this.getConversations();
    const totalMessages = convs.reduce((acc, c) => acc + (c.messages?.length || 0), 0);

    return {
      totalTasks: parseInt(tasksRes.rows[0]?.total || '0', 10),
      completedTasks: parseInt(tasksRes.rows[0]?.completed || '0', 10),
      totalConversations: parseInt(convsRes.rows[0]?.total || '0', 10),
      totalMessages
    };
  }

  // ============================================================================
  // DOCUMENTS
  // ============================================================================

  public async getDocuments(): Promise<StoredDocument[]> {
    const res = await this.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      filename: r.filename,
      fileType: r.file_type,
      sizeBytes: Number(r.size_bytes),
      extractedText: r.extracted_text,
      wordCount: Number(r.word_count),
      characterCount: Number(r.character_count),
      metadata: r.metadata || {},
      uploadedAt: new Date(r.uploaded_at).toISOString()
    }));
  }

  public async getDocument(id: string): Promise<StoredDocument | null> {
    const res = await this.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      filename: r.filename,
      fileType: r.file_type,
      sizeBytes: Number(r.size_bytes),
      extractedText: r.extracted_text,
      wordCount: Number(r.word_count),
      characterCount: Number(r.character_count),
      metadata: r.metadata || {},
      uploadedAt: new Date(r.uploaded_at).toISOString()
    };
  }

  public async saveDocument(doc: StoredDocument): Promise<StoredDocument> {
    await this.query(`
      INSERT INTO documents (
        id, filename, file_type, size_bytes, extracted_text, word_count, character_count, metadata, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      ON CONFLICT(id) DO UPDATE SET
        filename = EXCLUDED.filename,
        file_type = EXCLUDED.file_type,
        size_bytes = EXCLUDED.size_bytes,
        extracted_text = EXCLUDED.extracted_text,
        word_count = EXCLUDED.word_count,
        character_count = EXCLUDED.character_count,
        metadata = EXCLUDED.metadata;
    `, [
      doc.id,
      doc.filename,
      doc.fileType,
      doc.sizeBytes,
      doc.extractedText,
      doc.wordCount,
      doc.characterCount,
      JSON.stringify(doc.metadata || {}),
      doc.uploadedAt || new Date().toISOString()
    ]);
    return doc;
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const res = await this.query('DELETE FROM documents WHERE id = $1', [id]);
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  // ============================================================================
  // USER SETTINGS
  // ============================================================================

  public async getSetting(key: string): Promise<any | null> {
    const res = await this.query('SELECT value FROM user_settings WHERE key = $1', [key]);
    return res.rows[0] ? res.rows[0].value : null;
  }

  public async saveSetting(key: string, value: any): Promise<void> {
    await this.query(`
      INSERT INTO user_settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT(key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW();
    `, [key, JSON.stringify(value)]);
  }

  // ============================================================================
  // SHUTDOWN
  // ============================================================================

  public async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.recoverInterruptedJobs();
        await this.pool.end();
        logger.info('[PostgreSQL] Connection pool closed safely.');
      } catch (err: any) {
        logger.error('[PostgreSQL] Error during pool close:', err.message);
      }
      this.pool = null;
      this.isConnected = false;
    }
  }

  // --- JOB CLAIMING (TRANSACTION + SELECT ... FOR UPDATE SKIP LOCKED) ---
  public async claimNextJob(): Promise<JobRow | null> {
    await this.init();
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(`
        SELECT * FROM jobs 
        WHERE status = 'queued' 
        ORDER BY created_at ASC 
        LIMIT 1 
        FOR UPDATE SKIP LOCKED;
      `);
      if (res.rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }
      const row = res.rows[0];
      const updateRes = await client.query(`
        UPDATE jobs 
        SET status = 'running', 
            started_at = NOW(), 
            updated_at = NOW(),
            current_stage = 'Claimed by background worker...' 
        WHERE job_id = $1 
        RETURNING *;
      `, [row.job_id]);
      await client.query('COMMIT');
      return this.mapJobRow(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async recordJobEvent(
    jobId: string,
    stage: string,
    progress: number,
    eventType: string = 'info',
    message: string = '',
    data: any = {}
  ): Promise<void> {
    try {
      await this.query(`
        INSERT INTO job_events (job_id, stage, progress, event_type, message, data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW());
      `, [jobId, stage, progress, eventType, message, JSON.stringify(data || {})]);
    } catch (err: any) {
      logger.warn('[PostgreSQL] Could not record job event:', err.message);
    }
  }

  // --- CONTENT ITEMS & VERSIONS (AGENT 3) ---
  public async getContentItems(): Promise<any[]> {
    const res = await this.query('SELECT * FROM content_items ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      title: r.title,
      contentType: r.content_type,
      topic: r.topic,
      targetAudience: r.target_audience,
      wordCountTarget: r.word_count_target,
      actualWordCount: r.actual_word_count,
      characterCount: r.character_count,
      readingTimeMinutes: Number(r.reading_time_minutes),
      tone: r.tone,
      language: r.language,
      readingLevel: r.reading_level,
      keywords: r.keywords,
      cta: r.cta,
      brandVoice: r.brand_voice,
      thingsToAvoid: r.things_to_avoid,
      body: r.body,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async getContentItem(id: string): Promise<any | null> {
    const res = await this.query('SELECT * FROM content_items WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      title: r.title,
      contentType: r.content_type,
      topic: r.topic,
      targetAudience: r.target_audience,
      wordCountTarget: r.word_count_target,
      actualWordCount: r.actual_word_count,
      characterCount: r.character_count,
      readingTimeMinutes: Number(r.reading_time_minutes),
      tone: r.tone,
      language: r.language,
      readingLevel: r.reading_level,
      keywords: r.keywords,
      cta: r.cta,
      brandVoice: r.brand_voice,
      thingsToAvoid: r.things_to_avoid,
      body: r.body,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async saveContentItem(item: any): Promise<any> {
    const sql = `
      INSERT INTO content_items (
        id, title, content_type, topic, target_audience, word_count_target,
        actual_word_count, character_count, reading_time_minutes, tone, language,
        reading_level, keywords, cta, brand_voice, things_to_avoid, body, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT(id) DO UPDATE SET
        title = EXCLUDED.title,
        actual_word_count = EXCLUDED.actual_word_count,
        character_count = EXCLUDED.character_count,
        reading_time_minutes = EXCLUDED.reading_time_minutes,
        body = EXCLUDED.body,
        status = EXCLUDED.status,
        updated_at = NOW();
    `;
    await this.query(sql, [
      item.id,
      item.title,
      item.contentType,
      item.topic,
      JSON.stringify(item.targetAudience || {}),
      item.wordCountTarget || null,
      item.actualWordCount || 0,
      item.characterCount || 0,
      item.readingTimeMinutes || 0,
      item.tone || 'Professional',
      item.language || 'en',
      item.readingLevel || 'Professional',
      JSON.stringify(item.keywords || []),
      item.cta || null,
      item.brandVoice || null,
      item.thingsToAvoid || null,
      item.body || '',
      item.status || 'draft',
      item.createdAt || new Date().toISOString(),
      new Date().toISOString()
    ]);
    return item;
  }

  public async deleteContentItem(id: string): Promise<boolean> {
    const res = await this.query('DELETE FROM content_items WHERE id = $1', [id]);
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  public async getContentVersions(contentId: string): Promise<any[]> {
    const res = await this.query('SELECT * FROM content_versions WHERE content_id = $1 ORDER BY version_number ASC', [contentId]);
    return res.rows.map(r => ({
      id: r.id,
      contentId: r.content_id,
      versionNumber: r.version_number,
      title: r.title,
      body: r.body,
      wordCount: r.word_count,
      characterCount: r.character_count,
      readingTimeMinutes: Number(r.reading_time_minutes),
      changeSummary: r.change_summary,
      createdAt: r.created_at
    }));
  }

  public async saveContentVersion(ver: any): Promise<any> {
    await this.query(`
      INSERT INTO content_versions (
        id, content_id, version_number, title, body, word_count,
        character_count, reading_time_minutes, change_summary, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT(id) DO NOTHING;
    `, [
      ver.id,
      ver.contentId,
      ver.versionNumber,
      ver.title,
      ver.body,
      ver.wordCount,
      ver.characterCount,
      ver.readingTimeMinutes,
      ver.changeSummary || ''
    ]);
    return ver;
  }

  // --- EDITOR DOCUMENTS & VERSIONS (AGENT 4) ---
  public async getEditorDocuments(): Promise<any[]> {
    const res = await this.query('SELECT * FROM editor_documents ORDER BY updated_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      htmlContent: r.html_content,
      targetKeyword: r.target_keyword,
      metaDescription: r.meta_description,
      wordCount: r.word_count,
      characterCount: r.character_count,
      readingTimeMinutes: Number(r.reading_time_minutes),
      fleschScore: Number(r.flesch_score),
      seoScore: r.seo_score,
      analysisBreakdown: r.analysis_breakdown,
      faqSections: r.faq_sections,
      jsonLdSchemas: r.json_ld_schemas,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async getEditorDocument(id: string): Promise<any | null> {
    const res = await this.query('SELECT * FROM editor_documents WHERE id = $1', [id]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      title: r.title,
      content: r.content,
      htmlContent: r.html_content,
      targetKeyword: r.target_keyword,
      metaDescription: r.meta_description,
      wordCount: r.word_count,
      characterCount: r.character_count,
      readingTimeMinutes: Number(r.reading_time_minutes),
      fleschScore: Number(r.flesch_score),
      seoScore: r.seo_score,
      analysisBreakdown: r.analysis_breakdown,
      faqSections: r.faq_sections,
      jsonLdSchemas: r.json_ld_schemas,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  public async saveEditorDocument(doc: any): Promise<any> {
    const sql = `
      INSERT INTO editor_documents (
        id, title, content, html_content, target_keyword, meta_description,
        word_count, character_count, reading_time_minutes, flesch_score,
        seo_score, analysis_breakdown, faq_sections, json_ld_schemas,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16)
      ON CONFLICT(id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        html_content = EXCLUDED.html_content,
        target_keyword = EXCLUDED.target_keyword,
        meta_description = EXCLUDED.meta_description,
        word_count = EXCLUDED.word_count,
        character_count = EXCLUDED.character_count,
        reading_time_minutes = EXCLUDED.reading_time_minutes,
        flesch_score = EXCLUDED.flesch_score,
        seo_score = EXCLUDED.seo_score,
        analysis_breakdown = EXCLUDED.analysis_breakdown,
        updated_at = NOW();
    `;
    await this.query(sql, [
      doc.id,
      doc.title,
      doc.content || '',
      doc.htmlContent || '',
      doc.targetKeyword || '',
      doc.metaDescription || '',
      doc.wordCount || 0,
      doc.characterCount || 0,
      doc.readingTimeMinutes || 0,
      doc.fleschScore || 0,
      doc.seoScore || 0,
      JSON.stringify(doc.analysisBreakdown || {}),
      JSON.stringify(doc.faqSections || []),
      JSON.stringify(doc.jsonLdSchemas || {}),
      doc.createdAt || new Date().toISOString(),
      new Date().toISOString()
    ]);
    return doc;
  }

  public async deleteEditorDocument(id: string): Promise<boolean> {
    const res = await this.query('DELETE FROM editor_documents WHERE id = $1', [id]);
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  public async getEditorDocumentVersions(documentId: string): Promise<any[]> {
    const res = await this.query('SELECT * FROM editor_document_versions WHERE document_id = $1 ORDER BY version_number DESC', [documentId]);
    return res.rows.map(r => ({
      id: r.id,
      documentId: r.document_id,
      versionNumber: r.version_number,
      title: r.title,
      content: r.content,
      htmlContent: r.html_content,
      seoScore: r.seo_score,
      savedAt: r.saved_at
    }));
  }

  public async saveEditorDocumentVersion(ver: any): Promise<any> {
    await this.query(`
      INSERT INTO editor_document_versions (
        id, document_id, version_number, title, content, html_content, seo_score, saved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT(id) DO NOTHING;
    `, [
      ver.id,
      ver.documentId,
      ver.versionNumber,
      ver.title,
      ver.content,
      ver.htmlContent || null,
      ver.seoScore || 0
    ]);
    return ver;
  }

  public async restoreEditorDocumentVersion(documentId: string, versionId: string): Promise<any | null> {
    const res = await this.query('SELECT * FROM editor_document_versions WHERE id = $1 AND document_id = $2', [versionId, documentId]);
    if (!res.rows[0]) return null;
    const ver = res.rows[0];
    await this.query(`
      UPDATE editor_documents SET
        title = $1,
        content = $2,
        html_content = $3,
        seo_score = $4,
        updated_at = NOW()
      WHERE id = $5;
    `, [ver.title, ver.content, ver.html_content || '', ver.seo_score || 0, documentId]);
    return this.getEditorDocument(documentId);
  }

}

export const postgresDb = new PostgresDb();
