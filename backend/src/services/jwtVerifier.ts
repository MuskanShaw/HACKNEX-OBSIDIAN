/**
 * Supabase Auth Service Re-export
 * JWT verification has been completely removed in favor of simple Supabase Auth (supabase.auth.getUser).
 */
export {
  authenticateSupabaseToken,
  sanitizeToken,
  jwtVerifier,
  type VerifiedSupabaseUser,
} from './supabaseAuth.js';
