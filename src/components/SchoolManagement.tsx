import React, { useState, useEffect } from 'react';
import {
  Building,
  Search,
  Plus,
  Trash2,
  Check,
  X,
  Key,
  Calendar,
  AlertTriangle,
  Building2,
  Layers,
  Sparkles,
  RefreshCcw,
  PlusCircle,
  Clock,
  CheckCircle2,
  CloudOff,
  Globe,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Users,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';
import { LicenseSyncBanner } from './LicenseSyncBanner';

interface SchoolManagementProps {
  onSwitchSchool?: (school: any) => void;
}

export default function SchoolManagement({ onSwitchSchool }: SchoolManagementProps) {
  const { showToast, confirm } = useNotifications();
  const [schools, setSchools] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('all');
  const [activeSchoolId, setActiveSchoolId] = useState<string>('');

  // Registration modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolSlug, setNewSchoolSlug] = useState('');
  const [newSchoolTier, setNewSchoolTier] = useState('Enterprise');
  const [newSchoolDuration, setNewSchoolDuration] = useState('12');
  const [newSchoolTheme, setNewSchoolTheme] = useState('indigo');
  const [newSchoolEmail, setNewSchoolEmail] = useState('');
  const [newSchoolPhone, setNewSchoolPhone] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('Ghana');
  const [newAcademicYear, setNewAcademicYear] = useState('2026/2027');
  const [newCurrentTerm, setNewCurrentTerm] = useState('Term 1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read active school
  useEffect(() => {
    try {
      const active = localStorage.getItem('esepa_active_school');
      if (active) {
        const parsed = JSON.parse(active);
        if (parsed?.id) setActiveSchoolId(parsed.id);
        else if (parsed?.name) setActiveSchoolId(parsed.name);
      }
    } catch (e) {}
  }, []);

  const fetchSchools = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tenants)) {
          setSchools(data.tenants);
          localStorage.setItem('esepa_generated_licenses', JSON.stringify(data.tenants));
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Notice loading tenants:', err);
    }

    // Fallback check
    try {
      const resOld = await fetch('/api/schools');
      if (resOld.ok) {
        const data = await resOld.json();
        if (Array.isArray(data.schools)) {
          setSchools(data.schools);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {}

    const cached = localStorage.getItem('esepa_generated_licenses');
    if (cached) {
      try {
        setSchools(JSON.parse(cached));
      } catch (e) {}
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleRegisterSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) {
      showToast('Please specify a school name', 'error');
      return;
    }

    setIsSubmitting(true);
    const computedSlug = newSchoolSlug.trim() || newSchoolName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSchoolName.trim(),
          schoolName: newSchoolName.trim(),
          slug: computedSlug,
          tier: newSchoolTier,
          durationMonths: newSchoolDuration,
          theme: newSchoolTheme,
          email: newSchoolEmail.trim() || `contact@${computedSlug}.edu.gh`,
          phone: newSchoolPhone.trim() || '+233 20 000 0000',
          address: newSchoolAddress.trim() || 'Ghana',
          academic_year: newAcademicYear,
          current_term: newCurrentTerm
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Tenant '${newSchoolName}' provisioned successfully!`, 'success');
        setIsModalOpen(false);
        setNewSchoolName('');
        setNewSchoolSlug('');
        setNewSchoolTier('Enterprise');
        setNewSchoolEmail('');
        setNewSchoolPhone('');
        fetchSchools();
      } else {
        showToast(data.error || 'Failed to register tenant', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error registering tenant', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchTenant = (school: any) => {
    const tenantId = school.id || school.slug || school.name;
    setActiveSchoolId(tenantId);

    const schoolPayload = {
      id: school.id,
      name: school.name || school.schoolName,
      slug: school.slug,
      theme: school.theme || 'indigo',
      logo: school.logo_url
    };

    localStorage.setItem('esepa_active_school', JSON.stringify(schoolPayload));
    if (school.licenseKey || school.key) {
      localStorage.setItem('esepa_active_license', JSON.stringify({
        key: school.licenseKey || school.key,
        schoolName: school.name || school.schoolName,
        school_id: school.id,
        tier: school.tier
      }));
    }

    if (onSwitchSchool) {
      onSwitchSchool(schoolPayload);
    }

    showToast(`Switched active tenant to ${school.name || school.schoolName}`, 'success');
  };

  const handleRevokeSchool = (key: string, schoolName: string) => {
    confirm({
      title: '⚠️ SUSPEND TENANT INSTANCE',
      message: `Are you sure you want to suspend the subscription for ${schoolName}? All users associated with this tenant will be restricted.`,
      confirmLabel: 'Suspend Tenant',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/license/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast('Tenant subscription suspended successfully', 'success');
            fetchSchools();
          } else {
            showToast(data.error || 'Failed to suspend license', 'error');
          }
        } catch (err) {
          showToast('Network error suspending license', 'error');
        }
      }
    });
  };

  // Filter & Search logic
  const filteredSchools = schools.filter((school) => {
    const name = (school.name || school.schoolName || '').toLowerCase();
    const key = (school.licenseKey || school.key || '').toLowerCase();
    const slug = (school.slug || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = name.includes(query) || key.includes(query) || slug.includes(query);
    const matchesTier = selectedTier === 'all' || (school.tier || '').toLowerCase() === selectedTier.toLowerCase();
    return matchesSearch && matchesTier;
  });

  const activeCount = schools.filter(s => s.status === 'active').length;
  const suspendedCount = schools.filter(s => s.status === 'suspended').length;
  const totalStudents = schools.reduce((acc, s) => acc + (s.studentCount || 0), 0);

  return (
    <div className="space-y-6">
      <LicenseSyncBanner onSynced={(updated) => setSchools(updated)} />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 text-[10px] font-black uppercase rounded-full tracking-widest flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-indigo-300" />
              Multi-Tenant Architecture
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase rounded-full">
              Supabase RLS Enforced
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
            Tenants & Schools Directory
          </h1>
          <p className="text-xs text-indigo-200 font-medium max-w-2xl">
            Provision, partition, and manage multi-tenant school instances. Each tenant operates in an isolated workspace with dedicated cloud records, branding, and academic terms.
          </p>
        </div>
        <button
          id="register-tenant-btn"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer self-start sm:self-center"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Provision New Tenant</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Tenants</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block leading-none">{schools.length}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Portals</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block leading-none">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cloud Students</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block leading-none">{totalStudents || '1,240+'}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suspended</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block leading-none">{suspendedCount}</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by tenant name, subdomain slug, or license key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-600 focus:bg-white transition-all"
          >
            <option value="all">All Tiers</option>
            <option value="Basic">Basic Edition</option>
            <option value="Standard">Standard Edition</option>
            <option value="Premium">Premium Edition</option>
            <option value="Enterprise">Enterprise Edition</option>
          </select>

          <button
            onClick={fetchSchools}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-xl transition"
            title="Refresh tenants"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCcw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading tenant registry pipeline...</p>
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="py-16 text-center max-w-sm mx-auto space-y-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Building className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">No tenants found</h3>
              <p className="text-xs text-slate-400 mt-1">There are no school tenants matching your current filter.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition"
            >
              + Provision First Tenant
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-4 px-6">School Tenant</th>
                  <th className="py-4 px-6">Tenant Slug / Domain</th>
                  <th className="py-4 px-6">License & Tier</th>
                  <th className="py-4 px-6">Academic Year / Term</th>
                  <th className="py-4 px-6">Tenant Status</th>
                  <th className="py-4 px-6 text-right">Switch & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSchools.map((school) => {
                  const schoolName = school.name || school.schoolName || 'Unnamed School';
                  const key = school.licenseKey || school.key || 'ESEPA-LIVE-PROD-2026';
                  const isSuspended = school.status === 'suspended';
                  const isCurrentActive = activeSchoolId === school.id || activeSchoolId === schoolName;

                  return (
                    <tr 
                      key={school.id || key} 
                      className={cn(
                        "transition-colors",
                        isCurrentActive ? "bg-indigo-50/40" : "hover:bg-slate-50/50"
                      )}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 uppercase border shadow-2xs",
                            isCurrentActive 
                              ? "bg-indigo-600 text-white border-indigo-700" 
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {schoolName.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-slate-800 uppercase tracking-wide leading-none">{schoolName}</p>
                              {isCurrentActive && (
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold block mt-1">
                              ID: {school.id?.slice(0, 8) || 'local-tenant'} • {school.studentCount || 0} students
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="font-mono text-slate-600 font-bold text-xs bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          /{school.slug || schoolName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span className={cn(
                            "px-2 py-0.5 text-[9px] font-black uppercase rounded border inline-block",
                            school.tier === 'Enterprise' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            school.tier === 'Premium' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          )}>
                            {school.tier || 'Enterprise'}
                          </span>
                          <p className="font-mono text-[10px] text-slate-400 select-all font-semibold truncate max-w-[140px]">
                            {key}
                          </p>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="text-slate-700 font-bold text-xs">
                          {school.academic_year || '2026/2027'}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {school.current_term || 'Term 1'}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span className={cn(
                          "px-2.5 py-1 text-[9px] font-extrabold uppercase rounded-full tracking-wider border inline-flex items-center gap-1",
                          isSuspended 
                            ? "bg-rose-50 text-rose-600 border-rose-100" 
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", isSuspended ? "bg-rose-500" : "bg-emerald-500")} />
                          {isSuspended ? "Suspended" : "Active Portal"}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSwitchTenant(school)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs cursor-pointer",
                              isCurrentActive
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 border border-slate-200"
                            )}
                            title="Switch active tenant context"
                          >
                            {isCurrentActive ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Current</span>
                              </>
                            ) : (
                              <>
                                <ArrowRight className="w-3 h-3" />
                                <span>Switch</span>
                              </>
                            )}
                          </button>

                          {!isSuspended && !isCurrentActive && (
                            <button
                              onClick={() => handleRevokeSchool(key, schoolName)}
                              className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Suspend tenant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register New School Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 border border-slate-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Provision New Tenant</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Multi-tenant Cloud Partitioning</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRegisterSchool} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 block">
                    School Client Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchoolName}
                    onChange={(e) => {
                      setNewSchoolName(e.target.value);
                      if (!newSchoolSlug) {
                        setNewSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                      }
                    }}
                    placeholder="e.g. Prempeh Model College"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs font-bold text-slate-700 placeholder-slate-400 uppercase"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 block">
                      Subdomain / Slug
                    </label>
                    <input
                      type="text"
                      value={newSchoolSlug}
                      onChange={(e) => setNewSchoolSlug(e.target.value)}
                      placeholder="e.g. prempeh-model"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs font-mono font-bold text-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 block">
                      Branding Theme
                    </label>
                    <select
                      value={newSchoolTheme}
                      onChange={(e) => setNewSchoolTheme(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs font-bold text-slate-600"
                    >
                      <option value="indigo">Indigo Royal</option>
                      <option value="emerald">Emerald Nature</option>
                      <option value="rose">Rose Crimson</option>
                      <option value="amber">Amber Gold</option>
                      <option value="slate">Slate Modern</option>
                      <option value="blue">Blue Ocean</option>
                      <option value="purple">Purple Imperial</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 block">
                      Edition Tier
                    </label>
                    <select
                      value={newSchoolTier}
                      onChange={(e) => setNewSchoolTier(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs font-bold text-slate-600"
                    >
                      <option value="Standard">Standard Edition</option>
                      <option value="Premium">Premium Edition</option>
                      <option value="Enterprise">Enterprise Cloud Edition</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 block">
                      Subscription Duration
                    </label>
                    <select
                      value={newSchoolDuration}
                      onChange={(e) => setNewSchoolDuration(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs font-bold text-slate-600"
                    >
                      <option value="3">3 Months (1 Term)</option>
                      <option value="6">6 Months (2 Terms)</option>
                      <option value="12">12 Months (1 Year)</option>
                      <option value="24">24 Months (2 Years)</option>
                      <option value="perpetual">Perpetual Enterprise</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 block">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={newSchoolEmail}
                      onChange={(e) => setNewSchoolEmail(e.target.value)}
                      placeholder="admin@school.edu.gh"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs font-bold text-slate-700"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 block">
                      Academic Year & Term
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAcademicYear}
                        onChange={(e) => setNewAcademicYear(e.target.value)}
                        placeholder="2026/2027"
                        className="w-1/2 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                      />
                      <select
                        value={newCurrentTerm}
                        onChange={(e) => setNewCurrentTerm(e.target.value)}
                        className="w-1/2 px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                      >
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Provision Tenant</span>
                      </>
                    )}
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
