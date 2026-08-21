-- ====================================================================
-- MIGRATION 20260804020000: MIGRATE DATA TO DEFAULT SCHOOL
-- ====================================================================

-- 1. Ensure default school exists
INSERT INTO schools (id, name, slug, email, phone, address, theme, status)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'ESEPA INTERNATIONAL SCHOOL',
  'esepa-international-school',
  'admin@esepa.edu',
  '+233 24 000 0000',
  'Accra, Ghana',
  'indigo',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Also handle conflict on slug if another ID has that slug
INSERT INTO schools (name, slug, email, phone, address, theme, status)
SELECT 'ESEPA INTERNATIONAL SCHOOL', 'esepa-school-default', 'admin@esepa.edu', '+233 24 000 0000', 'Accra, Ghana', 'indigo', 'active'
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE slug = 'esepa-international-school' OR id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Get default school id variable
DO $$
DECLARE
  default_school_id UUID;
BEGIN
  SELECT id INTO default_school_id FROM schools ORDER BY created_at ASC LIMIT 1;
  IF default_school_id IS NULL THEN
    default_school_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Backfill school_id for existing records where school_id IS NULL
  UPDATE users SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE students SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE teachers SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE classes SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE subjects SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE attendance SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE results SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE "termReports" SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE "examAnalysis" SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE "smsLogs" SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE polls SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE candidates SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE votes SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE "promotionHistory" SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE inventory SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE expenses SET school_id = default_school_id WHERE school_id IS NULL;
  UPDATE school_licenses SET school_id = default_school_id WHERE school_id IS NULL;
END $$;
