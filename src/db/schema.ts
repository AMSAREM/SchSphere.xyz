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
  username: string;
  passwordHash: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'headteacher' | 'teacher' | 'accountant' | 'student' | 'parent';
  createdAt: number;
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
  }
}

export const db = new SchoolDB();

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
