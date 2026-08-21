-- ====================================================================
-- MIGRATION 20260804010000: ADD SCHOOL_ID COLUMNS TO ALL TENANT TABLES
-- ====================================================================

-- Add school_id column to tenant tables if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);

ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON attendance(school_id);

ALTER TABLE results ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_results_school_id ON results(school_id);

ALTER TABLE "termReports" ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_termReports_school_id ON "termReports"(school_id);

ALTER TABLE "examAnalysis" ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_examAnalysis_school_id ON "examAnalysis"(school_id);

ALTER TABLE "smsLogs" ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_smsLogs_school_id ON "smsLogs"(school_id);

ALTER TABLE polls ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_polls_school_id ON polls(school_id);

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_school_id ON candidates(school_id);

ALTER TABLE votes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_votes_school_id ON votes(school_id);

ALTER TABLE "promotionHistory" ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_promotionHistory_school_id ON "promotionHistory"(school_id);

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_school_id ON inventory(school_id);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_school_id ON expenses(school_id);

ALTER TABLE school_licenses ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id ON school_licenses(school_id);
