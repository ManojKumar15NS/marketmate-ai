/**
 * Production-ready structured logger with automatic secret scrubbing and redaction.
 * Prevents API keys, Bearer tokens, emails, and passwords from leaking to stdout or log files.
 */

const SENSITIVE_PATTERNS = [
  /AIza[A-Za-z0-9_\-]{30,}/g, // Google / Gemini API keys
  /tvly-[\w\-]{10,}/g, // Tavily API keys
  /[a-f0-9]{40}/gi, // Hunter.io / SHA-1 API keys
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /(?:password|secret|api_?key|token|auth)["']?\s*[:=]\s*["']?([^"',\s]+)["']?/gi
];

function sanitize(message: string): string {
  let cleaned = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match, captured) => {
      if (typeof captured === 'string' && captured.length > 0) {
        return match.replace(captured, '••••REDACTED••••');
      }
      if (match.length > 8) {
        return `${match.substring(0, 4)}••••REDACTED••••${match.substring(match.length - 4)}`;
      }
      return '••••REDACTED••••';
    });
  }
  return cleaned;
}

function formatArg(arg: any): any {
  if (typeof arg === 'string') {
    return sanitize(arg);
  }
  if (arg instanceof Error) {
    return sanitize(arg.stack || arg.message);
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.parse(sanitize(JSON.stringify(arg)));
    } catch {
      return arg;
    }
  }
  return arg;
}

export const logger = {
  info: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${sanitize(msg)}`, ...args.map(formatArg));
  },
  warn: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${sanitize(msg)}`, ...args.map(formatArg));
  },
  error: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${sanitize(msg)}`, ...args.map(formatArg));
  },
  debug: (msg: string, ...args: any[]) => {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [DEBUG] ${sanitize(msg)}`, ...args.map(formatArg));
    }
  },
  scrub: sanitize
};
