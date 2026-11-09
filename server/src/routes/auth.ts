import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPublicAuthStatus, verifyLoginCredentials, getActiveServerToken } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  password: z.string().min(1, 'Password or Token is required')
});

// GET /api/auth/status
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: getPublicAuthStatus()
  });
});

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { password } = loginSchema.parse(req.body);
    const isValid = verifyLoginCredentials(password);

    if (!isValid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid password or auth token.' }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        token: getActiveServerToken(),
        message: 'Authentication successful.'
      }
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.errors[0].message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
