-- ====================================================================
-- MIGRATION 20260804040000: CLEANUP AND FINAL CONSTRAINTS
-- ====================================================================

-- Ensure default school is configured correctly
UPDATE schools 
SET name = COALESCE(name, 'ESEPA INTERNATIONAL SCHOOL'),
    status = COALESCE(status, 'active')
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Add updated_at trigger function for schools
CREATE OR REPLACE FUNCTION update_schools_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = (extract(epoch from now()) * 1000)::bigint;
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_update_schools_timestamp ON schools;
CREATE TRIGGER trg_update_schools_timestamp
BEFORE UPDATE ON schools
FOR EACH ROW
EXECUTE FUNCTION update_schools_timestamp();
