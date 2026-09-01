import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ExamAnalysisRecord, type Student } from '../db/schema';
import { 
  Award, 
  Users, 
  TrendingUp, 
  GraduationCap, 
  Plus, 
  Search, 
  Printer, 
  Download, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Calculator,
  ChevronRight,
  TrendingDown,
  Sparkles,
  Database
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { triggerPrint } from '../lib/utils';
import * as XLSX from 'xlsx';

// WASSCE Grade mappings and points
const WASSCE_GRADES = [
  { grade: 'A1', point: 1, label: 'Excellent', range: '80-100%', isPass: true, isCredit: true },
  { grade: 'B2', point: 2, label: 'Very Good', range: '70-79%', isPass: true, isCredit: true },
  { grade: 'B3', point: 3, label: 'Good', range: '65-69%', isPass: true, isCredit: true },
  { grade: 'C4', point: 4, label: 'Credit', range: '60-64%', isPass: true, isCredit: true },
  { grade: 'C5', point: 5, label: 'Credit', range: '55-59%', isPass: true, isCredit: true },
  { grade: 'C6', point: 6, label: 'Credit', range: '50-54%', isPass: true, isCredit: true },
  { grade: 'D7', point: 7, label: 'Pass', range: '45-49%', isPass: true, isCredit: false },
  { grade: 'E8', point: 8, label: 'Pass', range: '40-44%', isPass: true, isCredit: false },
  { grade: 'F9', point: 9, label: 'Fail', range: '0-39%', isPass: false, isCredit: false },
];

// BECE Grade mappings
const BECE_GRADES = [
  { grade: '1', point: 1, label: 'Excellent', range: '80-100%', isPass: true, isCredit: true },
  { grade: '2', point: 2, label: 'Very Good', range: '70-79%', isPass: true, isCredit: true },
  { grade: '3', point: 3, label: 'Good', range: '60-69%', isPass: true, isCredit: true },
  { grade: '4', point: 4, label: 'High Pass', range: '55-59%', isPass: true, isCredit: true },
  { grade: '5', point: 5, label: 'Pass', range: '50-54%', isPass: true, isCredit: true },
  { grade: '6', point: 6, label: 'Pass', range: '45-49%', isPass: true, isCredit: true },
  { grade: '7', point: 7, label: 'Low Pass', range: '40-44%', isPass: true, isCredit: false },
  { grade: '8', point: 8, label: 'Weak Pass', range: '35-39%', isPass: true, isCredit: false },
  { grade: '9', point: 9, label: 'Fail', range: '0-34%', isPass: false, isCredit: false },
];

const DEFAULT_BECE_SUBJECTS = [
  { subjectName: 'English Language', isCore: true },
  { subjectName: 'Mathematics', isCore: true },
  { subjectName: 'Integrated Science', isCore: true },
  { subjectName: 'Social Studies', isCore: true },
  { subjectName: 'Religious and Moral Education (RME)', isCore: false },
  { subjectName: 'Creative Arts and Design', isCore: false },
  { subjectName: 'Computing / ICT', isCore: false },
  { subjectName: 'French', isCore: false },
];

const DEFAULT_WASSCE_SUBJECTS = [
  { subjectName: 'English Language', isCore: true },
  { subjectName: 'Core Mathematics', isCore: true },
  { subjectName: 'Integrated Science', isCore: true },
  { subjectName: 'Social Studies', isCore: true },
  { subjectName: 'Elective Mathematics', isCore: false },
  { subjectName: 'Physics', isCore: false },
  { subjectName: 'Chemistry', isCore: false },
  { subjectName: 'Biology', isCore: false },
];

export default function ExamAnalysis() {
  const { showToast } = useNotifications();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  
  // Live Data Queries
  const examRecords = useLiveQuery(() => db.examAnalysis.toArray()) || [];
  const allStudents = useLiveQuery(() => db.students.toArray()) || [];
  
  const studentRecord = useMemo(() => {
    if (isStudent && user?.fullName) {
      const cleanName = user.fullName.replace(/\s*\(Student\)/i, '').trim().toLowerCase();
      return allStudents.find(s => {
        const full = `${s.firstName} ${s.lastName}`.toLowerCase().trim();
        return full.includes(cleanName) || cleanName.includes(full);
      });
    }
    return null;
  }, [isStudent, user?.fullName, allStudents]);

  const studentExamRecord = useMemo(() => {
    if (isStudent && studentRecord?.studentId) {
      return examRecords.find(r => r.studentId === studentRecord.studentId);
    }
    return null;
  }, [isStudent, studentRecord, examRecords]);

  // Interactive UI States
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'predictor'>('overview');
  const [examTypeFilter, setExamTypeFilter] = useState<'All' | 'BECE' | 'WASSCE'>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Record Modal Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [formStudentId, setFormStudentId] = useState('');
  const [formExamType, setFormExamType] = useState<'BECE' | 'WASSCE'>('WASSCE');
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formIndexNo, setFormIndexNo] = useState('');
  const [formSchool, setFormSchool] = useState('ESEPA ACADEMY');
  const [formSubjects, setFormSubjects] = useState<Array<{ subjectName: string, score: number, grade: string, isCore: boolean }>>([]);
  
  // Multi-Record Viewer PDF modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<ExamAnalysisRecord | null>(null);

  // Sync predictor with actual student exam record if it exists
  useEffect(() => {
    if (studentExamRecord) {
      setFormExamType(studentExamRecord.examType);
      setFormSubjects(studentExamRecord.subjects);
    }
  }, [studentExamRecord]);

  // Auto-initialize form subjects when exam type changes if not loading student exam record
  useEffect(() => {
    if (!selectedRecordId && !studentExamRecord) {
      if (formExamType === 'BECE') {
        setFormSubjects(DEFAULT_BECE_SUBJECTS.map(s => ({ ...s, score: 75, grade: '2' })));
      } else {
        setFormSubjects(DEFAULT_WASSCE_SUBJECTS.map(s => ({ ...s, score: 78, grade: 'B3' })));
      }
    }
  }, [formExamType, selectedRecordId, studentExamRecord]);

  // Sync Student Info in Record form
  const currentSelectedFormStudent = useMemo(() => {
    return allStudents.find(s => s.studentId === formStudentId);
  }, [formStudentId, allStudents]);

  // Year options for filtering
  const yearOptions = useMemo(() => {
    const years = examRecords.map(r => r.year.toString());
    return Array.from(new Set(years)).sort((a,b) => b.localeCompare(a));
  }, [examRecords]);

  // Calculate grade helper for score inputs in real-time
  const getGradeForScore = (score: number, type: 'BECE' | 'WASSCE'): string => {
    if (type === 'WASSCE') {
      if (score >= 80) return 'A1';
      if (score >= 70) return 'B2';
      if (score >= 65) return 'B3';
      if (score >= 60) return 'C4';
      if (score >= 55) return 'C5';
      if (score >= 50) return 'C6';
      if (score >= 45) return 'D7';
      if (score >= 40) return 'E8';
      return 'F9';
    } else {
      if (score >= 80) return '1';
      if (score >= 75) return '2';
      if (score >= 70) return '3';
      if (score >= 65) return '4';
      if (score >= 60) return '5';
      if (score >= 55) return '6';
      if (score >= 50) return '7';
      if (score >= 40) return '8';
      return '9';
    }
  };

  // Score updater in form
  const handleSubjectScoreChange = (index: number, newScore: number) => {
    const score = Math.max(0, Math.min(100, newScore));
    const grade = getGradeForScore(score, formExamType);
    setFormSubjects(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], score, grade };
      return copy;
    });
  };

  const handleSubjectNameChange = (index: number, name: string) => {
    setFormSubjects(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], subjectName: name };
      return copy;
    });
  };

  const handleSubjectCoreToggle = (index: number) => {
    setFormSubjects(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isCore: !copy[index].isCore };
      return copy;
    });
  };

  const removeFormSubject = (index: number) => {
    setFormSubjects(prev => prev.filter((_, i) => i !== index));
  };

  const addFormSubject = () => {
    setFormSubjects(prev => [
      ...prev,
      { subjectName: 'New Subject', score: 70, grade: formExamType === 'WASSCE' ? 'B2' : '3', isCore: false }
    ]);
  };

  // Main calculations engine for aggregates
  // BECE aggregate is sum of top 4 core + top 2 electives
  // WASSCE aggregate is core 3 (English, Core Maths, and Integrated Science OR Social Studies depending on which is better) + 3 best electives
  const calculatedAggregate = useMemo(() => {
    if (formSubjects.length === 0) return 54;
    
    if (formExamType === 'BECE') {
      const coreGrades = formSubjects.filter(s => s.isCore);
      const electiveGrades = formSubjects.filter(s => !s.isCore);
      
      const getPoint = (g: string) => parseInt(g) || 9;
      
      // core English, Maths, Science, Social studies
      let coreSum = 0;
      coreGrades.forEach(s => {
        coreSum += getPoint(s.grade);
      });
      // if missing core, default each to 9 points
      const missingCores = 4 - coreGrades.length;
      if (missingCores > 0) coreSum += missingCores * 9;

      // sort electives by best (lowest points)
      const electivePoints = electiveGrades.map(s => getPoint(s.grade)).sort((a,b) => a-b);
      const topElectives = electivePoints.slice(0, 2);
      let electiveSum = topElectives.reduce((a,b) => a+b, 0);
      const missingElectives = 2 - topElectives.length;
      if (missingElectives > 0) electiveSum += missingElectives * 9;

      return Math.min(54, Math.max(6, coreSum + electiveSum));
    } else {
      // WASSCE guidelines
      // Core: English, Core Math are mandatory. 
      // Then the best one of either Integrated Science or Social Studies.
      // Plus the 3 best elective subjects.
      const english = formSubjects.find(s => s.subjectName.toLowerCase().includes('english'));
      const math = formSubjects.find(s => s.subjectName.toLowerCase().includes('math') && s.isCore);
      const science = formSubjects.find(s => s.subjectName.toLowerCase().includes('science') && s.isCore);
      const social = formSubjects.find(s => s.subjectName.toLowerCase().includes('social') && s.isCore);

      const getPoints = (grade: string): number => {
        const found = WASSCE_GRADES.find(g => g.grade === grade);
        return found ? found.point : 9;
      };

      const pEnglish = english ? getPoints(english.grade) : 9;
      const pMath = math ? getPoints(math.grade) : 9;
      const pScience = science ? getPoints(science.grade) : 9;
      const pSocial = social ? getPoints(social.grade) : 9;

      const betterScienceOrSocial = Math.min(pScience, pSocial);
      const coreSum = pEnglish + pMath + betterScienceOrSocial;

      // Electives are anything else
      // Let's filter out English, Core Math, and the chosen science/social subject
      const chosenScienceOrSocialObj = pScience <= pSocial ? science : social;
      const electivePool = formSubjects.filter(s => {
        if (s === english) return false;
        if (s === math) return false;
        if (s === chosenScienceOrSocialObj) return false;
        return true;
      });

      const electivePointsSorted = electivePool.map(s => getPoints(s.grade)).sort((a,b) => a-b);
      const top3Electives = electivePointsSorted.slice(0, 3);
      let electiveSum = top3Electives.reduce((a,b) => a+b, 0);
      
      const missingElectivesCount = 3 - top3Electives.length;
      if (missingElectivesCount > 0) electiveSum += missingElectivesCount * 9;

      return Math.min(54, Math.max(6, coreSum + electiveSum));
    }
  }, [formSubjects, formExamType]);

  // Determine suitability status
  const admissionStatus = useMemo(() => {
    if (formExamType === 'BECE') {
      if (calculatedAggregate <= 24) return 'Excellent';
      if (calculatedAggregate <= 36) return 'Qualified';
      if (calculatedAggregate <= 45) return 'Conditional';
      return 'Failed';
    } else {
      // WASSCE university qualifiers require overall aggregate <= 36 
      // AND credits (A1-C6) in all key 6 subjects.
      const english = formSubjects.find(s => s.subjectName.toLowerCase().includes('english'));
      const math = formSubjects.find(s => s.subjectName.toLowerCase().includes('math') && s.isCore);
      
      const hasEngCredit = english && ['A1','B2','B3','C4','C5','C6'].includes(english.grade);
      const hasMathCredit = math && ['A1','B2','B3','C4','C5','C6'].includes(math.grade);
      
      if (calculatedAggregate <= 15 && hasEngCredit && hasMathCredit) return 'Excellent';
      if (calculatedAggregate <= 36 && hasEngCredit && hasMathCredit) return 'Qualified';
      if (calculatedAggregate <= 42) return 'Conditional';
      return 'Failed';
    }
  }, [calculatedAggregate, formExamType, formSubjects]);

  const handleEdit = (rec: ExamAnalysisRecord) => {
    setSelectedRecordId(rec.id || null);
    setFormStudentId(rec.studentId);
    setFormExamType(rec.examType);
    setFormYear(rec.year);
    setFormIndexNo(rec.indexNumber);
    setFormSchool(rec.schoolName);
    setFormSubjects(rec.subjects);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this national exam record?')) {
      await db.examAnalysis.delete(id);
      showToast('Record deleted successfully.', 'info');
    }
  };

  // Save changes
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      showToast('Please pick a student.', 'error');
      return;
    }
    if (!formIndexNo) {
      showToast('Please type the Index Number.', 'error');
      return;
    }

    const studentName = currentSelectedFormStudent 
      ? `${currentSelectedFormStudent.firstName} ${currentSelectedFormStudent.lastName}` 
      : 'Unknown Student';

    const recordPayload: ExamAnalysisRecord = {
      studentId: formStudentId,
      studentName,
      examType: formExamType,
      year: Number(formYear),
      indexNumber: formIndexNo,
      schoolName: formSchool,
      subjects: formSubjects,
      aggregate: calculatedAggregate,
      status: admissionStatus,
      remarks: formExamType === 'WASSCE' 
        ? (admissionStatus === 'Excellent' ? 'Highly competitive candidate for engineering/medical programs.' :
           admissionStatus === 'Qualified' ? 'Adequate qualifiers for University admission.' :
           admissionStatus === 'Conditional' ? 'Restricted qualifiers. May look into diplomas or vocational schools.' : 
           'Fail. Remedial assistance recommended.')
        : (admissionStatus === 'Excellent' ? 'Outstanding placement prospects for Grade A Senior High schools.' :
           admissionStatus === 'Qualified' ? 'Candidate qualified for Free SHS computer placement.' :
           admissionStatus === 'Conditional' ? 'Marginal. Placement depends on school vacuum vacancies.' :
           'Fails critical subjects. Vocational track suggested.'),
      createdAt: Date.now()
    };

    try {
      if (selectedRecordId) {
        await db.examAnalysis.put({ ...recordPayload, id: selectedRecordId });
        showToast('National Exam record updated successfully.', 'success');
      } else {
        await db.examAnalysis.add(recordPayload);
        showToast('National Exam record logged successfully.', 'success');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      showToast('Error saving record: ' + err.message, 'error');
    }
  };

  const resetForm = () => {
    setSelectedRecordId(null);
    setFormStudentId('');
    setFormIndexNo('');
    setFormSchool('ESEPA ACADEMY');
    setFormExamType('WASSCE');
    setFormYear(new Date().getFullYear());
  };

  // Generate Sample WAEC Data for quick visualization & testing
  const handleProvisionSampleData = async () => {
    const list = [...allStudents];
    if (list.length === 0) {
      // Create some temporary mock students to assign to the dashboard if empty
      const sampleNames = [
        { f: 'Abigail', l: 'Appiah', cls: 'SHS 3' },
        { f: 'Kwame', l: 'Boateng', cls: 'SHS 3' },
        { f: 'Emmanuel', l: 'Owusu', cls: 'SHS 3' },
        { f: 'Fatima', l: 'Oumar', cls: 'SHS 3' },
        { f: 'Richmond', l: 'Mensah', cls: 'JHS 3' },
        { f: 'Akosua', l: 'Dapaah', cls: 'JHS 3' },
        { f: 'Selasi', l: 'Klogo', cls: 'JHS 3' },
        { f: 'Benedicta', l: 'Lartey', cls: 'JHS 3' }
      ];
      
      for (const s of sampleNames) {
        const sid = 'STU' + Math.floor(1000 + Math.random() * 9000);
        await db.students.add({
          studentId: sid,
          firstName: s.f,
          lastName: s.l,
          class: s.cls,
          dateOfBirth: '2008-05-12',
          gender: Math.random() > 0.5 ? 'Male' : 'Female',
          guardianName: 'Guardian ' + s.l,
          guardianPhone: '0244' + Math.floor(100000 + Math.random() * 900000),
          feesPaid: 1500,
          totalFees: 2000,
          createdAt: Date.now()
        });
      }
      showToast('Demo students provisioned. Generating mock scores...', 'info');
    }

    const compiledStudents = await db.students.toArray();
    const currentYear = new Date().getFullYear();

    // Generate random WASSCE and BECE exam analysis scores
    const sampleExamRecords: ExamAnalysisRecord[] = compiledStudents.map((st, index) => {
      const type = st.class.includes('SHS') ? 'WASSCE' : 'BECE';
      const indexNum = '0023489' + String(100 + index);
      
      const subjTemplate = type === 'WASSCE' ? DEFAULT_WASSCE_SUBJECTS : DEFAULT_BECE_SUBJECTS;
      
      // Generate scores centered around 50 - 95
      const gradeSubjects = subjTemplate.map(tmpl => {
        const score = Math.floor(52 + Math.random() * 43); // 52 to 95
        const grade = getGradeForScore(score, type);
        return {
          subjectName: tmpl.subjectName,
          score,
          grade,
          isCore: tmpl.isCore
        };
      });

      // calculate aggregates
      let aggregate = 24;
      if (type === 'BECE') {
        const corePoints = gradeSubjects.filter(s => s.isCore).map(s => parseInt(s.grade) || 9);
        const electivePoints = gradeSubjects.filter(s => !s.isCore).map(s => parseInt(s.grade) || 9).sort();
        aggregate = corePoints.reduce((a,b) => a+b, 0) + electivePoints.slice(0,2).reduce((a,b) => a+b, 0);
      } else {
        const pEng = ['A1','B2','B3','C4','C5','C6'].includes(gradeSubjects[0].grade) ? WASSCE_GRADES.find(g => g.grade === gradeSubjects[0].grade)?.point || 6 : 9;
        const pMath = ['A1','B2','B3','C4','C5','C6'].includes(gradeSubjects[1].grade) ? WASSCE_GRADES.find(g => g.grade === gradeSubjects[1].grade)?.point || 6 : 9;
        const pSci = WASSCE_GRADES.find(g => g.grade === gradeSubjects[2].grade)?.point || 9;
        const pSoc = WASSCE_GRADES.find(g => g.grade === gradeSubjects[3].grade)?.point || 9;
        const betterSciOrSoc = Math.min(pSci, pSoc);
        
        const otherAndElectivePoints = gradeSubjects.slice(4).map(s => WASSCE_GRADES.find(g => g.grade === s.grade)?.point || 9).sort();
        const top3Electives = otherAndElectivePoints.slice(0, 3);
        aggregate = pEng + pMath + betterSciOrSoc + top3Electives.reduce((a,b) => a+b, 0);
      }

      // Ensure boundaries
      aggregate = Math.min(54, Math.max(6, aggregate));

      let stat: 'Excellent' | 'Qualified' | 'Conditional' | 'Failed' = 'Qualified';
      if (aggregate <= 14) stat = 'Excellent';
      else if (aggregate <= 30) stat = 'Qualified';
      else if (aggregate <= 43) stat = 'Conditional';
      else stat = 'Failed';

      return {
        studentId: st.studentId,
        studentName: `${st.firstName} ${st.lastName}`,
        examType: type as 'BECE' | 'WASSCE',
        year: currentYear,
        schoolName: 'ESEPA HIGHER ACADEMY',
        indexNumber: indexNum,
        subjects: gradeSubjects,
        aggregate,
        status: stat,
        remarks: type === 'WASSCE' 
          ? 'University admission recommended. Good stream choice.' 
          : 'High School computer placement potential.',
        createdAt: Date.now() - index * 1000 * 3600
      };
    });

    // Bulk Add
    await db.examAnalysis.clear();
    await db.examAnalysis.bulkAdd(sampleExamRecords);
    showToast('Database provisioned with beautiful mock WAEC exam cards!', 'success');
  };

  // Filtered Ledger List
  const filteredRecords = useMemo(() => {
    return examRecords.filter(r => {
      if (isStudent) {
        if (!studentRecord) return false;
        if (r.studentId !== studentRecord.studentId) return false;
      }

      const typeMatch = examTypeFilter === 'All' ? true : r.examType === examTypeFilter;
      const yearMatch = yearFilter === 'All' ? true : r.year.toString() === yearFilter;
      
      const q = searchQuery.toLowerCase();
      const searchMatch = !q ? true : (
        r.studentName.toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q) ||
        r.indexNumber.toLowerCase().includes(q) ||
        r.schoolName.toLowerCase().includes(q)
      );
      
      return typeMatch && yearMatch && searchMatch;
    });
  }, [examRecords, examTypeFilter, yearFilter, searchQuery, isStudent, studentRecord]);

  // Aggregate Data Calculations for Recharts Charts
  const chartAggregateData = useMemo(() => {
    const list = filteredRecords;
    if (list.length === 0) return [];
    
    // Group aggregates into brackets: 6-12 (Single Digit / High Honors), 13-24, 25-36, 37-45, 46-54
    const groups = [
      { name: 'Single Digit (6-12)', count: 0 },
      { name: 'High Pass (13-24)', count: 0 },
      { name: 'Credit Qualifiers (25-36)', count: 0 },
      { name: 'Borderline (37-45)', count: 0 },
      { name: 'Weak / Fail (46-54)', count: 0 },
    ];

    list.forEach(r => {
      const agg = r.aggregate;
      if (agg <= 12) groups[0].count++;
      else if (agg <= 24) groups[1].count++;
      else if (agg <= 36) groups[2].count++;
      else if (agg <= 45) groups[3].count++;
      else groups[4].count++;
    });

    return groups;
  }, [filteredRecords]);

  const chartStatusData = useMemo(() => {
    const list = filteredRecords;
    const stats = { Excellent: 0, Qualified: 0, Conditional: 0, Failed: 0 };
    list.forEach(r => {
      stats[r.status] = (stats[r.status] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [filteredRecords]);

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

  const subjectPassRateData = useMemo(() => {
    const map: Record<string, { total: number, pass: number }> = {};
    const records = filteredRecords;
    
    records.forEach(r => {
      r.subjects.forEach(s => {
        const name = s.subjectName;
        if (!map[name]) {
          map[name] = { total: 0, pass: 0 };
        }
        map[name].total++;
        
        // Count pass if score >= 50% (equivalent to Grade C6 or BECE Grade 6)
        if (s.score >= 50) {
          map[name].pass++;
        }
      });
    });

    return Object.entries(map).map(([name, stats]) => ({
      name,
      rate: Math.round((stats.pass / stats.total) * 100),
      totalCount: stats.total
    })).sort((a,b) => b.rate - a.rate);
  }, [filteredRecords]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    const list = filteredRecords;
    if (list.length === 0) return { total: 0, passRate: 0, avgAgg: 0 };
    
    const count = list.length;
    const passes = list.filter(r => r.status === 'Excellent' || r.status === 'Qualified').length;
    const sumAgg = list.map(r => r.aggregate).reduce((a,b) => a+b, 0);

    return {
      total: count,
      passRate: Math.round((passes / count) * 100),
      avgAgg: Math.round((sumAgg / count) * 10) / 10
    };
  }, [filteredRecords]);

  // Export to Excel function using XLSX
  const exportLedgerToExcel = () => {
    if (filteredRecords.length === 0) {
      showToast('No records available to export.', 'error');
      return;
    }
    
    const xlData = filteredRecords.map(r => {
      const coreSubjs = r.subjects.filter(s => s.isCore).map(s => `${s.subjectName}: ${s.grade} (${s.score}%)`).join(', ');
      const electSubjs = r.subjects.filter(s => !s.isCore).map(s => `${s.subjectName}: ${s.grade} (${s.score}%)`).join(', ');
      return {
        'Index Number': r.indexNumber,
        'Student ID': r.studentId,
        'Student Name': r.studentName,
        'Exam Type': r.examType,
        'Year': r.year,
        'Aggregate Score': r.aggregate,
        'Admission Eligibility': r.status,
        'Core Subject Scores': coreSubjs,
        'Elective Subject Scores': electSubjs,
        'School Name': r.schoolName,
        'Date Recorded': new Date(r.createdAt).toLocaleDateString()
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(xlData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'National Exam Ledger');
    XLSX.writeFile(workbook, `WAEC_Exam_Analysis_${new Date().getFullYear()}.xlsx`);
    showToast('Excel report downloaded successfully.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-slate-100 gap-4 print:hidden">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full uppercase tracking-wider mb-2">
            <Award className="w-3.5 h-3.5" />
            WAEC Performance Console
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">BECE & WASSCE Analysis</h1>
          <p className="text-sm text-slate-500 mt-1">
            Predict high school placement, track university admission suitability, map grade aggregates, and generate WAEC reports.
          </p>
        </div>

        {!isStudent ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleProvisionSampleData}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Populate the database with demo results for examination grades"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Generate Demo Grades</span>
            </button>
            
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-md hover:shadow-indigo-500/10 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Exam Record</span>
            </button>
          </div>
        ) : studentRecord ? (
          <div className="flex items-center gap-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 pr-4">
            <div className="w-9 h-9 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-sm uppercase">
              {(studentRecord.firstName?.[0] || '')}{(studentRecord.lastName?.[0] || '') || 'S'}
            </div>
            <div>
              <p className="text-xs font-black text-indigo-950">{studentRecord.firstName} {studentRecord.lastName}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{studentRecord.studentId} • {studentRecord.class}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 gap-1 sm:gap-2 print:hidden">
        {[
          { id: 'overview', label: 'Dashboard & Insights', icon: TrendingUp },
          { id: 'ledger', label: 'Examinations Ledger', icon: GraduationCap },
          { id: 'predictor', label: 'Interactive Grade Calculator', icon: Calculator },
        ].map(t => {
          const ActiveIcon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-sm tracking-wide transition-all cursor-pointer ${
                activeTab === t.id 
                  ? 'border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/20' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
              }`}
            >
              <ActiveIcon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Graded Candidates</span>
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2">{overallStats.total}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">Logged in system</p>
            </div>

            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Average Aggregate</span>
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-2">
                {overallStats.avgAgg || '--'}
              </p>
              <p className="text-xs font-medium text-slate-500 mt-1">Scale of 6 (best) to 54 (worst)</p>
            </div>

            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Univ / SHS Pass Rate</span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-slate-900 mt-2">{overallStats.passRate}%</p>
                {overallStats.passRate > 75 ? (
                  <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-0.5">
                    ▲ Excellent
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-500">Normal</span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-500 mt-1">Candidates with Aggregate ≤ 36</p>
            </div>

            <div className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Pending Remedials</span>
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <AlertCircle className="w-4 h-4" />
                </span>
              </div>
              <p className="text-3xl font-black text-rose-600 mt-2">
                {filteredRecords.filter(r => r.status === 'Failed').length}
              </p>
              <p className="text-xs font-medium text-slate-500 mt-1">Unacceptable grades detected</p>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <Award className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">
                  {isStudent ? 'No Exam Record Found' : 'No Exam Records logged yet'}
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  {isStudent 
                    ? 'Your official BECE / WASSCE exam records have not been uploaded to the console yet. Please contact the administrator. In the meantime, you can use the Grade Calculator tab to compute hypothetical aggregates.'
                    : 'National Exam prediction and aggregate tracking is fully empty. Build/predict your first aggregates or generate precompiled demo logs above!'}
                </p>
              </div>
              {!isStudent && (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleProvisionSampleData}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Load Demo Data
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    Create Manual Entry
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Aggregate bracket distribution chart */}
              <div className="lg:col-span-2 p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div className="mb-4">
                  <h3 className="font-black text-slate-800 heading-sans">Score Brackets Analysis</h3>
                  <p className="text-xs text-slate-500">Distribution of calculated candidate aggregates (ideal is single-digit 6-12)</p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartAggregateData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }} 
                        itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="count" fill="var(--color-indigo-600)" radius={[8, 8, 0, 0]} barSize={40}>
                        {chartAggregateData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={idx === 0 ? '#10B981' : idx === 1 ? '#3B82F6' : idx === 2 ? 'var(--color-indigo-500)' : idx === 3 ? '#F59E0B' : '#EF4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status Pie and stream */}
              <div className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-slate-800">WAEC Placement / Admission Status</h3>
                  <p className="text-xs text-slate-500 mb-4">Qualification rates for local tertiary & secondary schools</p>
                </div>
                <div className="h-52 relative flex items-center justify-center">
                  {chartStatusData.length === 0 ? (
                    <div className="text-slate-400 text-xs">No entries loaded</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="absolute text-center">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pass Rate</p>
                    <p className="text-2xl font-black text-slate-800">{overallStats.passRate}%</p>
                  </div>
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                  {chartStatusData.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="text-slate-800 font-bold">{item.value} Candidates</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject Pass analysis */}
              <div className="lg:col-span-3 p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div>
                  <h3 className="font-black text-slate-800">Subject Quality Pass Rate (%)</h3>
                  <p className="text-xs text-slate-500 mb-4">Percentage of candidates achieving a credit value or above pass (Grade C6 / 6 or superior)</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subjectPassRateData.slice(0, 8).map((subj, idx) => (
                    <div key={subj.name} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-700">{subj.name}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          subj.rate >= 80 ? 'bg-emerald-50 text-emerald-700' :
                          subj.rate >= 50 ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {subj.rate}% Pass
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            subj.rate >= 80 ? 'bg-emerald-500' :
                            subj.rate >= 50 ? 'bg-indigo-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${subj.rate}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEDGER TAB */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-3 print:hidden">
            {/* Search */}
            {!isStudent ? (
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search candidates, index number, student ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold text-slate-700 placeholder-slate-400"
                />
              </div>
            ) : (
              <div className="flex-1 text-slate-500 text-xs font-semibold">
                Your registered National Examination performance record ledger.
              </div>
            )}

            {/* Exam types */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select
                value={examTypeFilter}
                onChange={e => setExamTypeFilter(e.target.value as any)}
                className="w-full md:w-36 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none bg-white"
              >
                <option value="All">All Exams</option>
                <option value="BECE">BECE (Basic)</option>
                <option value="WASSCE">WASSCE (SHS)</option>
              </select>

              {!isStudent && (
                <select
                  value={yearFilter}
                  onChange={e => setYearFilter(e.target.value)}
                  className="w-full md:w-28 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none bg-white"
                >
                  <option value="All">All Years</option>
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}

              {!isStudent && (
                <button
                  onClick={exportLedgerToExcel}
                  className="p-2 sm:px-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-1 shrink-0 text-xs font-bold font-mono outline-none"
                  title="Export list"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <GraduationCap className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-extrabold text-slate-700">No records found matching filters</p>
                <p className="text-xs text-slate-500">Try adjusting your filters, searching for another student, or loading demo data in the top bar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-wider">
                      <th className="py-4 px-6">Candidate</th>
                      <th className="py-4 px-4">Exam Details</th>
                      <th className="py-4 px-4 text-center">Subjects Graded</th>
                      <th className="py-4 px-4 text-center">Aggregate Score</th>
                      <th className="py-4 px-4">Eligibility Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm font-medium text-slate-700">
                    {filteredRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-extrabold text-slate-900">{rec.studentName}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{rec.studentId}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              rec.examType === 'WASSCE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {rec.examType}
                            </span>
                            <p className="text-xs text-slate-500">Year: <strong className="text-slate-800">{rec.year}</strong></p>
                            <p className="text-xs font-mono text-slate-400">Index: {rec.indexNumber}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 rounded-full font-black text-xs text-slate-600">
                            {rec.subjects.length}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex flex-col items-center justify-center">
                            <span className={`font-black text-lg px-2.5 py-0.5 rounded-full ${
                              rec.aggregate <= 15 ? 'bg-emerald-50 text-emerald-600' :
                              rec.aggregate <= 30 ? 'bg-blue-50 text-blue-600' :
                              rec.aggregate <= 36 ? 'bg-indigo-50 text-indigo-600' :
                              rec.aggregate <= 45 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                            }`}>
                              {rec.aggregate}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase tracking-wide">Aggregate</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold leading-none ${
                              rec.status === 'Excellent' ? 'bg-emerald-50 text-emerald-700' :
                              rec.status === 'Qualified' ? 'bg-blue-50 text-blue-700' :
                              rec.status === 'Conditional' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              {rec.status === 'Excellent' ? 'Excellent Qualifiers' :
                               rec.status === 'Qualified' ? 'Admissions Qualified' :
                               rec.status === 'Conditional' ? 'Conditional Pass' : 'Failed Admission'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setPreviewRecord(rec);
                                setIsPreviewModalOpen(true);
                              }}
                              className="p-1 px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all flex items-center gap-0.5 outline-none"
                              title="View and print card certificate"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Card</span>
                            </button>
                            
                            {!isStudent && (
                              <>
                                <button
                                  onClick={() => handleEdit(rec)}
                                  className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all outline-none"
                                  title="Edit record"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleDelete(rec.id!)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all outline-none"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRADE CALCULATOR / PREDICTOR TAB */}
      {activeTab === 'predictor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 rounded-full uppercase tracking-wider mb-2">
                <Calculator className="w-3.5 h-3.5 text-rose-500" />
                Admission Predictor Engine
              </span>
              <h3 className="text-xl font-black text-slate-800">Dynamic Score Aggregation</h3>
              <p className="text-xs text-slate-500 mt-1">
                Ghana core subject guidelines applied. Choose score ranges to map admission chances.
              </p>
            </div>

            {/* Exam selector */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
              <button
                onClick={() => setFormExamType('WASSCE')}
                className={`p-4 border text-center rounded-2xl transition-all cursor-pointer ${
                  formExamType === 'WASSCE' 
                    ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 shadow-md ring-2 ring-indigo-500/10' 
                    : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className="w-6 h-6 mx-auto mb-1.5" />
                <h4 className="font-extrabold text-sm">WASSCE (Secondary)</h4>
                <p className="text-[10px] opacity-85 mt-0.5">Core 3 + Best 3 Electives</p>
              </button>

              <button
                onClick={() => setFormExamType('BECE')}
                className={`p-4 border text-center rounded-2xl transition-all cursor-pointer ${
                  formExamType === 'BECE' 
                    ? 'border-amber-600 bg-amber-50/30 text-amber-900 shadow-md ring-2 ring-amber-500/10' 
                    : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Award className="w-6 h-6 mx-auto mb-1.5" />
                <h4 className="font-extrabold text-sm">BECE (Basic Edu)</h4>
                <p className="text-[10px] opacity-85 mt-0.5">Core 4 + Best 2 Electives</p>
              </button>
            </div>

            {/* Subject Entries List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Subject Title & Category</span>
                <span className="pr-4">Exam Score (0-100) & Grade</span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-2">
                {formSubjects.map((s, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50/50 hover:bg-slate-100/30 border border-slate-100 rounded-xl transition-colors">
                    <div className="flex-1 w-full space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={s.subjectName}
                          onChange={e => handleSubjectNameChange(idx, e.target.value)}
                          className="font-bold text-slate-700 text-sm bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none focus:bg-white px-1 py-0.5 rounded transition-all max-w-[200px] sm:max-w-none"
                        />
                        <button
                          onClick={() => handleSubjectCoreToggle(idx)}
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase transition-colors tracking-wider flex items-center gap-0.5 cursor-pointer ${
                            s.isCore 
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                              : 'bg-slate-200 text-slate-600 border border-slate-300'
                          }`}
                        >
                          <span className="w-1 h-1 rounded-full bg-current"></span>
                          {s.isCore ? 'Core Subject' : 'Elective'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={s.score}
                          onChange={e => handleSubjectScoreChange(idx, parseInt(e.target.value) || 0)}
                          className="w-16 px-1.5 py-1 text-center font-black border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                          min="0"
                          max="100"
                        />
                        <span className={`w-12 h-8 flex items-center justify-center font-black text-xs rounded-lg border font-mono ${
                          formExamType === 'WASSCE' 
                            ? (['A1','B2','B3','C4','C5','C6'].includes(s.grade) ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100')
                            : (parseInt(s.grade) <= 6 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100')
                        }`}>
                          {s.grade}
                        </span>
                      </div>

                      <button
                        onClick={() => removeFormSubject(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-full transition-colors focus:outline-none"
                        title="Remove Subject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addFormSubject}
                className="flex items-center gap-1 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider p-2 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl"
              >
                <Plus className="w-4 h-4" />
                Add Elective Paper
              </button>
            </div>
          </div>

          {/* Results Side panel predictor */}
          <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4">
              <Award className="w-56 h-56 text-white" />
            </div>

            <div className="space-y-4 z-10 relative">
              <div className="flex items-center gap-1 bg-white/10 w-fit px-3 py-1 text-[10px] font-black text-indigo-300 rounded-full uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Live Analysis Output
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aggregate Calculated</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-6xl font-black text-indigo-400 font-mono leading-none">{calculatedAggregate}</p>
                  <p className="text-xs text-indigo-300 font-bold bg-indigo-500/20 px-2 py-0.5 rounded">
                    WAEC Scale
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">Lower is superior. Ghanaian grade scale targets 6-36</p>
              </div>

              <div className="p-4 bg-slate-800/40 border border-white/5 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Admission Suitability</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                  admissionStatus === 'Excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                  admissionStatus === 'Qualified' ? 'bg-indigo-500/20 text-indigo-400' :
                  admissionStatus === 'Conditional' ? 'bg-orange-500/20 text-orange-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current"></span>
                  {admissionStatus === 'Excellent' ? 'EXCELLENT ADMISSION CHANCES' :
                   admissionStatus === 'Qualified' ? 'UNIVERSITY QUALIFIED' :
                   admissionStatus === 'Conditional' ? 'BORDERLINE / CONDITIONAL' : 'NOT ADMISSIBLE'}
                </span>

                <p className="text-xs text-slate-300 leading-relaxed font-bold mt-1">
                  {formExamType === 'WASSCE' 
                    ? (admissionStatus === 'Excellent' ? 'Calculated points strongly qualify this candidate for high tier university programs such as Computer Science, Nursing, or Law.' :
                       admissionStatus === 'Qualified' ? 'Adequate. Eligible for all tertiary university admission streams with correct core subject credits.' :
                       admissionStatus === 'Conditional' ? 'Requires special consideration. Suggested entry through vocational programs or diploma options.' :
                       'Fails key entry scores. Candidate must rewrite failed core core papers.')
                    : (admissionStatus === 'Excellent' ? 'Candidate stands high probability of getting into Category A secondary boarding schools.' :
                       admissionStatus === 'Qualified' ? 'Safe scores. High probability of finding Free SHS placement in major schools.' :
                       admissionStatus === 'Conditional' ? 'Placement is marginal. May consider community day schools.' :
                       'Aggregate value is very low. Placement is unlikely without intervention.')
                  }
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3 z-10 relative">
              <p className="text-xs text-slate-400 font-bold font-mono">Admission Conditions Checklist:</p>
              <div className="space-y-1.5 text-xs text-slate-300 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>English Grade is Credit (A1 - C6)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Mathematics Grade is Credit (A1 - C6)</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-300">
                  <span className="w-4 h-4 bg-indigo-500/20 rounded-full flex items-center justify-center text-[10px] b">3</span>
                  <span>Electives count toward program requirements</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE RECORD PRINT REPORT MODAL */}
      {isPreviewModalOpen && previewRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-6 space-y-6 relative border border-slate-100 max-h-[90vh] overflow-y-auto print:p-0 print:border-none print:shadow-none print:static">
            {/* Modal Controls */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 print:hidden">
              <h3 className="font-extrabold text-slate-800 text-lg">WAEC Grade Analysis Card</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerPrint}
                  className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => {
                    setPreviewRecord(null);
                    setIsPreviewModalOpen(false);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all outline-none cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Certificate Area */}
            <div id="print-certificate" className="space-y-6 p-6 border-4 border-slate-800 bg-linear-to-b bg-white relative rounded-xl print:border-0 print:p-0">
              {/* Background badge cache */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
                <GraduationCap className="w-72 h-72 text-slate-900" />
              </div>

              {/* Header Certificate */}
              <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800 relative z-10">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {previewRecord.schoolName || 'ESEPA SECONDARY SCHOOL'}
                </h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">WAEC Terminal Grade & Suitability Analysis</p>
                <span className="inline-block mt-2 px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                  {previewRecord.examType} PERFORMANCE REPORTCARD ({previewRecord.year})
                </span>
              </div>

              {/* Biometrics */}
              <div className="grid grid-cols-2 gap-4 text-xs font-bold border-b border-dashed border-slate-300 pb-4 relative z-10">
                <div>
                  <p className="text-slate-400 uppercase tracking-wider text-[9px] mb-0.5">Candidate Name</p>
                  <p className="text-sm font-extrabold text-slate-900 uppercase">{previewRecord.studentName}</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase tracking-wider text-[9px] mb-0.5">Examination Number</p>
                  <p className="text-sm font-mono text-slate-900">{previewRecord.indexNumber}</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase tracking-wider text-[9px] mb-0.5">School Identifier</p>
                  <p className="text-slate-950 font-semibold">{previewRecord.schoolName}</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase tracking-wider text-[9px] mb-0.5">Student ID</p>
                  <p className="text-slate-950 font-mono">{previewRecord.studentId}</p>
                </div>
              </div>

              {/* Subject Ledger Grid */}
              <div className="space-y-2 relative z-10">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1.5">Examinations Graded Subjects</h4>
                <div className="divide-y divide-slate-100">
                  {previewRecord.subjects.map((sub, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${sub.isCore ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
                        <span className="text-slate-700">{sub.subjectName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 font-mono">{sub.score}%</span>
                        <span className="w-10 text-center py-0.5 text-slate-900 font-black rounded-md font-mono bg-slate-100 text-xs">
                          {sub.grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aggregates Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-center items-center relative z-10">
                <div className="border-r border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aggregate Points</p>
                  <p className="text-4xl font-black text-slate-900 font-mono mt-1">{previewRecord.aggregate}</p>
                  <p className="text-[9px] text-slate-400 font-medium">Standard WAEC score</p>
                </div>

                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Admission Chances</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-extrabold ${
                    previewRecord.status === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                    previewRecord.status === 'Qualified' ? 'bg-indigo-100 text-indigo-800' :
                    previewRecord.status === 'Conditional' ? 'bg-orange-100 text-orange-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {previewRecord.status === 'Excellent' ? 'HIGH HONORS / EXCELLENT' :
                     previewRecord.status === 'Qualified' ? 'TERTIARY ELIGIBLE' :
                     previewRecord.status === 'Conditional' ? 'BORDERLINE' : 'NOT ADMISSIBLE'}
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1 relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Counselor Remarks</p>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  &ldquo;{previewRecord.remarks}&rdquo;
                </p>
              </div>

              {/* Stamp and sign-offs */}
              <div className="flex justify-between items-end pt-6 border-t border-slate-800 text-[10px] font-bold text-slate-500 relative z-10">
                <div>
                  <p className="text-slate-900 uppercase tracking-wider text-[9px] mb-1">Director's Endorsement</p>
                  <div className="w-32 h-10 border-b border-slate-400 flex items-center justify-center text-xs text-slate-300 font-mono italic">
                    Signed & Sealed
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-slate-400 text-[8px] uppercase font-mono">Date Generated</p>
                  <p className="text-slate-800 font-mono mt-0.5">{new Date(previewRecord.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ENTRY / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full p-6 space-y-6 relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">
                  {selectedRecordId ? 'Edit National Exam Record' : 'Record National Exam Grades'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Input mock WAEC scores for placement tracking</p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all outline-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student choice Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Pick Student</label>
                  <select
                    value={formStudentId}
                    onChange={e => setFormStudentId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 bg-white"
                    required
                  >
                    <option value="" disabled>Choose a student...</option>
                    {allStudents.map(st => (
                      <option key={st.id || st.studentId} value={st.studentId}>
                        {st.firstName} {st.lastName} ({st.class})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Index number entry */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">WAEC Index Number</label>
                  <input
                    type="text"
                    value={formIndexNo}
                    onChange={e => setFormIndexNo(e.target.value)}
                    placeholder="e.g. 0030401201"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                    required
                  />
                </div>

                {/* Exam Level choice */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Exam Level</label>
                  <select
                    value={formExamType}
                    onChange={e => setFormExamType(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 bg-white"
                  >
                    <option value="WASSCE">WASSCE (Senior High School)</option>
                    <option value="BECE">BECE (Junior High School)</option>
                  </select>
                </div>

                {/* Year Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Exam Year</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={e => setFormYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                    required
                    min="2020"
                    max="2035"
                  />
                </div>
              </div>

              {/* Form Subjects Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Grades & Raw Marks</h4>
                  <button
                    type="button"
                    onClick={addFormSubject}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider scale-95"
                  >
                    + Add Elective
                  </button>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                  {formSubjects.map((sub, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 p-2 bg-slate-50/50 rounded-lg border border-slate-100">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={sub.subjectName}
                          onChange={e => handleSubjectNameChange(idx, e.target.value)}
                          className="font-bold text-slate-700 text-xs bg-transparent border-none border-b border-transparent focus:border-indigo-500 focus:outline-none focus:bg-white px-1 py-0.5 rounded transition-all w-full"
                          required
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={sub.score}
                          onChange={e => handleSubjectScoreChange(idx, parseInt(e.target.value) || 0)}
                          className="w-14 py-1 text-center font-black border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                          min="0"
                          max="100"
                          required
                        />
                        <span className="w-10 py-1 flex items-center justify-center font-black text-xs rounded border bg-white font-mono">
                          {sub.grade}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFormSubject(idx)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded-full"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom calculated totals indicator */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-indigo-800">Predicted Aggregate: <strong className="text-lg text-indigo-600 font-mono">{calculatedAggregate}</strong></p>
                  <p className="text-[10px] text-indigo-500 font-medium">Automatic Core & Electives grouping applied</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-indigo-800">Status Eligibility: <span className="uppercase text-indigo-600 font-black">{admissionStatus}</span></p>
                  <p className="text-[10px] text-indigo-500 font-medium">Suitable for Free SHS/University Selection</p>
                </div>
              </div>

              {/* Form submit handlers */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
