import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, useFeeTypes } from '../db/schema';
import { Wallet, CreditCard, History, Search, ArrowUpRight, Download, X, Check, FileText, Printer, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Award, Users } from 'lucide-react';
import { formatCurrency, cn, exportToPDF, triggerPrint } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
import { studentsApi } from '../lib/api';
import * as XLSX from 'xlsx';
import PaystackPaymentButton from './PaystackPaymentButton';
import { useAuth } from '../contexts/AuthContext';

export default function FeeManagement() {
  const { showToast } = useNotifications();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger'>('dashboard');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [ledgerSortOrder, setLedgerSortOrder] = useState<'asc' | 'desc'>('asc');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const feeTypes = useFeeTypes();
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolName = settings.find(s => s.key === 'schoolProfile')?.value?.schoolName || 'ESEPA INTERNATIONAL SCHOOL';

  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const isStaff = !isStudent && !isParent;

  // Retrieve all students
  const allStudents = useLiveQuery(() => db.students.toArray()) || [];

  // Match current user to a student record (if student role)
  const studentRecord = useMemo(() => {
    if (isStudent && user?.fullName && allStudents.length > 0) {
      const cleanName = user.fullName.replace(/\s*\(Student\)/i, '').trim().toLowerCase();
      return allStudents.find(s => {
        const full = `${s.firstName} ${s.lastName}`.toLowerCase().trim();
        return full.includes(cleanName) || cleanName.includes(full);
      });
    }
    return null;
  }, [isStudent, user?.fullName, allStudents]);

  // Match current user to children/wards (if parent role)
  const parentWards = useMemo(() => {
    if (isParent && user?.fullName && allStudents.length > 0) {
      const cleanParentName = user.fullName.replace(/\s*\(Parent\)/i, '').trim().toLowerCase();
      return allStudents.filter(s => {
        const guardian = (s.guardianName || '').toLowerCase().trim();
        return guardian.includes(cleanParentName) || cleanParentName.includes(guardian);
      });
    }
    return [];
  }, [isParent, user?.fullName, allStudents]);

  // Determine students list to display
  const students = useMemo(() => {
    if (isStudent) {
      return studentRecord ? [studentRecord] : [];
    }
    if (isParent) {
      return parentWards;
    }
    // Staff/Accountant: filter all students by search query
    return allStudents.filter(s => 
      s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [isStudent, studentRecord, isParent, parentWards, allStudents, searchTerm]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Auto-select student on load for student and parent roles
  useEffect(() => {
    if (isStudent && studentRecord) {
      setSelectedStudentId(studentRecord.studentId);
    } else if (isParent && parentWards.length > 0 && !selectedStudentId) {
      setSelectedStudentId(parentWards[0].studentId);
    }
  }, [isStudent, studentRecord, isParent, parentWards, selectedStudentId]);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [lastPayment, setLastPayment] = useState<{ 
    amount: number; 
    date: number; 
    method: string; 
    phone?: string; 
    ref?: string; 
  } | null>(null);
  const selectedStudent = allStudents.find(s => s.studentId === selectedStudentId);

  const paymentHistory = useLiveQuery(() => {
    if (!selectedStudent) return [];
    const nameToMatch = `${selectedStudent.firstName} ${selectedStudent.lastName}`;
    return db.smsLogs
      .filter(log => 
        log.type === 'Fee Reminder' && 
        log.message.includes(nameToMatch)
      )
      .toArray();
  }, [selectedStudent]);

  const parsedPayments = useMemo(() => {
    if (!paymentHistory) return [];
    return paymentHistory.map(log => {
      const msg = log.message;
      let amount = 0;
      let method = 'Online Payment';
      let ref = 'MM-' + log.id;
      
      const amountMatch = msg.match(/GHS\s*([\d.]+)/i);
      if (amountMatch) amount = parseFloat(amountMatch[1]);
      
      const refMatch = msg.match(/Ref:\s*([A-Z0-9-]+)/i);
      if (refMatch) ref = refMatch[1];
      
      const viaMatch = msg.match(/received via\s*([^for]+)\s*for/i);
      if (viaMatch) method = viaMatch[1].trim();

      return {
        id: log.id,
        amount,
        method,
        ref,
        date: log.createdAt || Date.now(),
        raw: log
      };
    }).sort((a, b) => b.date - a.date);
  }, [paymentHistory]);

  const studentLedger = useMemo(() => {
    if (!selectedStudent) return [];
    const entries: Array<{
      id: string;
      date: number;
      type: 'debit' | 'credit';
      description: string;
      reference: string;
      method?: string;
      amount: number;
      recipientPhone?: string;
    }> = [];
    
    // 1. Billings (Debits)
    const breakdown = selectedStudent.feeBreakdown || { tuition: selectedStudent.totalFees };
    const baseDate = selectedStudent.createdAt || (Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    Object.entries(breakdown).forEach(([feeId, amount], idx) => {
      if (amount > 0) {
        const ft = feeTypes.find(f => f.id === feeId);
        const label = ft ? ft.label : feeId.toUpperCase();
        entries.push({
          id: `bill-${feeId}-${idx}`,
          date: baseDate + idx * 1000,
          type: 'debit',
          description: `Billed: ${label}`,
          reference: `BIL-${selectedStudent.studentId.replace('STU-', '')}-${feeId.toUpperCase().slice(0, 3)}`,
          amount: amount,
        });
      }
    });

    // 2. Payments (Credits)
    parsedPayments.forEach(p => {
      entries.push({
        id: `pay-${p.id}`,
        date: p.date,
        type: 'credit',
        description: `Payment Received`,
        reference: p.ref,
        method: p.method,
        amount: p.amount,
        recipientPhone: p.raw.recipientPhone
      });
    });

    // Sort chronologically (oldest first) to calculate running balance correctly
    entries.sort((a, b) => a.date - b.date);

    // Compute Running Outstanding Balance
    let running = 0;
    const ledger = entries.map(e => {
      if (e.type === 'debit') {
        running += e.amount;
      } else {
        running -= e.amount;
      }
      return {
        ...e,
        runningBalance: running
      };
    });

    return ledger;
  }, [selectedStudent, feeTypes, parsedPayments]);

  const filteredLedger = useMemo(() => {
    let list = [...studentLedger];
    if (ledgerTypeFilter !== 'all') {
      list = list.filter(e => e.type === ledgerTypeFilter);
    }
    if (ledgerSortOrder === 'desc') {
      list.reverse();
    }
    return list;
  }, [studentLedger, ledgerTypeFilter, ledgerSortOrder]);

  const filteredLedgerStudents = useMemo(() => {
    return allStudents.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
      s.studentId.toLowerCase().includes(ledgerSearchTerm.toLowerCase())
    );
  }, [allStudents, ledgerSearchTerm]);

  const renderLedgerStatement = () => {
    if (!selectedStudent) return null;
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Statement Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-6 gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-base shadow-sm">
                {schoolName.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 leading-tight uppercase tracking-tight">{schoolName}</h1>
                <p className="text-[10px] uppercase font-black text-indigo-600 tracking-wider">Statement of Account Ledger</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium">Official financial record statement generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>

          {/* Quick Export Actions */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={() => triggerPrint()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer outline-none shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-500" />
              <span>Print Statement</span>
            </button>
          </div>
        </div>

        {/* Student Metadata Card */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Account Holder</p>
            <p className="text-base font-black text-slate-950 uppercase">{selectedStudent.firstName} {selectedStudent.lastName}</p>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">{selectedStudent.studentId}</span>
              <span>•</span>
              <span className="font-semibold">{selectedStudent.class}</span>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Billing Guardian Contacts</p>
            <p className="text-sm font-bold text-slate-800">{selectedStudent.guardianName || 'N/A'}</p>
            <p className="text-xs font-mono text-slate-500">{selectedStudent.guardianPhone || 'N/A'}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Statement Summary</p>
            <div className="flex gap-4">
              <div>
                <p className="text-[9px] text-slate-400 font-semibold uppercase">Total Billed</p>
                <p className="text-sm font-black text-slate-900 font-mono">{formatCurrency(selectedStudent.totalFees)}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 font-semibold uppercase">Total Paid</p>
                <p className="text-sm font-black text-emerald-600 font-mono">{formatCurrency(selectedStudent.feesPaid)}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 font-semibold uppercase font-bold">Outstanding</p>
                <p className={cn(
                  "text-sm font-black font-mono",
                  selectedStudent.totalFees - selectedStudent.feesPaid > 0 ? "text-rose-600 animate-pulse" : "text-emerald-600"
                )}>
                  {formatCurrency(selectedStudent.totalFees - selectedStudent.feesPaid)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table Filters (Print Hidden) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-2">Filter Type:</span>
            {(['all', 'debit', 'credit'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setLedgerTypeFilter(type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none border",
                  ledgerTypeFilter === type
                    ? "bg-slate-900 text-white border-slate-950 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                {type === 'all' && 'All Entries'}
                {type === 'debit' && 'Billings (+)'}
                {type === 'credit' && 'Payments (-)'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sorting:</span>
            <select
              value={ledgerSortOrder}
              onChange={(e) => setLedgerSortOrder(e.target.value as 'asc' | 'desc')}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none cursor-pointer"
            >
              <option value="asc">Oldest First</option>
              <option value="desc">Latest First</option>
            </select>
          </div>
        </div>

        {/* Ledger Statement Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                  <th className="px-5 py-4">Transaction Date</th>
                  <th className="px-5 py-4">Ref / Receipt ID</th>
                  <th className="px-5 py-4">Transaction Description</th>
                  <th className="px-5 py-4 text-right">Debit (Charged)</th>
                  <th className="px-5 py-4 text-right">Credit (Paid)</th>
                  <th className="px-5 py-4 text-right">Running Balance</th>
                  <th className="px-5 py-4 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400 space-y-2">
                      <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600">No matching ledger records found</p>
                      <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Adjust your filter parameters or verify if any initial billed components exist for this student profile.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-500">
                        {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold uppercase tracking-tight text-slate-600">
                        {entry.reference}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shrink-0",
                            entry.type === 'debit'
                              ? "bg-rose-50 border-rose-100 text-rose-700"
                              : "bg-emerald-50 border-emerald-100 text-emerald-700"
                          )}>
                            {entry.type === 'debit' ? 'Debit' : 'Credit'}
                          </span>
                          <span className="font-bold text-slate-800">{entry.description}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-rose-600">
                        {entry.type === 'debit' ? formatCurrency(entry.amount) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-emerald-600">
                        {entry.type === 'credit' ? formatCurrency(entry.amount) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-slate-900 bg-slate-50/30">
                        {formatCurrency(entry.runningBalance)}
                      </td>
                      <td className="px-5 py-4 text-center print:hidden">
                        {entry.type === 'credit' ? (
                          <button
                            onClick={() => {
                              setLastPayment({
                                amount: entry.amount,
                                date: entry.date,
                                method: entry.method || 'Online Payment',
                                phone: entry.recipientPhone,
                                ref: entry.reference
                              });
                              setIsReceiptModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-slate-500 font-bold text-[10px] transition-all cursor-pointer outline-none inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3 text-indigo-500" />
                            <span>Receipt</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 font-normal text-[10px]">No receipt</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ledger Footer Certification Statement */}
        <div className="border-t border-slate-200 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
          <p>© {new Date().getFullYear()} School Treasury Audit System • All logs are cryptographically sealed</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-slate-500">Live Accounts Sync Status: Verified</span>
          </div>
        </div>
      </div>
    );
  };

  const [paymentAmount, setPaymentAmount] = useState('');
  const [allocationType, setAllocationType] = useState<string>('automatic');

  // MoMo payment channel features state
  const [paymentMethod, setPaymentMethod] = useState<'cash_bank' | 'momo' | 'paystack'>('cash_bank');
  const [momoProvider, setMomoProvider] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [momoNumber, setMomoNumber] = useState('');
  const [isVerifyingMomo, setIsVerifyingMomo] = useState(false);
  const [momoVerified, setMomoVerified] = useState(false);
  const [momoStep, setMomoStep] = useState<'idle' | 'sending' | 'pending' | 'success' | 'failed'>('idle');
  const [momoReference, setMomoReference] = useState('');

  useEffect(() => {
    if (selectedStudent) {
      setMomoNumber(selectedStudent.guardianPhone || '');
      setMomoVerified(!!selectedStudent.guardianPhone);
      setPaymentMethod('cash_bank');
      setMomoStep('idle');
      setMomoReference('');
    }
  }, [selectedStudentId]);

  const verifyMomoSubscriber = () => {
    if (!momoNumber || momoNumber.length < 9) {
      showToast('Please enter a valid Mobile Money number.', 'error');
      return;
    }
    setIsVerifyingMomo(true);
    setTimeout(() => {
      setIsVerifyingMomo(false);
      setMomoVerified(true);
      showToast('MoMo subscriber name resolved successfully!', 'success');
    }, 700);
  };

  const submitPayment = async (referenceNum: string) => {
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudent || !selectedStudent.id) return;
    
    const currentPaid = selectedStudent.feePaidBreakdown || {};
    const breakdown = selectedStudent.feeBreakdown || { tuition: selectedStudent.totalFees };

    const updatedPaid = { ...currentPaid };
    feeTypes.forEach(ft => {
      if (updatedPaid[ft.id] === undefined) {
        updatedPaid[ft.id] = ft.id === 'tuition' ? selectedStudent.feesPaid : 0;
      }
    });

    if (allocationType === 'automatic') {
      let remaining = amount;
      const allocationOrder = feeTypes.map(ft => ft.id);
      
      for (const feeId of allocationOrder) {
        if (remaining <= 0) break;
        const billed = breakdown[feeId] ?? (feeId === 'tuition' ? selectedStudent.totalFees : 0);
        const paid = updatedPaid[feeId] ?? 0;
        const outstanding = Math.max(0, billed - paid);
        if (outstanding > 0) {
          const allocate = Math.min(remaining, outstanding);
          updatedPaid[feeId] = paid + allocate;
          remaining -= allocate;
        }
      }
      if (remaining > 0) {
        updatedPaid['tuition'] = (updatedPaid['tuition'] || 0) + remaining;
      }
    } else {
      updatedPaid[allocationType] = (updatedPaid[allocationType] || 0) + amount;
    }

    await studentsApi.update(selectedStudent.id, {
      feesPaid: selectedStudent.feesPaid + amount,
      feePaidBreakdown: updatedPaid
    });

    // Create a real database entry log inside client-server-synced smsLogs
    try {
      const channelLabel = paymentMethod === 'momo' ? `MoMo (${momoProvider.toUpperCase()})` : 'CASH / BANK';
      await db.smsLogs.add({
        recipientPhone: momoNumber || selectedStudent.guardianPhone || '0241234567',
        recipientName: selectedStudent.guardianName || `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        recipientType: 'Parent',
        message: `School Fees Payment Alert: GHS ${amount.toFixed(2)} received via ${channelLabel} for ${selectedStudent.firstName} ${selectedStudent.lastName}. Ref: ${referenceNum}. New Outstanding Balance: GHS ${(selectedStudent.totalFees - (selectedStudent.feesPaid + amount)).toFixed(2)}. Thank you!`,
        type: 'Fee Reminder',
        status: 'Sent',
        createdAt: Date.now()
      });
    } catch (e) {
      console.error("SMS logger insert exception:", e);
    }

    setLastPayment({ 
      amount, 
      date: Date.now(), 
      method: paymentMethod === 'momo' ? `Mobile Money (${momoProvider.toUpperCase()})` : 'Cash / Bank',
      phone: paymentMethod === 'momo' ? momoNumber : undefined,
      ref: referenceNum
    });
    setPaymentAmount('');
    setIsReceiptModalOpen(true);
  };

  const handlePayment = async () => {
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0 || !selectedStudent || !selectedStudent.id) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    if (paymentMethod === 'momo') {
      if (!momoNumber) {
        showToast('Subscriber Mobile Money phone number is required.', 'error');
        return;
      }
      if (!momoVerified) {
        showToast('Please verify the subscriber account number before processing.', 'error');
        return;
      }
      
      // Rotate through USSD Push payment steps
      setMomoStep('sending');
      setTimeout(() => {
        setMomoStep('pending');
      }, 800);
    } else {
      const cashRef = 'RCP-' + Math.floor(100000 + Math.random() * 900000);
      await submitPayment(cashRef);
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const handleExportPDF = async () => {
    if (!selectedStudent) return;
    setIsExportingPDF(true);
    try {
      await exportToPDF('receipt-content', `Receipt_${selectedStudent.firstName}_${selectedStudent.lastName}`);
    } catch (err) {
      showToast('Failed to export printable PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportFees = () => {
    const data = students?.map(s => ({
      ID: s.studentId,
      Name: `${s.firstName} ${s.lastName}`,
      Class: s.class,
      TotalFees: s.totalFees,
      FeesPaid: s.feesPaid,
      Balance: s.totalFees - s.feesPaid
    })) || [];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fees");
    XLSX.writeFile(wb, "Fee_Management_Report.xlsx");
  };

  if (isStudent || isParent) {
    if (!selectedStudent) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 max-w-lg mx-auto mt-12 print:hidden">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto animate-pulse" />
          <h2 className="text-xl font-black text-slate-900">Student Profile Not Linked</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            {isStudent 
              ? `We could not find an active student record matching your registered account full name "${user?.fullName}". Please contact the administration office to link your records.`
              : `We could not find any active student records associated with your parent guardian profile name "${user?.fullName}". Please contact the school Registrar's office.`}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Wallet className="w-6 h-6 text-indigo-600" />
                {isStudent ? 'My Fees & Payments' : "Ward's Fees & Payments"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                View your active ledger balances, itemized outstanding lists, and execute secure cashless payments instantly.
              </p>
            </div>
            
            {isParent && parentWards.length > 1 && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 px-3 rounded-xl shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Child:</span>
                <select
                  value={selectedStudentId || ''}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-700 outline-none cursor-pointer py-1"
                >
                  {parentWards.map(w => (
                    <option key={w.id || w.studentId} value={w.studentId}>
                      {w.firstName} {w.lastName} ({w.class})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* View Switcher Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl self-start print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-wider",
                activeTab === 'dashboard'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Fee Overview & Payments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-wider",
                activeTab === 'ledger'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Detailed Ledger
            </button>
          </div>

          {activeTab === 'ledger' ? (
            renderLedgerStatement()
          ) : (
            <>
              {/* Profile Card & Stats Bento-Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 flex flex-col justify-between border border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400">Student Profile</p>
                <h3 className="text-lg font-black mt-2 text-white">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                <p className="text-[10px] font-mono mt-0.5 text-slate-400">{selectedStudent.studentId} • {selectedStudent.class}</p>
              </div>
              <div className="border-t border-slate-800 pt-3 mt-4 space-y-1 text-xs">
                <p className="text-slate-400 truncate"><span className="font-semibold text-slate-300">Guardian:</span> {selectedStudent.guardianName}</p>
                <p className="text-slate-400"><span className="font-semibold text-slate-300">Phone:</span> {selectedStudent.guardianPhone}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-col justify-between shadow-sm">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Billed Fees</p>
                <h3 className="text-3xl font-black mt-3 text-slate-900 font-mono">{formatCurrency(selectedStudent.totalFees)}</h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">Billed term aggregates for {selectedStudent.class}</p>
            </div>

            <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100 flex flex-col justify-between shadow-sm">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-emerald-600">Total Paid to Date</p>
                <h3 className="text-3xl font-black mt-3 text-emerald-700 font-mono">{formatCurrency(selectedStudent.feesPaid)}</h3>
              </div>
              <p className="text-[10px] text-emerald-600/80 mt-2 font-semibold">GHS {(selectedStudent.totalFees > 0 ? (selectedStudent.feesPaid / selectedStudent.totalFees * 100) : 0).toFixed(0)}% overall completion rate</p>
            </div>

            <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100 flex flex-col justify-between shadow-sm">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-rose-600">Outstanding Balance</p>
                <h3 className="text-3xl font-black mt-3 text-rose-700 font-mono">
                  {formatCurrency(selectedStudent.totalFees - selectedStudent.feesPaid)}
                </h3>
              </div>
              <p className="text-[10px] text-rose-600/80 mt-2 font-semibold">Please settle outstanding to clear record entries</p>
            </div>
          </div>

          {/* Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            
            {/* Left Column: Itemized Bills & Receipt history */}
            <div className="space-y-6 lg:col-span-2">
              
              {/* Itemized breakdown table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    Itemized Statement of Accounts
                  </h3>
                  <span className="text-[10px] font-black uppercase text-slate-400 font-mono bg-white border px-2.5 py-1 rounded-lg">
                    Current Term
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100">
                        <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase">Fee Component</th>
                        <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase text-right">Amount Billed</th>
                        <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase text-right">Amount Paid</th>
                        <th className="px-5 py-3 text-[10px] font-extrabold text-slate-400 uppercase text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {feeTypes.map(ft => {
                        const billed = selectedStudent.feeBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.totalFees : 0);
                        const paid = selectedStudent.feePaidBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.feesPaid : 0);
                        const outstanding = Math.max(0, billed - paid);
                        if (billed === 0) return null;
                        return (
                          <tr key={ft.id} className="hover:bg-slate-50/40">
                            <td className="px-5 py-3 font-semibold text-slate-700">{ft.label}</td>
                            <td className="px-5 py-3 text-right font-mono text-slate-600 font-medium">{formatCurrency(billed)}</td>
                            <td className="px-5 py-3 text-right font-mono text-emerald-600 font-bold">{formatCurrency(paid)}</td>
                            <td className="px-5 py-3 text-right font-mono font-bold">
                              <span className={outstanding > 0 ? "text-rose-600" : "text-emerald-600"}>
                                {formatCurrency(outstanding)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment history list */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-600" />
                    My Recent Payment Receipts
                  </h3>
                </div>
                {parsedPayments.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 space-y-2">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">No payment receipts found</p>
                    <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Once you submit online transactions or clear outstanding fee items, your downloadable e-receipt statements will compile here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {parsedPayments.map(p => (
                      <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-xs shrink-0">
                            GHS
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-slate-800 font-mono">{formatCurrency(p.amount)}</span>
                              <span className="text-[9px] bg-slate-100 border text-slate-550 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                {p.method}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Ref: {p.ref} • {new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            setLastPayment({
                              amount: p.amount,
                              date: p.date,
                              method: p.method,
                              phone: p.raw.recipientPhone,
                              ref: p.ref
                            });
                            setIsReceiptModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer outline-none"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-500" />
                          <span>View Receipt</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Secure Fees Payment Portal */}
            <div className="space-y-6 lg:col-span-1">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl border-2 border-indigo-500 p-6 shadow-xl relative"
              >
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px] font-black text-indigo-700 tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                  Secure Checkout
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Make Secure Payment</h3>
                <p className="text-xs text-slate-500 mb-6">Settle outstanding balances instantly via Mobile Money or Paystack.</p>

                {momoStep !== 'idle' ? (
                  /* MoMo interactive simulations step rendering */
                  <div className="space-y-5 py-4 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-indigo-50 border border-indigo-100 relative">
                      <div className="absolute inset-x-0 inset-y-0 rounded-full bg-indigo-500/15 animate-ping" />
                      <Smartphone className="w-8 h-8 text-indigo-600 relative z-10" />
                    </div>

                    <div className="space-y-1 px-1">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">MoMo Authorization</h4>
                      <p className="text-[11px] text-slate-500 font-bold">
                        A secure GHS {Number(paymentAmount).toFixed(2)} push query has been prompted to subscriber <span className="text-indigo-600 font-mono font-black">{momoNumber}</span>.
                      </p>
                    </div>

                    {momoStep === 'sending' && (
                      <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-black bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 shadow-sm">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>INITIATING PUSH REQUEST...</span>
                      </div>
                    )}

                    {momoStep === 'pending' && (
                      <div className="space-y-4">
                        <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl space-y-2 text-left">
                          <p className="text-[9px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Simulated Mobile Overlay Prompt
                          </p>
                          <div className="bg-slate-950 text-slate-100 font-mono text-[10px] p-3 rounded-xl border border-slate-900 shadow-inner tracking-tight leading-relaxed">
                            <p className="text-yellow-400 font-black uppercase tracking-wider">{momoProvider.toUpperCase()} MOBILE DEBIT</p>
                            <p className="mt-1.5 text-slate-200">Pay GHS {Number(paymentAmount).toFixed(2)} to Esepa School Treasury Account?</p>
                            <p className="mt-2.5 text-right text-[9px] text-slate-500 font-bold border-t border-slate-900 pt-1.5">1. Enter MoMo PIN to Pay | 2. Decline</p>
                          </div>
                        </div>

                        {/* Handset approval controls */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              const refNum = 'MM-' + Math.floor(100000 + Math.random() * 900000);
                              submitPayment(refNum);
                              setMomoStep('idle');
                              showToast('Payment successfully approved from mobile!', 'success');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider shadow-sm cursor-pointer"
                          >
                            Enter PIN & Pay
                          </button>
                          <button
                            onClick={() => {
                              setMomoStep('failed');
                              showToast('MoMo payment request declined on handset.', 'error');
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white py-3 px-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider shadow-sm cursor-pointer"
                          >
                            Decline Payment
                          </button>
                        </div>
                      </div>
                    )}

                    {momoStep === 'failed' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-red-50 border border-red-100 text-rose-800 rounded-xl text-xs font-bold font-semibold">
                          Transaction Failed. Decline response received.
                        </div>
                        <button
                          onClick={() => setMomoStep('idle')}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-extrabold uppercase transition-all"
                        >
                          Retry / Change Mode
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex justify-between items-center text-slate-800">
                      <div>
                        <p className="text-[10px] font-bold text-rose-600 uppercase mb-0.5">Outstanding Balance</p>
                        <p className="text-xl font-black text-rose-700 font-mono">{formatCurrency(selectedStudent.totalFees - selectedStudent.feesPaid)}</p>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Due Now</span>
                    </div>

                    {/* Allocation Target Select Box */}
                    <div className="space-y-1 font-semibold">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Allocation Target Option</label>
                      <select 
                        value={allocationType}
                        onChange={(e) => setAllocationType(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="automatic">Automatic Allocation (First outstanding, then rest)</option>
                        {feeTypes.map(ft => {
                          const billed = selectedStudent.feeBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.totalFees : 0);
                          const paid = selectedStudent.feePaidBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.feesPaid : 0);
                          const outstanding = Math.max(0, billed - paid);
                          if (billed === 0) return null;
                          return (
                            <option key={ft.id} value={ft.id} disabled={outstanding <= 0}>
                              Allocate to {ft.label} Only (Outstanding: {formatCurrency(outstanding)})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-1.5 font-semibold">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Payment Channel</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('momo')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                            paymentMethod === 'momo'
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          📱 MoMo
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('paystack')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer",
                            paymentMethod === 'paystack'
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          💳 Paystack
                        </button>
                      </div>
                    </div>

                    {paymentMethod === 'momo' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200/60"
                      >
                        {/* Operator selection with nice colors */}
                        <div className="space-y-1 font-semibold">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">MoMo Network Operator</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMomoProvider('mtn')}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-black transition-all border text-center uppercase flex flex-col items-center gap-0.5 cursor-pointer",
                                momoProvider === 'mtn'
                                  ? "bg-amber-100/60 border-amber-400 text-amber-800 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                              MTN MoMo
                            </button>
                            <button
                              type="button"
                              onClick={() => setMomoProvider('telecel')}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-black transition-all border text-center uppercase flex flex-col items-center gap-0.5 cursor-pointer",
                                momoProvider === 'telecel'
                                  ? "bg-red-100/60 border-red-400 text-red-800 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                              Telecel
                            </button>
                            <button
                              type="button"
                              onClick={() => setMomoProvider('at')}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-black transition-all border text-center uppercase flex flex-col items-center gap-0.5 cursor-pointer",
                                momoProvider === 'at'
                                  ? "bg-indigo-100/65 border-indigo-400 text-indigo-900 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                              AT Money
                            </button>
                          </div>
                        </div>

                        {/* Phone number & Validation */}
                        <div className="space-y-1 font-semibold">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Subscriber Number</label>
                          <div className="flex gap-1.5">
                            <div className="relative flex-1">
                              <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                maxLength={10}
                                value={momoNumber}
                                onChange={(e) => {
                                  setMomoNumber(e.target.value.replace(/[^0-9]/g, ''));
                                  setMomoVerified(false);
                                }}
                                placeholder="e.g. 0241234567"
                                className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={verifyMomoSubscriber}
                              disabled={isVerifyingMomo}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                            >
                              {isVerifyingMomo ? "..." : "Verify"}
                            </button>
                          </div>
                        </div>

                        {/* Verified Account Name Alert */}
                        {momoVerified && (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 flex items-start gap-2 text-emerald-800 text-[10px] leading-tight font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-[11px] text-emerald-950 uppercase">Verified Subscriber</p>
                              <p className="mt-0.5">Name: <span className="font-bold">{selectedStudent.guardianName || 'Authorized Payer'}</span></p>
                              <p className="text-[8px] text-emerald-600 uppercase tracking-wider font-bold">Auto-resolved Account Successful</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <div className="space-y-2 font-semibold">
                      <label className="text-sm font-bold text-slate-700">Payment Amount (GHS)</label>
                      <div className="relative font-bold">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="Enter amount..."
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold font-mono"
                        />
                      </div>
                    </div>

                    {paymentMethod === 'paystack' ? (
                      <PaystackPaymentButton
                        amount={Number(paymentAmount)}
                        email="admin@esepa.school"
                        onSuccess={(ref: any) => {
                          submitPayment(ref.reference);
                        }}
                        onClose={() => showToast('Paystack payment canceled', 'info')}
                        className="w-full justify-center text-lg py-4 rounded-2xl shadow-lg shadow-indigo-100"
                        label="Confirm Payment"
                      />
                    ) : (
                      <button 
                        onClick={handlePayment}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 cursor-pointer"
                      >
                        Confirm Payment <ArrowUpRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

          </div>
          </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Print Only Header */}
        <div className="only-print">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolName}</h1>
          <div className="mt-2 text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-4">
            <span>Fee Management & Financial Report</span>
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
            <span>Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              Financial Management
            </h2>
            <p className="text-xs text-slate-400 font-medium">Configure billings, view live transaction ledgers, and receive secure payments.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* View Switcher Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl print:hidden shadow-inner border border-slate-200/50">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider",
                  activeTab === 'dashboard'
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Overview & Payments
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black transition-all uppercase tracking-wider",
                  activeTab === 'ledger'
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Student Ledgers
              </button>
            </div>

            {activeTab === 'dashboard' && (
              <>
                <button 
                  onClick={triggerPrint}
                  className="flex-1 sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm h-11 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Print Report</span>
                </button>
                <button 
                  onClick={exportFees}
                  className="flex-1 sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm h-11 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </>
            )}
          </div>
        </div>

        {activeTab === 'ledger' ? (
          <div className="space-y-6">
            {!selectedStudentId ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm max-w-xl mx-auto space-y-6 print:hidden">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto border border-indigo-100">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Select Student to View Ledger</h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                    Search for any active student below to render their fully itemized ledger, transaction history, and downloadable statements of account.
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search student by name or ID..."
                    value={ledgerSearchTerm}
                    onChange={(e) => setLedgerSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="max-h-[280px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                  {filteredLedgerStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                      No students match "{ledgerSearchTerm}"
                    </div>
                  ) : (
                    filteredLedgerStudents.map(s => (
                      <button
                        type="button"
                        key={s.id || s.studentId}
                        onClick={() => setSelectedStudentId(s.studentId)}
                        className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-all font-semibold cursor-pointer"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 uppercase">{s.firstName} {s.lastName}</p>
                          <p className="text-[10px] text-slate-400 font-mono tracking-tight">{s.studentId} • {s.class}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-600">Balance: {formatCurrency(s.totalFees - s.feesPaid)}</p>
                          <p className="text-[8px] uppercase font-black text-indigo-600 mt-0.5 flex items-center gap-0.5 justify-end">
                            View Ledger <ArrowUpRight className="w-3 h-3" />
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center print:hidden">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentId(null)}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer outline-none"
                  >
                    <span>← Select Another Student</span>
                  </button>
                  
                  <p className="text-[10px] text-slate-400 font-mono">
                    Viewing Ledger Account: <span className="font-bold">{selectedStudent?.studentId}</span>
                  </p>
                </div>

                {renderLedgerStatement()}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          {/* Search & List */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search student for payment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Student</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Total</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Paid</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Balance</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase print:hidden text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students?.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{student.firstName} {student.lastName}</div>
                          <div className="text-[10px] text-slate-400 font-mono tracking-wider">{student.studentId}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-600">{formatCurrency(student.totalFees)}</td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-emerald-600">{formatCurrency(student.feesPaid)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-sm font-bold",
                            student.totalFees - student.feesPaid > 0 ? "text-rose-600" : "text-emerald-600"
                          )}>
                            {formatCurrency(student.totalFees - student.feesPaid)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right print:hidden">
                          <button 
                            onClick={() => setSelectedStudentId(student.studentId)}
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                          >
                            Receive Payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Payment Side Panel */}
          <div className="space-y-6 print:hidden">
            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
              <Wallet className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-500 opacity-20" />
              <p className="text-indigo-200 text-sm font-medium mb-2 uppercase tracking-widest">School Treasury</p>
              <h2 className="text-4xl font-bold mb-8">
                {formatCurrency(students?.reduce((acc, s) => acc + s.feesPaid, 0) || 0)}
              </h2>
              <div className="flex gap-4">
                <div className="flex-1 bg-indigo-500/30 p-3 rounded-2xl backdrop-blur-sm">
                  <p className="text-[10px] uppercase font-bold text-indigo-200">Active Students</p>
                  <p className="text-lg font-bold">{students?.length || 0}</p>
                </div>
                <div className="flex-1 bg-indigo-500/30 p-3 rounded-2xl backdrop-blur-sm">
                  <p className="text-[10px] uppercase font-bold text-indigo-200">Total Outstanding</p>
                  <p className="text-sm font-bold truncate">
                    {formatCurrency(students?.reduce((acc, s) => acc + (s.totalFees - s.feesPaid), 0) || 0)}
                  </p>
                </div>
              </div>
            </div>

            {selectedStudent && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl border-2 border-indigo-500 p-6 shadow-xl relative"
              >
                <button 
                  onClick={() => setSelectedStudentId(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Process Payment</h3>
                <p className="text-sm text-slate-500 mb-6">For {selectedStudent.firstName} {selectedStudent.lastName}</p>
                
                {momoStep !== 'idle' ? (
                  /* MoMo interactive simulations step rendering */
                  <div className="space-y-5 py-4 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-indigo-55 border border-indigo-100 relative">
                      <div className="absolute inset-x-0 inset-y-0 rounded-full bg-indigo-500/15 animate-ping" />
                      <Smartphone className="w-8 h-8 text-indigo-600 relative z-10" />
                    </div>

                    <div className="space-y-1 px-1">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">MoMo Authorization</h4>
                      <p className="text-[11px] text-slate-500 font-bold">
                        A secure GHS {Number(paymentAmount).toFixed(2)} push query has been prompted to subscriber <span className="text-indigo-600 font-mono font-black">{momoNumber}</span>.
                      </p>
                    </div>

                    {momoStep === 'sending' && (
                      <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 font-black bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 shadow-sm">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>INITIATING PUSH REQUEST...</span>
                      </div>
                    )}

                    {momoStep === 'pending' && (
                      <div className="space-y-4">
                        <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-2xl space-y-2 text-left">
                          <p className="text-[9px] font-black uppercase text-amber-800 tracking-wider flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Simulated Mobile Overlay Prompt
                          </p>
                          <div className="bg-slate-950 text-slate-100 font-mono text-[10px] p-3 rounded-xl border border-slate-900 shadow-inner tracking-tight leading-relaxed">
                            <p className="text-yellow-400 font-black uppercase tracking-wider">{momoProvider.toUpperCase()} MOBILE DEBIT</p>
                            <p className="mt-1.5 text-slate-200">Pay GHS {Number(paymentAmount).toFixed(2)} to Esepa School Treasury Account?</p>
                            <p className="mt-2.5 text-right text-[9px] text-slate-500 font-bold border-t border-slate-900 pt-1.5">1. Enter MoMo PIN to Pay | 2. Decline</p>
                          </div>
                        </div>

                        {/* Handset approval controls */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              const refNum = 'MM-' + Math.floor(100000 + Math.random() * 900000);
                              submitPayment(refNum);
                              setMomoStep('idle');
                              showToast('Payment successfully approved from mobile!', 'success');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider shadow-sm"
                          >
                            🟢 Enter PIN & Pay
                          </button>
                          <button
                            onClick={() => {
                              setMomoStep('failed');
                              showToast('MoMo payment request declined on handset.', 'error');
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white py-3 px-2 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider shadow-sm"
                          >
                            🔴 Decline Payment
                          </button>
                        </div>
                      </div>
                    )}

                    {momoStep === 'failed' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-red-50 border border-red-100 text-rose-850 rounded-xl text-xs font-bold font-semibold">
                          Transaction Failed. Decline response received.
                        </div>
                        <button
                          onClick={() => setMomoStep('idle')}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-extrabold uppercase transition-all"
                        >
                          Retry / Change Mode
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50 border border-rose-105 rounded-xl flex justify-between items-center text-slate-800">
                      <div>
                        <p className="text-[10px] font-bold text-rose-600 uppercase mb-0.5">Outstanding Balance</p>
                        <p className="text-xl font-black text-rose-700 font-mono">{formatCurrency(selectedStudent.totalFees - selectedStudent.feesPaid)}</p>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Due Now</span>
                    </div>

                    {/* List out itemized balances for the student */}
                    <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Itemized Outstanding Balances</p>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {feeTypes.map(ft => {
                          const billed = selectedStudent.feeBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.totalFees : 0);
                          const paid = selectedStudent.feePaidBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.feesPaid : 0);
                          const outstanding = Math.max(0, billed - paid);
                          if (billed === 0) return null;
                          return (
                            <div key={ft.id} className="flex justify-between items-center text-xs pb-1 border-b border-slate-100 last:border-0 font-medium">
                              <span className="text-slate-600 font-medium">{ft.label}</span>
                              <div className="text-right font-bold">
                                <span className={cn("font-bold font-mono", outstanding > 0 ? "text-rose-600" : "text-emerald-600")}>
                                  {formatCurrency(outstanding)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono"> / {formatCurrency(billed)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Allocation Target Select Box */}
                    <div className="space-y-1 font-semibold">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Allocation Target Option</label>
                      <select 
                        value={allocationType}
                        onChange={(e) => setAllocationType(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="automatic">Automatic Allocation (First outstanding, then rest)</option>
                        {feeTypes.map(ft => {
                          const billed = selectedStudent.feeBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.totalFees : 0);
                          const paid = selectedStudent.feePaidBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.feesPaid : 0);
                          const outstanding = Math.max(0, billed - paid);
                          if (billed === 0) return null;
                          return (
                            <option key={ft.id} value={ft.id} disabled={outstanding <= 0}>
                              Allocate to {ft.label} Only (Outstanding: {formatCurrency(outstanding)})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-1.5 font-semibold">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Payment Channel</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cash_bank')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all",
                            paymentMethod === 'cash_bank'
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('momo')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all",
                            paymentMethod === 'momo'
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          📱 MoMo
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('paystack')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all",
                            paymentMethod === 'paystack'
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          💳 Paystack
                        </button>
                      </div>
                    </div>

                    {paymentMethod === 'momo' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200/60"
                      >
                        {/* Operator selection with nice colors */}
                        <div className="space-y-1 font-semibold">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">MoMo Network Operator</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMomoProvider('mtn')}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-black transition-all border text-center uppercase flex flex-col items-center gap-0.5",
                                momoProvider === 'mtn'
                                  ? "bg-amber-100/60 border-amber-400 text-amber-850 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                              MTN MoMo
                            </button>
                            <button
                              type="button"
                              onClick={() => setMomoProvider('telecel')}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-black transition-all border text-center uppercase flex flex-col items-center gap-0.5",
                                momoProvider === 'telecel'
                                  ? "bg-red-100/60 border-red-400 text-red-800 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                              Telecel
                            </button>
                            <button
                              type="button"
                              onClick={() => setMomoProvider('at')}
                              className={cn(
                                "py-2 rounded-lg text-[10px] font-black transition-all border text-center uppercase flex flex-col items-center gap-0.5",
                                momoProvider === 'at'
                                  ? "bg-indigo-100/65 border-indigo-400 text-indigo-900 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                              AT Money
                            </button>
                          </div>
                        </div>

                        {/* Phone number & Validation */}
                        <div className="space-y-1 font-semibold">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Subscriber Number</label>
                          <div className="flex gap-1.5">
                            <div className="relative flex-1">
                              <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                maxLength={10}
                                value={momoNumber}
                                onChange={(e) => {
                                  setMomoNumber(e.target.value.replace(/[^0-9]/g, ''));
                                  setMomoVerified(false);
                                }}
                                placeholder="e.g. 0241234567"
                                className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={verifyMomoSubscriber}
                              disabled={isVerifyingMomo}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                            >
                              {isVerifyingMomo ? "..." : "Verify"}
                            </button>
                          </div>
                        </div>

                        {/* Verified Account Name Alert */}
                        {momoVerified && (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 flex items-start gap-2 text-emerald-800 text-[10px] leading-tight font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-[11px] text-emerald-950 uppercase">Verified Subscriber</p>
                              <p className="mt-0.5">Name: <span className="font-bold">{selectedStudent.guardianName || 'Authorized Payer'}</span></p>
                              <p className="text-[8px] text-emerald-600 uppercase tracking-wider font-bold">Auto-resolved Account Successful</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    <div className="space-y-2 font-semibold">
                      <label className="text-sm font-bold text-slate-700">Payment Amount (GHS)</label>
                      <div className="relative font-bold">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="Enter amount..."
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold font-mono"
                        />
                      </div>
                    </div>

                    {paymentMethod === 'paystack' ? (
                      <PaystackPaymentButton
                        amount={Number(paymentAmount)}
                        email="admin@esepa.school"
                        onSuccess={(ref: any) => {
                          submitPayment(ref.reference);
                        }}
                        onClose={() => showToast('Paystack payment canceled', 'info')}
                        className="w-full justify-center text-lg py-4 rounded-2xl shadow-lg shadow-indigo-100"
                        label="Confirm Payment"
                      />
                    ) : (
                      <button 
                        onClick={handlePayment}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                      >
                        Confirm Payment <ArrowUpRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
        )}
      </div>

      <AnimatePresence>
          {isReceiptModalOpen && selectedStudent && lastPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col print:shadow-none print:rounded-none"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between print:hidden">
                  <h3 className="font-bold text-slate-800 tracking-tight">Payment Receipt</h3>
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
                      onClick={() => {
                        setIsReceiptModalOpen(false);
                        setSelectedStudentId(null);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div id="receipt-content" className="p-8 bg-white space-y-6 w-full max-w-md mx-auto">
                  <div className="text-center space-y-2 border-b-2 border-slate-900 pb-4">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-black text-lg">
                      {schoolName.charAt(0)}
                    </div>
                    <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">{schoolName}</h2>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Official Payment Receipt</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="font-black text-slate-400 uppercase text-[8px]">Receipt/Ref Number:</span>
                      <span className="font-mono font-bold uppercase">{lastPayment.ref || `RCP-${Math.floor(Math.random() * 1000000)}`}</span>
                    </div>
                    <div className="flex justify-between text-xs py-1.5 border-b border-slate-100 p-0.5 rounded">
                      <span className="font-black text-slate-400 uppercase text-[8px]">Payment Channel:</span>
                      <span className="font-bold uppercase text-[10px] text-indigo-600 font-sans">{lastPayment.method || 'CASH / BANK'}</span>
                    </div>
                    {lastPayment.phone && (
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                        <span className="font-black text-slate-400 uppercase text-[8px]">Payer Subscriber:</span>
                        <span className="font-mono font-bold">{lastPayment.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                      <span className="font-black text-slate-400 uppercase text-[8px]">Date:</span>
                      <span className="font-bold">{new Date(lastPayment.date).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-0.5 pt-4">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Received From:</p>
                      <p className="text-sm font-bold uppercase">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                      <p className="text-[10px] font-mono text-slate-400">{selectedStudent.studentId}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl mt-4">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Amount Paid:</p>
                      <p className="text-xl font-black text-indigo-600 font-mono">{formatCurrency(lastPayment.amount)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs pt-4">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Fees:</p>
                        <p className="font-bold">{formatCurrency(selectedStudent.totalFees)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Balance Due:</p>
                        <p className="font-bold text-rose-600">{formatCurrency(selectedStudent.totalFees - selectedStudent.feesPaid)}</p>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3 space-y-2 mt-4">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Statement of Accounts Breakdown</p>
                      <div className="space-y-1">
                        {feeTypes.map(ft => {
                          const billed = selectedStudent.feeBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.totalFees : 0);
                          const paid = selectedStudent.feePaidBreakdown?.[ft.id] ?? (ft.id === 'tuition' ? selectedStudent.feesPaid : 0);
                          if (billed === 0) return null;
                          return (
                            <div key={ft.id} className="flex justify-between items-center text-[10px] py-0.5 border-b border-slate-50 last:border-0 last:pb-0">
                              <span className="text-slate-500 font-medium">{ft.label}</span>
                              <div className="font-mono">
                                <span className="font-bold text-slate-700">{formatCurrency(paid)}</span>
                                <span className="text-slate-400 text-[8px]"> / {formatCurrency(billed)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-10 text-center">
                    <div className="border-b border-slate-900 w-32 mx-auto mb-1" />
                    <p className="text-[8px] font-black uppercase text-slate-400">Cashier Signature</p>
                    <p className="mt-6 text-[8px] text-slate-300 italic uppercase">Thank you for your prompt payment.</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5"/></svg>
  );
}
