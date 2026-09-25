import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://vrgendezcvpzjuhcuhfo.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZ2VuZGV6Y3Zwemp1aGN1aGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNDU3MTcsImV4cCI6MjEwMzkyMTcxN30.Qfo4AkAFjWufF-IcCdHxV2cNFh5RmNRJfOUef3gXfIs';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
