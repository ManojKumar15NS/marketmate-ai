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

// Check if authentication is strictly enforced
export function isAuthEnforced(): boolean {
  if (process.env.AUTH_DISABLED === 'true') return false;
  if (process.env.AUTH_REQUIRED === 'true') return true;

  const hasAuthToken = Boolean(process.env.AUTH_TOKEN && process.env.AUTH_TOKEN.trim().length >= 8);
  const hasAdminPassword = Boolean(
    process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_PASSWORD.trim().length >= 4 &&
    process.env.ADMIN_PASSWORD.trim() !== 'admin'
  );

  // If credentials were provided in environment variables, enforce authentication
  return hasAuthToken || hasAdminPassword;
}

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

  // Allow GET /api/settings publicly so frontend status pills can load safely
  if (req.path === '/api/settings' && req.method === 'GET') {
    return next();
  }

  // If auth is not configured or disabled, allow access
  if (!isAuthEnforced()) {
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

  if (!token || !verifyLoginCredentials(token)) {
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
  const enforced = isAuthEnforced();
  return {
    authRequired: enforced,
    authMode: enforced ? 'token_protected' : 'development_open'
  };
}

export function verifyLoginCredentials(passwordOrToken: string): boolean {
  if (!passwordOrToken) return false;
  const candidate = passwordOrToken.trim();
  const adminPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : null;
  const envAuthToken = process.env.AUTH_TOKEN ? process.env.AUTH_TOKEN.trim() : null;

  if (candidate === SERVER_AUTH_TOKEN) return true;
  if (envAuthToken && candidate === envAuthToken) return true;
  if (adminPassword && candidate === adminPassword) return true;

  return false;
}

export function getActiveServerToken(): string {
  return SERVER_AUTH_TOKEN;
}
