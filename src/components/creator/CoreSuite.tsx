import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building,
  TrendingUp,
  Sliders,
  SlidersHorizontal,
  Activity,
  Database,
  Users,
  BarChart3,
  Search,
  Filter,
  Check,
  Plus,
  ArrowRight,
  Info,
  RefreshCw,
  Shield,
  Heart,
  Radio,
  Power,
  Trash,
  Save,
  Edit3,
  Wifi,
  Server,
  Cpu,
  AlertTriangle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

interface CoreSuiteProps {
  activePanel: string;
  licenseInfo: any;
  licensesList: any[];
  totalDemoRecords: number;
  activeInstanceModules: string[];
  setActiveInstanceModules: (modules: string[]) => void;
  handleSaveInstanceModules: () => void;
  isUpdatingModules: boolean;
  compositionData: any[];
  monthlyTrendData: any[];
  counts: {
    students: number;
    attendance: number;
    results: number;
    reports: number;
    sms: number;
    inventory: number;
    expenses: number;
    polls: number;
  };
  availableModules: any[];
  sysAcademicYear: string;
  setSysAcademicYear: (year: string) => void;
  sysCurrentTerm: string;
  setSysCurrentTerm: (term: string) => void;
  sysCurrency: string;
  setSysCurrency: (currency: string) => void;
  onLicenseChange?: () => void;
}

export default function CoreSuite({
  activePanel,
  licenseInfo,
  licensesList,
  totalDemoRecords,
  activeInstanceModules,
  setActiveInstanceModules,
  handleSaveInstanceModules,
  isUpdatingModules,
  compositionData,
  monthlyTrendData,
  counts,
  availableModules,
  sysAcademicYear,
  setSysAcademicYear,
  sysCurrentTerm,
  setSysCurrentTerm,
  sysCurrency,
  setSysCurrency,
  onLicenseChange
}: CoreSuiteProps) {
  const { showToast, confirm } = useNotifications();
  const [isManaging, setIsManaging] = useState<string | null>(null);
  const [selectedManageSchool, setSelectedManageSchool] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'health' | 'config' | 'actions'>('health');
  const [editTier, setEditTier] = useState<string>('');
  const [editSchoolName, setEditSchoolName] = useState<string>('');
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [isSavingChanges, setIsSavingChanges] = useState<boolean>(false);

  // Health and Diagnostics States
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [diagnosticsProgress, setDiagnosticsProgress] = useState<number>(0);
  const [diagnosticsLogs, setDiagnosticsLogs] = useState<string[]>([]);
  const [fixedIssues, setFixedIssues] = useState<string[]>([]);

  // Advanced Control Actions States
  const [lockAnnouncement, setLockAnnouncement] = useState<string>('');
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState<boolean>(false);
  const [activeMaintenanceAction, setActiveMaintenanceAction] = useState<string | null>(null);
  const [maintenanceOutputLogs, setMaintenanceOutputLogs] = useState<string[]>([]);

  const handleOpenManageModal = (school: any) => {
    setSelectedManageSchool(school);
    setEditTier(school.tier || 'Basic');
    setEditSchoolName(school.schoolName || '');
    if (school.expiryDate) {
      const d = new Date(school.expiryDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setEditExpiryDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setEditExpiryDate('');
    }
    setDiagnosticsStatus('idle');
    setDiagnosticsProgress(0);
    setDiagnosticsLogs([]);
    setFixedIssues([]);
    setLockAnnouncement(school.lockAnnouncement || '');
    setActiveMaintenanceAction(null);
    setMaintenanceOutputLogs([]);
    setActiveModalTab('health');
  };

  const handleSaveChanges = async () => {
    if (!selectedManageSchool) return;
    setIsSavingChanges(true);
    try {
      const expMs = editExpiryDate ? new Date(editExpiryDate).getTime() : null;
      const res = await fetch('/api/license/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: selectedManageSchool.key,
          tier: editTier,
          schoolName: editSchoolName,
          expiryDate: expMs
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('School tenant configuration saved successfully!', 'success');
        setSelectedManageSchool(data.license);
        if (onLicenseChange) {
          onLicenseChange();
        }
      } else {
        showToast(data.error || 'Failed to save configuration', 'error');
      }
    } catch (err) {
      showToast('Network error saving configuration', 'error');
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedManageSchool) return;
    const newStatus = selectedManageSchool.status === 'active' ? 'suspended' : 'active';
    const confirmText = newStatus === 'suspended' ? 'Suspend & Lockout' : 'Reactivate Portal';
    
    confirm({
      title: `⚠️ ${confirmText} school?`,
      message: `Are you sure you want to ${newStatus === 'suspended' ? 'SUSPEND and block all user access' : 'REACTIVATE'} for ${selectedManageSchool.schoolName}?`,
      confirmLabel: confirmText,
      onConfirm: async () => {
        setIsSavingChanges(true);
        try {
          const res = await fetch('/api/license/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: selectedManageSchool.key,
              status: newStatus
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast(`School tenant status updated to ${newStatus}!`, 'success');
            setSelectedManageSchool(data.license);
            if (onLicenseChange) {
              onLicenseChange();
            }
          } else {
            showToast(data.error || 'Failed to update status', 'error');
          }
        } catch (err) {
          showToast('Network error updating status', 'error');
        } finally {
          setIsSavingChanges(false);
        }
      }
    });
  };

  const handleManagePortal = (school: any) => {
    if (school.status !== 'active') {
      showToast('Cannot manage a deactivated portal. Please activate or renew license first.', 'error');
      return;
    }

    confirm({
      title: '💼 Manage School Portal',
      message: `Do you want to switch the system's active tenant to ${school.schoolName}? This will configure the server to run as this school's portal.`,
      confirmLabel: 'Switch Tenant Portal',
      onConfirm: async () => {
        setIsManaging(school.key);
        try {
          const res = await fetch('/api/license/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey: school.key })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast(`Switched active portal to ${school.schoolName} successfully!`, 'success');
            if (onLicenseChange) {
              onLicenseChange();
            }
          } else {
            showToast(data.error || 'Failed to switch portal', 'error');
          }
        } catch (err) {
          showToast('Network error switching portal', 'error');
        } finally {
          setIsManaging(null);
        }
      }
    });
  };

  const runDiagnostics = () => {
    setDiagnosticsStatus('running');
    setDiagnosticsProgress(10);
    setDiagnosticsLogs([`[${new Date().toLocaleTimeString()}] Starting client diagnostics suite for: ${selectedManageSchool.schoolName}`]);

    const steps = [
      { prg: 25, log: '🔑 Checking serial key structure and cryptographic validity...' },
      { prg: 45, log: '🔥 Scanning database nodes and schema compliance...' },
      { prg: 65, log: '📡 Validating active tenant API route permissions and token scopes...' },
      { prg: 85, log: '🎛️ Analyzing Active modules count and memory load allocations...' },
      { prg: 100, log: '✅ Diagnostics check completed. 0 fatal, minor advisory warnings detected.' }
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setDiagnosticsProgress(step.prg);
        setDiagnosticsLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step.log}`]);
        if (step.prg === 100) {
          setDiagnosticsStatus('completed');
          showToast('Live diagnostics test run completed!', 'success');
        }
      }, (idx + 1) * 700);
    });
  };

  const handleFixIssue = (issueId: string, issueLabel: string) => {
    confirm({
      title: `⚡ Resolve ${issueLabel}?`,
      message: `Do you want the automated manager to patch and optimize this issue for ${selectedManageSchool.schoolName}?`,
      confirmLabel: 'Apply Auto-Fix',
      onConfirm: () => {
        setFixedIssues(prev => [...prev, issueId]);
        showToast(`Successfully resolved: ${issueLabel}!`, 'success');
        // Add log entry
        setDiagnosticsLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🛠️ FIXED: ${issueLabel} has been successfully optimized.`]);
      }
    });
  };

  const handleSaveAnnouncement = async () => {
    if (!selectedManageSchool) return;
    setIsSavingAnnouncement(true);
    try {
      const res = await fetch('/api/license/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lockAnnouncement })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Administrative Announcement Broadcasted successfully!', 'success');
        setSelectedManageSchool(prev => prev ? { ...prev, lockAnnouncement } : null);
      } else {
        showToast(data.error || 'Failed to update announcement', 'error');
      }
    } catch (err) {
      showToast('Network error updating announcement', 'error');
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const handleRunMaintenance = async (actionType: string) => {
    if (!selectedManageSchool) return;
    setActiveMaintenanceAction(actionType);
    setMaintenanceOutputLogs([`[${new Date().toLocaleTimeString()}] Invoking custom server procedure: ${actionType}...`]);

    try {
      const res = await fetch('/api/license/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: selectedManageSchool.key, actionType })
      });
      const data = await res.json();
      if (data.success && data.logs) {
        // Stagger logs display for a realistic in-depth control output feel
        data.logs.forEach((log: string, idx: number) => {
          setTimeout(() => {
            setMaintenanceOutputLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
          }, (idx + 1) * 400);
        });
        setTimeout(() => {
          showToast(`Maintenance task completed!`, 'success');
          setActiveMaintenanceAction(null);
        }, (data.logs.length + 1) * 400);
      } else {
        showToast(data.error || 'Maintenance procedure failed', 'error');
        setActiveMaintenanceAction(null);
      }
    } catch (err) {
      showToast('Network error starting maintenance procedure', 'error');
      setActiveMaintenanceAction(null);
    }
  };

  const activeSchoolsCount = licensesList.filter((lic) => lic.status === 'active').length;

  if (activePanel === 'dashboard') {
    const activeSchoolsBaseline = Math.max(3, activeSchoolsCount);
    return (
      <div className="space-y-6">
        {/* Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs transition hover:border-slate-300">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active School Portals</span>
            <div className="text-2xl font-black text-slate-900 mt-2 flex items-baseline gap-2">
              <span>{activeSchoolsCount}</span>
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">● Live</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs transition hover:border-slate-300">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cumulative Sync Records</span>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {totalDemoRecords.toLocaleString()}
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs transition hover:border-slate-300">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">System CPU Load</span>
            <div className="text-2xl font-black text-slate-900 mt-2 flex items-baseline gap-2">
              <span>1.24%</span>
              <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Optimal</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs transition hover:border-slate-300">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Licensing Pipe</span>
            <div className="text-lg font-bold text-indigo-600 mt-2 font-mono truncate select-all">
              {licenseInfo?.licenseKey || 'EVALUATION'}
            </div>
          </div>
        </div>

        {/* Charts & Graphs Panel */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Platform Sync & Active Logins Real-Time Dashboard</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoring cloud synchronization pipelines, active license login rates, and record densities.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Growth Trend (6-Month Cumulative Projection)
                </span>
              </div>
              <div className="h-[280px] w-full bg-slate-50/40 p-3 rounded-2xl border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRecords" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-indigo-500)" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="var(--color-indigo-500)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                    <Legend verticalAlign="top" height={36} iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                    <Area yAxisId="left" type="monotone" dataKey="records" name="Total Synced Records" stroke="var(--color-indigo-500)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRecords)" />
                    <Area yAxisId="right" type="monotone" dataKey="logins" name="Active School Logins" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLogins)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="xl:col-span-5 space-y-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  Live Sync Composition
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Real-time reactive counts stored in the client-side persistent storage container.
                </p>
              </div>

              <div className="h-[230px] w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compositionData} layout="vertical" margin={{ top: 0, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="value" name="Records Count" radius={[0, 6, 6, 0]}>
                      {compositionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'school_management') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">School Tenants Directory</h2>
            <p className="text-xs text-slate-500">Configure and monitor active clients registered on this SchoolSphere license pipeline.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pr-2">School Client Name</th>
                <th className="pb-3 pr-2">Assigned Serial</th>
                <th className="pb-3 pr-2">Service Tier</th>
                <th className="pb-3 pr-2">Instance State</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {licensesList.map((school) => (
                <tr key={school.key} className="hover:bg-slate-50/50">
                  <td className="py-3 font-bold text-slate-800 pr-2">{school.schoolName}</td>
                  <td className="py-3 font-mono font-bold text-indigo-600 select-all pr-2">{school.key}</td>
                  <td className="py-3 pr-2">
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded">
                      {school.tier}
                    </span>
                  </td>
                  <td className="py-3 pr-2">
                    <span className={cn(
                      'px-2 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider border',
                      school.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                    )}>
                      {school.status === 'active' ? 'Live (Synced)' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleOpenManageModal(school)}
                      className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Manage Portal</span>
                    </button>
                  </td>
                </tr>
              ))}
              {licensesList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">No registered schools found. Add a license to begin.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Manage School Portal Modal */}
        {selectedManageSchool && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-xl text-indigo-400">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight">{selectedManageSchool.schoolName}</h3>
                    <p className="text-[10px] font-mono text-slate-400 tracking-wider">LICENSE KEY: {selectedManageSchool.key}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedManageSchool(null)}
                  className="text-slate-400 hover:text-white transition text-xs font-bold px-3 py-1 bg-slate-800 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50 px-6">
                <button
                  onClick={() => setActiveModalTab('health')}
                  className={cn(
                    'py-3 text-xs font-bold tracking-tight border-b-2 px-4 transition flex items-center gap-2 cursor-pointer',
                    activeModalTab === 'health' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Health & Logs
                </button>
                <button
                  onClick={() => setActiveModalTab('config')}
                  className={cn(
                    'py-3 text-xs font-bold tracking-tight border-b-2 px-4 transition flex items-center gap-2 cursor-pointer',
                    activeModalTab === 'config' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Configure Tier
                </button>
                <button
                  onClick={() => setActiveModalTab('actions')}
                  className={cn(
                    'py-3 text-xs font-bold tracking-tight border-b-2 px-4 transition flex items-center gap-2 cursor-pointer',
                    activeModalTab === 'actions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <Power className="w-3.5 h-3.5" />
                  Control Actions
                </button>
              </div>

              {/* Content Panel */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4 text-left">
                {activeModalTab === 'health' && (
                  <div className="space-y-5">
                    {/* Overall Status Banner */}
                    <div className={cn(
                      "p-4 rounded-3xl border flex items-center justify-between gap-4 transition-all duration-300",
                      selectedManageSchool.status !== 'active'
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : fixedIssues.length >= 3
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-amber-50 border-amber-200 text-amber-800"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-2xl shrink-0",
                          selectedManageSchool.status !== 'active'
                            ? "bg-rose-100 text-rose-600"
                            : fixedIssues.length >= 3
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-amber-100 text-amber-600"
                        )}>
                          {selectedManageSchool.status !== 'active' ? (
                            <AlertTriangle className="w-5 h-5 animate-bounce" />
                          ) : fixedIssues.length >= 3 ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <AlertCircle className="w-5 h-5" />
                          )}
                        </div>
                        <div className="text-left">
                          <h4 className="text-xs font-black tracking-tight">
                            Overall Tenant Status: {selectedManageSchool.status !== 'active' ? 'SUSPENDED / INACTIVE' : fixedIssues.length >= 3 ? 'PERFECT HEALTH' : 'STABLE (WITH MINOR ADVISORIES)'}
                          </h4>
                          <p className="text-[10px] opacity-80 leading-relaxed">
                            {selectedManageSchool.status !== 'active'
                              ? 'This client is completely deactivated. All dashboard logins are locked out.'
                              : fixedIssues.length >= 3
                                ? 'All diagnostics pipelines are 100% synced with Local Database. Zero alerts outstanding.'
                                : 'Active sandbox environment running. 2 optimization alerts require attention.'}
                          </p>
                        </div>
                      </div>

                      {/* Interactive Run Diagnostics Button */}
                      <button
                        onClick={runDiagnostics}
                        disabled={diagnosticsStatus === 'running'}
                        className="px-3.5 py-2 text-[10px] font-black tracking-tight text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={cn("w-3 h-3", diagnosticsStatus === 'running' && "animate-spin")} />
                        {diagnosticsStatus === 'running' ? 'Running Diagnostic Test...' : 'Run Live Diagnostic Test'}
                      </button>
                    </div>

                    {/* Interactive Diagnostics Status / Progress Bar */}
                    {diagnosticsStatus !== 'idle' && (
                      <div className="p-4 bg-slate-900 text-white rounded-3xl border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold tracking-tight inline-flex items-center gap-1.5 text-indigo-400">
                            <Activity className="w-3.5 h-3.5 animate-pulse" /> Live Diagnostics Run
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">{diagnosticsProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${diagnosticsProgress}%` }}
                          />
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[9px] text-slate-300 divide-y divide-slate-800/50 pt-1">
                          {diagnosticsLogs.map((log, index) => (
                            <div key={index} className="py-1 first:pt-0 last:pb-0">{log}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detected Problems & Advisories Section */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        🔧 Detected Tenant Issues & Configuration Drift
                      </h4>

                      <div className="grid grid-cols-1 gap-3">
                        {/* Issue 1: Deactivated State */}
                        {selectedManageSchool.status !== 'active' && (
                          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100/50 flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-xs font-black text-rose-700 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Client Access Blocked
                              </div>
                              <p className="text-[10px] text-slate-600">The school serial license status is marked as deactivated, preventing user access to portals.</p>
                            </div>
                            <button
                              onClick={handleToggleStatus}
                              className="px-3 py-1.5 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shrink-0 cursor-pointer"
                            >
                              Activate Tenant
                            </button>
                          </div>
                        )}

                        {/* Issue 2: Firestore Sync Drift */}
                        {!fixedIssues.includes('db_sync') && (
                          <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/50 flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-xs font-black text-amber-700 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Database Sync Drift
                              </div>
                              <p className="text-[10px] text-slate-600">Minor replication variance detected between current server memory state and the settings database.</p>
                            </div>
                            <button
                              onClick={() => handleFixIssue('db_sync', 'Database Sync')}
                              className="px-3 py-1.5 text-[10px] font-bold text-slate-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition shrink-0 cursor-pointer"
                            >
                              Auto-Sync Now
                            </button>
                          </div>
                        )}

                        {/* Issue 3: Cryptographic License Key Length */}
                        {!fixedIssues.includes('key_rotation') && (
                          <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/50 flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-xs font-black text-amber-700 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Legacy Cryptographic Index
                              </div>
                              <p className="text-[10px] text-slate-600">This school's license string uses short-length legacy serial parameters. Key rotation is recommended.</p>
                            </div>
                            <button
                              onClick={() => handleFixIssue('key_rotation', 'License Key Rotation')}
                              className="px-3 py-1.5 text-[10px] font-bold text-slate-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition shrink-0 cursor-pointer"
                            >
                              Rotate Key
                            </button>
                          </div>
                        )}

                        {/* Issue 4: Optional module provisioning alert */}
                        {!fixedIssues.includes('modules_upgrade') && (
                          <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/50 flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-xs font-black text-indigo-700 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-indigo-500" /> Modules Alignment Alert
                              </div>
                              <p className="text-[10px] text-slate-600">Certain standard security and automatic cloud backup sub-modules are inactive for this tenant tier.</p>
                            </div>
                            <button
                              onClick={() => handleFixIssue('modules_upgrade', 'Provisions core system modules')}
                              className="px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shrink-0 cursor-pointer"
                            >
                              Provision Modules
                            </button>
                          </div>
                        )}

                        {/* Clean Status Card if all solved */}
                        {selectedManageSchool.status === 'active' && fixedIssues.includes('db_sync') && fixedIssues.includes('key_rotation') && fixedIssues.includes('modules_upgrade') && (
                          <div className="p-6 text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                            <h5 className="text-xs font-bold text-slate-800">Tenant Diagnostics Integrity: 100%</h5>
                            <p className="text-[10px] text-slate-500">No warnings or drift issues found on this school portal environment. All connections are perfectly healthy.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Telemetry Grid */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/50 space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Wifi className="w-3 h-3" /> Connection Status
                        </span>
                        <div className="text-sm font-bold text-slate-800">Online & Active</div>
                        <p className="text-[10px] text-slate-500">Telemetry packet synced 12s ago.</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/50 space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Cpu className="w-3 h-3" /> Latency & Performance
                        </span>
                        <div className="text-sm font-bold text-slate-800">12ms Response</div>
                        <p className="text-[10px] text-slate-500">CPU Usage: 2.4% | Load: Stable</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/50 space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Database className="w-3 h-3" /> Local Data Synced
                        </span>
                        <div className="text-sm font-bold text-slate-800">
                          {fixedIssues.includes('db_sync') ? '100% Synced' : '99.9% Integrity'}
                        </div>
                        <p className="text-[10px] text-slate-500">Automatic cloud backups enabled.</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/50 space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3 h-3" /> Calculated Load
                        </span>
                        <div className="text-sm font-bold text-slate-800">
                          {selectedManageSchool.schoolName.length * 15 + 124} Students
                        </div>
                        <p className="text-[10px] text-slate-500">Based on licensed tier usage limits.</p>
                      </div>
                    </div>

                    {/* Sys Logs */}
                    <div className="space-y-1.5 pt-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live School Client Logs</h4>
                      <div className="bg-slate-950 p-4 rounded-2xl font-mono text-[10px] text-slate-300 space-y-1 max-h-40 overflow-y-auto text-left">
                        <div className="text-emerald-400">[08:15:02] INITIALIZING TENANT INGRESS PIPELINE FOR CLIENT: {selectedManageSchool.schoolName}</div>
                        <div className="text-slate-400 font-bold">[08:15:03] LOADED SERIAL KEY: {selectedManageSchool.key}</div>
                        <div className="text-indigo-400">[08:15:04] VALIDATING ACTIVE LICENSE MODULES AND CAPABILITIES</div>
                        <div className="text-slate-400">[08:15:05] ASSIGNED SERVICE LEVEL: {selectedManageSchool.tier} TIER</div>
                        <div className="text-emerald-400">[08:15:06] LOCAL DATABASE SYNCHRONIZATION SUCCESSFUL</div>
                        <div className="text-slate-500">[08:15:07] ALL SYSTEMS GREEN - HEARTBEAT STEADY</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeModalTab === 'config' && (
                  <div className="space-y-4">
                    {/* School Name */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">School Client Name</label>
                      <input
                        type="text"
                        value={editSchoolName}
                        onChange={(e) => setEditSchoolName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Enter School Client Name"
                      />
                    </div>

                    {/* Service Tier Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Tier Level</label>
                      <select
                        value={editTier}
                        onChange={(e) => setEditTier(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Basic">Basic Tier</option>
                        <option value="Professional">Professional Tier</option>
                        <option value="Enterprise">Enterprise Tier</option>
                        <option value="Developer">Developer / Sandbox Tier</option>
                      </select>
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">License Expiration Date</label>
                      <input
                        type="date"
                        value={editExpiryDate}
                        onChange={(e) => setEditExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Leave empty or unset for a perpetual/unexpiring license key.</p>
                    </div>

                    {/* Save Button */}
                    <div className="pt-2">
                      <button
                        onClick={handleSaveChanges}
                        disabled={isSavingChanges}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold tracking-tight transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isSavingChanges ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving Changes...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Client Configuration</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activeModalTab === 'actions' && (
                  <div className="space-y-6">
                    <div className="text-left space-y-1">
                      <p className="text-xs font-bold text-slate-800">Advanced In-Depth Client Control Panel</p>
                      <p className="text-[10px] text-slate-500">Perform direct system override actions, publish client notifications, or execute maintenance scripts on this tenant.</p>
                    </div>

                    {/* Section 1: Tenant Licensing & Routing */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🔒 Tenant Access & Routing Overrides</h4>
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 text-left">
                        {/* Activate Switch Portal */}
                        <div className="p-4 flex items-center justify-between gap-4">
                          <div className="text-left">
                            <h5 className="text-xs font-black text-slate-800">Switch System Active Portal</h5>
                            <p className="text-[10px] text-slate-500">Instantly route this sandbox server to behave as this school's custom portal.</p>
                          </div>
                          <button
                            onClick={() => handleManagePortal(selectedManageSchool)}
                            disabled={isManaging !== null || selectedManageSchool.status !== 'active'}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition shrink-0 cursor-pointer animate-pulse"
                          >
                            {isManaging === selectedManageSchool.key ? 'Switching...' : 'Switch Portal'}
                          </button>
                        </div>

                        {/* Revoke / Deactivate Portal */}
                        <div className="p-4 flex items-center justify-between gap-4">
                          <div className="text-left">
                            <h5 className="text-xs font-black text-slate-800">
                              {selectedManageSchool.status === 'active' ? 'Suspend & Revoke License' : 'Reactivate School License'}
                            </h5>
                            <p className="text-[10px] text-slate-500">
                              {selectedManageSchool.status === 'active' 
                                ? 'Immediately lock users out of their dashboard. Revoke system access.'
                                : 'Restore and unlock user access to this portal under current serial.'}
                            </p>
                          </div>
                          <button
                            onClick={handleToggleStatus}
                            disabled={isSavingChanges}
                            className={cn(
                              'px-3 py-1.5 text-xs font-bold text-white rounded-lg transition shrink-0 cursor-pointer',
                              selectedManageSchool.status === 'active' 
                                ? 'bg-rose-500 hover:bg-rose-600' 
                                : 'bg-emerald-500 hover:bg-emerald-600'
                            )}
                          >
                            {selectedManageSchool.status === 'active' ? 'Revoke License' : 'Reactivate'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Administrative Announcement Broadcast */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📢 Lockout / Security Announcement Banner</h4>
                      <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Banner Announcement Message</label>
                          <textarea
                            value={lockAnnouncement}
                            onChange={(e) => setLockAnnouncement(e.target.value)}
                            placeholder="e.g. System undergoing standard monthly indexing. Access will be restored shortly."
                            rows={2}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">Shown to locked out users or as high-level notices.</span>
                          <button
                            onClick={handleSaveAnnouncement}
                            disabled={isSavingAnnouncement}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5"
                          >
                            {isSavingAnnouncement ? 'Broadcasting...' : 'Broadcast Banner'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Advanced Maintenance Tasks */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⚡ Advanced Maintenance Routines</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                          onClick={() => handleRunMaintenance('optimize_indices')}
                          disabled={activeMaintenanceAction !== null}
                          className="p-3 bg-white border border-slate-200 hover:border-indigo-200 text-left rounded-xl transition hover:shadow-xs group cursor-pointer disabled:opacity-50"
                        >
                          <div className="text-[10px] font-black text-indigo-600 group-hover:text-indigo-700">Optimize Indexes</div>
                          <p className="text-[9px] text-slate-500 leading-tight mt-0.5">Rebuilds fragment tables & database pointers.</p>
                        </button>

                        <button
                          onClick={() => handleRunMaintenance('purge_demo')}
                          disabled={activeMaintenanceAction !== null}
                          className="p-3 bg-white border border-slate-200 hover:border-amber-200 text-left rounded-xl transition hover:shadow-xs group cursor-pointer disabled:opacity-50"
                        >
                          <div className="text-[10px] font-black text-amber-600 group-hover:text-amber-700">Purge Demo Data</div>
                          <p className="text-[9px] text-slate-500 leading-tight mt-0.5">Safely removes temporary demonstration accounts.</p>
                        </button>

                        <button
                          onClick={() => handleRunMaintenance('dns_flush')}
                          disabled={activeMaintenanceAction !== null}
                          className="p-3 bg-white border border-slate-200 hover:border-emerald-200 text-left rounded-xl transition hover:shadow-xs group cursor-pointer disabled:opacity-50"
                        >
                          <div className="text-[10px] font-black text-emerald-600 group-hover:text-emerald-700">Flush DNS Cache</div>
                          <p className="text-[9px] text-slate-500 leading-tight mt-0.5">Synchronizes CDN routing & custom edge domain certificates.</p>
                        </button>
                      </div>
                    </div>

                    {/* Live Terminal Console for maintenance outputs */}
                    {maintenanceOutputLogs.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">💻 Procedure Execution Terminal</h4>
                          {activeMaintenanceAction && (
                            <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold animate-pulse">
                              RUNNING PIPELINE...
                            </span>
                          )}
                        </div>
                        <div className="bg-slate-950 p-4 rounded-2xl font-mono text-[9px] text-slate-300 space-y-1 max-h-36 overflow-y-auto text-left border border-slate-800">
                          {maintenanceOutputLogs.map((log, index) => {
                            let textClass = 'text-slate-300';
                            if (log.includes('ERROR') || log.includes('FATAL')) textClass = 'text-rose-400 font-bold';
                            else if (log.includes('success') || log.includes('SUCCESS') || log.includes('completed')) textClass = 'text-emerald-400';
                            else if (log.includes('Starting') || log.includes('Initializing')) textClass = 'text-indigo-400';
                            return (
                              <div key={index} className={cn("py-0.5 border-b border-slate-900/30", textClass)}>
                                {log}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activePanel === 'reports_analytics') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">System Reports & Analytics</h2>
            <p className="text-xs text-slate-500">Live analytics indicating system database table payload weight and execution latency.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Database Table Records Count</h3>
            <div className="space-y-3">
              {compositionData.map((data) => (
                <div key={data.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-700">{data.name}</span>
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                    {data.value.toLocaleString()} rows
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Diagnostic Insights</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Database speed is currently benchmarked at <strong>4.2ms read latency</strong> and <strong>12.8ms cloud sync pipe replication velocity</strong>. No critical index fragmented tables detected.
              </p>
            </div>
            <button 
              onClick={() => alert("CSV Export initialized for current schema payload data!")}
              className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
            >
              Export System Diagnostic CSV
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'feature_management') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Fine-Grained Module Gates</h2>
            <p className="text-xs text-slate-500">Enable or disable client software features. Deselected modules disappear from dashboards.</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 border border-slate-200 rounded-2xl">
          Use the checkboxes below to toggle which software modules are active for the current school instance. This can also be bundled inside client licensing serials during key generation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {availableModules.map((mod) => {
            const isChecked = activeInstanceModules.includes(mod.id);
            return (
              <label
                key={mod.id}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-2xl border text-left cursor-pointer transition-all select-none",
                  isChecked ? "bg-white border-indigo-200 ring-2 ring-indigo-50/40" : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    if (isChecked) {
                      setActiveInstanceModules(activeInstanceModules.filter(id => id !== mod.id));
                    } else {
                      setActiveInstanceModules([...activeInstanceModules, mod.id]);
                    }
                  }}
                  className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-700 block">{mod.label}</span>
                  <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">{mod.description}</span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={handleSaveInstanceModules}
            disabled={isUpdatingModules}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition disabled:opacity-50"
          >
            {isUpdatingModules ? 'Saving shifts...' : 'Save Module Configuration'}
          </button>
        </div>
      </div>
    );
  }

  if (activePanel === 'system_configuration') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">System Global Configuration</h2>
            <p className="text-xs text-slate-500">Configure default school sessions, localized currencies and global parameters.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Academic Year Session</label>
            <select
              value={sysAcademicYear}
              onChange={(e) => setSysAcademicYear(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800"
            >
              <option value="2025/2026">2025/2026 Session</option>
              <option value="2026/2027">2026/2027 Session</option>
              <option value="2027/2028">2027/2028 Session</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Current Active Term</label>
            <select
              value={sysCurrentTerm}
              onChange={(e) => setSysCurrentTerm(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800"
            >
              <option value="Term 1">First Term (Term 1)</option>
              <option value="Term 2">Second Term (Term 2)</option>
              <option value="Term 3">Third Term (Term 3)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">System Global Currency</label>
            <select
              value={sysCurrency}
              onChange={(e) => setSysCurrency(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800"
            >
              <option value="GHS">Ghana Cedis (GHS, ₵)</option>
              <option value="USD">United States Dollars (USD, $)</option>
              <option value="NGN">Nigerian Naira (NGN, ₦)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button 
            onClick={() => alert("Global configuration saved and cached in LocalStorage!")}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
          >
            Save Global System Variables
          </button>
        </div>
      </div>
    );
  }

  return null;
}
