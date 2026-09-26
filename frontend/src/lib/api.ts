/**
 * OBSIDIAN API Client
 * Configured for https://hacknex-obsidian06.onrender.com
 */

import { supabase } from "./supabase";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://hacknex-obsidian06.onrender.com";

// Safe development logging for debugging API target
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  console.log(`[OBSIDIAN API] Configured Base URL: ${API_BASE_URL}`);
}

let activeRefreshPromise: Promise<string | null> | null = null;

export function isJwtExpired(token: string | null | undefined, bufferSeconds = 60): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (typeof parsed.exp === 'number') {
      const expiresAtMs = parsed.exp * 1000;
      return expiresAtMs <= Date.now() + bufferSeconds * 1000;
    }
    return false;
  } catch {
    return false;
  }
}

// Backward-compatible alias
export const isTokenExpired = isJwtExpired;

export async function refreshAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const storedRefreshToken = localStorage.getItem("obsidian_refresh_token");
      let refreshResult = await supabase.auth.refreshSession();

      if (!refreshResult.data?.session && storedRefreshToken) {
        refreshResult = await supabase.auth.refreshSession({
          refresh_token: storedRefreshToken,
        });
      }

      const refreshedSession = refreshResult.data?.session;
      if (refreshedSession?.access_token) {
        localStorage.setItem("obsidian_token", refreshedSession.access_token);
        if (refreshedSession.refresh_token) {
          localStorage.setItem("obsidian_refresh_token", refreshedSession.refresh_token);
        }
        return refreshedSession.access_token;
      }
      return null;
    } catch (err) {
      console.warn("[OBSIDIAN API] Session refresh attempt failed:", err);
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export function clearAuthSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("obsidian_token");
    localStorage.removeItem("obsidian_refresh_token");
    localStorage.removeItem("obsidian_session");
  }
}

export async function getValidAuthToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    try {
      // 1. Check live Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        if (isJwtExpired(session.access_token, 60)) {
          const refreshed = await refreshAuthToken();
          if (refreshed) return refreshed;
        } else {
          localStorage.setItem("obsidian_token", session.access_token);
          if (session.refresh_token) {
            localStorage.setItem("obsidian_refresh_token", session.refresh_token);
          }
          return session.access_token;
        }
      }
    } catch {
      // Supabase client offline / local error
    }

    // 2. Check stored token in localStorage
    const storedToken = getStoredToken();
    if (storedToken) {
      if (!isJwtExpired(storedToken, 60)) {
        return storedToken;
      }
      // Stored token is expired, attempt refresh
      const refreshed = await refreshAuthToken();
      if (refreshed) return refreshed;

      // Token definitely expired and cannot be refreshed: clean it up
      localStorage.removeItem("obsidian_token");
      localStorage.removeItem("obsidian_session");
    }
  }
  return null;
}

export function getStoredToken(): string | null {
  if (typeof window !== "undefined") {
    try {
      const token = localStorage.getItem("obsidian_token");
      if (token) return token;
      const raw = localStorage.getItem("obsidian_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) return parsed.access_token;
        if (parsed?.token) return parsed.token;
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

export function getStoredUser(): any | null {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("obsidian_session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { _isRetry?: boolean } = {}
): Promise<T> {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${path}`;

  // Priority: explicit header token > active Supabase session token > localStorage
  const explicitAuth = (options.headers as Record<string, string>)?.Authorization;
  let token = explicitAuth ? explicitAuth.replace(/^Bearer\s+/i, "") : null;
  if (!token) {
    token = await getValidAuthToken();
  }

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  // Safe development logging without leaking sensitive payloads or tokens
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.log(`[OBSIDIAN API] ${options.method || "GET"} -> ${url}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized with a single transparent token refresh and retry
  if (res.status === 401 && !options._isRetry) {
    const refreshedToken = await refreshAuthToken();
    if (refreshedToken) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${refreshedToken}`,
      };
      return apiRequest<T>(endpoint, {
        ...options,
        headers: retryHeaders,
        _isRetry: true,
      });
    }
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      console.warn("[OBSIDIAN API] 401 Unauthorized received. Clearing stale stored tokens.");
      localStorage.removeItem("obsidian_token");
      localStorage.removeItem("obsidian_session");
    }
    const errorBody = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      parsed = { message: errorBody };
    }
    const err: any = new Error(parsed.message || parsed.error || `API error (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export const api = {
  // System Health & Specs
  getHealth: () => apiRequest("/health"),
  getSwaggerSpec: () => apiRequest("/api/docs/swagger.json"),

  // Public storefront templates
  getTemplates: () => apiRequest<{ templates: any[] }>("/api/templates"),

  // Public storefront data by store slug
  getPublicStore: (slug: string) =>
    apiRequest<{ store: any; products: any[]; template: any }>(
      `/api/public/store/${encodeURIComponent(slug)}`
    ),

  // Authentication
  login: (credentials: { email: string; password: string }) =>
    apiRequest<{ message: string; user: any; token: string; session: any }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(credentials),
      }
    ),

  signup: (userData: { email: string; password: string; full_name?: string }) =>
    apiRequest<{ message: string; user: any; token: string; session: any }>(
      "/api/auth/signup",
      {
        method: "POST",
        body: JSON.stringify(userData),
      }
    ),

  updatePassword: (passwordData: { password: string }, token?: string) =>
    apiRequest<{ success: boolean; message: string }>("/api/auth/update-password", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(passwordData),
    }),

  getCurrentUser: (token?: string) =>
    apiRequest<{ user: any }>("/api/auth/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  syncUser: (token?: string) =>
    apiRequest<{ message: string; user: any }>("/api/auth/sync", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Unified Dashboard State & Migration
  getAccountState: (token?: string) =>
    apiRequest<{
      user: any;
      store: any;
      products: any[];
      orders: any[];
      analytics: any;
    }>("/api/account/state", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateAccountState: (data: { store?: any; products?: any[]; orders?: any[] }, token?: string) =>
    apiRequest<{ success: boolean; state: any }>("/api/account/state", {
      method: "PUT",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(data),
    }),

  importLocalState: (data: { store?: any; products?: any[]; orders?: any[] }, token?: string) =>
    apiRequest<{ success: boolean; state: any }>("/api/account/import-local-state", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(data),
    }),

  // Stores
  getUserStores: (token?: string) =>
    apiRequest<{ stores: any[]; defaultStore?: any }>("/api/stores/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createStore: (storeData: any, token?: string) =>
    apiRequest<{ message: string; store: any; formattedStore: any }>("/api/stores", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(storeData),
    }),

  getStore: (storeId: string, token?: string) =>
    apiRequest<{ store: any; formattedStore: any }>(`/api/stores/${storeId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateStore: (storeId: string, updates: any, token?: string) =>
    apiRequest<{ message: string; store: any; formattedStore: any }>(`/api/stores/${storeId}`, {
      method: "PATCH",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(updates),
    }),

  replaceStore: (storeId: string, storeData: any, token?: string) =>
    apiRequest<{ message: string; store: any; formattedStore: any }>(`/api/stores/${storeId}`, {
      method: "PUT",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(storeData),
    }),

  deleteStore: (storeId: string, token?: string) =>
    apiRequest<{ message?: string; success?: boolean }>(`/api/stores/${storeId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  updateStoreLocation: (
    storeId: string,
    locationData: {
      latitude: number;
      longitude: number;
      formattedAddress?: string;
      placeId?: string;
      mapsUrl?: string;
    },
    token?: string
  ) =>
    apiRequest<{ message?: string; store?: any; formattedStore?: any; location?: any }>(
      `/api/stores/${storeId}/location`,
      {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(locationData),
      }
    ),

  selectTemplate: (storeId: string, templateId: string, token?: string) =>
    apiRequest<{ message?: string; store?: any; formattedStore?: any; template?: any }>(
      `/api/stores/${storeId}/select-template`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ templateId }),
      }
    ),

  uploadAsset: (
    storeId: string,
    file: File | Blob,
    category: "logo" | "banner" | "product" = "product",
    productId?: string | number,
    token?: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (productId !== undefined && productId !== null) {
      formData.append("productId", String(productId));
    }
    return apiRequest<{ message: string; url: string; path: string }>(`/api/stores/${storeId}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  },

  // Products
  getProducts: (storeId: string, params?: { search?: string; category?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.category) query.set("category", params.category);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{ products: any[]; rawProducts: any[] }>(`/api/stores/${storeId}/products${qs}`);
  },

  createProduct: (storeId: string, productData: any, token?: string) =>
    apiRequest<{ message: string; product: any; rawProduct: any }>(`/api/stores/${storeId}/products`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(productData),
    }),

  updateProduct: (storeId: string, productId: string | number, updates: any, token?: string) =>
    apiRequest<{ message: string; product: any; rawProduct: any }>(`/api/stores/${storeId}/products/${productId}`, {
      method: "PUT",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(updates),
    }),

  adjustStock: (storeId: string, productId: string | number, stockData: { delta?: number; stock?: number }, token?: string) =>
    apiRequest<{ message: string; product: any }>(`/api/stores/${storeId}/products/${productId}/stock`, {
      method: "PATCH",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(stockData),
    }),

  deleteProduct: (storeId: string, productId: string | number, token?: string) =>
    apiRequest<{ message: string; deletedId: any }>(`/api/stores/${storeId}/products/${productId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  clearProducts: (storeId: string, token?: string) =>
    apiRequest<{ success: boolean; clearedCount: number }>(`/api/stores/${storeId}/products`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Orders
  getOrders: (storeId: string, token?: string) =>
    apiRequest<{ orders: any[]; rawOrders: any[] }>(`/api/stores/${storeId}/orders`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getOrderDetails: (storeId: string, orderId: string | number, token?: string) =>
    apiRequest<{ order: any }>(`/api/stores/${storeId}/orders/${orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createOrder: (storeId: string, orderData: any) =>
    apiRequest<{ message: string; order: any; remainingStock?: number }>(`/api/stores/${storeId}/orders`, {
      method: "POST",
      body: JSON.stringify(orderData),
    }),

  updateOrderStatus: (
    storeId: string,
    orderId: string | number,
    status: "pending" | "processing" | "completed" | "cancelled",
    token?: string
  ) =>
    apiRequest<{ message: string; order: any }>(`/api/stores/${storeId}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ status }),
    }),

  deleteOrder: (storeId: string, orderId: string | number, token?: string) =>
    apiRequest<{ message: string; deletedId: any }>(`/api/stores/${storeId}/orders/${orderId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  clearOrders: (storeId: string, token?: string) =>
    apiRequest<{ success: boolean; clearedCount: number }>(`/api/stores/${storeId}/orders`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Analytics
  getAnalytics: (
    storeId: string,
    timeframe: "daily" | "weekly" | "monthly" | "yearly" = "monthly",
    token?: string
  ) =>
    apiRequest<{
      success?: boolean;
      analytics?: {
        totalSales?: number;
        totalOrders?: number;
        uniqueCustomers?: number;
        totalProducts?: number;
        totalStock?: number;
        lowStockCount?: number;
        chart?: {
          labels: string[];
          values: number[];
        };
        timeframe?: string;
        lastUpdated?: string;
      };
      totalSales?: number;
      totalOrders?: number;
      uniqueCustomers?: number;
      totalProducts?: number;
      totalStock?: number;
      lowStockCount?: number;
      chart?: {
        labels: string[];
        values: number[];
      };
      timeframe?: string;
      lastUpdated?: string;
    }>(`/api/stores/${storeId}/analytics?timeframe=${timeframe}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // Realtime Server-Sent Events listener
  connectRealtime: (
    storeId: string,
    onEvent: (event: { type: string; payload: any }) => void
  ): (() => void) => {
    if (typeof window === "undefined" || !("EventSource" in window) || !storeId) {
      return () => { };
    }

    const token = getStoredToken();
    const url = `${API_BASE_URL}/api/stores/${encodeURIComponent(storeId)}/realtime${token ? `?token=${encodeURIComponent(token)}` : ""
      }`;

    let es: EventSource | null = null;
    let isClosed = false;

    const eventTypes = [
      "ORDER_CREATED",
      "ORDER_STATUS_UPDATED",
      "ORDER_UPDATED",
      "ORDER_DELETED",
      "STOCK_UPDATED",
      "PRODUCT_UPDATED",
      "PRODUCT_CREATED",
      "PRODUCT_DELETED",
      "STORE_UPDATED",
      "STORE_DEPLOYMENT_UPDATED",
      "message",
    ];

    const handleData = (type: string, rawData: string) => {
      if (!rawData) return;
      try {
        const parsed = JSON.parse(rawData);
        // If parsed is an envelope with type & payload:
        if (parsed && typeof parsed === "object" && parsed.type) {
          onEvent(parsed);
        } else {
          // If server emitted a named event (e.g. event: ORDER_CREATED) with direct payload:
          onEvent({ type, payload: parsed });
        }
      } catch {
        // Plain text or ping/heartbeat
        if (type !== "message" && type !== "ping" && type !== "heartbeat") {
          onEvent({ type, payload: rawData });
        }
      }
    };

    try {
      es = new EventSource(url);

      es.onmessage = (e) => {
        handleData("message", e.data);
      };

      eventTypes.forEach((evtType) => {
        if (evtType !== "message") {
          es?.addEventListener(evtType, (e: any) => {
            handleData(evtType, e.data);
          });
        }
      });

      es.onerror = (err) => {
        // EventSource will automatically attempt reconnection by default
        console.warn("[Realtime SSE] Connection error or reconnecting:", err);
      };
    } catch (err) {
      console.warn("[Realtime SSE] Failed to initialize EventSource:", err);
    }

    return () => {
      isClosed = true;
      if (es) {
        es.close();
        es = null;
      }
    };
  },

  // Google Maps Platform Integration
  geocode: (address: string, token?: string) =>
    apiRequest<{ success: boolean; data: any }>("/api/maps/geocode", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ address }),
    }),

  getPlaceDetails: (placeId: string, token?: string) =>
    apiRequest<{ success: boolean; data: any }>("/api/maps/place-details", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ placeId }),
    }),

  // Deployments Orchestration
  deployStore: (storeId: string, token?: string) =>
    apiRequest<{
      message?: string;
      url?: string;
      liveUrl?: string;
      deploymentUrl?: string;
      deploymentId?: string;
      status?: string;
      deployment?: any;
      store?: any;
    }>(`/api/stores/${encodeURIComponent(storeId)}/deploy`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getDeploymentStatus: (storeId: string, token?: string) =>
    apiRequest<{
      deploymentId?: string;
      status?: string;
      url?: string;
      deploymentUrl?: string;
      liveUrl?: string;
      createdAt?: string;
    }>(`/api/stores/${encodeURIComponent(storeId)}/deployment-status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  // AI Chat Assistant (Section 4 Contract: message, conversation, context)
  sendChatMessage: (
    payload: {
      message: string;
      conversation?: Array<{ role: 'user' | 'assistant'; content: string }>;
      context?: {
        store?: Record<string, any>;
        products?: any[];
        inventory?: any[];
        orders?: any[];
      };
      conversation_id?: string | null;
    },
    token?: string
  ) =>
    apiRequest<{
      success: boolean;
      message: string;
      reply?: string;
      conversation_id?: string;
    }>("/api/ai/chat", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload),
    }),
};
