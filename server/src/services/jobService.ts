import EventEmitter from 'events';
import { db, JobRow } from '../db/index.js';
import { sqliteDb } from '../db/sqlite.js';
import { logger } from '../utils/logger.js';

export interface JobProgressCallback {
  (progress: number, currentStage: string, intermediateData?: any): void;
}

export type JobHandler = (
  input: any,
  updateProgress: JobProgressCallback,
  signal: AbortSignal
) => Promise<any>;

class JobService extends EventEmitter {
  private handlers: Map<string, JobHandler> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private runningJobs: Set<string> = new Set();
  private jobCache: Map<string, JobRow> = new Map();
  private maxConcurrent = 5;

  constructor() {
    super();
    // Allow any number of SSE listeners without MaxListenersExceeded warning
    this.setMaxListeners(100);
    // Periodically process queued jobs
    setInterval(() => this.processQueue(), 1000);
  }

  /**
   * Register an agent's execution handler
   */
  public registerAgentHandler(agentId: string, handler: JobHandler): void {
    this.handlers.set(agentId, handler);
  }

  /**
   * Enqueue a new background job
   */
  public enqueueJob(params: {
    agentId: string;
    input: any;
    companyId?: string;
    researchId?: string;
  }): JobRow {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const job: JobRow = {
      jobId,
      agentId: params.agentId,
      companyId: params.companyId || null,
      researchId: params.researchId || null,
      status: 'queued',
      progress: 0,
      currentStage: 'Queued in background pipeline...',
      input: typeof params.input === 'string' ? params.input : JSON.stringify(params.input),
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null
    };

    this.jobCache.set(jobId, job);

    // Persist to underlying DB asynchronously (PostgreSQL / SQLite)
    db.createJob(job).catch(err => {
      logger.error(`[JobService] Failed to persist enqueued job ${jobId}:`, err);
    });

    logger.info(`[JobService] Enqueued job ${jobId} for agent "${params.agentId}"`);
    this.emit('job_updated', job);

    // Trigger queue processing asynchronously
    setImmediate(() => this.processQueue());

    return job;
  }

  /**
   * Get single job by ID (synchronous from memory cache/sqlite with async DB backing)
   */
  public getJob(jobId: string): JobRow | null {
    if (this.jobCache.has(jobId)) {
      return this.jobCache.get(jobId)!;
    }
    const sqliteRow = sqliteDb.getJob(jobId);
    if (sqliteRow) {
      this.jobCache.set(jobId, sqliteRow);
      return sqliteRow;
    }
    return null;
  }

  /**
   * Get single job by ID with fresh DB lookup
   */
  public async getJobAsync(jobId: string): Promise<JobRow | null> {
    const fromDb = await db.getJob(jobId);
    if (fromDb) {
      this.jobCache.set(jobId, fromDb);
      return fromDb;
    }
    return this.getJob(jobId);
  }

  /**
   * List jobs with filters
   */
  public listJobs(filter?: { agentId?: string; companyId?: string; status?: string; limit?: number }): JobRow[] {
    let list = Array.from(this.jobCache.values());
    if (list.length === 0) {
      const fromSqlite = sqliteDb.listJobs(filter);
      for (const j of fromSqlite) this.jobCache.set(j.jobId, j);
      list = fromSqlite;
    }

    if (filter?.agentId) list = list.filter(j => j.agentId === filter.agentId);
    if (filter?.companyId) list = list.filter(j => j.companyId === filter.companyId);
    if (filter?.status) list = list.filter(j => j.status === filter.status);

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(0, filter?.limit || 100);
  }

  public async listJobsAsync(filter?: { agentId?: string; companyId?: string; status?: string; limit?: number }): Promise<JobRow[]> {
    const fromDb = await db.listJobs(filter);
    for (const j of fromDb) this.jobCache.set(j.jobId, j);
    return fromDb;
  }

  /**
   * Cancel an in-flight or queued job
   */
  public cancelJob(jobId: string): boolean {
    const controller = this.abortControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(jobId);
    }

    const current = this.getJob(jobId);
    if (current && (current.status === 'completed' || current.status === 'failed')) {
      return false;
    }

    const updated: JobRow = current
      ? { ...current, status: 'cancelled', error: 'Job was cancelled by the user.', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : { jobId, agentId: 'unknown', companyId: null, researchId: null, status: 'cancelled', progress: 0, currentStage: null, input: '{}', result: null, error: 'Cancelled', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), startedAt: null, completedAt: new Date().toISOString() };

    this.jobCache.set(jobId, updated);
    this.runningJobs.delete(jobId);

    db.cancelJob(jobId).catch(() => {});
    sqliteDb.cancelJob(jobId);

    this.emit('job_updated', updated);
    this.emit(`job:${jobId}`, updated);

    logger.info(`[JobService] Cancelled job ${jobId}`);
    return true;
  }

  /**
   * Retry a failed, cancelled, or interrupted job
   */
  public retryJob(jobId: string): JobRow | null {
    const current = this.getJob(jobId);
    if (!current) return null;

    const retried: JobRow = {
      ...current,
      status: 'queued',
      progress: 0,
      currentStage: 'Queued for retry...',
      error: null,
      result: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString()
    };

    this.jobCache.set(jobId, retried);
    db.retryJob(jobId).catch(() => {});
    sqliteDb.retryJob(jobId);

    logger.info(`[JobService] Retrying job ${jobId}`);
    this.emit('job_updated', retried);
    this.emit(`job:${jobId}`, retried);
    setImmediate(() => this.processQueue());

    return retried;
  }

  /**
   * Background queue worker loop
   */
  private async processQueue(): Promise<void> {
    if (this.runningJobs.size >= this.maxConcurrent) {
      return;
    }

    const queuedJobs = this.listJobs({ status: 'queued', limit: this.maxConcurrent - this.runningJobs.size });

    for (const job of queuedJobs) {
      if (this.runningJobs.has(job.jobId)) continue;
      this.executeJob(job).catch(err => {
        logger.error(`[JobService] Unexpected error in executeJob for ${job.jobId}:`, err);
      });
    }
  }

  /**
   * Execute single job with isolated worker context
   */
  private async executeJob(job: JobRow): Promise<void> {
    const { jobId, agentId } = job;
    const handler = this.handlers.get(agentId);

    if (!handler) {
      const failedJob: JobRow = {
        ...job,
        status: 'failed',
        error: `No registered worker handler for agent: "${agentId}"`,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.jobCache.set(jobId, failedJob);
      db.updateJob(jobId, failedJob).catch(() => {});
      sqliteDb.updateJob(jobId, failedJob);
      this.emit('job_updated', failedJob);
      return;
    }

    this.runningJobs.add(jobId);
    const controller = new AbortController();
    this.abortControllers.set(jobId, controller);

    // Update job to running
    const runningJob: JobRow = {
      ...job,
      status: 'running',
      startedAt: new Date().toISOString(),
      currentStage: 'Worker starting execution...',
      updatedAt: new Date().toISOString()
    };

    this.jobCache.set(jobId, runningJob);
    db.updateJob(jobId, runningJob).catch(() => {});
    sqliteDb.updateJob(jobId, runningJob);

    this.emit('job_updated', runningJob);
    this.emit(`job:${jobId}`, runningJob);

    // Progress callback for agent execution
    const updateProgress: JobProgressCallback = (progress, currentStage, intermediateData) => {
      const current = this.getJob(jobId) || runningJob;
      const updates: Partial<JobRow> = {
        progress: Math.min(100, Math.max(0, Math.round(progress))),
        currentStage,
        updatedAt: new Date().toISOString()
      };
      if (intermediateData !== undefined) {
        updates.result = intermediateData ? JSON.stringify(intermediateData) : null;
      }

      const updatedJob: JobRow = { ...current, ...updates };
      this.jobCache.set(jobId, updatedJob);

      db.updateJob(jobId, updates).catch(() => {});
      sqliteDb.updateJob(jobId, updates);

      this.emit('job_updated', updatedJob);
      this.emit(`job:${jobId}`, updatedJob);
    };

    try {
      const parsedInput = typeof job.input === 'string' ? JSON.parse(job.input) : job.input;
      logger.info(`[JobService] Executing job ${jobId} (agent: ${agentId})`);

      const result = await handler(parsedInput, updateProgress, controller.signal);

      const finalState: Partial<JobRow> = controller.signal.aborted
        ? {
            status: 'cancelled',
            error: 'Execution aborted by cancellation request.',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        : {
            status: 'completed',
            progress: 100,
            currentStage: 'Completed successfully.',
            result: JSON.stringify(result),
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

      const updated = { ...(this.getJob(jobId) || runningJob), ...finalState };
      this.jobCache.set(jobId, updated);

      await db.updateJob(jobId, finalState);
      sqliteDb.updateJob(jobId, finalState);

      this.emit('job_updated', updated);
      this.emit(`job:${jobId}`, updated);
    } catch (err: any) {
      logger.error(`[JobService] Job execution failed for ${jobId}:`, err.message);
      const failedState: Partial<JobRow> = {
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        error: err.message || 'Unknown error occurred during background agent execution.',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const updated = { ...(this.getJob(jobId) || runningJob), ...failedState };
      this.jobCache.set(jobId, updated);

      await db.updateJob(jobId, failedState);
      sqliteDb.updateJob(jobId, failedState);

      this.emit('job_updated', updated);
      this.emit(`job:${jobId}`, updated);
    } finally {
      this.runningJobs.delete(jobId);
      this.abortControllers.delete(jobId);

      // Check queue for next pending jobs
      setImmediate(() => this.processQueue());
    }
  }
}

export const jobService = new JobService();
