import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

const DATA_DIR = path.resolve(__dirname, '../../../data');
const TOKEN_FILE = path.join(DATA_DIR, '.session_token');

// Load or generate server auth token
function getOrCreateAuthToken(): string {
  if (process.env.AUTH_TOKEN && process.env.AUTH_TOKEN.trim().length >= 8) {
    return process.env.AUTH_TOKEN.trim();
  }

  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const saved = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
      if (saved.length >= 16) return saved;
    }
  } catch {
    // proceed to generate
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, generated, 'utf-8');
  } catch (err: any) {
    logger.warn(`[Auth] Could not persist session token: ${err.message}`);
  }
  return generated;
}

const SERVER_AUTH_TOKEN = getOrCreateAuthToken();

// In development or single-tenant local mode, allow seamless access if DEV_BYPASS_AUTH is true
const DEV_BYPASS_AUTH = process.env.NODE_ENV !== 'production' || process.env.AUTH_DISABLED === 'true';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Public whitelisted paths
  const publicPaths = [
    '/api/health',
    '/api/ready',
    '/api/auth/login',
    '/api/auth/status'
  ];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  // If local development bypass is enabled, allow access
  if (DEV_BYPASS_AUTH) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-auth-token'];

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof apiKeyHeader === 'string') {
    token = apiKeyHeader.trim();
  }

  if (!token || token !== SERVER_AUTH_TOKEN) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid Bearer token or x-api-key header.'
      }
    });
    return;
  }

  next();
}

export function getPublicAuthStatus() {
  return {
    authRequired: !DEV_BYPASS_AUTH,
    authMode: DEV_BYPASS_AUTH ? 'development_open' : 'token_protected'
  };
}

export function verifyLoginCredentials(passwordOrToken: string): boolean {
  if (!passwordOrToken) return false;
  const candidate = passwordOrToken.trim();
  const adminPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : null;

  // Strict: zero default passwords. Must match SERVER_AUTH_TOKEN or explicit non-empty ADMIN_PASSWORD
  if (candidate === SERVER_AUTH_TOKEN) return true;
  if (adminPassword && adminPassword.length >= 8 && candidate === adminPassword) return true;

  return false;
}

export function getActiveServerToken(): string {
  return SERVER_AUTH_TOKEN;
}
