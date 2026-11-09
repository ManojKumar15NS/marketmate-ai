import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables (.env.local from project root, or .env from server/root)
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().min(1024).max(65535).default(5000),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TAVILY_API_KEY: z.string().optional().default(''),
  HUNTER_API_KEY: z.string().optional().default(''),
  PAGESPEED_API_KEY: z.string().optional().default(''),
  AUTH_TOKEN: z.string().optional().default(''),
  ADMIN_PASSWORD: z.string().optional().default('admin'),
  DATABASE_PATH: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional()
});

let parsedEnv: z.infer<typeof envSchema>;

try {
  parsedEnv = envSchema.parse({
    PORT: process.env.PORT,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    NODE_ENV: process.env.NODE_ENV,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    HUNTER_API_KEY: process.env.HUNTER_API_KEY,
    PAGESPEED_API_KEY: process.env.PAGESPEED_API_KEY,
    AUTH_TOKEN: process.env.AUTH_TOKEN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    DATABASE_PATH: process.env.DATABASE_PATH,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED
  });
} catch (err: any) {
  if (err instanceof z.ZodError) {
    console.error('================================================================');
    console.error('FATAL: Environment configuration validation failed on startup:');
    for (const error of err.errors) {
      console.error(` - [${error.path.join('.')}] ${error.message}`);
    }
    console.error('================================================================');
  } else {
    console.error('FATAL: Unexpected configuration error on startup:', err);
  }
  process.exit(1);
}

export const env = parsedEnv;

export function updateGeminiApiKey(key: string): void {
  (env as any).GEMINI_API_KEY = key.trim();
  process.env.GEMINI_API_KEY = key.trim();
}
