import fs from 'fs';
import path from 'path';

// Node 22 built-in SQLite database engine
// Provides synchronous, reliable, zero-dependency SQLite persistence
let DatabaseSyncClass: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('node:sqlite');
  DatabaseSyncClass = sqlite.DatabaseSync;
} catch (err: any) {
  console.warn('[SQLite] node:sqlite could not be loaded via require, falling back to dynamic import:', err.message);
}

const DATA_DIR = path.resolve(__dirname, '../../../data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'marketmate.sqlite');

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

export interface CacheRow {
  cacheKey: string;
  agentId: string;
  data: string; // JSON
  expiresAt: number | null;
  createdAt: string;
}

export class SqliteDb {
  private db: any = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!DatabaseSyncClass) {
      throw new Error('Node built-in SQLite (node:sqlite) is not available in this Node runtime.');
    }

    this.db = new DatabaseSyncClass(DB_PATH);

    // Enable WAL mode for high concurrency
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA busy_timeout = 5000;');
    } catch {
      // WAL not strictly required on all filesystems
    }

    this.runMigrations();
  }

  private runMigrations(): void {
    // Migration table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    // Jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        jobId TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        companyId TEXT,
        researchId TEXT,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        currentStage TEXT,
        input TEXT NOT NULL,
        result TEXT,
        error TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        startedAt TEXT,
        completedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_agent ON jobs(agentId);
      CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(companyId);
    `);

    
    // Content Items (Agent 3)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        contentType TEXT NOT NULL,
        topic TEXT NOT NULL,
        targetAudience TEXT NOT NULL,
        wordCountTarget INTEGER,
        actualWordCount INTEGER NOT NULL DEFAULT 0,
        characterCount INTEGER NOT NULL DEFAULT 0,
        readingTimeMinutes REAL NOT NULL DEFAULT 0,
        tone TEXT,
        language TEXT NOT NULL DEFAULT 'en',
        readingLevel TEXT,
        keywords TEXT NOT NULL DEFAULT '[]',
        cta TEXT,
        brandVoice TEXT,
        thingsToAvoid TEXT,
        body TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(contentType);
    `);

    // Content Versions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_versions (
        id TEXT PRIMARY KEY,
        contentId TEXT NOT NULL,
        versionNumber INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        wordCount INTEGER NOT NULL DEFAULT 0,
        characterCount INTEGER NOT NULL DEFAULT 0,
        readingTimeMinutes REAL NOT NULL DEFAULT 0,
        changeSummary TEXT,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_content_ver ON content_versions(contentId);
    `);

    // SEO Editor Documents (Agent 4)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS editor_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        htmlContent TEXT NOT NULL DEFAULT '',
        targetKeyword TEXT,
        metaDescription TEXT,
        wordCount INTEGER NOT NULL DEFAULT 0,
        characterCount INTEGER NOT NULL DEFAULT 0,
        readingTimeMinutes REAL NOT NULL DEFAULT 0,
        fleschScore REAL NOT NULL DEFAULT 0,
        seoScore INTEGER NOT NULL DEFAULT 0,
        analysisBreakdown TEXT NOT NULL DEFAULT '{}',
        faqSections TEXT NOT NULL DEFAULT '[]',
        jsonLdSchemas TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    // Editor Document Versions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS editor_document_versions (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        versionNumber INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        htmlContent TEXT,
        seoScore INTEGER NOT NULL DEFAULT 0,
        savedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ed_doc_ver ON editor_document_versions(documentId);
    `);

    // Job Events
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS job_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jobId TEXT NOT NULL,
        stage TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        eventType TEXT NOT NULL DEFAULT 'info',
        message TEXT,
        data TEXT DEFAULT '{}',
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(jobId);
    `);

    // Agent Cache table for strict agent isolation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_cache (
        cacheKey TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        data TEXT NOT NULL,
        expiresAt INTEGER,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_agent ON agent_cache(agentId);
    `);

    // On server startup: mark any jobs left in 'running' or 'queued' state as 'interrupted'
    const markInterrupted = this.db.prepare(`
      UPDATE jobs 
      SET status = 'interrupted', 
          error = 'Process interrupted due to server restart or shutdown.',
          updatedAt = ?
      WHERE status IN ('running', 'queued')
    `);
    const count = markInterrupted.run(new Date().toISOString());
    if (count && count.changes > 0) {
      console.log(`[SQLite] Marked ${count.changes} in-flight jobs as 'interrupted'.`);
    }
  }

  private ensureDb(): void {
    if (!this.db) {
      this.init();
    }
  }

  // --- JOB OPERATIONS ---

  public createJob(job: Omit<JobRow, 'updatedAt' | 'startedAt' | 'completedAt'>): JobRow {
    this.ensureDb();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        jobId, agentId, companyId, researchId, status, progress, 
        currentStage, input, result, error, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
      job.createdAt,
      now
    );

    return {
      ...job,
      updatedAt: now,
      startedAt: null,
      completedAt: null
    };
  }

  public getJob(jobId: string): JobRow | null {
    this.ensureDb();
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE jobId = ?');
    return (stmt.get(jobId) as JobRow) || null;
  }

  public listJobs(filter?: { agentId?: string; companyId?: string; status?: string; limit?: number }): JobRow[] {
    this.ensureDb();
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params: any[] = [];

    if (filter?.agentId) {
      sql += ' AND agentId = ?';
      params.push(filter.agentId);
    }
    if (filter?.companyId) {
      sql += ' AND companyId = ?';
      params.push(filter.companyId);
    }
    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY createdAt DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    } else {
      sql += ' LIMIT 100';
    }

    const stmt = this.db.prepare(sql);
    return (stmt.all(...params) as JobRow[]) || [];
  }

  public updateJob(jobId: string, updates: Partial<JobRow>): JobRow | null {
    this.ensureDb();
    const current = this.getJob(jobId);
    if (!current) return null;

    const updated: JobRow = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      UPDATE jobs SET
        status = ?,
        progress = ?,
        currentStage = ?,
        result = ?,
        error = ?,
        startedAt = ?,
        completedAt = ?,
        updatedAt = ?
      WHERE jobId = ?
    `);

    stmt.run(
      updated.status ?? null,
      updated.progress ?? 0,
      updated.currentStage ?? null,
      updated.result ?? null,
      updated.error ?? null,
      updated.startedAt ?? null,
      updated.completedAt ?? null,
      updated.updatedAt ?? null,
      jobId
    );

    return updated;
  }

  public cancelJob(jobId: string): boolean {
    this.ensureDb();
    const job = this.getJob(jobId);
    if (!job) return false;
    if (job.status === 'completed' || job.status === 'failed') return false;

    this.updateJob(jobId, {
      status: 'cancelled',
      error: 'Job was cancelled by the user.',
      completedAt: new Date().toISOString()
    });
    return true;
  }

  public retryJob(jobId: string): JobRow | null {
    this.ensureDb();
    const job = this.getJob(jobId);
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

  // --- AGENT CACHE OPERATIONS ---

  public getCache(cacheKey: string): any | null {
    this.ensureDb();
    const stmt = this.db.prepare('SELECT * FROM agent_cache WHERE cacheKey = ?');
    const row = stmt.get(cacheKey) as CacheRow | undefined;
    if (!row) return null;

    if (row.expiresAt && Date.now() > row.expiresAt) {
      this.deleteCache(cacheKey);
      return null;
    }

    try {
      return JSON.parse(row.data);
    } catch {
      return null;
    }
  }

  public setCache(cacheKey: string, agentId: string, data: any, ttlSeconds?: number): void {
    this.ensureDb();
    const now = new Date().toISOString();
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    const json = JSON.stringify(data);

    const stmt = this.db.prepare(`
      INSERT INTO agent_cache (cacheKey, agentId, data, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cacheKey) DO UPDATE SET
        data = excluded.data,
        expiresAt = excluded.expiresAt,
        createdAt = excluded.createdAt
    `);

    stmt.run(cacheKey, agentId, json, expiresAt, now);
  }

  public deleteCache(cacheKey: string): void {
    this.ensureDb();
    const stmt = this.db.prepare('DELETE FROM agent_cache WHERE cacheKey = ?');
    stmt.run(cacheKey);
  }

  public clearAgentCache(agentId: string): void {
    this.ensureDb();
    const stmt = this.db.prepare('DELETE FROM agent_cache WHERE agentId = ?');
    stmt.run(agentId);
  }

  // Graceful shutdown helper
  public close(): void {
    if (this.db) {
      try {
        const stmt = this.db.prepare(`
          UPDATE jobs 
          SET status = 'interrupted',
              error = 'Process interrupted due to server shutdown.',
              updatedAt = ?
          WHERE status IN ('running', 'queued')
        `);
        stmt.run(new Date().toISOString());
        this.db.close();
      } catch (err: any) {
        console.error('[SQLite] Error during close:', err.message);
      }
      this.db = null;
    }
  }

  // --- JOB CLAIMING ---
  public claimNextJob(): JobRow | null {
    const row = this.db.prepare("SELECT * FROM jobs WHERE status = 'queued' ORDER BY createdAt ASC LIMIT 1").get();
    if (!row) return null;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE jobs SET status = 'running', startedAt = ?, updatedAt = ?, currentStage = 'Claimed by background worker...' WHERE jobId = ?").run(now, now, row.jobId);
    return {
      ...row,
      status: 'running',
      startedAt: now,
      updatedAt: now,
      currentStage: 'Claimed by background worker...'
    };
  }

  public recordJobEvent(jobId: string, stage: string, progress: number, eventType: string = 'info', message: string = '', data: any = {}): void {
    try {
      this.db.prepare('INSERT INTO job_events (jobId, stage, progress, eventType, message, data, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        jobId, stage, progress, eventType, message, JSON.stringify(data || {}), new Date().toISOString()
      );
    } catch {}
  }

  // --- CONTENT ITEMS ---
  public getContentItems(): any[] {
    const rows = this.db.prepare('SELECT * FROM content_items ORDER BY createdAt DESC').all();
    return rows.map((r: any) => ({
      ...r,
      targetAudience: JSON.parse(r.targetAudience || '{}'),
      keywords: JSON.parse(r.keywords || '[]')
    }));
  }

  public getContentItem(id: string): any | null {
    const r = this.db.prepare('SELECT * FROM content_items WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...r,
      targetAudience: JSON.parse(r.targetAudience || '{}'),
      keywords: JSON.parse(r.keywords || '[]')
    };
  }

  public saveContentItem(item: any): any {
    const existing = this.getContentItem(item.id);
    if (existing) {
      this.db.prepare(`
        UPDATE content_items SET
          title = ?, actualWordCount = ?, characterCount = ?, readingTimeMinutes = ?,
          body = ?, status = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        item.title, item.actualWordCount || 0, item.characterCount || 0, item.readingTimeMinutes || 0,
        item.body || '', item.status || 'draft', new Date().toISOString(), item.id
      );
    } else {
      this.db.prepare(`
        INSERT INTO content_items (
          id, title, contentType, topic, targetAudience, wordCountTarget,
          actualWordCount, characterCount, readingTimeMinutes, tone, language,
          readingLevel, keywords, cta, brandVoice, thingsToAvoid, body, status,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id, item.title, item.contentType, item.topic, JSON.stringify(item.targetAudience || {}),
        item.wordCountTarget || null, item.actualWordCount || 0, item.characterCount || 0,
        item.readingTimeMinutes || 0, item.tone || 'Professional', item.language || 'en',
        item.readingLevel || 'Professional', JSON.stringify(item.keywords || []), item.cta || null,
        item.brandVoice || null, item.thingsToAvoid || null, item.body || '', item.status || 'draft',
        item.createdAt || new Date().toISOString(), new Date().toISOString()
      );
    }
    return item;
  }

  public deleteContentItem(id: string): boolean {
    const res = this.db.prepare('DELETE FROM content_items WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public getContentVersions(contentId: string): any[] {
    return this.db.prepare('SELECT * FROM content_versions WHERE contentId = ? ORDER BY versionNumber ASC').all(contentId);
  }

  public saveContentVersion(ver: any): any {
    this.db.prepare(`
      INSERT OR IGNORE INTO content_versions (
        id, contentId, versionNumber, title, body, wordCount, characterCount,
        readingTimeMinutes, changeSummary, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ver.id, ver.contentId, ver.versionNumber, ver.title, ver.body, ver.wordCount || 0,
      ver.characterCount || 0, ver.readingTimeMinutes || 0, ver.changeSummary || '', new Date().toISOString()
    );
    return ver;
  }

  // --- EDITOR DOCUMENTS ---
  public getEditorDocuments(): any[] {
    const rows = this.db.prepare('SELECT * FROM editor_documents ORDER BY updatedAt DESC').all();
    return rows.map((r: any) => ({
      ...r,
      analysisBreakdown: JSON.parse(r.analysisBreakdown || '{}'),
      faqSections: JSON.parse(r.faqSections || '[]'),
      jsonLdSchemas: JSON.parse(r.jsonLdSchemas || '{}')
    }));
  }

  public getEditorDocument(id: string): any | null {
    const r = this.db.prepare('SELECT * FROM editor_documents WHERE id = ?').get(id);
    if (!r) return null;
    return {
      ...r,
      analysisBreakdown: JSON.parse(r.analysisBreakdown || '{}'),
      faqSections: JSON.parse(r.faqSections || '[]'),
      jsonLdSchemas: JSON.parse(r.jsonLdSchemas || '{}')
    };
  }

  public saveEditorDocument(doc: any): any {
    const existing = this.getEditorDocument(doc.id);
    if (existing) {
      this.db.prepare(`
        UPDATE editor_documents SET
          title = ?, content = ?, htmlContent = ?, targetKeyword = ?, metaDescription = ?,
          wordCount = ?, characterCount = ?, readingTimeMinutes = ?, fleschScore = ?,
          seoScore = ?, analysisBreakdown = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        doc.title, doc.content || '', doc.htmlContent || '', doc.targetKeyword || '', doc.metaDescription || '',
        doc.wordCount || 0, doc.characterCount || 0, doc.readingTimeMinutes || 0, doc.fleschScore || 0,
        doc.seoScore || 0, JSON.stringify(doc.analysisBreakdown || {}), new Date().toISOString(), doc.id
      );
    } else {
      this.db.prepare(`
        INSERT INTO editor_documents (
          id, title, content, htmlContent, targetKeyword, metaDescription,
          wordCount, characterCount, readingTimeMinutes, fleschScore, seoScore,
          analysisBreakdown, faqSections, jsonLdSchemas, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        doc.id, doc.title, doc.content || '', doc.htmlContent || '', doc.targetKeyword || '', doc.metaDescription || '',
        doc.wordCount || 0, doc.characterCount || 0, doc.readingTimeMinutes || 0, doc.fleschScore || 0, doc.seoScore || 0,
        JSON.stringify(doc.analysisBreakdown || {}), JSON.stringify(doc.faqSections || []), JSON.stringify(doc.jsonLdSchemas || {}),
        doc.createdAt || new Date().toISOString(), new Date().toISOString()
      );
    }
    return doc;
  }

  public deleteEditorDocument(id: string): boolean {
    const res = this.db.prepare('DELETE FROM editor_documents WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public getEditorDocumentVersions(documentId: string): any[] {
    return this.db.prepare('SELECT * FROM editor_document_versions WHERE documentId = ? ORDER BY versionNumber DESC').all(documentId);
  }

  public saveEditorDocumentVersion(ver: any): any {
    this.db.prepare(`
      INSERT OR IGNORE INTO editor_document_versions (
        id, documentId, versionNumber, title, content, htmlContent, seoScore, savedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ver.id, ver.documentId, ver.versionNumber, ver.title, ver.content, ver.htmlContent || null,
      ver.seoScore || 0, new Date().toISOString()
    );
    return ver;
  }

  public restoreEditorDocumentVersion(documentId: string, versionId: string): any | null {
    const ver = this.db.prepare('SELECT * FROM editor_document_versions WHERE id = ? AND documentId = ?').get(versionId, documentId);
    if (!ver) return null;
    this.db.prepare(`
      UPDATE editor_documents SET
        title = ?, content = ?, htmlContent = ?, seoScore = ?, updatedAt = ?
      WHERE id = ?
    `).run(ver.title, ver.content, ver.htmlContent || '', ver.seoScore || 0, new Date().toISOString(), documentId);
    return this.getEditorDocument(documentId);
  }

}

export const sqliteDb = new SqliteDb();
