import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, calculateGrade, type Result, type Student } from '../db/schema';
import { Save, FileSpreadsheet, Calculator, Search, CheckCircle2, Eye, X, Download, RefreshCcw, FileText, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
import { calculateFileHash, calculateContentFingerprint, checkIsFileDuplicate, recordImportedFile, validateCsvFile } from '../lib/fileSecurity';
import { checkRateLimit, useDebounce } from '../lib/rateLimit';
import * as XLSX from 'xlsx';
import React from 'react';
import { exportToPDF, cn, triggerPrint } from '../lib/utils';
import { ReportCard } from './ReportCard';
import { useAuth } from '../contexts/AuthContext';
import { resultsApi, studentsApi } from '../lib/api';

export default function ResultsTerminal() {
  const { showToast } = useNotifications();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const classesFromDB = useLiveQuery(() => db.classes.toArray()) || [];
  const studentsInSystem = useLiveQuery(() => db.students.toArray()) || [];

  const studentRecord = useMemo(() => {
    if (isStudent && user?.fullName) {
      const cleanName = user.fullName.replace(/\s*\(Student\)/i, '').trim().toLowerCase();
      return studentsInSystem.find(s => {
        if (!s) return false;
        const full = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase().trim();
        return (cleanName && full.includes(cleanName)) || (full && cleanName.includes(full));
      });
    }
    return null;
  }, [isStudent, user?.fullName, studentsInSystem]);

  const classes = useMemo(() => {
    const fromDB = classesFromDB.map(c => c.name);
    const fromStudents = studentsInSystem.map(s => s.class);
    const list = Array.from(new Set([...fromDB, ...fromStudents])).filter(Boolean).sort();
    return list.map((name, idx) => ({ id: idx, name }));
  }, [classesFromDB, studentsInSystem]);

  const subjects = useLiveQuery(() => db.subjects.toArray()) || [];

  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolProfile = useMemo(() => 
    settings.find(s => s.key === 'schoolProfile')?.value || { schoolName: 'ESEPA INTERNATIONAL SCHOOL' }, 
    [settings]
  );
  
  const academicConfig = useMemo(() => 
    settings.find(s => s.key === 'academicConfig')?.value || { academicYear: '2025/2026', currentTerm: 'Term 1' }, 
    [settings]
  );

  const [selectedClass, setSelectedClass] = useState(() => {
    return localStorage.getItem('esepa_selected_class') || 'P1';
  });
  const [selectedSubject, setSelectedSubject] = useState(() => {
    return localStorage.getItem('esepa_selected_subject') || 'Mathematics';
  });
  const [selectedTerm, setSelectedTerm] = useState(() => {
    return localStorage.getItem('esepa_selected_term') || 'Term 1';
  });

  React.useEffect(() => {
    localStorage.setItem('esepa_selected_class', selectedClass);
  }, [selectedClass]);

  React.useEffect(() => {
    if (classes.length > 0 && !classes.find(c => c.name === selectedClass)) {
      setSelectedClass(classes[0].name);
    }
  }, [classes, selectedClass]);

  React.useEffect(() => {
    localStorage.setItem('esepa_selected_subject', selectedSubject);
  }, [selectedSubject]);

  React.useEffect(() => {
    localStorage.setItem('esepa_selected_term', selectedTerm);
  }, [selectedTerm]);

  React.useEffect(() => {
    if (academicConfig && !localStorage.getItem('esepa_selected_term')) {
      setSelectedTerm(academicConfig.currentTerm);
    }
  }, [academicConfig]);

  const filteredSubjectsOptions = useMemo(() => {
    if (!subjects) return [];
    return subjects.filter(s => 
      s.applicableClasses?.includes('All') || 
      s.applicableClasses?.includes(selectedClass) ||
      !s.applicableClasses || s.applicableClasses.length === 0
    );
  }, [subjects, selectedClass]);

  // Update selected subject if current one is not applicable to the class
  React.useEffect(() => {
    if (filteredSubjectsOptions.length > 0 && !filteredSubjectsOptions.find(s => s.name === selectedSubject)) {
      setSelectedSubject(filteredSubjectsOptions[0].name);
    }
  }, [filteredSubjectsOptions, selectedSubject]);
  
  const [search, setSearch] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [studentResults, setStudentResults] = useState<Result[]>([]);
  
  const parentWards = useMemo(() => {
    if (user?.role === 'parent' && user?.fullName && studentsInSystem && studentsInSystem.length > 0) {
      const cleanParentName = user.fullName.replace(/\s*\(Parent\)/i, '').trim().toLowerCase();
      return studentsInSystem.filter(s => {
        const guardian = (s.guardianName || '').toLowerCase().trim();
        return guardian.includes(cleanParentName) || cleanParentName.includes(guardian);
      });
    }
    return [];
  }, [user, studentsInSystem]);

  const [selectedWardId, setSelectedWardId] = useState<string>('');

  React.useEffect(() => {
    if (parentWards.length > 0 && !selectedWardId) {
      setSelectedWardId(parentWards[0].studentId);
    }
  }, [parentWards, selectedWardId]);

  const selectedWard = useMemo(() => {
    return parentWards.find(w => w.studentId === selectedWardId) || parentWards[0] || null;
  }, [parentWards, selectedWardId]);

  const allStudents = useLiveQuery(() => db.students.toArray()) || [];

  const myAllResults = useLiveQuery(
    () => {
      const targetId = isStudent ? studentRecord?.studentId : (user?.role === 'parent' ? selectedWard?.studentId : null);
      if (targetId) {
        return db.results
          .where('studentId')
          .equals(targetId)
          .toArray();
      }
      return Promise.resolve([]);
    },
    [isStudent, studentRecord, selectedWard, user]
  ) || [];

  const myResults = useMemo(() => {
    return myAllResults.filter(r => r.term === selectedTerm);
  }, [myAllResults, selectedTerm]);

  React.useEffect(() => {
    if (isStudent && studentRecord?.class) {
      setSelectedClass(studentRecord.class);
    }
  }, [isStudent, studentRecord]);

  const existingResults = useLiveQuery(
    () => db.results.where('class').equals(selectedClass)
      .and(r => r.subject === selectedSubject && r.term === selectedTerm)
      .toArray(),
    [selectedClass, selectedSubject, selectedTerm]
  ) || [];

  const students = useMemo(() => {
    const existingStudentIds = new Set(existingResults.map(r => r.studentId));
    return allStudents.filter(s => 
      s.class === selectedClass ||
      existingStudentIds.has(s.studentId) ||
      (s.previousClasses && s.previousClasses.includes(selectedClass)) ||
      (s.classHistory && s.classHistory.some(h => h.class === selectedClass))
    );
  }, [allStudents, selectedClass, existingResults]);

  const [scores, setScores] = useState<Record<string, { class: number, exam: number }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync scores with existing results when selection changes
  React.useEffect(() => {
    if (existingResults) {
      const newScores: Record<string, { class: number, exam: number }> = {};
      existingResults.forEach(r => {
        newScores[r.studentId] = { class: r.classScore, exam: r.examScore };
      });
      setScores(newScores);
    }
  }, [existingResults]);

  const handleScoreChange = (studentId: string, type: 'class' | 'exam', value: string) => {
    const numValue = Math.min(Math.max(0, Number(value)), type === 'class' ? 30 : 70);
    setScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { class: 0, exam: 0 }),
        [type]: numValue
      }
    }));
  };

  const handleBulkSave = async () => {
    if (!students.length) {
      showToast('No students found for this class.', 'error');
      return;
    }
    setIsSaving(true);
    const targetSchoolId = user?.school_id || user?.schoolId || (user as any)?.school?.id || '';

    const resultsToSave: Result[] = students.map(student => {
      const s = scores[student.studentId] || { class: 0, exam: 0 };
      const total = s.class + s.exam;
      const { grade, remarks } = calculateGrade(total);
      return {
        studentId: student.studentId,
        subject: selectedSubject,
        term: selectedTerm,
        class: selectedClass,
        classScore: s.class,
        examScore: s.exam,
        totalScore: total,
        grade,
        remarks
      };
    }) || [];

    // Rate limit score save actions: Max 3 per 3 seconds
    const saveCheck = checkRateLimit('results_save_submit', 3, 3000);
    if (!saveCheck.allowed) {
      showToast(`Please wait ${saveCheck.retryAfterSeconds}s before saving scores again.`, "error");
      setIsSaving(false);
      return;
    }

    try {
      for (const res of resultsToSave) {
        const existing = await db.results
          .where({ studentId: res.studentId, subject: res.subject, term: res.term })
          .first();
        
        if (existing) {
          await db.results.update(existing.id!, res);
        } else {
          await db.results.add(res);
        }
      }

      await resultsApi.recordScores(resultsToSave, targetSchoolId);
      showToast("Class examination scores saved to database successfully!", "success");
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error("Failed to save results:", err);
      showToast(err?.message || "Failed to save results to database.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const importFromCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Strict File Type Validation: ONLY CSV (.csv) files allowed
    const validation = await validateCsvFile(file);
    if (!validation.valid) {
      showToast(validation.error || "Invalid file format. Only CSV (.csv) files are allowed for import.", "error");
      e.target.value = '';
      return;
    }

    // 2. Rate Limit Check on Results File Import
    const limitCheck = checkRateLimit('results_csv_import', 2, 8000);
    if (!limitCheck.allowed) {
      showToast(`Rate limit reached: Please wait ${limitCheck.retryAfterSeconds}s before importing another file.`, "error");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (!data || data.length === 0) {
          showToast("No data found in the uploaded CSV file.", "error");
          e.target.value = '';
          return;
        }

        // 2. Cryptographic Duplicate File Check
        const fileHash = await calculateFileHash(file);
        const contentSig = await calculateContentFingerprint(data);
        const targetSchoolId = user?.school_id || user?.schoolId || (user as any)?.school?.id || '';

        const dupCheck = await checkIsFileDuplicate(fileHash, contentSig, targetSchoolId, 'results');
        if (dupCheck.isDuplicate) {
          showToast(`⛔ Duplicate File Blocked: ${dupCheck.reason || 'This exact results CSV file has already been imported.'}`, "error");
          e.target.value = '';
          return;
        }

        // Helper to extract value case-insensitively from a row across multiple possible header names
        const getRowVal = (row: any, candidates: string[]): any => {
          if (!row || typeof row !== 'object') return undefined;
          const keys = Object.keys(row);
          for (const candidate of candidates) {
            if (row[candidate] !== undefined && row[candidate] !== null && String(row[candidate]).trim() !== '') {
              return row[candidate];
            }
            const normalizedCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const k of keys) {
              const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normalizedKey === normalizedCandidate && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
                return row[k];
              }
            }
          }
          return undefined;
        };

        const allExistingStudents = await db.students.toArray();
        const newResults: Result[] = [];
        const newScoresMap: Record<string, { class: number, exam: number }> = {};

        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          let rawStudentId = getRowVal(item, [
            'studentId', 'student_id', 'StudentID', 'Student ID', 'ID', 'Id', 'id',
            'Index No', 'Index Number', 'indexNumber', 'index_no', 'Index', 'index',
            'Student Number', 'student_number', 'Admission Number', 'admission_number', 'Adm No', 'adm_no'
          ]);
          rawStudentId = rawStudentId !== undefined && rawStudentId !== null ? String(rawStudentId).trim() : '';
          if (rawStudentId.toLowerCase() === 'undefined' || rawStudentId.toLowerCase() === 'null') {
            rawStudentId = '';
          }

          let firstName = getRowVal(item, ['firstName', 'first_name', 'FirstName', 'First Name', 'firstname', 'first']);
          firstName = firstName ? String(firstName).trim() : '';

          let lastName = getRowVal(item, ['lastName', 'last_name', 'LastName', 'Last Name', 'surname', 'Surname', 'lastname', 'last']);
          lastName = lastName ? String(lastName).trim() : '';

          let fullName = getRowVal(item, ['studentName', 'student_name', 'Student Name', 'StudentName', 'Name', 'name', 'Full Name', 'fullName', 'fullname', 'Candidate Name']);
          fullName = fullName ? String(fullName).trim() : '';

          if (!firstName && !lastName && fullName) {
            const parts = fullName.split(/\s+/).filter(Boolean);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
          }

          const rowClass = String(getRowVal(item, ['class', 'Class', 'class_name', 'Class Name', 'Grade', 'grade', 'Form', 'form']) || selectedClass).trim();

          // Intelligent Student Lookup: Match by ID, Full Name, or First+Last Name
          let matchedStudent = allExistingStudents.find(s => {
            if (rawStudentId && s.studentId && s.studentId.trim().toLowerCase() === rawStudentId.toLowerCase()) {
              return true;
            }
            if (firstName && lastName) {
              const sFirst = (s.firstName || '').trim().toLowerCase();
              const sLast = (s.lastName || '').trim().toLowerCase();
              if (sFirst === firstName.toLowerCase() && sLast === lastName.toLowerCase()) return true;
              if (sFirst === lastName.toLowerCase() && sLast === firstName.toLowerCase()) return true;
            }
            if (fullName) {
              const sFull = `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
              if (sFull && (sFull === fullName.toLowerCase() || fullName.toLowerCase().includes(sFull))) return true;
            }
            return false;
          });

          let effectiveStudentId = rawStudentId;

          if (matchedStudent) {
            effectiveStudentId = matchedStudent.studentId;
          } else {
            // If student is not found in the student registry, auto-create them with proper names so they never display as "Unknown"
            if (!effectiveStudentId) {
              const randomNum = Math.floor(1000 + Math.random() * 9000);
              effectiveStudentId = `STU-${randomNum}`;
            }
            const effectiveFirst = firstName || (fullName ? fullName.split(' ')[0] : `Student ${i + 1}`);
            const effectiveLast = lastName || (fullName && fullName.includes(' ') ? fullName.split(' ').slice(1).join(' ') : effectiveStudentId);

            const autoStudent: Student = {
              studentId: effectiveStudentId,
              firstName: effectiveFirst,
              lastName: effectiveLast,
              class: rowClass || selectedClass,
              gender: 'Male',
              dateOfBirth: '2010-01-01',
              guardianName: 'Parent / Guardian',
              guardianPhone: '0000000000',
              feesPaid: 0,
              totalFees: 1500,
              createdAt: Date.now()
            };

            await studentsApi.create(autoStudent, targetSchoolId);
            allExistingStudents.push(autoStudent);
          }

          // Extract score values
          const classScoreRaw = getRowVal(item, [
            'classScore', 'class_score', 'ClassScore', 'Class Score', 'Class Score (30%)', 'Class (30%)',
            'Class Score(30%)', 'CA', 'CA Score', 'Class Work', 'Continuous Assessment', '30%', 'Score 30', 'ClassMark', 'Class Mark'
          ]);
          const examScoreRaw = getRowVal(item, [
            'examScore', 'exam_score', 'ExamScore', 'Exam Score', 'Exam Score (70%)', 'Exam (70%)',
            'Exam Score(70%)', 'Exam', 'Exams', 'Examination', 'Exam Mark', '70%', 'Score 70', 'ExamMark'
          ]);

          const classScore = Math.min(30, Math.max(0, Number(classScoreRaw || 0)));
          const examScore = Math.min(70, Math.max(0, Number(examScoreRaw || 0)));
          const total = classScore + examScore;
          const { grade, remarks } = calculateGrade(total);

          const subject = String(getRowVal(item, ['subject', 'Subject', 'subject_name', 'Subject Name', 'Course', 'course', 'SubjectTitle']) || selectedSubject).trim();
          const term = String(getRowVal(item, ['term', 'Term', 'academic_term', 'Academic Term', 'Semester', 'semester', 'Current Term']) || selectedTerm).trim();

          const res: Result = {
            studentId: effectiveStudentId,
            subject,
            term,
            class: rowClass || selectedClass,
            classScore,
            examScore,
            totalScore: total,
            grade,
            remarks
          };

          newResults.push(res);

          // Track for immediate local UI state update
          if (subject.toLowerCase() === selectedSubject.toLowerCase() && term.toLowerCase() === selectedTerm.toLowerCase()) {
            newScoresMap[effectiveStudentId] = { class: classScore, exam: examScore };
          }
        }

        // Save results to local Dexie and sync with cloud database
        for (const res of newResults) {
          const existing = await db.results
            .where({ studentId: res.studentId, subject: res.subject, term: res.term })
            .first();
          if (existing) {
            await db.results.update(existing.id!, res);
          } else {
            await db.results.add(res);
          }
        }

        await resultsApi.recordScores(newResults, targetSchoolId);

        // Update active scores in component memory
        if (Object.keys(newScoresMap).length > 0) {
          setScores(prev => ({ ...prev, ...newScoresMap }));
        }

        // Record file hash in registry for audit trail
        await recordImportedFile({
          hash: fileHash,
          fileName: file.name,
          fileSize: file.size,
          rowCount: newResults.length,
          schoolId: targetSchoolId,
          module: 'results',
          importedAt: Date.now(),
          importedBy: user?.username || user?.fullName || 'Admin'
        });

        showToast(`Successfully imported ${newResults.length} student result(s) without unknown entries!`, "success");
      } catch (err: any) {
        console.error("Results import error:", err);
        showToast(err?.message || "Failed to process results CSV file.", "error");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const openReport = async (student: Student) => {
    const results = await db.results
      .where({ studentId: student.studentId, term: selectedTerm })
      .toArray();
    setSelectedStudentForReport(student);
    setStudentResults(results);
    setIsReportModalOpen(true);
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const handleExportPDF = async () => {
    if (!selectedStudentForReport) return;
    setIsExportingPDF(true);
    try {
      if (!selectedStudentForReport) return;
      await exportToPDF(`report-${selectedStudentForReport.studentId}`, `${selectedStudentForReport.firstName}_${selectedStudentForReport.lastName}_Report`);
    } catch (err) {
      showToast('Failed to export student report PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = (students || []).map(s => ({
      studentId: s.studentId,
      firstName: s.firstName,
      lastName: s.lastName,
      subject: selectedSubject,
      term: selectedTerm,
      class: selectedClass,
      classScore: 0,
      examScore: 0
    }));

    if (templateData.length === 0) {
      templateData.push({
        studentId: 'STU-000',
        firstName: 'Sample',
        lastName: 'Student',
        subject: selectedSubject,
        term: selectedTerm,
        class: selectedClass,
        classScore: 0,
        examScore: 0
      });
    }

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exam_Results_Template");
    XLSX.writeFile(wb, `${selectedClass}_${selectedSubject}_Template.csv`, { bookType: 'csv' });
  };

  const filteredStudents = students?.filter(s => {
    if (!s) return false;
    const query = (search || '').toLowerCase().trim();
    if (!query) return true;
    const firstName = (s.firstName || '').toLowerCase();
    const lastName = (s.lastName || '').toLowerCase();
    const studentId = (s.studentId || '').toLowerCase();
    return firstName.includes(query) || lastName.includes(query) || studentId.includes(query) || `${firstName} ${lastName}`.includes(query);
  });

  if (user?.role === 'parent') {
    if (parentWards.length === 0) {
      return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
            ⚠️
          </div>
          <h3 className="text-lg font-black text-slate-800">No Registered Wards Found</h3>
          <p className="text-slate-500 text-sm">
            We couldn't locate any student database records where your name (<b>{user?.fullName}</b>) is listed as a guardian.
          </p>
          <p className="text-slate-400 text-xs">
            Please contact the school administrator to update the guardian name on your child's student profile.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Parent Welcome & Ward Selector */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 p-6 sm:p-8 rounded-2xl border border-slate-800 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-4 max-w-xl">
            <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider text-indigo-300">
              🔒 PARENT PORTAL
            </span>
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Academic Results Terminal
              </h2>
              <p className="text-indigo-200 text-sm font-medium">
                Welcome back! View subject grades, class assessments, and generate official terminal report cards for your wards.
              </p>
            </div>
            
            {/* Ward selector chips/pills */}
            {parentWards.length > 1 ? (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-wider block">Select Ward to View</label>
                <div className="flex flex-wrap gap-2">
                  {parentWards.map(ward => (
                    <button
                      key={ward.id || ward.studentId}
                      onClick={() => setSelectedWardId(ward.studentId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        selectedWardId === ward.studentId
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                          : 'bg-white/10 hover:bg-white/15 border-white/10 text-indigo-100'
                      }`}
                    >
                      👤 {ward.firstName} {ward.lastName} ({ward.class})
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              selectedWard && (
                <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono text-indigo-200">
                  <div className="bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                    Viewing Ward: <span className="text-white font-extrabold">{selectedWard.firstName} {selectedWard.lastName}</span>
                  </div>
                  <div className="bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                    Class: <span className="text-white font-extrabold">{selectedWard.class}</span>
                  </div>
                </div>
              )
            )}
          </div>
          
          <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none hidden md:block" />
        </div>

        {/* Filters and Term Selection Row */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Academic Term</label>
            <div className="flex gap-1.5">
              {['Term 1', 'Term 2', 'Term 3'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTerm(t)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    selectedTerm === t
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {selectedWard && (
            <button 
              onClick={() => openReport(selectedWard)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-extrabold flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-indigo-100 text-xs uppercase tracking-wider animate-pulse hover:animate-none"
            >
              <FileText className="w-4 h-4" />
              <span>Generate Official Report Card ({selectedWard.firstName})</span>
            </button>
          )}
        </div>

        {/* Results List for selected term */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
              Subject Grades — {selectedTerm}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider bg-slate-200/50 px-2.5 py-1 rounded-lg">
              {myResults.length} Subjects Evaluated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Class Score (30%)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Exam Score (70%)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Total (100%)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Grade</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myResults.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-indigo-950 uppercase tracking-wide text-xs">{res.subject}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-600 font-mono">
                      {res.classScore}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-600 font-mono">
                      {res.examScore}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-indigo-600 font-mono text-sm">
                      {res.totalScore}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                        res.totalScore >= 50 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {res.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 italic text-xs text-slate-500 font-medium">
                      {res.remarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myResults.length === 0 && (
              <div className="p-12 text-center text-slate-400 font-bold text-sm italic">
                No exam or class score records found for {selectedTerm} yet.
              </div>
            )}
          </div>
        </div>

        {/* Report Card Modal */}
        <AnimatePresence>
          {isReportModalOpen && selectedStudentForReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
                  <h3 className="font-bold text-slate-800">Terminal Report Preview</h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={triggerPrint}
                      className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 transition-all h-10 shadow-sm"
                    >
                      <Printer className="w-4 h-4 text-indigo-600" />
                      <span>Print</span>
                    </button>
                    <button 
                      onClick={handleExportPDF}
                      disabled={isExportingPDF}
                      className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 h-10"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{isExportingPDF ? '...' : 'PDF'}</span>
                    </button>
                    <button 
                      onClick={() => setIsReportModalOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex items-center justify-center">
                  <div id={`report-${selectedStudentForReport.studentId}`} className="shadow-2xl">
                    <ReportCard
                      student={selectedStudentForReport}
                      results={studentResults}
                      term={selectedTerm}
                      academicYear={academicConfig.academicYear}
                      schoolProfile={schoolProfile}
                      academicConfig={academicConfig}
                      termReport={{
                        studentId: selectedStudentForReport.studentId,
                        term: selectedTerm,
                        academicYear: academicConfig.academicYear,
                        attendancePresent: 68,
                        attendanceTotal: 70,
                        teacherRemark: 'Student has shown good progress this term. Keep working hard.',
                        headmasterRemark: 'A satisfactory result. Promoted.'
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (isStudent) {
    if (!studentRecord) {
      return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
            ⚠️
          </div>
          <h3 className="text-lg font-black text-slate-800">Student Profile Not Linked</h3>
          <p className="text-slate-500 text-sm">
            We couldn't locate a student database record matching your user account name (<b>{user?.fullName}</b>).
          </p>
          <p className="text-slate-400 text-xs">
            Please contact the school administrator to ensure your student profile has the exact same name as your login.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Student Welcome & Quick Actions Card */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 p-6 sm:p-8 rounded-2xl border border-slate-800 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-4 max-w-xl">
            <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider text-indigo-300">
              🔒 STUDENT PORTAL
            </span>
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Academic Results Terminal
              </h2>
              <p className="text-indigo-200 text-sm font-medium">
                Welcome back, <b>{studentRecord.firstName} {studentRecord.lastName}</b>! View your subject grades, class assessments, and generate your official terminal report card.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono text-indigo-200">
              <div className="bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                Class: <span className="text-white font-extrabold">{studentRecord.class}</span>
              </div>
              <div className="bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                Student ID: <span className="text-white font-extrabold">{studentRecord.studentId}</span>
              </div>
            </div>
          </div>
          
          <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none hidden md:block" />
        </div>

        {/* Filters and Term Selection Row */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Academic Term</label>
            <div className="flex gap-1.5">
              {['Term 1', 'Term 2', 'Term 3'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTerm(t)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    selectedTerm === t
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => openReport(studentRecord)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-extrabold flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-indigo-100 text-xs uppercase tracking-wider"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Official Report Card</span>
          </button>
        </div>

        {/* Results List for selected term */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">
              Subject Grades — {selectedTerm}
            </h3>
            <span className="text-[10px] font-mono text-slate-450 uppercase tracking-wider bg-slate-200/50 px-2.5 py-1 rounded-lg">
              {myResults.length} Subjects Evaluated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Class Score (30%)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Exam Score (70%)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Total (100%)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Grade</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myResults.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-indigo-950 uppercase tracking-wide text-xs">{res.subject}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-600 font-mono">
                      {res.classScore}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-600 font-mono">
                      {res.examScore}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-indigo-600 font-mono text-sm">
                      {res.totalScore}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                        res.totalScore >= 50 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {res.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 italic text-xs text-slate-500 font-medium">
                      {res.remarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myResults.length === 0 && (
              <div className="p-12 text-center text-slate-400 font-bold text-sm italic">
                No exam or class score records found for {selectedTerm} yet.
              </div>
            )}
          </div>
        </div>

        {/* Report Card Modal */}
        <AnimatePresence>
          {isReportModalOpen && selectedStudentForReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
                  <h3 className="font-bold text-slate-800">Terminal Report Preview</h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={triggerPrint}
                      className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 transition-all h-10 shadow-sm"
                    >
                      <Printer className="w-4 h-4 text-indigo-600" />
                      <span>Print</span>
                    </button>
                    <button 
                      onClick={handleExportPDF}
                      disabled={isExportingPDF}
                      className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 h-10"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{isExportingPDF ? '...' : 'PDF'}</span>
                    </button>
                    <button 
                      onClick={() => setIsReportModalOpen(false)}
                      className="p-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex items-center justify-center">
                  <div id={`report-${selectedStudentForReport.studentId}`} className="shadow-2xl">
                    <ReportCard
                      student={selectedStudentForReport}
                      results={studentResults}
                      term={selectedTerm}
                      academicYear={academicConfig.academicYear}
                      schoolProfile={schoolProfile}
                      academicConfig={academicConfig}
                      termReport={{
                        studentId: selectedStudentForReport.studentId,
                        term: selectedTerm,
                        academicYear: academicConfig.academicYear,
                        attendancePresent: 68,
                        attendanceTotal: 70,
                        teacherRemark: 'Student has shown good progress this term. Keep working hard.',
                        headmasterRemark: 'A satisfactory result. Promoted.'
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap items-end gap-4 sm:gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Class</label>
            <select 
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="block w-full lg:w-32 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none h-10"
            >
              {classes?.length ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option>P1</option>}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subject</label>
            <select 
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="block w-full lg:w-48 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none h-10"
            >
              {filteredSubjectsOptions?.length ? filteredSubjectsOptions.map(s => <option key={s.id} value={s.name}>{s.name}</option>) : <option>Mathematics</option>}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Term</label>
            <select 
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="block w-full lg:w-32 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none h-10"
            >
              {['Term 1', 'Term 2', 'Term 3'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="h-10 w-[1px] bg-slate-100 hidden lg:block self-center" />

          <div className="col-span-2 md:col-span-1 lg:flex-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Quick Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Student name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-10"
              />
            </div>
          </div>

          <div className="col-span-2 md:col-span-3 lg:w-auto flex flex-wrap items-center gap-2 sm:gap-3 lg:ml-auto">
            <input 
              type="file" 
              id="import-results-csv" 
              className="hidden" 
              accept=".csv, text/csv"
              onChange={importFromCsv}
            />
            <button 
              onClick={downloadTemplate}
              className="flex-1 lg:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all h-10 text-sm"
              title="Download CSV Results Template"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">CSV Template</span>
            </button>
            <button 
              onClick={() => document.getElementById('import-results-csv')?.click()}
              className="flex-1 lg:flex-none bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all h-10 text-sm"
              title="Import CSV Results File Only"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
            <button 
              onClick={handleBulkSave}
              disabled={isSaving}
              className="w-full lg:w-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 h-10 text-sm"
            >
              {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving...' : 'Save All'}</span>
            </button>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-2 font-medium"
        >
          <CheckCircle2 className="w-5 h-5" />
          Results saved successfully to the terminal!
        </motion.div>
      )}

      {/* Entry Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Class Score (30%)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Exam Score (70%)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Total (100%)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Grade</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Remarks</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents?.map((student) => {
                const score = scores[student.studentId] || { class: 0, exam: 0 };
                const total = score.class + score.exam;
                const { grade, remarks } = calculateGrade(total);

                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{student.firstName} {student.lastName}</div>
                      <div className="text-xs text-slate-400 font-mono">{student.studentId}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="number"
                        min="0"
                        max="30"
                        value={(score.class === undefined || score.class === null || score.class === 0) ? '' : score.class}
                        onChange={(e) => handleScoreChange(student.studentId, 'class', e.target.value)}
                        placeholder="0"
                        className="w-20 text-center px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold placeholder:text-slate-200"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="number"
                        min="0"
                        max="70"
                        value={(score.exam === undefined || score.exam === null || score.exam === 0) ? '' : score.exam}
                        onChange={(e) => handleScoreChange(student.studentId, 'exam', e.target.value)}
                        placeholder="0"
                        className="w-20 text-center px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold placeholder:text-slate-200"
                      />
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {total}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        total >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 italic text-sm text-slate-500">
                      {remarks}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => openReport(student)}
                        className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-all border border-transparent hover:border-slate-200"
                        title="View Report Card"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredStudents?.length && (
            <div className="p-12 text-center text-slate-400 font-medium">
              No students found in {selectedClass}
            </div>
          )}
        </div>
      </div>

      {/* Report Card Modal */}
      <AnimatePresence>
        {isReportModalOpen && selectedStudentForReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
                <h3 className="font-bold text-slate-800">Terminal Report Preview</h3>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={triggerPrint}
                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-50 transition-all h-10 shadow-sm"
                  >
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <span>Print</span>
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 transition-all disabled:opacity-50 h-10"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isExportingPDF ? '...' : 'PDF'}</span>
                  </button>
                  <button 
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex items-center justify-center">
                {/* Print area */}
                <div id={`report-${selectedStudentForReport.studentId}`} className="shadow-2xl">
                  <ReportCard
                    student={selectedStudentForReport}
                    results={studentResults}
                    term={selectedTerm}
                    academicYear={academicConfig.academicYear}
                    schoolProfile={schoolProfile}
                    academicConfig={academicConfig}
                    termReport={{
                      studentId: selectedStudentForReport.studentId,
                      term: selectedTerm,
                      academicYear: academicConfig.academicYear,
                      attendancePresent: 68,
                      attendanceTotal: 70,
                      teacherRemark: 'Student has shown good progress this term. Keep working hard.',
                      headmasterRemark: 'A satisfactory result. Promoted.'
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

