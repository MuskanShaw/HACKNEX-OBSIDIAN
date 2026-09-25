/**
 * OBSIDIAN API Client
 * Configured for https://hacknex-obsidian.onrender.com
 */

import { supabase } from "./supabase";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://hacknex-obsidian.onrender.com";

// Safe development logging for debugging API target
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  console.log(`[OBSIDIAN API] Configured Base URL: ${API_BASE_URL}`);
}

export async function getValidAuthToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    try {
      // 1. Check live Supabase session (auto-refreshes expired access tokens)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        localStorage.setItem("obsidian_token", session.access_token);
        return session.access_token;
      }
    } catch {
      // Fallback to stored tokens if supabase client is offline
    }
    return getStoredToken();
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
  options: RequestInit = {}
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

  if (!res.ok) {
    const errorBody = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorBody);
    } catch {
      parsed = { message: errorBody };
    }
    throw new Error(parsed.message || parsed.error || `API error (${res.status})`);
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
      return () => {};
    }

    const token = getStoredToken();
    const url = `${API_BASE_URL}/api/stores/${encodeURIComponent(storeId)}/realtime${
      token ? `?token=${encodeURIComponent(token)}` : ""
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
};
