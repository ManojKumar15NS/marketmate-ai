import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { store } from './services/store.js';
import { geminiService } from './services/gemini.js';
import { db } from './db/index.js';
import { initBackgroundWorkers } from './workers/index.js';
import { logger } from './utils/logger.js';

import chatRouter from './routes/chat.js';
import conversationsRouter from './routes/conversations.js';
import tasksRouter from './routes/tasks.js';
import settingsRouter from './routes/settings.js';
import agentRouter from './routes/agent.js';
import researchRouter from './routes/research.js';
import seoRouter from './routes/seo.js';
import emailRouter from './routes/email.js';
import contentRouter from './routes/content.js';
import editorRouter from './routes/editor.js';
import documentsRouter from './routes/documents.js';
import knowledgeRouter from './routes/knowledge.js';
import leadsRouter from './routes/leads.js';
import emailFinderRouter from './routes/emailFinder.js';
import whatsappRouter from './routes/whatsapp.js';
import jobsRouter from './routes/jobs.js';
import authRouter from './routes/auth.js';

const app = express();

// Security Headers (equivalent to Helmet)
app.use(securityHeaders);

// CORS Policy
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.vercel.app')) {
        return callback(null, true);
      }
    } catch {
      // invalid URL
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));

// 1. Health Probe (Liveness) - exempt from rate limits for container & load balancer probes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: geminiService.isConfigured(),
    activeModel: geminiService.getModelName()
  });
});

// 2. Readiness Probe - exempt from rate limits
app.get('/api/ready', async (req, res) => {
  try {
    const isDbConnected = await db.ping();
    const isPg = db.isPostgres();
    res.json({
      status: isDbConnected ? 'ready' : 'degraded',
      database: isPg ? 'connected (Neon PostgreSQL Pool)' : 'connected (SQLite WAL)',
      engine: isPg ? 'postgresql' : 'sqlite',
      gemini: geminiService.isConfigured() ? 'configured' : 'needs_key',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'not_ready',
      error: err.message
    });
  }
});

// Rate Limiter applied to all business API routes
app.use(generalLimiter);

// 3. Public Auth Routes
app.use('/api/auth', authRouter);

// 4. Server-Side Authentication Enforcement for non-public API endpoints
app.use('/api', requireAuth);

// 5. Modular API Routes
app.use('/api/jobs', jobsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/research', researchRouter);
app.use('/api/seo', seoRouter);
app.use('/api/email', emailRouter);
app.use('/api/content', contentRouter);
app.use('/api/editor', editorRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/email-finder', emailFinderRouter);
app.use('/api/whatsapp', whatsappRouter);

// 6. Production Static Assets (Client SPA)
const CLIENT_DIST = path.resolve(__dirname, '../../../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// Global Error Handler
app.use(errorHandler);

let serverInstance: any = null;

async function bootstrap() {
  try {
    await db.init();
    await store.init();
    logger.info('[Store] Persistent storage initialized successfully.');

    // Initialize background workers for all agents
    initBackgroundWorkers();

    serverInstance = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`===============================================`);
      logger.info(`🚀 MarketMate AI Server running on http://0.0.0.0:${env.PORT}`);
      logger.info(`📡 Health Check: http://localhost:${env.PORT}/api/health`);
      logger.info(`🔍 Readiness Probe: http://localhost:${env.PORT}/api/ready`);
      logger.info(`🤖 Gemini Status: ${geminiService.isConfigured() ? 'Configured' : 'Needs API Key'}`);
      logger.info(`🎯 Active Model: ${geminiService.getModelName()}`);
      logger.info(`🛠️ Background Job System: Active (${db.isPostgres() ? 'Neon PostgreSQL Pool' : 'SQLite WAL'})`);
      logger.info(`===============================================`);
    });

    serverInstance.setTimeout(300000); // 5-minute request timeout
    serverInstance.keepAliveTimeout = 65000;
    serverInstance.headersTimeout = 66000;
  } catch (error) {
    logger.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

// Graceful Shutdown Handler
async function handleGracefulShutdown(signal: string) {
  logger.info(`[Server] Received ${signal}. Initiating graceful shutdown...`);

  // Close Database connection and mark in-flight jobs as interrupted
  try {
    await db.close();
    logger.info('[Database] Closed database cleanly and marked in-flight jobs as interrupted.');
  } catch (err: any) {
    logger.error('[Database] Error during database shutdown:', err.message);
  }

  if (serverInstance) {
    serverInstance.close(() => {
      logger.info('[Server] HTTP server closed cleanly. Exiting process.');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('[Server] Forcing process exit after timeout.');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => { handleGracefulShutdown('SIGINT').catch(() => process.exit(1)); });
process.on('SIGTERM', () => { handleGracefulShutdown('SIGTERM').catch(() => process.exit(1)); });

bootstrap();

export { app };
