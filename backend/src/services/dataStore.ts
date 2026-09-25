import { randomUUID } from 'crypto';
import slugify from 'slugify';
import { getSupabaseClient, isLiveSupabaseConfigured } from './supabase.js';
import {
  UserRecord,
  StoreRecord,
  ProductRecord,
  OrderRecord,
  DeploymentRecord,
  generateNumericId,
} from '../types/index.js';
import { extractAndNormalizeOrderTimestamp } from '../utils/dateUtils.js';

// Isolated in-memory tables strictly for unit test mode fallback
const testMemUsers: Map<string, UserRecord> = new Map();
const testMemStores: Map<string, StoreRecord> = new Map();
const testMemProducts: Map<string, ProductRecord> = new Map();
const testMemOrders: Map<string, OrderRecord> = new Map();
const testMemDeployments: Map<string, DeploymentRecord> = new Map();

function useTestMemory(): boolean {
  return process.env.NODE_ENV === 'test' && !isLiveSupabaseConfigured();
}

/**
 * Automatically handles schema cache / missing column errors from Supabase/PostgREST.
 * If PostgREST reports that a column doesn't exist in the database schema, this helper
 * dynamically strips that column from the payload and retries the insert.
 */
async function resilientSupabaseInsert(
  client: any,
  table: string,
  initialPayload: Record<string, any>
): Promise<{ data: any; error: any }> {
  const payload = { ...initialPayload };
  let res = await client.from(table).insert(payload).select().single();
  let attempts = 0;

  while (res.error && attempts < 10) {
    attempts++;
    const errMsg = res.error.message || '';
    const match = errMsg.match(/(?:Could not find the '([^']+)' column|column "([^"]+)" of relation)/i);
    const missingCol = match ? (match[1] || match[2]) : null;

    if (missingCol && missingCol in payload) {
      delete payload[missingCol];
      res = await client.from(table).insert(payload).select().single();
    } else if (errMsg.includes('owner_id') && 'owner_id' in payload) {
      delete payload.owner_id;
      res = await client.from(table).insert(payload).select().single();
    } else {
      break;
    }
  }

  return res;
}

/**
 * Automatically handles schema cache / missing column errors from Supabase/PostgREST on update.
 */
async function resilientSupabaseUpdate(
  client: any,
  table: string,
  id: string | number,
  initialUpdates: Record<string, any>,
  idColumn: string = 'id'
): Promise<{ data: any; error: any }> {
  const updates = { ...initialUpdates };
  let res = await client
    .from(table)
    .update(updates)
    .eq(idColumn, id)
    .select()
    .single();
  let attempts = 0;

  while (res.error && attempts < 10) {
    attempts++;
    const errMsg = res.error.message || '';
    const match = errMsg.match(/(?:Could not find the '([^']+)' column|column "([^"]+)" of relation)/i);
    const missingCol = match ? (match[1] || match[2]) : null;

    if (missingCol && missingCol in updates) {
      delete updates[missingCol];
      res = await client
        .from(table)
        .update(updates)
        .eq(idColumn, id)
        .select()
        .single();
    } else {
      break;
    }
  }

  return res;
}

export const dataStore = {
  // --------------------------------------------------------------------------
  // USER / PROFILE OPERATIONS
  // --------------------------------------------------------------------------
  async upsertUser(user: {
    id: string;
    email: string;
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string | null;
  }): Promise<UserRecord> {
    const normalizedEmail = user.email.toLowerCase().trim();
    const effectiveId = user.id;
    const effectiveRole = user.role || 'merchant';

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload: Record<string, any> = {
        id: effectiveId,
        email: normalizedEmail,
        full_name: user.full_name || null,
        avatar_url: user.avatar_url || null,
        role: effectiveRole,
        updated_at: new Date().toISOString(),
      };

      // 1. Synchronize to public.profiles (primary per schema DDL)
      try {
        await client.from('profiles').upsert(payload, { onConflict: 'id' });
      } catch (err: any) {
        // Table might not exist yet if migration hasn't been executed
      }

      // 2. Synchronize to public.users (for backwards compatibility)
      try {
        const { data, error } = await client
          .from('users')
          .upsert(payload, { onConflict: 'id' })
          .select()
          .single();
        if (!error && data) {
          return data as UserRecord;
        }
      } catch (err: any) {
        // ignore
      }

      return {
        id: effectiveId,
        email: normalizedEmail,
        full_name: user.full_name || null,
        avatar_url: user.avatar_url || null,
      };
    }

    if (useTestMemory()) {
      // Mirror PostgreSQL unique constraint on email
      for (const [id, u] of testMemUsers.entries()) {
        if (u.email.toLowerCase() === normalizedEmail && id !== effectiveId) {
          testMemUsers.delete(id);
          for (const s of testMemStores.values()) {
            if (s.user_id === id) s.user_id = effectiveId;
          }
        }
      }

      const existing = testMemUsers.get(effectiveId);
      const updated: UserRecord = {
        id: effectiveId,
        email: normalizedEmail,
        full_name: user.full_name !== undefined ? user.full_name : existing?.full_name || null,
        avatar_url: user.avatar_url !== undefined ? user.avatar_url : existing?.avatar_url || null,
        role: user.role !== undefined ? user.role : existing?.role || effectiveRole,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      testMemUsers.set(effectiveId, updated);
      return updated;
    }

    return {
      id: effectiveId,
      email: normalizedEmail,
      full_name: user.full_name || null,
      avatar_url: user.avatar_url || null,
      role: effectiveRole,
    };
  },

  async getUserById(id: string): Promise<UserRecord | null> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      // Check profiles first
      try {
        const { data, error } = await client.from('profiles').select('*').eq('id', id).maybeSingle();
        if (!error && data) return data as UserRecord;
      } catch {}

      // Check users table
      try {
        const { data, error } = await client.from('users').select('*').eq('id', id).maybeSingle();
        if (!error && data) return data as UserRecord;
      } catch {}

      // Fallback: Check Supabase Auth admin
      try {
        const { data, error } = await client.auth.admin.getUserById(id);
        if (!error && data?.user) {
          const authUser = data.user;
          const userRec: UserRecord = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: (authUser.user_metadata?.full_name as string) || (authUser.user_metadata?.name as string) || null,
            avatar_url: (authUser.user_metadata?.avatar_url as string) || null,
          };
          await this.upsertUser(userRec);
          return userRec;
        }
      } catch {}

      return null;
    }

    if (useTestMemory()) {
      return testMemUsers.get(id) || null;
    }
    return null;
  },

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.toLowerCase().trim();
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      try {
        const { data, error } = await client.from('profiles').select('*').eq('email', normalized).maybeSingle();
        if (!error && data) return data as UserRecord;
      } catch {}

      try {
        const { data, error } = await client.from('users').select('*').eq('email', normalized).maybeSingle();
        if (!error && data) return data as UserRecord;
      } catch {}

      // Fallback: Check Supabase Auth admin list
      try {
        const { data, error } = await client.auth.admin.listUsers();
        if (!error && data?.users) {
          const found = data.users.find((u) => u.email?.toLowerCase().trim() === normalized);
          if (found) {
            const userRec: UserRecord = {
              id: found.id,
              email: found.email || normalized,
              full_name: (found.user_metadata?.full_name as string) || (found.user_metadata?.name as string) || null,
              avatar_url: (found.user_metadata?.avatar_url as string) || null,
            };
            await this.upsertUser(userRec);
            return userRec;
          }
        }
      } catch {}

      return null;
    }

    if (useTestMemory()) {
      for (const u of testMemUsers.values()) {
        if (u.email.toLowerCase() === normalized) return u;
      }
    }
    return null;
  },

  // --------------------------------------------------------------------------
  // STORE OPERATIONS
  // --------------------------------------------------------------------------
  async getStoresByUserId(userId: string): Promise<StoreRecord[]> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      let data: any[] | null = null;
      let error: any = null;

      // Primary check: try querying by owner_id or user_id
      try {
        const res = await client
          .from('stores')
          .select('*')
          .or(`owner_id.eq.${userId},user_id.eq.${userId}`)
          .order('created_at', { ascending: false });
        data = res.data;
        error = res.error;
      } catch (err: any) {
        error = err;
      }

      // If owner_id query fails (e.g. column owner_id not yet created), fallback to user_id
      if (error) {
        const fallbackRes = await client
          .from('stores')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (fallbackRes.error) {
          throw new Error(`Database error fetching stores: ${fallbackRes.error.message}`);
        }
        data = fallbackRes.data;
      }

      if (data) {
        return data.map((s, idx) => ({
          ...s,
          owner_id: s.owner_id || s.user_id,
          user_id: s.user_id || s.owner_id,
          name: s.name || s.store_name || s.shop_name || 'My Store',
          store_name: s.store_name || s.name || s.shop_name || 'My Store',
          shop_name: s.shop_name || s.name || 'My Store',
          phone: s.phone || s.contact_phone || null,
          contact_phone: s.contact_phone || s.phone || null,
          address: s.address || s.location || '',
          location: s.location || s.address || '',
          selected_template_id: s.selected_template_id || s.selected_template || 'obsidian-classic',
          is_default: s.is_default ?? (idx === 0),
        })) as StoreRecord[];
      }
      return [];
    }

    if (useTestMemory()) {
      return Array.from(testMemStores.values())
        .filter((s) => (s.owner_id && s.owner_id === userId) || s.user_id === userId)
        .map((s) => ({
          ...s,
          owner_id: s.owner_id || s.user_id,
          store_name: s.store_name || s.name,
          phone: s.phone || s.contact_phone || null,
          contact_phone: s.contact_phone || s.phone || null,
        }))
        .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
    }
    return [];
  },

  async getStoreByOwnerId(ownerId: string): Promise<StoreRecord | null> {
    const stores = await this.getStoresByUserId(ownerId);
    if (stores.length === 0) return null;
    return stores.find((s) => s.owner_id === ownerId) || stores[0];
  },

  async getStoreById(storeId: string): Promise<StoreRecord | null> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from('stores').select('*').eq('id', storeId).maybeSingle();
      if (error) {
        throw new Error(`Database error fetching store by ID: ${error.message}`);
      }
      if (data) {
        return {
          ...data,
          owner_id: data.owner_id || data.user_id,
          user_id: data.user_id || data.owner_id,
          name: data.name || data.store_name || data.shop_name || 'My Store',
          store_name: data.store_name || data.name || data.shop_name || 'My Store',
          shop_name: data.shop_name || data.name || 'My Store',
          phone: data.phone || data.contact_phone || null,
          contact_phone: data.contact_phone || data.phone || null,
          address: data.address || data.location || '',
          location: data.location || data.address || '',
          selected_template_id: data.selected_template_id || data.selected_template || 'obsidian-classic',
        } as StoreRecord;
      }
      return null;
    }

    if (useTestMemory()) {
      const store = testMemStores.get(storeId);
      if (!store) return null;
      return {
        ...store,
        owner_id: store.owner_id || store.user_id,
        store_name: store.store_name || store.name,
        phone: store.phone || store.contact_phone || null,
        contact_phone: store.contact_phone || store.phone || null,
      };
    }
    return null;
  },

  async getStoreBySlug(slug: string): Promise<StoreRecord | null> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from('stores').select('*').eq('slug', slug).maybeSingle();
      if (error) {
        throw new Error(`Database error fetching store by slug: ${error.message}`);
      }
      if (data) {
        return {
          ...data,
          owner_id: data.owner_id || data.user_id,
          user_id: data.user_id || data.owner_id,
          name: data.name || data.shop_name || 'My Store',
          shop_name: data.shop_name || data.name || 'My Store',
          address: data.address || data.location || '',
          location: data.location || data.address || '',
          selected_template_id: data.selected_template_id || data.selected_template || 'obsidian-classic',
        } as StoreRecord;
      }
      return null;
    }

    if (useTestMemory()) {
      for (const store of testMemStores.values()) {
        if (store.slug === slug) return store;
      }
    }
    return null;
  },

  /**
   * Idempotent default store resolution for an authenticated user.
   * Ensures the same user receives the EXACT same store every time across all devices.
   */
  async getOrCreateDefaultStoreForUser(
    userId: string,
    defaults?: Partial<StoreRecord>
  ): Promise<StoreRecord> {
    const stores = await this.getStoresByUserId(userId);

    // 1. Look for store matching owner_id
    const ownerStore = stores.find((s) => s.owner_id === userId);
    if (ownerStore) return ownerStore;

    // 2. Look for explicit default store
    const defaultStore = stores.find((s) => s.is_default);
    if (defaultStore) {
      if (!defaultStore.owner_id) {
        try {
          await this.updateStore(defaultStore.id, { owner_id: userId });
          defaultStore.owner_id = userId;
        } catch {}
      }
      return defaultStore;
    }

    // 3. If user already owns at least one store, return the oldest or populated one
    if (stores.length > 0) {
      const selected = stores[0];
      if (!selected.owner_id) {
        try {
          await this.updateStore(selected.id, { owner_id: userId });
          selected.owner_id = userId;
        } catch {}
      }
      return selected;
    }

    // 4. User has ZERO stores: Create an initial store linked to auth.users.id
    const storeName = defaults?.name || (defaults as any)?.shop_name || 'My Store';
    const baseSlug = (slugify as any).default
      ? (slugify as any).default(storeName, { lower: true, strict: true })
      : slugify(storeName, { lower: true, strict: true }) || 'store';

    let slug = baseSlug;
    let suffix = 1;
    while (await this.getStoreBySlug(slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }

    try {
      return await this.createStore({
        owner_id: userId,
        user_id: userId,
        name: storeName,
        slug,
        business_type: defaults?.business_type || 'clothing',
        description: defaults?.description || 'Curated storefront collection',
        currency: defaults?.currency || '₹',
        address: defaults?.address || null,
        address_method: defaults?.address_method || 'manual',
        contact_email: defaults?.contact_email || null,
        contact_phone: defaults?.contact_phone || null,
        social_links: defaults?.social_links || { instagram: '', facebook: '', twitter: '', whatsapp: '' },
        selected_template_id: defaults?.selected_template_id || 'obsidian-classic',
        is_default: true,
      });
    } catch (err: any) {
      // Race-condition protection: If duplicate was created concurrently by another device, return existing
      const existingAfterRace = await this.getStoresByUserId(userId);
      if (existingAfterRace.length > 0) {
        return existingAfterRace[0];
      }
      throw err;
    }
  },

  async createStore(store: Omit<StoreRecord, 'id' | 'created_at' | 'updated_at'>): Promise<StoreRecord> {
    const storeName = store.name || store.store_name || (store as any).shop_name || 'My Store';
    const storeAddress = store.address || (store as any).location || '';
    const storeOwner = (store as any).owner_name || 'Store Owner';
    const storePhone = store.phone || store.contact_phone || null;
    const effectiveOwnerId = store.owner_id || store.user_id;
    const effectiveUserId = store.user_id || store.owner_id || effectiveOwnerId;

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload: Record<string, any> = {
        owner_id: effectiveOwnerId,
        user_id: effectiveUserId,
        name: storeName,
        store_name: storeName,
        owner_name: storeOwner,
        slug: store.slug,
        business_type: store.business_type || 'clothing',
        address: storeAddress,
        address_method: store.address_method || 'manual',
        latitude: store.latitude ?? null,
        longitude: store.longitude ?? null,
        place_id: store.place_id ?? null,
        formatted_address: store.formatted_address ?? null,
        maps_url: store.maps_url ?? null,
        location_source: store.location_source || 'manual',
        currency: store.currency || '₹',
        description: store.description || null,
        logo_url: store.logo_url || null,
        banner_url: store.banner_url || null,
        contact_email: store.contact_email || null,
        contact_phone: storePhone,
        phone: storePhone,
        social_links: store.social_links || {},
        selected_template_id: store.selected_template_id || 'obsidian-classic',
        live_url: store.live_url || null,
        vercel_project_id: store.vercel_project_id || null,
        is_default: store.is_default ?? true,
      };

      const { data, error } = await resilientSupabaseInsert(client, 'stores', payload);

      if (error) {
        throw new Error(`Supabase store creation failed: ${error.message}`);
      }
      return {
        ...data,
        owner_id: data.owner_id || effectiveOwnerId,
        user_id: data.user_id || effectiveUserId,
        name: data.name || data.store_name || storeName,
        store_name: data.store_name || data.name || storeName,
        phone: data.phone || data.contact_phone || storePhone,
        contact_phone: data.contact_phone || data.phone || storePhone,
        is_default: store.is_default ?? true,
      } as StoreRecord;
    }

    if (useTestMemory()) {
      const newStore: StoreRecord = {
        ...store,
        id: randomUUID(),
        owner_id: effectiveOwnerId,
        user_id: effectiveUserId,
        name: storeName,
        store_name: storeName,
        phone: storePhone,
        contact_phone: storePhone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      testMemStores.set(newStore.id, newStore);
      return newStore;
    }

    throw new Error('Supabase is not configured and test memory is inactive.');
  },

  async updateStore(storeId: string, updates: Partial<StoreRecord>): Promise<StoreRecord> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const safeUpdates: Record<string, any> = {};
      if (updates.name !== undefined || updates.store_name !== undefined) {
        const val = updates.name || updates.store_name;
        safeUpdates.name = val;
        safeUpdates.store_name = val;
      }
      if (updates.business_type !== undefined) safeUpdates.business_type = updates.business_type;
      if (updates.custom_business_type !== undefined) safeUpdates.custom_business_type = updates.custom_business_type;
      if (updates.custom_options !== undefined) safeUpdates.custom_options = updates.custom_options;
      if (updates.address !== undefined) {
        safeUpdates.address = updates.address;
      }
      if (updates.address_method !== undefined) safeUpdates.address_method = updates.address_method;
      if (updates.currency !== undefined) safeUpdates.currency = updates.currency;
      if (updates.description !== undefined) safeUpdates.description = updates.description;
      if (updates.logo_url !== undefined) safeUpdates.logo_url = updates.logo_url;
      if (updates.banner_url !== undefined) safeUpdates.banner_url = updates.banner_url;
      if (updates.contact_email !== undefined) safeUpdates.contact_email = updates.contact_email;
      if (updates.contact_phone !== undefined || updates.phone !== undefined) {
        const phoneVal = updates.phone || updates.contact_phone;
        safeUpdates.contact_phone = phoneVal;
        safeUpdates.phone = phoneVal;
      }
      if (updates.social_links !== undefined) safeUpdates.social_links = updates.social_links;
      if (updates.selected_template_id !== undefined) {
        safeUpdates.selected_template_id = updates.selected_template_id;
      }
      if (updates.live_url !== undefined) safeUpdates.live_url = updates.live_url;
      if (updates.vercel_project_id !== undefined) safeUpdates.vercel_project_id = updates.vercel_project_id;
      if (updates.slug !== undefined) safeUpdates.slug = updates.slug;
      if (updates.latitude !== undefined) safeUpdates.latitude = updates.latitude;
      if (updates.longitude !== undefined) safeUpdates.longitude = updates.longitude;
      if (updates.place_id !== undefined) safeUpdates.place_id = updates.place_id;
      if (updates.formatted_address !== undefined) safeUpdates.formatted_address = updates.formatted_address;
      if (updates.maps_url !== undefined) safeUpdates.maps_url = updates.maps_url;
      if (updates.location_source !== undefined) safeUpdates.location_source = updates.location_source;
      if (updates.owner_id !== undefined) safeUpdates.owner_id = updates.owner_id;
      if (updates.user_id !== undefined) safeUpdates.user_id = updates.user_id;
      if (updates.is_default !== undefined) safeUpdates.is_default = updates.is_default;
      safeUpdates.updated_at = new Date().toISOString();

      const { data, error } = await resilientSupabaseUpdate(client, 'stores', storeId, safeUpdates);

      if (error) {
        throw new Error(`Failed to update store: ${error.message}`);
      }
      return {
        ...data,
        owner_id: data.owner_id || safeUpdates.owner_id || data.user_id,
        user_id: data.user_id || safeUpdates.user_id || data.owner_id,
        name: data.name || data.store_name || safeUpdates.name,
        store_name: data.store_name || data.name || safeUpdates.name,
        phone: data.phone || data.contact_phone || safeUpdates.phone,
        contact_phone: data.contact_phone || data.phone || safeUpdates.phone,
        is_default: data.is_default ?? true,
      } as StoreRecord;
    }

    if (useTestMemory()) {
      const existing = testMemStores.get(storeId);
      if (!existing) throw new Error('Store not found');
      const resolvedName = updates.name || updates.store_name || existing.name;
      const resolvedPhone = updates.phone || updates.contact_phone || existing.phone;

      const updated: StoreRecord = {
        ...existing,
        ...updates,
        owner_id: updates.owner_id !== undefined ? updates.owner_id : existing.owner_id,
        user_id: updates.user_id !== undefined ? updates.user_id : existing.user_id,
        name: resolvedName,
        store_name: resolvedName,
        phone: resolvedPhone,
        contact_phone: resolvedPhone,
        updated_at: new Date().toISOString(),
      };
      testMemStores.set(storeId, updated);
      return updated;
    }

    throw new Error('Store not found or database unavailable');
  },

  async deleteStore(storeId: string, userId?: string): Promise<boolean> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      let query = client.from('stores').delete().eq('id', storeId);
      if (userId) {
        query = query.or(`owner_id.eq.${userId},user_id.eq.${userId}`);
      }
      const { error } = await query;
      if (error) {
        throw new Error(`Failed to delete store: ${error.message}`);
      }
      return true;
    }

    if (useTestMemory()) {
      const existing = testMemStores.get(storeId);
      if (!existing) return false;
      if (userId && existing.owner_id !== userId && existing.user_id !== userId) {
        throw new Error('Forbidden: You do not have permission to delete this store.');
      }
      // Cascade delete associated products, orders, deployments
      for (const [pId, p] of testMemProducts.entries()) {
        if (p.store_id === storeId) testMemProducts.delete(pId);
      }
      for (const [oId, o] of testMemOrders.entries()) {
        if (o.store_id === storeId) testMemOrders.delete(oId);
      }
      for (const [dId, d] of testMemDeployments.entries()) {
        if (d.store_id === storeId) testMemDeployments.delete(dId);
      }
      testMemStores.delete(storeId);
      return true;
    }

    return false;
  },

  async clearStoreProducts(storeId: string): Promise<number> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { count, error } = await client
        .from('products')
        .delete({ count: 'exact' })
        .eq('store_id', storeId);
      if (error) throw new Error(`Failed to clear products: ${error.message}`);
      return count || 0;
    }

    if (useTestMemory()) {
      let deletedCount = 0;
      for (const [id, product] of testMemProducts.entries()) {
        if (product.store_id === storeId) {
          testMemProducts.delete(id);
          deletedCount++;
        }
      }
      return deletedCount;
    }
    return 0;
  },

  async clearStoreOrders(storeId: string): Promise<number> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { count, error } = await client
        .from('orders')
        .delete({ count: 'exact' })
        .eq('store_id', storeId);
      if (error) throw new Error(`Failed to clear orders: ${error.message}`);
      return count || 0;
    }

    if (useTestMemory()) {
      let deletedCount = 0;
      for (const [id, order] of testMemOrders.entries()) {
        if (order.store_id === storeId) {
          testMemOrders.delete(id);
          deletedCount++;
        }
      }
      return deletedCount;
    }
    return 0;
  },

  // --------------------------------------------------------------------------
  // PRODUCT OPERATIONS (Zero Mock / Demo Data)
  // --------------------------------------------------------------------------
  async getProductsByStoreId(
    storeId: string,
    filters?: { search?: string; category?: string; status?: string }
  ): Promise<ProductRecord[]> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      let query = client.from('products').select('*').eq('store_id', storeId);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.search) query = query.ilike('name', `%${filters.search}%`);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch products: ${error.message}`);
      // Return authoritative database rows without mock product injection
      return (data || []) as ProductRecord[];
    }

    if (useTestMemory()) {
      let products = Array.from(testMemProducts.values()).filter((p) => p.store_id === storeId);
      if (filters?.category) {
        products = products.filter(
          (p) => p.category.toLowerCase() === filters.category?.toLowerCase()
        );
      }
      if (filters?.status) {
        products = products.filter((p) => p.status === filters.status);
      }
      if (filters?.search) {
        const term = filters.search.toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.description && p.description.toLowerCase().includes(term))
        );
      }
      return products;
    }

    return [];
  },

  async getProductById(productId: string | number): Promise<ProductRecord | null> {
    const rawStr = String(productId).trim();
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from('products').select('*').eq('id', rawStr).maybeSingle();
      if (error) throw new Error(`Error fetching product: ${error.message}`);
      return (data as ProductRecord) || null;
    }

    if (useTestMemory()) {
      return testMemProducts.get(rawStr) || null;
    }
    return null;
  },

  async getProductByClientOrBackendId(
    storeId: string,
    idOrClientId: string | number
  ): Promise<ProductRecord | null> {
    const rawStr = String(idOrClientId).trim();
    const asNum = Number(rawStr);
    const isNumeric = !isNaN(asNum) && !rawStr.includes('-');

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (isNumeric) {
        // Match either primary key id or client_id column
        const { data: byId } = await client
          .from('products')
          .select('*')
          .eq('store_id', storeId)
          .eq('id', asNum)
          .maybeSingle();
        if (byId) return byId as ProductRecord;

        const { data: byClientId } = await client
          .from('products')
          .select('*')
          .eq('store_id', storeId)
          .eq('client_id', asNum)
          .maybeSingle();
        if (byClientId) return byClientId as ProductRecord;
      } else {
        const { data } = await client
          .from('products')
          .select('*')
          .eq('store_id', storeId)
          .eq('id', rawStr)
          .maybeSingle();
        if (data) return data as ProductRecord;
      }
      return null;
    }

    if (useTestMemory()) {
      for (const product of testMemProducts.values()) {
        if (product.store_id === storeId) {
          if (isNumeric && (Number(product.client_id) === asNum || Number(product.id) === asNum)) return product;
          if (String(product.id) === rawStr) return product;
        }
      }
    }
    return null;
  },

  async createProduct(
    product: Omit<ProductRecord, 'id' | 'created_at' | 'updated_at'> & { id?: number | string }
  ): Promise<ProductRecord> {
    const clientId =
      product.client_id !== undefined && product.client_id !== null
        ? Number(product.client_id)
        : product.id !== undefined && typeof product.id === 'number'
        ? product.id
        : generateNumericId();

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload: Record<string, any> = {
        store_id: product.store_id,
        client_id: clientId,
        name: product.name,
        price: Number(product.price) || 0,
        discount_price:
          product.discount_price !== undefined && product.discount_price !== null
            ? Number(product.discount_price)
            : null,
        stock: product.stock !== undefined ? Number(product.stock) : 10,
        emoji: product.emoji || '📦',
        category: product.category || 'General',
        description: product.description || '',
        image_url: product.image_url || null,
        status: product.status || 'active',
      };

      const { data, error } = await resilientSupabaseInsert(client, 'products', payload);
      if (error) {
        throw new Error(`Failed to create product in PostgreSQL: ${error.message}`);
      }
      return { ...data, client_id: clientId } as ProductRecord;
    }

    if (useTestMemory()) {
      const newProduct: ProductRecord = {
        ...product,
        client_id: clientId,
        id: String(clientId),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      testMemProducts.set(String(newProduct.id), newProduct);
      return newProduct;
    }

    throw new Error('Database unavailable for creating product');
  },

  async updateProduct(
    productId: string | number,
    updates: Partial<ProductRecord>
  ): Promise<ProductRecord> {
    const rawId = String(productId);
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const safeUpdates: Record<string, any> = {};
      if (updates.name !== undefined) safeUpdates.name = updates.name;
      if (updates.price !== undefined) safeUpdates.price = Number(updates.price) || 0;
      if (updates.discount_price !== undefined) safeUpdates.discount_price = updates.discount_price;
      if (updates.stock !== undefined) safeUpdates.stock = Number(updates.stock) || 0;
      if (updates.emoji !== undefined) safeUpdates.emoji = updates.emoji;
      if (updates.category !== undefined) safeUpdates.category = updates.category;
      if (updates.description !== undefined) safeUpdates.description = updates.description;
      if (updates.image_url !== undefined) safeUpdates.image_url = updates.image_url;
      if (updates.status !== undefined) safeUpdates.status = updates.status;
      if (updates.client_id !== undefined) safeUpdates.client_id = updates.client_id;
      safeUpdates.updated_at = new Date().toISOString();

      const { data, error } = await resilientSupabaseUpdate(client, 'products', rawId, safeUpdates);

      if (error) {
        throw new Error(`Failed to update product: ${error.message}`);
      }
      return data as ProductRecord;
    }

    if (useTestMemory()) {
      const existing = testMemProducts.get(rawId);
      if (!existing) throw new Error('Product not found');
      const updated: ProductRecord = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      testMemProducts.set(rawId, updated);
      return updated;
    }

    throw new Error('Product not found');
  },

  async adjustStock(productId: string | number, delta: number): Promise<ProductRecord> {
    const product = await this.getProductById(productId);
    if (!product) throw new Error('Product not found');

    const newStock = Math.max(0, Number(product.stock || 0) + delta);
    return await this.updateProduct(product.id, { stock: newStock });
  },

  async deleteProduct(productId: string | number): Promise<void> {
    const rawId = String(productId);
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client.from('products').delete().eq('id', rawId);
      if (error) throw new Error(`Failed to delete product: ${error.message}`);
      return;
    }

    if (useTestMemory()) {
      testMemProducts.delete(rawId);
    }
  },

  // --------------------------------------------------------------------------
  // ORDER OPERATIONS
  // --------------------------------------------------------------------------
  async getOrdersByStoreId(storeId: string): Promise<OrderRecord[]> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('orders')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch orders: ${error.message}`);
      return (data || []) as OrderRecord[];
    }

    if (useTestMemory()) {
      return Array.from(testMemOrders.values())
        .filter((o) => o.store_id === storeId)
        .sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
    }
    return [];
  },

  async getOrderById(orderId: string | number): Promise<OrderRecord | null> {
    const rawId = String(orderId);
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from('orders').select('*').eq('id', rawId).maybeSingle();
      if (error) throw new Error(`Failed to fetch order: ${error.message}`);
      return (data as OrderRecord) || null;
    }

    if (useTestMemory()) {
      return testMemOrders.get(rawId) || null;
    }
    return null;
  },

  async getOrderByClientOrBackendId(
    storeId: string,
    idOrClientId: string | number
  ): Promise<OrderRecord | null> {
    const rawStr = String(idOrClientId).trim();
    const asNum = Number(rawStr);
    const isNumeric = !isNaN(asNum) && !rawStr.includes('-');

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (isNumeric) {
        const { data: byId } = await client
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .eq('id', asNum)
          .maybeSingle();
        if (byId) return byId as OrderRecord;

        const { data: byClientId } = await client
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .eq('client_id', asNum)
          .maybeSingle();
        if (byClientId) return byClientId as OrderRecord;
      } else {
        const { data } = await client
          .from('orders')
          .select('*')
          .eq('store_id', storeId)
          .eq('id', rawStr)
          .maybeSingle();
        if (data) return data as OrderRecord;
      }
      return null;
    }

    if (useTestMemory()) {
      for (const order of testMemOrders.values()) {
        if (order.store_id === storeId) {
          if (isNumeric && (Number(order.client_id) === asNum || Number(order.id) === asNum)) return order;
          if (String(order.id) === rawStr) return order;
        }
      }
    }
    return null;
  },

  async createOrder(
    order: Omit<OrderRecord, 'id' | 'order_date'> & { id?: number | string; order_date?: string; [key: string]: any }
  ): Promise<OrderRecord> {
    const clientId =
      order.client_id !== undefined && order.client_id !== null
        ? Number(order.client_id)
        : order.id !== undefined && typeof order.id === 'number'
        ? order.id
        : generateNumericId();

    const totalAmount = Number(order.total_price ?? order.total_amount ?? 0);
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const normalizedDate = extractAndNormalizeOrderTimestamp(order);

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const payload: Record<string, any> = {
        store_id: order.store_id,
        client_id: clientId,
        customer_name: order.customer_name,
        customer_email: order.customer_email || null,
        customer_phone: order.customer_phone || null,
        customer_address: order.customer_address || null,
        payment_method: order.payment_method || null,
        product_name: order.product_name,
        product_id: order.product_id ? String(order.product_id) : null,
        quantity: Number(order.quantity) || 1,
        total_price: totalAmount,
        total_amount: totalAmount,
        items: orderItems,
        status: order.status || 'pending',
        date: normalizedDate,
        order_date: normalizedDate,
      };

      const { data, error } = await resilientSupabaseInsert(client, 'orders', payload);
      if (error) {
        throw new Error(`Failed to create order in PostgreSQL: ${error.message}`);
      }
      return {
        ...data,
        client_id: clientId,
        date: normalizedDate,
        order_date: normalizedDate,
      } as OrderRecord;
    }

    if (useTestMemory()) {
      const newOrder: OrderRecord = {
        ...order,
        client_id: clientId,
        id: String(clientId),
        total_price: totalAmount,
        total_amount: totalAmount,
        items: orderItems,
        customer_email: order.customer_email || null,
        customer_phone: order.customer_phone || null,
        customer_address: order.customer_address || null,
        payment_method: order.payment_method || null,
        order_date: normalizedDate,
        date: normalizedDate,
      };
      testMemOrders.set(String(newOrder.id), newOrder);
      return newOrder;
    }

    throw new Error('Database unavailable for order creation');
  },

  /**
   * Atomic Order Placement:
   * 1. Validates product existence and status.
   * 2. Validates inventory stock >= quantity (prevents overselling).
   * 3. Calculates price strictly server-side.
   * 4. Deducts stock and inserts order atomically.
   */
  async placeOrderAtomic(params: {
    store_id: string;
    product_id: string | number;
    client_id?: number | null;
    customer_name: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    payment_method?: string | null;
    quantity: number;
    status?: 'pending' | 'processing' | 'completed' | 'cancelled';
    items?: any[] | null;
    total_price?: number;
    total_amount?: number;
  }): Promise<{ order: OrderRecord; remainingStock: number }> {
    const {
      store_id,
      product_id,
      client_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      payment_method,
      quantity,
      status = 'pending',
      items,
      total_price,
      total_amount,
    } = params;

    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    // Try Supabase PostgreSQL RPC if available
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      try {
        const { data, error } = await client.rpc('place_order_atomic', {
          p_store_id: store_id,
          p_product_id: Number(product_id),
          p_client_id: client_id || generateNumericId(),
          p_customer_name: customer_name,
          p_quantity: quantity,
          p_status: status,
        });

        if (!error && data?.order) {
          return {
            order: data.order as OrderRecord,
            remainingStock: Number(data.remaining_stock),
          };
        }
      } catch {
        // Fall back to server-side atomic transaction flow
      }
    }

    // Server-side atomic validation and deduction
    const product = await this.getProductByClientOrBackendId(store_id, product_id);
    if (!product || product.store_id !== store_id) {
      throw new Error('Product not found in this store');
    }

    if (product.status !== 'active') {
      throw new Error('Product is currently inactive and cannot be ordered');
    }

    if (Number(product.stock || 0) < quantity) {
      const err: any = new Error(
        `Insufficient inventory. Available stock is ${product.stock}, but requested ${quantity}.`
      );
      err.code = 'INSUFFICIENT_STOCK';
      throw err;
    }

    // Authoritative server-side price calculation
    const unitPrice =
      product.discount_price !== null && product.discount_price !== undefined
        ? Number(product.discount_price)
        : Number(product.price);
    const calculatedTotal = Math.round(unitPrice * quantity * 100) / 100;

    // Deduct stock
    const updatedProduct = await this.adjustStock(product.id, -quantity);

    // Create order record
    const order = await this.createOrder({
      store_id,
      product_id: String(product.id),
      client_id: client_id || generateNumericId(),
      customer_name,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      customer_address: customer_address || null,
      payment_method: payment_method || null,
      product_name: product.name,
      quantity,
      total_price: calculatedTotal,
      total_amount: calculatedTotal,
      items: items || [
        {
          productId: product.client_id || product.id,
          productName: product.name,
          quantity,
          price: unitPrice,
          unitPrice,
          emoji: product.emoji,
          image: product.image_url,
        },
      ],
      status,
    });

    return {
      order,
      remainingStock: Number(updatedProduct.stock),
    };
  },

  /**
   * Multi-Item Atomic Order Placement:
   * Validates inventory across multiple items and deducts stock for all catalog items.
   */
  async placeMultiItemOrderAtomic(params: {
    store_id: string;
    items: any[];
    client_id?: number | null;
    customer_name: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    payment_method?: string | null;
    status?: 'pending' | 'processing' | 'completed' | 'cancelled';
    total_price?: number;
    total_amount?: number;
  }): Promise<{ order: OrderRecord; remainingStocks: Array<{ productId: string | number; stock: number }> }> {
    const {
      store_id,
      items,
      client_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      payment_method,
      status = 'pending',
    } = params;

    if (!items || items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    const itemDeductions: Array<{ product: ProductRecord; qty: number; unitPrice: number }> = [];
    let calculatedTotal = 0;
    const remainingStocks: Array<{ productId: string | number; stock: number }> = [];

    // Step 1: Pre-validate all items
    for (const item of items) {
      const rawPid = item.productId ?? item.product_id ?? item.id;
      const qty = Number(item.quantity ?? item.qty ?? 1);
      if (qty <= 0) {
        throw new Error('Item quantity must be greater than zero');
      }

      let matchedProduct: ProductRecord | null = null;
      if (rawPid !== undefined && rawPid !== null && String(rawPid).trim() !== '') {
        matchedProduct = await this.getProductByClientOrBackendId(store_id, rawPid);
        if (!matchedProduct) {
          throw new Error(`Product "${rawPid}" does not belong to this store or does not exist`);
        }
      }

      if (matchedProduct) {
        if (matchedProduct.status !== 'active') {
          throw new Error(`Product "${matchedProduct.name}" is currently inactive and cannot be ordered`);
        }
        if (Number(matchedProduct.stock || 0) < qty) {
          const err: any = new Error(
            `Insufficient inventory for "${matchedProduct.name}". Available: ${matchedProduct.stock}, requested: ${qty}.`
          );
          err.code = 'INSUFFICIENT_STOCK';
          throw err;
        }
        const unitPrice =
          matchedProduct.discount_price !== null && matchedProduct.discount_price !== undefined
            ? Number(matchedProduct.discount_price)
            : Number(matchedProduct.price);
        calculatedTotal += unitPrice * qty;
        itemDeductions.push({ product: matchedProduct, qty, unitPrice });
      } else {
        const itemPrice = Number(item.price ?? item.unitPrice ?? item.unit_price ?? 0);
        calculatedTotal += itemPrice * qty;
      }
    }

    // Step 2: Deduct stock for all matched products
    for (const deduction of itemDeductions) {
      const updated = await this.adjustStock(deduction.product.id, -deduction.qty);
      remainingStocks.push({
        productId: deduction.product.client_id || deduction.product.id,
        stock: Number(updated.stock),
      });
    }

    const finalTotal =
      calculatedTotal > 0
        ? Math.round(calculatedTotal * 100) / 100
        : params.total_amount !== undefined && Number(params.total_amount) > 0
        ? Number(params.total_amount)
        : params.total_price !== undefined && Number(params.total_price) > 0
        ? Number(params.total_price)
        : 0;

    const consolidatedName = items
      .map(
        (i) =>
          `${i.productName || i.product_name || i.name || i.title || 'Product'} (x${
            i.quantity || i.qty || 1
          })`
      )
      .join(', ');

    const totalQty = items.reduce((sum, i) => sum + Number(i.quantity || i.qty || 1), 0);
    const primaryProductId = items[0]?.productId ?? items[0]?.product_id ?? null;

    // Step 3: Insert order
    const order = await this.createOrder({
      store_id,
      product_id: primaryProductId ? String(primaryProductId) : null,
      client_id: client_id || generateNumericId(),
      customer_name,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      customer_address: customer_address || null,
      payment_method: payment_method || null,
      product_name: consolidatedName,
      quantity: totalQty,
      total_price: finalTotal,
      total_amount: finalTotal,
      items,
      status,
    });

    return { order, remainingStocks };
  },

  async updateOrderStatus(
    orderId: string | number,
    status: 'pending' | 'processing' | 'completed' | 'cancelled'
  ): Promise<OrderRecord> {
    const rawId = String(orderId);
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('orders')
        .update({ status })
        .eq('id', rawId)
        .select()
        .single();
      if (error) throw new Error(`Failed to update order status: ${error.message}`);
      return data as OrderRecord;
    }

    if (useTestMemory()) {
      const existing = testMemOrders.get(rawId);
      if (!existing) throw new Error('Order not found');
      const updated = { ...existing, status };
      testMemOrders.set(rawId, updated);
      return updated;
    }

    throw new Error('Order not found');
  },

  async deleteOrder(orderId: string | number): Promise<void> {
    const rawId = String(orderId);
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { error } = await client.from('orders').delete().eq('id', rawId);
      if (error) throw new Error(`Failed to delete order: ${error.message}`);
      return;
    }

    if (useTestMemory()) {
      testMemOrders.delete(rawId);
    }
  },

  // --------------------------------------------------------------------------
  // DEPLOYMENT OPERATIONS
  // --------------------------------------------------------------------------
  async createDeployment(
    deployment: Omit<DeploymentRecord, 'id' | 'created_at'>
  ): Promise<DeploymentRecord> {
    const payload = {
      ...deployment,
      updated_at: new Date().toISOString(),
    };

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client.from('deployments').insert(payload).select().single();
      if (error) throw new Error(`Failed to save deployment: ${error.message}`);
      return data as DeploymentRecord;
    }

    if (useTestMemory()) {
      const newDep: DeploymentRecord = {
        ...payload,
        id: randomUUID(),
        created_at: new Date().toISOString(),
      };
      testMemDeployments.set(newDep.id, newDep);
      return newDep;
    }

    throw new Error('Database unavailable');
  },

  async updateDeployment(
    deploymentId: string,
    updates: Partial<DeploymentRecord>
  ): Promise<DeploymentRecord | null> {
    const safeUpdates: any = { ...updates, updated_at: new Date().toISOString() };

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('deployments')
        .update(safeUpdates)
        .eq('id', deploymentId)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update deployment: ${error.message}`);
      return (data as DeploymentRecord) || null;
    }

    if (useTestMemory()) {
      const existing = testMemDeployments.get(deploymentId);
      if (!existing) return null;
      const updated: DeploymentRecord = {
        ...existing,
        ...safeUpdates,
      };
      testMemDeployments.set(deploymentId, updated);
      return updated;
    }

    return null;
  },

  async updateDeploymentByVercelId(
    vercelDeploymentId: string,
    updates: Partial<DeploymentRecord>
  ): Promise<DeploymentRecord | null> {
    const safeUpdates: any = { ...updates, updated_at: new Date().toISOString() };

    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('deployments')
        .update(safeUpdates)
        .eq('vercel_deployment_id', vercelDeploymentId)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update deployment by Vercel ID: ${error.message}`);
      return (data as DeploymentRecord) || null;
    }

    if (useTestMemory()) {
      for (const [id, dep] of testMemDeployments.entries()) {
        if (dep.vercel_deployment_id === vercelDeploymentId) {
          const updated: DeploymentRecord = {
            ...dep,
            ...safeUpdates,
          };
          testMemDeployments.set(id, updated);
          return updated;
        }
      }
    }

    return null;
  },

  async getLatestDeployment(storeId: string): Promise<DeploymentRecord | null> {
    if (isLiveSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('deployments')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`Failed to fetch deployment: ${error.message}`);
      return (data as DeploymentRecord) || null;
    }

    if (useTestMemory()) {
      const deps = Array.from(testMemDeployments.values())
        .filter((d) => d.store_id === storeId)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      return deps[0] || null;
    }
    return null;
  },
};
