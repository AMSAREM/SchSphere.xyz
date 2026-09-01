import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useNotifications } from '../contexts/NotificationContext';
import { syncTenantAcademicData } from '../lib/api';

export interface Tenant {
  id: string;
  name: string;
  schoolName?: string;
  slug: string;
  theme?: string;
  logo_url?: string;
  tier?: string;
  status?: string;
  licenseKey?: string;
  studentCount?: number;
  academic_year?: string;
  current_term?: string;
}

interface TenantSwitcherProps {
  currentSchoolName: string;
  userRole?: string;
  username?: string;
  onSwitchTenant?: (tenant: Tenant) => void;
  onOpenTenantManagement?: () => void;
}

export default function TenantSwitcher({
  currentSchoolName,
  userRole,
  username,
  onSwitchTenant,
  onOpenTenantManagement
}: TenantSwitcherProps) {
  const { showToast } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Strictly restrict multi-tenant switching to creator accessibility only
  const isCreator = userRole === 'creator' || 
                    username?.toLowerCase() === 'elena' || 
                    username?.toLowerCase() === 'elena_master';

  const fetchTenants = async () => {
    if (!isCreator) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tenants)) {
          setTenants(data.tenants);

          // Find current tenant
          const current = data.tenants.find(
            (t: Tenant) => (t.name || t.schoolName)?.trim().toUpperCase() === currentSchoolName.trim().toUpperCase()
          );
          if (current) {
            setActiveTenantId(current.id);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Notice loading tenants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isCreator) {
      fetchTenants();
    }
  }, [currentSchoolName, isCreator]);

  // Click away listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTenant = (tenant: Tenant) => {
    if (!isCreator) return;
    setActiveTenantId(tenant.id);
    setIsOpen(false);

    // Store active tenant in localStorage
    localStorage.setItem('esepa_active_school', JSON.stringify({
      id: tenant.id,
      name: tenant.name || tenant.schoolName,
      slug: tenant.slug,
      theme: tenant.theme || 'indigo',
      logo: tenant.logo_url
    }));

    if (tenant.licenseKey) {
      localStorage.setItem('esepa_active_license', JSON.stringify({
        key: tenant.licenseKey,
        schoolName: tenant.name || tenant.schoolName,
        school_id: tenant.id,
        tier: tenant.tier
      }));
    }

    if (onSwitchTenant) {
      onSwitchTenant(tenant);
    }

    // Proactively hydrate tenant academic data from Supabase/Server
    if (tenant.id) {
      syncTenantAcademicData(tenant.id).catch(e => console.warn('Academic data sync notice:', e));
    }

    showToast(`Switched active tenant to ${tenant.name || tenant.schoolName}`, 'success');
  };

  // If not a creator, return null so no tenant switcher or badge is rendered for client pages
  if (!isCreator) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        id="tenant-switcher-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchTenants();
        }}
        title="Creator Multi-Tenant Hub: Switch active school tenant"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all select-none border text-left bg-white hover:bg-slate-50 border-slate-200 shadow-2xs cursor-pointer group"
      >
        <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
            {currentSchoolName || "ESEPA ACADEMY"}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-bold text-indigo-600 font-extrabold uppercase tracking-wider">
              Creator Multi-Tenant
            </span>
          </div>
        </div>

        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ml-1",
          isOpen && "rotate-180 text-indigo-600"
        )} />
      </button>

      {/* Multi-Tenant Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-150 p-2 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Multi-Tenant Switcher
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  {tenants.length} Registered School Tenants
                </p>
              </div>
              <button
                onClick={fetchTenants}
                disabled={isLoading}
                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                title="Refresh tenants"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-indigo-600")} />
              </button>
            </div>

            {/* Tenant list */}
            <div className="max-h-64 overflow-y-auto py-1.5 space-y-1">
              {isLoading && tenants.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">
                  Loading school tenants...
                </div>
              ) : tenants.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  No registered tenants found.
                </div>
              ) : (
                tenants.map((tenant) => {
                  const isSelected = 
                    activeTenantId === tenant.id || 
                    (tenant.name || tenant.schoolName)?.trim().toUpperCase() === currentSchoolName.trim().toUpperCase();

                  return (
                    <button
                      key={tenant.id || tenant.slug}
                      onClick={() => handleSelectTenant(tenant)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group",
                        isSelected
                          ? "bg-indigo-50/90 text-indigo-900 border border-indigo-100"
                          : "hover:bg-slate-50 text-slate-700 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 uppercase border",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                        )}>
                          {(tenant.name || tenant.schoolName)?.slice(0, 2) || "SC"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight truncate leading-snug">
                            {tenant.name || tenant.schoolName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono font-semibold text-slate-400 truncate">
                              /{tenant.slug}
                            </span>
                            {tenant.tier && (
                              <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[8px] font-black rounded uppercase">
                                {tenant.tier}
                              </span>
                            )}
                            {tenant.studentCount !== undefined && tenant.studentCount > 0 && (
                              <span className="text-[9px] text-slate-400 font-bold">
                                • {tenant.studentCount} students
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-2 border-t border-slate-100 bg-slate-50/50 rounded-xl flex items-center justify-between gap-2 mt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenTenantManagement) onOpenTenantManagement();
                }}
                className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>+ Provision Tenant</span>
              </button>
              
              {onOpenTenantManagement && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenTenantManagement();
                  }}
                  className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                >
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                  <span>Tenants Hub</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
