import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  ALLOWED_ORIGIN: z.string().default('https://hacknex-obsidian06.vercel.app,https://hacknex-obsidian06.onrender.com,https://obsidian-alpha-wheat.vercel.app,http://localhost:3000,http://localhost:5173'),


  // Supabase Configuration
  SUPABASE_URL: z.string().url().default('https://sample-project.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('sample_service_role_key'),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('store-assets'),
  SUPABASE_STORAGE_ENDPOINT: z.string().optional(),

  // Vercel Deployment Integration
  VERCEL_API_TOKEN: z.string().default('sample_vercel_token'),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_BASE_DOMAIN: z.string().default('obsidian.store'),

  // Google Maps Integration
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),

  // Google Gemini AI Integration
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().optional().default('gemini-3.5-flash-lite'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
