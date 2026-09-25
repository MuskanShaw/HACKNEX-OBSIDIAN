-- ==============================================================================
-- MIGRATION: 001_remove_auth0_sub.sql
-- Safely drop auth0_sub column from public.users and public.profiles tables.
-- Preserves all user, store, product, and order records.
-- ==============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'auth0_sub'
    ) THEN
        ALTER TABLE public.users DROP COLUMN auth0_sub;
        RAISE NOTICE 'Dropped auth0_sub from public.users';
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'profiles' 
          AND column_name = 'auth0_sub'
    ) THEN
        ALTER TABLE public.profiles DROP COLUMN auth0_sub;
        RAISE NOTICE 'Dropped auth0_sub from public.profiles';
    END IF;
END $$;
