-- ==============================================================================
-- 20260822000000 - FIX SUPABASE AUTH -> PUBLIC.USERS TRIGGER & RLS POLICIES
-- ==============================================================================
-- Safe migration:
-- 1. Alters legacy columns only if they exist
-- 2. Adds all canonical snake_case columns with safe defaults
-- 3. Creates the canonical handle_new_user() trigger function using full_name
-- 4. Enables RLS and attaches verified user policies
-- ==============================================================================

DO $$ 
BEGIN
  -- Drop NOT NULL constraints on legacy camelCase columns if present
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'passwordHash') THEN
    ALTER TABLE public.users ALTER COLUMN "passwordHash" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'fullName') THEN
    ALTER TABLE public.users ALTER COLUMN "fullName" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role') THEN
    ALTER TABLE public.users ALTER COLUMN "role" DROP NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'createdAt') THEN
    ALTER TABLE public.users ALTER COLUMN "createdAt" DROP NOT NULL;
  END IF;
END $$;

-- Add all canonical snake_case columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "auth_user_id" UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "school_id" UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "username" VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "full_name" VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT 'admin';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "created_at" BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "updated_at" BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "last_login" BIGINT;

-- Ensure auth_user_id has a unique constraint for safe upserting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.users'::regclass 
      AND contype = 'u' 
      AND conname = 'users_auth_user_id_unique'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Helper function to check email verification status
CREATE OR REPLACE FUNCTION public.is_email_verified()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT email_confirmed_at IS NOT NULL 
     FROM auth.users 
     WHERE id = auth.uid()),
    false
  );
$$;

-- Function to safely extract the active school_id
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_school_id IS NOT NULL THEN
    RETURN v_school_id;
  END IF;

  BEGIN
    v_school_id := (auth.jwt() -> 'app_metadata' ->> 'school_id')::UUID;
    RETURN v_school_id;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND (role = 'super_admin' OR role = 'superadmin' OR role = 'creator')
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- The canonical handle_new_user() trigger function targeting full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_full_name TEXT;
  v_username  TEXT;
  v_role      TEXT;
  v_school_id UUID;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'fullName',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'admin'
  );

  BEGIN
    v_school_id := (NEW.raw_user_meta_data->>'school_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL;
  END;

  INSERT INTO public.users (
    auth_user_id,
    email,
    full_name,
    username,
    role,
    status,
    school_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_username,
    v_role,
    'active',
    v_school_id,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  )
  ON CONFLICT (auth_user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Notice in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop legacy triggers and bind the new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own or same-school profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role full access users" ON public.users;

CREATE POLICY "Users can read own or same-school profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR (
      public.is_email_verified() 
      AND (
        (school_id IS NOT NULL AND school_id = public.get_auth_school_id())
        OR public.is_super_admin()
      )
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (auth_user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Service role full access users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
