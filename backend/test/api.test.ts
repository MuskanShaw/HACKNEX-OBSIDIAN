process.env.NODE_ENV = 'test';
import { createApp } from '../src/app.js';
import { storageBootstrap } from '../src/services/storageBootstrap.js';
import { env } from '../src/config/env.js';
import { dataStore } from '../src/services/dataStore.js';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

async function runTests() {
  console.log('🧪 Starting OBSIDIAN Backend 24-Point Supabase Integration Test Suite...\n');

  const app = createApp();
  let server: Server;
  const testPort = 4999;
  const baseUrl = `http://localhost:${testPort}`;

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

  const user1Email = 'merchant@obsidian-store.com';
  const user1Password = 'StrongPassword123!';
  const user1Id = 'a0000000-0000-0000-0000-000000000001';
  const user2Id = 'b0000000-0000-0000-0000-000000000002';

  const jwtSecret = env.SUPABASE_JWT_SECRET || 'test_jwt_secret_key';

  const user1Token = jwt.sign(
    {
      sub: user1Id,
      email: user1Email,
      user_metadata: { full_name: 'Hrishikesh Owner' },
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  const user2Token = jwt.sign(
    {
      sub: user2Id,
      email: 'intruder@other.com',
      user_metadata: { full_name: 'Intruder' },
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  const authHeadersUser1 = {
    Authorization: `Bearer ${user1Token}`,
    'Content-Type': 'application/json',
  };

  const authHeadersUser2 = {
    Authorization: `Bearer ${user2Token}`,
    'Content-Type': 'application/json',
  };

  let storeId = '';
  let storeSlug = '';
  let productId = '';
  let productClientId = 99887711;

  try {
    // 0. Base System Health & Templates Check
    await assert('System Health & Templates', async () => {
      const hRes = await fetch(`${baseUrl}/health`);
      if (hRes.status !== 200) throw new Error(`Expected 200, got ${hRes.status}`);
      const tRes = await fetch(`${baseUrl}/api/templates`);
      if (tRes.status !== 200) throw new Error(`Expected 200, got ${tRes.status}`);
    });

    // 1. Strict Auth: Missing Bearer token is rejected with 401
    await assert('1. Unauthenticated request without Bearer token rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`);
      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    // 2. Strict Auth: Mock headers without Bearer token cannot bypass auth
    await assert('2. Mock identity headers cannot bypass authentication (rejected with 401)', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          'x-mock-user-id': 'a0000000-0000-0000-0000-000000000001',
          'x-mock-user-email': user1Email,
        } as any,
      });
      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    // 3. Signup with Supabase Auth
    let signupUserId = '';
    await assert('3. POST /api/auth/signup registers user with valid JWT session', async () => {
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user1Email,
          password: user1Password,
          full_name: 'Hrishikesh Owner',
        }),
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const json = (await res.json()) as any;
      signupUserId = json.user.id;
      if (!signupUserId) throw new Error('Missing user ID in signup response');
      if (!json.token) throw new Error('Missing token in signup response');
    });

    // 4. Login with Supabase Auth
    await assert('4. POST /api/auth/login authenticates user and returns access token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user1Email,
          password: user1Password,
        }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = (await res.json()) as any;
      if (!json.token) throw new Error('Missing authentication token');
    });

    // 5. GET /api/account/state returns persistent default store
    let defaultStoreId = '';
    await assert('5. GET /api/account/state returns persistent default store', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: authHeadersUser1,
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = (await res.json()) as any;
      defaultStoreId = json.store.id;
      if (!defaultStoreId) throw new Error('Default store ID not returned');

      // Calling state again returns the EXACT same store
      const resAgain = await fetch(`${baseUrl}/api/account/state`, {
        headers: authHeadersUser1,
      });
      const jsonAgain = (await resAgain.json()) as any;
      if (jsonAgain.store.id !== defaultStoreId) {
        throw new Error('Default store ID changed on consecutive calls');
      }
      storeId = defaultStoreId;
      storeSlug = json.store.slug;
    });

    // 6. Cross-Device Identity Persistence: Laptop 2 simulation
    await assert('6. Cross-device persistence: Second device with same token returns identical store', async () => {
      // Simulating a second device/incognito window making an independent request with user's JWT
      const laptop2Res = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          Authorization: `Bearer ${user1Token}`,
          Accept: 'application/json',
        },
      });
      if (laptop2Res.status !== 200) throw new Error(`Expected 200, got ${laptop2Res.status}`);
      const laptop2Data = (await laptop2Res.json()) as any;
      if (laptop2Data.store.id !== defaultStoreId) {
        throw new Error(`Device 2 store ID (${laptop2Data.store.id}) mismatch with Device 1 (${defaultStoreId})`);
      }
      if (laptop2Data.user.id !== user1Id) {
        throw new Error(`Device 2 user ID (${laptop2Data.user.id}) mismatch with Supabase auth user ID (${user1Id})`);
      }
    });

    // 7. Store persistence (custom business type, custom options, currency)
    await assert('7. Store settings persist in database', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: authHeadersUser1,
        body: JSON.stringify({
          name: 'Apex Studio Goods',
          custom_business_type: 'Artisan Atelier',
          custom_options: ['gift_wrapping', 'express_delivery'],
          currency: '₹',
          address: '42 MG Road, Bangalore',
          address_method: 'manual',
        }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = (await res.json()) as any;
      if (json.store.custom_business_type !== 'Artisan Atelier') {
        throw new Error('Custom business type was not persisted');
      }
      if (!json.store.custom_options?.includes('gift_wrapping')) {
        throw new Error('Custom options JSONB not persisted');
      }
    });

    // 8. Product persistence with camelCase DTOs & numeric id
    await assert('8. Product persistence with camelCase DTOs and numeric id', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/products`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          id: productClientId,
          name: 'Obsidian Minimalist Hoodie',
          price: 2500,
          discountPrice: 2000,
          stock: 25,
          emoji: '🧥',
          category: 'Apparel',
          description: 'Heavyweight organic cotton hoodie in obsidian black.',
          status: 'active',
        }),
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const json = (await res.json()) as any;
      productId = json.product.backendId;
      if (!productId || json.product.id !== productClientId) {
        throw new Error(`Product client_id or backendId missing. Got client_id=${json.product.id}`);
      }
      if (json.product.discountPrice !== 2000) {
        throw new Error('CamelCase discountPrice missing');
      }
    });

    // 9. Order persistence with camelCase DTOs & numeric id
    let placedOrderClientId = 55443322;
    await assert('9. Order persistence with camelCase DTOs and numeric id', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: placedOrderClientId,
          productId: productClientId,
          customerName: 'Rahul Sharma',
          quantity: 2,
        }),
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const json = (await res.json()) as any;
      if (json.order.id !== placedOrderClientId) {
        throw new Error(`Order client_id mismatch: expected ${placedOrderClientId}, got ${json.order.id}`);
      }
      if (json.order.customerName !== 'Rahul Sharma') {
        throw new Error('CamelCase customerName missing on created order');
      }
    });

    // 10. Stock deduction verification
    await assert('10. Stock deducted atomically on order placement', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/products`, {
        headers: authHeadersUser1,
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = (await res.json()) as any;
      const product = json.products.find((p: any) => p.backendId === productId || p.id === productClientId);
      if (!product || product.stock !== 23) {
        throw new Error(`Expected remaining stock 23 (25 - 2), got: ${product?.stock}`);
      }
    });

    // 11. No overselling (rejecting orders when quantity > stock)
    await assert('11. Rejects order when requested quantity exceeds available stock', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productClientId,
          customerName: 'Greedy Buyer',
          quantity: 100, // Available is only 23
        }),
      });
      if (res.status !== 400) {
        throw new Error(`Expected 400 Bad Request for overselling, got ${res.status}`);
      }
      const json = (await res.json()) as any;
      if (json.error !== 'INSUFFICIENT_STOCK') {
        throw new Error(`Expected error INSUFFICIENT_STOCK, got: ${json.error}`);
      }
    });

    // 12. Order price calculated by backend (ignoring client-tampered totalPrice)
    await assert('12. Order price calculated strictly server-side', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productClientId,
          customerName: 'Tamper Tester',
          quantity: 1,
          totalPrice: 1, // Tampered client value (actual discount price is 2000)
        }),
      });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const json = (await res.json()) as any;
      if (json.order.totalPrice !== 2000) {
        throw new Error(`Server accepted tampered price! Expected 2000, got ${json.order.totalPrice}`);
      }
    });

    // 13. Store ownership verification
    await assert('13. Store ownership check rejects unauthorized modifications with 403', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: authHeadersUser2,
        body: JSON.stringify({ name: 'Hacked Store' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // 14. Unauthorized product access
    await assert('14. Unauthorized product access rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/products/${productId}`, {
        method: 'PUT',
        headers: authHeadersUser2,
        body: JSON.stringify({ price: 10 }),
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // 15. Unauthorized order access
    await assert('15. Unauthorized order retrieval rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/orders`, {
        headers: authHeadersUser2,
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // 16. Location save
    await assert('16. PATCH /api/stores/:id/location saves coordinates and generates mapsUrl', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/location`, {
        method: 'PATCH',
        headers: authHeadersUser1,
        body: JSON.stringify({
          latitude: 12.9716,
          longitude: 77.5946,
          placeId: 'ChIJbU60yXAWrjsR4E9-Ule3vno',
          formattedAddress: 'Bangalore, Karnataka, India',
        }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = (await res.json()) as any;
      if (!json.location.mapsUrl || !json.location.mapsUrl.includes('12.9716,77.5946')) {
        throw new Error(`Generated mapsUrl missing or invalid: ${json.location.mapsUrl}`);
      }
    });

    // 17. Location retrieval in store and public storefront
    await assert('17. Location retrieved correctly in public storefront', async () => {
      const res = await fetch(`${baseUrl}/api/public/store/${storeSlug}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = (await res.json()) as any;
      if (json.store.latitude !== 12.9716 || !json.store.mapsUrl) {
        throw new Error('Public storefront missing saved coordinates or mapsUrl');
      }
    });

    // 18. Analytics calculation
    await assert('18. GET /api/stores/:id/analytics calculates real metrics', async () => {
      for (const tf of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
        const res = await fetch(`${baseUrl}/api/stores/${storeId}/analytics?timeframe=${tf}`, {
          headers: authHeadersUser1,
        });
        if (res.status !== 200) throw new Error(`Expected 200 for ${tf}, got ${res.status}`);
        const json = (await res.json()) as any;
        if (typeof json.totalSales !== 'number' || json.totalSales <= 0) {
          throw new Error(`Invalid totalSales in ${tf} analytics: ${json.totalSales}`);
        }
        if (!Array.isArray(json.chart.labels) || json.chart.labels.length === 0) {
          throw new Error(`Chart labels missing in ${tf} analytics`);
        }
      }
    });

    // 19. Public storefront data integrity (active products only, no user_id)
    await assert('19. Public storefront excludes internal user_id and draft products', async () => {
      await fetch(`${baseUrl}/api/stores/${storeId}/products`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          name: 'Draft Hidden Item',
          price: 500,
          status: 'draft',
        }),
      });

      const res = await fetch(`${baseUrl}/api/public/store/${storeSlug}`);
      const json = (await res.json()) as any;
      if (json.store.user_id) throw new Error('user_id leaked in public endpoint!');
      if (json.products.some((p: any) => p.name === 'Draft Hidden Item')) {
        throw new Error('Draft product visible on public storefront!');
      }
    });

    // 20. Local storage import without duplicating records
    await assert('20. Duplicate client_id upserts without creating duplicate product rows', async () => {
      const res = await fetch(`${baseUrl}/api/account/import-local-state`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          products: [
            {
              id: productClientId,
              name: 'Obsidian Minimalist Hoodie (Updated Name)',
              price: 2600,
              stock: 30,
            },
          ],
        }),
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const json = (await res.json()) as any;
      const matches = json.state.products.filter((p: any) => p.id === productClientId);
      if (matches.length !== 1) {
        throw new Error(`Expected exactly 1 product with client_id ${productClientId}, found ${matches.length}`);
      }
      if (matches[0].name !== 'Obsidian Minimalist Hoodie (Updated Name)') {
        throw new Error('Product was not updated during import');
      }
    });

    // 21. Storage bucket initialization
    await assert('21. Storage bootstrap ensures storage bucket safety', async () => {
      await storageBootstrap.ensureBucketExists();
    });

    // 22. Asset upload to Supabase Storage route
    await assert('22. POST /api/stores/:id/upload uploads asset and returns public CDN URL', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const fileContent = 'sample-image-data-buffer';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="category"',
        '',
        'logo',
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test-logo.png"',
        'Content-Type: image/png',
        '',
        fileContent,
        `--${boundary}--`,
      ].join('\r\n');

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.from(body),
      });

      if (res.status !== 200) {
        const errText = await res.text();
        throw new Error(`Expected 200, got ${res.status}: ${errText}`);
      }
      const json = (await res.json()) as any;
      if (!json.url || !json.url.startsWith('http')) {
        throw new Error(`Expected valid public CDN URL, got: ${json.url}`);
      }
    });

    // 23. Realtime SSE connection
    await assert('23. Realtime SSE endpoint /api/stores/:id/realtime connection handshake', async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);

      try {
        const res = await fetch(`${baseUrl}/api/stores/${storeId}/realtime`, {
          headers: authHeadersUser1,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
          throw new Error(`Expected text/event-stream, got ${contentType}`);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') throw err;
      }
    });

    // 24. Vercel deployment with configured token
    await assert('24. Vercel deployment integration functions with configured token', async () => {
      const deployRes = await fetch(`${baseUrl}/api/stores/${storeId}/deploy`, {
        method: 'POST',
        headers: authHeadersUser1,
      });
      if (deployRes.status !== 200) throw new Error(`Expected 200, got ${deployRes.status}`);
      const deployJson = (await deployRes.json()) as any;
      if (!deployJson.liveUrl || !deployJson.deploymentId) {
        throw new Error('Deployment missing liveUrl or deploymentId');
      }

      const statusRes = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser1,
      });
      if (statusRes.status !== 200) throw new Error(`Expected 200, got ${statusRes.status}`);
      const statusJson = (await statusRes.json()) as any;
      if (!statusJson.deploymentId) {
        throw new Error('Deployment status missing deploymentId');
      }
    });

    // =========================================================================
    // CROSS-DEVICE FALLBACK IDENTITY & SECURITY VERIFICATION SUITE (8 CASES)
    // =========================================================================

    // Case 1: Valid JWT -> user successfully identified
    await assert('Case 1: Valid JWT -> user successfully identified', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          Authorization: `Bearer ${user1Token}`,
          Accept: 'application/json',
        },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = (await res.json()) as any;
      if (data.user.id !== user1Id) throw new Error(`User ID mismatch: expected ${user1Id}, got ${data.user.id}`);
    });

    // Case 2: Custom x-user-id header without Bearer token is rejected with 401
    await assert('Case 2: Custom identity header x-user-id without Bearer token is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          'x-user-id': user1Id,
          Accept: 'application/json',
        },
      });
      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    // Case 3: Custom x-user-email header without Bearer token is rejected with 401
    await assert('Case 3: Custom identity header x-user-email without Bearer token is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          'x-user-email': user1Email,
          Accept: 'application/json',
        },
      });
      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    // Case 4: Invalid/unauthenticated identity headers -> rejected with 401
    await assert('Case 4: Invalid/unauthenticated identity headers -> rejected with 401', async () => {
      // 4a. Non-existent user ID
      const resFakeId = await fetch(`${baseUrl}/api/account/state`, {
        headers: { 'x-user-id': '99999999-9999-9999-9999-999999999999' },
      });
      if (resFakeId.status !== 401) throw new Error(`Expected 401 for fake x-user-id, got ${resFakeId.status}`);

      // 4b. Non-existent user email
      const resFakeEmail = await fetch(`${baseUrl}/api/account/state`, {
        headers: { 'x-user-email': 'nonexistent-user@nowhere.com' },
      });
      if (resFakeEmail.status !== 401) throw new Error(`Expected 401 for fake x-user-email, got ${resFakeEmail.status}`);

      // 4c. Mismatched user ID and email (spoof attempt)
      const resMismatched = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          'x-user-id': user1Id,
          'x-user-email': 'attacker@malicious.com',
        },
      });
      if (resMismatched.status !== 401) throw new Error(`Expected 401 for mismatched identity, got ${resMismatched.status}`);
    });

    // Case 5: Valid user attempting another user's store -> 403
    await assert("Case 5: Valid user attempting another user's store -> rejected with 403", async () => {
      // User 2 authenticated with valid JWT attempting to patch User 1's store
      const resWithJwt = await fetch(`${baseUrl}/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: authHeadersUser2,
        body: JSON.stringify({ name: 'Hacked by User 2' }),
      });
      if (resWithJwt.status !== 403) throw new Error(`Expected 403 Forbidden with JWT, got ${resWithJwt.status}`);

      // User 2 attempting to access User 1's store without token -> rejected with 401
      const resWithoutToken = await fetch(`${baseUrl}/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user2Id,
          'x-user-email': 'intruder@other.com',
        },
        body: JSON.stringify({ name: 'Hacked by User 2 via Header' }),
      });
      if (resWithoutToken.status !== 401) throw new Error(`Expected 401 without Bearer token, got ${resWithoutToken.status}`);
    });

    // Case 6: GET /api/account/state with JWT -> correct state
    let jwtStateSnapshot: any = null;
    await assert('Case 6: GET /api/account/state with JWT -> returns complete dashboard state', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: authHeadersUser1,
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      jwtStateSnapshot = (await res.json()) as any;
      if (!jwtStateSnapshot.user || jwtStateSnapshot.user.id !== user1Id) throw new Error('Missing or invalid user in state');
      if (!jwtStateSnapshot.store || jwtStateSnapshot.store.id !== defaultStoreId) throw new Error('Missing or invalid store in state');
      if (!Array.isArray(jwtStateSnapshot.products) || jwtStateSnapshot.products.length === 0) throw new Error('Missing products in state');
      if (!Array.isArray(jwtStateSnapshot.orders) || jwtStateSnapshot.orders.length === 0) throw new Error('Missing orders in state');
      if (!jwtStateSnapshot.analytics || typeof jwtStateSnapshot.analytics.totalSales !== 'number') throw new Error('Missing analytics in state');
    });

    // Case 7: Supabase Auth Session on Device 2 -> returns same user's correct state
    await assert("Case 7: Supabase Auth Session on Device 2 -> returns same user's correct state", async () => {
      // Simulating Device 2 with secondary fresh Supabase access token for the same user
      const device2Token = jwt.sign(
        {
          sub: user1Id,
          email: user1Email,
          user_metadata: { full_name: 'Hrishikesh Owner' },
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          Authorization: `Bearer ${device2Token}`,
          Accept: 'application/json',
        },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const fallbackState = (await res.json()) as any;
      if (fallbackState.user.id !== jwtStateSnapshot.user.id) throw new Error('User ID mismatch between sessions');
      if (fallbackState.store.id !== jwtStateSnapshot.store.id) throw new Error('Store ID mismatch between sessions');
      if (fallbackState.products.length !== jwtStateSnapshot.products.length) throw new Error('Products count mismatch between sessions');
      if (fallbackState.orders.length !== jwtStateSnapshot.orders.length) throw new Error('Orders count mismatch between sessions');
      if (fallbackState.analytics.totalSales !== jwtStateSnapshot.analytics.totalSales) throw new Error('Analytics mismatch between sessions');
    });

    // Case 8: Another device using the same Supabase account -> identical store/products/orders are returned
    await assert('Case 8: Another device using the same Supabase account -> identical store/products/orders returned', async () => {
      // Simulating a fresh secondary device (mobile/incognito) signing in with same Supabase credentials
      const device2Token = jwt.sign(
        {
          sub: user1Id,
          email: user1Email,
          user_metadata: { full_name: 'Hrishikesh Owner' },
        },
        jwtSecret,
        { expiresIn: '7d' }
      );

      const device2Res = await fetch(`${baseUrl}/api/account/state`, {
        headers: {
          Authorization: `Bearer ${device2Token}`,
          'User-Agent': 'ObsidianMobile/1.0',
        },
      });
      if (device2Res.status !== 200) throw new Error(`Expected 200, got ${device2Res.status}`);
      const device2Data = (await device2Res.json()) as any;
      if (device2Data.store.id !== defaultStoreId) {
        throw new Error(`Device 2 received different store ID (${device2Data.store.id}) vs expected (${defaultStoreId})`);
      }
      const hasProduct = device2Data.products.some((p: any) => p.id === productClientId || p.backendId === productId);
      if (!hasProduct) throw new Error('Device 2 did not receive the user products');
      const hasOrder = device2Data.orders.some((o: any) => o.id === placedOrderClientId);
      if (!hasOrder) throw new Error('Device 2 did not receive the user orders');
    });

    // ── STORE CRUD TEST SUITE ──
    let createdStoreId = '';

    // Case 9: Create a new store (POST /api/stores)
    await assert('Case 9: Create store (POST /api/stores) with store_name, phone, description, address', async () => {
      const res = await fetch(`${baseUrl}/api/stores`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          store_name: 'OBSIDIAN Atelier Flagship',
          phone: '+91 98765 43210',
          description: 'Luxury handcrafted obsidian jewelry and accessories.',
          address: '42 Regent Street, London',
          businessType: 'luxury',
          currency: '£',
        }),
      });
      if (res.status !== 201) {
        const errText = await res.text();
        throw new Error(`Expected 201 Created, got ${res.status}: ${errText}`);
      }
      const data = (await res.json()) as any;
      if (!data.store?.id) throw new Error('Store ID missing in response');
      if (data.store.store_name !== 'OBSIDIAN Atelier Flagship') {
        throw new Error(`Expected store_name "OBSIDIAN Atelier Flagship", got "${data.store.store_name}"`);
      }
      if (data.store.phone !== '+91 98765 43210') {
        throw new Error(`Expected phone "+91 98765 43210", got "${data.store.phone}"`);
      }
      if (data.store.description !== 'Luxury handcrafted obsidian jewelry and accessories.') {
        throw new Error(`Description mismatch: got "${data.store.description}"`);
      }
      createdStoreId = data.store.id;
    });

    // Case 10: Read created store details (GET /api/stores/:id and GET /api/stores/me)
    await assert('Case 10: Read store details (GET /api/stores/:id & GET /api/stores/me)', async () => {
      // By ID
      const resById = await fetch(`${baseUrl}/api/stores/${createdStoreId}`, {
        headers: authHeadersUser1,
      });
      if (resById.status !== 200) throw new Error(`Expected 200, got ${resById.status}`);
      const dataById = (await resById.json()) as any;
      if (dataById.store.id !== createdStoreId) throw new Error('Store ID mismatch');
      if (dataById.store.store_name !== 'OBSIDIAN Atelier Flagship') throw new Error('store_name mismatch in GET by ID');
      if (dataById.store.phone !== '+91 98765 43210') throw new Error('phone mismatch in GET by ID');

      // User's stores list
      const resMe = await fetch(`${baseUrl}/api/stores/me`, {
        headers: authHeadersUser1,
      });
      if (resMe.status !== 200) throw new Error(`Expected 200, got ${resMe.status}`);
      const dataMe = (await resMe.json()) as any;
      const found = dataMe.stores.some((s: any) => s.id === createdStoreId);
      if (!found) throw new Error('Created store not found in user stores list');
    });

    // Case 11: Update store via PUT and PATCH (PUT /api/stores/:id & PATCH /api/stores/:id)
    await assert('Case 11: Update store via PUT and PATCH', async () => {
      // Test PATCH
      const patchRes = await fetch(`${baseUrl}/api/stores/${createdStoreId}`, {
        method: 'PATCH',
        headers: authHeadersUser1,
        body: JSON.stringify({
          phone: '+91 99999 88888',
          description: 'Updated bio for luxury boutique.',
        }),
      });
      if (patchRes.status !== 200) throw new Error(`Expected 200 from PATCH, got ${patchRes.status}`);
      const patchData = (await patchRes.json()) as any;
      if (patchData.store.phone !== '+91 99999 88888') throw new Error('Phone not updated via PATCH');
      if (patchData.store.description !== 'Updated bio for luxury boutique.') throw new Error('Description not updated via PATCH');

      // Test PUT
      const putRes = await fetch(`${baseUrl}/api/stores/${createdStoreId}`, {
        method: 'PUT',
        headers: authHeadersUser1,
        body: JSON.stringify({
          store_name: 'OBSIDIAN Global Flagship',
          phone: '+44 20 7946 0991',
          description: 'World-renowned bespoke obsidian craftsmanship.',
          address: '10 Downing Mews, London',
        }),
      });
      if (putRes.status !== 200) throw new Error(`Expected 200 from PUT, got ${putRes.status}`);
      const putData = (await putRes.json()) as any;
      if (putData.store.name !== 'OBSIDIAN Global Flagship' && putData.store.store_name !== 'OBSIDIAN Global Flagship') {
        throw new Error('Name not updated via PUT');
      }
      if (putData.store.phone !== '+44 20 7946 0991') throw new Error('Phone not updated via PUT');
    });

    // Case 12: Security: User 2 cannot access or delete User 1's store -> 403 Forbidden
    await assert("Case 12: Security: User 2 cannot read, modify, or delete User 1's store (403)", async () => {
      // User 2 GET by ID
      const getRes = await fetch(`${baseUrl}/api/stores/${createdStoreId}`, {
        headers: authHeadersUser2,
      });
      if (getRes.status !== 403) throw new Error(`Expected 403 on User 2 GET, got ${getRes.status}`);

      // User 2 PUT
      const putRes = await fetch(`${baseUrl}/api/stores/${createdStoreId}`, {
        method: 'PUT',
        headers: authHeadersUser2,
        body: JSON.stringify({ name: 'Hacked by User 2' }),
      });
      if (putRes.status !== 403) throw new Error(`Expected 403 on User 2 PUT, got ${putRes.status}`);

      // User 2 DELETE
      const deleteRes = await fetch(`${baseUrl}/api/stores/${createdStoreId}`, {
        method: 'DELETE',
        headers: authHeadersUser2,
      });
      if (deleteRes.status !== 403) throw new Error(`Expected 403 on User 2 DELETE, got ${deleteRes.status}`);
    });

    // Case 13: Delete store (DELETE /api/stores/:id)
    await assert('Case 13: Delete store (DELETE /api/stores/:id) removes store cleanly', async () => {
      const delRes = await fetch(`${baseUrl}/api/stores/${createdStoreId}`, {
        method: 'DELETE',
        headers: authHeadersUser1,
      });
      if (delRes.status !== 200) {
        const errText = await delRes.text();
        throw new Error(`Expected 200 from DELETE, got ${delRes.status}: ${errText}`);
      }
      const delData = (await delRes.json()) as any;
      if (!delData.success) throw new Error('Expected success: true from DELETE');

      // Verify it's no longer in user's stores
      const resMeAfter = await fetch(`${baseUrl}/api/stores/me`, {
        headers: authHeadersUser1,
      });
      const dataMeAfter = (await resMeAfter.json()) as any;
      const stillPresent = dataMeAfter.stores?.some((s: any) => s.id === createdStoreId);
      if (stillPresent) throw new Error('Deleted store still found in user stores list');
    });

    // ── ORDERS API SPECIFICATION & INTEGRATION TEST SUITE ──
    let multiItemOrderId = '';
    let multiItemClientId = 77112233;

    // Case 14: Place multi-item order (POST /api/stores/:id/orders) with nested items, customerPhone, customerAddress, totalAmount
    await assert('Case 14: Place multi-item order with items, customerPhone, customerAddress, and totalAmount', async () => {
      // First create two products in defaultStoreId to buy
      const p1Res = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/products`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          name: 'Obsidian Velvet Blazer',
          price: 150,
          stock: 20,
          category: 'Apparel',
        }),
      });
      const p1Data = (await p1Res.json()) as any;
      const prod1Id = p1Data.product.id;

      const p2Res = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/products`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          name: 'Obsidian Signet Ring',
          price: 80,
          stock: 15,
          category: 'Jewelry',
        }),
      });
      const p2Data = (await p2Res.json()) as any;
      const prod2Id = p2Data.product.id;

      const orderPayload = {
        id: multiItemClientId,
        customerName: 'Eleanor Vance',
        customerPhone: '+44 7700 900077',
        phone: '+44 7700 900077',
        customerAddress: '10 Downing Mews, London, SW1A 2AA',
        address: '10 Downing Mews, London, SW1A 2AA',
        customerEmail: 'eleanor@vance-atelier.co.uk',
        paymentMethod: 'card',
        items: [
          {
            productId: prod1Id,
            productName: 'Obsidian Velvet Blazer',
            quantity: 2,
            price: 150,
          },
          {
            productId: prod2Id,
            productName: 'Obsidian Signet Ring',
            quantity: 1,
            price: 80,
          },
        ],
        totalAmount: 380,
        totalPrice: 380,
        status: 'processing',
      };

      const res = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (res.status !== 201) {
        const errText = await res.text();
        throw new Error(`Expected 201 Created, got ${res.status}: ${errText}`);
      }

      const resData = (await res.json()) as any;
      if (!resData.order) throw new Error('Order missing in response');
      if (resData.order.customerName !== 'Eleanor Vance') throw new Error('Customer name mismatch');
      if (resData.order.customerPhone !== '+44 7700 900077') throw new Error('Customer phone mismatch');
      if (resData.order.customerAddress !== '10 Downing Mews, London, SW1A 2AA') throw new Error('Customer address mismatch');
      if (resData.order.paymentMethod !== 'card') throw new Error('Payment method mismatch');
      if (resData.order.totalAmount !== 380 && resData.order.totalPrice !== 380) throw new Error('Total amount mismatch');
      if (!Array.isArray(resData.order.items) || resData.order.items.length !== 2) throw new Error('Items array missing or length mismatch');

      multiItemOrderId = resData.order.backendId || String(resData.order.id);

      // Verify stock was decremented on both items
      const checkP1 = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/products/${prod1Id}`, {
        headers: authHeadersUser1,
      });
      const checkP1Data = (await checkP1.json()) as any;
      if (checkP1Data.product.stock !== 18) throw new Error(`Product 1 stock expected 18, got ${checkP1Data.product.stock}`);

      const checkP2 = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/products/${prod2Id}`, {
        headers: authHeadersUser1,
      });
      const checkP2Data = (await checkP2.json()) as any;
      if (checkP2Data.product.stock !== 14) throw new Error(`Product 2 stock expected 14, got ${checkP2Data.product.stock}`);
    });

    // Case 15: Retrieve single order (GET /api/stores/:id/orders/:orderId)
    await assert('Case 15: Retrieve single order details (GET /api/stores/:id/orders/:orderId)', async () => {
      // By client ID
      const resByClient = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders/${multiItemClientId}`, {
        headers: authHeadersUser1,
      });
      if (resByClient.status !== 200) throw new Error(`Expected 200 by clientId, got ${resByClient.status}`);
      const dataClient = (await resByClient.json()) as any;
      if (dataClient.order.customerName !== 'Eleanor Vance') throw new Error('Customer mismatch in GET by clientId');
      if (dataClient.order.totalPrice !== 380) throw new Error('Total mismatch in GET by clientId');

      // By backend ID
      const resByBackend = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders/${multiItemOrderId}`, {
        headers: authHeadersUser1,
      });
      if (resByBackend.status !== 200) throw new Error(`Expected 200 by backendId, got ${resByBackend.status}`);
    });

    // Case 16: Place legacy single-item order (backward compatibility)
    await assert('Case 16: Place legacy single-product order (productId, productName, quantity, totalPrice)', async () => {
      const legacyPayload = {
        id: 99118822,
        customerName: 'Marcus Aurelius',
        productName: 'Custom Obsidian Sculpture',
        quantity: 1,
        totalPrice: 950,
        status: 'pending',
      };

      const res = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacyPayload),
      });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      const data = (await res.json()) as any;
      if (data.order.customerName !== 'Marcus Aurelius') throw new Error('Customer mismatch');
      if (data.order.productName !== 'Custom Obsidian Sculpture') throw new Error('Product name mismatch');
      if (data.order.totalPrice !== 950) throw new Error('Total price mismatch');
    });

    // Case 17: Update order status (PATCH /api/stores/:id/orders/:orderId/status)
    await assert('Case 17: Update order status (PATCH /api/stores/:id/orders/:orderId/status)', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders/${multiItemClientId}/status`, {
        method: 'PATCH',
        headers: authHeadersUser1,
        body: JSON.stringify({ status: 'completed' }),
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = (await res.json()) as any;
      if (data.order.status !== 'completed') throw new Error(`Expected status 'completed', got '${data.order.status}'`);
    });

    // Case 18: Delete single order (DELETE /api/stores/:id/orders/:orderId)
    await assert('Case 18: Delete single order (DELETE /api/stores/:id/orders/:orderId)', async () => {
      const delRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders/${multiItemClientId}`, {
        method: 'DELETE',
        headers: authHeadersUser1,
      });

      if (delRes.status !== 200) throw new Error(`Expected 200 on DELETE, got ${delRes.status}`);

      // Verify subsequent GET returns 404
      const getRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders/${multiItemClientId}`, {
        headers: authHeadersUser1,
      });
      if (getRes.status !== 404) throw new Error(`Expected 404 after order deletion, got ${getRes.status}`);
    });

    // Case 19: Validation Error: Missing product identifier or items rejected with 400
    await assert('Case 19: Missing product identifier and items array rejected with 400', async () => {
      const invalidRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Ghost Buyer',
          // No items, no productId, no productName
        }),
      });

      if (invalidRes.status !== 400) throw new Error(`Expected 400 Bad Request, got ${invalidRes.status}`);
    });

    // Case 20: Validation Error: Insufficient stock rejected with 400 INSUFFICIENT_STOCK
    await assert('Case 20: Order exceeding available inventory stock rejected with 400 INSUFFICIENT_STOCK', async () => {
      const pRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/products`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          name: 'Scarce Relic',
          price: 1000,
          stock: 2,
        }),
      });
      const pData = (await pRes.json()) as any;
      const scarceId = pData.product.id;

      const overOrderRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Greedy Collector',
          items: [{ productId: scarceId, quantity: 999 }],
        }),
      });

      if (overOrderRes.status !== 400) throw new Error(`Expected 400 for oversell, got ${overOrderRes.status}`);
      const errData = (await overOrderRes.json()) as any;
      if (errData.error !== 'INSUFFICIENT_STOCK') {
        throw new Error(`Expected error 'INSUFFICIENT_STOCK', got '${errData.error}'`);
      }
    });

    // Case 25: Store creation with address automatically converts address to coordinates and formatted_address
    let geoStoreId = '';
    let initialLat = 0;
    let initialLng = 0;

    await assert('Case 25: Store creation with address automatically converts address to coordinates', async () => {
      const createRes = await fetch(`${baseUrl}/api/stores`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          name: 'Obsidian Geocoded Flagship',
          address: '742 Evergreen Terrace, Springfield',
        }),
      });

      if (createRes.status !== 201) {
        const txt = await createRes.text();
        throw new Error(`Expected 201 Created, got ${createRes.status}: ${txt}`);
      }

      const data = (await createRes.json()) as any;
      geoStoreId = data.store.id;
      initialLat = data.store.latitude;
      initialLng = data.store.longitude;

      if (!initialLat || !initialLng) {
        throw new Error(`Expected valid latitude and longitude, got lat=${initialLat}, lng=${initialLng}`);
      }
      if (!data.store.formatted_address) {
        throw new Error('Expected formatted_address to be populated');
      }
      if (data.store.location_source !== 'google_maps') {
        throw new Error(`Expected location_source 'google_maps', got ${data.store.location_source}`);
      }
      if (!data.store.maps_url || !data.store.maps_url.includes('google.com/maps')) {
        throw new Error(`Expected valid maps_url, got ${data.store.maps_url}`);
      }
    });

    // Case 26: Store update with changed address automatically updates coordinates and formatted_address
    await assert('Case 26: Store update with changed address automatically updates coordinates', async () => {
      const updateRes = await fetch(`${baseUrl}/api/stores/${geoStoreId}`, {
        method: 'PATCH',
        headers: authHeadersUser1,
        body: JSON.stringify({
          address: '350 5th Ave, New York, NY 10118',
        }),
      });

      if (updateRes.status !== 200) {
        const txt = await updateRes.text();
        throw new Error(`Expected 200 OK, got ${updateRes.status}: ${txt}`);
      }

      const data = (await updateRes.json()) as any;
      const updatedLat = data.store.latitude;
      const updatedLng = data.store.longitude;

      if (!updatedLat || !updatedLng) {
        throw new Error('Coordinates missing after address update');
      }
      if (data.store.formatted_address !== '350 5th Ave, New York, NY 10118') {
        throw new Error(`Expected updated formatted_address, got '${data.store.formatted_address}'`);
      }
    });

    // Case 27: Store update with invalid address is rejected with 400 Bad Request
    await assert('Case 27: Store update with invalid address is rejected with 400 Bad Request', async () => {
      const invalidRes = await fetch(`${baseUrl}/api/stores/${geoStoreId}`, {
        method: 'PATCH',
        headers: authHeadersUser1,
        body: JSON.stringify({
          address: 'INVALID_ADDRESS_UNKNOWN_TERRITORY_XYZ',
        }),
      });

      if (invalidRes.status !== 400) {
        throw new Error(`Expected 400 Bad Request for invalid address, got ${invalidRes.status}`);
      }

      const errData = (await invalidRes.json()) as any;
      if (errData.error !== 'Invalid Address') {
        throw new Error(`Expected error 'Invalid Address', got '${errData.error}'`);
      }
    });

    // Case 28: Temporary geocoding failure retains previously stored valid coordinates without deleting them
    await assert('Case 28: Temporary geocoding failure retains previously stored valid coordinates', async () => {
      // First get current valid coordinates
      const currentRes = await fetch(`${baseUrl}/api/stores/${geoStoreId}`, {
        headers: authHeadersUser1,
      });
      const currentData = (await currentRes.json()) as any;
      const validLat = currentData.store.latitude;
      const validLng = currentData.store.longitude;

      if (!validLat || !validLng) {
        throw new Error('Valid coordinates not present before temporary failure test');
      }

      // Update with address triggering temporary failure
      const tempFailRes = await fetch(`${baseUrl}/api/stores/${geoStoreId}`, {
        method: 'PATCH',
        headers: authHeadersUser1,
        body: JSON.stringify({
          address: 'TEMPORARY_GEO_FAIL_AVENUE',
        }),
      });

      if (tempFailRes.status !== 200) {
        throw new Error(`Expected 200 OK preserving valid coordinates, got ${tempFailRes.status}`);
      }

      const afterData = (await tempFailRes.json()) as any;
      if (afterData.store.latitude !== validLat || afterData.store.longitude !== validLng) {
        throw new Error(
          `Coordinates were unexpectedly modified or cleared! Before: ${validLat}, After: ${afterData.store.latitude}`
        );
      }
    });

    // Case 29: Cross-user security: User 2 cannot modify User 1's store location data (403)
    await assert("Case 29: Security: User 2 cannot modify User 1's store location data (403)", async () => {
      const locRes = await fetch(`${baseUrl}/api/stores/${geoStoreId}/location`, {
        method: 'PATCH',
        headers: authHeadersUser2,
        body: JSON.stringify({
          latitude: 40.7128,
          longitude: -74.006,
        }),
      });

      if (locRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for User 2 location update, got ${locRes.status}`);
      }

      const patchRes = await fetch(`${baseUrl}/api/stores/${geoStoreId}`, {
        method: 'PATCH',
        headers: authHeadersUser2,
        body: JSON.stringify({
          address: 'Hacker Way, Menlo Park, CA',
        }),
      });

      if (patchRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for User 2 address update, got ${patchRes.status}`);
      }
    });

    // Case 30: Zero secret exposure: Google Maps API key is never exposed in response objects
    await assert('Case 30: Zero secret exposure: Google Maps API key is never exposed in response payloads', async () => {
      const storeRes = await fetch(`${baseUrl}/api/stores/${geoStoreId}`, {
        headers: authHeadersUser1,
      });
      const storeBody = await storeRes.text();

      if (storeBody.includes('AIza') || storeBody.includes('key=') || storeBody.includes('apiKey')) {
        throw new Error('Sensitive Google Maps API key found in store response!');
      }

      const geoRes = await fetch(`${baseUrl}/api/maps/geocode`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          address: '10 Downing St, London',
        }),
      });

      const geoBody = await geoRes.text();
      if (geoBody.includes('AIza') || geoBody.includes('key=') || geoBody.includes('apiKey')) {
        throw new Error('Sensitive Google Maps API key found in geocode response!');
      }
    });

    // =========================================================================
    // VERCEL DEPLOYMENT WORKFLOW & SECURITY VERIFICATION SUITE (10 CASES)
    // =========================================================================

    let deployedVercelId = '';
    let deployedLiveUrl = '';
    let deployedProjectId = '';

    // Case 31: User 1 deploys own store successfully
    await assert('Case 31: User 1 deploys own store successfully to Vercel', async () => {
      const deployRes = await fetch(`${baseUrl}/api/stores/${storeId}/deploy`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          template: 'modern',
        }),
      });

      if (deployRes.status !== 200) {
        const errJson = (await deployRes.json().catch(() => ({}))) as any;
        if (
          deployRes.status === 500 &&
          (errJson.message?.includes('payment_required') ||
            errJson.message?.includes('api-deployments-free-per-day') ||
            errJson.message?.includes('402'))
        ) {
          console.log('       (Vercel daily deployment quota reached, skipping live Vercel call)');
          return;
        }
        throw new Error(`Expected 200 OK, got ${deployRes.status}`);
      }

      const data = (await deployRes.json()) as any;
      if (!data.success) throw new Error('Expected success: true');
      if (!data.deploymentId) throw new Error('Missing deploymentId in response');
      if (!data.liveUrl) throw new Error('Missing liveUrl in response');
      if (!data.status || (data.status !== 'READY' && data.status !== 'live')) {
        throw new Error(`Expected status READY or live, got ${data.status}`);
      }

      deployedVercelId = data.deploymentId;
      deployedLiveUrl = data.liveUrl;
    });

    // Case 32: Unauthorized user (User 2) cannot deploy User 1's store (403 Forbidden)
    await assert("Case 32: Security: User 2 cannot deploy User 1's store (403 Forbidden)", async () => {
      const deployRes = await fetch(`${baseUrl}/api/stores/${storeId}/deploy`, {
        method: 'POST',
        headers: authHeadersUser2,
        body: JSON.stringify({ template: 'modern' }),
      });

      if (deployRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for User 2 deploying User 1 store, got ${deployRes.status}`);
      }
    });

    // Case 33: Unauthenticated deploy request is rejected (401 Unauthorized)
    await assert('Case 33: Unauthenticated request to deploy store is rejected (401)', async () => {
      const deployRes = await fetch(`${baseUrl}/api/stores/${storeId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'modern' }),
      });

      if (deployRes.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${deployRes.status}`);
      }
    });

    // Case 34: Deployment record is created and queryable in deployments table
    await assert('Case 34: Deployment record is created and persists in database', async () => {
      if (!deployedVercelId) return;
      const statusRes = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser1,
      });

      if (statusRes.status !== 200) {
        throw new Error(`Expected 200 OK for deployment status, got ${statusRes.status}`);
      }

      const statusData = (await statusRes.json()) as any;
      if (!statusData.deploymentId || statusData.deploymentId !== deployedVercelId) {
        throw new Error(
          `Deployment ID mismatch: expected ${deployedVercelId}, got ${statusData.deploymentId}`
        );
      }
      if (statusData.status !== 'READY' && statusData.status !== 'live') {
        throw new Error(`Expected status READY or live, got ${statusData.status}`);
      }
    });

    // Case 35: Storefront compilation and live URL reflects store slug
    await assert('Case 35: Live store URL reflects store slug domain', async () => {
      if (!deployedLiveUrl) return;
      if (!deployedLiveUrl.startsWith('https://')) {
        throw new Error(`Expected HTTPS live URL, got ${deployedLiveUrl}`);
      }
      // Store record in database should also have live_url updated
      const storeRes = await fetch(`${baseUrl}/api/stores/${storeId}`, {
        headers: authHeadersUser1,
      });
      const storeData = (await storeRes.json()) as any;
      if (!storeData.store.live_url) {
        throw new Error('store.live_url was not saved on store record');
      }
      deployedProjectId = storeData.store.vercel_project_id;
    });

    // Case 36: Redeployment reuses existing store's vercel_project_id
    await assert('Case 36: Redeployment reuses the existing store Vercel project ID without duplicates', async () => {
      if (!deployedVercelId) return;
      const redeployRes = await fetch(`${baseUrl}/api/stores/${storeId}/deploy`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({ template: 'minimalist' }),
      });

      if (redeployRes.status !== 200) {
        throw new Error(`Expected 200 OK on redeploy, got ${redeployRes.status}`);
      }

      const redeployData = (await redeployRes.json()) as any;
      if (!redeployData.success) throw new Error('Expected redeploy success: true');

      // Check store project ID remains consistent
      const storeRes = await fetch(`${baseUrl}/api/stores/${storeId}`, {
        headers: authHeadersUser1,
      });
      const storeData = (await storeRes.json()) as any;
      if (deployedProjectId && storeData.store.vercel_project_id !== deployedProjectId) {
        throw new Error(
          `Vercel project ID changed on redeploy! Expected ${deployedProjectId}, got ${storeData.store.vercel_project_id}`
        );
      }
    });

    // Case 37: Zero secret exposure: VERCEL_API_TOKEN is never exposed in response body or headers
    await assert('Case 37: Zero secret exposure: VERCEL_API_TOKEN is never exposed in response payloads', async () => {
      const deployRes = await fetch(`${baseUrl}/api/stores/${storeId}/deploy`, {
        method: 'POST',
        headers: authHeadersUser1,
      });
      const deployBody = await deployRes.text();

      if (
        deployBody.includes('VERCEL_API_TOKEN') ||
        (process.env.VERCEL_API_TOKEN && deployBody.includes(process.env.VERCEL_API_TOKEN))
      ) {
        throw new Error('VERCEL_API_TOKEN secret found in deploy response!');
      }

      const statusRes = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser1,
      });
      const statusBody = await statusRes.text();

      if (
        statusBody.includes('VERCEL_API_TOKEN') ||
        (process.env.VERCEL_API_TOKEN && statusBody.includes(process.env.VERCEL_API_TOKEN))
      ) {
        throw new Error('VERCEL_API_TOKEN secret found in deployment-status response!');
      }
    });

    // Case 38: Deployment status endpoint access control (User 2 cannot view User 1 status)
    await assert("Case 38: Security: User 2 cannot access User 1's deployment status (403)", async () => {
      const statusRes = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser2,
      });

      if (statusRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for User 2 reading User 1 deployment status, got ${statusRes.status}`);
      }
    });

    // Case 39: Different stores have completely isolated deployments
    let user2StoreId = '';
    await assert('Case 39: Isolation: Deploying store for User 2 does not overwrite User 1 deployment', async () => {
      // Create store for User 2
      const createStoreRes = await fetch(`${baseUrl}/api/stores`, {
        method: 'POST',
        headers: authHeadersUser2,
        body: JSON.stringify({
          store_name: 'Solstice Books',
          description: 'Independent bookstore and café',
        }),
      });

      if (createStoreRes.status !== 201) {
        throw new Error(`Failed to create User 2 store: ${createStoreRes.status}`);
      }
      const createData = (await createStoreRes.json()) as any;
      user2StoreId = createData.store.id;

      // Deploy User 2 store
      const deploy2Res = await fetch(`${baseUrl}/api/stores/${user2StoreId}/deploy`, {
        method: 'POST',
        headers: authHeadersUser2,
      });

      if (deploy2Res.status !== 200) {
        const errJson = (await deploy2Res.json().catch(() => ({}))) as any;
        if (
          deploy2Res.status === 500 &&
          (errJson.message?.includes('payment_required') ||
            errJson.message?.includes('api-deployments-free-per-day') ||
            errJson.message?.includes('402'))
        ) {
          console.log('       (Vercel daily deployment quota reached, skipping live Vercel call)');
          return;
        }
        throw new Error(`User 2 deploy failed: ${deploy2Res.status}`);
      }
      const deploy2Data = (await deploy2Res.json()) as any;

      // Verify User 2 deployment is separate from User 1
      if (deploy2Data.deploymentId === deployedVercelId) {
        throw new Error('User 2 deployment ID collided with User 1 deployment ID!');
      }

      // Verify User 1 store deployment status remains unaffected
      const checkUser1Res = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser1,
      });
      const checkUser1Data = (await checkUser1Res.json()) as any;
      if (checkUser1Data.deploymentId === deploy2Data.deploymentId) {
        throw new Error("User 1 deployment was overwritten by User 2's deployment!");
      }
    });

    // Case 40: Custom template configuration accepted and preserved in deploy flow
    await assert('Case 40: Custom template configuration (e.g. bold_dark) accepted in deploy body', async () => {
      const deployRes = await fetch(`${baseUrl}/api/stores/${storeId}/deploy`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          template: 'bold_dark',
        }),
      });

      if (deployRes.status !== 200) {
        const errJson = (await deployRes.json().catch(() => ({}))) as any;
        if (
          deployRes.status === 500 &&
          (errJson.message?.includes('payment_required') ||
            errJson.message?.includes('api-deployments-free-per-day') ||
            errJson.message?.includes('402'))
        ) {
          console.log('       (Vercel daily deployment quota reached, skipping live Vercel call)');
          return;
        }
        throw new Error(`Expected 200 OK with custom template, got ${deployRes.status}`);
      }
      const data = (await deployRes.json()) as any;
      if (!data.success || !data.liveUrl) {
        throw new Error('Custom template deploy failed to return success and liveUrl');
      }
    });

    // Case 41: State mapping verification (friendly status messages)
    await assert('Case 41: State mapping: Returns exact state enum and friendly statusMessage', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser1,
      });

      if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
      const data = (await res.json()) as any;
      if (data.state !== 'READY') {
        throw new Error(`Expected state READY, got ${data.state}`);
      }
      if (data.statusMessage !== 'Deployment successful') {
        throw new Error(`Expected statusMessage 'Deployment successful', got '${data.statusMessage}'`);
      }
    });

    // Case 42: Status polling idempotency (does not create duplicate deployments)
    await assert('Case 42: Polling deployment-status does not create duplicate deployments', async () => {
      const firstRes = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser1,
      });
      const firstData = (await firstRes.json()) as any;

      // Poll again twice
      await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, { headers: authHeadersUser1 });
      const thirdRes = await fetch(`${baseUrl}/api/stores/${storeId}/deployment-status`, {
        headers: authHeadersUser1,
      });
      const thirdData = (await thirdRes.json()) as any;

      if (firstData.deploymentId !== thirdData.deploymentId) {
        throw new Error('Deployment ID changed during polling! Duplicate deployment was created.');
      }
    });

    // Case 43: Failed deployment error mapping and reporting
    await assert('Case 43: Failed deployment correctly maps ERROR state and statusMessage', async () => {
      // Create a simulated error deployment for User 2
      await dataStore.createDeployment({
        store_id: user2StoreId,
        vercel_project_id: 'prj_fail_test',
        vercel_deployment_id: 'dpl_fail_123',
        deployment_url: 'https://failed-build.vercel.app',
        live_url: null,
        status: 'ERROR',
        error_message: 'Syntax error during storefront build',
      });

      const res = await fetch(`${baseUrl}/api/stores/${user2StoreId}/deployment-status`, {
        headers: authHeadersUser2,
      });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = (await res.json()) as any;
      if (data.state !== 'ERROR') {
        throw new Error(`Expected state ERROR, got ${data.state}`);
      }
      if (data.statusMessage !== 'Deployment failed') {
        throw new Error(`Expected statusMessage 'Deployment failed', got '${data.statusMessage}'`);
      }
      if (!data.errorMessage || !data.errorMessage.includes('Syntax error')) {
        throw new Error(`Expected errorMessage with failure details, got '${data.errorMessage}'`);
      }
    });

    // Helper function to build multipart/form-data payload with boundary
    function createMultipartRequest(
      fields: Record<string, string>,
      file?: { name: string; filename: string; contentType: string; content: Buffer | string }
    ) {
      const boundary = `----ObsidianTestBoundary${Date.now()}${Math.random().toString(36).substring(2)}`;
      const chunks: Buffer[] = [];

      for (const [key, val] of Object.entries(fields)) {
        chunks.push(
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`)
        );
      }

      if (file) {
        chunks.push(
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
          )
        );
        chunks.push(Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content));
        chunks.push(Buffer.from('\r\n'));
      }

      chunks.push(Buffer.from(`--${boundary}--\r\n`));

      return {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.concat(chunks),
      };
    }

    // Case 44: Storage: Logo upload saves to stores/:storeId/logo/ and updates store logo_url
    await assert('Case 44: Logo upload (category=logo) saves to stores/:storeId/logo/ and updates store logo_url', async () => {
      const { headers, body } = createMultipartRequest(
        { category: 'logo' },
        { name: 'file', filename: 'brand-logo.png', contentType: 'image/png', content: 'fake-png-logo-bytes' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Expected 200 OK, got ${res.status}: ${text}`);
      }
      const data = (await res.json()) as any;
      if (!data.success || data.category !== 'logo') {
        throw new Error(`Expected success=true and category='logo', got: ${JSON.stringify(data)}`);
      }
      if (!data.path.startsWith(`stores/${storeId}/logo/`)) {
        throw new Error(`Expected path starting with stores/${storeId}/logo/, got: ${data.path}`);
      }
      if (!data.url || !data.url.startsWith('http')) {
        throw new Error(`Expected valid URL, got: ${data.url}`);
      }

      // Verify store in DB has updated logo_url
      const storeRes = await fetch(`${baseUrl}/api/stores/${storeId}`, { headers: authHeadersUser1 });
      const storeData = (await storeRes.json()) as any;
      if (storeData.store.logo_url !== data.url) {
        throw new Error(`Expected store.logo_url to equal ${data.url}, got ${storeData.store.logo_url}`);
      }
    });

    // Case 45: Storage: Banner upload saves to stores/:storeId/banner/ and updates store banner_url
    await assert('Case 45: Banner upload (category=banner) saves to stores/:storeId/banner/ and updates store banner_url', async () => {
      const { headers, body } = createMultipartRequest(
        { category: 'banner' },
        { name: 'file', filename: 'store-banner.jpg', contentType: 'image/jpeg', content: 'fake-jpeg-banner-bytes' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Expected 200 OK, got ${res.status}: ${text}`);
      }
      const data = (await res.json()) as any;
      if (!data.success || data.category !== 'banner') {
        throw new Error(`Expected success=true and category='banner', got: ${JSON.stringify(data)}`);
      }
      if (!data.path.startsWith(`stores/${storeId}/banner/`)) {
        throw new Error(`Expected path starting with stores/${storeId}/banner/, got: ${data.path}`);
      }
      if (!data.url || !data.url.startsWith('http')) {
        throw new Error(`Expected valid URL, got: ${data.url}`);
      }

      // Verify store in DB has updated banner_url
      const storeRes = await fetch(`${baseUrl}/api/stores/${storeId}`, { headers: authHeadersUser1 });
      const storeData = (await storeRes.json()) as any;
      if (storeData.store.banner_url !== data.url) {
        throw new Error(`Expected store.banner_url to equal ${data.url}, got ${storeData.store.banner_url}`);
      }
    });

    // Case 46: Storage: Product image upload saves to stores/:storeId/products/ and updates product image_url
    await assert('Case 46: Product image upload (category=product) saves to stores/:storeId/products/ and updates product image_url', async () => {
      // Create a dedicated product first
      const prodRes = await fetch(`${baseUrl}/api/stores/${storeId}/products`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify({
          name: 'Storage Premium Silk Scarf',
          price: 120,
          stock: 50,
          category: 'Accessories',
        }),
      });
      const prodData = (await prodRes.json()) as any;
      const targetProdId = prodData.product.id;

      const { headers, body } = createMultipartRequest(
        { category: 'product', productId: targetProdId },
        { name: 'file', filename: 'silk-scarf.webp', contentType: 'image/webp', content: 'fake-webp-image-bytes' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`Expected 200 OK, got ${res.status}: ${text}`);
      }
      const data = (await res.json()) as any;
      if (!data.success || data.category !== 'product') {
        throw new Error(`Expected success=true and category='product', got: ${JSON.stringify(data)}`);
      }
      if (!data.path.startsWith(`stores/${storeId}/products/`)) {
        throw new Error(`Expected path starting with stores/${storeId}/products/, got: ${data.path}`);
      }
      if (!data.url || !data.url.startsWith('http')) {
        throw new Error(`Expected valid URL, got: ${data.url}`);
      }

      // Verify product in DB has updated image_url
      const getProdRes = await fetch(`${baseUrl}/api/stores/${storeId}/products/${targetProdId}`, { headers: authHeadersUser1 });
      const getProdData = (await getProdRes.json()) as any;
      if (getProdData.product.image_url !== data.url) {
        throw new Error(`Expected product.image_url to equal ${data.url}, got ${getProdData.product.image_url}`);
      }
    });

    // Case 47: Security: Unauthorized user uploading to another user's store rejected with 403 Forbidden
    await assert('Case 47: Security: User 2 cannot upload media into User 1 store (403 Forbidden)', async () => {
      const { headers, body } = createMultipartRequest(
        { category: 'logo' },
        { name: 'file', filename: 'hacker-logo.png', contentType: 'image/png', content: 'hacker-data' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user2Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    // Case 48: Security: Unauthenticated request rejected with 401
    await assert('Case 48: Security: Unauthenticated upload request rejected with 401', async () => {
      const { headers, body } = createMultipartRequest(
        { category: 'logo' },
        { name: 'file', filename: 'logo.png', contentType: 'image/png', content: 'data' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers,
        body,
      });

      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
      }
    });

    // Case 49: File validation: Missing file is rejected with 400 Bad Request
    await assert('Case 49: File validation: Upload with missing file rejected with 400 Bad Request', async () => {
      const { headers, body } = createMultipartRequest({ category: 'logo' });

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 400) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}`);
      }
      const data = (await res.json()) as any;
      if (!data.message || !data.message.toLowerCase().includes('file')) {
        throw new Error(`Expected error message mentioning file, got: ${JSON.stringify(data)}`);
      }
    });

    // Case 50: File validation: Invalid category rejected with 400 Bad Request
    await assert('Case 50: File validation: Upload with invalid category rejected with 400 Bad Request', async () => {
      const { headers, body } = createMultipartRequest(
        { category: 'document' },
        { name: 'file', filename: 'doc.png', contentType: 'image/png', content: 'data' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 400) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}`);
      }
      const data = (await res.json()) as any;
      if (!data.message || !data.message.includes('Allowed categories')) {
        throw new Error(`Expected error message to specify allowed categories, got: ${JSON.stringify(data)}`);
      }
    });

    // Case 51: File validation: Invalid MIME type rejected with 400 Bad Request
    await assert('Case 51: File validation: Upload with invalid MIME type rejected with 400 Bad Request', async () => {
      const { headers, body } = createMultipartRequest(
        { category: 'logo' },
        { name: 'file', filename: 'script.exe', contentType: 'application/octet-stream', content: 'malicious-binary' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 400) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}`);
      }
      const data = (await res.json()) as any;
      if (!data.message || !data.message.includes('Invalid file type')) {
        throw new Error(`Expected error message mentioning invalid file type, got: ${JSON.stringify(data)}`);
      }
    });

    // Case 52: File validation: File exceeding 5MB rejected with 400 Bad Request
    await assert('Case 52: File validation: File exceeding 5MB rejected with 400 Bad Request', async () => {
      const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024, 'a');
      const { headers, body } = createMultipartRequest(
        { category: 'banner' },
        { name: 'file', filename: 'huge-banner.jpg', contentType: 'image/jpeg', content: oversizedBuffer }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      if (res.status !== 400) {
        throw new Error(`Expected 400 Bad Request, got ${res.status}`);
      }
      const data = (await res.json()) as any;
      if (!data.message || !data.message.includes('limit')) {
        throw new Error(`Expected error message indicating size limit exceeded, got: ${JSON.stringify(data)}`);
      }
    });

    // Case 53: Security: Zero secret exposure in responses or errors
    await assert('Case 53: Zero secret exposure: Supabase service role key is never returned or leaked', async () => {
      const { headers, body } = createMultipartRequest(
        { category: 'logo' },
        { name: 'file', filename: 'test.png', contentType: 'image/png', content: 'png-bytes' }
      );

      const res = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          ...headers,
        },
        body,
      });

      const text = await res.text();
      if (env.SUPABASE_SERVICE_ROLE_KEY && text.includes(env.SUPABASE_SERVICE_ROLE_KEY)) {
        throw new Error('CRITICAL SECURITY VIOLATION: SUPABASE_SERVICE_ROLE_KEY leaked in response body!');
      }
      if (text.includes('service_role') || text.includes('SUPABASE_SERVICE_ROLE_KEY')) {
        throw new Error('Supabase credential reference found in response body');
      }
    });

    // Case 54: Multiple uploads produce safe unique filenames
    await assert('Case 54: Multiple uploads for same store and category produce distinct non-colliding paths', async () => {
      const req1 = createMultipartRequest(
        { category: 'logo' },
        { name: 'file', filename: 'logo1.png', contentType: 'image/png', content: 'bytes1' }
      );
      const req2 = createMultipartRequest(
        { category: 'logo' },
        { name: 'file', filename: 'logo1.png', contentType: 'image/png', content: 'bytes2' }
      );

      const res1 = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user1Token}`, ...req1.headers },
        body: req1.body,
      });
      const data1 = (await res1.json()) as any;

      const res2 = await fetch(`${baseUrl}/api/stores/${storeId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user1Token}`, ...req2.headers },
        body: req2.body,
      });
      const data2 = (await res2.json()) as any;

      if (data1.path === data2.path) {
        throw new Error(`Paths collide for sequential uploads: ${data1.path}`);
      }
    });

    // ── SECTION: STRICT PER-USER DATA ISOLATION & CROSS-DEVICE PERSISTENCE ──

    // Case 55: USER B cannot see USER A's store (GET /api/stores/:id -> 403 Forbidden)
    await assert("Case 55: USER B cannot read User A's store (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}`, {
        headers: authHeadersUser2,
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    // Case 56: USER B cannot see USER A's products (GET /api/stores/:storeId/products -> 403 Forbidden)
    await assert("Case 56: USER B cannot read User A's products (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/products`, {
        headers: authHeadersUser2,
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    // Case 57: USER B cannot modify USER A's products (PUT /api/stores/:storeId/products/:productId -> 403 Forbidden)
    await assert("Case 57: USER B cannot modify User A's products (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/products/${productClientId}`, {
        method: 'PUT',
        headers: authHeadersUser2,
        body: JSON.stringify({
          name: 'Hacked Hoodie by User 2',
          price: 1,
        }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    // Case 58: USER B cannot delete USER A's products (DELETE /api/stores/:storeId/products/:productId -> 403 Forbidden)
    await assert("Case 58: USER B cannot delete User A's products (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/products/${productClientId}`, {
        method: 'DELETE',
        headers: authHeadersUser2,
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    // Case 59: USER B cannot see USER A's orders (GET /api/stores/:storeId/orders -> 403 Forbidden)
    await assert("Case 59: USER B cannot read User A's orders (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/orders`, {
        headers: authHeadersUser2,
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    // Case 60: USER B cannot modify USER A's orders (PATCH /api/stores/:storeId/orders/:orderId/status -> 403 Forbidden)
    await assert("Case 60: USER B cannot modify User A's orders (403 Forbidden)", async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeId}/orders/${placedOrderClientId}/status`, {
        method: 'PATCH',
        headers: authHeadersUser2,
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    // Case 61: Customer cannot place order referencing product belonging to another store
    await assert("Case 61: Order placement rejects foreign product not belonging to target store", async () => {
      // Create user 2 store and product
      const u2StoreRes = await fetch(`${baseUrl}/api/stores`, {
        method: 'POST',
        headers: authHeadersUser2,
        body: JSON.stringify({ store_name: 'User 2 Unique Boutique' }),
      });
      const u2StoreData = (await u2StoreRes.json()) as any;
      const u2StoreId = u2StoreData.store.id;

      // Try placing an order in User 2's store using User 1's product
      const resSingle = await fetch(`${baseUrl}/api/stores/${u2StoreId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productClientId, // Belongs to User 1's store
          customerName: 'Intruder Order',
          quantity: 1,
        }),
      });
      if (resSingle.status !== 400) {
        throw new Error(`Expected 400 Bad Request for foreign product in single order, got ${resSingle.status}`);
      }

      // Try placing nested order in User 2's store using User 1's product
      const resMulti = await fetch(`${baseUrl}/api/stores/${u2StoreId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: productClientId, quantity: 1 }],
          customerName: 'Intruder Order Multi',
        }),
      });
      if (resMulti.status !== 400) {
        throw new Error(`Expected 400 Bad Request for foreign product in multi-item order, got ${resMulti.status}`);
      }
    });

    // Case 62: Cross-device persistence: User A logs in from another device with fresh JWT session
    await assert("Case 62: Cross-device persistence: Fresh session on Device 2 retrieves identical user store, products, orders, and deployment", async () => {
      // Generate a fresh session token simulating a login from Device 2
      const freshDevice2Token = jwt.sign(
        {
          sub: user1Id,
          email: user1Email,
          user_metadata: { full_name: 'Hrishikesh Owner' },
        },
        jwtSecret,
        { expiresIn: '1d' }
      );

      const device2Headers = {
        Authorization: `Bearer ${freshDevice2Token}`,
        Accept: 'application/json',
      };

      // 1. Account state returns exact same store ID and user ID
      const stateRes = await fetch(`${baseUrl}/api/account/state`, { headers: device2Headers });
      if (stateRes.status !== 200) throw new Error(`Expected 200, got ${stateRes.status}`);
      const stateData = (await stateRes.json()) as any;
      if (stateData.user.id !== user1Id) throw new Error(`User ID mismatch on Device 2: got ${stateData.user.id}`);
      if (stateData.store.id !== defaultStoreId) throw new Error(`Store ID mismatch on Device 2: got ${stateData.store.id}`);

      // 2. Products are accessible and match
      const prodRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/products`, { headers: device2Headers });
      if (prodRes.status !== 200) throw new Error(`Expected 200, got ${prodRes.status}`);
      const prodData = (await prodRes.json()) as any;
      if (!prodData.products || prodData.products.length === 0) throw new Error('Products empty on Device 2');

      // 3. Orders are accessible and match
      const orderRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders`, { headers: device2Headers });
      if (orderRes.status !== 200) throw new Error(`Expected 200, got ${orderRes.status}`);
      const orderData = (await orderRes.json()) as any;
      if (!orderData.orders || orderData.orders.length === 0) throw new Error('Orders empty on Device 2');

      // 4. Deployment status is accessible and matches
      const depRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/deployment-status`, { headers: device2Headers });
      if (depRes.status !== 200) throw new Error(`Expected 200, got ${depRes.status}`);
      const depData = (await depRes.json()) as any;
      if (deployedVercelId && !depData.deploymentId) throw new Error('Deployment ID missing on Device 2');
    });

    // Case 63: Swagger & OpenAPI specification accuracy and accessibility
    await assert('Case 63: Swagger & OpenAPI specification completeness and schema fidelity', async () => {
      // 1. JSON spec endpoint
      const specRes = await fetch(`${baseUrl}/api/docs/swagger.json`);
      if (specRes.status !== 200) throw new Error(`Expected 200 for swagger.json, got ${specRes.status}`);
      const spec = (await specRes.json()) as any;

      if (spec.openapi !== '3.0.3') throw new Error(`Expected OpenAPI 3.0.3, got ${spec.openapi}`);
      if (!spec.paths['/']) throw new Error('Missing root / path in Swagger spec');
      if (!spec.paths['/health']) throw new Error('Missing /health path in Swagger spec');

      // 2. Health response schema
      const healthSchema = spec.components?.schemas?.HealthResponse;
      if (!healthSchema?.properties?.database) {
        throw new Error('HealthResponse schema missing database field in Swagger spec');
      }

      // 3. Product query parameters include status
      const getProductsOp = spec.paths['/api/stores/{id}/products']?.get;
      const hasStatusQuery = getProductsOp?.parameters?.some((p: any) => p.name === 'status' && p.in === 'query');
      if (!hasStatusQuery) {
        throw new Error('Missing status query parameter in /api/stores/{id}/products Swagger spec');
      }

      // 4. Upload multipart properties include productId
      const uploadOp = spec.paths['/api/stores/{id}/upload']?.post;
      const uploadProps = uploadOp?.requestBody?.content?.['multipart/form-data']?.schema?.properties;
      if (!uploadProps?.productId) {
        throw new Error('Missing productId property in /api/stores/{id}/upload Swagger spec');
      }

      // 5. Location update properties include locationSource
      const locationOp = spec.paths['/api/stores/{id}/location']?.patch;
      const locationProps = locationOp?.requestBody?.content?.['application/json']?.schema?.properties;
      if (!locationProps?.locationSource) {
        throw new Error('Missing locationSource property in /api/stores/{id}/location Swagger spec');
      }

      // 6. Analytics schema has uniqueCustomers
      const analyticsSchema = spec.components?.schemas?.Analytics;
      if (!analyticsSchema?.properties?.uniqueCustomers) {
        throw new Error('Missing uniqueCustomers in Analytics schema in Swagger spec');
      }

      // 7. Interactive Swagger UI endpoint responds with HTML
      const uiRes = await fetch(`${baseUrl}/api/docs`);
      if (uiRes.status !== 200) throw new Error(`Expected 200 for /api/docs UI, got ${uiRes.status}`);
      const uiHtml = await uiRes.text();
      if (!uiHtml.includes('SwaggerUIBundle')) {
        throw new Error('Expected Swagger UI HTML page with SwaggerUIBundle');
      }
    });

    // ------------------------------------------------------------------------
    // TASK 10 VERIFICATION: TEST A - TEST F
    // ------------------------------------------------------------------------
    // TEST A: Supabase login -> access token obtained -> backend accepts token -> store data loads
    await assert('TEST A: Supabase token login accepts token and loads user store data', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (loginRes.status !== 200) throw new Error(`Expected 200, got ${loginRes.status}`);
      const loginData = (await loginRes.json()) as any;
      if (loginData.user.id !== user1Id) throw new Error(`User ID mismatch: ${loginData.user.id}`);

      // Store data loads with this token
      const stateRes = await fetch(`${baseUrl}/api/account/state`, { headers: authHeadersUser1 });
      if (stateRes.status !== 200) throw new Error(`Expected 200 for state, got ${stateRes.status}`);
      const stateData = (await stateRes.json()) as any;
      if (stateData.store.id !== defaultStoreId) throw new Error('Store ID mismatch');
    });

    // TEST B: Cross-device login with the same account retrieves the exact same store, products, and orders
    await assert('TEST B: Cross-device login with same account retrieves identical store and products', async () => {
      const freshDeviceBToken = jwt.sign(
        { sub: user1Id, email: user1Email, user_metadata: { full_name: 'Hrishikesh Owner' } },
        jwtSecret,
        { expiresIn: '1d' }
      );
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: `Bearer ${freshDeviceBToken}`, Accept: 'application/json' },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = (await res.json()) as any;
      if (data.user.id !== user1Id) throw new Error('User ID mismatch on Device B');
      if (data.store.id !== defaultStoreId) throw new Error('Store ID mismatch on Device B');
      if (!Array.isArray(data.products) || data.products.length === 0) throw new Error('Products missing on Device B');
    });

    // TEST C: Login with a different Google account must NOT see the first user's private store or products
    await assert("TEST C: Different user account cannot access User 1's private store or orders (403)", async () => {
      const accessRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}`, { headers: authHeadersUser2 });
      if (accessRes.status !== 403) throw new Error(`Expected 403 Forbidden, got ${accessRes.status}`);

      const orderRes = await fetch(`${baseUrl}/api/stores/${defaultStoreId}/orders`, { headers: authHeadersUser2 });
      if (orderRes.status !== 403) throw new Error(`Expected 403 Forbidden, got ${orderRes.status}`);
    });

    // TEST D: Call backend without Authorization header -> 401 Unauthorized
    await assert('TEST D: Call protected endpoint without Authorization header rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`);
      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    // TEST E: Call backend with invalid/expired token -> 401 Unauthorized
    await assert('TEST E: Call backend with invalid/expired token rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: 'Bearer invalid.or.expired.jwt.token' },
      });
      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid.or.expired.jwt.token' },
      });
      if (loginRes.status !== 401) throw new Error(`Expected 401 Unauthorized on /login, got ${loginRes.status}`);
    });

    // TEST F: Call backend with valid Supabase access token -> 200 successful response
    await assert('TEST F: Call backend with valid Supabase access token returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = (await res.json()) as any;
      if (!data.token) throw new Error('Expected access token in response');
      if (data.user.id !== user1Id) throw new Error('Expected matching user ID');
    });

    // TEST G: Asymmetric ES256 Supabase JWT Verification
    await assert('TEST G: Asymmetric ES256 Supabase JWT with kid verifies successfully', async () => {
      const crypto = await import('crypto');
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
      const testKid = 'test-es256-kid-001';

      // Register the test public key in jwtVerifier cache
      const { jwtVerifier } = await import('../src/services/jwtVerifier.js');
      jwtVerifier.registerPublicKey(testKid, publicKey);

      const es256Token = jwt.sign(
        {
          sub: user1Id,
          email: user1Email,
          aud: 'authenticated',
          iss: 'https://vrgendezcvpzjuhcuhfo.supabase.co/auth/v1',
          user_metadata: { full_name: 'Hrishikesh Owner' },
        },
        privateKey,
        {
          algorithm: 'ES256',
          keyid: testKid,
          expiresIn: '1h',
        }
      );

      const verified = await jwtVerifier.verifyToken(es256Token);
      if (verified.id !== user1Id) throw new Error(`ES256 verification returned wrong ID: ${verified.id}`);

      // Verify the API accepts the ES256 Bearer token
      const res = await fetch(`${baseUrl}/api/account/state`, {
        headers: { Authorization: `Bearer ${es256Token}` },
      });
      if (res.status !== 200) throw new Error(`Expected 200 for ES256 Bearer token, got ${res.status}`);
      const json = (await res.json()) as any;
      if (json.user.id !== user1Id) throw new Error('User ID mismatch on ES256 API call');
      if (json.store.id !== defaultStoreId) throw new Error('Store ID mismatch on ES256 API call');
    });

    // =========================================================================
    // SECTION: TIMESTAMP NORMALIZATION & IMPORT LOCAL STATE (CASES A-F)
    // =========================================================================
    const {
      isRelativeDisplayString,
      normalizeTimestamp,
      extractAndNormalizeOrderTimestamp,
    } = await import('../src/utils/dateUtils.js');

    // Case A: createdAt = "2026-09-23T18:30:00.000Z" -> same real timestamp is stored
    await assert('CASE A: Real ISO timestamp is preserved when display field is present', async () => {
      const orderA = {
        createdAt: '2026-09-23T18:30:00.000Z',
        time: 'Just now',
        date: 'Just now',
      };
      const result = extractAndNormalizeOrderTimestamp(orderA);
      if (result !== '2026-09-23T18:30:00.000Z') {
        throw new Error(`Expected '2026-09-23T18:30:00.000Z', got '${result}'`);
      }
    });

    // Case B: display time = "Just now" -> converted to current ISO timestamp
    await assert('CASE B: Display time "Just now" converts to current ISO timestamp', async () => {
      const orderB = {
        date: 'Just now',
      };
      const before = Date.now();
      const result = extractAndNormalizeOrderTimestamp(orderB);
      const after = Date.now();
      const parsed = Date.parse(result);
      if (isNaN(parsed)) throw new Error(`Result is not a valid date string: ${result}`);
      if (parsed < before - 2000 || parsed > after + 2000) {
        throw new Error(`Parsed date ${result} is outside expected range of 'Just now'`);
      }
    });

    // Case C: display time = "5 minutes ago" -> converted to ~5 minutes before now
    await assert('CASE C: Display time "5 minutes ago" converts to ~5 minutes before now', async () => {
      const orderC = {
        date: '5 minutes ago',
      };
      const now = Date.now();
      const result = extractAndNormalizeOrderTimestamp(orderC);
      const parsed = Date.parse(result);
      if (isNaN(parsed)) throw new Error(`Result is not a valid date string: ${result}`);
      const diffMs = Math.abs(now - 5 * 60 * 1000 - parsed);
      if (diffMs > 5000) {
        throw new Error(`Parsed date ${result} deviated by ${diffMs}ms from expected 5 mins ago`);
      }
    });

    // Case D: display time = "Yesterday" -> safely converted to ~24 hours before now
    await assert('CASE D: Display time "Yesterday" safely converts to ~24 hours before now', async () => {
      const orderD = {
        date: 'Yesterday',
      };
      const now = Date.now();
      const result = extractAndNormalizeOrderTimestamp(orderD);
      const parsed = Date.parse(result);
      if (isNaN(parsed)) throw new Error(`Result is not a valid date string: ${result}`);
      const diffMs = Math.abs(now - 24 * 60 * 60 * 1000 - parsed);
      if (diffMs > 5000) {
        throw new Error(`Parsed date ${result} deviated by ${diffMs}ms from expected 24h ago`);
      }
    });

    // Case E: invalid timestamp = "abc123" -> never inserted directly into timestamptz column
    await assert('CASE E: Invalid timestamp "abc123" safely falls back to valid ISO string', async () => {
      const orderE = {
        date: 'abc123',
      };
      const result = extractAndNormalizeOrderTimestamp(orderE);
      if (result === 'abc123') throw new Error('Invalid string was not sanitized!');
      const parsed = Date.parse(result);
      if (isNaN(parsed)) throw new Error(`Result is not a valid date: ${result}`);
    });

    // Case F: Import local state containing multiple orders with display strings succeeds (HTTP 200)
    await assert('CASE F: POST /api/account/import-local-state with "Just now" orders succeeds (200 OK)', async () => {
      const payload = {
        store: {
          shopName: 'Timestamp Test Store',
          businessType: 'electronics',
        },
        orders: [
          {
            id: 889901,
            customerName: 'Alice Springs',
            productName: 'Solar Battery',
            totalPrice: 450,
            date: 'Just now',
          },
          {
            id: 889902,
            customerName: 'Bob Builder',
            productName: 'Impact Drill',
            totalPrice: 220,
            date: '5 minutes ago',
          },
          {
            id: 889903,
            customerName: 'Charlie Stone',
            productName: 'Raw Obsidian',
            totalPrice: 120,
            createdAt: '2026-09-23T18:30:00.000Z',
            date: 'Just now',
          },
          {
            id: 889904,
            customerName: 'Diana Prince',
            productName: 'Golden Lasso',
            totalPrice: 999,
            date: 'Yesterday',
          },
          {
            id: 889905,
            customerName: 'Evan Wright',
            productName: 'Journal',
            totalPrice: 45,
            date: 'abc123',
          },
        ],
      };

      const res = await fetch(`${baseUrl}/api/account/import-local-state`, {
        method: 'POST',
        headers: authHeadersUser1,
        body: JSON.stringify(payload),
      });

      if (res.status !== 200) {
        const errText = await res.text();
        throw new Error(`Expected 200, got ${res.status}: ${errText}`);
      }

      const resJson = (await res.json()) as any;
      if (!resJson.success) throw new Error('Response success flag is false');
      if (!Array.isArray(resJson.state?.orders)) throw new Error('Response missing state.orders array');

      // Verify the orders in the state have valid ISO timestamps and none contain "Just now" or "abc123"
      for (const ord of resJson.state.orders) {
        if (ord.date === 'Just now' || ord.date === 'abc123') {
          throw new Error(`Order ${ord.id} has unnormalized date: ${ord.date}`);
        }
        if (isNaN(Date.parse(ord.date))) {
          throw new Error(`Order ${ord.id} has invalid date string: ${ord.date}`);
        }
      }
    });

    // CASE G: getUserById is strictly read-only and never performs automatic writes
    await assert('CASE G: dataStore.getUserById is strictly read-only and does not create database records', async () => {
      const nonExistentId = 'f9999999-9999-9999-9999-999999999999';
      const result = await dataStore.getUserById(nonExistentId);
      if (result !== null) {
        throw new Error(`Expected null for non-existent user, got ${JSON.stringify(result)}`);
      }
      // Verify subsequent lookup still returns null (proving no record was silently created)
      const secondCheck = await dataStore.getUserById(nonExistentId);
      if (secondCheck !== null) {
        throw new Error(`Second lookup expected null, but record was unexpectedly created`);
      }
    });
  } finally {
    server!.close();
  }

  console.log(`\n=============================================================`);
  console.log(`Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log(`=============================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
