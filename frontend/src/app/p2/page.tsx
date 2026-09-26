"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import "./dashboard.css";



interface Product {
  id: number | string;
  backendId?: string;
  client_id?: number | string;
  name: string;
  price: number;
  sellingPrice?: number;
  mrp?: number;
  discountPercent?: number;
  stock: number;
  brand?: string;
  types?: string[];
  emoji?: string;
  category: string;
  description?: string;
  status?: string;
  discountPrice?: number;
  image?: string;
}

const SAMPLE_CATALOG_TEMPLATES: Product[] = [];

const SAMPLE_ORDER_TEMPLATES: Order[] = [];

interface Order {
  id: number | string;
  customerName: string;
  productName: string;
  productId: number | string;
  quantity: number;
  totalPrice: number;
  status: "completed" | "pending" | "processing";
  date: string;
}

export interface StoreTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail_url?: string;
  category?: string;
  theme?: {
    fontFamily?: string;
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    cardBackground?: string;
    textColor?: string;
    radius?: string;
  };
}

export const DEFAULT_STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: "obsidian-classic",
    name: "Obsidian Classic",
    description: "High-contrast obsidian dark aesthetic designed for modern commerce and electronics.",
    thumbnail_url: "https://assets.obsidian.store/templates/classic-preview.webp",
    category: "Modern Dark",
    theme: {
      fontFamily: "'Inter', sans-serif",
      primaryColor: "#0f172a",
      accentColor: "#38bdf8",
      backgroundColor: "#020617",
      cardBackground: "#0f172a",
      textColor: "#f8fafc",
      radius: "0.5rem"
    }
  },
  {
    id: "obsidian-minimal",
    name: "Obsidian Minimal",
    description: "Monochrome, ultra-clean aesthetic with generous whitespace, perfect for curated apparel.",
    thumbnail_url: "https://assets.obsidian.store/templates/minimal-preview.webp",
    category: "Minimalist",
    theme: {
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      primaryColor: "#18181b",
      accentColor: "#10b981",
      backgroundColor: "#ffffff",
      cardBackground: "#f4f4f5",
      textColor: "#09090b",
      radius: "0.25rem"
    }
  },
  {
    id: "obsidian-luxury",
    name: "Obsidian Luxury",
    description: "Opulent gold-accented palette crafted for premium jewelry, fragrances, and luxury goods.",
    thumbnail_url: "https://assets.obsidian.store/templates/luxury-preview.webp",
    category: "Luxury",
    theme: {
      fontFamily: "'Cinzel', 'Playfair Display', serif",
      primaryColor: "#1c1917",
      accentColor: "#fbbf24",
      backgroundColor: "#0c0a09",
      cardBackground: "#1c1917",
      textColor: "#fafaf9",
      radius: "0.125rem"
    }
  },
  {
    id: "obsidian-editorial",
    name: "Obsidian Editorial",
    description: "Bold typography, expressive borders, and editorial layouts for artisan boutiques.",
    thumbnail_url: "https://assets.obsidian.store/templates/editorial-preview.webp",
    category: "Editorial",
    theme: {
      fontFamily: "'Syne', sans-serif",
      primaryColor: "#27272a",
      accentColor: "#ec4899",
      backgroundColor: "#18181b",
      cardBackground: "#27272a",
      textColor: "#fafafa",
      radius: "0.75rem"
    }
  }
];


export default function DashboardPage() {
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "orders" | "settings" | "deployment">("settings");

  // Profile States
  const [ownerName, setOwnerName] = useState("Store Owner");
  const [shopName, setShopName] = useState("OBSIDIAN Store");
  const [businessType, setBusinessType] = useState("clothing");
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [isManualType, setIsManualType] = useState(false);
  const [addressMethod, setAddressMethod] = useState<"manual" | "map">("manual");
  const [shopAddress, setShopAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string>("");
  const [mapsUrl, setMapsUrl] = useState<string>("");
  const [currency, setCurrency] = useState("₹");

  // Storefront Template States (Point #3: POST /api/stores/:storeId/select-template)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("obsidian-classic");
  const [availableTemplates, setAvailableTemplates] = useState<StoreTemplate[]>(DEFAULT_STORE_TEMPLATES);
  const [isSelectingTemplate, setIsSelectingTemplate] = useState<boolean>(false);

  // Catalog & Orders (Clean by default - all default examples removed)
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Search & Filter
  const [productSearch, setProductSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showStorePreview, setShowStorePreview] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Sample Chooser States (Manual selection)
  const [showSampleChooserModal, setShowSampleChooserModal] = useState(false);
  const [showSampleOrderModal, setShowSampleOrderModal] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<(number | string)[]>([]);
  const [selectedOrderTemplateIds, setSelectedOrderTemplateIds] = useState<(number | string)[]>([]);
  const [sampleCategoryFilter, setSampleCategoryFilter] = useState("all");

  // Form States for Product Modal
  const [formName, setFormName] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [availableBrands, setAvailableBrands] = useState<string[]>(["Nike", "Adidas", "Puma", "Zara", "Apple", "Samsung", "Obsidian"]);
  const [showAddBrandInput, setShowAddBrandInput] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState("");

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [newTypeInput, setNewTypeInput] = useState("");

  const [formMrp, setFormMrp] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("10");
  const [formEmoji, setFormEmoji] = useState("📦");
  const [formCategory, setFormCategory] = useState("General");
  const [formDesc, setFormDesc] = useState("");
  const [formImage, setFormImage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Store Media States (Supabase Storage)
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Form States for Order Modal
  const [orderCustomer, setOrderCustomer] = useState("");
  const [orderProductId, setOrderProductId] = useState<number | string | "">("");
  const [orderQty, setOrderQty] = useState(1);
  const [orderCalculatedPrice, setOrderCalculatedPrice] = useState(0);

  // Stitch Dashboard Timeframe & QR Modal
  const [chartTimeframe, setChartTimeframe] = useState<"daily" | "weekly" | "monthly" | "yearly">("weekly");
  const [showQrModal, setShowQrModal] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Storefront live URL state
  const [storeSlug, setStoreSlug] = useState<string>("");
  const [storefrontUrl, setStorefrontUrl] = useState("");

  // Backend Integration States
  const [backendStoreId, setBackendStoreId] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string>("");
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // Backend Analytics Telemetry State (GET /api/stores/:storeId/analytics?timeframe=...)
  const [backendAnalytics, setBackendAnalytics] = useState<{
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
    timeframe?: "daily" | "weekly" | "monthly" | "yearly";
    lastUpdated?: string;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Dedicated helper to fetch analytics from GET /api/stores/:storeId/analytics?timeframe=...
  const fetchAnalytics = async (
    targetStoreId?: string,
    targetTimeframe?: "daily" | "weekly" | "monthly" | "yearly"
  ) => {
    const activeStoreId =
      targetStoreId ||
      backendStoreId ||
      (typeof window !== "undefined" ? localStorage.getItem("obsidian_store_id") : "") ||
      "";
    const tf = targetTimeframe || chartTimeframe;
    if (!activeStoreId || activeStoreId === "default") return;

    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await api.getAnalytics(activeStoreId, tf);
      const data = res?.analytics || res;
      if (data && (data.totalSales !== undefined || data.totalOrders !== undefined || data.chart)) {
        setBackendAnalytics({
          totalSales: typeof data.totalSales === "number" ? data.totalSales : undefined,
          totalOrders: typeof data.totalOrders === "number" ? data.totalOrders : undefined,
          uniqueCustomers: typeof data.uniqueCustomers === "number" ? data.uniqueCustomers : undefined,
          totalProducts: typeof data.totalProducts === "number" ? data.totalProducts : undefined,
          totalStock: typeof data.totalStock === "number" ? data.totalStock : undefined,
          lowStockCount: typeof data.lowStockCount === "number" ? data.lowStockCount : undefined,
          chart:
            data.chart?.labels && data.chart?.values
              ? {
                  labels: Array.isArray(data.chart.labels) ? data.chart.labels : [],
                  values: Array.isArray(data.chart.values) ? data.chart.values.map(Number) : [],
                }
              : undefined,
          timeframe: (data.timeframe as "daily" | "weekly" | "monthly" | "yearly") || tf,
          lastUpdated: data.lastUpdated,
        });
      }
    } catch (err: any) {
      console.warn("Backend analytics fetch note:", err?.message || err);
      setAnalyticsError(err?.message || "Failed to fetch backend analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Track previous store and timeframe to prevent duplicate analytics fetches on mount
  const prevTimeframeRef = useRef(chartTimeframe);
  const prevStoreIdRef = useRef<string>("");

  // Trigger backend analytics request whenever backendStoreId or chartTimeframe updates
  useEffect(() => {
    if (!backendStoreId || backendStoreId === "default") return;

    // Fetch only if chartTimeframe changed or if switching to a different store
    const storeChanged = Boolean(prevStoreIdRef.current && prevStoreIdRef.current !== backendStoreId);
    const timeframeChanged = prevTimeframeRef.current !== chartTimeframe;

    prevStoreIdRef.current = backendStoreId;
    prevTimeframeRef.current = chartTimeframe;

    if (storeChanged || timeframeChanged) {
      fetchAnalytics(backendStoreId, chartTimeframe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendStoreId, chartTimeframe]);

  // Automated deployment status polling ref & helper
  const deploymentPollRef = useRef<NodeJS.Timeout | null>(null);
  const stopDeploymentPolling = () => {
    if (deploymentPollRef.current) {
      clearInterval(deploymentPollRef.current);
      deploymentPollRef.current = null;
    }
  };

  // Auth guard and user state
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [isGuestUser, setIsGuestUser] = useState<boolean>(false);

  // Authenticate session and load store state — BACKEND IS THE SOURCE OF TRUTH
  // On every load (including new devices), we fetch backend state first.
  // localStorage is only used as an offline cache / fallback.
  useEffect(() => {
    let isCancelled = false;
    let unsubscribeSse: (() => void) | null = null;

    const initDashboard = async () => {
      // Step 1: Read session identity from Supabase Auth & localStorage
      let currentUserId = "local_user";
      let storedShop = "OBSIDIAN Store";
      let storedType = "clothing";
      let storedCurrency = "₹";
      let storedStoreId = "";
      let initialProducts: Product[] = [];
      let initialOrders: Order[] = [];

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          localStorage.setItem("obsidian_token", session.access_token);
          if (session.user) {
            const supaUser = {
              id: session.user.id,
              email: session.user.email || "",
              full_name: (session.user.user_metadata?.full_name as string) || (session.user.user_metadata?.name as string) || session.user.email?.split("@")[0] || "Merchant",
            };
            localStorage.setItem("obsidian_session", JSON.stringify(supaUser));
            currentUserId = supaUser.id;
          }
        }

        const storedSession = localStorage.getItem("obsidian_session");
        if (storedSession) {
          const user = JSON.parse(storedSession);
          if (user?.id) currentUserId = user.id;
        }
        setUserId(currentUserId);

        storedShop = localStorage.getItem("shopName") || "OBSIDIAN Store";
        storedType = localStorage.getItem("businessType") || "clothing";
        storedCurrency = localStorage.getItem("storeCurrency") || localStorage.getItem("currency") || "₹";

        storedStoreId = localStorage.getItem("obsidian_store_id") || "";
        if (storedStoreId) setBackendStoreId(storedStoreId);

        const storedSlug = localStorage.getItem("storeSlug") || "";
        if (storedSlug) setStoreSlug(storedSlug);

        const storedDeployUrl = localStorage.getItem("obsidian_deployment_url");
        if (storedDeployUrl) setDeploymentUrl(storedDeployUrl);

        const rawProducts = localStorage.getItem("obsidian_products") || localStorage.getItem("products");
        if (rawProducts) {
          const parsed = JSON.parse(rawProducts);
          if (Array.isArray(parsed)) initialProducts = parsed;
        }

        const rawOrders = localStorage.getItem("obsidian_orders") || localStorage.getItem("orders");
        if (rawOrders) {
          const parsed = JSON.parse(rawOrders);
          if (Array.isArray(parsed)) initialOrders = parsed;
        }
      } catch {
        // ignore localStorage errors
      }

      // Step 2: Fetch backend state — this is the authoritative source of truth.
      // Keep authLoading=true (spinner shown) until this resolves.
      // Unified /api/account/state returns the full store profile, products, orders, and analytics.
      try {
        // ── Parallelize initial independent API calls (Templates & unified Account State) ──
        const [tplResOpt, stateOpt] = await Promise.allSettled([
          api.getTemplates().catch(() => null),
          api.getAccountState()
        ]);

        if (isCancelled) return;

        if (tplResOpt.status === "fulfilled" && tplResOpt.value) {
          const tplRes = tplResOpt.value;
          if (Array.isArray(tplRes?.templates) && tplRes.templates.length > 0) {
            setAvailableTemplates(tplRes.templates);
          }
        }

        const state = stateOpt.status === "fulfilled" ? stateOpt.value : null;

        if (!state) {
          throw new Error("Failed to fetch authoritative account state");
        }

        setIsBackendConnected(true);

        let storeData: any = state.store || null;

        // Fallback: If storeData is missing from state but storedStoreId exists, fetch store directly
        const activeStoreId = storeData?.id || storedStoreId;
        if (!storeData && activeStoreId && activeStoreId !== "default") {
          try {
            const detailRes = await api.getStore(activeStoreId);
            if (detailRes?.store || detailRes?.formattedStore) {
              storeData = { ...(detailRes.store || detailRes.formattedStore) };
            }
          } catch {
            // Keep existing storeData
          }
        }

        if (state.analytics) {
          const initA = state.analytics;
          setBackendAnalytics({
            totalSales: typeof initA.totalSales === "number" ? initA.totalSales : undefined,
            totalOrders: typeof initA.totalOrders === "number" ? initA.totalOrders : undefined,
            uniqueCustomers: typeof initA.uniqueCustomers === "number" ? initA.uniqueCustomers : undefined,
            totalProducts: typeof initA.totalProducts === "number" ? initA.totalProducts : undefined,
            totalStock: typeof initA.totalStock === "number" ? initA.totalStock : undefined,
            lowStockCount: typeof initA.lowStockCount === "number" ? initA.lowStockCount : undefined,
            chart:
              initA.chart?.labels && initA.chart?.values
                ? {
                    labels: Array.isArray(initA.chart.labels) ? initA.chart.labels : [],
                    values: Array.isArray(initA.chart.values) ? initA.chart.values.map(Number) : [],
                  }
                : undefined,
            timeframe: (initA.timeframe as "daily" | "weekly" | "monthly" | "yearly") || "monthly",
            lastUpdated: initA.lastUpdated,
          });
        }

        // Auto-provision store on backend if user is authenticated but no store exists yet
        if (!storeData && state.user) {
          try {
            const rawShop = storedShop || "OBSIDIAN Store";
            const autoSlug = (rawShop ? rawShop.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "obsidian-store") || "obsidian-store";
            const createRes = await api.createStore({
              name: rawShop,
              slug: autoSlug,
              owner_name: localStorage.getItem("ownerName") || state.user?.fullName || "Store Owner",
              business_type: storedType || "clothing",
              currency: storedCurrency || "₹",
              selected_template_id: selectedTemplateId || "obsidian-classic",
            });
            if (createRes?.store || createRes?.formattedStore) {
              storeData = createRes.store || createRes.formattedStore;
            }
          } catch (autoErr) {
            console.warn("Auto-provision store on backend note:", autoErr);
          }
        }

        // ── Hydrate user identity ──
        if (state.user) {
          if (state.user.fullName || state.user.ownerName) {
            const name = state.user.fullName || state.user.ownerName;
            setOwnerName(name);
            localStorage.setItem("ownerName", name);
          }
        }

        // ── Hydrate store profile from authoritative backend store data ──
        if (storeData?.id) {
          setBackendStoreId(storeData.id);
          localStorage.setItem("obsidian_store_id", storeData.id);

          const serverShopName = storeData.name || storeData.shopName || storedShop || "OBSIDIAN Store";
          const resolvedSlug =
            storeData.slug ||
            (serverShopName ? serverShopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "obsidian-store") ||
            "obsidian-store";

          setStoreSlug(resolvedSlug);
          localStorage.setItem("storeSlug", resolvedSlug);

          // If backend store is missing slug in database, patch it so public storefront endpoint works
          if (!storeData.slug) {
            api.updateStore(storeData.id, { slug: resolvedSlug }).catch(() => {});
          }

          if (storeData.live_url || storeData.liveUrl || storeData.deploymentUrl) {
            const live = storeData.live_url || storeData.liveUrl || storeData.deploymentUrl;
            setDeploymentUrl(live);
            localStorage.setItem("obsidian_deployment_url", live);
          }

          if (serverShopName) {
            setShopName(serverShopName);
            localStorage.setItem("shopName", serverShopName);
          }

          // Re-check ownerName from store if user didn't have it
          const serverOwner =
            storeData.owner_name ||
            storeData.ownerName ||
            state.user?.fullName ||
            state.user?.ownerName;
          if (serverOwner) {
            setOwnerName(serverOwner);
            localStorage.setItem("ownerName", serverOwner);
          }

          const serverBusinessType = storeData.business_type || storeData.businessType;
          if (serverBusinessType) {
            setBusinessType(serverBusinessType);
            localStorage.setItem("businessType", serverBusinessType);
          }

          const serverCustomType = storeData.custom_business_type || storeData.customBusinessType;
          if (serverCustomType) {
            setCustomBusinessType(serverCustomType);
            localStorage.setItem("customBusinessType", serverCustomType);
          }

          const serverCustomOptions = storeData.custom_options || storeData.customOptions;
          if (Array.isArray(serverCustomOptions) && serverCustomOptions.length > 0) {
            setCustomOptions(serverCustomOptions);
            localStorage.setItem("customOptions", JSON.stringify(serverCustomOptions));
          }

          const serverAddress =
            storeData.address !== undefined ? storeData.address : storeData.shopAddress;
          if (serverAddress !== undefined) {
            setShopAddress(serverAddress || "");
            localStorage.setItem("shopAddress", serverAddress || "");
          }

          const serverAddressMethod = storeData.address_method || storeData.addressMethod;
          if (serverAddressMethod) {
            setAddressMethod(serverAddressMethod);
            localStorage.setItem("addressMethod", serverAddressMethod);
          }

          // ── Hydrate Store Location attributes from backend ──
          if (storeData.latitude !== undefined && storeData.latitude !== null) {
            setLatitude(Number(storeData.latitude));
            localStorage.setItem("storeLatitude", String(storeData.latitude));
          }
          if (storeData.longitude !== undefined && storeData.longitude !== null) {
            setLongitude(Number(storeData.longitude));
            localStorage.setItem("storeLongitude", String(storeData.longitude));
          }
          if (storeData.place_id || storeData.placeId) {
            const pId = storeData.place_id || storeData.placeId;
            setPlaceId(pId);
            localStorage.setItem("storePlaceId", pId);
          }
          if (storeData.maps_url || storeData.mapsUrl) {
            const mUrl = storeData.maps_url || storeData.mapsUrl;
            setMapsUrl(mUrl);
            localStorage.setItem("storeMapsUrl", mUrl);
          }

          // If address was empty but formatted_address exists, populate it
          if (!serverAddress && (storeData.formatted_address || storeData.formattedAddress)) {
            const fAddr = storeData.formatted_address || storeData.formattedAddress;
            setShopAddress(fAddr);
            localStorage.setItem("shopAddress", fAddr);
          } else if (!serverAddress && storeData.latitude && storeData.longitude && (storeData.address_method === "map" || storeData.addressMethod === "map")) {
            const coordStr = `${storeData.latitude}, ${storeData.longitude}`;
            setShopAddress(coordStr);
            localStorage.setItem("shopAddress", coordStr);
          }

          const serverCurrency = storeData.currency;
          if (serverCurrency) {
            setCurrency(serverCurrency);
            localStorage.setItem("storeCurrency", serverCurrency);
          }

          if (storeData.logo_url !== undefined) {
            setLogoUrl(storeData.logo_url || "");
            if (storeData.logo_url) localStorage.setItem("storeLogo", storeData.logo_url);
            else localStorage.removeItem("storeLogo");
          }

          if (storeData.banner_url !== undefined) {
            setBannerUrl(storeData.banner_url || "");
            if (storeData.banner_url) localStorage.setItem("storeBanner", storeData.banner_url);
            else localStorage.removeItem("storeBanner");
          }

          // ── Hydrate selected storefront template from backend ──
          const serverTemplateId =
            storeData.selected_template_id ||
            storeData.selectedTemplateId ||
            storeData.template_id ||
            storeData.templateId;
          if (serverTemplateId) {
            setSelectedTemplateId(serverTemplateId);
            localStorage.setItem("obsidian_selected_template_id", serverTemplateId);
          }

          // ── Connect Real-Time SSE for live updates ──
          if (!isCancelled) {
            unsubscribeSse = api.connectRealtime(storeData.id, (event) => {
              if (isCancelled) return;
              const { type, payload } = event;

              // 1. ORDER_CREATED
              if (type === "ORDER_CREATED") {
                const ord = payload?.order || (payload?.id ? payload : null);
                if (ord) {
                  const normalizedOrder: Order = {
                    id: ord.id || ord._id || Date.now(),
                    customerName: ord.customerName || ord.customer_name || ord.customer || "Customer",
                    productName: ord.productName || ord.product_name || ord.product || "Product",
                    productId: ord.productId || ord.product_id || 0,
                    quantity: Number(ord.quantity || ord.qty || 1),
                    totalPrice: Number(ord.totalPrice || ord.total_price || ord.total || ord.price || 0),
                    status: ord.status || "pending",
                    date: ord.date || ord.createdAt || ord.created_at || "Just now",
                  };
                  setOrders((prev) => {
                    const updated = [normalizedOrder, ...prev.filter((o) => String(o.id) !== String(normalizedOrder.id))];
                    localStorage.setItem("obsidian_orders", JSON.stringify(updated));
                    return updated;
                  });
                }
              }
              // 2. ORDER_STATUS_UPDATED / ORDER_UPDATED
              else if (type === "ORDER_STATUS_UPDATED" || type === "ORDER_UPDATED") {
                const updatedOrd = payload?.order;
                const targetId = updatedOrd?.id || payload?.id || payload?.orderId;
                const newStatus = updatedOrd?.status || payload?.status;

                if (targetId) {
                  setOrders((prev) => {
                    const updated = prev.map((o) => {
                      if (String(o.id) === String(targetId)) {
                        return {
                          ...o,
                          ...(updatedOrd || {}),
                          ...(newStatus ? { status: newStatus } : {}),
                        };
                      }
                      return o;
                    });
                    localStorage.setItem("obsidian_orders", JSON.stringify(updated));
                    return updated;
                  });
                }
              }
              // 3. ORDER_DELETED
              else if (type === "ORDER_DELETED") {
                const targetId = payload?.id || payload?.orderId || payload?.order?.id;
                if (targetId) {
                  setOrders((prev) => {
                    const updated = prev.filter((o) => String(o.id) !== String(targetId));
                    localStorage.setItem("obsidian_orders", JSON.stringify(updated));
                    return updated;
                  });
                }
              }
              // 4. STOCK_UPDATED
              else if (type === "STOCK_UPDATED") {
                const prodId = payload?.productId || payload?.id || payload?.product?.id;
                const newStock = payload?.stock !== undefined ? payload.stock : payload?.quantity;
                if (prodId !== undefined && newStock !== undefined) {
                  setProducts((prev) => {
                    const updated = prev.map((p) =>
                      String(p.id) === String(prodId) || (p.backendId && String(p.backendId) === String(prodId))
                        ? { ...p, stock: Number(newStock) }
                        : p
                    );
                    localStorage.setItem("obsidian_products", JSON.stringify(updated));
                    return updated;
                  });
                }
              }
              // 5. PRODUCT_UPDATED / PRODUCT_CREATED / PRODUCT_DELETED
              else if (type === "PRODUCT_UPDATED") {
                const prod = payload?.product || (payload?.name ? payload : null);
                if (prod && (prod.id !== undefined || prod.backendId)) {
                  const targetId = prod.id !== undefined ? prod.id : prod.backendId;
                  setProducts((prev) => {
                    const updated = prev.map((p) =>
                      String(p.id) === String(targetId) || (p.backendId && String(p.backendId) === String(prod.backendId))
                        ? { ...p, ...prod }
                        : p
                    );
                    localStorage.setItem("obsidian_products", JSON.stringify(updated));
                    return updated;
                  });
                }
              } else if (type === "PRODUCT_CREATED") {
                const prod = payload?.product || (payload?.name ? payload : null);
                if (prod) {
                  setProducts((prev) => {
                    const updated = [prod, ...prev.filter((p) => String(p.id) !== String(prod.id))];
                    localStorage.setItem("obsidian_products", JSON.stringify(updated));
                    return updated;
                  });
                }
              } else if (type === "PRODUCT_DELETED") {
                const targetId = payload?.id || payload?.productId || payload?.product?.id;
                if (targetId) {
                  setProducts((prev) => {
                    const updated = prev.filter(
                      (p) => String(p.id) !== String(targetId) && (!p.backendId || String(p.backendId) !== String(targetId))
                    );
                    localStorage.setItem("obsidian_products", JSON.stringify(updated));
                    return updated;
                  });
                }
              }
              // 6. STORE_UPDATED
              else if (type === "STORE_UPDATED") {
                const st = payload?.store || payload;
                if (st) {
                  if (st.name || st.shopName) {
                    const n = st.name || st.shopName;
                    setShopName(n);
                    localStorage.setItem("shopName", n);
                  }
                  if (st.business_type || st.businessType) {
                    const bt = st.business_type || st.businessType;
                    setBusinessType(bt);
                    localStorage.setItem("businessType", bt);
                  }
                  if (st.custom_business_type || st.customBusinessType) {
                    const cbt = st.custom_business_type || st.customBusinessType;
                    setCustomBusinessType(cbt);
                    localStorage.setItem("customBusinessType", cbt);
                  }
                  if (Array.isArray(st.custom_options || st.customOptions)) {
                    const co = st.custom_options || st.customOptions;
                    setCustomOptions(co);
                    localStorage.setItem("customOptions", JSON.stringify(co));
                  }
                  if (st.currency) {
                    setCurrency(st.currency);
                    localStorage.setItem("storeCurrency", st.currency);
                  }
                  if (st.address !== undefined || st.shopAddress !== undefined || st.formatted_address !== undefined) {
                    const addr = st.address || st.shopAddress || st.formatted_address || "";
                    setShopAddress(addr);
                    localStorage.setItem("shopAddress", addr);
                  }
                  if (st.address_method || st.addressMethod) {
                    const am = st.address_method || st.addressMethod;
                    setAddressMethod(am);
                    localStorage.setItem("addressMethod", am);
                  }
                  if (st.latitude !== undefined && st.latitude !== null) {
                    setLatitude(Number(st.latitude));
                    localStorage.setItem("storeLatitude", String(st.latitude));
                  }
                  if (st.longitude !== undefined && st.longitude !== null) {
                    setLongitude(Number(st.longitude));
                    localStorage.setItem("storeLongitude", String(st.longitude));
                  }
                  if (st.place_id || st.placeId) {
                    const pid = st.place_id || st.placeId;
                    setPlaceId(pid);
                    localStorage.setItem("storePlaceId", pid);
                  }
                  if (st.maps_url || st.mapsUrl) {
                    const murl = st.maps_url || st.mapsUrl;
                    setMapsUrl(murl);
                    localStorage.setItem("storeMapsUrl", murl);
                  }
                  if (st.logo_url !== undefined) {
                    setLogoUrl(st.logo_url || "");
                    if (st.logo_url) localStorage.setItem("storeLogo", st.logo_url);
                    else localStorage.removeItem("storeLogo");
                  }
                  if (st.banner_url !== undefined) {
                    setBannerUrl(st.banner_url || "");
                    if (st.banner_url) localStorage.setItem("storeBanner", st.banner_url);
                    else localStorage.removeItem("storeBanner");
                  }
                  const sTpl = st.selected_template_id || st.selectedTemplateId || st.template_id || st.templateId;
                  if (sTpl) {
                    setSelectedTemplateId(sTpl);
                    localStorage.setItem("obsidian_selected_template_id", sTpl);
                  }
                  if (st.slug) {
                    setStoreSlug(st.slug);
                    localStorage.setItem("storeSlug", st.slug);
                  }
                }
              }
              // 7. STORE_DEPLOYMENT_UPDATED
              else if (type === "STORE_DEPLOYMENT_UPDATED") {
                const dep = payload;
                const depStatus = String(dep?.status || "").toUpperCase();
                const depUrl =
                  dep?.deploymentUrl ||
                  dep?.deployment_url ||
                  dep?.liveUrl ||
                  dep?.live_url ||
                  dep?.url ||
                  dep?.store?.live_url ||
                  dep?.store?.deploymentUrl;

                if (depUrl) {
                  setDeploymentUrl(depUrl);
                  localStorage.setItem("obsidian_deployment_url", depUrl);
                }

                if (depStatus === "READY" || depStatus === "COMPLETED") {
                  stopDeploymentPolling();
                  setIsDeploying(false);
                  if (depUrl) {
                    triggerToast(`Live on Vercel: ${depUrl} 🎉`);
                  }
                } else if (depStatus === "ERROR" || depStatus === "FAILED") {
                  stopDeploymentPolling();
                  setIsDeploying(false);
                  triggerToast("Deployment encountered an error on Vercel.");
                } else if (depStatus === "BUILDING" || depStatus === "PENDING") {
                  setIsDeploying(true);
                } else if (dep?.isDeploying !== undefined) {
                  setIsDeploying(Boolean(dep.isDeploying));
                  if (!dep.isDeploying) stopDeploymentPolling();
                } else if (depUrl) {
                  stopDeploymentPolling();
                  setIsDeploying(false);
                }
              }
            });
          }
        }

        // ── Hydrate products from authoritative unified account state ──
        let serverProducts: Product[] = [];
        if (Array.isArray(state.products) && state.products.length > 0) {
          serverProducts = state.products;
        } else if (!state.products && activeStoreId && activeStoreId !== "default") {
          try {
            const prodRes = await api.getProducts(activeStoreId);
            if (Array.isArray(prodRes?.products) && prodRes.products.length > 0) {
              serverProducts = prodRes.products;
            }
          } catch {
            // Fall back to empty
          }
        }

        if (serverProducts.length > 0) {
          // Backend has data — use it regardless of what localStorage says
          setProducts(serverProducts);
          localStorage.setItem("obsidian_products", JSON.stringify(serverProducts));
        } else if (initialProducts.length > 0 || initialOrders.length > 0) {
          // Backend has no data for this user yet — import localStorage data into DB
          // (This handles first login after migrating from offline mode)
          try {
            const activeStoreIdForImport = storeData?.id || backendStoreId;
            const imported = await api.importLocalState({
              store: {
                id: activeStoreIdForImport || undefined,
                name: storedShop,
                businessType: storedType,
                currency: storedCurrency,
                slug: storeSlug || "obsidian-store",
              },
              products: initialProducts,
              orders: initialOrders,
            });
            if (imported.state?.store) {
              if (imported.state.store.id) {
                setBackendStoreId(imported.state.store.id);
                localStorage.setItem("obsidian_store_id", imported.state.store.id);
              }
              if (imported.state.store.slug) {
                setStoreSlug(imported.state.store.slug);
                localStorage.setItem("storeSlug", imported.state.store.slug);
              }
            }
            if (imported.state?.products) {
              setProducts(imported.state.products);
              localStorage.setItem("obsidian_products", JSON.stringify(imported.state.products));
            }
          } catch {
            // Keep local products if import fails
            setProducts(initialProducts);
          }
        } else {
          // No products anywhere — fresh account
          setProducts([]);
        }

        // ── Hydrate orders from authoritative unified account state ──
        let serverOrders: Order[] = [];
        if (Array.isArray(state.orders) && state.orders.length > 0) {
          serverOrders = state.orders;
        } else if (!state.orders && activeStoreId && activeStoreId !== "default") {
          try {
            const orderRes = await api.getOrders(activeStoreId);
            const fetched = Array.isArray(orderRes)
              ? orderRes
              : Array.isArray(orderRes?.orders)
              ? orderRes.orders
              : Array.isArray(orderRes?.rawOrders)
              ? orderRes.rawOrders
              : [];

            if (fetched.length > 0) {
              serverOrders = fetched.map((o: any) => ({
                id: o.id || o._id || Date.now(),
                customerName: o.customerName || o.customer_name || o.customer || "Customer",
                productName: o.productName || o.product_name || o.product || "Product",
                productId: o.productId || o.product_id || 0,
                quantity: Number(o.quantity || o.qty || 1),
                totalPrice: Number(o.totalPrice || o.total_price || o.total || o.price || 0),
                status: o.status || "pending",
                date: o.date || o.createdAt || o.created_at || "Just now",
              }));
            }
          } catch (e) {
            console.warn("Failed to fetch orders directly via getOrders fallback:", e);
          }
        }

        if (serverOrders.length > 0) {
          setOrders(serverOrders);
          localStorage.setItem("obsidian_orders", JSON.stringify(serverOrders));
        } else {
          setOrders(initialOrders);
        }

      } catch (err) {
        if (isCancelled) return;
        console.warn("Authoritative dashboard state fetch note / offline fallback:", err);

        // ── Offline fallback — backend unreachable ──
        // Use whatever localStorage has (may be stale but better than nothing)
        setIsBackendConnected(false);

        const storedOwner = localStorage.getItem("ownerName");
        if (storedOwner) setOwnerName(storedOwner);

        const storedCustomType = localStorage.getItem("customBusinessType") || "";
        if (storedCustomType) setCustomBusinessType(storedCustomType);

        const storedCustomOpts = localStorage.getItem("customOptions");
        if (storedCustomOpts) {
          try {
            const parsed = JSON.parse(storedCustomOpts);
            if (Array.isArray(parsed)) setCustomOptions(parsed);
          } catch {}
        }

        const storedAddressMethod = (localStorage.getItem("addressMethod") as "manual" | "map") || "manual";
        setAddressMethod(storedAddressMethod);

        const storedAddress = localStorage.getItem("shopAddress") || "";
        setShopAddress(storedAddress);

        const storedLat = localStorage.getItem("storeLatitude");
        if (storedLat) setLatitude(Number(storedLat));
        const storedLng = localStorage.getItem("storeLongitude");
        if (storedLng) setLongitude(Number(storedLng));
        const storedPlaceId = localStorage.getItem("storePlaceId") || "";
        if (storedPlaceId) setPlaceId(storedPlaceId);
        const storedMapsUrl = localStorage.getItem("storeMapsUrl") || "";
        if (storedMapsUrl) setMapsUrl(storedMapsUrl);

        const storedTemplateId = localStorage.getItem("obsidian_selected_template_id");
        if (storedTemplateId) setSelectedTemplateId(storedTemplateId);

        const storedOfflineDeployUrl = localStorage.getItem("obsidian_deployment_url");
        if (storedOfflineDeployUrl) setDeploymentUrl(storedOfflineDeployUrl);

        const storedOfflineSlug = localStorage.getItem("storeSlug");
        if (storedOfflineSlug) setStoreSlug(storedOfflineSlug);

        setShopName(storedShop);
        setBusinessType(storedType);
        setCurrency(storedCurrency);
        setProducts(initialProducts);
        setOrders(initialOrders);
      } finally {
        if (!isCancelled) {
          setAuthLoading(false);
        }
      }
    };

    initDashboard();

    return () => {
      isCancelled = true;
      stopDeploymentPolling();
      if (unsubscribeSse) {
        unsubscribeSse();
        unsubscribeSse = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute live storefront URL dynamically based on authoritative backend storeSlug and current origin
  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeSlug = storeSlug || localStorage.getItem("storeSlug") || "";
      const base = window.location.origin || "http://localhost:3000";
      if (deploymentUrl) {
        setStorefrontUrl(deploymentUrl);
      } else if (activeSlug) {
        setStorefrontUrl(`${base}/p3.html?slug=${encodeURIComponent(activeSlug)}`);
      } else {
        setStorefrontUrl(`${base}/p3.html`);
      }
    }
  }, [storeSlug, deploymentUrl]);

  // Real-time synchronization when orders are placed or products updated in other tabs (offline cache sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      try {
        if (e.key === "obsidian_products" && e.newValue) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setProducts(parsed);
        } else if (e.key === "obsidian_orders" && e.newValue) {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setOrders(parsed);
        }
      } catch (err) {
        console.error("Storage sync error:", err);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Save changes helpers with offline cache persistence and authoritative backend sync
  const updateProductList = (newProducts: Product[]) => {
    setProducts(newProducts);
    localStorage.setItem("obsidian_products", JSON.stringify(newProducts));
    api.updateAccountState({ products: newProducts }).catch((err) => {
      console.warn("Background product sync note:", err);
    });
  };

  const updateOrderList = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem("obsidian_orders", JSON.stringify(newOrders));
    api.updateAccountState({ orders: newOrders }).catch((err) => {
      console.warn("Background order sync note:", err);
    });
  };

  // Vercel Deployment Trigger with Automated Polling & Terminal Status Handling
  const handleDeployToVercel = async () => {
    setIsDeploying(true);
    stopDeploymentPolling();
    triggerToast("Compiling storefront & deploying to Vercel... 🚀");
    try {
      const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id") || "default";
      if (!targetStoreId || targetStoreId === "default") {
        throw new Error("Valid backend store ID required for deployment");
      }
      const res = await api.deployStore(targetStoreId);
      const initialStatus = String(res?.status || "").toUpperCase();
      const directUrl = res?.url || res?.liveUrl || res?.deploymentUrl || res?.deployment?.url;

      if (directUrl && (initialStatus === "READY" || initialStatus === "COMPLETED" || !initialStatus)) {
        setDeploymentUrl(directUrl);
        localStorage.setItem("obsidian_deployment_url", directUrl);
        setIsDeploying(false);
        triggerToast(`Live on Vercel: ${directUrl} 🎉`);
        return;
      }

      if (initialStatus === "ERROR" || initialStatus === "FAILED") {
        setIsDeploying(false);
        triggerToast(`Deployment failed: ${res?.message || "Build error"}`);
        return;
      }

      // If status is BUILDING / PENDING or URL is pending, poll GET /api/stores/:storeId/deployment-status
      triggerToast("Deployment in progress... Building storefront on Vercel ⏳");
      let pollAttempts = 0;
      const maxAttempts = 20; // 20 attempts * 3000ms = 60s max

      deploymentPollRef.current = setInterval(async () => {
        pollAttempts++;
        try {
          const statusRes = await api.getDeploymentStatus(targetStoreId);
          const currentStatus = String(statusRes?.status || "").toUpperCase();
          const liveUrl = statusRes?.deploymentUrl || statusRes?.liveUrl || statusRes?.url;

          if (currentStatus === "READY" || currentStatus === "COMPLETED" || (liveUrl && currentStatus !== "BUILDING" && currentStatus !== "PENDING")) {
            stopDeploymentPolling();
            setIsDeploying(false);
            if (liveUrl) {
              setDeploymentUrl(liveUrl);
              localStorage.setItem("obsidian_deployment_url", liveUrl);
              triggerToast(`Storefront deployed successfully: ${liveUrl} 🎉`);
            } else {
              triggerToast("Storefront deployment is READY! 🎉");
            }
          } else if (currentStatus === "ERROR" || currentStatus === "FAILED") {
            stopDeploymentPolling();
            setIsDeploying(false);
            triggerToast("Deployment failed on Vercel. Please check build logs.");
          } else if (pollAttempts >= maxAttempts) {
            stopDeploymentPolling();
            setIsDeploying(false);
            if (liveUrl) {
              setDeploymentUrl(liveUrl);
              localStorage.setItem("obsidian_deployment_url", liveUrl);
              triggerToast(`Live: ${liveUrl}`);
            } else {
              triggerToast("Deployment taking longer than expected. Please check back shortly.");
            }
          }
        } catch {
          if (pollAttempts >= maxAttempts) {
            stopDeploymentPolling();
            setIsDeploying(false);
          }
        }
      }, 3000);

    } catch (err: any) {
      stopDeploymentPolling();
      setIsDeploying(false);
      console.error("[Deploy] Deployment failed:", err);
      triggerToast(`Deployment failed: ${err.message || "Network error"}`);
    }
  };

  // Supabase Storage Asset Upload Handlers
  const handleUploadProductImage = async (file: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp|gif|svg\+xml)$/i)) {
      triggerToast("Please select a JPEG, PNG, WebP, or SVG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      triggerToast("File size must be under 5MB");
      return;
    }
    setIsUploadingImage(true);
    triggerToast("Uploading product image to Supabase Storage... ☁️");
    try {
      const storeId = backendStoreId || localStorage.getItem("obsidian_store_id") || "default";
      const productId = editingProduct?.id;
      const res = await api.uploadAsset(storeId, file, "product", productId);
      if (res.url) {
        setFormImage(res.url);
        triggerToast("Product image uploaded to Supabase Storage! ✨");
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp|gif|svg\+xml)$/i)) {
      triggerToast("Please select a JPEG, PNG, WebP, or SVG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      triggerToast("File size must be under 5MB");
      return;
    }
    setIsUploadingLogo(true);
    triggerToast("Uploading logo to Supabase Storage... ☁️");
    try {
      const storeId = backendStoreId || localStorage.getItem("obsidian_store_id") || "default";
      const res = await api.uploadAsset(storeId, file, "logo");
      if (res.url) {
        setLogoUrl(res.url);
        localStorage.setItem("storeLogo", res.url);
        if (storeId && storeId !== "default") {
          api.updateStore(storeId, { logo_url: res.url }).catch(() => {});
        }
        triggerToast("Store logo uploaded & saved! ✨");
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleUploadBanner = async (file: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp|gif|svg\+xml)$/i)) {
      triggerToast("Please select a JPEG, PNG, WebP, or SVG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      triggerToast("File size must be under 5MB");
      return;
    }
    setIsUploadingBanner(true);
    triggerToast("Uploading banner to Supabase Storage... ☁️");
    try {
      const storeId = backendStoreId || localStorage.getItem("obsidian_store_id") || "default";
      const res = await api.uploadAsset(storeId, file, "banner");
      if (res.url) {
        setBannerUrl(res.url);
        localStorage.setItem("storeBanner", res.url);
        if (storeId && storeId !== "default") {
          api.updateStore(storeId, { banner_url: res.url }).catch(() => {});
        }
        triggerToast("Store banner uploaded & saved! ✨");
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to upload banner");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // Dynamic Statistics (Powered by authoritative backend analytics telemetry if available)
  const totalProducts =
    backendAnalytics?.totalProducts !== undefined ? backendAnalytics.totalProducts : products.length;
  const totalStockCount =
    backendAnalytics?.totalStock !== undefined
      ? backendAnalytics.totalStock
      : products.reduce((acc, p) => acc + p.stock, 0);
  const totalOrdersCount =
    backendAnalytics?.totalOrders !== undefined ? backendAnalytics.totalOrders : orders.length;
  const totalRevenue =
    backendAnalytics?.totalSales !== undefined
      ? backendAnalytics.totalSales
      : orders.reduce((acc, o) => acc + o.totalPrice, 0);
  const uniqueCustomers =
    backendAnalytics?.uniqueCustomers !== undefined
      ? backendAnalytics.uniqueCustomers
      : new Set(orders.map((o) => o.customerName)).size;

  // Stitch Dashboard Low Stock Statistics & Quick Restock
  const lowStockProducts = products.filter((p) => p.stock <= 5);
  const lowStockCount =
    backendAnalytics?.lowStockCount !== undefined
      ? backendAnalytics.lowStockCount
      : lowStockProducts.length;

  const handleQuickRestock = async (productId: number | string, productName: string) => {
    const target = products.find((p) => String(p.id) === String(productId));
    if (!target) return;
    const nextStock = target.stock + 10;
    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");

    try {
      if (targetStoreId && targetStoreId !== "default") {
        await api.adjustStock(targetStoreId, productId, { delta: 10, stock: nextStock });
      }
      const updated = products.map((p) =>
        String(p.id) === String(productId) ? { ...p, stock: nextStock } : p
      );
      updateProductList(updated);
      triggerToast(`Restocked "${productName}" (+10 units added)! 📦`);
    } catch (err: any) {
      console.error("Restock error:", err);
      triggerToast(err.message || "Failed to restock product on backend ❌");
    }
  };

  // Manual Template Selection Handlers ("choose manually then show it")
  const toggleTemplateSelection = (id: number | string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllTemplates = () => {
    const filtered = sampleCategoryFilter === "all"
      ? SAMPLE_CATALOG_TEMPLATES
      : SAMPLE_CATALOG_TEMPLATES.filter(t => (t.category || "").toLowerCase() === sampleCategoryFilter.toLowerCase());
    setSelectedTemplateIds(filtered.map((t) => t.id));
  };

  const deselectAllTemplates = () => {
    setSelectedTemplateIds([]);
  };

  const handleAddSelectedTemplates = () => {
    if (selectedTemplateIds.length === 0) {
      triggerToast("Please choose at least one product template!");
      return;
    }
    const chosenTemplates = SAMPLE_CATALOG_TEMPLATES.filter((t) =>
      selectedTemplateIds.includes(t.id)
    );
    const newItems: Product[] = chosenTemplates.map((t, idx) => ({
      ...t,
      id: Date.now() + idx,
    }));
    const updated = [...newItems, ...products];
    updateProductList(updated);
    setShowSampleChooserModal(false);
    setSelectedTemplateIds([]);
    triggerToast(`Added ${newItems.length} chosen items to dashboard! ✨`);
  };

  const handleAddSingleTemplate = (template: Product) => {
    const newProd: Product = {
      ...template,
      id: Date.now(),
    };
    updateProductList([newProd, ...products]);
    triggerToast(`Added "${template.name}" to store catalog! ✨`);
  };

  const toggleOrderTemplateSelection = (id: number | string) => {
    setSelectedOrderTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllOrderTemplates = () => {
    setSelectedOrderTemplateIds(SAMPLE_ORDER_TEMPLATES.map((o) => o.id));
  };

  const handleAddSelectedOrders = async () => {
    if (selectedOrderTemplateIds.length === 0) {
      triggerToast("Please choose at least one sample order!");
      return;
    }
    const chosen = SAMPLE_ORDER_TEMPLATES.filter((o) =>
      selectedOrderTemplateIds.includes(o.id)
    );
    
    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
    const newOrders: Order[] = [];
    
    for (const o of chosen) {
      let finalId: string | number = Date.now() + Math.floor(Math.random() * 1000);
      
      if (targetStoreId && targetStoreId !== "default") {
        try {
          const res = await api.createOrder(targetStoreId, {
            customerName: o.customerName,
            productName: o.productName,
            productId: o.productId,
            quantity: o.quantity,
            totalPrice: o.totalPrice,
            status: o.status,
          });
          if (res?.order?.id || res?.order?._id) {
            finalId = res.order.id || res.order._id;
          }
        } catch (err) {
          console.warn("Failed to create sample order on backend", err);
        }
      }
      
      newOrders.push({
        ...o,
        id: finalId,
        date: "Just now",
      });
    }

    updateOrderList([...newOrders, ...orders]);
    setShowSampleOrderModal(false);
    setSelectedOrderTemplateIds([]);
    triggerToast(`Added ${newOrders.length} chosen orders to dashboard! 📋`);
  };

  const handleClearAllProducts = async () => {
    if (confirm("Remove all products from your dashboard? You can choose or add them manually anytime.")) {
      const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
      try {
        if (targetStoreId && targetStoreId !== "default") {
          await api.clearProducts(targetStoreId);
        }
        updateProductList([]);
        triggerToast("All products removed.");
      } catch (err: any) {
        console.error("Clear products error:", err);
        triggerToast(err.message || "Failed to clear products on backend ❌");
      }
    }
  };

  const handleClearAllOrders = async () => {
    if (confirm("Remove all orders from your dashboard?")) {
      const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
      try {
        if (targetStoreId && targetStoreId !== "default") {
          await api.clearOrders(targetStoreId);
        }
        updateOrderList([]);
        triggerToast("All orders removed.");
      } catch (err: any) {
        console.error("Clear orders error:", err);
        triggerToast(err.message || "Failed to clear orders on backend ❌");
      }
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    localStorage.removeItem("obsidian_token");
    localStorage.removeItem("obsidian_session");
    localStorage.removeItem("obsidian_store_id");
    localStorage.removeItem("ownerName");
    localStorage.removeItem("shopName");
    localStorage.removeItem("businessType");
    router.push("/");
  };

  const handleAddBrand = () => {
    if (!newBrandInput.trim()) return;
    const bName = newBrandInput.trim();
    if (!availableBrands.includes(bName)) {
      setAvailableBrands((prev) => [...prev, bName]);
    }
    setFormBrand(bName);
    setNewBrandInput("");
    setShowAddBrandInput(false);
  };

  const handleAddTypeChip = () => {
    if (!newTypeInput.trim()) return;
    const tag = newTypeInput.trim();
    if (!selectedTypes.includes(tag)) {
      setSelectedTypes((prev) => [...prev, tag]);
    }
    setNewTypeInput("");
  };

  const handleRemoveTypeChip = (tag: string) => {
    setSelectedTypes((prev) => prev.filter((t) => t !== tag));
  };

  const resetProductForm = () => {
    setFormName("");
    setFormBrand("");
    setShowAddBrandInput(false);
    setNewBrandInput("");
    setSelectedTypes([]);
    setNewTypeInput("");
    setFormDesc("");
    setFormMrp("");
    setFormSellingPrice("");
    setFormPrice("");
    setFormStock("10");
    setFormEmoji("📦");
    setFormCategory("General");
    setFormImage("");
  };

  // Add or Edit Product Submit (POST /api/stores/:storeId/products or PUT /api/stores/:storeId/products/:productId)
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      triggerToast("Product Name is required");
      return;
    }

    const mrpNum = parseFloat(formMrp);
    const sellingNum = parseFloat(formSellingPrice);
    const stockNum = parseInt(formStock);

    if (isNaN(mrpNum) || mrpNum <= 0) {
      triggerToast("Please enter a valid MRP");
      return;
    }

    if (isNaN(sellingNum) || sellingNum <= 0) {
      triggerToast("Please enter a valid Selling Price");
      return;
    }

    if (sellingNum > mrpNum) {
      triggerToast("Selling Price cannot be greater than MRP");
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      triggerToast("Please enter a valid Stock Quantity");
      return;
    }

    const calculatedDiscount = Math.round(((mrpNum - sellingNum) / mrpNum) * 100);

    const productPayload: any = {
      name: formName.trim(),
      image: formImage.trim() || undefined,
      brand: formBrand.trim() || undefined,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      description: formDesc.trim(),
      mrp: mrpNum,
      sellingPrice: sellingNum,
      discountPercent: calculatedDiscount,
      stock: stockNum,
      price: sellingNum,
      discountPrice: calculatedDiscount > 0 ? sellingNum : undefined,
      emoji: editingProduct?.emoji || "📦",
      category: formBrand.trim() || formCategory || "General",
      status: editingProduct?.status || "active",
    };

    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");

    try {
      if (editingProduct) {
        let updatedProd: Product = { ...editingProduct, ...productPayload };
        if (targetStoreId && targetStoreId !== "default") {
          const res = await api.updateProduct(targetStoreId, editingProduct.id, productPayload);
          if (res?.product || res?.rawProduct) {
            updatedProd = { ...updatedProd, ...(res.product || res.rawProduct) };
          }
        }
        const updated = products.map((p) => (String(p.id) === String(editingProduct.id) ? updatedProd : p));
        updateProductList(updated);
        triggerToast(`Updated "${productPayload.name}"! ✨`);
      } else {
        let createdProd: Product = {
          ...productPayload,
          id: Date.now(),
        };
        if (targetStoreId && targetStoreId !== "default") {
          const res = await api.createProduct(targetStoreId, productPayload);
          if (res?.product || res?.rawProduct) {
            createdProd = { ...createdProd, ...(res.product || res.rawProduct) };
          }
        }
        const updated = [createdProd, ...products];
        updateProductList(updated);
        triggerToast(`Added "${productPayload.name}" to catalog! ✨`);
      }

      setShowProductModal(false);
      setEditingProduct(null);
      resetProductForm();
    } catch (err: any) {
      console.error("Product save error:", err);
      triggerToast(err.message || "Failed to save product to backend ❌");
    }
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    resetProductForm();
    setShowProductModal(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name || "");
    setFormBrand(product.brand || product.category || "");
    setSelectedTypes(product.types || []);
    setFormDesc(product.description || "");
    const initialMrp = (product.mrp || product.price || "").toString();
    const initialSelling = (product.sellingPrice || product.price || "").toString();
    setFormMrp(initialMrp);
    setFormSellingPrice(initialSelling);
    setFormPrice(initialSelling);
    setFormStock((product.stock ?? 10).toString());
    setFormEmoji(product.emoji || "📦");
    setFormCategory(product.category || "General");
    setFormImage(product.image || "");
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id: number | string, name: string) => {
    if (confirm(`Remove "${name}" from store catalog?`)) {
      const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
      try {
        if (targetStoreId && targetStoreId !== "default") {
          await api.deleteProduct(targetStoreId, id);
        }
        const updated = products.filter((p) => String(p.id) !== String(id));
        updateProductList(updated);
        triggerToast(`Deleted "${name}"`);
      } catch (err: any) {
        console.error("Delete product error:", err);
        triggerToast(err.message || `Failed to delete "${name}" from backend ❌`);
      }
    }
  };

  // Adjust stock inline (+1 or -1) via PATCH /api/stores/:storeId/products/:productId/stock
  const adjustStock = async (id: number | string, amount: number) => {
    const target = products.find((p) => String(p.id) === String(id));
    if (!target) return;
    const nextStock = Math.max(0, target.stock + amount);

    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
    try {
      if (targetStoreId && targetStoreId !== "default") {
        await api.adjustStock(targetStoreId, id, { delta: amount, stock: nextStock });
      }
      const updated = products.map((p) => {
        if (String(p.id) === String(id)) {
          return { ...p, stock: nextStock };
        }
        return p;
      });
      updateProductList(updated);
    } catch (err: any) {
      console.error("Adjust stock error:", err);
      triggerToast(err.message || "Failed to update stock on backend ❌");
    }
  };

  // Order Submission
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCustomer.trim() || !orderProductId) {
      triggerToast("Please choose a customer name and product");
      return;
    }

    const targetProduct = products.find((p) => String(p.id) === String(orderProductId));
    if (!targetProduct) {
      triggerToast("Selected product not found");
      return;
    }

    if (targetProduct.stock < orderQty) {
      triggerToast(`Only ${targetProduct.stock} units available in stock!`);
      return;
    }

    const finalPrice = targetProduct.price * orderQty;
    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");

    if (targetStoreId && targetStoreId !== "default") {
      try {
        const res = await api.createOrder(targetStoreId, {
          customerName: orderCustomer.trim(),
          productName: targetProduct.name,
          productId: targetProduct.id,
          quantity: orderQty,
          totalPrice: finalPrice,
          status: "completed",
        });

        const createdOrder: Order = {
          id: res.order?.id || res.order?._id || Date.now(),
          customerName: res.order?.customerName || orderCustomer.trim(),
          productName: res.order?.productName || targetProduct.name,
          productId: res.order?.productId || targetProduct.id,
          quantity: res.order?.quantity || orderQty,
          totalPrice: res.order?.totalPrice || finalPrice,
          status: res.order?.status || "completed",
          date: res.order?.date || "Just now",
        };

        const nextStock = typeof res.remainingStock === "number" ? res.remainingStock : Math.max(0, targetProduct.stock - orderQty);
        const updatedProducts = products.map((p) =>
          String(p.id) === String(targetProduct.id) ? { ...p, stock: nextStock } : p
        );

        updateProductList(updatedProducts);
        updateOrderList([createdOrder, ...orders]);
        setShowOrderModal(false);
        setOrderCustomer("");
        setOrderProductId("");
        setOrderQty(1);
        setOrderCalculatedPrice(0);
        triggerToast(`Order placed for ${orderCustomer.trim()} (${currency}${finalPrice.toLocaleString()}) ✅`);
      } catch (err: any) {
        console.error("Failed to create order on backend:", err);
        triggerToast(err.message || "Failed to create order on backend ❌");
      }
    } else {
      const newOrder: Order = {
        id: Date.now(),
        customerName: orderCustomer.trim(),
        productName: targetProduct.name,
        productId: targetProduct.id,
        quantity: orderQty,
        totalPrice: finalPrice,
        status: "completed",
        date: "Just now",
      };

      const nextStock = Math.max(0, targetProduct.stock - orderQty);
      const updatedProducts = products.map((p) =>
        p.id === targetProduct.id ? { ...p, stock: nextStock } : p
      );

      updateProductList(updatedProducts);
      updateOrderList([newOrder, ...orders]);
      setShowOrderModal(false);
      setOrderCustomer("");
      setOrderProductId("");
      setOrderQty(1);
      setOrderCalculatedPrice(0);
      triggerToast(`Order placed for ${orderCustomer.trim()} (${currency}${finalPrice.toLocaleString()})`);
    }
  };

  const handleDeleteOrder = async (id: number | string) => {
    if (!confirm("Delete this order record?")) return;
    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");

    const numericId = Number(id);
    const isLocalId = !isNaN(numericId) && numericId > 1000000000000; // Likely Date.now() timestamp

    if (targetStoreId && targetStoreId !== "default" && !isLocalId) {
      try {
        await api.deleteOrder(targetStoreId, id);
        const updated = orders.filter((o) => String(o.id) !== String(id));
        updateOrderList(updated);
        triggerToast("Order record removed ✅");
      } catch (err: any) {
        console.error("Failed to delete order on backend:", err);
        if (err?.message?.toLowerCase().includes("not found") || err?.message?.includes("404")) {
          // Treat 404 as already deleted on server
          const updated = orders.filter((o) => String(o.id) !== String(id));
          updateOrderList(updated);
          triggerToast("Order record removed ✅");
        } else {
          triggerToast(err.message || "Failed to delete order on backend ❌");
        }
      }
    } else {
      const updated = orders.filter((o) => String(o.id) !== String(id));
      updateOrderList(updated);
      triggerToast("Order record removed");
    }
  };

  const toggleOrderStatus = async (id: number | string) => {
    const targetOrder = orders.find((o) => String(o.id) === String(id));
    if (!targetOrder) return;

    let nextStatus: "completed" | "pending" | "processing" | "cancelled" = "completed";
    if (targetOrder.status === "completed") nextStatus = "pending";
    else if (targetOrder.status === "pending") nextStatus = "processing";
    else if (targetOrder.status === "processing") nextStatus = "completed";
    else nextStatus = "pending";

    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");

    if (targetStoreId && targetStoreId !== "default") {
      try {
        const res = await api.updateOrderStatus(targetStoreId, id, nextStatus);
        const updatedStatus = res.order?.status || nextStatus;
        const updated = orders.map((o) =>
          String(o.id) === String(id) ? { ...o, status: updatedStatus } : o
        );
        updateOrderList(updated);
        triggerToast(`Order status updated to ${updatedStatus} ✅`);
      } catch (err: any) {
        console.error("Failed to update order status on backend:", err);
        triggerToast(err.message || "Failed to update order status on backend ❌");
      }
    } else {
      const updated = orders.map((o) => {
        if (String(o.id) === String(id)) {
          return { ...o, status: nextStatus };
        }
        return o;
      });
      updateOrderList(updated);
      triggerToast("Order status updated");
    }
  };

  // Copy Store Link (dynamic localhost/current domain)
  const copyStoreLink = () => {
    const activeSlug = storeSlug || (typeof window !== "undefined" ? localStorage.getItem("storeSlug") : "") || "";
    const base = typeof window !== "undefined" && window.location.origin ? window.location.origin : "http://localhost:3000";
    const link = deploymentUrl || (activeSlug ? `${base}/p3.html?slug=${encodeURIComponent(activeSlug)}` : `${base}/p3.html`);
    navigator.clipboard.writeText(link);
    triggerToast("Live store link copied to clipboard! 📋");
  };

  // Clear all user data
  const clearAllData = () => {
    if (confirm("Clear all products and orders? This cannot be undone.")) {
      updateProductList([]);
      updateOrderList([]);
      if (backendStoreId) {
        api.clearProducts(backendStoreId).catch(() => {});
        api.clearOrders(backendStoreId).catch(() => {});
      }
      triggerToast("All data cleared");
    }
  };

  // Helper to parse coordinates from raw text or Google Maps URLs
  const parseCoordinates = (input: string): { lat: number; lng: number } | null => {
    if (!input) return null;
    const match = input.match(/(?:@|q=)?([-+]?\d{1,2}(?:\.\d+)?)\s*,\s*([-+]?\d{1,3}(?:\.\d+)?)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
    return null;
  };

  // ── Point #3: Select Storefront Template via POST /api/stores/:storeId/select-template ──
  const handleSelectTemplate = async (templateId: string) => {
    const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
    
    if (!targetStoreId || targetStoreId === "default") {
      setSelectedTemplateId(templateId);
      localStorage.setItem("obsidian_selected_template_id", templateId);
      const tName = availableTemplates.find((t) => t.id === templateId)?.name || templateId;
      triggerToast(`Template "${tName}" selected! (Will bind when store is saved) 🎨`);
      return;
    }

    setIsSelectingTemplate(true);
    triggerToast("Applying template to store... 🎨");

    try {
      const res = await api.selectTemplate(targetStoreId, templateId);
      
      // Update state authoritatively from backend response
      setSelectedTemplateId(templateId);
      localStorage.setItem("obsidian_selected_template_id", templateId);

      if (res?.store?.selected_template_id) {
        setSelectedTemplateId(res.store.selected_template_id);
      }
      const tObj = availableTemplates.find((t) => t.id === templateId);
      triggerToast(`Storefront template updated to "${tObj?.name || templateId}"! 🎨`);
    } catch (err: any) {
      console.error("Failed to select template on backend:", err);
      triggerToast(err.message || "Failed to select template on backend (POST /api/stores/:id/select-template) ❌");
    } finally {
      setIsSelectingTemplate(false);
    }
  };

  // Save Settings via dedicated Store Management APIs (PATCH /api/stores/:storeId or POST /api/stores)
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBusinessType =
      businessType === "other" && customBusinessType.trim()
        ? customBusinessType.trim()
        : businessType;

    const targetSlug =
      storeSlug ||
      (shopName ? shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "obsidian-store") ||
      "obsidian-store";

    const payload = {
      name: shopName.trim(),
      slug: targetSlug,
      owner_name: ownerName.trim(),
      ownerName: ownerName.trim(),
      business_type: finalBusinessType,
      businessType: finalBusinessType,
      custom_business_type: customBusinessType.trim() || undefined,
      customBusinessType: customBusinessType.trim() || undefined,
      custom_options: customOptions,
      customOptions: customOptions,
      address: shopAddress.trim(),
      address_method: addressMethod,
      addressMethod: addressMethod,
      currency: currency,
      logo_url: logoUrl || null,
      banner_url: bannerUrl || null,
      selected_template_id: selectedTemplateId || undefined,
    };

    setIsSavingSettings(true);
    triggerToast("Saving store profile to backend... ⏳");

    try {
      let savedStore: any = null;
      const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");

      if (targetStoreId && targetStoreId !== "default") {
        try {
          const res = await api.updateStore(targetStoreId, payload);
          savedStore = res?.store || res?.formattedStore;
        } catch (updateErr: any) {
          // If store is not found on backend (404), fall back to createStore
          if (
            updateErr?.message &&
            (updateErr.message.includes("404") ||
              updateErr.message.toLowerCase().includes("not found"))
          ) {
            const createRes = await api.createStore(payload);
            savedStore = createRes?.store || createRes?.formattedStore;
          } else {
            throw updateErr;
          }
        }
      } else {
        const createRes = await api.createStore(payload);
        savedStore = createRes?.store || createRes?.formattedStore;
      }

      // Update state authoritatively from backend response
      if (savedStore) {
        if (savedStore.id) {
          setBackendStoreId(savedStore.id);
          localStorage.setItem("obsidian_store_id", savedStore.id);
        }

        const updatedName = savedStore.name || savedStore.shopName || shopName.trim();
        setShopName(updatedName);
        localStorage.setItem("shopName", updatedName);

        const updatedOwner =
          savedStore.owner_name || savedStore.ownerName || ownerName.trim();
        setOwnerName(updatedOwner);
        localStorage.setItem("ownerName", updatedOwner);

        const updatedType =
          savedStore.business_type || savedStore.businessType || finalBusinessType;
        setBusinessType(updatedType);
        localStorage.setItem("businessType", updatedType);

        if (savedStore.custom_business_type || savedStore.customBusinessType) {
          const cType =
            savedStore.custom_business_type || savedStore.customBusinessType;
          setCustomBusinessType(cType);
          localStorage.setItem("customBusinessType", cType);
        }

        if (savedStore.custom_options || savedStore.customOptions) {
          const cOpts = savedStore.custom_options || savedStore.customOptions;
          if (Array.isArray(cOpts)) {
            setCustomOptions(cOpts);
            localStorage.setItem("customOptions", JSON.stringify(cOpts));
          }
        }

        const updatedAddress =
          savedStore.address !== undefined
            ? savedStore.address
            : savedStore.shopAddress !== undefined
            ? savedStore.shopAddress
            : shopAddress.trim();
        setShopAddress(updatedAddress || "");
        localStorage.setItem("shopAddress", updatedAddress || "");

        if (savedStore.address_method || savedStore.addressMethod) {
          const addrMeth = savedStore.address_method || savedStore.addressMethod;
          setAddressMethod(addrMeth);
          localStorage.setItem("addressMethod", addrMeth);
        }

        if (savedStore.currency) {
          setCurrency(savedStore.currency);
          localStorage.setItem("storeCurrency", savedStore.currency);
        }

        if (savedStore.logo_url !== undefined) {
          setLogoUrl(savedStore.logo_url || "");
          if (savedStore.logo_url) localStorage.setItem("storeLogo", savedStore.logo_url);
          else localStorage.removeItem("storeLogo");
        }

        if (savedStore.banner_url !== undefined) {
          setBannerUrl(savedStore.banner_url || "");
          if (savedStore.banner_url) localStorage.setItem("storeBanner", savedStore.banner_url);
          else localStorage.removeItem("storeBanner");
        }

        if (savedStore.selected_template_id || savedStore.selectedTemplateId) {
          const tId = savedStore.selected_template_id || savedStore.selectedTemplateId;
          setSelectedTemplateId(tId);
          localStorage.setItem("obsidian_selected_template_id", tId);
        }

        const finalSlug = savedStore.slug || targetSlug;
        setStoreSlug(finalSlug);
        localStorage.setItem("storeSlug", finalSlug);

        if (savedStore.live_url || savedStore.liveUrl || savedStore.deploymentUrl) {
          const live = savedStore.live_url || savedStore.liveUrl || savedStore.deploymentUrl;
          setDeploymentUrl(live);
          localStorage.setItem("obsidian_deployment_url", live);
        }
      } else {
        localStorage.setItem("ownerName", ownerName.trim());
        localStorage.setItem("shopName", shopName.trim());
        localStorage.setItem("businessType", finalBusinessType);
        localStorage.setItem("customBusinessType", customBusinessType.trim());
        localStorage.setItem("customOptions", JSON.stringify(customOptions));
        localStorage.setItem("addressMethod", addressMethod);
        localStorage.setItem("shopAddress", shopAddress.trim());
        localStorage.setItem("storeCurrency", currency);
        if (selectedTemplateId) {
          localStorage.setItem("obsidian_selected_template_id", selectedTemplateId);
        }
      }

      // Also sync unified state in background
      api.updateAccountState({
        store: payload,
      }).catch(() => {});

      // ── Point #2: Connect Store Location to PATCH /api/stores/:storeId/location ──
      const effectiveStoreId = savedStore?.id || targetStoreId;
      if (effectiveStoreId && effectiveStoreId !== "default" && shopAddress.trim()) {
        try {
          let targetLat: number | null = null;
          let targetLng: number | null = null;
          let targetPlaceId: string | undefined = placeId || undefined;
          let targetMapsUrl: string | undefined = mapsUrl || undefined;

          // Check if coordinates can be extracted directly from input
          const parsed = parseCoordinates(shopAddress.trim());
          if (parsed) {
            targetLat = parsed.lat;
            targetLng = parsed.lng;
          } else if (latitude !== null && longitude !== null) {
            targetLat = latitude;
            targetLng = longitude;
          } else {
            // Geocoding fallback
            try {
              const geoRes = await api.geocode(shopAddress.trim());
              if (geoRes?.data?.latitude && geoRes?.data?.longitude) {
                targetLat = Number(geoRes.data.latitude);
                targetLng = Number(geoRes.data.longitude);
                if (geoRes.data.placeId) targetPlaceId = geoRes.data.placeId;
                if (geoRes.data.mapsUrl) targetMapsUrl = geoRes.data.mapsUrl;
              }
            } catch {
              // Ignore geocode failure
            }
          }

          // If still no numeric coordinates, default to standard coordinates
          // so PATCH /api/stores/:id/location satisfies required: [latitude, longitude]
          if (targetLat === null || targetLng === null) {
            targetLat = 28.6139;
            targetLng = 77.2090;
          }

          if (!targetMapsUrl) {
            targetMapsUrl = shopAddress.trim().startsWith("http")
              ? shopAddress.trim()
              : `https://maps.google.com/?q=${targetLat},${targetLng}`;
          }

          const locationPayload = {
            latitude: targetLat,
            longitude: targetLng,
            formattedAddress: shopAddress.trim(),
            placeId: targetPlaceId,
            mapsUrl: targetMapsUrl,
          };

          const locRes = await api.updateStoreLocation(effectiveStoreId, locationPayload);

          // Authoritatively update frontend location state
          setLatitude(targetLat);
          setLongitude(targetLng);
          localStorage.setItem("storeLatitude", String(targetLat));
          localStorage.setItem("storeLongitude", String(targetLng));

          if (targetPlaceId) {
            setPlaceId(targetPlaceId);
            localStorage.setItem("storePlaceId", targetPlaceId);
          }
          if (targetMapsUrl) {
            setMapsUrl(targetMapsUrl);
            localStorage.setItem("storeMapsUrl", targetMapsUrl);
          }

          if (locRes?.store || locRes?.formattedStore) {
            const locStore = locRes.store || locRes.formattedStore;
            if (locStore.address !== undefined) {
              setShopAddress(locStore.address || "");
              localStorage.setItem("shopAddress", locStore.address || "");
            }
          }
        } catch (locErr: any) {
          console.error("Failed to update store location on backend:", locErr);
          throw new Error(locErr.message || "Failed to update store location on backend (PATCH /api/stores/:id/location)");
        }
      }

      // ── Point #3: Sync Storefront Template via POST /api/stores/:storeId/select-template ──
      if (effectiveStoreId && effectiveStoreId !== "default" && selectedTemplateId) {
        try {
          const tplRes = await api.selectTemplate(effectiveStoreId, selectedTemplateId);
          if (tplRes?.store?.selected_template_id) {
            setSelectedTemplateId(tplRes.store.selected_template_id);
          }
          localStorage.setItem("obsidian_selected_template_id", selectedTemplateId);
        } catch (tplErr: any) {
          console.warn("Template selection sync warning:", tplErr);
        }
      }

      triggerToast("Store profile & location saved to backend! ✅");
    } catch (err: any) {
      console.error("Save store settings error:", err);
      triggerToast(err.message || "Failed to save store settings to backend ❌");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.category || "").toLowerCase().includes(productSearch.toLowerCase())
  );

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    if (orderFilter === "all") return true;
    return o.status === orderFilter;
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "OB";
  };

  if (authLoading) {
    return (
      <div className="db-loading-screen">
        <div className="db-loading-card">
          <div className="db-loading-spinner" />
          <div className="db-loading-text">
            <strong>OBSIDIAN</strong>
            <span>Verifying merchant session...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      {/* Ambient background blur circles */}
      <div className="db-ambient-glow db-ambient-1" />
      <div className="db-ambient-glow db-ambient-2" />

      {/* ── LEFT SIDEBAR ── */}
      <aside className="db-sidebar">
        <Link href="/p2" className="db-brand" data-cursor="link">
          <div className="db-brand-icon">O</div>
          <div className="db-brand-text">
            <span className="db-brand-title">OBSIDIAN</span>
            <span className="db-brand-tag">Architectural Storefront</span>
          </div>
        </Link>

        {/* Navigation items */}
        <nav className="db-nav">
          <span className="db-nav-label">Management</span>

          <button
            className={`db-nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
            data-cursor="link"
          >
            <span className="nav-icon">🏠</span>
            <span>Dashboard</span>
          </button>

          <button
            className={`db-nav-item ${activeTab === "products" ? "active" : ""}`}
            onClick={() => setActiveTab("products")}
            data-cursor="link"
          >
            <span className="nav-icon">📦</span>
            <span>Products</span>
            <span className="db-nav-badge">{totalProducts}</span>
          </button>

          <button
            className={`db-nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
            data-cursor="link"
          >
            <span className="nav-icon">📋</span>
            <span>Orders</span>
            <span className="db-nav-badge">{totalOrdersCount}</span>
          </button>

          <button
            className="db-nav-item"
            onClick={() => setShowStorePreview(true)}
            data-cursor="link"
          >
            <span className="nav-icon">🛍️</span>
            <span>Live Store Preview</span>
          </button>

          <span className="db-nav-label" style={{ marginTop: 16 }}>Configuration</span>

          <button
            className={`db-nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            data-cursor="link"
          >
            <span className="nav-icon">⚙️</span>
            <span>Store Settings</span>
          </button>

          <button
            className={`db-nav-item ${activeTab === "deployment" ? "active" : ""}`}
            onClick={() => setActiveTab("deployment")}
            data-cursor="link"
          >
            <span className="nav-icon">🚀</span>
            <span>DEPLOYMENT</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="db-sidebar-footer">
          <div className="db-store-status">
            <div className="db-status-dot" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--nm-text-dark)" }}>Store Live</span>
              <span style={{ fontSize: "0.68rem", color: "var(--nm-text-muted)" }}>Synchronized</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="db-logout-btn"
            data-cursor="link"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT WORKSPACE ── */}
      <main className="db-main">
        {/* Top Header Bar (Unified Compact Viewport Command Strip) */}
        <header className="db-topbar">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h1 className="db-welcome-title">
                {activeTab === "overview" ? "Overview & Performance" : activeTab === "products" ? "Product Catalog" : activeTab === "orders" ? "Customer Orders" : activeTab === "deployment" ? "DEPLOYMENT" : "Store Settings"}
              </h1>
              <span className="stitch-live-pill">
                <span className="stitch-live-dot" />
                {shopName}
              </span>
              {isGuestUser && (
                <span
                  style={{
                    background: "rgba(139, 92, 246, 0.12)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "#7c3aed",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                  title={`User ID: ${userId}`}
                >
                  Guest
                </span>
              )}
            </div>
            <p className="db-welcome-sub">
              Welcome back, {ownerName} • Live merchant operations & real-time telemetry
            </p>
          </div>

          <div className="db-topbar-actions">

            {activeTab === "overview" && (
              <button
                className="stitch-refresh-btn"
                onClick={async () => {
                  if (backendStoreId && backendStoreId !== "default") {
                    await fetchAnalytics(backendStoreId, chartTimeframe);
                  }
                  triggerToast("Storefront metrics refreshed! ✨");
                }}
                disabled={analyticsLoading}
                type="button"
                style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                title="Refresh store metrics"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: analyticsLoading ? "spin 0.8s linear infinite" : "none" }}
                >
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {analyticsLoading ? "Refreshing..." : "Refresh"}
              </button>
            )}


            {/* Profile Chip */}
            <div className="db-profile-chip">
              <div className="db-avatar">{getInitials(ownerName)}</div>
              <div className="db-profile-info">
                <span className="db-profile-name">{ownerName}</span>
                <span className="db-profile-role">{shopName}</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── 4 KEY METRIC CARDS (Shown on products and orders tabs) ── */}
        {(activeTab === "products" || activeTab === "orders") && (
          <section className="db-stats-grid">
            {/* Total Products */}
            <div className="db-stat-card" style={{ ["--card-accent" as string]: "#8b5cf6", ["--icon-bg" as string]: "rgba(139, 92, 246, 0.15)" }}>
              <div className="db-stat-header">
                <div className="db-stat-icon-wrap">📦</div>
                <span className="db-stat-badge badge-up">{totalStockCount} in stock</span>
              </div>
              <div className="db-stat-value">{totalProducts}</div>
              <div className="db-stat-label">Total Active Products</div>
            </div>

            {/* Total Orders */}
            <div className="db-stat-card" style={{ ["--card-accent" as string]: "#06b6d4", ["--icon-bg" as string]: "rgba(6, 182, 212, 0.15)" }}>
              <div className="db-stat-header">
                <div className="db-stat-icon-wrap">🛒</div>
                <span className="db-stat-badge badge-up">Live tracking</span>
              </div>
              <div className="db-stat-value">{totalOrdersCount}</div>
              <div className="db-stat-label">Total Customer Orders</div>
            </div>

            {/* Total Sales */}
            <div className="db-stat-card" style={{ ["--card-accent" as string]: "#10b981", ["--icon-bg" as string]: "rgba(16, 185, 129, 0.15)" }}>
              <div className="db-stat-header">
                <div className="db-stat-icon-wrap">💰</div>
                <span className="db-stat-badge badge-up">+18.4% this month</span>
              </div>
              <div className="db-stat-value">{currency}{totalRevenue.toLocaleString()}</div>
              <div className="db-stat-label">Total Gross Sales</div>
            </div>

            {/* Total Customers */}
            <div className="db-stat-card" style={{ ["--card-accent" as string]: "#ec4899", ["--icon-bg" as string]: "rgba(236, 72, 153, 0.15)" }}>
              <div className="db-stat-header">
                <div className="db-stat-icon-wrap">👥</div>
                <span className="db-stat-badge badge-neutral">100% Verified</span>
              </div>
              <div className="db-stat-value">{uniqueCustomers}</div>
              <div className="db-stat-label">Unique Buyers</div>
            </div>
          </section>
        )}

        {/* ── TAB: OVERVIEW — STITCH GLASSMORPHISM STORE MERCHANT DASHBOARD ── */}
        {activeTab === "overview" && (() => {
          // Dynamic calculation from actual sales & customer buys (orders)
          const getOrderDate = (order: Order): Date => {
            if (typeof order.id === "number" && order.id > 1600000000000) {
              return new Date(order.id);
            }
            const parsed = new Date(order.date);
            if (!isNaN(parsed.getTime())) return parsed;
            return new Date();
          };

          // 1. Weekly buckets: Mon to Sun
          const weeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const weeklyValues = [0, 0, 0, 0, 0, 0, 0];

          // 2. Daily buckets: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00, 23:59
          const dailyLabels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "23:59"];
          const dailyValues = [0, 0, 0, 0, 0, 0, 0];

          // 3. Monthly buckets: Week 1, Week 2, Week 3, Week 4
          const monthlyLabels = ["Week 1", "Week 2", "Week 3", "Week 4"];
          const monthlyValues = [0, 0, 0, 0];

          // 4. Yearly buckets: Q1, Q2, Q3, Q4
          const yearlyLabels = ["Q1", "Q2", "Q3", "Q4"];
          const yearlyValues = [0, 0, 0, 0];

          // Populate real values directly from actual orders (sells & buys)
          orders.forEach((order) => {
            const d = getOrderDate(order);
            const amt = Number(order.totalPrice) || 0;

            // Weekly
            const dayIdx = (d.getDay() + 6) % 7;
            weeklyValues[dayIdx] += amt;

            // Daily
            const hour = d.getHours();
            const dailyIdx = Math.min(6, Math.floor(hour / 4));
            dailyValues[dailyIdx] += amt;

            // Monthly
            const dateNum = d.getDate();
            const weekIdx = Math.min(3, Math.floor((dateNum - 1) / 7));
            monthlyValues[weekIdx] += amt;

            // Yearly
            const qIdx = Math.min(3, Math.floor(d.getMonth() / 3));
            yearlyValues[qIdx] += amt;
          });

          const buildChartData = (labels: string[], values: number[], subTitle: string) => {
            const volumeNum = values.reduce((sum, v) => sum + v, 0);
            const volumeStr = currency + volumeNum.toLocaleString();
            const maxVal = Math.max(...values, 0);

            const baselineY = 190;
            const topY = 40;
            const usableHeight = baselineY - topY;

            const points = values.map((val, idx) => {
              const cx = values.length > 1 ? Math.round((idx / (values.length - 1)) * 700) : 350;
              const cy = maxVal > 0 ? Math.round(baselineY - (val / maxVal) * usableHeight) : baselineY;
              return {
                cx,
                cy,
                val,
                color: val > 0 ? "#7c3aed" : "#94a3b8",
                label: currency + val.toLocaleString(),
              };
            });

            let path = points.length > 0 ? `M ${points[0].cx},${points[0].cy}` : "M 0,190";
            for (let i = 0; i < points.length - 1; i++) {
              const p0 = points[i];
              const p1 = points[i + 1];
              const midX = (p0.cx + p1.cx) / 2;
              path += ` C ${midX},${p0.cy} ${midX},${p1.cy} ${p1.cx},${p1.cy}`;
            }

            const strokePath = path;
            const areaPath = `${path} L 700,200 L 0,200 Z`;
            const activePoints = points.filter((p) => p.val > 0);

            let growthText = "0 orders";
            const effectiveOrders =
              backendAnalytics?.totalOrders !== undefined
                ? backendAnalytics.totalOrders
                : orders.length;
            if (effectiveOrders > 0) {
              const itemsCount =
                orders.length > 0
                  ? orders.reduce((acc, o) => acc + (Number(o.quantity) || 1), 0)
                  : effectiveOrders;
              growthText = `${effectiveOrders} order${effectiveOrders > 1 ? "s" : ""} • ${itemsCount} sold`;
            }

            return {
              labels,
              volume: volumeStr,
              rawVolume: volumeNum,
              sub: subTitle,
              growth: growthText,
              strokePath,
              areaPath,
              points: activePoints,
              hasData: volumeNum > 0,
            };
          };

          const subTexts: Record<"daily" | "weekly" | "monthly" | "yearly", string> = {
            daily: "gross volume today",
            weekly: "gross volume this week",
            monthly: "gross volume this month",
            yearly: "gross volume this year",
          };

          let currentChart: ReturnType<typeof buildChartData>;

          if (
            backendAnalytics?.chart?.labels &&
            backendAnalytics?.chart?.values &&
            backendAnalytics.chart.labels.length > 0 &&
            (backendAnalytics.timeframe === chartTimeframe || !backendAnalytics.timeframe)
          ) {
            currentChart = buildChartData(
              backendAnalytics.chart.labels,
              backendAnalytics.chart.values,
              subTexts[chartTimeframe]
            );
          } else {
            const chartDataByTimeframe = {
              weekly: buildChartData(weeklyLabels, weeklyValues, subTexts.weekly),
              daily: buildChartData(dailyLabels, dailyValues, subTexts.daily),
              monthly: buildChartData(monthlyLabels, monthlyValues, subTexts.monthly),
              yearly: buildChartData(yearlyLabels, yearlyValues, subTexts.yearly),
            };
            currentChart = chartDataByTimeframe[chartTimeframe];
          }

          return (
            <div className="stitch-dashboard-container">
              {/* Atmospheric Background Glowing Spheres */}
              <div className="stitch-atmospheric-bg">
                <div className="stitch-orb stitch-orb-1" />
                <div className="stitch-orb stitch-orb-2" />
                <div className="stitch-grid-mesh" />
              </div>

              {/* ── 4 COMPACT METRIC CARDS STRIP ── */}
              <section aria-label="Key Performance Indicators" className="stitch-metrics-grid">
                {/* Card 1: Total Sales */}
                <div className="stitch-metric-card">
                  <div className="stitch-metric-header">
                    <span className="stitch-metric-label">Total Sales</span>
                    <span className="stitch-icon-badge" style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                  </div>
                  <div className="stitch-metric-value">{currency}{totalRevenue.toLocaleString()}</div>
                  <div className="stitch-metric-trend" style={{ color: "#16a34a" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3 }}>
                      <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>+12.5%</span>
                    <span style={{ color: "var(--nm-text-muted)", fontWeight: 500, marginLeft: 5 }}>vs last month</span>
                  </div>
                </div>

                {/* Card 2: Total Orders */}
                <div className="stitch-metric-card">
                  <div className="stitch-metric-header">
                    <span className="stitch-metric-label">Total Orders</span>
                    <span className="stitch-icon-badge" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#d97706" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </span>
                  </div>
                  <div className="stitch-metric-value">{totalOrdersCount}</div>
                  <div className="stitch-metric-trend" style={{ color: "#16a34a" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3 }}>
                      <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>+8.1%</span>
                    <span style={{ color: "var(--nm-text-muted)", fontWeight: 500, marginLeft: 5 }}>vs last week</span>
                  </div>
                </div>

                {/* Card 3: Customers */}
                <div className="stitch-metric-card">
                  <div className="stitch-metric-header">
                    <span className="stitch-metric-label">Customers</span>
                    <span className="stitch-icon-badge" style={{ background: "rgba(6, 182, 212, 0.1)", color: "#0284c7" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </span>
                  </div>
                  <div className="stitch-metric-value">{uniqueCustomers}</div>
                  <div className="stitch-metric-trend" style={{ color: "#16a34a" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 3 }}>
                      <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>+14.2%</span>
                    <span style={{ color: "var(--nm-text-muted)", fontWeight: 500, marginLeft: 5 }}>new buyers</span>
                  </div>
                </div>

                {/* Card 4: Total Products */}
                <div className="stitch-metric-card">
                  <div className="stitch-metric-header">
                    <span className="stitch-metric-label">Total Products</span>
                    <span className="stitch-icon-badge" style={{ background: "rgba(139, 92, 246, 0.1)", color: "#7c3aed" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </span>
                  </div>
                  <div className="stitch-metric-value">{totalProducts}</div>
                  <div className="stitch-metric-trend" style={{ color: "#7c3aed" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block", marginRight: 5, boxShadow: "0 0 5px rgba(16, 185, 129, 0.5)" }} />
                    <span style={{ color: "var(--nm-text-dark)", fontWeight: 700 }}>{totalStockCount} in stock</span>
                    <span style={{ color: "var(--nm-text-muted)", fontWeight: 500, marginLeft: 5 }}>
                      ({lowStockCount} low)
                    </span>
                  </div>
                </div>
              </section>

              {/* ── BALANCED TWO-COLUMN COMMAND CENTER GRID (FITS SCREEN PERFECTLY) ── */}
              <div className="stitch-layout-grid">
                {/* ── TOP-LEFT: RECENT ORDERS CARD ── */}
                <div className="stitch-glass-panel stitch-orders-card" data-purpose="recent-orders-table">
                  <div className="stitch-orders-header">
                    <div className="stitch-orders-title-row">
                      <h2 className="stitch-orders-title">Recent Orders</h2>
                      <span className="stitch-orders-count-pill">{orders.length} orders</span>
                    </div>

                    <div className="stitch-orders-actions">
                      <button
                        onClick={() => setShowSampleOrderModal(true)}
                        className="stitch-refresh-btn"
                        style={{ padding: "5px 12px", fontSize: "0.76rem" }}
                        type="button"
                        title="Choose sample orders"
                      >
                        ⚡ Samples
                      </button>
                      <button
                        onClick={() => setShowOrderModal(true)}
                        className="stitch-copy-btn"
                        style={{ padding: "5px 12px", fontSize: "0.76rem" }}
                        type="button"
                      >
                        + Add Order
                      </button>
                      <button
                        className="stitch-link-btn"
                        onClick={() => setActiveTab("orders")}
                        type="button"
                        title="View complete orders list"
                      >
                        All →
                      </button>
                    </div>
                  </div>

                  {/* Responsive Orders Table */}
                  <div className="stitch-table-wrapper">
                    {orders.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center", background: "var(--nm-bg)", boxShadow: "var(--nm-shadow-in)", borderRadius: 12, margin: 10, border: "1px dashed var(--nm-border-inner)" }}>
                        <span style={{ fontSize: "1.3rem", display: "block", marginBottom: 5 }}>🛒</span>
                        <p style={{ fontSize: "0.85rem", color: "var(--nm-text-dark)", fontWeight: 700 }}>No Orders Recorded Yet</p>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                          <button onClick={() => setShowSampleOrderModal(true)} className="stitch-copy-btn" type="button" style={{ fontSize: "0.74rem", padding: "5px 12px" }}>
                            ⚡ Choose Samples
                          </button>
                          <button onClick={() => setShowOrderModal(true)} className="stitch-refresh-btn" type="button" style={{ fontSize: "0.74rem", padding: "5px 12px" }}>
                            ➕ Add Order
                          </button>
                        </div>
                      </div>
                    ) : (
                      <table className="stitch-table">
                        <thead>
                          <tr>
                            <th scope="col">ID</th>
                            <th scope="col">Customer</th>
                            <th scope="col">Amount</th>
                            <th scope="col">Status</th>
                            <th scope="col">Date</th>
                            <th scope="col" style={{ textAlign: "right" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.slice(0, 6).map((order) => {
                            const badgeClass =
                              order.status === "completed"
                                ? "stitch-badge-completed"
                                : order.status === "processing"
                                ? "stitch-badge-processing"
                                : order.status === "pending"
                                ? "stitch-badge-pending"
                                : "stitch-badge-shipped";

                            const initial = (order.customerName || "Customer").charAt(0).toUpperCase();

                            return (
                              <tr key={order.id}>
                                <td className="stitch-order-id">#{order.id}</td>
                                <td>
                                  <div className="stitch-customer-cell">
                                    <div
                                      className="stitch-customer-avatar"
                                      style={{
                                        background:
                                          order.status === "completed"
                                            ? "linear-gradient(135deg, #059669, #10b981)"
                                            : order.status === "processing"
                                            ? "linear-gradient(135deg, #2563eb, #3b82f6)"
                                            : order.status === "pending"
                                            ? "linear-gradient(135deg, #d97706, #f59e0b)"
                                            : "linear-gradient(135deg, #7c3aed, #a855f7)",
                                      }}
                                    >
                                      {initial}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, color: "var(--nm-text-dark)" }}>{order.customerName}</div>
                                      <div style={{ fontSize: "0.68rem", color: "var(--nm-text-muted)" }}>{order.productName} × {order.quantity}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="stitch-order-amount">
                                  {currency}{order.totalPrice.toLocaleString()}
                                </td>
                                <td>
                                  <button
                                    className={`stitch-badge ${badgeClass}`}
                                    onClick={() => toggleOrderStatus(order.id)}
                                    title="Click to toggle status"
                                    type="button"
                                  >
                                    <span className="stitch-badge-dot" />
                                    <span>{order.status}</span>
                                  </button>
                                </td>
                                <td style={{ color: "var(--nm-text-muted)", fontSize: "0.72rem" }}>{order.date}</td>
                                <td style={{ textAlign: "right" }}>
                                  <button
                                    onClick={() => handleDeleteOrder(order.id)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#94a3b8",
                                      cursor: "pointer",
                                      padding: "2px 6px",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "#e11d48")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                                    title="Delete order"
                                    type="button"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* ── TOP-RIGHT: STOREFRONT HUB & OPERATIONS (BALANCED HEIGHT) ── */}
                <div className="stitch-side-column">
                  {/* Operations & Growth Hub (Low Stock & Active Festive Offer) */}
                  <div className="stitch-glass-panel stitch-ops-card" data-purpose="operations-growth-card">
                    <div className="stitch-card-header" style={{ marginBottom: 4 }}>
                      <div className="stitch-card-title-wrap">
                        <span className="stitch-icon-badge" style={{ background: "rgba(244, 63, 94, 0.1)", color: "#e11d48", width: 24, height: 24 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </span>
                        <h3 className="stitch-card-title">Low Stock Alert</h3>
                      </div>
                      <span className="stitch-critical-pill">
                        {lowStockCount > 0 ? `${lowStockCount} Critical` : "All Good"}
                      </span>
                    </div>

                    {/* Stock Item List (Top 2 items for screen-fit compactness) */}
                    <div className="stitch-stock-list">
                      {lowStockProducts.length === 0 ? (
                        <div style={{ padding: "10px 12px", textAlign: "center", background: "var(--nm-bg)", boxShadow: "var(--nm-shadow-in)", borderRadius: 10, border: "1px dashed var(--nm-border-inner)" }}>
                          <p style={{ fontSize: "0.76rem", color: "var(--nm-text-dark)", fontWeight: 700 }}>✨ All products well stocked</p>
                        </div>
                      ) : (
                        lowStockProducts.slice(0, 2).map((item) => (
                          <div key={item.id} className="stitch-stock-item">
                            <div className="stitch-stock-left">
                              <div className="stitch-stock-thumb" style={{ overflow: "hidden" }}>
                                {item.image ? (
                                  <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }} />
                                ) : (
                                  item.emoji || "📦"
                                )}
                              </div>
                              <div>
                                <h4 className="stitch-stock-name">{item.name}</h4>
                                <span className="stitch-stock-meta">
                                  {currency}{item.price.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <span className="stitch-left-badge">Only {item.stock} left</span>
                              <button
                                className="stitch-restock-btn"
                                onClick={() => handleQuickRestock(item.id, item.name)}
                                type="button"
                              >
                                Restock (+10)
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Subtle Reset and Inventory Footer */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--nm-border-inner)", marginTop: "auto" }}>
                      <button
                        onClick={() => setActiveTab("products")}
                        className="stitch-link-btn"
                        style={{ fontSize: "0.72rem" }}
                        type="button"
                      >
                        Manage Inventory ({products.length}) →
                      </button>
                      <button
                        onClick={clearAllData}
                        style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "0.68rem", cursor: "pointer", transition: "color 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#e11d48")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        title="Reset store data"
                        type="button"
                      >
                        🗑️ Reset Data
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── BOTTOM-LEFT: GROSS SALES GRAPH CARD ── */}
                <div className="stitch-glass-panel stitch-graph-card" data-purpose="gross-sales-graph">
                  <div className="stitch-graph-header">
                    <div className="stitch-graph-title-row">
                      <h2 className="stitch-graph-title">Gross Sales</h2>
                      <span className="stitch-growth-pill">{currentChart.growth}</span>
                      <div className="stitch-volume-inline">
                        <span className="stitch-volume-inline-num">{currentChart.volume}</span>
                        <span className="stitch-volume-inline-sub">{currentChart.sub}</span>
                      </div>
                    </div>

                    {/* Timeframe Filter Tabs */}
                    <div className="stitch-time-tabs">
                      {(["daily", "weekly", "monthly", "yearly"] as const).map((tf) => (
                        <button
                          key={tf}
                          className={`stitch-time-btn ${chartTimeframe === tf ? "active" : ""}`}
                          onClick={() => setChartTimeframe(tf)}
                          type="button"
                        >
                          {tf.charAt(0).toUpperCase() + tf.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG Smooth Area Chart */}
                  <div className="stitch-chart-wrap">
                    <svg className="stitch-chart-svg" viewBox="0 0 700 200" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="salesWhiteGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
                          <stop offset="60%" stopColor="#6366f1" stopOpacity="0.05" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>

                        <linearGradient id="neonLineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="50%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>

                        <filter id="stitchChartGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#7c3aed" floodOpacity="0.25" />
                        </filter>
                      </defs>

                      {/* Grid lines */}
                      <line x1="0" y1="40" x2="700" y2="40" stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1="0" y1="90" x2="700" y2="90" stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1="0" y1="140" x2="700" y2="140" stroke="rgba(0,0,0,0.04)" strokeDasharray="3 3" strokeWidth="1" />
                      <line x1="0" y1="190" x2="700" y2="190" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />

                      {/* Area Fill with gradient */}
                      <path d={currentChart.areaPath} fill="url(#salesWhiteGradient)" />

                      {/* Glowing Stroke Line */}
                      <path
                        d={currentChart.strokePath}
                        fill="none"
                        stroke="url(#neonLineGradient)"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        filter="url(#stitchChartGlow)"
                      />

                      {/* Active points with value callouts */}
                      {currentChart.points.map((pt, idx) => (
                        <g key={idx}>
                          <circle
                            cx={pt.cx}
                            cy={pt.cy}
                            r="5"
                            fill={pt.color}
                            stroke="#e0e5ec"
                            strokeWidth="2.5"
                            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
                          />
                          <text
                            x={pt.cx > 620 ? pt.cx - 8 : pt.cx < 80 ? pt.cx + 8 : pt.cx}
                            y={Math.max(24, pt.cy - 10)}
                            textAnchor={pt.cx > 620 ? "end" : pt.cx < 80 ? "start" : "middle"}
                            fill="#6366f1"
                            fontSize="11"
                            fontWeight="800"
                            style={{ filter: "drop-shadow(0 1px 1px rgba(255,255,255,0.9))" }}
                          >
                            {pt.label}
                          </text>
                        </g>
                      ))}

                      {!currentChart.hasData && (
                        <g>
                          <text
                            x="350"
                            y="105"
                            textAnchor="middle"
                            fill="#718096"
                            fontSize="12"
                            fontWeight="600"
                          >
                            No sales recorded yet
                          </text>
                          <text
                            x="350"
                            y="125"
                            textAnchor="middle"
                            fill="#a0aec0"
                            fontSize="10"
                            fontWeight="500"
                          >
                            Customer purchases & orders will plot here in real time
                          </text>
                        </g>
                      )}
                    </svg>

                    {/* Chart X-Axis Labels */}
                    <div className="stitch-xaxis-labels">
                      {currentChart.labels.map((lbl, idx) => (
                        <span key={idx}>{lbl}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── TAB: PRODUCTS ── */}
        {activeTab === "products" && (
          <div className="db-panel">
            <div className="db-panel-header" style={{ flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 className="db-panel-title">
                  <span>📦</span> Product Catalog ({products.length})
                </h2>
                <p className="db-panel-subtitle">Manage, search, adjust stock, and edit items</p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="db-form-input"
                  style={{ width: 220, padding: "8px 14px", fontSize: "0.85rem" }}
                />
                <button
                  onClick={() => setShowSampleChooserModal(true)}
                  className="db-btn db-btn-outline-accent"
                  data-cursor="link"
                  title="Choose sample products manually"
                >
                  ✨ Choose from Catalog
                </button>
                <button onClick={openAddProductModal} className="db-btn db-btn-primary" data-cursor="link">
                  + Add Product
                </button>
                {products.length > 0 && (
                  <button
                    onClick={handleClearAllProducts}
                    className="db-btn db-btn-danger"
                    data-cursor="link"
                    title="Remove all products"
                  >
                    🗑️ Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="db-items-list" style={{ marginTop: 16 }}>
              {products.length === 0 ? (
                <div className="db-empty-catalog-card">
                  <div className="db-empty-catalog-icon">📦</div>
                  <h3 className="db-empty-catalog-title">Catalog is Empty</h3>
                  <p className="db-empty-catalog-desc">
                    All example items have been removed. Choose sample products manually from the catalog, or click below to add a custom product.
                  </p>
                  <div className="db-empty-catalog-actions">
                    <button
                      onClick={() => setShowSampleChooserModal(true)}
                      className="db-btn db-btn-primary"
                      data-cursor="link"
                    >
                      ✨ Choose Sample Products
                    </button>
                    <button
                      onClick={openAddProductModal}
                      className="db-btn db-btn-secondary"
                      data-cursor="link"
                    >
                      ➕ Add Custom Product
                    </button>
                  </div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="db-empty-state">
                  <div className="db-empty-icon">🔍</div>
                  <p>No products match your search query.</p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div key={product.id} className="db-item-row">
                    <div className="db-item-main">
                      <div className="db-item-emoji" style={{ overflow: "hidden" }}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
                        ) : (
                          product.emoji || "📦"
                        )}
                      </div>
                      <div className="db-item-details">
                        <h4>{product.name}</h4>
                        <div className="db-item-meta">
                          <span style={{ color: "var(--db-accent)" }}>{product.category}</span>
                          <span>•</span>
                          <span>{product.description || "No description"}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {/* Stock Stepper */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: "8px" }}>
                        <button
                          className="db-icon-btn"
                          style={{ width: 24, height: 24, fontSize: "0.8rem" }}
                          onClick={() => adjustStock(product.id, -1)}
                          title="Decrease stock"
                          data-cursor="link"
                        >
                          -
                        </button>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, minWidth: 28, textAlign: "center" }}>
                          {product.stock}
                        </span>
                        <button
                          className="db-icon-btn"
                          style={{ width: 24, height: 24, fontSize: "0.8rem" }}
                          onClick={() => adjustStock(product.id, 1)}
                          title="Increase stock"
                          data-cursor="link"
                        >
                          +
                        </button>
                      </div>

                      <span className="db-item-price">
                        {currency}{product.price.toLocaleString()}
                      </span>

                      <div className="db-item-actions">
                        <button
                          className="db-icon-btn"
                          onClick={() => openEditProductModal(product)}
                          title="Edit product"
                          data-cursor="link"
                        >
                          ✏️
                        </button>
                        <button
                          className="db-icon-btn btn-delete"
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          title="Delete product"
                          data-cursor="link"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ORDERS ── */}
        {activeTab === "orders" && (
          <div className="db-panel">
            <div className="db-panel-header" style={{ flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 className="db-panel-title">
                  <span>📋</span> Orders Management ({orders.length})
                </h2>
                <p className="db-panel-subtitle">Filter by fulfillment status and manage customer receipts</p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                  className="db-form-select"
                  style={{ width: 140, padding: "8px 12px", fontSize: "0.85rem" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="pending">Pending</option>
                </select>

                <button
                  onClick={() => setShowSampleOrderModal(true)}
                  className="db-btn db-btn-outline-accent"
                  data-cursor="link"
                  title="Choose sample orders manually"
                >
                  ⚡ Choose Sample Orders
                </button>

                <button onClick={() => setShowOrderModal(true)} className="db-btn db-btn-primary" data-cursor="link">
                  + Create Order
                </button>

                {orders.length > 0 && (
                  <button
                    onClick={handleClearAllOrders}
                    className="db-btn db-btn-danger"
                    data-cursor="link"
                    title="Remove all orders"
                  >
                    🗑️ Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="db-items-list" style={{ marginTop: 16 }}>
              {orders.length === 0 ? (
                <div className="db-empty-catalog-card">
                  <div className="db-empty-catalog-icon">🛒</div>
                  <h3 className="db-empty-catalog-title">No Orders Recorded</h3>
                  <p className="db-empty-catalog-desc">
                    All example orders have been removed. Choose sample orders manually to simulate sales or record a customer order.
                  </p>
                  <div className="db-empty-catalog-actions">
                    <button
                      onClick={() => setShowSampleOrderModal(true)}
                      className="db-btn db-btn-primary"
                      data-cursor="link"
                    >
                      ⚡ Choose Sample Orders
                    </button>
                    <button
                      onClick={() => setShowOrderModal(true)}
                      className="db-btn db-btn-secondary"
                      data-cursor="link"
                    >
                      ➕ Record Custom Order
                    </button>
                  </div>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="db-empty-state">
                  <div className="db-empty-icon">🧾</div>
                  <p>No orders found for the selected filter.</p>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <div key={order.id} className="db-item-row">
                    <div className="db-item-main">
                      <div className="db-item-emoji">📦</div>
                      <div className="db-item-details">
                        <h4>{order.customerName}</h4>
                        <div className="db-item-meta">
                          <span style={{ color: "var(--nm-text-dark)", fontWeight: 600 }}>{order.productName}</span>
                          <span>× {order.quantity} units</span>
                          <span>•</span>
                          <span>{order.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="db-item-actions">
                      <button
                        className={`order-status status-${order.status}`}
                        onClick={() => toggleOrderStatus(order.id)}
                        title="Click to toggle status"
                        style={{ cursor: "pointer", border: "none" }}
                        data-cursor="link"
                      >
                        {order.status}
                      </button>
                      <span className="db-item-price" style={{ color: "var(--nm-accent-green)", marginLeft: 10 }}>
                        {currency}{order.totalPrice.toLocaleString()}
                      </span>
                      <button
                        className="db-icon-btn btn-delete"
                        onClick={() => handleDeleteOrder(order.id)}
                        title="Delete order"
                        data-cursor="link"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB: SETTINGS ── */}
        {activeTab === "settings" && (
          <div className="db-panel" style={{ maxWidth: 760 }}>
            <div className="db-panel-header">
              <div>
                <h2 className="db-panel-title">
                  <span>⚙️</span> Store Profile & Configuration
                </h2>
                <p className="db-panel-subtitle">Personalize your architectural presence</p>
              </div>
            </div>

            <form onSubmit={saveSettings} className="db-form" style={{ marginTop: 20 }}>
              {/* Row 1: Owner Name & Shop Name */}
              <div className="db-form-row">
                <div className="db-form-group">
                  <label>Store Owner Full Name *</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="db-form-input"
                    placeholder="e.g. Alexander Vance"
                    required
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--nm-text-light)" }}>
                    Used for merchant signature and dashboard greeting
                  </span>
                </div>

                <div className="db-form-group">
                  <label>Shop / Brand Name *</label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="db-form-input"
                    placeholder="e.g. OBSIDIAN Haute Couture"
                    required
                  />
                  <span style={{ fontSize: "0.72rem", color: "var(--nm-text-light)" }}>
                    Defines your storefront slug: {storeSlug ? `/p3.html?slug=${encodeURIComponent(storeSlug)}` : "/p3.html"}
                  </span>
                </div>
              </div>

              {/* Row 2: Business Category & Currency */}
              <div className="db-form-row">
                <div className="db-form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label>Business Type / Category *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualType((prev) => !prev);
                        if (!isManualType && businessType !== "other") {
                          setBusinessType("other");
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#7c3aed",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {isManualType || businessType === "other" ? "Choose Preset" : "+ Custom Type"}
                    </button>
                  </div>

                  <select
                    value={businessType}
                    onChange={(e) => {
                      setBusinessType(e.target.value);
                      if (e.target.value === "other") {
                        setIsManualType(true);
                      }
                    }}
                    className="db-form-select"
                  >
                    <option value="clothing">Clothing & Apparel</option>
                    <option value="grocery">Grocery & Essentials</option>
                    <option value="electronics">Electronics & Tech</option>
                    <option value="restaurant">Restaurant & Dining</option>
                    <option value="beauty">Beauty & Cosmetics</option>
                    <option value="medical">Medical & Pharmacy</option>
                    <option value="luxury">Luxury & Jewelry</option>
                    <option value="general">Art & Sculpture</option>
                    <option value="other">Other / Custom</option>
                    {customOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {(isManualType || businessType === "other") && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                      <input
                        type="text"
                        placeholder="Type custom business category..."
                        value={customBusinessType}
                        onChange={(e) => setCustomBusinessType(e.target.value)}
                        className="db-form-input"
                        style={{ padding: "8px 12px", fontSize: "0.82rem" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = customBusinessType.trim();
                          if (val && !customOptions.includes(val)) {
                            setCustomOptions((prev) => [...prev, val]);
                            setBusinessType(val);
                            triggerToast(`Added "${val}" to business types!`);
                          }
                        }}
                        className="db-btn db-btn-secondary"
                        style={{ padding: "8px 14px", fontSize: "0.76rem", whiteSpace: "nowrap" }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                <div className="db-form-group">
                  <label>Store Currency *</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="db-form-select"
                  >
                    <option value="₹">₹ (INR - Indian Rupee)</option>
                    <option value="$">$ (USD - US Dollar)</option>
                    <option value="€">€ (EUR - Euro)</option>
                    <option value="£">£ (GBP - British Pound)</option>
                    <option value="¥">¥ (JPY - Japanese Yen)</option>
                    <option value="AED ">AED (United Arab Emirates Dirham)</option>
                  </select>
                  <span style={{ fontSize: "0.72rem", color: "var(--nm-text-light)" }}>
                    All storefront prices and reports format in this currency
                  </span>
                </div>
              </div>

              {/* Row 3: Shop Physical Location & Address Method */}
              <div className="db-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label>Store Location & Address</label>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem", fontWeight: 600, color: "var(--nm-text-dark)", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="addressMethod"
                        value="manual"
                        checked={addressMethod === "manual"}
                        onChange={() => setAddressMethod("manual")}
                        style={{ accentColor: "#7c3aed" }}
                      />
                      Manual Entry
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem", fontWeight: 600, color: "var(--nm-text-dark)", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="addressMethod"
                        value="map"
                        checked={addressMethod === "map"}
                        onChange={() => setAddressMethod("map")}
                        style={{ accentColor: "#7c3aed" }}
                      />
                      Google Maps
                    </label>
                  </div>
                </div>

                {addressMethod === "manual" ? (
                  <textarea
                    id="shopAddress"
                    placeholder="Enter your physical store address (Street address, suite/floor, city, state, postal code)"
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    className="db-form-textarea"
                    rows={3}
                  />
                ) : (
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: "rgba(99, 102, 241, 0.04)",
                      border: "1px dashed rgba(99, 102, 241, 0.25)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "1.5rem" }}>📍</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--nm-text-dark)" }}>Google Maps Geolocation Mode</strong>
                    <p style={{ fontSize: "0.76rem", color: "var(--nm-text-light)", maxWidth: "420px", margin: 0 }}>
                      Store geolocation is linked via coordinates. Customers viewing your storefront can navigate directly to your shop.
                    </p>
                    <input
                      type="text"
                      placeholder="Optional Google Maps URL or Coordinates (e.g. 28.6139, 77.2090)"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      className="db-form-input"
                      style={{ maxWidth: "440px", fontSize: "0.8rem", padding: "8px 12px", textAlign: "center" }}
                    />
                  </div>
                )}
                <span style={{ fontSize: "0.72rem", color: "var(--nm-text-light)" }}>
                  Displayed on customer order receipts and storefront contact footer
                </span>
              </div>

              {/* Store Branding & Media Assets (Supabase Storage) */}
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  borderRadius: "var(--nm-radius-lg)",
                  background: "var(--nm-bg)",
                  boxShadow: "var(--nm-shadow-in)",
                  border: "1px solid rgba(255, 255, 255, 0.7)",
                }}
              >
                <h4
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    color: "var(--nm-text-dark)",
                    marginBottom: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>🖼️</span> Store Branding & Media Assets (Supabase Storage)
                </h4>

                <div className="db-form-row">
                  {/* Store Logo */}
                  <div className="db-form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ margin: 0 }}>Store Logo</label>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoUrl("");
                            localStorage.removeItem("storeLogo");
                            const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
                            if (targetStoreId && targetStoreId !== "default") {
                              api.updateStore(targetStoreId, { logo_url: null }).catch(() => {});
                            }
                          }}
                          style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.72rem", cursor: "pointer", fontWeight: 600 }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {logoUrl ? (
                        <div style={{ width: "52px", height: "52px", borderRadius: "12px", overflow: "hidden", boxShadow: "var(--nm-shadow-out)", border: "1px solid rgba(255,255,255,0.8)", flexShrink: 0 }}>
                          <img src={logoUrl} alt="Store logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: "var(--nm-bg)", boxShadow: "var(--nm-shadow-out)", border: "1px solid rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                          🏷️
                        </div>
                      )}
                      <label
                        className="db-btn db-btn-secondary"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: isUploadingLogo ? "wait" : "pointer", fontSize: "0.76rem", padding: "8px 14px" }}
                      >
                        <span>{isUploadingLogo ? "⏳" : "☁️"}</span>
                        <span>{isUploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          style={{ display: "none" }}
                          disabled={isUploadingLogo}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadLogo(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Store Banner */}
                  <div className="db-form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={{ margin: 0 }}>Store Banner</label>
                      {bannerUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setBannerUrl("");
                            localStorage.removeItem("storeBanner");
                            const targetStoreId = backendStoreId || localStorage.getItem("obsidian_store_id");
                            if (targetStoreId && targetStoreId !== "default") {
                              api.updateStore(targetStoreId, { banner_url: null }).catch(() => {});
                            }
                          }}
                          style={{ background: "none", border: "none", color: "#ef4444", fontSize: "0.72rem", cursor: "pointer", fontWeight: 600 }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      {bannerUrl ? (
                        <div style={{ width: "76px", height: "52px", borderRadius: "12px", overflow: "hidden", boxShadow: "var(--nm-shadow-out)", border: "1px solid rgba(255,255,255,0.8)", flexShrink: 0 }}>
                          <img src={bannerUrl} alt="Store banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ width: "76px", height: "52px", borderRadius: "12px", background: "var(--nm-bg)", boxShadow: "var(--nm-shadow-out)", border: "1px solid rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>
                          🌆
                        </div>
                      )}
                      <label
                        className="db-btn db-btn-secondary"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: isUploadingBanner ? "wait" : "pointer", fontSize: "0.76rem", padding: "8px 14px" }}
                      >
                        <span>{isUploadingBanner ? "⏳" : "☁️"}</span>
                        <span>{isUploadingBanner ? "Uploading..." : "Upload Banner"}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          style={{ display: "none" }}
                          disabled={isUploadingBanner}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadBanner(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Storefront Design & Architecture Template Selection */}
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  borderRadius: "var(--nm-radius-lg)",
                  background: "var(--nm-bg)",
                  boxShadow: "var(--nm-shadow-in)",
                  border: "1px solid rgba(255, 255, 255, 0.7)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: 8 }}>
                  <h4
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      color: "var(--nm-text-dark)",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>🎨</span> Storefront Architectural Templates
                  </h4>
                  <span style={{ fontSize: "0.74rem", color: "var(--nm-text-light)" }}>
                    Select theme for public storefront (/p3.html)
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {availableTemplates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        style={{
                          padding: "16px",
                          borderRadius: "14px",
                          background: isSelected ? "rgba(124, 58, 237, 0.06)" : "var(--nm-bg)",
                          border: isSelected ? "2px solid #7c3aed" : "1px solid var(--nm-border-inner)",
                          boxShadow: isSelected ? "0 0 0 1px #7c3aed, var(--nm-shadow-out)" : "var(--nm-shadow-out)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          transition: "all 0.2s ease",
                          position: "relative",
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: "absolute",
                              top: "10px",
                              right: "10px",
                              background: "#7c3aed",
                              color: "#ffffff",
                              fontSize: "0.65rem",
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                            }}
                          >
                            ✓ Active
                          </div>
                        )}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ fontSize: "1.2rem" }}>
                              {tpl.id === "obsidian-classic" ? "🌌" : tpl.id === "obsidian-minimal" ? "✨" : tpl.id === "obsidian-luxury" ? "👑" : "📰"}
                            </span>
                            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--nm-text-dark)" }}>
                              {tpl.name}
                            </div>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "#7c3aed", fontWeight: 700, marginBottom: "6px" }}>
                            {tpl.category || "Storefront Theme"}
                          </div>
                          <p style={{ fontSize: "0.74rem", color: "var(--nm-text-light)", margin: "0 0 14px", lineHeight: 1.4 }}>
                            {tpl.description}
                          </p>
                        </div>

                        <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                          <button
                            type="button"
                            onClick={() => handleSelectTemplate(tpl.id)}
                            disabled={isSelectingTemplate}
                            className={isSelected ? "db-btn db-btn-primary" : "db-btn db-btn-secondary"}
                            style={{
                              flex: 1,
                              fontSize: "0.74rem",
                              padding: "8px 10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "4px",
                              cursor: isSelectingTemplate ? "wait" : "pointer",
                            }}
                          >
                            {isSelected ? "✓ Applied" : "Select Template"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowStorePreview(true)}
                            className="db-btn db-btn-secondary"
                            style={{ fontSize: "0.74rem", padding: "8px 10px" }}
                            title="Preview Storefront"
                          >
                            👁️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  type="submit"
                  className="db-btn db-btn-primary"
                  data-cursor="link"
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? "⏳ Saving..." : "💾 Save Store Profile & Configuration"}
                </button>
                <button type="button" onClick={clearAllData} className="db-btn db-btn-danger" data-cursor="link">
                  🗑️ Clear Store Data
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB: DEPLOYMENT ── */}
        {activeTab === "deployment" && (
          <div className="db-panel" style={{ maxWidth: 760 }}>
            <div className="db-panel-header">
              <div>
                <h2 className="db-panel-title">
                  <span>🚀</span> DEPLOYMENT
                </h2>
                <p className="db-panel-subtitle">Live storefront distribution & connectivity</p>
              </div>
            </div>

            {/* Storefront Hub (Link + QR + Integrated Quick Actions) */}
            <div className="stitch-glass-panel stitch-side-card" data-purpose="storefront-hub-card">
              <div className="stitch-card-header">
                <div className="stitch-card-title-wrap">
                  <span className="stitch-icon-badge" style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", width: 24, height: 24 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </span>
                  <h3 className="stitch-card-title">Storefront Hub</h3>
                </div>
                <span className="stitch-live-pill">
                  <span className="stitch-live-dot" />
                  Live
                </span>
              </div>

              {/* Store Link URL Box */}
              <div className="stitch-link-box">
                <span className="stitch-link-text">
                  {deploymentUrl ||
                    storefrontUrl ||
                    (storeSlug
                      ? `http://localhost:3000/p3.html?slug=${encodeURIComponent(storeSlug)}`
                      : "http://localhost:3000/p3.html")}
                </span>
                <button className="stitch-copy-btn" onClick={copyStoreLink} type="button">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </div>

              {/* Quick Link Footer */}
              <div className="stitch-link-footer" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={
                    deploymentUrl ||
                    storefrontUrl ||
                    (storeSlug ? `/p3.html?slug=${encodeURIComponent(storeSlug)}` : "/p3.html")
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stitch-link-btn"
                >
                  Open storefront ↗
                </a>
                <button
                  className="stitch-link-btn"
                  style={{ color: "var(--nm-text-muted)" }}
                  onClick={() => setShowQrModal(true)}
                  type="button"
                >
                  📷 QR Code
                </button>
                <button
                  className="stitch-link-btn"
                  style={{ color: "#7c3aed", fontWeight: 700 }}
                  onClick={handleDeployToVercel}
                  disabled={isDeploying}
                  type="button"
                >
                  {isDeploying ? "Deploying... ⏳" : "🚀 Deploy to Vercel"}
                </button>
              </div>
            </div>

            {/* Storefront Template Card in Deployment Tab */}
            <div className="stitch-glass-panel stitch-side-card" style={{ marginTop: "16px" }} data-purpose="template-selection-card">
              <div className="stitch-card-header">
                <div className="stitch-card-title-wrap">
                  <span className="stitch-icon-badge" style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", width: 24, height: 24 }}>
                    🎨
                  </span>
                  <h3 className="stitch-card-title">Storefront Architecture Theme</h3>
                </div>
                <span className="stitch-live-pill" style={{ background: "rgba(124, 58, 237, 0.12)", color: "#7c3aed" }}>
                  {availableTemplates.find((t) => t.id === selectedTemplateId)?.name || selectedTemplateId}
                </span>
              </div>

              <p style={{ fontSize: "0.78rem", color: "var(--nm-text-muted)", margin: "0 0 12px" }}>
                Switch or bind a live storefront architectural template deployed on Vercel & Supabase.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {availableTemplates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id)}
                      disabled={isSelectingTemplate}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: isSelected ? "rgba(124, 58, 237, 0.08)" : "var(--nm-bg)",
                        border: isSelected ? "2px solid #7c3aed" : "1px solid var(--nm-border-inner)",
                        textAlign: "left",
                        cursor: isSelectingTemplate ? "wait" : "pointer",
                        boxShadow: isSelected ? "0 0 0 1px #7c3aed" : "var(--nm-shadow-out)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--nm-text-dark)", display: "flex", justifyContent: "space-between" }}>
                        <span>{tpl.name}</span>
                        {isSelected && <span style={{ color: "#7c3aed", fontWeight: 800 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#7c3aed", marginTop: 2 }}>{tpl.category}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL: ADD / EDIT PRODUCT (Hand-Drawn Reference Layout - Pure Neumorphism) ── */}
      {showProductModal && (
        <div className="db-modal-backdrop" onClick={() => setShowProductModal(false)}>
          <div className="hand-ref-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto" }}>

            {/* Header */}
            <div className="hand-ref-header">
              <h3 className="hand-ref-title">
                <span className="hand-ref-title-badge"></span>
                {editingProduct ? "Edit Product" : "Add Product"}
              </h3>
              <button
                type="button"
                className="hand-ref-close-btn"
                onClick={() => setShowProductModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProductSubmit}>

              {/* ── TOP GRID: Image (left) + Name/Brand/Type (right) ── */}
              <div className="hand-ref-grid">

                {/* LEFT: Product Image Upload */}
                <div>
                  <label className="hand-ref-img-box" htmlFor="hand-ref-file-input">
                    {formImage ? (
                      <img src={formImage} alt="Preview" className="hand-ref-img-preview" />
                    ) : (
                      <div className="hand-ref-img-placeholder">
                        <div style={{ fontSize: "2.6rem", marginBottom: 8 }}>📷</div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--nm-text-dark)" }}>Click to upload image</div>
                        <div style={{ fontSize: "0.72rem", marginTop: 4, color: "var(--nm-text-muted)" }}>or paste URL below</div>
                      </div>
                    )}
                    <input
                      id="hand-ref-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      style={{ display: "none" }}
                      disabled={isUploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadProductImage(file);
                      }}
                    />
                  </label>
                  {/* URL Paste + Remove */}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="url"
                      placeholder="Paste image URL (https://...)"
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      className="hand-ref-input"
                      style={{ fontSize: "0.78rem", padding: "10px 12px" }}
                    />
                    {formImage && (
                      <button
                        type="button"
                        onClick={() => setFormImage("")}
                        style={{
                          background: "var(--nm-bg)",
                          border: "none",
                          borderRadius: "50%",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--nm-accent-red)",
                          cursor: "pointer",
                          boxShadow: "var(--nm-shadow-out)",
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                        title="Remove image"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {isUploadingImage && (
                    <div style={{ marginTop: 6, fontSize: "0.74rem", color: "var(--nm-accent)", fontWeight: 700 }}>⏳ Uploading to storage...</div>
                  )}
                </div>

                {/* RIGHT: Product Name, Brand, Type */}
                <div className="hand-ref-right-col">

                  {/* Product Name */}
                  <div className="hand-ref-input-group">
                    <label className="hand-ref-label">Product Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Classic T-Shirt"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="hand-ref-input"
                      required
                    />
                  </div>

                  {/* Brand */}
                  <div className="hand-ref-input-group">
                    <label className="hand-ref-label">Brand</label>
                    {showAddBrandInput ? (
                      <div className="hand-ref-input-with-btn">
                        <input
                          type="text"
                          placeholder="Enter new brand name..."
                          value={newBrandInput}
                          onChange={(e) => setNewBrandInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddBrand(); } }}
                          className="hand-ref-input"
                          autoFocus
                        />
                        <button type="button" className="hand-ref-plus-btn" onClick={handleAddBrand} title="Add brand">✓</button>
                        <button type="button" onClick={() => setShowAddBrandInput(false)} style={{ background: "none", border: "none", color: "var(--nm-accent-red)", cursor: "pointer", fontSize: "1.1rem", padding: "0 6px" }}>✕</button>
                      </div>
                    ) : (
                      <div className="hand-ref-input-with-btn">
                        <select
                          value={formBrand}
                          onChange={(e) => setFormBrand(e.target.value)}
                          className="hand-ref-input"
                          style={{ appearance: "auto" }}
                        >
                          <option value="">— Select Brand —</option>
                          {availableBrands.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <button type="button" className="hand-ref-plus-btn" onClick={() => setShowAddBrandInput(true)} title="Add new brand">+</button>
                      </div>
                    )}
                  </div>

                  {/* Type / Variants */}
                  <div className="hand-ref-input-group">
                    <label className="hand-ref-label">Type / Variants</label>
                    <div className="hand-ref-input-with-btn">
                      <input
                        type="text"
                        placeholder="e.g. S, M, L, XL..."
                        value={newTypeInput}
                        onChange={(e) => setNewTypeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTypeChip(); } }}
                        className="hand-ref-input"
                      />
                      <button type="button" className="hand-ref-plus-btn" onClick={handleAddTypeChip} title="Add variant">+</button>
                    </div>
                    {selectedTypes.length > 0 && (
                      <div className="hand-ref-chips-wrap">
                        {selectedTypes.map((tag) => (
                          <span key={tag} className="hand-ref-chip">
                            {tag}
                            <button type="button" className="hand-ref-chip-remove" onClick={() => handleRemoveTypeChip(tag)} title="Remove variant">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* ── PRODUCT DESCRIPTION ── */}
              <div className="hand-ref-input-group" style={{ marginBottom: 4 }}>
                <label className="hand-ref-label">Product Description</label>
                <textarea
                  placeholder="Describe materials, sizing, features, and details..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="hand-ref-textarea"
                />
              </div>

              {/* ── PRICE SECTION: 3-column row ── */}
              <div className="hand-ref-price-grid">
                {/* MRP */}
                <div className="hand-ref-input-group">
                  <label className="hand-ref-label">MRP ({currency}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 999"
                    value={formMrp}
                    onChange={(e) => setFormMrp(e.target.value)}
                    className="hand-ref-input"
                    required
                  />
                </div>

                {/* Selling Price */}
                <div className="hand-ref-input-group">
                  <label className="hand-ref-label">Selling Price ({currency}) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 799"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    className="hand-ref-input"
                    required
                  />
                  {/* Auto Discount Badge */}
                  {formMrp && formSellingPrice && parseFloat(formSellingPrice) > 0 && parseFloat(formMrp) > parseFloat(formSellingPrice) && (
                    <span className="hand-ref-discount-badge">
                      {Math.round(((parseFloat(formMrp) - parseFloat(formSellingPrice)) / parseFloat(formMrp)) * 100)}% OFF
                    </span>
                  )}
                  {formMrp && formSellingPrice && parseFloat(formSellingPrice) > parseFloat(formMrp) && (
                    <span style={{ fontSize: "0.72rem", color: "var(--nm-accent-red)", fontWeight: 700, marginTop: 4 }}>
                      ⚠ Selling Price cannot exceed MRP
                    </span>
                  )}
                </div>

                {/* Stock Quantity */}
                <div className="hand-ref-input-group">
                  <label className="hand-ref-label">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 25"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="hand-ref-input"
                    required
                  />
                </div>
              </div>

              {/* ── SAVE BUTTON ── */}
              <div className="hand-ref-actions">
                <button
                  type="button"
                  className="db-btn db-btn-secondary"
                  onClick={() => setShowProductModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="hand-ref-save-btn" data-cursor="link">
                  {editingProduct ? "Save Changes" : "Save Product"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── MODAL: ADD ORDER ── */}
      {showOrderModal && (
        <div className="db-modal-backdrop" onClick={() => setShowOrderModal(false)}>
          <div className="db-modal" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <h3 className="db-modal-title">Record Customer Order</h3>
              <button
                className="db-modal-close"
                onClick={() => setShowOrderModal(false)}
                data-cursor="link"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="db-form">
              <div className="db-form-group">
                <label>Customer Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Maya Lin"
                  value={orderCustomer}
                  onChange={(e) => setOrderCustomer(e.target.value)}
                  className="db-form-input"
                  required
                />
              </div>

              <div className="db-form-group">
                <label>Select Item *</label>
                <select
                  value={orderProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setOrderProductId(pid);
                    const prod = products.find((p) => String(p.id) === String(pid));
                    if (prod) setOrderCalculatedPrice(prod.price * orderQty);
                  }}
                  className="db-form-select"
                  required
                >
                  <option value="">-- Choose from Catalog --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name} — {currency}{p.price.toLocaleString()} ({p.stock} available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="db-form-row">
                <div className="db-form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={orderQty}
                    onChange={(e) => {
                      const qty = Math.max(1, parseInt(e.target.value) || 1);
                      setOrderQty(qty);
                      const prod = products.find((p) => String(p.id) === String(orderProductId));
                      if (prod) setOrderCalculatedPrice(prod.price * qty);
                    }}
                    className="db-form-input"
                    required
                  />
                </div>

                <div className="db-form-group">
                  <label>Total Price ({currency})</label>
                  <input
                    type="text"
                    value={`${currency}${orderCalculatedPrice.toLocaleString()}`}
                    readOnly
                    className="db-form-input"
                    style={{ color: "var(--nm-accent-green)", fontWeight: 800 }}
                  />
                </div>
              </div>

              <div className="db-modal-footer">
                <button
                  type="button"
                  className="db-btn db-btn-secondary"
                  onClick={() => setShowOrderModal(false)}
                  data-cursor="link"
                >
                  Cancel
                </button>
                <button type="submit" className="db-btn db-btn-primary" data-cursor="link">
                  Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: LIVE STORE PREVIEW ── */}
      {showStorePreview && (
        <div className="db-modal-backdrop" onClick={() => setShowStorePreview(false)}>
          <div className="db-modal db-storefront-modal" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.4rem" }}>🛍️</span>
                <h3 className="db-modal-title">Live Storefront Simulator</h3>
              </div>
              <button
                className="db-modal-close"
                onClick={() => setShowStorePreview(false)}
                data-cursor="link"
              >
                ✕
              </button>
            </div>

            <div className="store-preview-header">
              <div className="store-preview-logo">{shopName}</div>
              <p style={{ fontSize: "0.85rem", color: "var(--db-text-muted)", letterSpacing: "0.08em" }}>
                Curated by {ownerName} • OBSIDIAN Architecture
              </p>
            </div>

            <div className="store-preview-grid">
              {products.map((prod) => (
                <div key={prod.id} className="store-product-card">
                  <div className="store-product-emoji" style={{ overflow: "hidden" }}>
                    {prod.image ? (
                      <img src={prod.image} alt={prod.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px" }} />
                    ) : (
                      prod.emoji || "📦"
                    )}
                  </div>
                  <div className="store-product-name">{prod.name}</div>
                  <div className="store-product-price">
                    {currency}{prod.price.toLocaleString()}
                  </div>
                  <button
                    className="db-btn db-btn-outline-accent"
                    style={{ fontSize: "0.75rem", padding: "6px 10px" }}
                    onClick={() => {
                      triggerToast(`Simulated cart add: "${prod.name}"`);
                    }}
                    data-cursor="link"
                  >
                    + Add to Cart
                  </button>
                </div>
              ))}
            </div>

            <div className="db-modal-footer" style={{ justifyContent: "space-between", marginTop: 24, gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={copyStoreLink}
                className="db-btn db-btn-secondary"
                data-cursor="link"
              >
                📋 Copy Store Link
              </button>
              <a
                href={
                  deploymentUrl ||
                  storefrontUrl ||
                  (storeSlug ? `/p3.html?slug=${encodeURIComponent(storeSlug)}` : "/p3.html")
                }
                target="_blank"
                rel="noopener noreferrer"
                className="db-btn db-btn-secondary"
                data-cursor="link"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                ↗️ Open Full Store
              </a>
              <button
                onClick={() => setShowStorePreview(false)}
                className="db-btn db-btn-primary"
                data-cursor="link"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CHOOSE SAMPLE PRODUCTS MANUALLY ── */}
      {showSampleChooserModal && (
        <div className="db-modal-backdrop" onClick={() => setShowSampleChooserModal(false)}>
          <div className="db-modal db-sample-modal" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <div>
                <h3 className="db-modal-title">✨ Choose Products from Catalog</h3>
                <p className="db-sample-header-desc">
                  Select which items you want to display on your dashboard. Choose manually then show them.
                </p>
              </div>
              <button
                className="db-modal-close"
                onClick={() => setShowSampleChooserModal(false)}
                data-cursor="link"
              >
                ✕
              </button>
            </div>

            <div className="db-sample-filter-row">
              <div className="db-sample-pills">
                {["all", "Apparel", "Home", "Accessories", "Stationery", "Tech"].map((cat) => (
                  <button
                    key={cat}
                    className={`db-sample-pill ${sampleCategoryFilter === cat ? "active" : ""}`}
                    onClick={() => setSampleCategoryFilter(cat)}
                    data-cursor="link"
                  >
                    {cat === "all" ? "All Categories" : cat}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="db-btn db-btn-secondary"
                  style={{ padding: "5px 12px", fontSize: "0.76rem" }}
                  onClick={selectAllTemplates}
                  data-cursor="link"
                >
                  Select All
                </button>
                {selectedTemplateIds.length > 0 && (
                  <button
                    type="button"
                    className="db-btn db-btn-secondary"
                    style={{ padding: "5px 12px", fontSize: "0.76rem" }}
                    onClick={deselectAllTemplates}
                    data-cursor="link"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="db-sample-grid">
              {SAMPLE_CATALOG_TEMPLATES.filter((item) => {
                if (sampleCategoryFilter === "all") return true;
                return (item.category || "").toLowerCase() === sampleCategoryFilter.toLowerCase();
              }).map((template) => {
                const isSelected = selectedTemplateIds.includes(template.id);
                return (
                  <div
                    key={template.id}
                    className={`db-sample-card ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleTemplateSelection(template.id)}
                    data-cursor="link"
                  >
                    <div className="db-sample-top">
                      <div className="db-sample-emoji">{template.emoji}</div>
                      <div className="db-sample-checkbox">
                        {isSelected ? "✓" : ""}
                      </div>
                    </div>

                    <div className="db-sample-name">{template.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--nm-accent)", fontWeight: 700, marginBottom: 4 }}>
                      {template.category} • {template.stock} in stock
                    </div>
                    <div className="db-sample-desc">{template.description}</div>

                    <div className="db-sample-footer">
                      <span className="db-sample-price">
                        {currency}{template.price.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="db-sample-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSingleTemplate(template);
                        }}
                        data-cursor="link"
                        title="Add only this item to dashboard"
                      >
                        + Add Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="db-modal-footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--nm-text-medium)" }}>
                {selectedTemplateIds.length} item{selectedTemplateIds.length === 1 ? "" : "s"} selected
              </span>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="db-btn db-btn-secondary"
                  onClick={() => setShowSampleChooserModal(false)}
                  data-cursor="link"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="db-btn db-btn-primary"
                  onClick={handleAddSelectedTemplates}
                  data-cursor="link"
                  disabled={selectedTemplateIds.length === 0}
                  style={{ opacity: selectedTemplateIds.length === 0 ? 0.6 : 1 }}
                >
                  Add & Show Selected ({selectedTemplateIds.length}) →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CHOOSE SAMPLE ORDERS MANUALLY ── */}
      {showSampleOrderModal && (
        <div className="db-modal-backdrop" onClick={() => setShowSampleOrderModal(false)}>
          <div className="db-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <div>
                <h3 className="db-modal-title">⚡ Choose Sample Orders</h3>
                <p className="db-sample-header-desc">
                  Select customer transactions to show and test live statistics in your dashboard.
                </p>
              </div>
              <button
                className="db-modal-close"
                onClick={() => setShowSampleOrderModal(false)}
                data-cursor="link"
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                type="button"
                className="db-btn db-btn-secondary"
                style={{ padding: "4px 12px", fontSize: "0.76rem" }}
                onClick={selectAllOrderTemplates}
                data-cursor="link"
              >
                Select All Orders
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "50vh", overflowY: "auto" }}>
              {SAMPLE_ORDER_TEMPLATES.map((ord) => {
                const isSelected = selectedOrderTemplateIds.includes(ord.id);
                return (
                  <div
                    key={ord.id}
                    onClick={() => toggleOrderTemplateSelection(ord.id)}
                    className="db-item-row"
                    style={{
                      cursor: "pointer",
                      border: isSelected ? "2px solid var(--nm-accent)" : "2px solid transparent",
                      boxShadow: isSelected ? "var(--nm-shadow-in)" : "var(--nm-shadow-out)",
                    }}
                    data-cursor="link"
                  >
                    <div className="db-item-main">
                      <div className="db-sample-checkbox" style={{ marginRight: 8, flexShrink: 0 }}>
                        {isSelected ? "✓" : ""}
                      </div>
                      <div className="db-item-emoji">🛍️</div>
                      <div className="db-item-details">
                        <h4>{ord.customerName}</h4>
                        <div className="db-item-meta">
                          <span>{ord.productName} × {ord.quantity}</span>
                          <span>•</span>
                          <span>{ord.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="db-item-actions">
                      <span className={`order-status status-${ord.status}`}>
                        {ord.status}
                      </span>
                      <span className="db-item-price" style={{ color: "var(--nm-accent-green)", marginLeft: 8 }}>
                        {currency}{ord.totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="db-modal-footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--nm-text-medium)" }}>
                {selectedOrderTemplateIds.length} order{selectedOrderTemplateIds.length === 1 ? "" : "s"} selected
              </span>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="db-btn db-btn-secondary"
                  onClick={() => setShowSampleOrderModal(false)}
                  data-cursor="link"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="db-btn db-btn-primary"
                  onClick={handleAddSelectedOrders}
                  data-cursor="link"
                  disabled={selectedOrderTemplateIds.length === 0}
                  style={{ opacity: selectedOrderTemplateIds.length === 0 ? 0.6 : 1 }}
                >
                  Add & Show Orders ({selectedOrderTemplateIds.length}) →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STOREFRONT QR CODE MODAL ── */}
      {showQrModal && (
        <div className="db-modal-backdrop" onClick={() => setShowQrModal(false)}>
          <div className="db-modal stitch-qr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="db-modal-header" style={{ borderBottom: "1px solid var(--nm-border-inner)", paddingBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.4rem" }}>📱</span>
                <h3 className="db-modal-title" style={{ color: "var(--nm-text-dark)", fontSize: "1.1rem" }}>Storefront QR Code</h3>
              </div>
              <button
                className="db-modal-close"
                onClick={() => setShowQrModal(false)}
                style={{ background: "var(--nm-bg)", color: "var(--nm-text-muted)", boxShadow: "var(--nm-shadow-out)", border: "1px solid rgba(255,255,255,0.8)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ textAlign: "center", padding: "24px 10px 10px" }}>
              <div
                style={{
                  width: 190,
                  height: 190,
                  margin: "0 auto 18px",
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--nm-shadow-in)",
                  border: "1px solid var(--nm-border-inner)",
                }}
              >
                <svg width="160" height="160" viewBox="0 0 100 100" fill="none">
                  {/* Outer corner squares */}
                  <rect x="5" y="5" width="28" height="28" rx="4" fill="#000000" />
                  <rect x="11" y="11" width="16" height="16" rx="2" fill="#ffffff" />
                  <rect x="15" y="15" width="8" height="8" rx="1" fill="#000000" />

                  <rect x="67" y="5" width="28" height="28" rx="4" fill="#000000" />
                  <rect x="73" y="11" width="16" height="16" rx="2" fill="#ffffff" />
                  <rect x="77" y="15" width="8" height="8" rx="1" fill="#000000" />

                  <rect x="5" y="67" width="28" height="28" rx="4" fill="#000000" />
                  <rect x="11" y="73" width="16" height="16" rx="2" fill="#ffffff" />
                  <rect x="15" y="77" width="8" height="8" rx="1" fill="#000000" />

                  {/* QR Matrix Dots */}
                  <rect x="42" y="10" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="52" y="15" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="42" y="25" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="10" y="42" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="22" y="48" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="40" y="40" width="8" height="8" rx="2" fill="#7c3aed" />
                  <rect x="52" y="48" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="65" y="42" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="78" y="48" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="88" y="42" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="42" y="65" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="55" y="72" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="72" y="65" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="82" y="78" width="6" height="6" rx="1" fill="#000000" />
                  <rect x="62" y="85" width="6" height="6" rx="1" fill="#000000" />
                </svg>
              </div>

              <h4 style={{ color: "var(--nm-text-dark)", fontSize: "1.05rem", fontWeight: 800, marginBottom: 4 }}>
                Scan to Open {shopName}
              </h4>
              <p style={{ color: "var(--nm-text-muted)", fontSize: "0.78rem", maxWidth: 300, margin: "0 auto 18px", wordBreak: "break-all" }}>
                {deploymentUrl ||
                  storefrontUrl ||
                  (storeSlug
                    ? `http://localhost:3000/p3.html?slug=${encodeURIComponent(storeSlug)}`
                    : "http://localhost:3000/p3.html")}
              </p>

              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  className="stitch-copy-btn"
                  onClick={copyStoreLink}
                  type="button"
                >
                  📋 Copy Store Link
                </button>
                <button
                  className="stitch-refresh-btn"
                  onClick={() => {
                    triggerToast("QR Code ready for customer scanning! 📷");
                    setShowQrModal(false);
                  }}
                  type="button"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ── */}
      <div className={`db-toast ${showToast ? "show" : ""}`}>
        <div className="db-toast-icon">✓</div>
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}
