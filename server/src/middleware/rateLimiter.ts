import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Exempt health probes and job-status polling/SSE as required by ground rules
  skip: (req) => {
    const url = req.originalUrl || req.path || '';
    return (
      url.startsWith('/api/health') ||
      url.startsWith('/api/ready') ||
      url.startsWith('/api/jobs')
    );
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this client, please try again in a few minutes.'
    }
  }
});

export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 generation requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI generation rate limit reached. Please wait a few seconds before sending another prompt.'
    }
  }
});
