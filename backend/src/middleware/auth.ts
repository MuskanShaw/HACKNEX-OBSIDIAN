import { Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../types/index.js';
import { authenticateSupabaseToken, sanitizeToken } from '../services/supabaseAuth.js';

/**
 * Supabase-Only Authentication Middleware.
 * 
 * Accepts strictly:
 * `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
 * or `?token=<SUPABASE_ACCESS_TOKEN>` for Server-Sent Events (SSE) connections.
 * 
 * Verifies token via Supabase Auth and binds authenticated Supabase user UUID (auth.uid()).
 * Never writes to database on authentication verification.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = (req.query?.token || req.query?.access_token) as string | undefined;

    const hasBearerHeader = Boolean(authHeader && authHeader.startsWith('Bearer '));
    const rawToken = hasBearerHeader
      ? authHeader!.split(' ')[1]
      : queryToken;

    if (!rawToken) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Missing Bearer access token.',
      });
      return;
    }

    const token = sanitizeToken(rawToken);
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or empty Bearer token.',
      });
      return;
    }

    let authUser: any = null;
    try {
      authUser = await authenticateSupabaseToken(token);
    } catch (err: any) {
      console.log(`[AUTH] Token verification failed: ${err.message}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired Supabase authentication token.',
      });
      return;
    }

    if (!authUser || !authUser.id) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Supabase authentication token.',
      });
      return;
    }

    const userId = authUser.id; // Supabase auth.uid()
    const email = authUser.email || `${userId}@supabase.user`;
    const fullName =
      (authUser.user_metadata?.full_name as string) ||
      (authUser.user_metadata?.name as string) ||
      null;
    const avatarUrl = (authUser.user_metadata?.avatar_url as string) || null;
    const role = (authUser.user_metadata?.role as string) || 'merchant';

    // Directly bind verified currentUser in memory (NO DB WRITE)
    req.currentUser = {
      id: userId,
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      role,
    };

    req.auth = {
      payload: {
        sub: userId,
        email,
        name: fullName || undefined,
        picture: avatarUrl || undefined,
        user: authUser,
        auth_method: 'SupabaseAuth',
      },
    };

    if (env.NODE_ENV !== 'production') {
      console.log(`[AUTH] Method: SupabaseAuth | User: ${userId} | Path: ${req.originalUrl || req.path}`);
    }

    next();
  } catch (err: any) {
    res.status(500).json({
      error: 'Authentication Error',
      message: err.message || 'An error occurred while verifying the authentication identity.',
    });
  }
};
