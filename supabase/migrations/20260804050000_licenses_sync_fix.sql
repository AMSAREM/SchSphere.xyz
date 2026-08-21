-- ====================================================================
-- MIGRATION 20260804050000: GUARANTEE LICENSES, SCHOOL_LICENSES, AND SCHOOLS TABLES
-- ====================================================================

-- 1. Create licenses table if not exists
CREATE TABLE IF NOT EXISTS licenses (
    id BIGSERIAL PRIMARY KEY,
    "key" VARCHAR(255) NOT NULL UNIQUE,
    "schoolName" VARCHAR(255) NOT NULL,
    "tier" VARCHAR(100) NOT NULL DEFAULT 'Basic',
    "durationMonths" VARCHAR(50) DEFAULT '12',
    "expiryDate" BIGINT DEFAULT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "activeModules" JSONB NULL,
    "syncStatus" VARCHAR(50) DEFAULT 'synced',
    "school_id" UUID REFERENCES schools(id) ON DELETE SET NULL
);

-- 2. Create school_licenses table if not exists
CREATE TABLE IF NOT EXISTS school_licenses (
    id BIGSERIAL PRIMARY KEY,
    "license_key" VARCHAR(255) NOT NULL UNIQUE,
    "school_name" VARCHAR(255) NOT NULL,
    "expiry_date" BIGINT DEFAULT NULL,
    "active_status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    "sync_status" VARCHAR(50) DEFAULT 'synced',
    "school_id" UUID REFERENCES schools(id) ON DELETE SET NULL
);

-- 3. Create schools table if not exists
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    license_id BIGINT REFERENCES school_licenses(id) ON DELETE SET NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    logo_url TEXT,
    theme VARCHAR(50) DEFAULT 'indigo',
    academic_year VARCHAR(50) DEFAULT '2026/2027',
    current_term VARCHAR(50) DEFAULT 'Term 1',
    created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired'))
);

-- 4. Add missing columns if tables already existed
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS "syncStatus" VARCHAR(50) DEFAULT 'synced';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS "school_id" UUID REFERENCES schools(id) ON DELETE SET NULL;

ALTER TABLE school_licenses ADD COLUMN IF NOT EXISTS "sync_status" VARCHAR(50) DEFAULT 'synced';
ALTER TABLE school_licenses ADD COLUMN IF NOT EXISTS "school_id" UUID REFERENCES schools(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses("key");
CREATE INDEX IF NOT EXISTS idx_school_licenses_license_key ON school_licenses("license_key");
CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);

-- 6. Enable RLS and add public/service access policies
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full access for licenses" ON licenses;
CREATE POLICY "Full access for licenses" ON licenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access for school_licenses" ON school_licenses;
CREATE POLICY "Full access for school_licenses" ON school_licenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access for schools" ON schools;
CREATE POLICY "Full access for schools" ON schools FOR ALL USING (true) WITH CHECK (true);
