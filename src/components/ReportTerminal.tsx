import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Student, type Result, type TermReport } from '../db/schema';
import { 
  FileText, 
  Download, 
  Search, 
  ChevronRight, 
  Users, 
  BookOpen, 
  BarChart3, 
  Layers, 
  FileDown, 
  Printer,
  Wallet,
  AlertTriangle,
  TrendingUp,
  Percent,
  Coins,
  ShieldCheck,
  UserCheck,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, exportToPDF, exportBatchToPDF, triggerPrint, formatCurrency } from '../lib/utils';
import * as XLSX from 'xlsx';
import { ReportCard } from './ReportCard';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ReportType = 'class-summary' | 'terminal-report' | 'batch-reports' | 'fee-collection' | 'debtor-list' | 'class-financials';

export default function ReportTerminal() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const isAccountant = user?.role === 'accountant';

  const [activeReport, setActiveReport] = useState<ReportType>(() => {
    return isAccountant ? 'fee-collection' : 'class-summary';
  });

  const [selectedClass, setSelectedClass] = useState(() => {
    return localStorage.getItem('esepa_selected_class') || 'P1';
  });
  
  const [selectedTerm, setSelectedTerm] = useState(() => {
    return localStorage.getItem('esepa_selected_term') || 'Term 1';
  });

  // Switch report default when role is determined
  useEffect(() => {
    if (isAccountant) {
      setActiveReport('fee-collection');
    } else {
      setActiveReport('class-summary');
    }
  }, [isAccountant]);

  useEffect(() => {
    localStorage.setItem('esepa_active_report', activeReport);
  }, [activeReport]);

  useEffect(() => {
    localStorage.setItem('esepa_selected_class', selectedClass);
  }, [selectedClass]);

  useEffect(() => {
    localStorage.setItem('esepa_selected_term', selectedTerm);
  }, [selectedTerm]);

  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedBillStudent, setSelectedBillStudent] = useState<Student | null>(null);

  const classesFromDB = useLiveQuery(() => db.classes.toArray()) || [];
  const students = useLiveQuery(() => db.students.toArray()) || [];

  const classes = useMemo(() => {
    const fromDB = classesFromDB.map(c => c.name);
    const fromStudents = students.map(s => s.class);
    const list = Array.from(new Set([...fromDB, ...fromStudents])).filter(Boolean).sort();
    return list.map((name, idx) => ({ id: idx, name }));
  }, [classesFromDB, students]);

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

  useEffect(() => {
    if (academicConfig) {
      setAcademicYear(academicConfig.academicYear);
      if (!localStorage.getItem('esepa_selected_term')) {
        setSelectedTerm(academicConfig.currentTerm);
      }
    }
  }, [academicConfig]);

  useEffect(() => {
    if (classes.length > 0 && !classes.find(c => c.name === selectedClass)) {
      setSelectedClass(classes[0].name);
    }
  }, [classes, selectedClass]);
  
  const classResults = useLiveQuery(
    () => db.results.where('class').equals(selectedClass).and(r => r.term === selectedTerm).toArray(),
    [selectedClass, selectedTerm]
  ) || [];

  const classStudents = useMemo(() => {
    const studentIdsWithResults = new Set(classResults.map(r => r.studentId));
    return students.filter(s => 
      s.class === selectedClass || 
      studentIdsWithResults.has(s.studentId) ||
      (s.previousClasses && s.previousClasses.includes(selectedClass)) ||
      (s.classHistory && s.classHistory.some(h => h.class === selectedClass))
    );
  }, [students, selectedClass, classResults]);

  const termReports = useLiveQuery(
    () => db.termReports.where('term').equals(selectedTerm).toArray(),
    [selectedTerm]
  ) || [];

  // Calculate academic rankings
  const studentRankings = useMemo(() => {
    if (!classStudents || !classResults) return {};
    
    const totals = classStudents.map(student => {
      const studentResults = classResults.filter(r => r.studentId === student.studentId);
      const total = studentResults.reduce((acc, r) => acc + r.totalScore, 0);
      return { studentId: student.studentId, total };
    });

    totals.sort((a, b) => b.total - a.total);
    
    const rankings: Record<string, { position: number, total: number }> = {};
    totals.forEach((item, index) => {
      rankings[item.studentId] = { 
        position: index + 1, 
        total: item.total 
      };
    });
    
    return rankings;
  }, [classStudents, classResults]);

  const selectedStudent = useMemo(() => {
    return students?.find(s => s.studentId === selectedStudentId);
  }, [students, selectedStudentId]);

  // Export Academic Summary
  const exportClassSummary = () => {
    if (!classStudents.length || !subjects.length) {
      showToast('Missing data for export. Please ensure students and subjects are loaded.', 'error');
      return;
    }

    const data = classStudents.map(student => {
      const row: any = {
        'Student ID': student.studentId,
        'Name': `${student.firstName} ${student.lastName}`
      };
      
      let totalValue = 0;
      subjects.forEach(sub => {
        const result = classResults.find(r => r.studentId === student.studentId && r.subject === sub.name);
        row[sub.name] = result ? result.totalScore : '-';
        if (result) totalValue += result.totalScore;
      });
      
      row['Total'] = totalValue;
      row['Position'] = studentRankings[student.studentId]?.position || '-';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Class Summary");
    XLSX.writeFile(wb, `${selectedClass}_${selectedTerm}_Summary.xlsx`);
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  const handleExportPDF = async (elementId: string, filename: string) => {
    setIsExportingPDF(true);
    try {
      await exportToPDF(elementId, filename);
    } catch (err) {
      showToast('Failed to export PDF report card.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleBatchPDF = async () => {
    if (!classStudents.length) return;
    setIsExportingPDF(true);
    try {
      const ids = classStudents.map(s => `report-${s.studentId}`);
      await exportBatchToPDF(ids, `${selectedClass}_${selectedTerm}_Batch_Reports`);
    } catch (err) {
      showToast('Failed to export batch PDF of class reports.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // --- Accountant Stats & Data Calculations ---
  const totalFinancials = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    students.forEach(s => {
      totalBilled += s.totalFees || 0;
      totalPaid += s.feesPaid || 0;
    });
    const totalRemaining = Math.max(0, totalBilled - totalPaid);
    const collectionProgress = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
    return {
      totalBilled,
      totalPaid,
      totalRemaining,
      collectionProgress
    };
  }, [students]);

  const classFinancials = useMemo(() => {
    const map: Record<string, { className: string; studentsCount: number; billed: number; paid: number; remaining: number }> = {};
    
    classes.forEach(c => {
      map[c.name] = { className: c.name, studentsCount: 0, billed: 0, paid: 0, remaining: 0 };
    });

    students.forEach(s => {
      const clsName = s.class || 'Unassigned';
      if (!map[clsName]) {
        map[clsName] = { className: clsName, studentsCount: 0, billed: 0, paid: 0, remaining: 0 };
      }
      map[clsName].studentsCount += 1;
      map[clsName].billed += s.totalFees || 0;
      map[clsName].paid += s.feesPaid || 0;
      map[clsName].remaining += Math.max(0, (s.totalFees || 0) - (s.feesPaid || 0));
    });

    return Object.values(map);
  }, [students, classes]);

  const debtorList = useMemo(() => {
    const search = (searchTerm || '').toLowerCase().trim();
    return students.filter(s => {
      if (!s) return false;
      const balance = (s.totalFees || 0) - (s.feesPaid || 0);
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      const studentId = (s.studentId || '').toLowerCase();
      const matchesSearch = !search || fullName.includes(search) || studentId.includes(search);
      return balance > 0 && matchesSearch;
    });
  }, [students, searchTerm]);

  const chartData = useMemo(() => {
    return classFinancials.map(cf => ({
      name: cf.className,
      Billed: cf.billed,
      Collected: cf.paid,
    }));
  }, [classFinancials]);

  const exportClassFinancials = () => {
    if (!classFinancials.length) return;
    const data = classFinancials.map(cf => ({
      'Class Name': cf.className,
      'Student Count': cf.studentsCount,
      'Total Billed': cf.billed,
      'Total Collected': cf.paid,
      'Total Outstanding Balance': cf.remaining,
      'Collection Rate': cf.billed > 0 ? ((cf.paid / cf.billed) * 100).toFixed(1) + '%' : '0%'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Class Financial Broadsheet");
    XLSX.writeFile(wb, `Class_Financials_Broadsheet.xlsx`);
  };

  const exportDebtorList = () => {
    if (!debtorList.length) return;
    const data = debtorList.map(d => ({
      'Student ID': d.studentId,
      'Name': `${d.firstName} ${d.lastName}`,
      'Class': d.class,
      'Total Billed Fee': d.totalFees,
      'Fees Paid to Date': d.feesPaid,
      'Overdue Arrears Balance(GHS)': d.totalFees - d.feesPaid,
      'Guardian Name': d.guardianName,
      'Guardian Phone': d.guardianPhone
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Overdue Accounts Debtors");
    XLSX.writeFile(wb, `Overdue_Accounts_Debtors.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
      {/* Print Only Header */}
      <div className="only-print">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolProfile.schoolName}</h1>
        <div className="mt-2 text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-4">
          <span>{isAccountant ? 'FINANCIAL PERFORMANCE & COLLECTION REPORT' : 'ACADEMIC PERFORMANCE REPORT'}</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>{isAccountant ? `Generated: ${new Date().toLocaleDateString()}` : `${selectedClass} — ${selectedTerm}`}</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>Academic Year: {academicYear}</span>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide no-scrollbar print:hidden">
        {isAccountant ? (
          <>
            <button 
              onClick={() => setActiveReport('fee-collection')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer",
                activeReport === 'fee-collection' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <BarChart3 className="w-4 h-4 shrink-0 text-indigo-500" />
              <span>Fees Collection KPI</span>
            </button>
            <button 
              onClick={() => setActiveReport('debtor-list')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer",
                activeReport === 'debtor-list' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <Users className="w-4 h-4 shrink-0 text-amber-500" />
              <span>Registry of Debtors</span>
            </button>
            <button 
              onClick={() => setActiveReport('class-financials')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer",
                activeReport === 'class-financials' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <FileText className="w-4 h-4 shrink-0 text-indigo-500" />
              <span>Class Financials Broadsheet</span>
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setActiveReport('class-summary')}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer",
                activeReport === 'class-summary' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Class Summary Broadsheet</span>
            </button>
            <button 
              onClick={() => setActiveReport('batch-reports')}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer",
                activeReport === 'batch-reports' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Batch Reports (A4)</span>
            </button>
            <button 
              onClick={() => setActiveReport('terminal-report')}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer",
                activeReport === 'terminal-report' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Individual Report</span>
            </button>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* --- ACCOUNTANT REPORT 1: FEES COLLECTION KPI --- */}
        {isAccountant && activeReport === 'fee-collection' && (
          <motion.div 
            key="fee-collection"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Quick Action Block */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between print:hidden">
              <span className="font-bold text-slate-800 text-xs sm:text-sm">Fee Collection performance metrics visualization</span>
              <button 
                onClick={triggerPrint}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 text-xs h-10 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-indigo-500" />
                <span>Print statement report</span>
              </button>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-indigo-50 to-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">Total Billed</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalFinancials.totalBilled)}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <Coins className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Gross revenue</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">Total Received</p>
                <p className="text-xl font-bold text-emerald-800 mt-1">{formatCurrency(totalFinancials.totalPaid)}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Collected</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-rose-50 to-rose-50/50 p-5 rounded-2xl border border-rose-100">
                <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">OVERDUE ARREARS</p>
                <p className="text-xl font-bold text-rose-800 mt-1">{formatCurrency(totalFinancials.totalRemaining)}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-rose-600 uppercase tracking-widest">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Debt outstanding</span>
                </div>
              </div>

              <div className="bg-slate-900 p-5 rounded-2xl text-white">
                <p className="text-[10px] font-black tracking-widest uppercase text-indigo-400">COLLECTION PERCENTAGE</p>
                <p className="text-2xl font-black text-indigo-200 mt-1">{totalFinancials.collectionProgress.toFixed(1)}%</p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${totalFinancials.collectionProgress}%` }} />
                </div>
              </div>
            </div>

            {/* Visual Charts & Stats details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Collection Graph by Class */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Fee Collections Comparison by Class</h3>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-slate-300 rounded" />
                      <span>Billed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded" />
                      <span>Collected</span>
                    </div>
                  </div>
                </div>
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={11} fontWeight={700} stroke="#94a3b8" />
                      <YAxis fontSize={11} fontWeight={700} stroke="#94a3b8" />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="Billed" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Collected" fill="var(--color-indigo-600)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Class ranking outstanding arrears list */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-4">Under-performing Class Arrears</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-72">
                  {classFinancials.map(cf => {
                    const statusPerc = cf.billed > 0 ? (cf.paid / cf.billed) * 100 : 0;
                    return (
                      <div key={cf.className} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{cf.className}</p>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{cf.studentsCount} Students Registry</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-rose-600 text-sm">{formatCurrency(cf.remaining)}</p>
                          <p className={cn(
                            "text-[10px] font-mono font-bold mt-0.5",
                            statusPerc >= 80 ? "text-emerald-600" : statusPerc >= 50 ? "text-amber-600" : "text-rose-500"
                          )}>{statusPerc.toFixed(0)}% cleared</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- ACCOUNTANT REPORT 2: REGISTRY OF DEBTERS --- */}
        {isAccountant && activeReport === 'debtor-list' && (
          <motion.div 
            key="debtor-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters / Search Debtors */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between print:hidden">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Query debtor by Name or ID number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={exportDebtorList}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 text-xs h-10 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel Sheet</span>
                </button>
              </div>
            </div>

            {/* Overdue List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest-wider">Defaulter Student</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest-wider">Class</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest-wider text-right">Assessment Fee</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest-wider text-right">Payments Rec.</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest-wider text-right text-rose-600 bg-rose-50/40">Default Arrears</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest-wider">Parent Contact Details</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest-wider text-right print:hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {debtorList.map((debtor) => {
                      const arrears = (debtor.totalFees || 0) - (debtor.feesPaid || 0);
                      return (
                        <tr key={debtor.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 uppercase text-xs">{debtor.firstName} {debtor.lastName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{debtor.studentId}</div>
                          </td>
                          <td className="px-6 py-4 text-xs font-black text-slate-600">{debtor.class}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 text-right">{formatCurrency(debtor.totalFees)}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 text-right">{formatCurrency(debtor.feesPaid)}</td>
                          <td className="px-6 py-4 text-xs font-black text-rose-700 text-right bg-rose-50/20">{formatCurrency(arrears)}</td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-700 leading-tight">{debtor.guardianName}</p>
                            <p className="text-[10px] text-indigo-500 font-mono tracking-wider">{debtor.guardianPhone}</p>
                          </td>
                          <td className="px-6 py-4 text-right print:hidden">
                            <button 
                              onClick={() => setSelectedBillStudent(debtor)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-700 border border-indigo-100 cursor-pointer inline-flex items-center gap-1 transition-all"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Bill Reminder</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {debtorList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest">
                          No overdue fee accounts found Matching queries. Excellent job!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- ACCOUNTANT REPORT 3: CLASS FINANCIALS BROADSHEET --- */}
        {isAccountant && activeReport === 'class-financials' && (
          <motion.div 
            key="class-financials"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between print:hidden">
              <span className="font-bold text-slate-800 text-xs sm:text-sm">Class-by-Class Revenue Billings & Receivables Broadsheet</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={triggerPrint}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 text-xs h-10 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-500" />
                  <span>Print broadsheet</span>
                </button>
                <button 
                  onClick={exportClassFinancials}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 text-xs h-10 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-indigo-500" />
                  <span>Excel broadsheet</span>
                </button>
              </div>
            </div>

            {/* Financial Broadsheet Sheet Area */}
            <div id="class-financials-print-area" className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Class Revenue Billings & Collection Summary</h2>
                  <p className="text-slate-500 font-semibold text-xs mt-0.5">Aggregate Financial Overview of Student Ledgers grouped by Class Room</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-950">{schoolProfile.schoolName}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Statement Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-900 text-white">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border border-indigo-800">Class Block</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center border border-indigo-800">Active Registry Count</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right border border-indigo-800">Total Billed Fees</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right border border-indigo-800 bg-indigo-800">Total Payments Rec.</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right border border-indigo-800 bg-indigo-950">Outstanding Arrears</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center border border-indigo-800">Collection Rate Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {classFinancials.map(cf => {
                      const perc = cf.billed > 0 ? (cf.paid / cf.billed) * 100 : 0;
                      return (
                        <tr key={cf.className} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 border border-slate-100 font-black text-slate-900 text-xs uppercase">{cf.className}</td>
                          <td className="px-6 py-4 border border-slate-100 text-center text-xs text-slate-600 font-bold">{cf.studentsCount} Students</td>
                          <td className="px-6 py-4 border border-slate-100 text-right text-xs text-slate-600">{formatCurrency(cf.billed)}</td>
                          <td className="px-6 py-4 border border-slate-100 text-right text-xs text-emerald-700 bg-emerald-50/10 font-bold">{formatCurrency(cf.paid)}</td>
                          <td className="px-6 py-4 border border-slate-100 text-right text-xs text-rose-700 bg-rose-50/10 font-bold">{formatCurrency(cf.remaining)}</td>
                          <td className="px-6 py-4 border border-slate-100 text-center text-xs">
                            <span className={cn(
                              "px-2 py-1 rounded-full font-mono text-[10px] font-black",
                              perc >= 90 ? "bg-emerald-50 text-emerald-700" : perc >= 70 ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"
                            )}>{perc.toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot className="bg-slate-950 text-white font-black">
                    <tr>
                      <td className="px-6 py-4 text-xs font-black uppercase">Grand Consolidated Totals</td>
                      <td className="px-6 py-4 text-xs text-center">{students.length} Students</td>
                      <td className="px-6 py-4 text-xs text-right text-indigo-200">{formatCurrency(totalFinancials.totalBilled)}</td>
                      <td className="px-6 py-4 text-xs text-right text-emerald-400">{formatCurrency(totalFinancials.totalPaid)}</td>
                      <td className="px-6 py-4 text-xs text-right text-rose-400">{formatCurrency(totalFinancials.totalRemaining)}</td>
                      <td className="px-6 py-4 text-xs text-center text-indigo-300 font-mono">
                        {totalFinancials.totalBilled > 0 ? ((totalFinancials.totalPaid / totalFinancials.totalBilled) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* --- DYNAMIC RENDER OF ACADEMIC REPORTS (FOR NON-ACCOUNTANTS ONLY) --- */}
        {!isAccountant && activeReport === 'class-summary' && (
          <motion.div 
            key="class-summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
              <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-end gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Class</label>
                  <select 
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="block w-full lg:w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {classes?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Term</label>
                  <select 
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value)}
                    className="block w-full lg:w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {['Term 1', 'Term 2', 'Term 3'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="hidden lg:block lg:flex-1" />
                <div className="col-span-2 lg:w-auto flex items-center gap-3">
                  <button 
                    onClick={triggerPrint}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-sm h-11 active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <span>Print Broadsheet</span>
                  </button>
                  <button 
                    onClick={() => handleExportPDF('broadsheet-content', `${selectedClass}_${selectedTerm}_Broadsheet`)}
                    disabled={isExportingPDF}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-sm disabled:opacity-50 text-sm h-11"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isExportingPDF ? 'Exporting...' : 'PDF'}</span>
                  </button>
                  <button 
                    onClick={exportClassSummary}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm text-sm h-11 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Excel</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Broadsheet Rendering */}
            <div id="broadsheet-content" className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Examination Broadsheet</h2>
                  <p className="text-slate-500 font-medium">Class Summary for {selectedClass} — {selectedTerm}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{schoolProfile.schoolName}</p>
                  <p className="text-xs text-slate-400 font-mono">Run Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-900 text-white">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest border border-indigo-800">Student Info</th>
                      {subjects?.map(sub => (
                        <th key={sub.id} className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center border border-indigo-800">
                          {sub.code || sub.name}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center border border-indigo-800 bg-indigo-800">Total</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center border border-indigo-800 bg-indigo-800">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {classStudents.map((student) => {
                      const stats = studentRankings[student.studentId];
                      return (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 border border-slate-100">
                            <div className="font-bold text-slate-900 uppercase text-xs">{student.firstName} {student.lastName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{student.studentId}</div>
                          </td>
                          {subjects?.map(sub => {
                            const result = classResults?.find(r => r.studentId === student.studentId && r.subject === sub.name);
                            return (
                              <td key={sub.id} className="px-4 py-4 text-center border border-slate-100">
                                <span className={cn(
                                  "font-bold text-sm",
                                  result ? (result.totalScore >= 50 ? "text-slate-700" : "text-rose-500") : "text-slate-200"
                                )}>
                                  {result ? result.totalScore : '-'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-center border border-slate-100 bg-indigo-50/30 font-black text-indigo-900">
                            {stats?.total || 0}
                          </td>
                          <td className="px-6 py-4 text-center border border-slate-100 font-black text-slate-900">
                            {stats?.position || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {!isAccountant && activeReport === 'batch-reports' && (
          <motion.div 
            key="batch-reports"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-6 print:hidden">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Class</label>
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="block w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {classes?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Term</label>
                <select 
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="block w-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {['Term 1', 'Term 2', 'Term 3'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                <button 
                  onClick={triggerPrint}
                  className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-sm h-11 active:scale-95 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Print All Reports</span>
                </button>
                <button 
                  onClick={handleBatchPDF}
                  disabled={isExportingPDF}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-sm disabled:opacity-50"
                >
                  <Layers className="w-4 h-4" />
                  <span>{isExportingPDF ? 'Generating...' : 'Batch PDF'}</span>
                </button>
              </div>
            </div>

            <div id="batch-reports-content" className="space-y-12 flex flex-col items-center print:space-y-0 print:block print:w-full">
              {classStudents.map(student => (
                <div key={student.id} id={`report-${student.studentId}`}>
                  <ReportCard
                    student={student} 
                    results={classResults?.filter(r => r.studentId === student.studentId) || []}
                    term={selectedTerm}
                    academicYear={academicYear}
                    schoolProfile={schoolProfile}
                    academicConfig={academicConfig}
                    termReport={{
                      studentId: student.studentId,
                      term: selectedTerm,
                      academicYear: academicYear,
                      ...(termReports?.find(tr => tr.studentId === student.studentId) || {
                         attendancePresent: 68,
                         attendanceTotal: 70,
                         teacherRemark: studentRankings[student.studentId]?.total > 500 ? 'An excellent performance. Keep it up.' : 'Good effort, but needs more focus in weak subjects.',
                         headmasterRemark: 'Satisfactory progress. Promoted to next class.'
                      }),
                      position: studentRankings[student.studentId]?.position,
                      totalStudents: classStudents.length
                    }}
                  />
                </div>
              ))}
              {!classStudents.length && (
                <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center text-slate-400 font-bold uppercase tracking-widest w-full">
                  No students found in {selectedClass}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {!isAccountant && activeReport === 'terminal-report' && (
          <motion.div 
            key="terminal-report"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Student Selector */}
            <div className="lg:col-span-4 space-y-4 print:hidden">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search for a student..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"
                  />
                </div>

                <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {students?.filter(s => {
                    if (!s) return false;
                    const search = (searchTerm || '').toLowerCase().trim();
                    if (!search) return true;
                    const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
                    const studentId = (s.studentId || '').toLowerCase();
                    return fullName.includes(search) || studentId.includes(search);
                  }).slice(0, 20).map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.studentId)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl transition-all border cursor-pointer",
                        selectedStudentId === s.studentId 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm" 
                          : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm uppercase",
                          selectedStudentId === s.studentId ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {(s.firstName?.[0] || '')}{(s.lastName?.[0] || '') || 'S'}
                        </div>
                        <div className="text-left leading-tight">
                          <p className="font-bold text-sm leading-none">{s.firstName} {s.lastName}</p>
                          <p className="text-[10px] font-mono opacity-60 uppercase mt-1">{s.studentId}</p>
                        </div>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 transition-transform", selectedStudentId === s.studentId && "translate-x-1")} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Report Viewer */}
            <div className="lg:col-span-8 space-y-6">
              {selectedStudent ? (
                <div className="space-y-6">
                  {/* Actions Bar */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-2">
                       <FileText className="w-5 h-5 text-indigo-600" />
                       <span className="font-bold text-slate-900 text-sm">Previewing Report Card</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={triggerPrint}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-xs h-10 cursor-pointer"
                      >
                         <Printer className="w-4 h-4 text-indigo-600" />
                         <span>Print Card</span>
                      </button>
                      <button 
                        onClick={() => handleExportPDF(`report-${selectedStudent.studentId}`, `${selectedStudent.firstName}_Report`)}
                        disabled={isExportingPDF}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-sm disabled:opacity-50 text-xs"
                      >
                         <FileText className="w-4 h-4" />
                         <span>{isExportingPDF ? 'Exporting...' : 'PDF'}</span>
                      </button>
                    </div>
                  </div>

                  <div id={`report-${selectedStudent.studentId}`}>
                    <ReportCard
                      student={selectedStudent} 
                      results={classResults?.filter(r => r.studentId === selectedStudent.studentId) || []}
                      term={selectedTerm}
                      academicYear={academicYear}
                      schoolProfile={schoolProfile}
                      academicConfig={academicConfig}
                      termReport={{
                        studentId: selectedStudent.studentId,
                        term: selectedTerm,
                        academicYear: academicYear,
                        ...(termReports?.find(tr => tr.studentId === selectedStudent.studentId) || {
                           attendancePresent: 68,
                           attendanceTotal: 70,
                           teacherRemark: 'Student has shown great improvement in core subjects. Needs to maintain same level of discipline.',
                           headmasterRemark: 'A commendable performance. Promotion granted.'
                        }),
                        position: studentRankings[selectedStudent.studentId]?.position,
                        totalStudents: classStudents.length
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-40 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                    <Users className="w-10 h-10 text-slate-200" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 uppercase">Select a Student</h3>
                    <p className="text-slate-400 max-w-xs font-medium">Choose a student from the sidebar to view and generate their professional terminal report card.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Printable Overdue Fee reminder statement/bill invoice modal for Accountants */}
      <AnimatePresence>
        {selectedBillStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col print:shadow-none print:rounded-none"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
                <span className="font-bold text-slate-850 text-sm">Outstanding Fee Reminder Notice</span>
                <button 
                  onClick={() => setSelectedBillStudent(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer px-2.5 py-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all"
                >
                  Close
                </button>
              </div>

              {/* Statement/Bill content area */}
              <div id="bill-reminder-content" className="p-8 space-y-6">
                <div className="text-center space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{schoolProfile.schoolName}</h1>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Official Fee Statement & Arrears Notice</p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-b border-dashed border-slate-200 py-4 text-xs">
                  <div>
                    <p className="text-slate-400 font-bold mb-0.5 uppercase tracking-wider text-[10px]">Student Details:</p>
                    <p className="text-slate-900 font-black uppercase text-sm leading-tight">{selectedBillStudent.firstName} {selectedBillStudent.lastName}</p>
                    <p className="text-[10px] font-mono text-slate-450 uppercase mt-0.5">{selectedBillStudent.studentId}</p>
                    <p className="text-slate-600 font-bold mt-1">Class Code: {selectedBillStudent.class}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 font-bold mb-0.5 uppercase tracking-wider text-[10px]">Statement Reference:</p>
                    <p className="text-slate-800 font-bold">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-slate-400 font-bold mt-3 mb-0.5 uppercase tracking-wider text-[10px]">Responsible Parent/Guardian:</p>
                    <p className="text-slate-800 font-bold uppercase">{selectedBillStudent.guardianName}</p>
                    <p className="text-[10px] font-mono text-indigo-600 mt-0.5">{selectedBillStudent.guardianPhone}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Account Overdue Statement Breakdown</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-bold">Total Term Assessment Fee:</span>
                      <span className="text-slate-800 font-bold">{formatCurrency(selectedBillStudent.totalFees)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600 font-bold">Total Payments Received:</span>
                      <span className="text-emerald-700 font-bold">-{formatCurrency(selectedBillStudent.feesPaid)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3.5 flex justify-between">
                      <span className="text-rose-600 font-black text-sm uppercase">Outstanding Overdue Balance:</span>
                      <span className="text-rose-700 font-black text-lg">{formatCurrency(selectedBillStudent.totalFees - selectedBillStudent.feesPaid)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 bg-amber-50/50 border border-amber-100 p-4 rounded-xl space-y-1">
                  <p className="font-extrabold text-amber-800 uppercase tracking-widest text-[9px]">Notice to Parent / Guardian:</p>
                  <p className="leading-relaxed text-[11px] font-medium text-slate-600">Please be informed that an overdue arrears balance of <span className="font-black text-rose-700">{formatCurrency(selectedBillStudent.totalFees - selectedBillStudent.feesPaid)}</span> remains outstanding on your child's accounts ledger. Kindly arrange to prompt clear this debt at your earliest convenience to maintain account status.</p>
                </div>

                <div className="pt-8 border-t border-slate-100 flex justify-between items-end">
                  <div className="border-t border-slate-300 w-32 pt-2 text-center text-[10px] text-slate-400 font-black uppercase">
                    Accounts Office
                  </div>
                  <div className="border-t border-slate-300 w-32 pt-2 text-center text-[10px] text-slate-400 font-black uppercase">
                    Authorized Treasury
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 print:hidden">
                <button 
                  onClick={() => handleExportPDF('bill-reminder-content', `Overdue_Arrears_Notice_${selectedBillStudent.studentId}`)}
                  disabled={isExportingPDF}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingPDF ? 'Generating...' : 'Save PDF'}</span>
                </button>
                <button 
                  onClick={triggerPrint}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Arrears Bill</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
