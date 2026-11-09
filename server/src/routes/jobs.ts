import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { jobService } from '../services/jobService.js';

const router = Router();

const createJobSchema = z.object({
  agentId: z.enum(['prospector', 'seo', 'research', 'email_finder', 'document', 'email']),
  input: z.any(),
  companyId: z.string().optional(),
  researchId: z.string().optional()
});

// POST /api/jobs - Enqueue a new background job
router.post('/', async (req: Request, res: Response) => {
  try {
    const { agentId, input, companyId, researchId } = createJobSchema.parse(req.body);
    const job = await jobService.enqueueJob({ agentId, input, companyId, researchId });

    res.status(202).json({
      success: true,
      data: job,
      message: `Job ${job.jobId} enqueued for background execution.`
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.errors[0].message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/jobs - List background jobs
router.get('/', async (req: Request, res: Response) => {
  try {
    const { agentId, companyId, status, limit } = req.query;
    const jobs = await jobService.listJobs({
      agentId: agentId as string | undefined,
      companyId: companyId as string | undefined,
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 50
    });

    res.json({ success: true, data: jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/jobs/:id - Get specific job details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await jobService.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
      return;
    }
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/jobs/:id/cancel - Cancel in-flight job
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const cancelled = await jobService.cancelJob(req.params.id);
    if (!cancelled) {
      res.status(400).json({ success: false, error: { code: 'CANCEL_FAILED', message: 'Job could not be cancelled or has already completed.' } });
      return;
    }
    res.json({ success: true, message: `Job ${req.params.id} cancelled.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/jobs/:id/retry - Retry failed or interrupted job
router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const retried = await jobService.retryJob(req.params.id);
    if (!retried) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found to retry.' } });
      return;
    }
    res.json({ success: true, data: retried, message: `Job ${req.params.id} re-queued for execution.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/jobs/:id/stream - Server-Sent Events stream for single job
router.get('/:id/stream', async (req: Request, res: Response) => {
  const jobId = req.params.id;
  const initialJob = await jobService.getJob(jobId);

  if (!initialJob) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    return;
  }

  // Headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Flush initial state immediately
  res.write(`data: ${JSON.stringify(initialJob)}\n\n`);

  // Event listener
  const onUpdate = (updatedJob: any) => {
    res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);
    if (updatedJob.status === 'completed' || updatedJob.status === 'failed' || updatedJob.status === 'cancelled') {
      res.end();
    }
  };

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    jobService.off(`job:${jobId}`, onUpdate);
  });

  jobService.on(`job:${jobId}`, onUpdate);
});

// GET /api/jobs/stream/all - Server-Sent Events stream for ALL active job updates
router.get('/stream/all', async (_req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Flush current active jobs
  const currentJobs = await jobService.listJobs({ limit: 50 });
  for (const j of currentJobs) {
    res.write(`data: ${JSON.stringify(j)}\n\n`);
  }

  const onUpdate = (updatedJob: any) => {
    res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  _req.on('close', () => {
    clearInterval(heartbeat);
    jobService.off('job_updated', onUpdate);
  });

  jobService.on('job_updated', onUpdate);
});

export default router;
