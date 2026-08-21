-- ====================================================================
-- ESEPA SCHOOL SPHERE MANAGEMENT SYSTEM - POSTGRESQL SCHEMA FOR SUPABASE
-- ====================================================================

-- 1. Table: users
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    "username" VARCHAR(100) NOT NULL UNIQUE,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL CHECK ("role" IN ('super_admin', 'admin', 'headteacher', 'teacher', 'accountant', 'student', 'parent')),
    "createdAt" BIGINT NOT NULL
);

-- 2. Table: classes
CREATE TABLE IF NOT EXISTS classes (
    id BIGSERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "level" VARCHAR(50) NOT NULL
);

-- 3. Table: subjects
CREATE TABLE IF NOT EXISTS subjects (
    id BIGSERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "applicableClasses" JSONB NULL
);

-- 4. Table: students
CREATE TABLE IF NOT EXISTS students (
    id BIGSERIAL PRIMARY KEY,
    "studentId" VARCHAR(50) NOT NULL UNIQUE,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "class" VARCHAR(100) NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" VARCHAR(20) NOT NULL CHECK ("gender" IN ('Male', 'Female')),
    "guardianName" VARCHAR(255) NOT NULL,
    "guardianPhone" VARCHAR(50) NOT NULL,
    "feesPaid" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "totalFees" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "house" VARCHAR(100) DEFAULT NULL,
    "department" VARCHAR(100) DEFAULT NULL,
    "photo" TEXT DEFAULT NULL,
    "createdAt" BIGINT NOT NULL,
    "feeBreakdown" JSONB NULL,
    "feePaidBreakdown" JSONB NULL
);

-- 5. Table: teachers
CREATE TABLE IF NOT EXISTS teachers (
    id BIGSERIAL PRIMARY KEY,
    "staffId" VARCHAR(50) NOT NULL UNIQUE,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150) NOT NULL UNIQUE,
    "assignedClasses" JSONB NULL,
    "subjects" JSONB NULL
);

-- 6. Table: attendance
CREATE TABLE IF NOT EXISTS attendance (
    id BIGSERIAL PRIMARY KEY,
    "studentId" VARCHAR(50) NOT NULL REFERENCES students("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
    "date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL CHECK ("status" IN ('Present', 'Absent', 'Late')),
    CONSTRAINT uq_student_date UNIQUE ("studentId", "date")
);

-- 7. Table: results
CREATE TABLE IF NOT EXISTS results (
    id BIGSERIAL PRIMARY KEY,
    "studentId" VARCHAR(50) NOT NULL REFERENCES students("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
    "subject" VARCHAR(255) NOT NULL,
    "term" VARCHAR(50) NOT NULL,
    "class" VARCHAR(100) NOT NULL,
    "classScore" NUMERIC(5, 2) NOT NULL,
    "examScore" NUMERIC(5, 2) NOT NULL,
    "totalScore" NUMERIC(5, 2) NOT NULL,
    "grade" VARCHAR(5) NOT NULL,
    "remarks" VARCHAR(100) NOT NULL,
    CONSTRAINT uq_student_subject_term UNIQUE ("studentId", "subject", "term")
);

-- 8. Table: termReports
CREATE TABLE IF NOT EXISTS "termReports" (
    id BIGSERIAL PRIMARY KEY,
    "studentId" VARCHAR(50) NOT NULL REFERENCES students("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
    "term" VARCHAR(50) NOT NULL,
    "academicYear" VARCHAR(50) NOT NULL,
    "attendancePresent" INT NOT NULL DEFAULT 0,
    "attendanceTotal" INT NOT NULL DEFAULT 0,
    "teacherRemark" TEXT DEFAULT NULL,
    "headmasterRemark" TEXT DEFAULT NULL,
    "position" INT DEFAULT NULL,
    "totalStudents" INT DEFAULT NULL,
    CONSTRAINT uq_report_student_term UNIQUE ("studentId", "term")
);

-- 9. Table: settings
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    "key" VARCHAR(255) NOT NULL UNIQUE,
    "value" JSONB NOT NULL
);

-- 10. Table: examAnalysis
CREATE TABLE IF NOT EXISTS "examAnalysis" (
    id BIGSERIAL PRIMARY KEY,
    "studentId" VARCHAR(50) NOT NULL,
    "studentName" VARCHAR(255) NOT NULL,
    "examType" VARCHAR(20) NOT NULL CHECK ("examType" IN ('BECE', 'WASSCE')),
    "year" INT NOT NULL,
    "indexNumber" VARCHAR(100) NOT NULL,
    "schoolName" VARCHAR(255) NOT NULL,
    "subjects" JSONB NOT NULL,
    "aggregate" INT NOT NULL,
    "status" VARCHAR(50) NOT NULL CHECK ("status" IN ('Excellent', 'Qualified', 'Conditional', 'Failed')),
    "remarks" TEXT DEFAULT NULL,
    "createdAt" BIGINT NOT NULL
);

-- 11. Table: smsLogs
CREATE TABLE IF NOT EXISTS "smsLogs" (
    id BIGSERIAL PRIMARY KEY,
    "recipientName" VARCHAR(255) NOT NULL,
    "recipientPhone" VARCHAR(50) NOT NULL,
    "recipientType" VARCHAR(50) NOT NULL CHECK ("recipientType" IN ('Parent', 'Teacher', 'Student', 'Other')),
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('Notification', 'Fee Reminder', 'Attendance Alert', 'Exam Report', 'Siren Emergency', 'Custom')),
    "status" VARCHAR(20) NOT NULL CHECK ("status" IN ('Sent', 'Failed', 'Delivered', 'Pending')),
    "createdAt" BIGINT NOT NULL
);

-- 12. Table: polls
CREATE TABLE IF NOT EXISTS polls (
    id BIGSERIAL PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT DEFAULT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'active', 'completed')),
    "category" VARCHAR(100) NOT NULL,
    "createdAt" BIGINT NOT NULL
);

-- 13. Table: candidates
CREATE TABLE IF NOT EXISTS candidates (
    id BIGSERIAL PRIMARY KEY,
    "pollId" BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "position" VARCHAR(150) NOT NULL,
    "class" VARCHAR(100) NOT NULL,
    "votesCount" INT NOT NULL DEFAULT 0,
    "photo" TEXT DEFAULT NULL,
    "manifesto" TEXT DEFAULT NULL
);

-- 14. Table: votes
CREATE TABLE IF NOT EXISTS votes (
    id BIGSERIAL PRIMARY KEY,
    "pollId" BIGINT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    "studentId" VARCHAR(50) NOT NULL,
    "position" VARCHAR(150) NOT NULL,
    "candidateId" BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    "timestamp" BIGINT NOT NULL,
    CONSTRAINT uq_ballot UNIQUE ("pollId", "studentId", "position")
);

-- 15. Table: promotionHistory
CREATE TABLE IF NOT EXISTS "promotionHistory" (
    id BIGSERIAL PRIMARY KEY,
    "studentId" INT NOT NULL,
    "studentIdentifier" VARCHAR(50) NOT NULL REFERENCES students("studentId") ON DELETE CASCADE ON UPDATE CASCADE,
    "studentName" VARCHAR(255) NOT NULL,
    "sourceClass" VARCHAR(100) NOT NULL,
    "destClass" VARCHAR(100) NOT NULL,
    "academicYear" VARCHAR(50) NOT NULL,
    "term" VARCHAR(50) NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "previousFeesPaid" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "previousTotalFees" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "previousFeeBreakdown" JSONB NULL,
    "previousFeePaidBreakdown" JSONB NULL
);

-- 16. Table: inventory
CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,
    "itemName" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50) NOT NULL CHECK ("category" IN ('Stationery', 'Textbooks', 'Uniforms', 'Furniture', 'Sports Gear', 'Lab Equipment', 'General')),
    "quantity" INT NOT NULL DEFAULT 0,
    "minQuantity" INT NOT NULL DEFAULT 0,
    "unitPrice" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    "location" VARCHAR(255) NOT NULL,
    "supplierName" VARCHAR(255) DEFAULT NULL,
    "supplierPhone" VARCHAR(50) DEFAULT NULL,
    "lastUpdated" BIGINT NOT NULL
);

-- 17. Table: expenses
CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL CHECK ("category" IN ('Inventory Restock', 'Utilities', 'Maintenance', 'Salaries', 'Administrative', 'Events', 'Other')),
    "amount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "date" BIGINT NOT NULL,
    "inventoryItemId" BIGINT DEFAULT NULL REFERENCES inventory(id) ON DELETE SET NULL,
    "quantityPurchased" INT DEFAULT NULL,
    "paymentMethod" VARCHAR(50) NOT NULL CHECK ("paymentMethod" IN ('Cash', 'Bank Transfer', 'Mobile Money', 'Cheque')),
    "recordedBy" VARCHAR(255) NOT NULL
);

-- 18. Table: school_licenses
CREATE TABLE IF NOT EXISTS school_licenses (
    id BIGSERIAL PRIMARY KEY,
    "license_key" VARCHAR(255) NOT NULL UNIQUE,
    "school_name" VARCHAR(255) NOT NULL,
    "expiry_date" BIGINT DEFAULT NULL,
    "active_status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- ====================================================================
-- SEED DATA
-- ====================================================================

INSERT INTO classes ("name", "level") VALUES
('Primary 1', 'Primary'),
('Primary 2', 'Primary'),
('Primary 3', 'Primary'),
('Primary 4', 'Primary'),
('Primary 5', 'Primary'),
('Primary 6', 'Primary'),
('JHS 1', 'Junior High'),
('JHS 2', 'Junior High'),
('JHS 3', 'Junior High'),
('SHS 1', 'Senior High'),
('SHS 2', 'Senior High'),
('SHS 3', 'Senior High')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO subjects ("name", "code", "applicableClasses") VALUES
('Mathematics', 'MATH-01', '["All"]'::jsonb),
('English Language', 'ENG-02', '["All"]'::jsonb),
('Integrated Science', 'SCI-03', '["All"]'::jsonb),
('Social Studies', 'SOC-04', '["All"]'::jsonb),
('ICT', 'ICT-05', '["All"]'::jsonb),
('Religious & Moral Education', 'RME-06', '["All"]'::jsonb),
('French', 'FREN-07', '["All"]'::jsonb)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO users ("username", "passwordHash", "fullName", "role", "createdAt") VALUES
('admin', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'System Administrator', 'super_admin', 1700000000000),
('headteacher', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'Head Teacher', 'headteacher', 1700000000000),
('teacher', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'Staff Teacher', 'teacher', 1700000000000),
('accountant', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'Finance Clerk', 'accountant', 1700000000000)
ON CONFLICT ("username") DO NOTHING;

INSERT INTO settings ("key", "value") VALUES
('timetable_slots', '[]'::jsonb),
('timetable_suggestions', '[]'::jsonb),
('customFeeTypes', '[]'::jsonb)
ON CONFLICT ("key") DO NOTHING;
