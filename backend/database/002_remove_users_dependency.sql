-- ==============================================================================
-- Migration 002: Remove public.users Runtime Dependency
-- Canonical user profile storage is public.profiles (linked to auth.users.id).
-- Updates handle_new_user trigger to populate public.profiles only.
-- ==============================================================================

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

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
