-- ====================================================================
-- SUPABASE MIGRATION: CREATE SCHOOL_LICENSES TABLE WITH ROW LEVEL SECURITY
-- ====================================================================

-- 1. Create school_licenses table
CREATE TABLE IF NOT EXISTS school_licenses (
    id BIGSERIAL PRIMARY KEY,
    "license_key" VARCHAR(255) NOT NULL UNIQUE,
    "school_name" VARCHAR(255) NOT NULL,
    "expiry_date" BIGINT DEFAULT NULL,
    "active_status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- 2. Create index for faster lookups by school_name and license_key
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_name ON school_licenses ("school_name");
CREATE INDEX IF NOT EXISTS idx_school_licenses_license_key ON school_licenses ("license_key");

-- 3. Enable Row Level Security (RLS)
ALTER TABLE school_licenses ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policy for full access for authenticated and service roles
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON school_licenses;
CREATE POLICY "Allow full access for authenticated and service role" 
ON school_licenses 
FOR ALL 
USING (true) 
WITH CHECK (true);
