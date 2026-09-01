import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';

export interface School {
  id: string;
  name: string;
  slug: string;
  license_id?: number;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  theme?: string;
  academic_year?: string;
  current_term?: string;
  created_at: number;
  updated_at: number;
  status: 'active' | 'suspended' | 'expired';
}

export interface SchoolLicense {
  id?: number;
  license_key: string;
  school_name: string;
  expiry_date?: number | null;
  active_status: 'active' | 'suspended' | 'expired' | string;
  created_at: number;
  school_id?: string | null;
  tier?: 'Standard' | 'Professional' | 'Enterprise' | string;
  active_modules?: string[];
}

export interface ClassHistoryRecord {
  academicYear: string;
  term: string;
  class: string;
  totalFees?: number;
  feesPaid?: number;
  feeBreakdown?: Record<string, number>;
  feePaidBreakdown?: Record<string, number>;
  promotedAt: number;
}

export interface Student {
  id?: number;
  schoolId?: string;
  studentId: string;
  firstName: string;
  lastName: string;
  class: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  guardianName: string;
  guardianPhone: string;
  feesPaid: number;
  totalFees: number;
  house?: string;
  department?: string;
  photo?: string;
  createdAt: number;
  feeBreakdown?: Record<string, number>; // fee type to amount (e.g. tuition: 1000)
  feePaidBreakdown?: Record<string, number>; // fee type to paid amount (e.g. tuition: 400)
  classHistory?: ClassHistoryRecord[];
  previousClasses?: string[];
}

export interface FeeTypeConfig {
  id: string;
  label: string;
  defaultAmount: number;
}

export const FEE_TYPES: FeeTypeConfig[] = [
  { id: 'tuition', label: 'Tuition Fee', defaultAmount: 1000 },
  { id: 'admission', label: 'Admission Fee', defaultAmount: 200 },
  { id: 'ict', label: 'ICT & Lab Fee', defaultAmount: 150 },
  { id: 'library', label: 'Library Fee', defaultAmount: 50 },
  { id: 'pta', label: 'PTA Levy', defaultAmount: 100 },
  { id: 'exam', label: 'Examination Fee', defaultAmount: 120 },
  { id: 'sports', label: 'Sports & Games', defaultAmount: 80 },
  { id: 'canteen', label: 'Canteen / Dining', defaultAmount: 300 },
  { id: 'transportation', label: 'Transportation / Bus', defaultAmount: 250 },
  { id: 'utility', label: 'Utility & Maintenance', defaultAmount: 150 }
];

export interface TermReport {
  id?: number;
  studentId: string;
  term: string;
  academicYear: string;
  attendancePresent: number;
  attendanceTotal: number;
  teacherRemark: string;
  headmasterRemark: string;
  position?: number;
  totalStudents?: number;
}

export interface Attendance {
  id?: number;
  studentId: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late';
}

export interface Result {
  id?: number;
  studentId: string;
  subject: string;
  term: string;
  class: string;
  classScore: number; // 30%
  examScore: number;  // 70%
  totalScore: number;
  grade: string;
  remarks: string;
}

export interface Subject {
  id?: number;
  name: string;
  code: string;
  applicableClasses: string[]; // Empty can mean "All" or we can store "All"
}

export interface ClassInfo {
  id?: number;
  name: string;
  level: string;
}

export interface Teacher {
  id?: number;
  staffId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  assignedClasses: string[];
  subjects: string[];
}

export interface AppSettings {
  id?: number;
  key: string;
  value: any;
}

export interface User {
  id?: number;
  schoolId?: string;
  school_id?: string;
  schoolName?: string;
  school_name?: string;
  auth_user_id?: string;
  username: string;
  passwordHash?: string;
  password_hash?: string;
  fullName: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role: 'super_admin' | 'creator' | 'admin' | 'headteacher' | 'teacher' | 'accountant' | 'student' | 'parent';
  status?: 'active' | 'inactive' | 'suspended' | string;
  createdAt: number;
  created_at?: number;
  updated_at?: number;
  lastLogin?: number;
  last_login?: number;
}

export interface ExamAnalysisRecord {
  id?: number;
  schoolId?: string;
  studentId: string;
  studentName: string;
  examType: 'BECE' | 'WASSCE';
  year: number;
  indexNumber: string;
  schoolName?: string;
  subjects: Array<{
    subjectName: string;
    grade: string;      // A1, B2, B3, C4, C5, C6, D7, E8, F9 or 1,2,3,4,5,6,7,8,9
    score: number;      // 0-100
    isCore: boolean;
  }>;
  aggregate: number;    // e.g. Core 3 + Elective 3
  status: 'Excellent' | 'Qualified' | 'Conditional' | 'Failed'; 
  remarks: string;
  createdAt: number;
}

export interface SmsLog {
  id?: number;
  recipientName: string;
  recipientPhone: string;
  recipientType: 'Parent' | 'Teacher' | 'Student' | 'Other';
  message: string;
  type: 'Notification' | 'Fee Reminder' | 'Attendance Alert' | 'Exam Report' | 'Siren Emergency' | 'Custom';
  status: 'Sent' | 'Failed' | 'Delivered' | 'Pending';
  createdAt: number;
}

export interface Poll {
  id?: number;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'completed';
  category: string; // e.g. SRC, Class Prefect, Club
  createdAt: number;
}

export interface Candidate {
  id?: number;
  pollId: number;
  name: string;
  position: string; // e.g. President, Secretary, Organizer, Treasurer
  class: string;
  votesCount: number;
  photo?: string;
  manifesto?: string;
}

export interface Vote {
  id?: number;
  pollId: number;
  studentId: string; // voter card ID
  position: string;
  candidateId: number;
  timestamp: number;
}

export interface PromotionRecord {
  id?: number;
  studentId: number; // reference to student table primary key
  studentIdentifier: string; // reference to student studentId (e.g. STU-001)
  studentName: string;
  sourceClass: string;
  destClass: string;
  academicYear: string;
  term: string;
  timestamp: number;
  // back-ups of state for complete audits and perfect reversibility
  previousFeesPaid: number;
  previousTotalFees: number;
  previousFeeBreakdown?: Record<string, number>;
  previousFeePaidBreakdown?: Record<string, number>;
}

export interface InventoryItem {
  id?: number;
  itemName: string;
  category: 'Stationery' | 'Textbooks' | 'Uniforms' | 'Furniture' | 'Sports Gear' | 'Lab Equipment' | 'General';
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  location: string;
  supplierName?: string;
  supplierPhone?: string;
  lastUpdated: number;
}

export interface SchoolExpense {
  id?: number;
  description: string;
  category: 'Inventory Restock' | 'Utilities' | 'Maintenance' | 'Salaries' | 'Administrative' | 'Events' | 'Other';
  amount: number;
  date: number; // timestamp
  inventoryItemId?: number; // linked inventory item if category is 'Inventory Restock'
  quantityPurchased?: number; // if related to stock
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Cheque';
  recordedBy: string;
}

export class SchoolDB extends Dexie {
  students!: Table<Student>;
  attendance!: Table<Attendance>;
  results!: Table<Result>;
  subjects!: Table<Subject>;
  classes!: Table<ClassInfo>;
  teachers!: Table<Teacher>;
  termReports!: Table<TermReport>;
  settings!: Table<AppSettings>;
  users!: Table<User>;
  examAnalysis!: Table<ExamAnalysisRecord>;
  smsLogs!: Table<SmsLog>;
  polls!: Table<Poll>;
  candidates!: Table<Candidate>;
  votes!: Table<Vote>;
  promotionHistory!: Table<PromotionRecord>;
  inventory!: Table<InventoryItem>;
  expenses!: Table<SchoolExpense>;

  constructor() {
    super('EsepaSchoolDB');
    this.version(7).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role'
    });
    this.version(8).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role',
      examAnalysis: '++id, studentId, examType, year, aggregate'
    });
    this.version(9).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role',
      examAnalysis: '++id, studentId, examType, year, aggregate',
      smsLogs: '++id, recipientPhone, type, status, createdAt'
    });
    this.version(10).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role',
      examAnalysis: '++id, studentId, examType, year, aggregate',
      smsLogs: '++id, recipientPhone, type, status, createdAt',
      polls: '++id, title, status, category, createdAt',
      candidates: '++id, pollId, name, position',
      votes: '++id, [pollId+studentId+position], pollId, studentId, candidateId, position'
    });
    this.version(11).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role',
      examAnalysis: '++id, studentId, examType, year, aggregate',
      smsLogs: '++id, recipientPhone, type, status, createdAt',
      polls: '++id, title, status, category, createdAt',
      candidates: '++id, pollId, name, position',
      votes: '++id, [pollId+studentId+position], pollId, studentId, candidateId, position',
      promotionHistory: '++id, studentId, sourceClass, destClass, academicYear, timestamp'
    });
    this.version(12).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role',
      examAnalysis: '++id, studentId, examType, year, aggregate',
      smsLogs: '++id, recipientPhone, type, status, createdAt',
      polls: '++id, title, status, category, createdAt',
      candidates: '++id, pollId, name, position',
      votes: '++id, [pollId+studentId+position], pollId, studentId, candidateId, position',
      promotionHistory: '++id, studentId, sourceClass, destClass, academicYear, timestamp',
      inventory: '++id, itemName, category, location'
    });
    this.version(13).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role',
      examAnalysis: '++id, studentId, examType, year, aggregate',
      smsLogs: '++id, recipientPhone, type, status, createdAt',
      polls: '++id, title, status, category, createdAt',
      candidates: '++id, pollId, name, position',
      votes: '++id, [pollId+studentId+position], pollId, studentId, candidateId, position',
      promotionHistory: '++id, studentId, sourceClass, destClass, academicYear, timestamp',
      inventory: '++id, itemName, category, location',
      expenses: '++id, category, date, inventoryItemId'
    });
    this.version(14).stores({
      students: '++id, studentId, firstName, lastName, class, createdAt',
      attendance: '++id, [studentId+date], date',
      results: '++id, [studentId+subject+term], studentId, subject, class',
      subjects: '++id, name, code',
      classes: '++id, name',
      teachers: '++id, staffId, firstName, lastName',
      termReports: '++id, [studentId+term], studentId, term',
      settings: '++id, key',
      users: '++id, username, role',
      examAnalysis: '++id, studentId, examType, year, aggregate',
      smsLogs: '++id, recipientPhone, type, status, createdAt',
      polls: '++id, title, status, category, createdAt',
      candidates: '++id, pollId, name, position',
      votes: '++id, [pollId+studentId+position], pollId, studentId, candidateId, position',
      promotionHistory: '++id, studentId, studentIdentifier, sourceClass, destClass, academicYear, timestamp',
      inventory: '++id, itemName, category, location',
      expenses: '++id, category, date, inventoryItemId'
    });
  }
}

export const db = new SchoolDB();

export function normalizeStudentRecord(s: any): Student & { [key: string]: any } {
  if (!s || typeof s !== 'object') return s;

  // Extract student ID with deep fallback
  const studentId = String(
    s.studentId || s.student_id || s['Student ID'] || s['student ID'] || s['StudentID'] || s['ID'] || s.id || ''
  ).trim();

  // Robust first name & last name extraction (handling Single "Name" or "Full Name" or "Student Name" columns as well)
  let firstName = String(
    s.firstName || s.first_name || s['First Name'] || s['first name'] || s['FirstName'] || s.given_name || ''
  ).trim();

  let lastName = String(
    s.lastName || s.last_name || s['Last Name'] || s['last name'] || s['LastName'] || s.surname || s.family_name || ''
  ).trim();

  const combinedName = String(
    s.name || s.fullName || s.full_name || s['Full Name'] || s['full name'] || s['Student Name'] || s['student name'] || s['Name'] || ''
  ).trim();

  if ((!firstName || firstName.toLowerCase() === 'unknown') && combinedName) {
    const parts = combinedName.split(/\s+/);
    if (parts.length > 1) {
      firstName = parts[0];
      if (!lastName) lastName = parts.slice(1).join(' ');
    } else {
      firstName = combinedName;
    }
  }

  // Fallback if firstName is still empty or 'Unknown' but lastName has a multi-word string
  if ((!firstName || firstName.toLowerCase() === 'unknown') && lastName && lastName.includes(' ')) {
    const parts = lastName.split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }

  // If still empty, use sensible fallback
  if (!firstName || firstName.toLowerCase() === 'unknown') {
    if (lastName) {
      firstName = lastName;
      lastName = '';
    } else if (combinedName) {
      firstName = combinedName;
    } else if (studentId) {
      firstName = `Student ${studentId}`;
    } else {
      firstName = 'Student';
    }
  }

  const className = String(
    s.class || s.className || s.class_name || s['Class'] || s['class'] || s['Grade'] || s['Form'] || 'P1'
  ).trim();

  const genderRaw = String(s.gender || s.Gender || s.sex || s.Sex || s['Gender'] || s['Sex'] || '').trim().toLowerCase();
  const gender = (genderRaw === 'female' || genderRaw === 'f') ? 'Female' : 'Male';

  let dateOfBirth = s.dateOfBirth || s.date_of_birth || s.dob || s.DOB || s['Date of Birth'] || s['dob'] || '2015-01-01';
  if (typeof dateOfBirth === 'string') {
    const trimmed = dateOfBirth.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      dateOfBirth = trimmed;
    } else {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) dateOfBirth = d.toISOString().split('T')[0];
    }
  }

  const guardianName = String(
    s.guardianName || s.guardian_name || s.parentName || s.parent_name || s['Guardian Name'] || s['Parent Name'] || s['Guardian'] || s['Parent'] || ''
  ).trim();

  const guardianPhone = String(
    s.guardianPhone || s.guardian_phone || s.parentPhone || s.parent_phone || s.phone || s.contact || s['Guardian Phone'] || s['Parent Phone'] || s['Phone'] || ''
  ).trim();

  const house = String(s.house || s.House || s['House'] || '').trim();
  const department = String(s.department || s.Department || s['Department'] || '').trim();
  const photo = s.photo || null;
  const status = s.status || 'active';

  const rawFb = s.feeBreakdown || s.fee_breakdown || s['feeBreakdown'] || {};
  const rawFpb = s.feePaidBreakdown || s.fee_paid_breakdown || s['feePaidBreakdown'] || {};
  const feeBreakdown = typeof rawFb === 'string' ? JSON.parse(rawFb || '{}') : rawFb;
  const feePaidBreakdown = typeof rawFpb === 'string' ? JSON.parse(rawFpb || '{}') : rawFpb;

  const feesPaid = Number(s.feesPaid ?? s.fees_paid ?? s['Fees Paid'] ?? s['fees paid'] ?? s['Paid'] ?? 0) || 0;
  const totalFees = Number(s.totalFees ?? s.total_fees ?? s['Total Fees'] ?? s['total fees'] ?? s['Fee'] ?? s['Fees'] ?? 0) || 0;
  const createdAt = Number(s.createdAt ?? s.created_at ?? Date.now()) || Date.now();
  const schoolId = s.schoolId || s.school_id || s['school_id'] || '';

  return {
    ...s,
    id: s.id,
    studentId,
    student_id: studentId,
    firstName,
    first_name: firstName,
    lastName,
    last_name: lastName,
    class: className,
    gender,
    dateOfBirth,
    date_of_birth: dateOfBirth,
    guardianName,
    guardian_name: guardianName,
    guardianPhone,
    guardian_phone: guardianPhone,
    feesPaid,
    fees_paid: feesPaid,
    totalFees,
    total_fees: totalFees,
    house,
    department,
    photo,
    status,
    feeBreakdown,
    fee_breakdown: feeBreakdown,
    feePaidBreakdown,
    fee_paid_breakdown: feePaidBreakdown,
    createdAt,
    created_at: createdAt,
    schoolId,
    school_id: schoolId
  };
}

export function getStudentFullName(s: any): string {
  if (!s) return 'Unknown Student';
  const norm = normalizeStudentRecord(s);
  const full = `${norm.firstName} ${norm.lastName}`.trim();
  return full || norm.studentId || 'Student';
}

export async function autoRepairStudentsInDb(): Promise<number> {
  try {
    const rawList = await db.students.toArray();
    let repairedCount = 0;
    for (const raw of rawList) {
      const needsRepair = !raw.firstName || 
        raw.firstName.toLowerCase() === 'unknown' || 
        !raw.studentId || 
        (raw as any).first_name && !raw.firstName;
      
      if (needsRepair && raw.id) {
        const normalized = normalizeStudentRecord(raw);
        await db.students.update(raw.id, normalized);
        repairedCount++;
      }
    }
    return repairedCount;
  } catch (e) {
    console.warn("Notice in autoRepairStudentsInDb:", e);
    return 0;
  }
}

export function useFeeTypes(): FeeTypeConfig[] {
  const customSetting = useLiveQuery(() => 
    db.settings.where('key').equals('customFeeTypes').first()
  );
  const customList: FeeTypeConfig[] = customSetting?.value || [];
  const serialized = JSON.stringify(customList);
  return useMemo(() => {
    return [...FEE_TYPES, ...customList];
  }, [serialized]);
}

// Helper to calculate grade based on Ghanaian WASSCE/BECE standard
export function calculateGrade(score: number): { grade: string, remarks: string } {
  if (score >= 80) return { grade: 'A', remarks: 'Excellent' };
  if (score >= 70) return { grade: 'B', remarks: 'Very Good' };
  if (score >= 60) return { grade: 'C', remarks: 'Good' };
  if (score >= 50) return { grade: 'D', remarks: 'Credit' };
  if (score >= 40) return { grade: 'E', remarks: 'Pass' };
  return { grade: 'F', remarks: 'Fail' };
}
