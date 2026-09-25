process.env.NODE_ENV = 'test';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { dataStore } from '../src/services/dataStore.js';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

async function runCrossDeviceTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING CROSS-DEVICE PERSISTENCE & USER ISOLATION TEST SUITE');
  console.log('================================================================\n');

  const app = createApp();
  let server: Server;
  const testPort = 5050;
  const baseUrl = `http://localhost:${testPort}`;

  await new Promise<void>((resolve) => {
    server = app.listen(testPort, () => resolve());
  });

  let passCount = 0;
  let failCount = 0;

  async function testStep(name: string, fn: () => Promise<void>) {
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

  // Setup Test Users
  const userA_Id = '11111111-1111-4111-a111-111111111111';
  const userA_Email = 'merchant.alpha@gmail.com';
  const userA_Name = 'Alpha Merchant';

  const userB_Id = '22222222-2222-4222-b222-222222222222';
  const userB_Email = 'merchant.beta@gmail.com';
  const userB_Name = 'Beta Merchant';

  const jwtSecret = env.SUPABASE_JWT_SECRET || 'test_jwt_secret_key';

  // Device A Session (Account A)
  const tokenDeviceA = jwt.sign(
    { sub: userA_Id, email: userA_Email, user_metadata: { full_name: userA_Name } },
    jwtSecret,
    { expiresIn: '7d' }
  );
  const headersDeviceA = {
    Authorization: `Bearer ${tokenDeviceA}`,
    'Content-Type': 'application/json',
  };

  // Device B Session (SAME Account A)
  const tokenDeviceB = jwt.sign(
    { sub: userA_Id, email: userA_Email, user_metadata: { full_name: userA_Name } },
    jwtSecret,
    { expiresIn: '7d' }
  );
  const headersDeviceB = {
    Authorization: `Bearer ${tokenDeviceB}`,
    'Content-Type': 'application/json',
  };

  // Account B Session (Different Account)
  const tokenAccountB = jwt.sign(
    { sub: userB_Id, email: userB_Email, user_metadata: { full_name: userB_Name } },
    jwtSecret,
    { expiresIn: '7d' }
  );
  const headersAccountB = {
    Authorization: `Bearer ${tokenAccountB}`,
    'Content-Type': 'application/json',
  };

  let storeA_Id = '';
  let productA_Id: any = null;
  let productB_Id: any = null;

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: DEVICE A - LOGIN & STORE CREATION
    // ------------------------------------------------------------------------
    console.log('\n--- [PHASE 1: DEVICE A - LOGIN & INITIALIZATION] ---');

    await testStep('Device A: Login with Google Account A & verify auth.uid()', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, { headers: headersDeviceA });
      if (res.status !== 200) throw new Error(`Auth failed with status ${res.status}`);
      const body = await res.json();
      if (body.user.id !== userA_Id) {
        throw new Error(`Expected auth.uid() = ${userA_Id}, got ${body.user.id}`);
      }
    });

    await testStep('Device A: Resolve or create Store with stores.owner_id = auth.uid()', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, { headers: headersDeviceA });
      if (res.status !== 200) throw new Error(`State fetch failed: ${res.status}`);
      const body = await res.json();
      if (!body.store || !body.store.id) {
        throw new Error('Store was not resolved or created');
      }
      storeA_Id = body.store.id;
      if (body.store.owner_id !== userA_Id && body.store.ownerId !== userA_Id) {
        throw new Error(`Expected store.owner_id = ${userA_Id}, got ${body.store.owner_id || body.store.ownerId}`);
      }
      console.log(`     Store resolved: ${storeA_Id} (owner_id: ${body.store.owner_id || body.store.ownerId})`);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: DEVICE A - ADD PRODUCTS & REFRESH
    // ------------------------------------------------------------------------
    console.log('\n--- [PHASE 2: DEVICE A - ADD PRODUCTS & REFRESH] ---');

    await testStep('Device A: Add Product A to store', async () => {
      const payload = {
        name: 'Product A - Silk Shirt',
        price: 199.99,
        stock: 25,
        category: 'Apparel',
        emoji: '👔',
        status: 'active',
      };
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products`, {
        method: 'POST',
        headers: headersDeviceA,
        body: JSON.stringify(payload),
      });
      if (res.status !== 201) {
        const err = await res.text();
        throw new Error(`Failed to add Product A (${res.status}): ${err}`);
      }
      const body = await res.json();
      productA_Id = body.product.id;
      if (!productA_Id) throw new Error('Product A ID missing');
      console.log(`     Product A created: ${productA_Id}`);
    });

    await testStep('Device A: Add Product B to store', async () => {
      const payload = {
        name: 'Product B - Leather Boots',
        price: 299.99,
        stock: 15,
        category: 'Footwear',
        emoji: '🥾',
        status: 'active',
      };
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products`, {
        method: 'POST',
        headers: headersDeviceA,
        body: JSON.stringify(payload),
      });
      if (res.status !== 201) throw new Error(`Failed to add Product B (${res.status})`);
      const body = await res.json();
      productB_Id = body.product.id;
      if (!productB_Id) throw new Error('Product B ID missing');
      console.log(`     Product B created: ${productB_Id}`);
    });

    await testStep('Device A: Refresh page / fetch state & verify both products remain', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products`, { headers: headersDeviceA });
      if (res.status !== 200) throw new Error(`Fetch products failed (${res.status})`);
      const body = await res.json();
      const ids = body.products.map((p: any) => p.id);
      if (!ids.includes(productA_Id) || !ids.includes(productB_Id)) {
        throw new Error(`Expected products [${productA_Id}, ${productB_Id}], found [${ids.join(', ')}]`);
      }
      if (body.products.length < 2) throw new Error('Less than 2 products returned');
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: DEVICE B - LOGIN WITH SAME ACCOUNT & HYDRATE STORE
    // ------------------------------------------------------------------------
    console.log('\n--- [PHASE 3: DEVICE B - SAME GOOGLE ACCOUNT PERSISTENCE] ---');

    await testStep('Device B: Login with SAME Google Account A & verify auth.uid()', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, { headers: headersDeviceB });
      if (res.status !== 200) throw new Error(`Auth failed on Device B`);
      const body = await res.json();
      if (body.user.id !== userA_Id) {
        throw new Error(`Device B expected auth.uid() = ${userA_Id}, got ${body.user.id}`);
      }
    });

    await testStep('Device B: Verify the EXACT SAME Store is resolved (owner_id match)', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, { headers: headersDeviceB });
      if (res.status !== 200) throw new Error(`State fetch on Device B failed`);
      const body = await res.json();
      if (body.store.id !== storeA_Id) {
        throw new Error(`Device B loaded wrong store: expected ${storeA_Id}, got ${body.store.id}`);
      }
      console.log(`     Device B successfully loaded Store: ${body.store.id}`);
    });

    await testStep('Device B: Verify Product A and Product B are displayed', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products`, { headers: headersDeviceB });
      if (res.status !== 200) throw new Error(`Device B failed to load products`);
      const body = await res.json();
      const names = body.products.map((p: any) => p.name);
      if (!names.some((n: string) => n.includes('Product A')) || !names.some((n: string) => n.includes('Product B'))) {
        throw new Error(`Device B missing products. Found: ${names.join(', ')}`);
      }
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: UPDATE TEST (EDIT ON DEVICE A -> VERIFY ON DEVICE B)
    // ------------------------------------------------------------------------
    console.log('\n--- [PHASE 4: UPDATE TEST ACROSS DEVICES] ---');

    await testStep('Device A: Edit Product A (name & price)', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products/${productA_Id}`, {
        method: 'PUT',
        headers: headersDeviceA,
        body: JSON.stringify({
          name: 'Product A - Premium Silk Shirt (Updated)',
          price: 249.99,
          stock: 40,
        }),
      });
      if (res.status !== 200) throw new Error(`Failed to update Product A (${res.status})`);
      const body = await res.json();
      if (body.product.price !== 249.99) throw new Error('Updated price did not persist');
    });

    await testStep('Device B: Refresh & verify the updated Product A appears', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products/${productA_Id}`, {
        headers: headersDeviceB,
      });
      if (res.status !== 200) throw new Error(`Device B failed to fetch updated product`);
      const body = await res.json();
      if (body.product.name !== 'Product A - Premium Silk Shirt (Updated)') {
        throw new Error(`Device B received stale name: ${body.product.name}`);
      }
      if (body.product.price !== 249.99) {
        throw new Error(`Device B received stale price: ${body.product.price}`);
      }
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: DELETE TEST (DELETE ON DEVICE A -> VERIFY ON DEVICE B)
    // ------------------------------------------------------------------------
    console.log('\n--- [PHASE 5: DELETE TEST ACROSS DEVICES] ---');

    await testStep('Device A: Delete Product B', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products/${productB_Id}`, {
        method: 'DELETE',
        headers: headersDeviceA,
      });
      if (res.status !== 200) throw new Error(`Device A delete failed (${res.status})`);
    });

    await testStep('Device B: Refresh & verify Product B NO LONGER appears', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products`, { headers: headersDeviceB });
      if (res.status !== 200) throw new Error(`Device B product fetch failed`);
      const body = await res.json();
      const ids = body.products.map((p: any) => p.id);
      if (ids.includes(productB_Id)) {
        throw new Error(`Product B still present on Device B after deletion!`);
      }
    });

    // ------------------------------------------------------------------------
    // SCENARIO 6: DIFFERENT USER ISOLATION TEST (ACCOUNT B)
    // ------------------------------------------------------------------------
    console.log('\n--- [PHASE 6: DIFFERENT USER ISOLATION TEST] ---');

    await testStep('Different User (Account B): Login & verify auth.uid() != Account A', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, { headers: headersAccountB });
      if (res.status !== 200) throw new Error('Account B auth failed');
      const body = await res.json();
      if (body.user.id !== userB_Id) {
        throw new Error(`Expected Account B ID ${userB_Id}, got ${body.user.id}`);
      }
      if (body.user.id === userA_Id) {
        throw new Error('Account B identity collided with Account A!');
      }
    });

    await testStep('Different User (Account B): Receives their OWN separate Store (owner_id = Account B)', async () => {
      const res = await fetch(`${baseUrl}/api/account/state`, { headers: headersAccountB });
      if (res.status !== 200) throw new Error('Account B state fetch failed');
      const body = await res.json();
      if (body.store.id === storeA_Id) {
        throw new Error('SECURITY VIOLATION: Account B was given Account A store!');
      }
      if (body.store.owner_id !== userB_Id && body.store.ownerId !== userB_Id) {
        throw new Error(`Expected Account B store owner_id = ${userB_Id}, got ${body.store.owner_id || body.store.ownerId}`);
      }
      console.log(`     Account B Store isolated: ${body.store.id} (owner_id: ${body.store.owner_id || body.store.ownerId})`);
    });

    await testStep('Different User (Account B): FORBIDDEN (403) from reading Account A products via store endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products`, {
        headers: headersAccountB,
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    await testStep('Different User (Account B): FORBIDDEN (403) from creating products in Account A store', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products`, {
        method: 'POST',
        headers: headersAccountB,
        body: JSON.stringify({ name: 'Hacker Product', price: 10, stock: 1 }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    await testStep('Different User (Account B): FORBIDDEN (403) from updating Account A products', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products/${productA_Id}`, {
        method: 'PUT',
        headers: headersAccountB,
        body: JSON.stringify({ name: 'Tampered Name', price: 1 }),
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

    await testStep('Different User (Account B): FORBIDDEN (403) from deleting Account A products', async () => {
      const res = await fetch(`${baseUrl}/api/stores/${storeA_Id}/products/${productA_Id}`, {
        method: 'DELETE',
        headers: headersAccountB,
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
    });

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runCrossDeviceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
