import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { format, startOfToday } from 'date-fns';
import { Check, X, Clock, CalendarDays, Users, Download, FileText, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { exportToPDF, triggerPrint } from '../lib/utils';

export default function AttendanceTerminal() {
  const { showToast } = useNotifications();
  const { user } = useAuth();
  const settings = useLiveQuery(() => db.settings.toArray()) || [];
  const schoolName = settings.find(s => s.key === 'schoolProfile')?.value?.schoolName || 'ESEPA INTERNATIONAL SCHOOL';

  const classesFromDB = useLiveQuery(() => db.classes.toArray()) || [];
  const studentsInSystem = useLiveQuery(() => db.students.toArray()) || [];
  
  const classes = useMemo(() => {
    const fromDB = classesFromDB.map(c => c.name);
    const fromStudents = studentsInSystem.map(s => s.class);
    const list = Array.from(new Set([...fromDB, ...fromStudents])).filter(Boolean).sort();
    return list.map((name, idx) => ({ id: idx, name }));
  }, [classesFromDB, studentsInSystem]);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('P1');

  useEffect(() => {
    if (classes.length > 0 && !classes.find(c => c.name === selectedClass)) {
      setSelectedClass(classes[0].name);
    }
  }, [classes, selectedClass]);
  
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

  const dbStudents = useLiveQuery(
    () => db.students.where('class').equals(selectedClass).toArray(),
    [selectedClass]
  );

  const students = useMemo(() => {
    if (user?.role === 'parent') {
      return parentWards;
    }
    return dbStudents || [];
  }, [user?.role, parentWards, dbStudents]);

  const attendance = useLiveQuery(
    () => db.attendance.where('date').equals(selectedDate).toArray(),
    [selectedDate]
  );

  const filteredAttendance = useMemo(() => {
    if (!attendance || !students) return [];
    const studentIdSet = new Set(students.map(s => s.studentId));
    return attendance.filter(a => studentIdSet.has(a.studentId));
  }, [attendance, students]);

  const markAttendance = async (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    if (user?.role === 'parent') {
      showToast('Parents are not permitted to modify attendance records.', 'error');
      return;
    }
    const existing = await db.attendance
      .where({ studentId, date: selectedDate })
      .first();

    if (existing) {
      await db.attendance.update(existing.id!, { status });
    } else {
      await db.attendance.add({ studentId, date: selectedDate, status });
    }
  };

  const getStatus = (studentId: string) => {
    return attendance?.find(a => a.studentId === studentId)?.status || 'None';
  };

  const markAll = async (status: 'Present' | 'Absent' | 'Late') => {
    if (user?.role === 'parent') {
      showToast('Parents are not permitted to modify attendance records.', 'error');
      return;
    }
    if (!students) return;
    const promises = students.map(s => markAttendance(s.studentId, status));
    await Promise.all(promises);
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const fileName = user?.role === 'parent' 
        ? `Attendance_Wards_${selectedDate}` 
        : `Attendance_${selectedClass}_${selectedDate}`;
      await exportToPDF('print-attendance', fileName);
    } catch (err) {
      showToast('Failed to export printable PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportAttendance = () => {
    const data = students?.map(s => ({
      ID: s.studentId,
      Name: `${s.firstName} ${s.lastName}`,
      Status: getStatus(s.studentId),
      Date: selectedDate,
      Class: s.class
    })) || [];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const fileName = user?.role === 'parent' 
      ? `Attendance_Wards_${selectedDate}.xlsx` 
      : `Attendance_${selectedClass}_${selectedDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const stats = useMemo(() => {
    return {
      present: filteredAttendance.filter(a => a.status === 'Present').length,
      absent: filteredAttendance.filter(a => a.status === 'Absent').length,
      late: filteredAttendance.filter(a => a.status === 'Late').length
    };
  }, [filteredAttendance]);

  return (
    <div className="space-y-6" id="print-attendance">
      {/* Print Only Header */}
      <div className="only-print">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center">{schoolName}</h1>
        <div className="mt-2 text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-4">
          <span>Daily Attendance Roll</span>
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          {user?.role === 'parent' ? (
            <span>My Children</span>
          ) : (
            <span>Class: {selectedClass}</span>
          )}
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span>Date: {format(new Date(selectedDate), 'EEEE, MMMM do, yyyy')}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-4 print:hidden">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 print:hidden">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none"
            />
          </div>

          {user?.role === 'parent' ? (
            <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black uppercase tracking-wider text-indigo-700">
              My Wards Attendance
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select 
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {classes?.length ? classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : <option>P1</option>}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user?.role !== 'parent' && (
            <div className="flex bg-white border border-slate-200 rounded-xl p-1">
              <button 
                onClick={() => markAll('Present')}
                className="px-3 py-1.5 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
              >
                All Present
              </button>
              <div className="w-[1px] bg-slate-100 mx-1" />
              <button 
                onClick={() => markAll('Absent')}
                className="px-3 py-1.5 text-[10px] font-black uppercase text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              >
                All Absent
              </button>
            </div>
          )}
          <button 
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-sm disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>{isExportingPDF ? 'Exporting...' : 'PDF'}</span>
          </button>
          <button 
            onClick={triggerPrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm h-11"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Print</span>
          </button>
          <button 
            onClick={exportAttendance}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-center gap-8 text-xs font-bold text-indigo-900">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full" />
          <span>Present: {stats.present}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-rose-500 rounded-full" />
          <span>Absent: {stats.absent}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded-full" />
          <span>Late: {stats.late}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {students?.map((student) => {
          const status = getStatus(student.studentId);
          const isParent = user?.role === 'parent';
          return (
            <motion.div 
              layout
              key={student.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                  {(student.firstName?.[0] || '')}{(student.lastName?.[0] || '') || 'S'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 leading-none">{student.firstName} {student.lastName}</h4>
                    {isParent && (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100/50 rounded text-[9px] font-black uppercase tracking-wider">
                        {student.class}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{student.studentId}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => !isParent && markAttendance(student.studentId, 'Present')}
                  disabled={isParent}
                  className={`p-2 rounded-lg transition-all ${
                    status === 'Present' 
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' 
                      : isParent 
                        ? 'bg-slate-50 text-slate-200 opacity-40 cursor-not-allowed' 
                        : 'bg-slate-50 text-slate-300 hover:bg-emerald-50 hover:text-emerald-500'
                  }`}
                  title={isParent ? `Status: Present` : "Present"}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => !isParent && markAttendance(student.studentId, 'Late')}
                  disabled={isParent}
                  className={`p-2 rounded-lg transition-all ${
                    status === 'Late' 
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' 
                      : isParent 
                        ? 'bg-slate-50 text-slate-200 opacity-40 cursor-not-allowed' 
                        : 'bg-slate-50 text-slate-300 hover:bg-amber-50 hover:text-amber-500'
                  }`}
                  title={isParent ? `Status: Late` : "Late"}
                >
                  <Clock className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => !isParent && markAttendance(student.studentId, 'Absent')}
                  disabled={isParent}
                  className={`p-2 rounded-lg transition-all ${
                    status === 'Absent' 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' 
                      : isParent 
                        ? 'bg-slate-50 text-slate-200 opacity-40 cursor-not-allowed' 
                        : 'bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500'
                  }`}
                  title={isParent ? `Status: Absent` : "Absent"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
        {students?.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
            <Users className="w-12 h-12 text-slate-100 mx-auto mb-3" />
            <p>{user?.role === 'parent' ? 'No related wards found linked to your account.' : 'No students enrolled in this class yet.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
