-- ==============================================================================
-- OBSIDIAN STOREFRONT PLATFORM - SUPABASE SQL EDITOR SCRIPT
-- RUN THIS ENTIRE SCRIPT IN YOUR SUPABASE PROJECT'S SQL EDITOR (Dashboard -> SQL Editor)
-- It creates all required database tables, triggers, storage buckets, and RLS policies.
-- ==============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to automatically manage updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Mirrors auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'merchant',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column migration for existing profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'merchant';

-- Backwards-compatibility sync table: public.users (mirrors profiles)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'merchant',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure auth0_sub is removed if it previously existed
ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS auth0_sub;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS auth0_sub;

-- Trigger to sync auth.users to public.profiles automatically on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
        VALUES (
            NEW.id,
            COALESCE(NEW.email, ''),
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
            NEW.raw_user_meta_data->>'avatar_url',
            COALESCE(NEW.raw_user_meta_data->>'role', 'merchant')
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
            role = COALESCE(EXCLUDED.role, public.profiles.role, 'merchant'),
            updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
        -- Never abort auth transaction if profile insert fails
    END;

    BEGIN
        INSERT INTO public.users (id, email, full_name, avatar_url, role)
        VALUES (
            NEW.id,
            COALESCE(NEW.email, ''),
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
            NEW.raw_user_meta_data->>'avatar_url',
            COALESCE(NEW.raw_user_meta_data->>'role', 'merchant')
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
            role = COALESCE(EXCLUDED.role, public.users.role, 'merchant'),
            updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
        -- Never abort auth transaction if user insert fails
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. STORES TABLE (Owned by auth.users via owner_id)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'My Store',
    slug TEXT UNIQUE NOT NULL,
    owner_name TEXT,
    business_type TEXT DEFAULT 'clothing',
    custom_business_type TEXT,
    custom_options JSONB DEFAULT '[]'::jsonb,
    address_method TEXT DEFAULT 'manual',
    address TEXT,
    currency TEXT DEFAULT '₹',
    logo_url TEXT,
    banner_url TEXT,
    selected_template TEXT DEFAULT 'default',
    selected_template_id TEXT DEFAULT 'obsidian-classic',
    description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    store_name TEXT,
    phone TEXT,
    social_links JSONB DEFAULT '{"instagram":"","facebook":"","twitter":"","whatsapp":""}'::jsonb,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    place_id TEXT,
    formatted_address TEXT,
    maps_url TEXT,
    location_source TEXT DEFAULT 'manual',
    live_url TEXT,
    vercel_project_id TEXT,
    is_deployed BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column migrations for existing stores tables
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS location_source TEXT DEFAULT 'manual';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS selected_template_id TEXT DEFAULT 'obsidian-classic';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS selected_template TEXT DEFAULT 'default';

-- Safe migration of existing store rows to owner_id without duplicate key collision
-- For each user_id, assign owner_id to their active primary store (prioritizing stores with products)
DO $$
BEGIN
    WITH primary_stores AS (
        SELECT DISTINCT ON (user_id) s.id
        FROM public.stores s
        LEFT JOIN (
            SELECT store_id, COUNT(*) as p_count 
            FROM public.products 
            GROUP BY store_id
        ) p ON s.id = p.store_id
        WHERE s.user_id IS NOT NULL
        ORDER BY s.user_id, COALESCE(p.p_count, 0) DESC, s.created_at DESC
    )
    UPDATE public.stores
    SET owner_id = user_id
    WHERE id IN (SELECT id FROM primary_stores)
      AND owner_id IS NULL;
END $$;

-- Remove UNIQUE(owner_id) constraint so multiple stores per user are allowed and store updates don't collide
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_owner_id_unique;

-- Automatic synchronization trigger to keep owner_id and user_id in sync for backwards compatibility
CREATE OR REPLACE FUNCTION public.sync_store_ownership()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_id IS NULL AND NEW.user_id IS NOT NULL THEN
        NEW.owner_id = NEW.user_id;
    ELSIF NEW.user_id IS NULL AND NEW.owner_id IS NOT NULL THEN
        NEW.user_id = NEW.owner_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_store_ownership ON public.stores;
CREATE TRIGGER tr_sync_store_ownership
    BEFORE INSERT OR UPDATE ON public.stores
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_store_ownership();

-- Indexes for fast lookup by owner_id, user_id, and slug
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores(slug);

DROP TRIGGER IF EXISTS tr_stores_updated_at ON public.stores;
CREATE TRIGGER tr_stores_updated_at
    BEFORE UPDATE ON public.stores
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. PRODUCTS TABLE (Linked to store)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    client_id BIGINT,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_price NUMERIC(10, 2),
    stock INTEGER NOT NULL DEFAULT 0,
    emoji TEXT DEFAULT '📦',
    category TEXT DEFAULT 'General',
    description TEXT DEFAULT '',
    image_url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);

DROP TRIGGER IF EXISTS tr_products_updated_at ON public.products;
CREATE TRIGGER tr_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. ORDERS TABLE (Linked to store)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
    client_id BIGINT,
    customer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'cancelled'
    date TIMESTAMPTZ DEFAULT NOW(),
    order_date TIMESTAMPTZ DEFAULT NOW(),
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    payment_method TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column migrations for existing orders tables
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);

DROP TRIGGER IF EXISTS tr_orders_updated_at ON public.orders;
CREATE TRIGGER tr_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. DEPLOYMENTS TABLE (Linked to store)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    vercel_project_id TEXT,
    vercel_deployment_id TEXT NOT NULL,
    deployment_url TEXT NOT NULL,
    live_url TEXT,
    status TEXT NOT NULL DEFAULT 'BUILDING', -- 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column migrations for existing deployments table
ALTER TABLE public.deployments ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;
ALTER TABLE public.deployments ADD COLUMN IF NOT EXISTS live_url TEXT;
ALTER TABLE public.deployments ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.deployments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_deployments_store_id ON public.deployments(store_id);

-- ------------------------------------------------------------------------------
-- 6. ATOMIC TRANSACTIONAL STOCK REDUCTION & ORDER PLACEMENT (Zero Oversell)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_store_order(
    p_store_id UUID,
    p_product_id BIGINT,
    p_quantity INT,
    p_customer_name TEXT,
    p_client_id BIGINT DEFAULT NULL,
    p_status TEXT DEFAULT 'pending'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_product RECORD;
    v_calculated_price NUMERIC(10, 2);
    v_order RECORD;
    v_remaining_stock INT;
BEGIN
    -- 1. Lock product row for atomic update
    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id AND store_id = p_store_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in this store';
    END IF;

    IF v_product.status != 'active' THEN
        RAISE EXCEPTION 'Product is not currently active';
    END IF;

    IF v_product.stock < p_quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Available stock is %, requested %', v_product.stock, p_quantity;
    END IF;

    -- 2. Calculate authoritative price server-side
    v_calculated_price := COALESCE(v_product.discount_price, v_product.price) * p_quantity;

    -- 3. Deduct stock atomically
    UPDATE public.products
    SET stock = stock - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id
    RETURNING stock INTO v_remaining_stock;

    -- 4. Record order
    INSERT INTO public.orders (
        store_id,
        client_id,
        customer_name,
        product_name,
        product_id,
        quantity,
        total_price,
        status,
        date,
        order_date
    )
    VALUES (
        p_store_id,
        p_client_id,
        p_customer_name,
        v_product.name,
        v_product.id,
        p_quantity,
        v_calculated_price,
        p_status,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_order;

    RETURN jsonb_build_object(
        'order', to_jsonb(v_order),
        'remaining_stock', v_remaining_stock
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only manage their own profile
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Stores: Complete CRUD RLS Policies
-- Users can create their own stores
DROP POLICY IF EXISTS "Users can create own stores" ON public.stores;
CREATE POLICY "Users can create own stores" ON public.stores
    FOR INSERT WITH CHECK (auth.uid() = owner_id OR auth.uid() = user_id);

-- Users can read their own stores
DROP POLICY IF EXISTS "Users can read own stores" ON public.stores;
CREATE POLICY "Users can read own stores" ON public.stores
    FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = user_id);

-- Public can read published stores for public storefront display
DROP POLICY IF EXISTS "Public read stores" ON public.stores;
CREATE POLICY "Public read stores" ON public.stores
    FOR SELECT USING (slug IS NOT NULL);

-- Users can update their own stores
DROP POLICY IF EXISTS "Users can update own stores" ON public.stores;
CREATE POLICY "Users can update own stores" ON public.stores
    FOR UPDATE USING (auth.uid() = owner_id OR auth.uid() = user_id)
    WITH CHECK (auth.uid() = owner_id OR auth.uid() = user_id);

-- Users can delete their own stores
DROP POLICY IF EXISTS "Users can delete own stores" ON public.stores;
CREATE POLICY "Users can delete own stores" ON public.stores
    FOR DELETE USING (auth.uid() = owner_id OR auth.uid() = user_id);

-- Products: store owner manages products; public can read products of any store
DROP POLICY IF EXISTS "Store owners manage products" ON public.products;
CREATE POLICY "Store owners manage products" ON public.products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.id = products.store_id 
              AND (stores.owner_id = auth.uid() OR stores.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products
    FOR SELECT USING (true);

-- Orders: store owners can view/update orders; public can insert orders
DROP POLICY IF EXISTS "Store owners manage orders" ON public.orders;
CREATE POLICY "Store owners manage orders" ON public.orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.id = orders.store_id 
              AND (stores.owner_id = auth.uid() OR stores.user_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders
    FOR INSERT WITH CHECK (true);

-- Deployments: store owners can manage deployments
DROP POLICY IF EXISTS "Store owners manage deployments" ON public.deployments;
CREATE POLICY "Store owners manage deployments" ON public.deployments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.stores
            WHERE stores.id = deployments.store_id 
              AND (stores.owner_id = auth.uid() OR stores.user_id = auth.uid())
        )
    );

-- ------------------------------------------------------------------------------
-- 8. SUPABASE STORAGE SETUP (BUCKET & STORAGE RLS POLICIES)
-- ------------------------------------------------------------------------------

-- Ensure the public storage bucket exists for storefront assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'storefront-assets',
    'storefront-assets',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Also support fallback 'store-assets' bucket name
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'store-assets',
    'store-assets',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Storage RLS Policies: Allow public downloads and authenticated uploads
DROP POLICY IF EXISTS "Public Access to Storefront Assets" ON storage.objects;
CREATE POLICY "Public Access to Storefront Assets" ON storage.objects
    FOR SELECT USING (bucket_id IN ('storefront-assets', 'store-assets'));

DROP POLICY IF EXISTS "Authenticated Users Upload Storefront Assets" ON storage.objects;
CREATE POLICY "Authenticated Users Upload Storefront Assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id IN ('storefront-assets', 'store-assets')
        AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );

DROP POLICY IF EXISTS "Authenticated Users Update Storefront Assets" ON storage.objects;
CREATE POLICY "Authenticated Users Update Storefront Assets" ON storage.objects
    FOR UPDATE USING (
        bucket_id IN ('storefront-assets', 'store-assets')
        AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );

DROP POLICY IF EXISTS "Authenticated Users Delete Storefront Assets" ON storage.objects;
CREATE POLICY "Authenticated Users Delete Storefront Assets" ON storage.objects
    FOR DELETE USING (
        bucket_id IN ('storefront-assets', 'store-assets')
        AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    );
