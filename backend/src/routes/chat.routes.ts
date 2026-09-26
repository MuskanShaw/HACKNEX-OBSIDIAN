import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeToken, authenticateSupabaseToken } from '../services/supabaseAuth.js';
import { chatRateLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validate.js';
import { AuthenticatedRequest, ProductRecord } from '../types/index.js';
import { dataStore } from '../services/dataStore.js';
import { geminiService, ChatContextPayload } from '../services/geminiService.js';

const router = Router();

const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const rawToken = authHeader.split(' ')[1];
      const token = sanitizeToken(rawToken);
      if (token) {
        const authUser = await authenticateSupabaseToken(token);
        if (authUser && authUser.id) {
          req.currentUser = {
            id: authUser.id,
            email: authUser.email || `${authUser.id}@supabase.user`,
            full_name: (authUser.user_metadata?.full_name as string) || (authUser.user_metadata?.name as string) || null,
            role: authUser.role || 'merchant',
          };
          return next();
        }
      }
    } catch (err: any) {
      // If token was provided but failed verification (expired / invalid)
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Your session has expired. Please log in again.',
      });
      return;
    }
  }

  // Fallback guest session for unauthenticated visitors / tests
  req.currentUser = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'guest@obsidian.store',
    full_name: 'Store Owner',
    role: 'merchant',
  };
  next();
};

const chatMessageSchema = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4000 characters'),
  conversation_id: z.string().optional().nullable(),
  conversation: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      })
    )
    .optional()
    .nullable(),
  context: z
    .object({
      store: z.record(z.any()).optional().nullable(),
      products: z.array(z.any()).optional().nullable(),
      inventory: z.array(z.any()).optional().nullable(),
      orders: z.array(z.any()).optional().nullable(),
    })
    .optional()
    .nullable(),
});

/**
 * POST /api/ai/chat & POST /api/chat
 * Primary endpoint for AI Chatbot interactions.
 * Accepts user query, conversation history, and live store context.
 * Evaluates with Google Gemini and returns clean, helpful assistant responses.
 */
router.post(
  '/',
  optionalAuth,
  chatRateLimiter,
  validateRequest({ body: chatMessageSchema }),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const { message, conversation_id, conversation, context } = req.body as {
        message: string;
        conversation_id?: string | null;
        conversation?: Array<{ role: string; content: string }> | null;
        context?: ChatContextPayload | null;
      };

      let conversationId = conversation_id || null;

      // Prepare conversation history
      let history: Array<{ role: string; content: string }> = [];

      if (Array.isArray(conversation) && conversation.length > 0) {
        history = conversation.slice(-14);
      } else if (conversationId && userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          const dbHistory = await dataStore.getChatMessages(conversationId, userId, 14);
          history = dbHistory.map((m) => ({
            role: m.role,
            content: m.content,
          }));
        } catch (dbErr: any) {
          console.warn('[Chat] History fetch warning:', dbErr.message);
        }
      }

      // If user is authenticated, retrieve any database store products
      const stores = userId !== '00000000-0000-0000-0000-000000000000'
        ? await dataStore.getStoresByUserId(userId).catch(() => [])
        : [];
      const productsByStore = new Map<string, ProductRecord[]>();

      for (const store of stores) {
        try {
          const products = await dataStore.getProductsByStoreId(store.id);
          productsByStore.set(store.id, products);
        } catch {
          // Non-critical
        }
      }

      // Call Google Gemini via backend service
      let reply: string;
      try {
        reply = await geminiService.generateChatReply({
          message,
          history,
          context: context || undefined,
          stores,
          productsByStore,
        });
      } catch (geminiErr: any) {
        console.error('[Chat] Gemini generation error:', geminiErr.message);
        res.status(502).json({
          success: false,
          error: 'AI Service Unavailable',
          message: "Sorry, I'm having trouble responding right now. Please try again.",
        });
        return;
      }

      // Persist conversation if authenticated user
      if (userId !== '00000000-0000-0000-0000-000000000000') {
        try {
          if (!conversationId) {
            const autoTitle = message.length > 50 ? `${message.slice(0, 47)}...` : message;
            const newConv = await dataStore.createChatConversation(userId, autoTitle);
            conversationId = newConv.id;
          }
          if (conversationId) {
            await dataStore.addChatMessage(conversationId, userId, 'user', message);
            await dataStore.addChatMessage(conversationId, userId, 'assistant', reply);
          }
        } catch (saveErr: any) {
          console.warn('[Chat] Message persistence note:', saveErr.message);
        }
      }

      // Return unified response contract matching Section 4 specification
      res.status(200).json({
        success: true,
        message: reply,
        reply,
        conversation_id: conversationId,
      });
    } catch (err: any) {
      console.error('[Chat] Unexpected error in /api/ai/chat:', err.message);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: "Sorry, I'm having trouble responding right now. Please try again.",
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
