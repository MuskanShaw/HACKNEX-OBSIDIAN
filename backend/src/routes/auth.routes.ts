import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getSupabaseClient, getSupabaseAnonClient, isLiveSupabaseConfigured } from '../services/supabase.js';
import { dataStore } from '../services/dataStore.js';
import { authenticateSupabaseToken, sanitizeToken } from '../services/supabaseAuth.js';

const router = Router();

const signupSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().optional(),
});

const loginSchema = z
  .object({
    email: z.string().email('Valid email address is required').optional(),
    password: z.string().min(1, 'Password is required').optional(),
    access_token: z.string().optional(),
    token: z.string().optional(),
  })
  .optional();

/**
 * POST /api/auth/signup
 * Register new user with Supabase Auth
 */
router.post(
  '/signup',
  validateRequest({ body: signupSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, full_name } = req.body;

    if (!isLiveSupabaseConfigured()) {
      // Test / offline simulation: Create valid JWT session
      const mockId = randomUUID();
      const mockName = full_name || email.split('@')[0];
      const user = await dataStore.upsertUser({
        id: mockId,
        email,
        full_name: mockName,
      });

      const payload = Buffer.from(
        JSON.stringify({
          sub: mockId,
          email,
          user_metadata: { full_name: mockName },
        })
      ).toString('base64url');
      const token = `mock.${payload}.sig`;

      res.status(201).json({
        message: 'Registration successful',
        user,
        token,
        session: {
          access_token: token,
          token_type: 'bearer',
          user,
        },
      });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const displayName = full_name?.trim() || email.split('@')[0];

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName,
            name: displayName,
          },
        },
      });

      if (error) {
        res.status(400).json({
          error: 'Registration Failed',
          message: error.message,
        });
        return;
      }

      const authUser = data.user;
      if (!authUser) {
        res.status(400).json({
          error: 'Registration Failed',
          message: 'Unable to create user account.',
        });
        return;
      }

      // Synchronize profile into database
      const dbUser = await dataStore.upsertUser({
        id: authUser.id,
        email: authUser.email || email,
        full_name: displayName,
      });

      let session = data.session;
      if (!session) {
        const loginRes = await supabase.auth.signInWithPassword({ email, password });
        if (loginRes.data?.session) {
          session = loginRes.data.session;
        }
      }

      res.status(201).json({
        message: 'Registration successful',
        user: dbUser,
        token: session?.access_token || null,
        session: session || null,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Registration Error',
        message: err.message || 'An unexpected error occurred during signup.',
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user with Supabase Auth (Bearer access_token, body token, or email/password)
 */
router.post(
  '/login',
  validateRequest({ body: loginSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : undefined;
    const password = req.body?.password;

    const authHeader = req.headers.authorization;
    const hasAuthHeader = Boolean(authHeader && authHeader.startsWith('Bearer '));
    const rawBearerToken = hasAuthHeader ? authHeader!.split(' ')[1]?.trim() : undefined;
    const bearerToken = sanitizeToken(rawBearerToken);
    const bodyToken = sanitizeToken(req.body?.access_token || req.body?.token);
    const token = bearerToken || bodyToken;

    // Diagnostic logging (NEVER log passwords, access tokens, refresh tokens, or secrets!)
    console.log(
      `[AUTH] /api/auth/login request: hasAuthHeader=${Boolean(bearerToken)}, hasBodyToken=${Boolean(bodyToken)}, hasEmail=${Boolean(email)}`
    );

    // ------------------------------------------------------------------------
    // CASE 1: Email & Password Credentials Login (Highest Priority)
    // ------------------------------------------------------------------------
    if (email && password) {
      if (!isLiveSupabaseConfigured()) {
        // Test / offline simulation: look up existing user or create
        const existingUser = await dataStore.getUserByEmail(email);
        const mockId = existingUser?.id || randomUUID();
        const mockName = existingUser?.full_name || email.split('@')[0];
        const user = await dataStore.upsertUser({
          id: mockId,
          email,
          full_name: mockName,
        });

        const payload = Buffer.from(
          JSON.stringify({
            sub: mockId,
            email,
            user_metadata: { full_name: mockName },
          })
        ).toString('base64url');
        const testToken = `mock.${payload}.sig`;

        console.log(`[AUTH] Offline/test login successful for user: ${mockId}`);
        res.status(200).json({
          message: 'Login successful',
          user,
          token: testToken,
          session: {
            access_token: testToken,
            token_type: 'bearer',
            user,
          },
        });
        return;
      }

      try {
        const supabase = getSupabaseAnonClient();
        console.log(`[AUTH] Authenticating email credentials via Supabase Anon Client`);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user || !data.session) {
          const rawMsg = error?.message || 'Invalid credentials';
          console.log(`[AUTH] Supabase signInWithPassword failed: ${rawMsg}`);

          let userFacingMsg = rawMsg;
          if (rawMsg.toLowerCase().includes('database error granting user')) {
            userFacingMsg =
              'Database error granting user: A database trigger on auth.users in Supabase is misconfigured (ran on UPDATE or threw an exception). Run the provided SQL migration in the Supabase SQL Editor to resolve.';
          }

          res.status(401).json({
            error: 'Authentication Failed',
            message: userFacingMsg,
          });
          return;
        }

        const authUser = data.user;
        const authUid = authUser.id;
        console.log(`[AUTH] Supabase credential login succeeded for auth.uid: ${authUid}`);

        const fullName =
          (authUser.user_metadata?.full_name as string) ||
          (authUser.user_metadata?.name as string) ||
          authUser.email?.split('@')[0] ||
          'Obsidian User';

        const dbUser = await dataStore.upsertUser({
          id: authUid,
          email: authUser.email || email,
          full_name: fullName,
          avatar_url: authUser.user_metadata?.avatar_url || null,
        });

        console.log(`[AUTH] Supabase user profile synchronized for auth.uid: ${authUid}`);

        res.status(200).json({
          message: 'Login successful',
          user: dbUser,
          token: data.session.access_token,
          session: data.session,
        });
        return;
      } catch (err: any) {
        console.error(`[AUTH] Unexpected error during credential login: ${err.message}`);
        res.status(500).json({
          error: 'Login Error',
          message: err.message || 'An unexpected error occurred during login.',
        });
        return;
      }
    }

    // ------------------------------------------------------------------------
    // CASE 2: Supabase Access Token / Session Authentication (when no email/pwd)
    // ------------------------------------------------------------------------
    if (token) {
      let authUser: any = null;
      try {
        authUser = await authenticateSupabaseToken(token);
      } catch (err: any) {
        console.log(`[AUTH] Token validation failed: ${err.message}`);
        res.status(401).json({
          error: 'Unauthorized',
          message: err.message || 'Invalid or expired Supabase authentication token.',
        });
        return;
      }

      const authUid = authUser.id;
      console.log(`[AUTH] Token validated successfully for auth.uid: ${authUid}`);

      const fullName =
        (authUser.user_metadata?.full_name as string) ||
        (authUser.user_metadata?.name as string) ||
        authUser.email?.split('@')[0] ||
        'Obsidian User';

      try {
        const dbUser = await dataStore.upsertUser({
          id: authUid,
          email: authUser.email || `${authUid}@supabase.user`,
          full_name: fullName,
          avatar_url: authUser.user_metadata?.avatar_url || null,
        });

        console.log(`[AUTH] User account synchronized for auth.uid: ${authUid}`);

        res.status(200).json({
          message: 'Login successful',
          user: dbUser,
          token,
          session: {
            access_token: token,
            token_type: 'bearer',
            user: dbUser,
          },
        });
        return;
      } catch (dbErr: any) {
        console.error(`[AUTH] Database error during token login: ${dbErr.message}`);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to synchronize user account data.',
        });
        return;
      }
    }

    // ------------------------------------------------------------------------
    // CASE 3: Neither Valid Token nor Credentials Provided
    // ------------------------------------------------------------------------
    console.log('[AUTH] Login rejected: Missing credentials and missing Bearer token');
    res.status(400).json({
      error: 'Bad Request',
      message: 'Authentication requires either a Bearer access_token or email and password.',
    });
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    user: req.currentUser,
  });
});

/**
 * POST /api/auth/sync
 * Resolves Supabase Auth user to database user profile
 */
router.post('/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.currentUser;
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authenticated user to synchronize.',
      });
      return;
    }

    const dbUser = await dataStore.upsertUser({
      id: user.id,
      email: user.email,
      full_name: user.full_name || null,
      avatar_url: user.avatar_url || null,
      role: user.role || 'merchant',
    });

    res.status(200).json({
      message: 'User synchronized successfully',
      user: dbUser,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Sync Error',
      message: err.message || 'An error occurred while synchronizing user profile.',
    });
  }
});

const updatePasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

/**
 * POST /api/auth/update-password
 * Updates the password for the authenticated user
 */
router.post(
  '/update-password',
  requireAuth,
  validateRequest({ body: updatePasswordSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { password } = req.body;

    if (!isLiveSupabaseConfigured()) {
      res.status(200).json({
        success: true,
        message: 'Password updated successfully (offline / development mode)',
      });
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        res.status(400).json({
          error: 'Password Update Failed',
          message: error.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Password updated successfully',
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Password Update Error',
        message: err.message || 'An unexpected error occurred while updating password.',
      });
    }
  }
);

export default router;
