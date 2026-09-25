import { Request } from 'express';

export interface UserRecord {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  whatsapp?: string;
}

export interface StoreRecord {
  id: string;
  owner_id?: string | null;
  user_id: string;
  name: string;
  store_name?: string | null;
  slug: string;
  business_type: string;
  custom_business_type?: string | null;
  custom_options?: any[] | null;
  description?: string | null;
  currency: string;
  logo_url?: string | null;
  banner_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  phone?: string | null;
  address?: string | null;
  address_method: string;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
  formatted_address?: string | null;
  maps_url?: string | null;
  location_source?: string | null;
  social_links: SocialLinks;
  selected_template_id: string;
  live_url?: string | null;
  vercel_project_id?: string | null;
  is_deployed?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductRecord {
  id: string;
  store_id: string;
  client_id?: number | null;
  name: string;
  price: number;
  discount_price?: number | null;
  stock: number;
  emoji: string;
  category: string;
  description?: string | null;
  image_url?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  id?: number | string;
  productId?: number | string | null;
  product_id?: number | string | null;
  name?: string;
  productName?: string;
  product_name?: string;
  title?: string;
  quantity: number;
  qty?: number;
  price?: number;
  unitPrice?: number;
  unit_price?: number;
  emoji?: string;
  image?: string | null;
}

export interface OrderRecord {
  id: string;
  store_id: string;
  product_id?: string | null;
  client_id?: number | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  payment_method?: string | null;
  product_name: string;
  quantity: number;
  total_price: number;
  total_amount?: number;
  items?: OrderItem[] | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  order_date?: string;
  date?: string;
  created_at?: string;
  updated_at?: string;
}

export type VercelDeploymentState = 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';

export const DEPLOYMENT_STATE_MESSAGES: Record<VercelDeploymentState | 'NOT_DEPLOYED', string> = {
  QUEUED: 'Deployment queued',
  BUILDING: 'Building your store',
  READY: 'Deployment successful',
  ERROR: 'Deployment failed',
  CANCELED: 'Deployment canceled',
  NOT_DEPLOYED: 'No deployments found for this store',
};

export interface DeploymentRecord {
  id: string;
  store_id: string;
  vercel_project_id?: string | null;
  vercel_deployment_id: string;
  deployment_url: string;
  live_url?: string | null;
  status: VercelDeploymentState | string;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DeploymentStatusDTO {
  success: boolean;
  deploymentId: string | null;
  status: VercelDeploymentState | 'NOT_DEPLOYED' | 'live' | string;
  state: VercelDeploymentState | 'NOT_DEPLOYED';
  statusMessage: string;
  liveUrl: string | null;
  deploymentUrl?: string | null;
  errorMessage?: string | null;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isMock?: boolean;
}

export interface StoreTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  category: string;
  theme: {
    fontFamily: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    cardBackground: string;
    textColor: string;
    radius: string;
  };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
}

export interface AuthenticatedRequest extends Request {
  currentUser?: AuthenticatedUser;
  auth?: {
    payload: {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
      [key: string]: any;
    };
  };
  validatedStore?: StoreRecord;
}

// --------------------------------------------------------------------------
// FRONTEND COMPATIBILITY DATA TRANSFER OBJECTS (DTOs)
// --------------------------------------------------------------------------
export interface FrontendProductDTO {
  id: number;
  backendId?: string;
  name: string;
  price: number;
  stock: number;
  emoji: string;
  category: string;
  description: string;
  discountPrice?: number | null;
  image?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FrontendOrderDTO {
  id: number;
  backendId?: string;
  customerName: string;
  customer_name?: string;
  customerEmail?: string | null;
  customer_email?: string | null;
  customerPhone?: string | null;
  customer_phone?: string | null;
  phone?: string | null;
  customerAddress?: string | null;
  customer_address?: string | null;
  address?: string | null;
  paymentMethod?: string | null;
  payment_method?: string | null;
  productName: string;
  product_name?: string;
  productId?: number | string | null;
  product_id?: string | null;
  quantity: number;
  totalPrice: number;
  total_price?: number;
  totalAmount?: number;
  total_amount?: number;
  items?: OrderItem[];
  order_items?: OrderItem[];
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  date: string;
  order_date?: string;
}

export interface FrontendStoreDTO {
  id: string;
  owner_id?: string | null;
  ownerId?: string | null;
  user_id?: string | null;
  userId?: string | null;
  name: string;
  store_name?: string | null;
  shopName?: string;
  slug: string;
  businessType: string;
  customBusinessType?: string | null;
  customOptions?: any[];
  description?: string | null;
  currency: string;
  storeCurrency?: string;
  addressMethod: string;
  shopAddress?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  formattedAddress?: string | null;
  mapsUrl?: string | null;
  locationSource?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  phone?: string | null;
  socialLinks?: SocialLinks;
  selectedTemplateId?: string;
  liveUrl?: string | null;
  vercelProjectId?: string | null;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalyticsDTO {
  totalSales: number;
  totalOrders: number;
  uniqueCustomers: number;
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  chart: {
    labels: string[];
    values: number[];
  };
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly';
  lastUpdated: string;
}

export interface DashboardStateDTO {
  user: {
    id: string;
    email: string;
    fullName?: string | null;
    ownerName?: string | null;
    avatarUrl?: string | null;
  };
  store: FrontendStoreDTO;
  products: FrontendProductDTO[];
  orders: FrontendOrderDTO[];
  analytics: AnalyticsDTO;
}

// Generate fallback numeric id from string or timestamp
export function generateNumericId(seed?: string): number {
  if (!seed) return Date.now() + Math.floor(Math.random() * 1000);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) || Date.now();
}

export function toFrontendProduct(product: ProductRecord): FrontendProductDTO & {
  discount_price?: number | null;
  image_url?: string | null;
} {
  const numericId =
    product.client_id !== undefined && product.client_id !== null
      ? Number(product.client_id)
      : typeof product.id === 'number'
      ? product.id
      : generateNumericId(String(product.id));

  return {
    id: numericId,
    backendId: String(product.id),
    name: product.name,
    price: Number(product.price),
    stock: Number(product.stock ?? 0),
    emoji: product.emoji || '📦',
    category: product.category || 'General',
    description: product.description || '',
    discountPrice: product.discount_price !== null && product.discount_price !== undefined
      ? Number(product.discount_price)
      : null,
    discount_price: product.discount_price !== null && product.discount_price !== undefined
      ? Number(product.discount_price)
      : null,
    image: product.image_url || null,
    image_url: product.image_url || null,
    status: product.status || 'active',
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

export function toFrontendOrder(
  order: OrderRecord,
  productClientId?: number | null
): FrontendOrderDTO {
  const numericId =
    order.client_id !== undefined && order.client_id !== null
      ? Number(order.client_id)
      : typeof order.id === 'number'
      ? order.id
      : generateNumericId(String(order.id));

  const total = Number(order.total_price ?? order.total_amount ?? 0);
  const items = Array.isArray(order.items) ? order.items : [];

  return {
    id: numericId,
    backendId: String(order.id),
    customerName: order.customer_name,
    customer_name: order.customer_name,
    customerEmail: order.customer_email || null,
    customer_email: order.customer_email || null,
    customerPhone: order.customer_phone || null,
    customer_phone: order.customer_phone || null,
    phone: order.customer_phone || null,
    customerAddress: order.customer_address || null,
    customer_address: order.customer_address || null,
    address: order.customer_address || null,
    paymentMethod: order.payment_method || null,
    payment_method: order.payment_method || null,
    productName: order.product_name,
    product_name: order.product_name,
    productId: productClientId ?? order.product_id,
    product_id: order.product_id,
    quantity: Number(order.quantity),
    totalPrice: total,
    total_price: total,
    totalAmount: total,
    total_amount: total,
    items,
    order_items: items,
    status: order.status,
    date: order.order_date || order.date || new Date().toISOString(),
    order_date: order.order_date || order.date || new Date().toISOString(),
  };
}

export function toFrontendStore(store: StoreRecord): FrontendStoreDTO {
  const resolvedName = store.name || store.store_name || (store as any).shop_name || 'My Store';
  const resolvedAddress = store.address || (store as any).location || null;
  const resolvedOwner = (store as any).owner_name || null;
  const resolvedPhone = store.phone || store.contact_phone || null;
  const effectiveOwner = store.owner_id || store.user_id;

  return {
    id: store.id,
    owner_id: effectiveOwner,
    ownerId: effectiveOwner,
    user_id: store.user_id || store.owner_id,
    userId: store.user_id || store.owner_id,
    name: resolvedName,
    store_name: resolvedName,
    shopName: resolvedName,
    slug: store.slug || `store-${store.id.substring(0, 8)}`,
    businessType: store.business_type || 'retail',
    customBusinessType: store.custom_business_type || null,
    customOptions: Array.isArray(store.custom_options) ? store.custom_options : [],
    description: store.description || null,
    currency: store.currency || '₹',
    storeCurrency: store.currency || '₹',
    addressMethod: store.address_method || 'manual',
    shopAddress: resolvedAddress,
    address: resolvedAddress,
    latitude: store.latitude !== undefined && store.latitude !== null ? Number(store.latitude) : null,
    longitude: store.longitude !== undefined && store.longitude !== null ? Number(store.longitude) : null,
    placeId: store.place_id || null,
    formattedAddress: store.formatted_address || null,
    mapsUrl: store.maps_url || null,
    locationSource: store.location_source || 'manual',
    logoUrl: store.logo_url || null,
    bannerUrl: store.banner_url || null,
    contactEmail: store.contact_email || null,
    contactPhone: resolvedPhone,
    phone: resolvedPhone,
    socialLinks: store.social_links || {},
    selectedTemplateId: store.selected_template_id || 'obsidian-classic',
    liveUrl: store.live_url || null,
    vercelProjectId: store.vercel_project_id || null,
    isDefault: store.is_default !== undefined ? store.is_default : true,
    createdAt: store.created_at,
    updatedAt: store.updated_at,
  };
}
