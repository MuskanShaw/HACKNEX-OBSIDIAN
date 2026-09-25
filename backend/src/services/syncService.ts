import {
  AuthenticatedUser,
  DashboardStateDTO,
  toFrontendProduct,
  toFrontendOrder,
  toFrontendStore,
  generateNumericId,
} from '../types/index.js';
import { extractAndNormalizeOrderTimestamp } from '../utils/dateUtils.js';
import { dataStore } from './dataStore.js';
import { analyticsService } from './analyticsService.js';
import { realtimeService } from './realtimeService.js';
import { locationService } from './locationService.js';

export const syncService = {
  /**
   * Retrieves the unified, persistent dashboard state for an authenticated user.
   * Single source of truth for dashboard hydration.
   */
  async getDashboardState(user: AuthenticatedUser): Promise<DashboardStateDTO> {
    const store = await dataStore.getOrCreateDefaultStoreForUser(user.id, {
      name: user.full_name ? `${user.full_name}'s Store` : 'My Obsidian Store',
      contact_email: user.email,
    });

    const products = await dataStore.getProductsByStoreId(store.id);
    const orders = await dataStore.getOrdersByStoreId(store.id);
    const analytics = analyticsService.calculateAnalytics(orders, products, 'monthly');

    // Build map from product internal id to client_id for order foreign key resolution
    const productIdToClientId = new Map<string, number>();
    for (const p of products) {
      if (p.client_id !== undefined && p.client_id !== null) {
        productIdToClientId.set(p.id, Number(p.client_id));
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name || null,
        ownerName: user.full_name || null,
        avatarUrl: user.avatar_url || null,
      },
      store: toFrontendStore(store),
      products: products.map(toFrontendProduct),
      orders: orders.map((o) =>
        toFrontendOrder(o, o.product_id ? productIdToClientId.get(o.product_id) : null)
      ),
      analytics,
    };
  },

  /**
   * One-time or sync import of localStorage state from the frontend.
   * Idempotently persists store settings, products catalog, and orders without duplicates.
   */
  async importLocalState(
    user: AuthenticatedUser,
    data: {
      store?: any;
      products?: any[];
      orders?: any[];
    }
  ): Promise<DashboardStateDTO> {
    // 1. Get or create default store
    let defaultStore = await dataStore.getOrCreateDefaultStoreForUser(user.id);

    // 2. Update store settings & owner name if present
    if (data.store) {
      const storeInput = data.store;

      // Update owner name on user if provided
      const ownerName = storeInput.ownerName || storeInput.fullName;
      if (ownerName && ownerName !== user.full_name) {
        await dataStore.upsertUser({
          id: user.id,
          email: user.email,
          full_name: ownerName,
        });
        user.full_name = ownerName;
      }

      const storeUpdates: Record<string, any> = {};
      if (storeInput.shopName || storeInput.name) {
        storeUpdates.name = storeInput.shopName || storeInput.name;
      }
      if (storeInput.businessType) {
        storeUpdates.business_type = storeInput.businessType;
      }
      if (storeInput.customBusinessType !== undefined) {
        storeUpdates.custom_business_type = storeInput.customBusinessType;
      }
      if (storeInput.customOptions !== undefined) {
        storeUpdates.custom_options = storeInput.customOptions;
      }
      if (storeInput.currency || storeInput.storeCurrency) {
        storeUpdates.currency = storeInput.currency || storeInput.storeCurrency;
      }
      if (storeInput.shopAddress || storeInput.address) {
        storeUpdates.address = storeInput.shopAddress || storeInput.address;
      }
      if (storeInput.addressMethod) {
        storeUpdates.address_method = storeInput.addressMethod;
      }
      if (storeInput.latitude !== undefined) {
        storeUpdates.latitude = storeInput.latitude;
      }
      if (storeInput.longitude !== undefined) {
        storeUpdates.longitude = storeInput.longitude;
      }
      if (storeInput.placeId !== undefined) {
        storeUpdates.place_id = storeInput.placeId;
      }
      if (storeInput.formattedAddress !== undefined) {
        storeUpdates.formatted_address = storeInput.formattedAddress;
      }
      if (storeInput.mapsUrl !== undefined) {
        storeUpdates.maps_url = storeInput.mapsUrl;
      }

      // Auto-geocode address if updated and coordinates not explicitly passed
      if (storeUpdates.address && storeUpdates.latitude === undefined) {
        const addr = String(storeUpdates.address).trim();
        if (
          addr &&
          (addr !== (defaultStore.address || '').trim() ||
            defaultStore.latitude === null ||
            defaultStore.latitude === undefined)
        ) {
          try {
            const geo = await locationService.geocode(addr);
            storeUpdates.latitude = geo.latitude;
            storeUpdates.longitude = geo.longitude;
            storeUpdates.place_id = geo.placeId;
            storeUpdates.formatted_address = geo.formattedAddress;
            storeUpdates.maps_url = geo.mapsUrl;
            storeUpdates.location_source = 'google_maps';
          } catch {}
        }
      }

      if (Object.keys(storeUpdates).length > 0) {
        defaultStore = await dataStore.updateStore(defaultStore.id, storeUpdates);
      }
    }

    // 3. Upsert products idempotently using id or name
    const existingProducts = await dataStore.getProductsByStoreId(defaultStore.id);
    const existingProductById = new Map<string, string>();
    const existingProductByName = new Map<string, string>();
    for (const ep of existingProducts) {
      existingProductById.set(String(ep.id), String(ep.id));
      if (ep.client_id) existingProductById.set(String(ep.client_id), String(ep.id));
      existingProductByName.set(ep.name.toLowerCase().trim(), String(ep.id));
    }

    if (Array.isArray(data.products) && data.products.length > 0) {
      for (const p of data.products) {
        const pIdStr = String(p.id);
        const pNameKey = (p.name || '').toLowerCase().trim();
        const existingId = existingProductById.get(pIdStr) || existingProductByName.get(pNameKey);

        const productPayload = {
          store_id: defaultStore.id,
          client_id: Number(p.id) || generateNumericId(p.name),
          name: p.name || 'Untitled Product',
          price: Number(p.price) || 0,
          discount_price: p.discountPrice !== undefined && p.discountPrice !== null ? Number(p.discountPrice) : null,
          stock: p.stock !== undefined ? Number(p.stock) : 10,
          emoji: p.emoji || '📦',
          category: p.category || 'General',
          description: p.description || '',
          image_url: p.image || p.image_url || null,
          status: p.status || 'active',
        };

        try {
          if (existingId) {
            await dataStore.updateProduct(existingId, productPayload);
          } else {
            const created = await dataStore.createProduct(productPayload);
            existingProductById.set(String(created.id), String(created.id));
            existingProductByName.set(created.name.toLowerCase().trim(), String(created.id));
          }
        } catch (prodErr: any) {
          const safeProdId = p?.id ?? p?.clientId ?? 'unknown';
          console.warn(`[SyncService] Skipping malformed product (id: ${safeProdId}): ${prodErr.message}`);
        }
      }
    }

    // 4. Upsert orders idempotently using id or customer/product combination
    const existingOrders = await dataStore.getOrdersByStoreId(defaultStore.id);
    const existingOrderKeys = new Set<string>();
    for (const eo of existingOrders) {
      existingOrderKeys.add(String(eo.id));
      if (eo.client_id) existingOrderKeys.add(String(eo.client_id));
      existingOrderKeys.add(`${eo.customer_name}_${eo.product_name}_${eo.total_price}`.toLowerCase());
    }

    if (Array.isArray(data.orders) && data.orders.length > 0) {
      for (const o of data.orders) {
        if (!o || typeof o !== 'object') continue;
        const orderKey = String(o.id || o.clientId || o.client_id || '');
        const comboKey = `${o.customerName || o.customer_name || ''}_${o.productName || o.product_name || ''}_${o.totalPrice || o.total_price || o.totalAmount || o.total_amount || 0}`.toLowerCase();
        if ((orderKey && existingOrderKeys.has(orderKey)) || (comboKey && existingOrderKeys.has(comboKey))) {
          continue; // Do not duplicate already recorded order
        }

        try {
          const normalizedDate = extractAndNormalizeOrderTimestamp(o);
          await dataStore.createOrder({
            store_id: defaultStore.id,
            client_id: Number(o.id || o.clientId || o.client_id) || generateNumericId((o.customerName || o.customer_name || 'Customer') + (o.date || o.order_date || o.createdAt || '')),
            customer_name: o.customerName || o.customer_name || 'Customer',
            customer_email: o.customerEmail || o.customer_email || null,
            customer_phone: o.customerPhone || o.customer_phone || o.phone || null,
            customer_address: o.customerAddress || o.customer_address || o.address || null,
            payment_method: o.paymentMethod || o.payment_method || null,
            product_name: o.productName || o.product_name || 'Ordered Item',
            product_id: o.productId || o.product_id ? String(o.productId || o.product_id) : null,
            quantity: Number(o.quantity) || 1,
            total_price: Number(o.totalPrice ?? o.total_price ?? o.totalAmount ?? o.total_amount ?? 0),
            total_amount: Number(o.totalAmount ?? o.total_amount ?? o.totalPrice ?? o.total_price ?? 0),
            items: Array.isArray(o.items) ? o.items : undefined,
            status: o.status || 'completed',
            order_date: normalizedDate,
            date: normalizedDate,
            createdAt: o.createdAt,
            created_at: o.created_at,
            orderDate: o.orderDate,
            timestamp: o.timestamp,
          });
          if (orderKey) existingOrderKeys.add(orderKey);
          if (comboKey) existingOrderKeys.add(comboKey);
        } catch (orderErr: any) {
          const safeOrderId = o.id ?? o.clientId ?? o.client_id ?? 'unknown';
          const problematicField = o.date ?? o.order_date ?? o.time ?? 'unknown_timestamp';
          console.warn(
            `[SyncService] Skipping malformed order (id: ${safeOrderId}, timestamp: "${String(problematicField).slice(0, 50)}"): ${orderErr.message}`
          );
        }
      }
    }

    realtimeService.broadcast(defaultStore.id, 'STORE_UPDATED', { store: defaultStore });

    return this.getDashboardState(user);
  },
};
