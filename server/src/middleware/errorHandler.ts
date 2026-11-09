import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response has already started streaming (SSE), delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errorMsg = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: errorMsg
      },
      message: errorMsg,
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
    return;
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected internal server error occurred.';

  // Never leak internal stack trace to client, scrub sensitive info from logs
  logger.error(`[Error] ${req.method} ${req.url}: ${message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'API_ERROR'),
      message
    },
    message
  });
}
