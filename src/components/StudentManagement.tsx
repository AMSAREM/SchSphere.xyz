import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student, useFeeTypes, type PromotionRecord } from '../db/schema';
import { Plus, Search, Filter, Download, MoreVertical, Edit2, Trash2, Users, FileSpreadsheet, Camera, User, Printer, Eye, CreditCard, TrendingUp, ArrowRight, Check, History, Undo2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, cn, triggerPrint, exportToPDF } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import * as XLSX from 'xlsx';
import React from 'react';

export default function StudentManagement() {
  const { user: currentUser } = useAuth();
  const { showToast, confirm } = useNotifications();
  const feeTypes = useFeeTypes();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'headteacher';
  const isTeacher = currentUser?.role === 'teacher';
  const isAccountant = currentUser?.role === 'accountant';

  const classes = useLiveQuery(() => db.classes.toArray());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [selectedProfileStudent, setSelectedProfileStudent] = useState<Student | null>(null);
  const [selectedPaymentStudent, setSelectedPaymentStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [lastPayment, setLastPayment] = useState<{ amount: number, date: number } | null>(null);

  // Student Promotion States
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [promoSourceClass, setPromoSourceClass] = useState<string>('');
  const [promoDestClass, setPromoDestClass] = useState<string>('');
  const [promoSelectedStudentIds, setPromoSelectedStudentIds] = useState<number[]>([]);
  const [promoResetFees, setPromoResetFees] = useState(true);
  const [promoApplyNewDefaults, setPromoApplyNewDefaults] = useState(true);
  const [promoRolloverYear, setPromoRolloverYear] = useState(false);
  const [promoNextYearVal, setPromoNextYearVal] = useState('');

  // Promotion Tab and Audits States
  const [activeTab, setActiveTab] = useState<'registry' | 'promotions'>('registry');
  const [promoSearchTerm, setPromoSearchTerm] = useState('');
  const [promoYearFilter, setPromoYearFilter] = useState('');

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0 || !selectedPaymentStudent || !selectedPaymentStudent.id) return;
    
    await db.students.update(selectedPaymentStudent.id, {
      feesPaid: (selectedPaymentStudent.feesPaid || 0) + amount
    });
    setLastPayment({ amount, date: Date.now() });
    setPaymentAmount('');
    setSelectedPaymentStudent(null);
    setIsReceiptModalOpen(true);
  };
  
  const allStudents = useLiveQuery(() => db.students.toArray());

  const promoSourceStudents = React.useMemo(() => {
    if (!allStudents || !promoSourceClass) return [];
    return allStudents.filter(s => s.class === promoSourceClass);
  }, [allStudents, promoSourceClass]);

  React.useEffect(() => {
    if (promoSourceStudents.length > 0) {
      const ids = promoSourceStudents.map(s => s.id).filter((id): id is number => id !== undefined);
      setPromoSelectedStudentIds(prev => {
        if (prev.length === ids.length && prev.every((v, i) => v === ids[i])) {
          return prev;
        }
        return ids;
      });
    } else {
      setPromoSelectedStudentIds(prev => {
        if (prev.length === 0) return prev;
        return [];
      });
    }
  }, [promoSourceStudents]);

  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolName = settings.find(s => s.key === 'schoolProfile')?.value?.schoolName || 'ESEPA INTERNATIONAL SCHOOL';
  const academicConfig = settings.find(s => s.key === 'academicConfig')?.value || { academicYear: '2025/2026', currentTerm: 'Term 1' };

  React.useEffect(() => {
    if (isPromotionModalOpen && settings.length > 0) {
      const config = settings.find(s => s.key === 'academicConfig')?.value || { academicYear: '2025/2026', currentTerm: 'Term 1' };
      const currentYear = config.academicYear || '2025/2026';
      
      const match = currentYear.match(/^(\d{4})\/(\d{4})$/);
      if (match) {
        setPromoNextYearVal(`${parseInt(match[1]) + 1}/${parseInt(match[2]) + 1}`);
      } else {
        const matchSingle = currentYear.match(/^(\d{4})$/);
        if (matchSingle) {
          setPromoNextYearVal(String(parseInt(matchSingle[1]) + 1));
        } else {
          setPromoNextYearVal(currentYear);
        }
      }
      setPromoRolloverYear(config.currentTerm === 'Term 3');
    }
  }, [isPromotionModalOpen, settings]);

  const handlePromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoSourceClass || !promoDestClass) {
      showToast("Please select both source and destination classes.", "error");
      return;
    }
    if (promoSourceClass === promoDestClass) {
      showToast("Source and destination classes cannot be the same.", "error");
      return;
    }
    if (promoSelectedStudentIds.length === 0) {
      showToast("Please select at least one student to promote.", "error");
      return;
    }

    try {
      let count = 0;
      for (const studentId of promoSelectedStudentIds) {
        const student = allStudents?.find(s => s.id === studentId);
        if (!student) continue;

        const updateData: Partial<Student> = {
          class: promoDestClass
        };

        if (promoResetFees) {
          updateData.feesPaid = 0;
          const resetPaidBreakdown: Record<string, number> = {};
          feeTypes.forEach(ft => {
            resetPaidBreakdown[ft.id] = 0;
          });
          updateData.feePaidBreakdown = resetPaidBreakdown;
        }

        if (promoApplyNewDefaults) {
          const initialBreakdown: Record<string, number> = {};
          feeTypes.forEach(ft => {
            initialBreakdown[ft.id] = ft.defaultAmount;
          });
          updateData.feeBreakdown = initialBreakdown;
          updateData.totalFees = Object.values(initialBreakdown).reduce((a, b) => a + b, 0);
        }

        // Record the promotion history for audit and complete reversibility
        await db.promotionHistory.add({
          studentId: studentId,
          studentIdentifier: student.studentId,
          studentName: `${student.firstName} ${student.lastName}`,
          sourceClass: student.class,
          destClass: promoDestClass,
          academicYear: academicConfig.academicYear || '2025/2026',
          term: academicConfig.currentTerm || 'Term 3',
          timestamp: Date.now(),
          previousFeesPaid: student.feesPaid || 0,
          previousTotalFees: student.totalFees || 0,
          previousFeeBreakdown: student.feeBreakdown,
          previousFeePaidBreakdown: student.feePaidBreakdown
        });

        await db.students.update(studentId, updateData);
        count++;
      }

      if (promoRolloverYear && promoNextYearVal) {
        const config = settings.find(s => s.key === 'academicConfig')?.value || { academicYear: '2025/2026', currentTerm: 'Term 1' };
        await db.settings.put({
          key: 'academicConfig',
          value: {
            ...config,
            academicYear: promoNextYearVal,
            currentTerm: 'Term 1'
          }
        });
        showToast(`School academic year updated to ${promoNextYearVal} (Term 1)`, "info");
      }

      showToast(`Successfully promoted ${count} students to ${promoDestClass}!`, "success");
      setIsPromotionModalOpen(false);
      setPromoSourceClass('');
      setPromoDestClass('');
      setPromoSelectedStudentIds([]);
    } catch (err) {
      showToast("Failed to promote students.", "error");
      console.error(err);
    }
  };

  const promotionHistory = useLiveQuery(() => db.promotionHistory.toArray()) || [];

  const handleRevertPromotion = async (record: PromotionRecord) => {
    if (!record.id) return;
    
    confirm({
      title: "Revert Student Promotion",
      message: `Are you sure you want to revert the promotion of ${record.studentName}? This will move them back to "${record.sourceClass}" and restore their previous fee status of ${formatCurrency(record.previousFeesPaid)} paid out of ${formatCurrency(record.previousTotalFees)}.`,
      confirmLabel: "Revert Promotion",
      onConfirm: async () => {
        try {
          const student = await db.students.get(record.studentId);
          if (!student) {
            showToast("Student not found. They may have been deleted.", "error");
            return;
          }

          // Fully restore the student parameters
          await db.students.update(record.studentId, {
            class: record.sourceClass,
            feesPaid: record.previousFeesPaid,
            totalFees: record.previousTotalFees,
            feeBreakdown: record.previousFeeBreakdown,
            feePaidBreakdown: record.previousFeePaidBreakdown
          });

          // Delete the log entry
          await db.promotionHistory.delete(record.id!);
          showToast(`Successfully reverted promotion for ${record.studentName}!`, "success");
        } catch (err) {
          console.error(err);
          showToast("Failed to revert promotion.", "error");
        }
      }
    });
  };

  const filteredStudents = React.useMemo(() => {
    if (!allStudents) return [];
    return allStudents.filter(s => {
      const matchesSearch = 
        s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = !activeFilter || s.class === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [allStudents, searchTerm, activeFilter]);

  const filteredPromoHistory = React.useMemo(() => {
    if (!promotionHistory) return [];
    return promotionHistory.filter(record => {
      const matchesSearch = 
        record.studentName.toLowerCase().includes(promoSearchTerm.toLowerCase()) ||
        record.studentIdentifier.toLowerCase().includes(promoSearchTerm.toLowerCase()) ||
        record.sourceClass.toLowerCase().includes(promoSearchTerm.toLowerCase()) ||
        record.destClass.toLowerCase().includes(promoSearchTerm.toLowerCase());
      
      const matchesYear = promoYearFilter ? record.academicYear === promoYearFilter : true;
      return matchesSearch && matchesYear;
    }).sort((a, b) => b.timestamp - a.timestamp); // Sort by newest transition first
  }, [promotionHistory, promoSearchTerm, promoYearFilter]);

  const uniquePromoYears = React.useMemo(() => {
    if (!promotionHistory) return [];
    const years = promotionHistory.map(r => r.academicYear).filter(Boolean);
    return Array.from(new Set(years));
  }, [promotionHistory]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(allStudents || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "Student_List.xlsx");
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        firstName: 'Kojo',
        lastName: 'Mensah',
        class: 'P1',
        dateOfBirth: '2016-05-15',
        gender: 'Male',
        guardianName: 'Ama Mensah',
        guardianPhone: '0240000000',
        totalFees: 1200
      },
      {
        firstName: 'Akosua',
        lastName: 'Adu',
        class: 'JHS 1',
        dateOfBirth: '2012-08-20',
        gender: 'Female',
        guardianName: 'Kofi Adu',
        guardianPhone: '0270000000',
        totalFees: 2500
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student_Template");
    XLSX.writeFile(wb, "Student_Import_Template.xlsx");
  };

  const importFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const newStudents: Student[] = data.map(item => ({
        studentId: item.studentId || `STU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`,
        firstName: item.firstName || '',
        lastName: item.lastName || '',
        class: item.class || 'P1',
        dateOfBirth: item.dateOfBirth || '',
        gender: (item.gender === 'Female' ? 'Female' : 'Male'),
        guardianName: item.guardianName || '',
        guardianPhone: String(item.guardianPhone || ''),
        house: item.house || '',
        department: item.department || '',
        feesPaid: Number(item.feesPaid || 0),
        totalFees: Number(item.totalFees || 0),
        createdAt: Date.now()
      }));

      await db.students.bulkAdd(newStudents);
      showToast(`${newStudents.length} students imported successfully!`, "success");
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [feeInputs, setFeeInputs] = useState<Record<string, number>>({});
  const [modalFeesPaid, setModalFeesPaid] = useState<number>(0);

  React.useEffect(() => {
    if (isAddModalOpen) {
      const initial: Record<string, number> = {};
      feeTypes.forEach(ft => {
        initial[ft.id] = editingStudent 
          ? (editingStudent.feeBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? editingStudent.totalFees : 0))
          : ft.defaultAmount;
      });
      setFeeInputs(initial);
      setModalFeesPaid(editingStudent ? (editingStudent.feesPaid || 0) : 0);
    } else {
      setFeeInputs({});
      setModalFeesPaid(0);
    }
  }, [isAddModalOpen, editingStudent, feeTypes]);

  const computedTotalFees = React.useMemo(() => {
    return Object.values(feeInputs).reduce((a: number, b: number) => a + Number(b || 0), 0);
  }, [feeInputs]);

  const computedBalance = React.useMemo(() => {
    return Math.max(0, computedTotalFees - modalFeesPaid);
  }, [computedTotalFees, modalFeesPaid]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setPhotoPreview(student.photo || null);
    setModalFeesPaid(student.feesPaid || 0);
    setIsAddModalOpen(true);
  };

  const handleStudentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentData = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      class: formData.get('class') as string,
      dateOfBirth: formData.get('dob') as string,
      gender: formData.get('gender') as 'Male' | 'Female',
      guardianName: formData.get('guardianName') as string,
      guardianPhone: formData.get('guardianPhone') as string,
      house: formData.get('house') as string,
      department: formData.get('department') as string,
      totalFees: computedTotalFees,
      feesPaid: modalFeesPaid,
      feeBreakdown: feeInputs,
      photo: photoPreview || undefined
    };

    if (editingStudent) {
      await db.students.update(editingStudent.id!, studentData);
    } else {
      const initialPaidBreakdown: Record<string, number> = {};
      feeTypes.forEach(ft => {
        initialPaidBreakdown[ft.id] = ft.id === 'tuition' ? modalFeesPaid : 0;
      });
      const student: Student = {
        ...studentData,
        feePaidBreakdown: initialPaidBreakdown,
        studentId: `STU-${Date.now().toString().slice(-6)}`,
        createdAt: Date.now()
      };
      await db.students.add(student);
    }
    
    setIsAddModalOpen(false);
    setEditingStudent(null);
    setPhotoPreview(null);
  };

  const deleteStudent = async (id?: number) => {
    if (!id) return;
    confirm({
      title: "Delete Student",
      message: "Are you sure you want to delete this student? All their records will be removed from the local database.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await db.students.delete(id);
          showToast("Student deleted successfully!", "success");
        } catch (err) {
          showToast("Failed to delete student", "error");
        }
      }
    });
  };

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Print Only Header */}
      <div className="only-print">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolName}</h1>
        <div className="mt-2 text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-4">
          <span>Official Student Enrollment Record</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>{activeFilter || 'All Classes'}</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>Generated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 print:hidden pb-1 gap-2">
        <button
          onClick={() => setActiveTab('registry')}
          className={cn(
            "px-5 py-3 font-bold text-sm border-b-2 transition-all relative top-[2px] flex items-center gap-2 cursor-pointer",
            activeTab === 'registry' 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Active Students Registry</span>
        </button>
        <button
          onClick={() => setActiveTab('promotions')}
          className={cn(
            "px-5 py-3 font-bold text-sm border-b-2 transition-all relative top-[2px] flex items-center gap-2 cursor-pointer",
            activeTab === 'promotions' 
              ? "border-indigo-600 text-indigo-600" 
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <History className="w-4 h-4" />
          <span>Promotion History & Audits</span>
          {promotionHistory.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
              {promotionHistory.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'registry' && (
        <>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search students..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border rounded-xl font-medium transition-all text-sm h-10 sm:h-11",
                activeFilter ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <Filter className="w-4 h-4" />
              <span>{activeFilter || 'Filter'}</span>
            </button>
            
            <AnimatePresence>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsFilterOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden"
                  >
                    <div className="p-2 space-y-1">
                      <button 
                        onClick={() => {
                          setActiveFilter(null);
                          setIsFilterOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 font-medium"
                      >
                        All Classes
                      </button>
                      {classes?.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => {
                            setActiveFilter(c.name);
                            setIsFilterOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm rounded-lg font-medium",
                            activeFilter === c.name ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-50"
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm h-11"
                  title="Download Template"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">Template</span>
                </button>
                <input 
                  type="file" 
                  id="import-excel" 
                  className="hidden" 
                  accept=".xlsx, .xls"
                  onChange={importFromExcel}
                />
                <button 
                  onClick={() => document.getElementById('import-excel')?.click()}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm h-11"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Import</span>
                </button>
              </>
            )}
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm h-11"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button 
              onClick={triggerPrint}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors text-sm h-11"
              title="Print List"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              <button 
                onClick={() => setIsPromotionModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm h-11 text-sm"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Promote Students</span>
              </button>
              <button 
                onClick={() => {
                  setEditingStudent(null);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm h-11 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Student</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guardian</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fees Paid/Total</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fees Balance</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider print:hidden text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents?.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      {student.studentId}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                        {student.photo ? (
                          <img src={student.photo} alt={`${student.firstName}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-600 font-bold">
                            {student.firstName[0]}{student.lastName[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{student.firstName} {student.lastName}</div>
                        <div className="text-xs text-slate-400">{student.gender}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                    {student.class}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{student.guardianName}</div>
                    <div className="text-xs text-slate-500">{student.guardianPhone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            (student.feesPaid / student.totalFees) >= 1 ? "bg-emerald-500" : "bg-amber-500"
                          )}
                          style={{ width: `${(student.feesPaid / student.totalFees) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {formatCurrency(student.feesPaid)} / {formatCurrency(student.totalFees)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-xs font-black px-2.5 py-1 rounded-md tracking-tight inline-block",
                      student.totalFees - student.feesPaid > 0 
                        ? "text-rose-700 bg-rose-50 border border-rose-100/60" 
                        : "text-emerald-700 bg-emerald-50 border border-emerald-100/60"
                    )}>
                      {formatCurrency(student.totalFees - student.feesPaid)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right print:hidden">
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin ? (
                        <>
                          <button 
                            onClick={() => openEditModal(student)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                            title="Edit Student"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteStudent(student.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                            title="Delete Student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => setSelectedProfileStudent(student)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                            title="View Student Profile"
                          >
                            <Eye className="w-4 h-4 text-indigo-500" />
                            <span className="hidden md:inline">Profile</span>
                          </button>
                          {isAccountant && (
                            <button 
                              onClick={() => setSelectedPaymentStudent(student)}
                              className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                              title="Quick Fee Payment"
                            >
                              <CreditCard className="w-4 h-4 text-emerald-500" />
                              <span className="hidden md:inline">Fee Pay</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="w-12 h-12 text-slate-200" />
                      <p className="font-medium">No students found. Add your first student to get started!</p>
                      <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="mt-2 text-indigo-600 font-bold hover:underline"
                      >
                        Add Student
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {activeTab === 'promotions' && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <span>Student Promotion Audit Trail</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
                Review historical student transitions across academic classes and years. 
                Admins can revert any promotion record to return students to their source class and restore their exact previous fee payment snapshot.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsPromotionModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm text-xs shrink-0 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Promote Students</span>
              </button>
            )}
          </div>

          {/* Audit Search & Filter controls */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search by student name, identifier, source or destination class..."
                value={promoSearchTerm}
                onChange={(e) => setPromoSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
              />
            </div>
            
            <div className="flex gap-2">
              <select 
                value={promoYearFilter}
                onChange={(e) => setPromoYearFilter(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-600 outline-none hover:bg-slate-50 cursor-pointer"
              >
                <option value="">All Academic Years</option>
                {uniquePromoYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {(promoSearchTerm || promoYearFilter) && (
                <button
                  onClick={() => {
                    setPromoSearchTerm('');
                    setPromoYearFilter('');
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Promotion Records Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Transition</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Academic Period</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Promoted On</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPromoHistory.map((record) => {
                    const formattedDate = new Date(record.timestamp).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                            {record.studentIdentifier}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{record.studentName}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/50">
                              {record.sourceClass}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                              {record.destClass}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-slate-600">{record.academicYear}</div>
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{record.term}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-500 font-medium">{formattedDate}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isAdmin ? (
                            <button
                              onClick={() => handleRevertPromotion(record)}
                              className="px-3 py-1.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-50 flex items-center gap-1.5 ml-auto cursor-pointer"
                              title="Revert this promotion transition"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              <span>Revert Promotion</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium italic">Reversible by Admin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPromoHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <History className="w-12 h-12 text-slate-200" />
                          <p className="font-bold text-slate-600">No promotion transitions found</p>
                          <p className="text-xs text-slate-400 max-w-sm">
                            {promoSearchTerm || promoYearFilter 
                              ? "Try widening your search terms or clearing filters to locate previous records."
                              : "Transitions performed using the 'Promote Students' wizard will log full rollback backups here."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-slate-900">
                {editingStudent ? 'Edit Student Details' : 'New Student Registration'}
              </h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                  setPhotoPreview(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                id="close-modal"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleStudentSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center gap-4 py-6 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-white border-4 border-white shadow-md flex items-center justify-center relative">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-16 h-16 text-slate-200" />
                    )}
                    <label 
                      htmlFor="photo-upload"
                      className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Camera className="w-8 h-8 text-white" />
                    </label>
                  </div>
                  <input 
                    type="file" 
                    id="photo-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handlePhotoChange}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">Student Profile Picture</p>
                  <p className="text-xs text-slate-500">JPG or PNG (max 1MB recommended)</p>
                </div>
              </div>

              {/* Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Personal Information</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">First Name</label>
                    <input required name="firstName" defaultValue={editingStudent?.firstName} className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Last Name</label>
                    <input required name="lastName" defaultValue={editingStudent?.lastName} className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Gender</label>
                    <div className="flex gap-4 p-2 bg-slate-50/50 border border-slate-200 rounded-xl">
                      <label className="flex-1 flex items-center justify-center gap-2 py-1 px-3 rounded-lg hover:bg-white transition-all cursor-pointer accent-indigo-600 font-medium text-sm">
                        <input type="radio" name="gender" value="Male" defaultChecked={editingStudent?.gender !== 'Female'} /> Male
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 py-1 px-3 rounded-lg hover:bg-white transition-all cursor-pointer accent-indigo-600 font-medium text-sm">
                        <input type="radio" name="gender" value="Female" defaultChecked={editingStudent?.gender === 'Female'} /> Female
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Date of Birth</label>
                    <input required type="date" name="dob" defaultValue={editingStudent?.dateOfBirth} className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Guardian Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Parent / Guardian Information</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian Name</label>
                    <input required name="guardianName" defaultValue={editingStudent?.guardianName} className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian Phone</label>
                    <input required name="guardianPhone" defaultValue={editingStudent?.guardianPhone} placeholder="024XXXXXXX" className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Academic & Financial */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Academic & School Info</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Assigned Class</label>
                    <select name="class" defaultValue={editingStudent?.class} className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm">
                      {classes?.length ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option>P1</option>}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">House / Hostel</label>
                    <input name="house" defaultValue={editingStudent?.house} placeholder="e.g. Blue House" className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Department</label>
                    <input name="department" defaultValue={editingStudent?.department} placeholder="e.g. General Arts" className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all shadow-sm" />
                  </div>
                  <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        Billing Breakdown by Fee Type
                      </h5>
                      <button 
                        type="button"
                        onClick={() => {
                          const resetVals: Record<string, number> = {};
                          feeTypes.forEach(ft => {
                            resetVals[ft.id] = ft.defaultAmount;
                          });
                          setFeeInputs(resetVals);
                        }}
                        className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50">
                      {feeTypes.map(ft => {
                        const amount = feeInputs[ft.id] ?? 0;
                        return (
                          <div key={ft.id} className="space-y-1 bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">
                              {ft.label}
                            </label>
                            <input 
                              type="number"
                              value={amount || ''}
                              placeholder="0"
                              min="0"
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setFeeInputs(prev => ({ ...prev, [ft.id]: val }));
                              }}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition-all text-xs font-bold text-slate-800"
                            />
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Live Fees Paid Input Field */}
                    <div className="space-y-1.5 p-4 bg-slate-50/60 border border-slate-200 rounded-2xl">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        Amount Paid So Far
                      </label>
                      <input 
                        type="number"
                        value={modalFeesPaid || ''}
                        placeholder="Enter amount paid (e.g. 500)"
                        min="0"
                        max={computedTotalFees}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setModalFeesPaid(val);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-sm font-bold text-slate-800"
                      />
                      <p className="text-[10px] text-slate-400 font-bold">
                        Specify if the student has made any initial payments towards their total fees.
                      </p>
                    </div>

                    {/* Live Fees Balance & Pricing Summary Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-indigo-600 text-white rounded-2xl shadow-md">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">Total Fees (Billed)</span>
                        <span className="text-lg font-black">{formatCurrency(computedTotalFees)}</span>
                      </div>
                      <div className="space-y-0.5 border-t border-indigo-500/40 pt-2 md:pt-0 md:border-t-0 md:border-l md:border-indigo-55 md:pl-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">Total Paid</span>
                        <span className="text-lg font-black text-emerald-300">{formatCurrency(modalFeesPaid)}</span>
                      </div>
                      <div className="space-y-0.5 border-t border-indigo-500/40 pt-2 md:pt-0 md:border-t-0 md:border-l md:border-indigo-55 md:pl-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">Fees Balance (Due)</span>
                        <span className={cn(
                          "text-lg font-black",
                          computedBalance > 0 ? "text-rose-300" : "text-emerald-300"
                        )}>{formatCurrency(computedBalance)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-slate-100 flex gap-4 shrink-0">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingStudent(null);
                    setPhotoPreview(null);
                  }}
                  className="flex-1 py-3 px-6 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-indigo-100"
                >
                  {editingStudent ? 'Update Details' : 'Register Student'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Student Biodata & Profile Modal for Teachers & Accountants */}
      <AnimatePresence>
        {selectedProfileStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Profile Header */}
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden border-2 border-white/20">
                    {selectedProfileStudent.photo ? (
                      <img src={selectedProfileStudent.photo} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-indigo-200" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedProfileStudent.firstName} {selectedProfileStudent.lastName}</h3>
                    <p className="text-xs text-indigo-200 font-mono tracking-wider">{selectedProfileStudent.studentId}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProfileStudent(null)}
                  className="p-1 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Profile Details */}
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Class Room</span>
                    <p className="text-base font-bold text-slate-800">{selectedProfileStudent.class}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Gender</span>
                    <p className="text-base font-bold text-slate-800">{selectedProfileStudent.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Date of Birth</span>
                    <p className="text-base font-bold text-slate-800">{selectedProfileStudent.dateOfBirth || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">House Designation</span>
                    <p className="text-base font-bold text-slate-800">{selectedProfileStudent.house || 'None'}</p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Parental Contacts</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Guardian Name</span>
                      <p className="text-base font-bold text-slate-800">{selectedProfileStudent.guardianName}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Contact Handset</span>
                      <p className="text-base font-bold text-indigo-600 font-mono">{selectedProfileStudent.guardianPhone}</p>
                    </div>
                  </div>
                </div>

                 <div className="border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Financial Overview</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Billed Amount</span>
                      <p className="text-sm font-bold text-slate-800 mt-1">{formatCurrency(selectedProfileStudent.totalFees)}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Paid</span>
                      <p className="text-sm font-bold text-emerald-700 mt-1">{formatCurrency(selectedProfileStudent.feesPaid)}</p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl",
                      selectedProfileStudent.totalFees - selectedProfileStudent.feesPaid > 0 ? "bg-rose-50" : "bg-emerald-50"
                    )}>
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        selectedProfileStudent.totalFees - selectedProfileStudent.feesPaid > 0 ? "text-rose-600" : "text-emerald-600"
                      )}>Outstanding</span>
                      <p className={cn(
                        "text-sm font-bold mt-1",
                        selectedProfileStudent.totalFees - selectedProfileStudent.feesPaid > 0 ? "text-rose-700" : "text-emerald-700"
                      )}>{formatCurrency(selectedProfileStudent.totalFees - selectedProfileStudent.feesPaid)}</p>
                    </div>
                  </div>

                  <div className="mt-4 border border-slate-150 rounded-xl overflow-hidden bg-slate-50/50 p-4">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-3 tracking-wider">Itemized Bill Breakdown</p>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {feeTypes.map(ft => {
                        const amount = selectedProfileStudent.feeBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedProfileStudent.totalFees : 0);
                        if (amount === 0) return null;
                        return (
                          <div key={ft.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0">
                            <span className="text-slate-600 font-medium">{ft.label}</span>
                            <span className="font-bold text-slate-800 font-mono">{formatCurrency(amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Payment Entry Modal for Accountants */}
      <AnimatePresence>
        {selectedPaymentStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Process Fee Payment</h3>
                  <p className="text-xs text-slate-500">{selectedPaymentStudent.firstName} {selectedPaymentStudent.lastName}</p>
                </div>
                <button 
                  onClick={() => setSelectedPaymentStudent(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleQuickPayment} className="p-6 space-y-4">
                <div className="p-4 bg-indigo-50/50 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Pending Balance</span>
                    <p className="text-lg font-black text-slate-800 mt-0.5">
                      {formatCurrency(selectedPaymentStudent.totalFees - selectedPaymentStudent.feesPaid)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Billed</span>
                    <p className="text-sm font-bold text-slate-600">{formatCurrency(selectedPaymentStudent.totalFees)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Payment Amount (GHS)</label>
                  <input 
                    type="number" 
                    required 
                    min="1"
                    placeholder="e.g. 500" 
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-lg text-slate-800"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Receive Payment</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Friendly Receipt Modal */}
      <AnimatePresence>
        {isReceiptModalOpen && lastPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col print:shadow-none print:rounded-none"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
                <span className="font-bold text-slate-800">Payment Invoice Receipt</span>
                <button 
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Printable Area */}
              <div id="quick-receipt-content" className="p-8 space-y-6">
                <div className="text-center space-y-1">
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{schoolName}</h1>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Official Fee Receipt</p>
                </div>

                <div className="border-t border-b border-dashed border-slate-200 py-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Receipt Date:</span>
                    <span className="text-slate-700 font-bold">{new Date(lastPayment.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-semibold">Transaction ID:</span>
                    <span className="text-slate-700 font-mono font-bold">TXN{Math.floor(lastPayment.date / 1000)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Payment Allocation</p>
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Amount Paid:</span>
                      <span className="text-emerald-600 font-black">{formatCurrency(lastPayment.amount)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
                  Thank you for your prompt payment.<br/>For inquiries contact treasury administration office.
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 print:hidden">
                <button 
                  onClick={() => exportToPDF('quick-receipt-content', 'Receipt_SchoolSphere')}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF Receipt
                </button>
                <button 
                  onClick={() => triggerPrint()}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Promotion Modal */}
      <AnimatePresence>
        {isPromotionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Promote Students to Next Class</h3>
                    <p className="text-xs text-slate-500 font-medium">Batch move students and configure new term fees</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsPromotionModalOpen(false);
                    setPromoSourceClass('');
                    setPromoDestClass('');
                    setPromoSelectedStudentIds([]);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handlePromotionSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Academic Year Timing Alert */}
                {academicConfig.currentTerm !== 'Term 3' ? (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex gap-3">
                    <span className="text-xl">⚠️</span>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-amber-900 leading-snug">
                        Early Academic Year Promotion Notice
                      </p>
                      <p className="text-xs text-amber-700 font-medium leading-relaxed">
                        Promotion is designed for the end of the academic year (typically <strong>Term 3</strong>). 
                        The current active school period is configured as <strong>{academicConfig.currentTerm}</strong> of the <strong>{academicConfig.academicYear || '2025/2026'}</strong> academic year.
                        Please verify that you intend to promote students mid-session.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex gap-3">
                    <span className="text-xl">🎓</span>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-emerald-950 leading-snug">
                        End of Academic Year Reached ({academicConfig.academicYear})
                      </p>
                      <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                        You are performing end-of-year student promotions. This batch operation moves students to their next class registers and prepares their bills for the upcoming academic year.
                      </p>
                    </div>
                  </div>
                )}

                {/* Class Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Source Class (Current)</label>
                    <select 
                      required
                      value={promoSourceClass}
                      onChange={e => setPromoSourceClass(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-bold text-slate-700"
                    >
                      <option value="">-- Select Class --</option>
                      {classes?.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Destination Class (Next)</label>
                    <select 
                      required
                      value={promoDestClass}
                      onChange={e => setPromoDestClass(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-bold text-slate-700"
                    >
                      <option value="">-- Select Class --</option>
                      {classes?.map(c => (
                        <option key={c.id} value={c.name} disabled={c.name === promoSourceClass}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Promotion Configurations */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Promotion & Year Configurations</p>
                  
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={promoResetFees}
                      onChange={e => setPromoResetFees(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mt-0.5 accent-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-700 leading-none">Reset Fees Paid to GHS 0.00</p>
                      <p className="text-xs text-slate-500 mt-1">Clears previous term fee payments to start fresh in the new class.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={promoApplyNewDefaults}
                      onChange={e => setPromoApplyNewDefaults(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mt-0.5 accent-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-700 leading-none">Apply Default Fees of Destination Class</p>
                      <p className="text-xs text-slate-500 mt-1">Recalculates student bills automatically based on active default fee configurations of the new class.</p>
                    </div>
                  </label>

                  <div className="pt-2 border-t border-slate-200/60 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={promoRolloverYear}
                        onChange={e => setPromoRolloverYear(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mt-0.5 accent-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-700 leading-none">Roll over School Academic Year</p>
                        <p className="text-xs text-slate-500 mt-1">Increment the school's global calendar year and set current term back to Term 1.</p>
                      </div>
                    </label>

                    {promoRolloverYear && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pl-7 space-y-2"
                      >
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">New Academic Year Period</label>
                        <input 
                          type="text"
                          required={promoRolloverYear}
                          placeholder="e.g. 2026/2027"
                          value={promoNextYearVal}
                          onChange={e => setPromoNextYearVal(e.target.value)}
                          className="w-full max-w-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-600 text-sm font-bold text-slate-700"
                        />
                        <p className="text-[10px] text-slate-400 font-medium">This will automatically transition active terminals, report cards, and logs to Term 1 of the new academic period.</p>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Selected Students List */}
                {promoSourceClass ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Students in {promoSourceClass} ({promoSourceStudents.length})
                      </label>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setPromoSelectedStudentIds(promoSourceStudents.map(s => s.id).filter((id): id is number => id !== undefined))}
                          className="text-[10px] font-bold text-indigo-600 hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-[10px] text-slate-300 font-bold">|</span>
                        <button 
                          type="button"
                          onClick={() => setPromoSelectedStudentIds([])}
                          className="text-[10px] font-bold text-rose-500 hover:underline"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {promoSourceStudents.length > 0 ? (
                      <div className="max-h-[180px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-white">
                        {promoSourceStudents.map(student => {
                          const isSelected = promoSelectedStudentIds.includes(student.id!);
                          return (
                            <label 
                              key={student.id} 
                              className="flex items-center justify-between p-3 hover:bg-slate-50/50 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setPromoSelectedStudentIds(promoSelectedStudentIds.filter(id => id !== student.id));
                                    } else {
                                      setPromoSelectedStudentIds([...promoSelectedStudentIds, student.id!]);
                                    }
                                  }}
                                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 accent-emerald-600"
                                />
                                <span className="text-sm font-bold text-slate-700">
                                  {student.firstName} {student.lastName}
                                </span>
                              </div>
                              <span className="font-mono text-xs text-slate-400 font-medium">
                                {student.studentId}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-xs text-slate-400 py-6 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No students found registered in {promoSourceClass}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-500">Select a source class to view and choose students for promotion</p>
                  </div>
                )}

                {/* Form Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsPromotionModalOpen(false);
                      setPromoSourceClass('');
                      setPromoDestClass('');
                      setPromoSelectedStudentIds([]);
                    }}
                    className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!promoSourceClass || !promoDestClass || promoSelectedStudentIds.length === 0}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Promote Selected</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
