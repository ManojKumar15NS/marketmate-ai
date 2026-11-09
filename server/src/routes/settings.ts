import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { env, updateGeminiApiKey } from '../config/env.js';
import { geminiService } from '../services/gemini.js';
import { hunterService } from '../services/hunterService.js';

const router = Router();

const verifyKeySchema = z.object({
  apiKey: z.string().min(1, 'API key cannot be empty'),
  saveToSession: z.boolean().optional().default(true)
});

const hunterKeySchema = z.object({
  apiKey: z.string().min(1, 'Hunter API key cannot be empty'),
  enableEmailDiscovery: z.boolean().optional().default(true)
});

// GET /api/settings - Safe status check (never returns the raw key, only status and last 4 chars)
router.get('/', async (req: Request, res: Response) => {
  const hunterSettings = await hunterService.getSettings();
  const geminiKey = env.GEMINI_API_KEY || '';
  res.json({
    configured: geminiService.isConfigured(),
    activeModel: geminiService.getModelName(),
    envKeySet: Boolean(geminiKey && geminiKey.trim() !== ''),
    last4: geminiKey.length >= 4 ? geminiKey.slice(-4) : null,
    maskedKey: geminiKey.length >= 4 ? `••••••••••••${geminiKey.slice(-4)}` : null,
    hunter: hunterSettings
  });
});

// GET /api/settings/hunter - Get Hunter configuration status
router.get('/hunter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await hunterService.getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/hunter - Save Hunter API key
router.post('/hunter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey, enableEmailDiscovery } = hunterKeySchema.parse(req.body);
    const result = await hunterService.saveApiKey(apiKey, enableEmailDiscovery);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/settings/hunter/test - Test Hunter key without necessarily saving
router.post('/hunter/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = typeof req.body.apiKey === 'string' ? req.body.apiKey : undefined;
    const result = await hunterService.testConnection(apiKey);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/settings/hunter - Remove Hunter key
router.delete('/hunter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await hunterService.clearApiKey();
    res.json({ success: true, message: 'Hunter API key removed.', settings });
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/hunter/toggle - Toggle email discovery on/off
router.post('/hunter/toggle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enabled = Boolean(req.body.enabled);
    const settings = await hunterService.toggleEnabled(enabled);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/verify - Verify key with Google AI Studio
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey, saveToSession } = verifyKeySchema.parse(req.body);

    const result = await geminiService.verifyKey(apiKey);

    if (result.success && saveToSession) {
      updateGeminiApiKey(apiKey);
      geminiService.refreshClient(apiKey);
    }

    res.json({
      success: result.success,
      message: result.success
        ? 'Gemini API key verified successfully!'
        : result.message || 'Key validation failed',
      availableModels: result.availableModels
    });
  } catch (err) {
    next(err);
  }
});

export default router;
