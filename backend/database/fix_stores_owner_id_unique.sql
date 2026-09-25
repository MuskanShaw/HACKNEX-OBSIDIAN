-- ==============================================================================
-- FIX: Drop stores_owner_id_unique constraint
-- ==============================================================================
-- This allows store updates and multi-store ownership without triggering:
-- "duplicate key value violates unique constraint 'stores_owner_id_unique'"

-- 1. Drop the unique constraint on owner_id
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_owner_id_unique;

-- 2. Ensure non-unique performance index exists on owner_id and user_id
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);

-- 3. Confirm trigger is intact and safe
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
