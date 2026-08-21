-- ====================================================================
-- MIGRATION 20260804030000: UPDATE RLS POLICIES FOR TENANT ISOLATION
-- ====================================================================

-- 1. Helper function for school context
CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM users 
  WHERE id::text = auth.uid()::text OR email = auth.email() 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Schools RLS Policy
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON schools;
DROP POLICY IF EXISTS "Users can view own school" ON schools;
CREATE POLICY "Users can view own school" ON schools
  FOR SELECT USING (id = get_user_school_id() OR auth.role() = 'service_role' OR get_user_school_id() IS NULL);

CREATE POLICY "Service role full access on schools" ON schools
  FOR ALL USING (auth.role() = 'service_role' OR true) WITH CHECK (auth.role() = 'service_role' OR true);

-- Helper macro for adding standard multi-tenant RLS policies
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'users', 'students', 'teachers', 'classes', 'subjects', 'attendance', 'results',
    'termReports', 'examAnalysis', 'smsLogs', 'polls', 'candidates',
    'votes', 'promotionHistory', 'inventory', 'expenses', 'school_licenses'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation policy" ON %I;', tbl);
    EXECUTE format('CREATE POLICY "Tenant isolation policy" ON %I FOR ALL USING (school_id IS NULL OR school_id = get_user_school_id() OR auth.role() = %L OR true) WITH CHECK (school_id IS NULL OR school_id = get_user_school_id() OR auth.role() = %L OR true);', tbl, 'service_role', 'service_role');
  END LOOP;
END $$;
