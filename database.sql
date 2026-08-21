-- ====================================================================
-- ESEPA SCHOOL SPHERE MANAGEMENT SYSTEM - DATABASE SCHEMA (MYSQL)
-- Compatible with XAMPP (Apache & MySQL / MariaDB) & phpMyAdmin
-- ====================================================================

-- --------------------------------------------------------------------
-- DEPLOYMENT & PERMISSION NOTICE (phpMyAdmin / cPanel / Shared Hosts):
-- --------------------------------------------------------------------
-- In some shared hosting or cPanel setups, you do NOT have permission
-- to create a database from a SQL script. If you see an "Access Denied"
-- or "Privileges Required" error:
--
-- 1. Create a database manually inside your hosting panel (e.g., cPanel MySQL Wizard).
-- 2. Create and associate a database user with ALL PRIVILEGES.
-- 3. In phpMyAdmin, click on your newly created database in the left sidebar.
-- 4. Comment out (or delete) the CREATE DATABASE and USE lines below.
-- 5. Click "Import" and upload this file.
-- --------------------------------------------------------------------

-- Create Database if not exists
CREATE DATABASE IF NOT EXISTS esepa_school_db;
USE esepa_school_db;

-- --------------------------------------------------------------------
-- 1. Table: users (System User Accounts)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    fullName VARCHAR(255) NOT NULL,
    role ENUM('super_admin', 'admin', 'headteacher', 'teacher', 'accountant', 'student', 'parent') NOT NULL,
    createdAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Table: classes (School Classes)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    level VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Table: subjects (Academic Course Subjects)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    applicableClasses JSON NULL -- Array of class names
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. Table: students (Student Profiles)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId VARCHAR(50) NOT NULL UNIQUE,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    class VARCHAR(100) NOT NULL,
    dateOfBirth DATE NOT NULL,
    gender ENUM('Male', 'Female') NOT NULL,
    guardianName VARCHAR(255) NOT NULL,
    guardianPhone VARCHAR(50) NOT NULL,
    feesPaid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    totalFees DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    house VARCHAR(100) DEFAULT NULL,
    department VARCHAR(100) DEFAULT NULL,
    photo LONGTEXT DEFAULT NULL, -- Base64 encoded portrait
    createdAt BIGINT NOT NULL,
    feeBreakdown JSON NULL, -- key-value of categories e.g. {"tuition": 1000, "library": 50}
    feePaidBreakdown JSON NULL -- key-value of paid amounts e.g. {"tuition": 400, "library": 50}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. Table: teachers (Staff Profiles)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staffId VARCHAR(50) NOT NULL UNIQUE,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    assignedClasses JSON NULL, -- Array of strings e.g. ["JHS 1", "JHS 2"]
    subjects JSON NULL -- Array of strings e.g. ["Mathematics", "Integrated Science"]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 6. Table: attendance (Student Attendance Log)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    status ENUM('Present', 'Absent', 'Late') NOT NULL,
    UNIQUE KEY uq_student_date (studentId, date),
    FOREIGN KEY (studentId) REFERENCES students(studentId) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 7. Table: results (Academic Exams Results)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    term VARCHAR(50) NOT NULL,
    class VARCHAR(100) NOT NULL,
    classScore DECIMAL(5, 2) NOT NULL, -- Out of 30
    examScore DECIMAL(5, 2) NOT NULL,  -- Out of 70
    totalScore DECIMAL(5, 2) NOT NULL, -- Out of 100
    grade VARCHAR(5) NOT NULL,         -- A, B, C, D, E, F etc.
    remarks VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_student_subject_term (studentId, subject, term),
    FOREIGN KEY (studentId) REFERENCES students(studentId) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 8. Table: termReports (End of Term Master Cards)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS termReports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId VARCHAR(50) NOT NULL,
    term VARCHAR(50) NOT NULL,
    academicYear VARCHAR(50) NOT NULL,
    attendancePresent INT NOT NULL DEFAULT 0,
    attendanceTotal INT NOT NULL DEFAULT 0,
    teacherRemark TEXT DEFAULT NULL,
    headmasterRemark TEXT DEFAULT NULL,
    position INT DEFAULT NULL,
    totalStudents INT DEFAULT NULL,
    UNIQUE KEY uq_report_student_term (studentId, term),
    FOREIGN KEY (studentId) REFERENCES students(studentId) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 9. Table: settings (Key-Value Keyring Storage)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(255) NOT NULL UNIQUE,
    `value` JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 10. Table: examAnalysis (Standardized Exams WASSCE/BECE Audit)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS examAnalysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId VARCHAR(50) NOT NULL,
    studentName VARCHAR(255) NOT NULL,
    examType ENUM('BECE', 'WASSCE') NOT NULL,
    year INT NOT NULL,
    indexNumber VARCHAR(100) NOT NULL,
    schoolName VARCHAR(255) NOT NULL,
    subjects JSON NOT NULL, -- List of subjects and grades
    aggregate INT NOT NULL,
    status ENUM('Excellent', 'Qualified', 'Conditional', 'Failed') NOT NULL,
    remarks TEXT DEFAULT NULL,
    createdAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 11. Table: smsLogs (Bulk SMS Logs)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS smsLogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipientName VARCHAR(255) NOT NULL,
    recipientPhone VARCHAR(50) NOT NULL,
    recipientType ENUM('Parent', 'Teacher', 'Student', 'Other') NOT NULL,
    message TEXT NOT NULL,
    type ENUM('Notification', 'Fee Reminder', 'Attendance Alert', 'Exam Report', 'Siren Emergency', 'Custom') NOT NULL,
    status ENUM('Sent', 'Failed', 'Delivered', 'Pending') NOT NULL,
    createdAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 12. Table: polls (e-Voting System Polls)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS polls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    status ENUM('draft', 'active', 'completed') NOT NULL DEFAULT 'draft',
    category VARCHAR(100) NOT NULL,
    createdAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 13. Table: candidates (Electoral Candidates)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pollId INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(150) NOT NULL,
    class VARCHAR(100) NOT NULL,
    votesCount INT NOT NULL DEFAULT 0,
    photo LONGTEXT DEFAULT NULL,
    manifesto TEXT DEFAULT NULL,
    FOREIGN KEY (pollId) REFERENCES polls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 14. Table: votes (Ballots Placed)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pollId INT NOT NULL,
    studentId VARCHAR(50) NOT NULL,
    position VARCHAR(150) NOT NULL,
    candidateId INT NOT NULL,
    timestamp BIGINT NOT NULL,
    UNIQUE KEY uq_ballot (pollId, studentId, position),
    FOREIGN KEY (pollId) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (candidateId) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 15. Table: promotionHistory (Roll promotion logs)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotionHistory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studentId INT NOT NULL,
    studentIdentifier VARCHAR(50) NOT NULL,
    studentName VARCHAR(255) NOT NULL,
    sourceClass VARCHAR(100) NOT NULL,
    destClass VARCHAR(100) NOT NULL,
    academicYear VARCHAR(50) NOT NULL,
    term VARCHAR(50) NOT NULL,
    timestamp BIGINT NOT NULL,
    previousFeesPaid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    previousTotalFees DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    previousFeeBreakdown JSON NULL,
    previousFeePaidBreakdown JSON NULL,
    FOREIGN KEY (studentIdentifier) REFERENCES students(studentId) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 16. Table: inventory (School Assets and Items)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemName VARCHAR(255) NOT NULL,
    category ENUM('Stationery', 'Textbooks', 'Uniforms', 'Furniture', 'Sports Gear', 'Lab Equipment', 'General') NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    minQuantity INT NOT NULL DEFAULT 0,
    unitPrice DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    location VARCHAR(255) NOT NULL,
    supplierName VARCHAR(255) DEFAULT NULL,
    supplierPhone VARCHAR(50) DEFAULT NULL,
    lastUpdated BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 17. Table: expenses (Expenditure Tracker)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description TEXT NOT NULL,
    category ENUM('Inventory Restock', 'Utilities', 'Maintenance', 'Salaries', 'Administrative', 'Events', 'Other') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    date BIGINT NOT NULL,
    inventoryItemId INT DEFAULT NULL,
    quantityPurchased INT DEFAULT NULL,
    paymentMethod ENUM('Cash', 'Bank Transfer', 'Mobile Money', 'Cheque') NOT NULL,
    recordedBy VARCHAR(255) NOT NULL,
    FOREIGN KEY (inventoryItemId) REFERENCES inventory(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ====================================================================
-- SEED DATA: INITIAL CONFIGURATION & SYSTEM ACCESS
-- ====================================================================

-- Insert standard local school classes
INSERT INTO classes (name, level) VALUES
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
ON DUPLICATE KEY UPDATE name=name;

-- Insert core subjects
INSERT INTO subjects (name, code, applicableClasses) VALUES
('Mathematics', 'MATH-01', '["All"]'),
('English Language', 'ENG-02', '["All"]'),
('Integrated Science', 'SCI-03', '["All"]'),
('Social Studies', 'SOC-04', '["All"]'),
('ICT', 'ICT-05', '["All"]'),
('Religious & Moral Education', 'RME-06', '["All"]'),
('French', 'FREN-07', '["All"]')
ON DUPLICATE KEY UPDATE name=name;

-- Create default credentials (username: admin / password: password)
-- (Pre-hashed with bcrypt so the frontend login engine accepts them)
INSERT INTO users (username, passwordHash, fullName, role, createdAt) VALUES
('admin', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'System Administrator', 'super_admin', 1700000000000),
('headteacher', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'Head Teacher', 'headteacher', 1700000000000),
('teacher', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'Staff Teacher', 'teacher', 1700000000000),
('accountant', '$2a$10$fV38pUaT.Jv.3Kz/p0LpIe2uF0S8Y17jS8mZtM9N4Wn.M6vO8Ujbe', 'Finance Clerk', 'accountant', 1700000000000)
ON DUPLICATE KEY UPDATE username=username;

-- Seed default timetable slots in settings table
INSERT INTO settings (`key`, `value`) VALUES
('timetable_slots', '[]'),
('timetable_suggestions', '[]'),
('customFeeTypes', '[]')
ON DUPLICATE KEY UPDATE `key`=`key`;
