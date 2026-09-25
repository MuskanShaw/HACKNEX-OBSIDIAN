import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

let supabaseAnonClient: SupabaseClient | null = null;

export function getSupabaseAnonClient(): SupabaseClient {
  if (!supabaseAnonClient) {
    const anonKey = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    supabaseAnonClient = createClient(env.SUPABASE_URL, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAnonClient;
}

export const isLiveSupabaseConfigured = (): boolean => {
  if (process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test') {
    return false;
  }
  return (
    Boolean(env.SUPABASE_URL) &&
    !env.SUPABASE_URL.includes('sample-project') &&
    Boolean(env.SUPABASE_SERVICE_ROLE_KEY) &&
    !env.SUPABASE_SERVICE_ROLE_KEY.includes('sample_service_role_key')
  );
};
