import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { syncService } from '../services/syncService.js';

const router = Router();

/**
 * GET /api/account/state
 * Retrieves the complete unified dashboard state for the authenticated user.
 */
router.get('/state', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.currentUser!;
    const state = await syncService.getDashboardState(user);
    res.status(200).json({
      success: true,
      ...state,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/account/state
 * Synchronizes full store settings, product catalog, and orders idempotently.
 */
router.put('/state', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.currentUser!;
    const state = await syncService.importLocalState(user, req.body);
    res.status(200).json({
      success: true,
      message: 'Dashboard state synchronized successfully',
      state,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/account/import-local-state
 * One-time migration endpoint from browser localStorage to permanent PostgreSQL storage.
 */
router.post('/import-local-state', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.currentUser!;
    const state = await syncService.importLocalState(user, req.body);
    res.status(200).json({
      success: true,
      message: 'Local storage data imported successfully into Supabase',
      state,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
