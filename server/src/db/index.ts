import { postgresDb, PostgresDb, JobRow, StoredDocument } from './postgres.js';
import { sqliteDb, SqliteDb } from './sqlite.js';
import { logger } from '../utils/logger.js';

export interface IDatabaseService {
  isPostgres(): boolean;
  init(): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;

  // Jobs
  createJob(job: Omit<JobRow, 'updatedAt' | 'startedAt' | 'completedAt'>): Promise<JobRow>;
  getJob(jobId: string): Promise<JobRow | null>;
  listJobs(filter?: { agentId?: string; companyId?: string; status?: string; limit?: number }): Promise<JobRow[]>;
  updateJob(jobId: string, updates: Partial<JobRow>): Promise<JobRow | null>;
  cancelJob(jobId: string): Promise<boolean>;
  retryJob(jobId: string): Promise<JobRow | null>;


  // Concurrency & Events
  claimNextJob(): Promise<JobRow | null>;
  recordJobEvent(jobId: string, stage: string, progress: number, eventType?: string, message?: string, data?: any): Promise<void>;

  // Content Items (Agent 3)
  getContentItems(): Promise<any[]>;
  getContentItem(id: string): Promise<any | null>;
  saveContentItem(item: any): Promise<any>;
  deleteContentItem(id: string): Promise<boolean>;
  getContentVersions(contentId: string): Promise<any[]>;
  saveContentVersion(ver: any): Promise<any>;

  // SEO Editor Documents (Agent 4)
  getEditorDocuments(): Promise<any[]>;
  getEditorDocument(id: string): Promise<any | null>;
  saveEditorDocument(doc: any): Promise<any>;
  deleteEditorDocument(id: string): Promise<boolean>;
  getEditorDocumentVersions(documentId: string): Promise<any[]>;
  saveEditorDocumentVersion(ver: any): Promise<any>;
  restoreEditorDocumentVersion(documentId: string, versionId: string): Promise<any | null>;

  // Cache
  getCache(cacheKey: string): Promise<any | null>;
  setCache(cacheKey: string, agentId: string, data: any, ttlSeconds?: number): Promise<void>;
  deleteCache(cacheKey: string): Promise<void>;
  clearAgentCache(agentId: string): Promise<void>;

  // Documents
  getDocuments(): Promise<StoredDocument[]>;
  getDocument(id: string): Promise<StoredDocument | null>;
  saveDocument(doc: StoredDocument): Promise<StoredDocument>;
  deleteDocument(id: string): Promise<boolean>;

  // Settings
  getSetting(key: string): Promise<any | null>;
  saveSetting(key: string, value: any): Promise<void>;
}

class UnifiedDatabaseService implements IDatabaseService {
  private initialized = false;

  public isPostgres(): boolean {
    return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    if (this.isPostgres()) {
      logger.info('[Database] Initializing PostgreSQL primary engine (DATABASE_URL configured)...');
      await postgresDb.init();
      logger.info('[Database] PostgreSQL primary engine initialized and active.');
    } else {
      logger.info('[Database] DATABASE_URL not set; using local SQLite engine.');
      // SQLite init is synchronous
    }
    this.initialized = true;
  }

  public async ping(): Promise<boolean> {
    if (this.isPostgres()) {
      return postgresDb.ping();
    }
    return true;
  }

  public async close(): Promise<void> {
    if (this.isPostgres()) {
      await postgresDb.close();
    } else {
      sqliteDb.close();
    }
    this.initialized = false;
  }

  // --- JOBS ---
  public async createJob(job: Omit<JobRow, 'updatedAt' | 'startedAt' | 'completedAt'>): Promise<JobRow> {
    if (this.isPostgres()) {
      return postgresDb.createJob(job);
    }
    return Promise.resolve(sqliteDb.createJob(job));
  }

  public async getJob(jobId: string): Promise<JobRow | null> {
    if (this.isPostgres()) {
      return postgresDb.getJob(jobId);
    }
    return Promise.resolve(sqliteDb.getJob(jobId));
  }

  public async listJobs(filter?: { agentId?: string; companyId?: string; status?: string; limit?: number }): Promise<JobRow[]> {
    if (this.isPostgres()) {
      return postgresDb.listJobs(filter);
    }
    return Promise.resolve(sqliteDb.listJobs(filter));
  }

  public async updateJob(jobId: string, updates: Partial<JobRow>): Promise<JobRow | null> {
    if (this.isPostgres()) {
      return postgresDb.updateJob(jobId, updates);
    }
    return Promise.resolve(sqliteDb.updateJob(jobId, updates));
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    if (this.isPostgres()) {
      return postgresDb.cancelJob(jobId);
    }
    return Promise.resolve(sqliteDb.cancelJob(jobId));
  }

  public async retryJob(jobId: string): Promise<JobRow | null> {
    if (this.isPostgres()) {
      return postgresDb.retryJob(jobId);
    }
    return Promise.resolve(sqliteDb.retryJob(jobId));
  }

  // --- CACHE ---
  public async getCache(cacheKey: string): Promise<any | null> {
    if (this.isPostgres()) {
      return postgresDb.getCache(cacheKey);
    }
    return Promise.resolve(sqliteDb.getCache(cacheKey));
  }

  public async setCache(cacheKey: string, agentId: string, data: any, ttlSeconds?: number): Promise<void> {
    if (this.isPostgres()) {
      return postgresDb.setCache(cacheKey, agentId, data, ttlSeconds);
    }
    sqliteDb.setCache(cacheKey, agentId, data, ttlSeconds);
    return Promise.resolve();
  }

  public async deleteCache(cacheKey: string): Promise<void> {
    if (this.isPostgres()) {
      return postgresDb.deleteCache(cacheKey);
    }
    sqliteDb.deleteCache(cacheKey);
    return Promise.resolve();
  }

  public async clearAgentCache(agentId: string): Promise<void> {
    if (this.isPostgres()) {
      return postgresDb.clearAgentCache(agentId);
    }
    sqliteDb.clearAgentCache(agentId);
    return Promise.resolve();
  }

  // --- DOCUMENTS ---
  public async getDocuments(): Promise<StoredDocument[]> {
    if (this.isPostgres()) {
      return postgresDb.getDocuments();
    }
    // Fallback reading from documents.json
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const docsFile = path.resolve(__dirname, '../../../data/documents.json');
      const raw = await fs.readFile(docsFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public async getDocument(id: string): Promise<StoredDocument | null> {
    if (this.isPostgres()) {
      return postgresDb.getDocument(id);
    }
    const docs = await this.getDocuments();
    return docs.find(d => d.id === id) || null;
  }

  public async saveDocument(doc: StoredDocument): Promise<StoredDocument> {
    if (this.isPostgres()) {
      return postgresDb.saveDocument(doc);
    }
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const docsFile = path.resolve(__dirname, '../../../data/documents.json');
      const docs = await this.getDocuments();
      const idx = docs.findIndex(d => d.id === doc.id);
      if (idx >= 0) {
        docs[idx] = doc;
      } else {
        docs.unshift(doc);
      }
      await fs.writeFile(docsFile, JSON.stringify(docs, null, 2), 'utf-8');
    } catch (err: any) {
      logger.warn('[Documents] Fallback write error:', err.message);
    }
    return doc;
  }

  public async deleteDocument(id: string): Promise<boolean> {
    if (this.isPostgres()) {
      return postgresDb.deleteDocument(id);
    }
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const docsFile = path.resolve(__dirname, '../../../data/documents.json');
      const docs = await this.getDocuments();
      const filtered = docs.filter(d => d.id !== id);
      await fs.writeFile(docsFile, JSON.stringify(filtered, null, 2), 'utf-8');
      return filtered.length !== docs.length;
    } catch {
      return false;
    }
  }

  // --- SETTINGS ---
  public async getSetting(key: string): Promise<any | null> {
    if (this.isPostgres()) {
      return postgresDb.getSetting(key);
    }
    return Promise.resolve(null);
  }

  public async saveSetting(key: string, value: any): Promise<void> {
    if (this.isPostgres()) {
      return postgresDb.saveSetting(key, value);
    }
    return Promise.resolve();
  }

  public async claimNextJob(): Promise<JobRow | null> {
    if (this.isPostgres()) {
      return postgresDb.claimNextJob();
    }
    return Promise.resolve(sqliteDb.claimNextJob());
  }

  public async recordJobEvent(jobId: string, stage: string, progress: number, eventType: string = 'info', message: string = '', data: any = {}): Promise<void> {
    if (this.isPostgres()) {
      return postgresDb.recordJobEvent(jobId, stage, progress, eventType, message, data);
    }
    sqliteDb.recordJobEvent(jobId, stage, progress, eventType, message, data);
    return Promise.resolve();
  }

  // Content Items
  public async getContentItems(): Promise<any[]> {
    if (this.isPostgres()) return postgresDb.getContentItems();
    return Promise.resolve(sqliteDb.getContentItems());
  }

  public async getContentItem(id: string): Promise<any | null> {
    if (this.isPostgres()) return postgresDb.getContentItem(id);
    return Promise.resolve(sqliteDb.getContentItem(id));
  }

  public async saveContentItem(item: any): Promise<any> {
    if (this.isPostgres()) return postgresDb.saveContentItem(item);
    return Promise.resolve(sqliteDb.saveContentItem(item));
  }

  public async deleteContentItem(id: string): Promise<boolean> {
    if (this.isPostgres()) return postgresDb.deleteContentItem(id);
    return Promise.resolve(sqliteDb.deleteContentItem(id));
  }

  public async getContentVersions(contentId: string): Promise<any[]> {
    if (this.isPostgres()) return postgresDb.getContentVersions(contentId);
    return Promise.resolve(sqliteDb.getContentVersions(contentId));
  }

  public async saveContentVersion(ver: any): Promise<any> {
    if (this.isPostgres()) return postgresDb.saveContentVersion(ver);
    return Promise.resolve(sqliteDb.saveContentVersion(ver));
  }

  // SEO Editor Documents
  public async getEditorDocuments(): Promise<any[]> {
    if (this.isPostgres()) return postgresDb.getEditorDocuments();
    return Promise.resolve(sqliteDb.getEditorDocuments());
  }

  public async getEditorDocument(id: string): Promise<any | null> {
    if (this.isPostgres()) return postgresDb.getEditorDocument(id);
    return Promise.resolve(sqliteDb.getEditorDocument(id));
  }

  public async saveEditorDocument(doc: any): Promise<any> {
    if (this.isPostgres()) return postgresDb.saveEditorDocument(doc);
    return Promise.resolve(sqliteDb.saveEditorDocument(doc));
  }

  public async deleteEditorDocument(id: string): Promise<boolean> {
    if (this.isPostgres()) return postgresDb.deleteEditorDocument(id);
    return Promise.resolve(sqliteDb.deleteEditorDocument(id));
  }

  public async getEditorDocumentVersions(documentId: string): Promise<any[]> {
    if (this.isPostgres()) return postgresDb.getEditorDocumentVersions(documentId);
    return Promise.resolve(sqliteDb.getEditorDocumentVersions(documentId));
  }

  public async saveEditorDocumentVersion(ver: any): Promise<any> {
    if (this.isPostgres()) return postgresDb.saveEditorDocumentVersion(ver);
    return Promise.resolve(sqliteDb.saveEditorDocumentVersion(ver));
  }

  public async restoreEditorDocumentVersion(documentId: string, versionId: string): Promise<any | null> {
    if (this.isPostgres()) return postgresDb.restoreEditorDocumentVersion(documentId, versionId);
    return Promise.resolve(sqliteDb.restoreEditorDocumentVersion(documentId, versionId));
  }

}

export const db = new UnifiedDatabaseService();
export { postgresDb, sqliteDb, JobRow, StoredDocument };
