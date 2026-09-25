import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { verifyStoreOwnership } from '../middleware/storeOwnership.js';
import { AuthenticatedRequest } from '../types/index.js';
import { realtimeService } from '../services/realtimeService.js';

const router = Router({ mergeParams: true });

/**
 * GET /api/stores/:id/realtime
 * Server-Sent Events (SSE) stream for live store updates
 */
router.get(
  '/',
  requireAuth,
  verifyStoreOwnership,
  (req: AuthenticatedRequest, res: Response) => {
    const storeId = req.params.id;

    // Configure SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    realtimeService.registerClient(storeId, res);

    // Keepalive heartbeat ping
    const keepaliveInterval = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepaliveInterval);
      realtimeService.unregisterClient(storeId, res);
    });
  }
);

export default router;
