import { createApp } from '../src/app.js';
import { authenticateSupabaseToken } from '../src/services/supabaseAuth.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Server } from 'http';

dotenv.config();

async function runAuthVerificationSuite() {
  console.log('🧪 Starting Supabase Auth & Protected Routes Verification Suite...\n');

  const app = createApp();
  let server: Server;
  const testPort = 5055;
  const baseUrl = `http://localhost:${testPort}`;

  await new Promise<void>((resolve) => {
    server = app.listen(testPort, () => {
      resolve();
    });
  });

  let passCount = 0;
  let failCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passCount++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failCount++;
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://vrgendezcvpzjuhcuhfo.supabase.co';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let userId = '';
  let accessToken = '';
  let refreshToken = '';
  let storeId = '';

  try {
    // 1. Sign up user
    await test('1. User sign up via Supabase Auth creates user and obtains tokens', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: { full_name: 'Auth Verification Merchant' },
        },
      });

      if (error || !data.user || !data.session) {
        throw new Error(error?.message || 'Failed to sign up');
      }

      userId = data.user.id;
      accessToken = data.session.access_token;
      refreshToken = data.session.refresh_token;

      if (!userId || !accessToken || !refreshToken) {
        throw new Error('Missing token or user id');
      }
    });

    // 2. Token verification
    await test('2. authenticateSupabaseToken verifies ES256/JWKS token locally', async () => {
      const user = await authenticateSupabaseToken(accessToken);
      if (user.id !== userId) {
        throw new Error(`Expected user ID ${userId}, got ${user.id}`);
      }
    });

    // 3. GET /api/account/state
    await test('3. GET /api/account/state succeeds with 200 OK using Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      if (!data.success || data.user.id !== userId) {
        throw new Error(`Invalid response data: ${JSON.stringify(data)}`);
      }
    });

    // 4. GET /api/stores/me
    await test('4. GET /api/stores/me returns 200 and provisions/retrieves default store', async () => {
      const res = await fetch(`${baseUrl}/api/stores/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      if (!Array.isArray(data.stores) || data.stores.length === 0) {
        throw new Error(`Expected stores array: ${JSON.stringify(data)}`);
      }
      storeId = data.stores[0].id;
    });

    // 5. GET /api/stores/:id/analytics?timeframe=weekly
    await test('5. GET /api/stores/:id/analytics?timeframe=weekly returns 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/analytics?timeframe=weekly`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      if (!data.success || !data.analytics) {
        throw new Error(`Expected analytics object: ${JSON.stringify(data)}`);
      }
    });

    // 6. Refresh token flow
    await test('6. supabase.auth.refreshSession refreshes token and new token is accepted', async () => {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error || !data.session) {
        throw new Error(error?.message || 'Refresh failed');
      }
      const newAccessToken = data.session.access_token;
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: `Bearer ${newAccessToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Refreshed token rejected with ${res.status}`);
      }
    });

    // 7. Case-insensitive bearer
    await test('7. Case-insensitive "bearer <token>" header is accepted', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: `bearer ${accessToken}` },
      });
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}`);
      }
    });

    // 8. Unauthenticated GET /api/account/state strictly returns 401
    await test('8. Unauthenticated request to /api/account/state returns 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`);
      if (res.status !== 401) {
        throw new Error(`Expected 401, got ${res.status}`);
      }
      const data = await res.json();
      if (data.error !== 'Unauthorized') {
        throw new Error(`Expected error 'Unauthorized', got ${data.error}`);
      }
    });

    // 9. Unauthenticated GET /api/stores/me strictly returns 401
    await test('9. Unauthenticated request to /api/stores/me returns 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/stores/me`);
      if (res.status !== 401) {
        throw new Error(`Expected 401, got ${res.status}`);
      }
    });

    // 10. Unauthenticated GET /api/stores/:id/analytics strictly returns 401
    await test('10. Unauthenticated request to /api/stores/:id/analytics returns 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/analytics?timeframe=weekly`);
      if (res.status !== 401) {
        throw new Error(`Expected 401, got ${res.status}`);
      }
    });

    // 11. Invalid token returns 401
    await test('11. Invalid / tampered token strictly returns 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: 'Bearer fake-invalid-token' },
      });
      if (res.status !== 401) {
        throw new Error(`Expected 401, got ${res.status}`);
      }
      const data = await res.json();
      if (data.message !== 'Invalid or expired Supabase authentication token.') {
        throw new Error(`Expected invalid token message, got ${data.message}`);
      }
    });

    // 12. Expired token returns 401
    await test('12. Expired token strictly returns 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: 'Bearer test-expired-token' },
      });
      if (res.status !== 401) {
        throw new Error(`Expected 401, got ${res.status}`);
      }
    });

    // 13. Direct check against Live Render Deployment with genuine token
    await test('13. Live Render Backend accepts valid Supabase token (200 OK)', async () => {
      const liveRes = await fetch('https://hacknex-obsidian06.onrender.com/api/account/state', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (liveRes.status !== 200) {
        throw new Error(`Live Render returned ${liveRes.status}: ${await liveRes.text()}`);
      }
      const liveData = await liveRes.json();
      if (!liveData.success) {
        throw new Error(`Live Render response error: ${JSON.stringify(liveData)}`);
      }
    });

    // 14. Live Render Backend strictly rejects unauthenticated request (401 Unauthorized)
    await test('14. Live Render Backend strictly rejects unauthenticated request (401)', async () => {
      const liveRes = await fetch('https://hacknex-obsidian06.onrender.com/api/account/state');
      if (liveRes.status !== 401) {
        throw new Error(`Expected 401 from live Render, got ${liveRes.status}`);
      }
    });

  } finally {
    server.close();
  }

  console.log(`\n=============================================================`);
  console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`=============================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runAuthVerificationSuite();
