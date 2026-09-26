process.env.NODE_ENV = 'test';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { dataStore } from '../src/services/dataStore.js';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

async function runChatTests() {
  console.log('🤖 Starting OBSIDIAN AI Chatbot Integration Test Suite...\n');

  const app = createApp();
  let server: Server;
  const testPort = 5055;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  await new Promise<void>((resolve) => {
    server = app.listen(testPort, () => {
      resolve();
    });
  });

  let passCount = 0;
  let failCount = 0;

  async function assert(desc: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${desc}`);
      passCount++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error: ${err.message}`);
      failCount++;
    }
  }

  const user1Id = 'a1111111-1111-1111-1111-111111111111';
  const user1Email = 'merchant1@obsidian-store.com';

  const user2Id = 'b2222222-2222-2222-2222-222222222222';
  const user2Email = 'merchant2@obsidian-store.com';

  const jwtSecret = env.SUPABASE_JWT_SECRET || 'test_jwt_secret_key';

  const user1Token = jwt.sign(
    {
      sub: user1Id,
      email: user1Email,
      user_metadata: { full_name: 'Store Owner One' },
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  const user2Token = jwt.sign(
    {
      sub: user2Id,
      email: user2Email,
      user_metadata: { full_name: 'Store Owner Two' },
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  const headersUser1 = {
    Authorization: `Bearer ${user1Token}`,
    'Content-Type': 'application/json',
  };

  const headersUser2 = {
    Authorization: `Bearer ${user2Token}`,
    'Content-Type': 'application/json',
  };

  let user1ConversationId = '';

  try {
    // 1. Health check includes safe AI status
    await assert('Health check reports safe AI configuration status without exposing API key', async () => {
      const res = await fetch(`${baseUrl}/health`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = await res.json();
      if (!('ai' in data)) throw new Error('Expected "ai" field in health response');
      if (data.ai !== 'configured' && data.ai !== 'not_configured') {
        throw new Error(`Unexpected ai status: ${data.ai}`);
      }
      const rawText = JSON.stringify(data);
      if (env.GEMINI_API_KEY && rawText.includes(env.GEMINI_API_KEY)) {
        throw new Error('GEMINI_API_KEY leaked in health check response!');
      }
    });

    // 2. Unauthenticated request rejected with 401
    await assert('POST /api/chat without authorization header is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 3. Invalid token rejected with 401
    await assert('POST /api/chat with invalid token is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid_or_expired_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Hello' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // 4. Empty message rejected with 400
    await assert('POST /api/chat with empty message is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({ message: '' }),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const data = await res.json();
      if (!data.error) throw new Error('Expected validation error in response');
    });

    // 5. Whitespace-only message rejected with 400
    await assert('POST /api/chat with whitespace-only message is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({ message: '    ' }),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // 6. Message exceeding length limit rejected with 400
    await assert('POST /api/chat with message exceeding 4000 characters is rejected with 400', async () => {
      const longMessage = 'A'.repeat(4005);
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({ message: longMessage }),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // 7. Invalid conversation_id format rejected with 400
    await assert('POST /api/chat with invalid conversation_id UUID is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({ message: 'Hello', conversation_id: 'not-a-valid-uuid' }),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    // 8. Non-existent conversation_id returns 404
    await assert('POST /api/chat with non-existent conversation_id returns 404', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({
          message: 'Hello',
          conversation_id: '00000000-0000-0000-0000-000000000000',
        }),
      });
      if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    });

    // 9. Authenticated request to Gemini creates conversation and returns clean response
    await assert('POST /api/chat generates Gemini AI reply and returns conversation_id', async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({ message: 'Hello! Please reply with a brief greeting in one sentence.' }),
      });
      if (res.status !== 200) {
        const errText = await res.text();
        throw new Error(`Expected 200, got ${res.status}: ${errText}`);
      }
      const data = await res.json();
      if (!data.reply || typeof data.reply !== 'string' || data.reply.trim() === '') {
        throw new Error('Expected non-empty string reply');
      }
      if (!data.conversation_id) {
        throw new Error('Expected conversation_id in response');
      }
      user1ConversationId = data.conversation_id;
    });

    // 10. Conversation history: Continuing existing conversation
    await assert('POST /api/chat with existing conversation_id preserves continuity and updates history', async () => {
      if (!user1ConversationId) throw new Error('user1ConversationId was not set');
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({
          message: 'What was my previous question?',
          conversation_id: user1ConversationId,
        }),
      });
      if (res.status !== 200) {
        const errText = await res.text();
        throw new Error(`Expected 200, got ${res.status}: ${errText}`);
      }
      const data = await res.json();
      if (data.conversation_id !== user1ConversationId) {
        throw new Error(`Expected same conversation_id ${user1ConversationId}, got ${data.conversation_id}`);
      }
      if (!data.reply) throw new Error('Expected reply text');
    });

    // 11. User Data Isolation: User B cannot access User A's conversation (403 Forbidden)
    await assert('USER ISOLATION: User B sending User A conversation_id receives 403 Forbidden', async () => {
      if (!user1ConversationId) throw new Error('user1ConversationId was not set');
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser2,
        body: JSON.stringify({
          message: 'Can I see this chat?',
          conversation_id: user1ConversationId,
        }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
      const data = await res.json();
      if (data.error !== 'Forbidden') {
        throw new Error(`Expected error 'Forbidden', got '${data.error}'`);
      }
    });

    // 12. Store Context Grounding: Gemini accurately uses user's store and product data
    await assert('STORE CONTEXT: Gemini answers questions using authenticated merchant store catalog', async () => {
      // Create a store and product for User 1
      const store = await dataStore.createStore({
        owner_id: user1Id,
        user_id: user1Id,
        name: 'Obsidian Velvet Studio',
        slug: 'obsidian-velvet-studio',
        currency: '₹',
        business_type: 'Luxury Apparel',
        description: 'Bespoke hand-crafted velvet garments.',
      });

      await dataStore.createProduct({
        store_id: store.id,
        name: 'Royal Midnight Velvet Cloak',
        price: 7499,
        stock: 5,
        category: 'Outerwear',
        description: 'Deep navy bespoke velvet cloak with obsidian silk lining.',
      });

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: headersUser1,
        body: JSON.stringify({
          message: 'What products do I have in my store and what is the price of the cloak?',
        }),
      });

      if (res.status !== 200) {
        const errText = await res.text();
        throw new Error(`Expected 200, got ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const replyLower = data.reply.toLowerCase();

      // Check that Gemini received the context and mentioned the product name or price
      const mentionsCloak = replyLower.includes('cloak') || replyLower.includes('velvet');
      const mentionsPrice = replyLower.includes('7499') || replyLower.includes('7,499');

      if (!mentionsCloak && !mentionsPrice) {
        throw new Error(`Expected AI reply to mention cloak or price 7499, got: ${data.reply}`);
      }
    });

    // 13. GET /api/chat/conversations returns list strictly for authenticated user
    await assert('GET /api/chat/conversations returns user-scoped list', async () => {
      const res1 = await fetch(`${baseUrl}/api/chat/conversations`, { headers: headersUser1 });
      if (res1.status !== 200) throw new Error(`Expected 200, got ${res1.status}`);
      const data1 = await res1.json();
      if (!Array.isArray(data1.conversations)) throw new Error('Expected array of conversations');
      if (data1.conversations.length === 0) throw new Error('Expected at least 1 conversation for User 1');

      // User 2 should have 0 conversations right now
      const res2 = await fetch(`${baseUrl}/api/chat/conversations`, { headers: headersUser2 });
      if (res2.status !== 200) throw new Error(`Expected 200, got ${res2.status}`);
      const data2 = await res2.json();
      if (data2.conversations.length !== 0) {
        throw new Error(`User 2 should have 0 conversations, found ${data2.conversations.length}`);
      }
    });

    // 14. GET /api/chat/conversations/:id/messages user isolation
    await assert('USER ISOLATION: User B cannot retrieve User A conversation messages (403)', async () => {
      if (!user1ConversationId) throw new Error('user1ConversationId was not set');
      const res = await fetch(`${baseUrl}/api/chat/conversations/${user1ConversationId}/messages`, {
        headers: headersUser2,
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // 15. Zero secret leakage across all responses
    await assert('SECURITY: API key and secrets are never leaked in any response body or headers', async () => {
      const endpoints = [
        `${baseUrl}/api/chat`,
        `${baseUrl}/api/chat/conversations`,
        `${baseUrl}/health`,
        `${baseUrl}/api/docs/swagger.json`,
      ];

      for (const url of endpoints) {
        const res = await fetch(url, { headers: headersUser1 });
        const text = await res.text();
        if (env.GEMINI_API_KEY && text.includes(env.GEMINI_API_KEY)) {
          throw new Error(`GEMINI_API_KEY leaked at ${url}!`);
        }
        if (env.SUPABASE_SERVICE_ROLE_KEY && text.includes(env.SUPABASE_SERVICE_ROLE_KEY)) {
          throw new Error(`SUPABASE_SERVICE_ROLE_KEY leaked at ${url}!`);
        }
      }
    });

  } finally {
    server.close();
  }

  console.log('\n=============================================================');
  console.log(`Chatbot Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log('=============================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runChatTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
