import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validate.js';
import { AuthenticatedRequest, ProductRecord } from '../types/index.js';
import { dataStore } from '../services/dataStore.js';
import { geminiService } from '../services/geminiService.js';

const router = Router();

const chatMessageSchema = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4000 characters'),
  conversation_id: z
    .string()
    .uuid('Invalid conversation_id format: expected valid UUID')
    .optional()
    .nullable(),
});

/**
 * POST /api/chat
 * Primary endpoint for AI Chatbot interactions.
 * Authenticates user via Supabase JWT, scopes context to user's own store,
 * persists conversation history, and invokes Google Gemini.
 */
router.post(
  '/',
  requireAuth,
  chatRateLimiter,
  validateRequest({ body: chatMessageSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const { message, conversation_id } = req.body as {
        message: string;
        conversation_id?: string | null;
      };

      let conversationId = conversation_id || null;
      let conversation: any = null;

      // If conversation_id is provided, verify it strictly belongs to authenticated user
      if (conversationId) {
        conversation = await dataStore.getChatConversationById(conversationId, userId);

        if (!conversation) {
          // Check if conversation exists under another user to distinguish 403 Forbidden vs 404 Not Found
          const anyUserConv = await dataStore.getChatConversationAnyUser(conversationId);
          if (anyUserConv) {
            res.status(403).json({
              error: 'Forbidden',
              message: 'Conversation does not belong to user.',
            });
            return;
          }
          res.status(404).json({
            error: 'Not Found',
            message: 'Conversation not found.',
          });
          return;
        }
      } else {
        // Create new conversation for this user
        const autoTitle = message.length > 50 ? `${message.slice(0, 47)}...` : message;
        conversation = await dataStore.createChatConversation(userId, autoTitle);
        conversationId = conversation.id;
      }

      // Fetch recent conversation history strictly for this user and conversation
      const history = await dataStore.getChatMessages(conversationId!, userId, 14);

      // Retrieve only the authenticated user's store and product data as grounding context
      const stores = await dataStore.getStoresByUserId(userId);
      const productsByStore = new Map<string, ProductRecord[]>();

      for (const store of stores) {
        try {
          const products = await dataStore.getProductsByStoreId(store.id);
          productsByStore.set(store.id, products);
        } catch (fetchErr: any) {
          console.warn(`[Chat] Non-critical warning fetching products for store ${store.id}:`, fetchErr.message);
        }
      }

      // Call Google Gemini via backend service
      let reply: string;
      try {
        reply = await geminiService.generateChatReply({
          message,
          history,
          stores,
          productsByStore,
        });
      } catch (geminiErr: any) {
        console.error('[Chat] Gemini generation error:', geminiErr.message);
        res.status(502).json({
          error: 'AI Service Unavailable',
          message: 'Unable to process your message right now. Please try again shortly.',
        });
        return;
      }

      // Persist messages in database (user query and AI assistant response)
      try {
        await dataStore.addChatMessage(conversationId!, userId, 'user', message);
        await dataStore.addChatMessage(conversationId!, userId, 'assistant', reply);
      } catch (saveErr: any) {
        console.warn('[Chat] Non-critical warning persisting chat messages:', saveErr.message);
      }

      res.status(200).json({
        reply,
        conversation_id: conversationId,
      });
    } catch (err: any) {
      console.error('[Chat] Unexpected error in POST /api/chat:', err.message);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing your request.',
      });
    }
  }
);

/**
 * GET /api/chat/conversations
 * Lists all chat conversations belonging strictly to the authenticated user.
 */
router.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUser!.id;
    const conversations = await dataStore.getChatConversationsByUserId(userId);
    res.status(200).json({ conversations });
  } catch (err: any) {
    res.status(500).json({
      error: 'Database Error',
      message: 'Failed to fetch conversations.',
    });
  }
});

/**
 * GET /api/chat/conversations/:id/messages
 * Retrieves message history for a specific conversation belonging to the authenticated user.
 */
router.get('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.currentUser!.id;
    const conversationId = req.params.id;

    const conversation = await dataStore.getChatConversationById(conversationId, userId);
    if (!conversation) {
      const anyUserConv = await dataStore.getChatConversationAnyUser(conversationId);
      if (anyUserConv) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Conversation does not belong to user.',
        });
        return;
      }
      res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found.',
      });
      return;
    }

    const messages = await dataStore.getChatMessages(conversationId, userId, 50);
    res.status(200).json({
      conversation,
      messages,
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Database Error',
      message: 'Failed to fetch conversation messages.',
    });
  }
});

export default router;
