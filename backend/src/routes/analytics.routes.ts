import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { verifyStoreOwnership } from '../middleware/storeOwnership.js';
import { validateRequest } from '../middleware/validate.js';
import { dataStore } from '../services/dataStore.js';
import { analyticsService } from '../services/analyticsService.js';

const router = Router({ mergeParams: true });

const analyticsQuerySchema = z.object({
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional().default('monthly'),
});

/**
 * GET /api/stores/:id/analytics
 * Computes live dashboard metrics directly from real orders and product records
 */
router.get(
  '/',
  requireAuth,
  verifyStoreOwnership,
  validateRequest({ query: analyticsQuerySchema }),
  async (req, res, next) => {
    try {
      const storeId = req.params.id;
      const { timeframe } = req.query as { timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' };

      const orders = await dataStore.getOrdersByStoreId(storeId);
      const products = await dataStore.getProductsByStoreId(storeId);

      const analytics = analyticsService.calculateAnalytics(orders, products, timeframe);

      res.status(200).json({
        success: true,
        analytics,
        ...analytics,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
