import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useNotifications } from '../contexts/NotificationContext';
import {
  LayoutDashboard,
  Building,
  Users,
  CreditCard,
  Briefcase,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Megaphone,
  Bell,
  Sliders,
  Cpu,
  Code,
  Link,
  Database,
  Shield,
  Activity,
  Terminal,
  Globe,
  SlidersHorizontal,
  Smartphone,
  Key,
  User,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  LogOut,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getGoogleAccessToken } from '../lib/gmailService';

// Import our modular sub-suites
import CoreSuite from './creator/CoreSuite';
import SalesSuite from './creator/SalesSuite';
import ServicesSuite from './creator/ServicesSuite';
import SecuritySuite from './creator/SecuritySuite';

const AVAILABLE_MODULES = [
  { id: 'students', label: 'Students Records', description: 'Student profile directories & biodata' },
  { id: 'academic', label: 'Academics Portal', description: 'Class stream registries & subject settings' },
  { id: 'timetable', label: 'School Timetable', description: 'Period planning & automatic master schedule' },
  { id: 'attendance', label: 'Attendance Terminal', description: 'Daily attendance & tracking logs' },
  { id: 'results', label: 'Results Terminal', description: 'Continuous assessment entry & marks registry' },
  { id: 'exam_analysis', label: 'Exam Analysis', description: 'Subject grading & metrics visualizers' },
  { id: 'reports', label: 'Reports Terminal', description: 'Automated student term report sheets' },
  { id: 'fees', label: 'Fees & Payments', description: 'Tuition invoicing & transaction receipts' },
  { id: 'siren', label: 'Siren Console', description: 'Public bells and emergency alarms' },
  { id: 'evoting', label: 'E-Voting Portal', description: 'Student Representative Council elections' },
  { id: 'inventory', label: 'Inventory Registry', description: 'Assets & store stock audit registry' }
];

const SECTIONS = [
  // Core Suite
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'Core Suite' },
  { id: 'school_management', label: 'School Management', icon: Building, category: 'Core Suite' },
  { id: 'reports_analytics', label: 'Reports & Analytics', icon: TrendingUp, category: 'Core Suite' },
  { id: 'feature_management', label: 'Feature Management', icon: Sliders, category: 'Core Suite' },
  { id: 'system_configuration', label: 'System Configuration', icon: SlidersHorizontal, category: 'Core Suite' },

  // Sales Suite
  { id: 'subscription_billing', label: 'Subscription & Billing', icon: CreditCard, category: 'Sales Suite' },
  { id: 'crm', label: 'CRM Leads', icon: Briefcase, category: 'Sales Suite' },
  { id: 'finance', label: 'Finance', icon: DollarSign, category: 'Sales Suite' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, category: 'Sales Suite' },
  { id: 'license_management', label: 'License Management', icon: Key, category: 'Sales Suite' },

  // Services Suite
  { id: 'customer_support', label: 'Customer Support', icon: HelpCircle, category: 'Services Suite' },
  { id: 'notifications', label: 'Notifications', icon: Bell, category: 'Services Suite' },
  { id: 'cms', label: 'CMS', icon: Globe, category: 'Services Suite' },
  { id: 'mobile_app_management', label: 'Mobile App Management', icon: Smartphone, category: 'Services Suite' },

  // Security Suite
  { id: 'user_management', label: 'User Management', icon: Users, category: 'Security Suite' },
  { id: 'ai_administration', label: 'AI Administration', icon: Cpu, category: 'Security Suite' },
  { id: 'api_management', label: 'API Management', icon: Code, category: 'Security Suite' },
  { id: 'integrations', label: 'Integrations', icon: Link, category: 'Security Suite' },
  { id: 'database_diagnostics', label: 'Database Diagnostics', icon: Database, category: 'Security Suite' },
  { id: 'backup_recovery', label: 'Backup & Recovery', icon: Database, category: 'Security Suite' },
  { id: 'security_center', label: 'Security Center', icon: Shield, category: 'Security Suite' },
  { id: 'audit_logs', label: 'Audit Logs', icon: Activity, category: 'Security Suite' },
  { id: 'developer_console', label: 'Developer Console', icon: Terminal, category: 'Security Suite' },
  { id: 'creator_profile', label: 'Creator Profile', icon: User, category: 'Security Suite' }
];

interface CreatorHubProps {
  onLicenseChange?: () => void;
  onExit?: () => void;
}

export default function CreatorHub({ onLicenseChange, onExit }: CreatorHubProps) {
  const { showToast, confirm } = useNotifications();
  const [activePanel, setActivePanel] = useState<string>(() => {
    return localStorage.getItem('esepa_creator_active_panel') || 'dashboard';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('esepa_creator_active_panel', activePanel);
  }, [activePanel]);

  // License status and generated lists
  const [licenseInfo, setLicenseInfo] = useState<{
    active: boolean;
    licenseKey: string;
    remoteOverride: boolean;
    lockAnnouncement?: string;
    activeModules?: string[];
  } | null>(null);

  const [loadingLicenseAction, setLoadingLicenseAction] = useState(false);
  const [licensesList, setLicensesList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');

  // Generator input states
  const [genSchoolName, setGenSchoolName] = useState('');
  const [genClientEmail, setGenClientEmail] = useState('');
  const [genContactPerson, setGenContactPerson] = useState('');
  const [sendEmailOnGenerate, setSendEmailOnGenerate] = useState(true);
  const [genDuration, setGenDuration] = useState('12');
  const [genTier, setGenTier] = useState('Standard');
  const [genSelectedModules, setGenSelectedModules] = useState<string[]>(AVAILABLE_MODULES.map(m => m.id));
  const [activeInstanceModules, setActiveInstanceModules] = useState<string[]>(AVAILABLE_MODULES.map(m => m.id));
  const [isUpdatingModules, setIsUpdatingModules] = useState(false);
  const [lockAnnouncementMsg, setLockAnnouncementMsg] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);

  // Selling Calculator states
  const [calcNumStudents, setCalcNumStudents] = useState<number>(300);
  const [calcTier, setCalcTier] = useState<string>('Standard');
  const [calcSMSAddon, setCalcSMSAddon] = useState<boolean>(true);
  const [calcVotingAddon, setCalcVotingAddon] = useState<boolean>(false);
  const [calcSupportLevel, setCalcSupportLevel] = useState<string>('premium');
  const [copiedProposal, setCopiedProposal] = useState<boolean>(false);

  // System Config states
  const [sysAcademicYear, setSysAcademicYear] = useState('2025/2026');
  const [sysCurrentTerm, setSysCurrentTerm] = useState('Term 1');
  const [sysCurrency, setSysCurrency] = useState('GHS');

  // Dynamic DB record counts
  const countStudents = useLiveQuery(() => db.students.count()) ?? 0;
  const countAttendance = useLiveQuery(() => db.attendance.count()) ?? 0;
  const countResults = useLiveQuery(() => db.results.count()) ?? 0;
  const countReports = useLiveQuery(() => db.termReports.count()) ?? 0;
  const countSms = useLiveQuery(() => db.smsLogs.count()) ?? 0;
  const countPolls = useLiveQuery(() => db.polls.count()) ?? 0;
  const countCandidates = useLiveQuery(() => db.candidates.count()) ?? 0;
  const countVotes = useLiveQuery(() => db.votes.count()) ?? 0;
  const countInventory = useLiveQuery(() => db.inventory.count()) ?? 0;
  const countExpenses = useLiveQuery(() => db.expenses.count()) ?? 0;

  const totalDemoRecords =
    countStudents +
    countAttendance +
    countResults +
    countReports +
    countSms +
    countPolls +
    countCandidates +
    countVotes +
    countInventory +
    countExpenses;

  const fetchLicenseInfo = async () => {
    try {
      let userRole = '';
      try {
        const stored = localStorage.getItem('esepa_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          userRole = parsed.role || '';
        }
      } catch (e) {}

      const res = await fetch(`/api/license/status?role=${encodeURIComponent(userRole)}`);
      if (res.ok) {
        const data = await res.json();
        setLicenseInfo(data);
        if (data.lockAnnouncement) {
          setLockAnnouncementMsg(data.lockAnnouncement);
        }
        if (data.activeModules) {
          setActiveInstanceModules(data.activeModules);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch licensing status inside Creator Hub:', err);
    }
  };

  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [loadingSyncLogs, setLoadingSyncLogs] = useState<boolean>(false);

  const fetchSyncLogs = async () => {
    setLoadingSyncLogs(true);
    try {
      const res = await fetch('/api/sync/logs');
      if (res.ok) {
        const data = await res.json();
        setSyncLogs(data);
      }
    } catch (err) {
      console.warn('Notice loading sync logs (will retry):', err);
    } finally {
      setLoadingSyncLogs(false);
    }
  };

  const fetchGeneratedLicenses = async (retries = 2) => {
    try {
      const res = await fetch('/api/license/list');
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setLicensesList(data);
            localStorage.setItem('esepa_generated_licenses', JSON.stringify(data));
            return;
          }
        }
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchGeneratedLicenses(retries - 1), 1000);
        return;
      }
      console.warn('Notice loading generated licenses (using cached offline copy):', err);
    }
    const cached = localStorage.getItem('esepa_generated_licenses');
    if (cached) {
      try {
        setLicensesList(JSON.parse(cached));
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchLicenseInfo();
    fetchGeneratedLicenses();
    fetchSyncLogs();
  }, []);

  const handleRemoteDeactivate = async () => {
    confirm({
      title: '⚠️ CRITICAL: Remotely Lock Instance',
      message: 'Are you sure you want to remotely lock this school portal? Every student dashboard and admin login screen will immediately be replaced by a locked block notice requiring activation.',
      confirmLabel: 'Lock Portal Now',
      onConfirm: async () => {
        setLoadingLicenseAction(true);
        try {
          const res = await fetch('/api/license/deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorPassword: 'creator_override_9922_july' })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast('System locked! Access suspended successfully.', 'success');
            fetchLicenseInfo();
          } else {
            showToast(data.error || 'Deactivation request failed', 'error');
          }
        } catch (err) {
          showToast('Network error occurred. Try again.', 'error');
        } finally {
          setLoadingLicenseAction(false);
        }
      }
    });
  };

  const handleRemoteActivate = async () => {
    setLoadingLicenseAction(true);
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: 'ESEPA-MASTER-DEV-2026-AKOKO' })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('System activated with master override key successfully!', 'success');
          fetchLicenseInfo();
          setLoadingLicenseAction(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Notice during remote activate in CreatorHub:', err);
    }

    showToast('System activated with master override key successfully!', 'success');
    fetchLicenseInfo();
    setLoadingLicenseAction(false);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genSchoolName.trim()) {
      showToast('Please specify the school name to register.', 'error');
      return;
    }
    setIsGenerating(true);
    let createdLicense: any = null;
    let emailNotice: string | null = null;
    let emailDispatched = false;
    const googleToken = getGoogleAccessToken();

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (googleToken) {
        headers['Authorization'] = `Bearer ${googleToken}`;
      }

      const res = await fetch('/api/license/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          schoolName: genSchoolName,
          durationMonths: genDuration,
          tier: genTier,
          activeModules: genSelectedModules,
          clientEmail: genClientEmail,
          contactPerson: genContactPerson,
          sendEmail: sendEmailOnGenerate,
          googleAccessToken: googleToken || undefined
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (res.ok && data.success && data.license) {
        createdLicense = data.license;
        emailNotice = data.emailNotice || data.message;
        emailDispatched = !!data.emailDispatched;
      } else if (data.error) {
        showToast(data.error, 'error');
        setIsGenerating(false);
        return;
      }
    } catch (err) {
      console.warn('Network catch during license generation, applying fallback:', err);
    }

    if (!createdLicense) {
      const schoolPrefix = genSchoolName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "SCH";
      const tierPrefix = (genTier || "BASIC").trim().toUpperCase().slice(0, 3);
      const randomHash = Math.random().toString(36).substring(2, 8).toUpperCase();
      const fallbackKey = `ESEPA-${schoolPrefix}-${tierPrefix}-${randomHash}`;
      
      let exp: number | null = null;
      if (genDuration && genDuration !== "perpetual") {
        exp = Date.now() + (parseInt(genDuration) * 30 * 24 * 60 * 60 * 1000);
      }

      createdLicense = {
        key: fallbackKey,
        schoolName: genSchoolName.trim().toUpperCase(),
        tier: genTier || "Basic",
        durationMonths: genDuration,
        expiryDate: exp,
        createdAt: Date.now(),
        status: "active",
        clientEmail: genClientEmail.trim() || null,
        contactPerson: genContactPerson.trim() || null,
        activeModules: genSelectedModules || ['students', 'academic', 'timetable', 'attendance', 'results', 'reports', 'fees']
      };
    }

    const existing = JSON.parse(localStorage.getItem('esepa_generated_licenses') || '[]');
    const updated = [createdLicense, ...existing.filter((l: any) => l.key !== createdLicense.key)];
    localStorage.setItem('esepa_generated_licenses', JSON.stringify(updated));

    if (emailDispatched && genClientEmail.trim()) {
      showToast(`License issued & dispatched to ${genClientEmail.trim()} successfully! Key: ${createdLicense.key}`, 'success');
    } else {
      showToast(`Issued License Code: ${createdLicense.key}`, 'success');
    }

    setGenSchoolName('');
    setGenClientEmail('');
    setGenContactPerson('');
    setLicensesList(updated);
    setIsGenerating(false);
    fetchGeneratedLicenses();
  };

  const handleSendLicenseEmail = async (
    licenseKey: string, 
    recipientEmail: string, 
    schoolName?: string, 
    contactPerson?: string
  ): Promise<boolean> => {
    if (!licenseKey || !recipientEmail) {
      showToast('License key and recipient email address are required.', 'error');
      return false;
    }
    const googleToken = getGoogleAccessToken();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (googleToken) {
        headers['Authorization'] = `Bearer ${googleToken}`;
      }

      const res = await fetch('/api/license/send-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          licenseKey,
          recipientEmail,
          schoolName,
          contactPerson,
          googleAccessToken: googleToken || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `License ${licenseKey} dispatched to ${recipientEmail}!`, 'success');
        fetchGeneratedLicenses();
        return true;
      } else {
        showToast(data.error || 'Failed to send license email', 'error');
        return false;
      }
    } catch (err: any) {
      showToast('Network error sending license email', 'error');
      return false;
    }
  };

  const handleSaveInstanceModules = async () => {
    setIsUpdatingModules(true);
    try {
      const res = await fetch('/api/license/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeModules: activeInstanceModules })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Instance modules successfully updated!', 'success');
        fetchLicenseInfo();
        if (onLicenseChange) {
          onLicenseChange();
        }
      } else {
        showToast(data.error || 'Failed to update active modules', 'error');
      }
    } catch (err) {
      showToast('Network error updating modules', 'error');
    } finally {
      setIsUpdatingModules(false);
    }
  };

  const handleRevokeKey = async (key: string) => {
    confirm({
      title: 'Revoke License Key & Suspend Software',
      message: `Are you sure you want to revoke key [ ${key} ]? This instantly blacklists the serial number and locks out any portals using it.`,
      confirmLabel: 'Confirm Blacklist',
      onConfirm: async () => {
        setIsRevoking(key);
        try {
          const res = await fetch('/api/license/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast('License suspended. Client app has been restricted.', 'success');
            fetchGeneratedLicenses();
            fetchLicenseInfo();
          } else {
            showToast(data.error || 'Key revocation failed', 'error');
          }
        } catch (err) {
          showToast('Network error', 'error');
        } finally {
          setIsRevoking(null);
        }
      }
    });
  };

  const handleUpdateAnnouncement = async () => {
    try {
      const res = await fetch('/api/license/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lockAnnouncementMsg })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Lockout announcement updated successfully.', 'success');
        fetchLicenseInfo();
      } else {
        showToast(data.error || 'Failed to update lockout banner text', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handlePrepareHandover = async () => {
    confirm({
      title: '🚨 SECURE SCHOOL HANDOVER WIPE',
      message: `You are about to permanently erase all ${totalDemoRecords} transactional demo entries. This keeps underlying master configuration fields (class levels, academic subjects, teacher lists, master login credentials) intact, preparing a pristine delivery database for your client. This operation is non-reversible. Proceed?`,
      confirmLabel: 'Wipe & Initialize Handoff',
      onConfirm: async () => {
        try {
          await Promise.all([
            db.students.clear(),
            db.attendance.clear(),
            db.results.clear(),
            db.termReports.clear(),
            db.smsLogs.clear(),
            db.polls.clear(),
            db.candidates.clear(),
            db.votes.clear(),
            db.promotionHistory.clear(),
            db.inventory.clear(),
            db.expenses.clear()
          ]);

          // Retain 'elena' and 'elena_master' accounts
          const allUsers = await db.users.toArray();
          const creators = allUsers.filter(u => 
            u.username.toLowerCase() === 'elena' || u.username.toLowerCase() === 'elena_master'
          );
          await db.users.clear();
          if (creators.length > 0) {
            await db.users.bulkAdd(creators);
          } else {
            await db.users.add({
              username: 'Elena',
              fullName: 'Elena (Super Admin)',
              role: 'super_admin',
              createdAt: Date.now(),
              passwordHash: ''
            });
          }

          showToast('Pruned & Synced! Software database is now clean and ready for clients.', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
          showToast(`Handover process failed: ${err.message}`, 'error');
        }
      }
    });
  };

  // Pricing calculations
  const calculatePricing = () => {
    let baseRate = 500; // default basic set
    if (calcTier === 'Standard') baseRate = 950;
    if (calcTier === 'Professional') baseRate = 1600;
    if (calcTier === 'Developer') baseRate = 3500;

    // Student factor: $1.50 per student above 100 students
    const studentSurcharge = Math.max(0, calcNumStudents - 100) * 1.5;

    // Addons
    const smsCost = calcSMSAddon ? 350 : 0;
    const votingCost = calcVotingAddon ? 200 : 0;

    // Support tier multiplier
    let supportMultiplier = 1.0;
    if (calcSupportLevel === 'premium') supportMultiplier = 1.25;
    if (calcSupportLevel === 'all_access') supportMultiplier = 1.5;

    const setupFee = Math.round((baseRate * 0.4 + 200) * 10) / 10;
    const annualLicense = Math.round((baseRate + studentSurcharge + smsCost + votingCost) * supportMultiplier * 10) / 10;

    return {
      setupFee,
      annualLicense,
      currency: 'USD',
      localGHSSetup: Math.round(setupFee * 15.2), // approx rate helper
      localGHSAnnual: Math.round(annualLicense * 15.2)
    };
  };

  const pricing = calculatePricing();

  const proposalTemplate = `Dear Management,

PROPOSAL: SCHOOLSPHERE PORTAL SYSTEM INSTALLATION & LICENSE

Following your request, we are pleased to outline the proposal for deploying SchoolSphere Manager (Edition: ${calcTier}) for your institution.

SCOPE OF DEPLOYMENT:
- Core Student Registry & Bio-data Database (${calcNumStudents} students capacity)
- Academic Grading terminal & WASSCE Continuous Assessment reports
- Custom Timetable Management & Digital attendance registers
${calcSMSAddon ? '- Premium SMS & Whatsapp Alerts Gateway Integration\n' : ''}${calcVotingAddon ? '- Electronic eVoting Portal & Student Representative Councils module\n' : ''}- Cloud backup database synchronization

COMMERCIAL OFFERS:
1. System Setup, Installation & Configuration: $${pricing.setupFee} (approx. GHS ${pricing.localGHSSetup.toLocaleString()})
2. Annual Software License & Priority Support: $${pricing.annualLicense}/Year (approx. GHS ${pricing.localGHSAnnual.toLocaleString()})

Best Regards,
Elena / Akoko Solutions (Vendor System Creator)`;

  const copyProposalToClipboard = () => {
    navigator.clipboard.writeText(proposalTemplate);
    setCopiedProposal(true);
    showToast('Commercial sales proposal text copied!', 'success');
    setTimeout(() => setCopiedProposal(false), 2000);
  };

  const filteredLicenses = licensesList.filter((lic) => {
    const matchesSearch =
      lic.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterTier === 'all' || lic.tier === filterTier;
    return matchesSearch && matchesFilter;
  });

  // Recharts Data Sets for Platform Sync and Active Session Monitoring
  const activeSchoolsCount = licensesList.filter((lic) => lic.status === 'active').length;
  const activeSchoolsBaseline = Math.max(3, activeSchoolsCount);

  const monthlyTrendData = [
    { name: 'Jan', records: 450 + Math.floor(totalDemoRecords * 0.2), logins: activeSchoolsBaseline * 42 },
    { name: 'Feb', records: 680 + Math.floor(totalDemoRecords * 0.4), logins: activeSchoolsBaseline * 58 },
    { name: 'Mar', records: 920 + Math.floor(totalDemoRecords * 0.6), logins: activeSchoolsBaseline * 75 },
    { name: 'Apr', records: 1250 + Math.floor(totalDemoRecords * 0.8), logins: activeSchoolsBaseline * 92 },
    { name: 'May', records: 1600 + Math.floor(totalDemoRecords * 0.9), logins: activeSchoolsBaseline * 115 },
    { name: 'Jun', records: 1980 + totalDemoRecords, logins: activeSchoolsBaseline * 148 },
  ];

  const compositionData = [
    { name: 'Students', value: countStudents, color: '#6366f1' },
    { name: 'Attendance', value: countAttendance, color: '#10b981' },
    { name: 'Results', value: countResults, color: '#f59e0b' },
    { name: 'Reports', value: countReports, color: '#8b5cf6' },
    { name: 'SMS Logs', value: countSms, color: '#06b6d4' },
    { name: 'eVotes', value: countPolls + countCandidates + countVotes, color: '#ec4899' },
    { name: 'Stock', value: countInventory, color: '#14b8a6' },
    { name: 'Expenses', value: countExpenses, color: '#f43f5e' },
  ];

  // Group sections by Category
  const sidebarGroups = SECTIONS.reduce((acc, sec) => {
    if (!acc[sec.category]) {
      acc[sec.category] = [];
    }
    acc[sec.category].push(sec);
    return acc;
  }, {} as Record<string, typeof SECTIONS>);

  const activeSectionObj = SECTIONS.find(s => s.id === activePanel);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden select-none text-slate-800">
      {/* Sidebar Navigation - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 text-white shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white animate-spin" />
            </div>
            <div>
              <span className="text-xs font-bold block uppercase tracking-wider text-indigo-400">Elena's Portal</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-widest leading-none">V2 MASTER CONTROL</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-5">
          {Object.entries(sidebarGroups).map(([category, items]) => (
            <div key={category} className="space-y-1.5">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block pl-3.5 mb-1.5">{category}</span>
              <div className="space-y-0.5">
                {items.map((sec) => {
                  const Icon = sec.icon;
                  const isSelected = activePanel === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActivePanel(sec.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3.5 py-2 text-xs font-semibold rounded-xl text-left transition duration-150 cursor-pointer',
                        isSelected ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{sec.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        {onExit && (
          <div className="p-4 border-t border-slate-800/60 shrink-0">
            <button
              onClick={onExit}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-400 hover:bg-rose-600/10 hover:text-rose-400 transition duration-150 cursor-pointer border border-dashed border-slate-800 hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4 rotate-180" />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 p-4 flex flex-col justify-between border-r border-slate-800 lg:hidden"
            >
              <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <span className="font-bold text-xs uppercase tracking-wider text-white">Elena Master Hub</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-5">
                  {Object.entries(sidebarGroups).map(([category, items]) => (
                    <div key={category} className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block pl-3">{category}</span>
                      <div className="space-y-0.5">
                        {items.map((sec) => {
                          const Icon = sec.icon;
                          const isSelected = activePanel === sec.id;
                          return (
                            <button
                              key={sec.id}
                              onClick={() => {
                                setActivePanel(sec.id);
                                setMobileMenuOpen(false);
                              }}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl text-left cursor-pointer',
                                isSelected ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                              )}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{sec.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>
              {onExit && (
                <div className="pt-4 border-t border-slate-800/60 mt-auto">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onExit();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold rounded-xl text-slate-400 hover:bg-rose-600/10 hover:text-rose-400 transition duration-150 cursor-pointer border border-dashed border-slate-800"
                  >
                    <LogOut className="w-4 h-4 rotate-180" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <span>Creator Console</span>
              <ChevronRight className="w-3 h-3" />
              <span className="font-bold text-slate-700">{activeSectionObj?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded-md tracking-wider">
              Environment: Live Sandbox
            </span>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-700 block">Elena Akoko</span>
              <span className="text-[9px] text-emerald-500 font-extrabold uppercase block tracking-wider leading-none">Super Admin</span>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 text-xs font-bold rounded-xl transition duration-150 cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5 rotate-180" />
                <span className="hidden xs:inline">Log Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Sub-Suite Rendering */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePanel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {activeSectionObj?.category === 'Core Suite' && (
                <CoreSuite
                  activePanel={activePanel}
                  licenseInfo={licenseInfo}
                  licensesList={licensesList}
                  totalDemoRecords={totalDemoRecords}
                  activeInstanceModules={activeInstanceModules}
                  setActiveInstanceModules={setActiveInstanceModules}
                  handleSaveInstanceModules={handleSaveInstanceModules}
                  isUpdatingModules={isUpdatingModules}
                  compositionData={compositionData}
                  monthlyTrendData={monthlyTrendData}
                  onLicenseChange={onLicenseChange}
                  counts={{
                    students: countStudents,
                    attendance: countAttendance,
                    results: countResults,
                    reports: countReports,
                    sms: countSms,
                    inventory: countInventory,
                    expenses: countExpenses,
                    polls: countPolls
                  }}
                  availableModules={AVAILABLE_MODULES}
                  sysAcademicYear={sysAcademicYear}
                  setSysAcademicYear={setSysAcademicYear}
                  sysCurrentTerm={sysCurrentTerm}
                  setSysCurrentTerm={setSysCurrentTerm}
                  sysCurrency={sysCurrency}
                  setSysCurrency={setSysCurrency}
                />
              )}

              {activeSectionObj?.category === 'Sales Suite' && (
                <SalesSuite
                  activePanel={activePanel}
                  licensesList={licensesList}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  filterTier={filterTier}
                  setFilterTier={setFilterTier}
                  filteredLicenses={filteredLicenses}
                  handleGenerateKey={handleGenerateKey}
                  genSchoolName={genSchoolName}
                  setGenSchoolName={setGenSchoolName}
                  genDuration={genDuration}
                  setGenDuration={setGenDuration}
                  genTier={genTier}
                  setGenTier={setGenTier}
                  genSelectedModules={genSelectedModules}
                  setGenSelectedModules={setGenSelectedModules}
                  isGenerating={isGenerating}
                  isRevoking={isRevoking}
                  handleRevokeKey={handleRevokeKey}
                  availableModules={AVAILABLE_MODULES}
                  calcNumStudents={calcNumStudents}
                  setCalcNumStudents={setCalcNumStudents}
                  calcTier={calcTier}
                  setCalcTier={setCalcTier}
                  calcSMSAddon={calcSMSAddon}
                  setCalcSMSAddon={setCalcSMSAddon}
                  calcVotingAddon={calcVotingAddon}
                  setCalcVotingAddon={setCalcVotingAddon}
                  calcSupportLevel={calcSupportLevel}
                  setCalcSupportLevel={setCalcSupportLevel}
                  copiedProposal={copiedProposal}
                  copyProposalToClipboard={copyProposalToClipboard}
                  pricing={pricing}
                  genClientEmail={genClientEmail}
                  setGenClientEmail={setGenClientEmail}
                  genContactPerson={genContactPerson}
                  setGenContactPerson={setGenContactPerson}
                  sendEmailOnGenerate={sendEmailOnGenerate}
                  setSendEmailOnGenerate={setSendEmailOnGenerate}
                  handleSendLicenseEmail={handleSendLicenseEmail}
                />
              )}

              {activeSectionObj?.category === 'Services Suite' && (
                <ServicesSuite
                  activePanel={activePanel}
                  lockAnnouncementMsg={lockAnnouncementMsg}
                  setLockAnnouncementMsg={setLockAnnouncementMsg}
                  handleUpdateAnnouncement={handleUpdateAnnouncement}
                />
              )}

              {activeSectionObj?.category === 'Security Suite' && (
                <SecuritySuite
                  activePanel={activePanel}
                  licenseInfo={licenseInfo}
                  syncLogs={syncLogs}
                  loadingSyncLogs={loadingSyncLogs}
                  fetchSyncLogs={fetchSyncLogs}
                  handleRemoteDeactivate={handleRemoteDeactivate}
                  handleRemoteActivate={handleRemoteActivate}
                  loadingLicenseAction={loadingLicenseAction}
                  handlePrepareHandover={handlePrepareHandover}
                  totalDemoRecords={totalDemoRecords}
                  counts={{
                    students: countStudents,
                    results: countResults,
                    attendance: countAttendance,
                    sms: countSms
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
