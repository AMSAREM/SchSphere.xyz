import React from 'react';
import type { Student, Result, TermReport } from '../db/schema';
import { BookOpen } from 'lucide-react';

interface ReportCardProps {
  student: Student;
  results: Result[];
  term: string;
  academicYear: string;
  termReport?: TermReport;
  schoolProfile?: any;
  academicConfig?: any;
}

export const ReportCard: React.FC<ReportCardProps> = ({ 
  student, 
  results, 
  term, 
  academicYear,
  termReport,
  schoolProfile,
  academicConfig
}) => {
  const totalScore = results.reduce((acc, r) => acc + r.totalScore, 0);
  const averageScore = results.length > 0 ? (totalScore / results.length).toFixed(1) : '0.0';
  
  const profile = schoolProfile || {
    schoolName: 'ESEPA INTERNATIONAL SCHOOL',
    schoolAddress: 'Accra, Ghana',
    schoolPhone: '+233 24 000 0000',
    schoolEmail: 'info@esepa.edu.gh'
  };

  return (
    <div className="ReportCard w-full max-w-4xl bg-white p-[10mm] sm:p-[15mm] mx-auto border-[10px] border-double border-indigo-900 box-border flex flex-col relative">
      {/* Header Section */}
      <div className="ReportCard-section text-center space-y-2 mb-4 border-b-2 border-indigo-900 pb-4 relative">
        <div className="flex items-center justify-center gap-6 mb-2">
          <img 
            src="https://cdn.pixabay.com/photo/2016/10/06/19/03/graduation-cap-1719744_1280.png" 
            alt="School Logo" 
            className="w-16 h-16 grayscale"
          />
          <div className="text-center">
            <h1 className="text-2xl font-black text-indigo-900 uppercase tracking-[0.1em]">{profile.schoolName}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Official Academic Transcript</p>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5 italic">{profile.schoolAddress} | TEL: {profile.schoolPhone}</p>
          </div>
        </div>
        <div className="flex justify-between items-center px-4">
          <span className="text-[8px] font-black text-indigo-900 uppercase tracking-widest border border-indigo-900 px-2 py-0.5 rounded-full">
            {academicYear} Academic Year
          </span>
          <h2 className="text-lg font-black text-white bg-indigo-900 px-6 py-0.5 uppercase tracking-tighter rounded-full">
            Terminal Report Card
          </h2>
          <span className="text-[8px] font-black text-indigo-900 uppercase tracking-widest border border-indigo-900 px-2 py-0.5 rounded-full">
            {term}
          </span>
        </div>
      </div>

      {/* Student Profile Section */}
      <div className="ReportCard-section grid grid-cols-12 gap-4 mb-4 text-[10px]">
        <div className="col-span-3 flex justify-start">
          <div className="w-[35mm] h-[45mm] border-2 border-indigo-900 bg-slate-50 flex items-center justify-center text-slate-300 font-bold uppercase overflow-hidden relative shadow-sm">
             {student.photo ? (
               <img src={student.photo} alt={student.firstName} className="w-full h-full object-cover" />
             ) : (
               <>
                 <span className="text-[8px] text-center px-1">Passport</span>
                 <div className="absolute inset-x-0 bottom-0 py-1 bg-indigo-900/5 text-[6px] text-indigo-400 text-center uppercase tracking-tighter">
                   Official Portrait
                 </div>
               </>
             )}
          </div>
        </div>
        <div className="col-span-9 grid grid-cols-2 gap-x-6 gap-y-1">
          <DetailRow label="Full Name" value={`${student.firstName} ${student.lastName}`} bold />
          <DetailRow label="Admission No" value={student.studentId} mono />
          <DetailRow label="Class" value={student.class} />
          <DetailRow label="Gender" value={student.gender} />
          <DetailRow label="House/Dept" value={student.house || student.department || '---'} />
          <DetailRow label="Position" value={termReport?.position ? `${termReport.position} of ${termReport.totalStudents || '---'}` : '---'} bold />
        </div>
      </div>

      {/* Academic Table Section */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <table className="w-full border-2 border-indigo-900 text-[10px] mb-4 no-print-reset">
          <thead className="bg-indigo-900 text-white">
            <tr>
              <th className="px-2 py-1.5 border border-white text-left uppercase tracking-widest font-black">Subject</th>
              <th className="px-2 py-1.5 border border-white text-center uppercase tracking-widest font-black w-20">Class</th>
              <th className="px-2 py-1.5 border border-white text-center uppercase tracking-widest font-black w-20">Exam</th>
              <th className="px-2 py-1.5 border border-white text-center uppercase tracking-widest font-black w-20">Total</th>
              <th className="px-2 py-1.5 border border-white text-center uppercase tracking-widest font-black w-12">Grade</th>
              <th className="px-2 py-1.5 border border-white text-left uppercase tracking-widest font-black">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-900">
            {results.map((r, i) => (
              <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-2 py-1 border-r border-indigo-900 font-bold uppercase">{r.subject}</td>
                <td className="px-2 py-1 border-r border-indigo-900 text-center font-bold">{r.classScore}</td>
                <td className="px-2 py-1 border-r border-indigo-900 text-center font-bold">{r.examScore}</td>
                <td className="px-2 py-1 border-r border-indigo-900 text-center font-black text-indigo-900">{r.totalScore}</td>
                <td className="px-2 py-1 border-r border-indigo-900 text-center font-black">{r.grade}</td>
                <td className="px-2 py-1 italic text-slate-600 text-[9px] leading-tight">{r.remarks}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-indigo-50/50">
            <tr className="border-t-2 border-indigo-900">
              <td colSpan={3} className="px-2 py-1 font-black text-slate-500 uppercase text-right tracking-widest">Aggregate / Average</td>
              <td className="px-2 py-1 text-center bg-indigo-900 text-white font-black">{totalScore}</td>
              <td className="px-2 py-1 text-center font-black">{averageScore}</td>
              <td className="px-2 py-1 font-bold text-indigo-900 uppercase tracking-tighter text-[9px]">
                GPA: {((Number(averageScore) / 100) * 4).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer Grid: Attendance, Next Term, Remarks */}
        <div className="ReportCard-section grid grid-cols-2 gap-6 text-[10px]">
           {/* Left Coll: Attendance & Next Term */}
           <div className="space-y-4">
              <section className="ReportCard-section space-y-1">
                 <h3 className="font-black uppercase text-indigo-900 border-b border-indigo-900 pb-0.5 text-[9px]">Attendance Record</h3>
                 <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-slate-400 uppercase font-bold text-[8px]">Present:</span>
                    <span className="font-bold">{termReport?.attendancePresent || '---'}</span>
                    <span className="text-slate-400 uppercase font-bold text-[8px]">Absent:</span>
                    <span className="font-bold">{(termReport?.attendanceTotal || 0) - (termReport?.attendancePresent || 0)}</span>
                 </div>
              </section>

              <section className="ReportCard-section space-y-1 p-2 border border-indigo-100 rounded-lg bg-slate-50/50">
                 <h3 className="font-black uppercase text-indigo-900 text-[9px]">Next Term Info</h3>
                 <div className="space-y-0.5 text-[9px]">
                    <p className="flex justify-between">
                       <span className="text-slate-500 font-bold">Re-opening:</span>
                       <span className="font-black">{academicConfig?.nextTermBegins ? new Date(academicConfig.nextTermBegins).toLocaleDateString() : 'TBD'}</span>
                    </p>
                    <p className="flex justify-between">
                       <span className="text-slate-500 font-bold">Fees Due:</span>
                       <span className="font-black text-rose-600">GHS {(student.totalFees - student.feesPaid).toFixed(2)}</span>
                    </p>
                 </div>
              </section>
           </div>

           {/* Right Coll: Remarks */}
           <div className="space-y-3">
              <div className="space-y-0.5">
                 <p className="text-[8px] font-black uppercase text-slate-400">Teacher's Remark:</p>
                 <p className="italic border-b border-indigo-900 pb-0.5 min-h-[2em] leading-tight">
                   {termReport?.teacherRemark || 'No remark entered.'}
                 </p>
              </div>
              <div className="space-y-0.5">
                 <p className="text-[8px] font-black uppercase text-slate-400">Head's Remark:</p>
                 <p className="italic border-b border-indigo-900 pb-0.5 min-h-[2em] leading-tight">
                   {termReport?.headmasterRemark || 'No remark entered.'}
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="ReportCard-section pt-10 grid grid-cols-2 gap-16">
        <div className="text-center space-y-2">
          <div className="border-b-2 border-indigo-900 h-12 w-full flex items-end justify-center relative">
            <span className="text-[7px] text-slate-200 uppercase font-black tracking-widest pb-1">Principal's Authorization</span>
          </div>
          <p className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">Class Teacher's Signature</p>
        </div>
        <div className="text-center space-y-2">
          <div className="border-b-2 border-indigo-900 h-12 w-full flex items-center justify-center relative">
             <div className="absolute inset-0 border border-dashed border-indigo-50 rounded-full opacity-20" />
             <span className="text-[6px] text-slate-200 uppercase font-black text-center leading-none">Official School Stamp<br/>Authorized Personnel Only</span>
          </div>
          <p className="text-[10px] font-black uppercase text-indigo-900 tracking-wider">Headmaster's Signature & Stamp</p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="ReportCard-section mt-auto pt-6 flex justify-between items-end border-t border-slate-100 text-[8px] text-slate-400 font-mono">
        <div className="space-y-0.5">
          <p className="font-bold">© 2026 {profile.schoolName}</p>
          <p className="text-[6px]">ESEPA ACADEMIC INFORMATION MANAGEMENT SYSTEM (AIMS)</p>
        </div>
        <div className="text-right space-y-0.5">
          <p>GEN: {new Date().toISOString().slice(0, 16).replace('T', ' ')}</p>
          <p className="text-[6px] uppercase tracking-tighter">Verified Academic Transcript Grade: P</p>
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) => (
  <div className="flex items-center justify-between border-b border-slate-100 py-1 min-h-[1.2rem]">
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</span>
    <span className={`text-[10px] uppercase ${bold ? 'font-black text-indigo-900' : 'font-bold'} ${mono ? 'font-mono' : ''} leading-none`}>
      {value}
    </span>
  </div>
);
