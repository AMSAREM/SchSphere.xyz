-- ====================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES FOR ALL TABLES
-- ====================================================================

-- 1. Table: users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON users;
CREATE POLICY "Allow full access for authenticated and service role" ON users FOR ALL USING (true) WITH CHECK (true);

-- 2. Table: classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON classes;
CREATE POLICY "Allow full access for authenticated and service role" ON classes FOR ALL USING (true) WITH CHECK (true);

-- 3. Table: subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON subjects;
CREATE POLICY "Allow full access for authenticated and service role" ON subjects FOR ALL USING (true) WITH CHECK (true);

-- 4. Table: students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON students;
CREATE POLICY "Allow full access for authenticated and service role" ON students FOR ALL USING (true) WITH CHECK (true);

-- 5. Table: teachers
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON teachers;
CREATE POLICY "Allow full access for authenticated and service role" ON teachers FOR ALL USING (true) WITH CHECK (true);

-- 6. Table: attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON attendance;
CREATE POLICY "Allow full access for authenticated and service role" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- 7. Table: results
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON results;
CREATE POLICY "Allow full access for authenticated and service role" ON results FOR ALL USING (true) WITH CHECK (true);

-- 8. Table: termReports
ALTER TABLE "termReports" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON "termReports";
CREATE POLICY "Allow full access for authenticated and service role" ON "termReports" FOR ALL USING (true) WITH CHECK (true);

-- 9. Table: settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON settings;
CREATE POLICY "Allow full access for authenticated and service role" ON settings FOR ALL USING (true) WITH CHECK (true);

-- 10. Table: examAnalysis
ALTER TABLE "examAnalysis" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON "examAnalysis";
CREATE POLICY "Allow full access for authenticated and service role" ON "examAnalysis" FOR ALL USING (true) WITH CHECK (true);

-- 11. Table: smsLogs
ALTER TABLE "smsLogs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON "smsLogs";
CREATE POLICY "Allow full access for authenticated and service role" ON "smsLogs" FOR ALL USING (true) WITH CHECK (true);

-- 12. Table: polls
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON polls;
CREATE POLICY "Allow full access for authenticated and service role" ON polls FOR ALL USING (true) WITH CHECK (true);

-- 13. Table: candidates
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON candidates;
CREATE POLICY "Allow full access for authenticated and service role" ON candidates FOR ALL USING (true) WITH CHECK (true);

-- 14. Table: votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON votes;
CREATE POLICY "Allow full access for authenticated and service role" ON votes FOR ALL USING (true) WITH CHECK (true);

-- 15. Table: promotionHistory
ALTER TABLE "promotionHistory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON "promotionHistory";
CREATE POLICY "Allow full access for authenticated and service role" ON "promotionHistory" FOR ALL USING (true) WITH CHECK (true);

-- 16. Table: inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON inventory;
CREATE POLICY "Allow full access for authenticated and service role" ON inventory FOR ALL USING (true) WITH CHECK (true);

-- 17. Table: expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON expenses;
CREATE POLICY "Allow full access for authenticated and service role" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- 18. Table: school_licenses
ALTER TABLE school_licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON school_licenses;
CREATE POLICY "Allow full access for authenticated and service role" ON school_licenses FOR ALL USING (true) WITH CHECK (true);
