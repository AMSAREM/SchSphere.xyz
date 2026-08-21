-- ====================================================================
-- MIGRATION 20260804000000: CREATE SCHOOLS TABLE
-- ====================================================================

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

CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);
CREATE INDEX IF NOT EXISTS idx_schools_license_id ON schools(license_id);
