import { Router } from 'express';
import chatRoutes from './chat.routes.js';

/**
 * AI Routes
 * Primary router for AI services in Obsidian.
 * Mounts the AI chat assistant handlers.
 * 
 * Endpoints:
 * - POST /api/ai/chat (Primary assistant conversation endpoint)
 * - POST /api/ai      (Direct alias)
 */
const router = Router();

// Route: POST /api/ai/chat (and /api/ai/chat/)
router.use('/chat', chatRoutes);

// Route alias: POST /api/ai
router.use('/', chatRoutes);

export default router;
