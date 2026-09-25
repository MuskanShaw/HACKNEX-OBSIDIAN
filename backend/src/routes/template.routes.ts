import { Router } from 'express';
import { templateService } from '../services/templateService.js';

const router = Router();

/**
 * GET /api/templates
 * Lists all available storefront UI templates
 */
router.get('/', (_req, res) => {
  const templates = templateService.getAllTemplates();
  res.status(200).json({ templates });
});

export default router;
