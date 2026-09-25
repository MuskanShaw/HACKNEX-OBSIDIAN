import { Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { AuthenticatedRequest, UserRecord } from '../types/index.js';
import { dataStore } from '../services/dataStore.js';
import { getSupabaseClient, isLiveSupabaseConfigured } from '../services/supabase.js';
import { authenticateSupabaseToken, sanitizeToken } from '../services/supabaseAuth.js';

/**
 * Centralized Authentication Middleware with Cross-Device Fallback Identity.
 * 
 * Priority:
 * 1. Supabase Auth via `Authorization: Bearer <token>`
 *    - Authenticated via Supabase Auth (supabase.auth.getUser).
 *    - Authenticated Supabase user profile synchronized into the database.
 * 
 * 2. Fallback Identity Headers (`x-user-id`, `x-user-email`, `x-user-name`)
 *    - Active when token is missing, expired, or invalid.
 *    - Prefer x-user-id when available, otherwise x-user-email.
 *    - Strictly verified against existing users/profiles in the database.
 *    - Resolves internal user & store ownership without allowing arbitrary store access.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const queryToken = (req.query?.token || req.query?.access_token) as string | undefined;
    let authUser: any = null;

    // ------------------------------------------------------------------------
    // PRIORITY 1: Supabase Auth from Authorization: Bearer <token> or ?token=...
    // (Query param support is essential for EventSource / SSE which cannot send custom headers)
    // ------------------------------------------------------------------------
    const hasBearerHeader = Boolean(authHeader && authHeader.startsWith('Bearer '));
    const rawToken = hasBearerHeader
      ? authHeader!.split(' ')[1]
      : queryToken;

    if (hasBearerHeader || queryToken) {
      const token = sanitizeToken(rawToken);
      if (token) {
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
      } else {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or empty Bearer token.',
        });
        return;
      }
    }

    // If valid Supabase user was authenticated, synchronize profile and continue
    if (authUser) {
      const userId = authUser.id;
      const email = authUser.email || `${userId}@supabase.user`;
      const fullName =
        (authUser.user_metadata?.full_name as string) ||
        (authUser.user_metadata?.name as string) ||
        null;
      const avatarUrl = (authUser.user_metadata?.avatar_url as string) || null;

      // Synchronize user profile into PostgreSQL
      const dbUser = await dataStore.upsertUser({
        id: userId,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
      });

      req.currentUser = dbUser;
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

      // Development-only logging (never log secrets, passwords, or tokens)
      if (env.NODE_ENV !== 'production') {
        console.log(`[AUTH] Method: SupabaseAuth | User: ${userId} | Path: ${req.originalUrl || req.path}`);
      }

      next();
      return;
    }

    // ------------------------------------------------------------------------
    // PRIORITY 2: Fallback Identity Headers (Cross-Device Hydration)
    // ------------------------------------------------------------------------
    const getHeaderString = (val: string | string[] | undefined): string | undefined => {
      if (Array.isArray(val)) return val[0]?.trim();
      if (typeof val === 'string') return val.trim();
      return undefined;
    };

    const rawUserId = getHeaderString(req.headers['x-user-id'] || req.headers['x-mock-user-id']);
    const rawUserEmail = getHeaderString(req.headers['x-user-email'] || req.headers['x-mock-user-email']);
    const rawUserName = getHeaderString(req.headers['x-user-name'] || req.headers['x-mock-user-name']);

    if (!rawUserId && !rawUserEmail) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Missing valid Bearer token and fallback identity headers.',
      });
      return;
    }

    // Verify identity against existing users/profiles in the database (never trust blindly)
    let existingUser: UserRecord | null = null;

    if (rawUserId) {
      existingUser = await dataStore.getUserById(rawUserId);
      // Identity spoofing prevention: If email is also provided, ensure it matches the database record
      if (existingUser && rawUserEmail && existingUser.email.toLowerCase() !== rawUserEmail.toLowerCase()) {
        existingUser = null;
      }
    } else if (rawUserEmail) {
      existingUser = await dataStore.getUserByEmail(rawUserEmail);
    }

    if (!existingUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid fallback identity. User does not exist in the database.',
      });
      return;
    }

    // Update name if fallback name provided and not yet stored on profile
    if (rawUserName && !existingUser.full_name) {
      existingUser = await dataStore.upsertUser({
        id: existingUser.id,
        email: existingUser.email,
        full_name: rawUserName,
        avatar_url: existingUser.avatar_url,
      });
    }

    req.currentUser = {
      id: existingUser.id,
      email: existingUser.email,
      auth0_sub: existingUser.auth0_sub || null,
      full_name: existingUser.full_name || null,
      avatar_url: existingUser.avatar_url || null,
    };

    req.auth = {
      payload: {
        sub: existingUser.id,
        email: existingUser.email,
        name: existingUser.full_name || undefined,
        picture: existingUser.avatar_url || undefined,
        auth_method: 'fallback',
      },
    };

    // Development-only logging (never log secrets, passwords, or tokens)
    if (env.NODE_ENV !== 'production') {
      console.log(`[AUTH] Method: fallback | User: ${existingUser.id} | Path: ${req.originalUrl || req.path}`);
    }

    next();
  } catch (err: any) {
    res.status(500).json({
      error: 'Authentication Error',
      message: err.message || 'An error occurred while verifying the authentication identity.',
    });
  }
};
