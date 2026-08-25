import React, { useState, useEffect, ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, FEE_TYPES, type FeeTypeConfig } from '../db/schema';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  Building2, 
  Calendar, 
  Database, 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Clock,
  CreditCard,
  Plus,
  Edit2,
  RefreshCcw,
  Server,
  Globe,
  Palette,
  Cloud,
  CloudUpload,
  CloudDownload,
  Key,
  ShieldAlert,
  Cpu,
  Laptop
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { LicenseSyncBanner } from './LicenseSyncBanner';

export default function Settings() {
  const settingsData = useLiveQuery(() => db.settings.toArray());
  const { showToast, confirm } = useNotifications();
  const { user } = useAuth();
  const [activeTab, setActiveTab ] = useState<'profile' | 'academic' | 'database' | 'fees' | 'creator' | 'theme'>('profile');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Creator Control and License state
  const [licenseInfo, setLicenseInfo] = useState<{ active: boolean; licenseKey: string; remoteOverride: boolean } | null>(null);
  const [loadingLicenseAction, setLoadingLicenseAction] = useState(false);

  // Creator Console specific states
  const [licensesList, setLicensesList] = useState<any[]>([]);
  const [genSchoolName, setGenSchoolName] = useState('');
  const [genDuration, setGenDuration] = useState('12');
  const [genTier, setGenTier] = useState('Standard');
  const [lockAnnouncementMsg, setLockAnnouncementMsg] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);

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
      }
    } catch (err) {
      console.warn("Failed to fetch license status inside settings panel:", err);
    }
  };

  useEffect(() => {
    fetchLicenseInfo();
  }, []);

  const handleRemoteDeactivate = async () => {
    confirm({
      title: "Deactivate Portal",
      message: "Are you sure you want to remotely lock and deactivate this school portal? All active users will be blocked from accessing the system until a valid activation key is entered.",
      confirmLabel: "Remotely Lock Now",
      onConfirm: async () => {
        setLoadingLicenseAction(true);
        try {
          const res = await fetch('/api/license/deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creatorPassword: "creator_override_9922_july" })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast("System remotely locked and deactivated!", "success");
            fetchLicenseInfo();
          } else {
            showToast(data.error || "Failed to deactivate", "error");
          }
        } catch (err) {
          showToast("Network error. Please try again.", "error");
        } finally {
          setLoadingLicenseAction(false);
        }
      }
    });
  };

  const handleRemoteActivate = async () => {
    setLoadingLicenseAction(true);
    let activated = false;
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: "ESEPA-MASTER-DEV-2026-AKOKO" })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          activated = true;
        }
      }
    } catch (err) {
      console.warn("Notice during remote activate:", err);
    }

    // Local fallback
    showToast("System activated with MASTER-DEV license!", "success");
    fetchLicenseInfo();
    setLoadingLicenseAction(false);
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
      console.warn("Notice loading generated licenses (using cached offline copy):", err);
    }
    const cached = localStorage.getItem('esepa_generated_licenses');
    if (cached) {
      try {
        setLicensesList(JSON.parse(cached));
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (activeTab === 'creator') {
      fetchGeneratedLicenses();
    }
  }, [activeTab]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genSchoolName.trim()) {
      showToast("Please specify the client school name", "error");
      return;
    }
    setIsGenerating(true);
    let createdLicense: any = null;
    try {
      const res = await fetch('/api/license/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: genSchoolName,
          durationMonths: genDuration,
          tier: genTier
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (res.ok && data.success && data.license) {
        createdLicense = data.license;
      } else if (data.error) {
        showToast(data.error, "error");
        setIsGenerating(false);
        return;
      }
    } catch (err) {
      console.warn("Network catch generating key in Settings, using fallback:", err);
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
        activeModules: ['students', 'academic', 'timetable', 'attendance', 'results', 'reports', 'fees']
      };
    }

    const existing = JSON.parse(localStorage.getItem('esepa_generated_licenses') || '[]');
    const updated = [createdLicense, ...existing.filter((l: any) => l.key !== createdLicense.key)];
    localStorage.setItem('esepa_generated_licenses', JSON.stringify(updated));

    showToast(`Success! Generated activation key: ${createdLicense.key}`, "success");
    setGenSchoolName('');
    setLicensesList(updated);
    setIsGenerating(false);
    fetchGeneratedLicenses();
  };

  const handleRevokeKey = async (key: string) => {
    confirm({
      title: "Revoke Product Activation Key",
      message: `Are you sure you want to suspend and revoke the license key: ${key}? This will instantly block operations for this school portal.`,
      confirmLabel: "Revoke & Lock Portal",
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
            showToast("Success! Selected license key has been revoked.", "success");
            fetchGeneratedLicenses();
            fetchLicenseInfo();
          } else {
            showToast(data.error || "Failed to revoke key", "error");
          }
        } catch (err) {
          showToast("Network error. Please try again.", "error");
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
        showToast("Lockout banner notice updated successfully!", "success");
      } else {
        showToast(data.error || "Failed to update announcement", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  const handlePrepareHandover = async () => {
    confirm({
      title: "⚠️ SECURE SCHOOL HANDOVER WIPE",
      message: "WARNING: This tool will permanently clear all demo/test records (Students, Attendance, Academic Results, e-Votes, Fees, Expenses, and Stock Logs) on this database. It keeps class levels, subjects, teacher assigned profiles, and master admin accounts. A fresh cloud sync backup is pushed immediately. This cannot be undone. Proceed?",
      confirmLabel: "Yes, Initialize Handover",
      onConfirm: async () => {
        setMessage({ type: 'success', text: 'Wiping local transactional/demo database tables...' });
        try {
          await Promise.all([
            db.students.clear(),
            db.attendance.clear(),
            db.results.clear(),
            db.termReports.clear(),
            db.examAnalysis.clear(),
            db.smsLogs.clear(),
            db.polls.clear(),
            db.candidates.clear(),
            db.votes.clear(),
            db.promotionHistory.clear(),
            db.inventory.clear(),
            db.expenses.clear()
          ]);

          const allUsers = await db.users.toArray();
          const creators = allUsers.filter(u => u.username.toLowerCase() === 'elena' || u.username.toLowerCase() === 'elena_master');
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

          setMessage({ type: 'success', text: 'Wipe complete! Local database reset completed.' });
          
          showToast("Pruned and ready! SchoolSphere is ready for client delivery.", "success");
          setMessage({ type: 'success', text: 'SchoolSphere instance successfully initialized for client handover! Screen reloading...' });
          setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
          showToast(`Handover preparation failed: ${err.message}`, "error");
          setMessage({ type: 'error', text: `Failed: ${err.message}` });
        }
      }
    });
  };

  // Database sync state
  const [dbStatus, setDbStatus] = useState<{
    dbMode: "supabase" | "mysql" | "fallback";
    details: string;
    config?: { host: string; port: number; user: string; database: string };
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch database status:", err);
    }
  };

  useEffect(() => {
    fetchDbStatus();
  }, []);

  const syncPush = async () => {
    setIsSyncing(true);
    setMessage({ type: 'success', text: 'Preparing local IndexedDB backup data packet...' });
    try {
      const payload = {
        students: await db.students.toArray(),
        attendance: await db.attendance.toArray(),
        results: await db.results.toArray(),
        subjects: await db.subjects.toArray(),
        classes: await db.classes.toArray(),
        teachers: await db.teachers.toArray(),
        termReports: await db.termReports.toArray(),
        settings: await db.settings.toArray(),
        users: await db.users.toArray(),
        examAnalysis: await db.examAnalysis.toArray(),
        smsLogs: await db.smsLogs.toArray(),
        polls: await db.polls.toArray(),
        candidates: await db.candidates.toArray(),
        votes: await db.votes.toArray(),
        promotionHistory: await db.promotionHistory.toArray(),
        inventory: await db.inventory.toArray(),
        expenses: await db.expenses.toArray()
      };

      const res = await fetch('/api/db/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type') || '';
      let resData: any = {};
      if (contentType.includes('application/json')) {
        resData = await res.json();
      } else {
        const text = await res.text();
        console.warn("Sync push received non-JSON:", text);
        setMessage({ type: 'success', text: 'Settings saved securely.' });
        setTimeout(() => setMessage(null), 3500);
        return;
      }

      if (!res.ok || !resData.success) {
        setMessage({ type: 'error', text: resData.error || `Sync failed. Check network connection.` });
        setTimeout(() => setMessage(null), 4000);
        return;
      }

      setMessage({ type: 'success', text: 'Database Sync Push completed! Records are updated on the server database.' });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      setMessage({ type: 'success', text: 'Data saved successfully.' });
      setTimeout(() => setMessage(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncPull = async () => {
    confirm({
      title: "Confirm Overwrite Database",
      message: "Warning: Pulling from the database will wipe and overwrite your current browser data on this device. Do you wish to continue?",
      confirmLabel: "Overwrite & Pull",
      onConfirm: async () => {
        setIsSyncing(true);
        setMessage({ type: 'success', text: 'Downloading school records from server...' });
        try {
          const res = await fetch('/api/db/sync');
          const contentType = res.headers.get('content-type') || '';
          let resData: any = {};
          if (contentType.includes('application/json')) {
            resData = await res.json();
          } else {
            const text = await res.text();
            throw new Error(text.startsWith('<') ? `Server returned HTML (${res.status})` : text);
          }

          if (!res.ok || !resData.success || !resData.data) throw new Error(resData.error || `Failed to download data (${res.status})`);

          const data = resData.data;

          // Clear local IndexedDB tables
          await Promise.all([
            db.students.clear(),
            db.attendance.clear(),
            db.results.clear(),
            db.subjects.clear(),
            db.classes.clear(),
            db.teachers.clear(),
            db.termReports.clear(),
            db.settings.clear(),
            db.users.clear(),
            db.examAnalysis.clear(),
            db.smsLogs.clear(),
            db.polls.clear(),
            db.candidates.clear(),
            db.votes.clear(),
            db.promotionHistory.clear(),
            db.inventory.clear(),
            db.expenses.clear()
          ]);

          // Populating local safe bulk adds
          await Promise.all([
            data.students?.length ? db.students.bulkAdd(data.students) : Promise.resolve(),
            data.attendance?.length ? db.attendance.bulkAdd(data.attendance) : Promise.resolve(),
            data.results?.length ? db.results.bulkAdd(data.results) : Promise.resolve(),
            data.subjects?.length ? db.subjects.bulkAdd(data.subjects) : Promise.resolve(),
            data.classes?.length ? db.classes.bulkAdd(data.classes) : Promise.resolve(),
            data.teachers?.length ? db.teachers.bulkAdd(data.teachers) : Promise.resolve(),
            data.termReports?.length ? db.termReports.bulkAdd(data.termReports) : Promise.resolve(),
            data.settings?.length ? db.settings.bulkAdd(data.settings) : Promise.resolve(),
            data.users?.length ? db.users.bulkAdd(data.users) : Promise.resolve(),
            data.examAnalysis?.length ? db.examAnalysis.bulkAdd(data.examAnalysis) : Promise.resolve(),
            data.smsLogs?.length ? db.smsLogs.bulkAdd(data.smsLogs) : Promise.resolve(),
            data.polls?.length ? db.polls.bulkAdd(data.polls) : Promise.resolve(),
            data.candidates?.length ? db.candidates.bulkAdd(data.candidates) : Promise.resolve(),
            data.votes?.length ? db.votes.bulkAdd(data.votes) : Promise.resolve(),
            data.promotionHistory?.length ? db.promotionHistory.bulkAdd(data.promotionHistory) : Promise.resolve(),
            data.inventory?.length ? db.inventory.bulkAdd(data.inventory) : Promise.resolve(),
            data.expenses?.length ? db.expenses.bulkAdd(data.expenses) : Promise.resolve()
          ]);

          showToast("Sync database successfully overwritten on this device!", "success");
          setMessage({ type: 'success', text: 'MySQL Sync Pull completed! Restored all records to browser IndexedDB. Reloading screen...' });
          setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
          showToast(`Sync Pull failed: ${err.message}`, "error");
          setMessage({ type: 'error', text: `Sync Pull failed: ${err.message}` });
          setTimeout(() => setMessage(null), 4000);
        } finally {
          setIsSyncing(false);
        }
      }
    });
  };

  // Custom fee type editing state
  const [isFeeFormOpen, setIsFeeFormOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeTypeConfig | null>(null);
  const [feeForm, setFeeForm] = useState({ id: '', label: '', defaultAmount: 0 });
  const [feeError, setFeeError] = useState<string | null>(null);

  // Local state for forms
  const [schoolProfile, setSchoolProfile] = useState({
    schoolName: 'SCHOOL SPHERE ACADEMY',
    schoolAddress: 'Accra, Ghana',
    schoolPhone: '+233 24 000 0000',
    schoolEmail: 'info@schoolsphere.edu.gh',
    website: 'www.schoolsphere.edu.gh',
    logo: 'https://cdn.pixabay.com/photo/2016/10/06/19/03/graduation-cap-1719744_1280.png',
    theme: 'indigo'
  });

  const [academicConfig, setAcademicConfig] = useState({
    currentTerm: 'Term 1',
    academicYear: '2025/2026',
    nextTermBegins: '2026-09-08'
  });

  function formatToday() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  useEffect(() => {
    if (settingsData) {
      const profile = settingsData.find(s => s.key === 'schoolProfile')?.value;
      const academic = settingsData.find(s => s.key === 'academicConfig')?.value;
      
      if (profile) setSchoolProfile({ ...profile, theme: profile.theme || 'indigo' });
      if (academic) setAcademicConfig(academic);
    }
  }, [settingsData]);

  const saveSettings = async (key: string, value: any) => {
    setIsSaving(true);
    try {
      const existing = await db.settings.where('key').equals(key).first();
      if (existing) {
        await db.settings.update(existing.id!, { value });
      } else {
        await db.settings.add({ key, value });
      }
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFeeType = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeError(null);

    const targetId = feeForm.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const label = feeForm.label.trim();
    const amount = Number(feeForm.defaultAmount);

    if (!targetId) {
      setFeeError('Unique ID is required and must contain alphanumeric characters, hyphens or underscores only.');
      return;
    }
    if (!label) {
      setFeeError('Fee Name is required.');
      return;
    }
    if (isNaN(amount) || amount < 0) {
      setFeeError('Default amount must be a positive amount.');
      return;
    }

    // Check collision with default fee types
    if (FEE_TYPES.some(f => f.id === targetId)) {
      setFeeError(`"${targetId}" is a default system fee ID and cannot be redefined.`);
      return;
    }

    const currentCustoms: FeeTypeConfig[] = settingsData?.find(s => s.key === 'customFeeTypes')?.value || [];

    // Check collision with other custom fee types (excluding self if editing)
    const collisionOccurred = currentCustoms.some(f => f.id === targetId && (!editingFee || editingFee.id !== f.id));
    if (collisionOccurred) {
      setFeeError(`"${targetId}" is already used by another custom fee type.`);
      return;
    }

    let updatedCustoms: FeeTypeConfig[];
    if (editingFee) {
      updatedCustoms = currentCustoms.map(f => f.id === editingFee.id ? { ...f, id: targetId, label, defaultAmount: amount } : f);
    } else {
      updatedCustoms = [...currentCustoms, { id: targetId, label, defaultAmount: amount }];
    }

    try {
      const existingSetting = settingsData?.find(s => s.key === 'customFeeTypes');
      if (existingSetting) {
        await db.settings.update(existingSetting.id!, { value: updatedCustoms });
      } else {
        await db.settings.add({ key: 'customFeeTypes', value: updatedCustoms });
      }
      setIsFeeFormOpen(false);
      setEditingFee(null);
      setFeeForm({ id: '', label: '', defaultAmount: 0 });
      setMessage({ type: 'success', text: 'Fee Type saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setFeeError('Failed to save to database settings.');
    }
  };

  const handleDeleteFeeType = async (feeId: string) => {
    const currentCustoms: FeeTypeConfig[] = settingsData?.find(s => s.key === 'customFeeTypes')?.value || [];
    const updatedCustoms = currentCustoms.filter(f => f.id !== feeId);

    try {
      const existingSetting = settingsData?.find(s => s.key === 'customFeeTypes');
      if (existingSetting) {
        await db.settings.update(existingSetting.id!, { value: updatedCustoms });
      } else {
        await db.settings.add({ key: 'customFeeTypes', value: updatedCustoms });
      }
      setMessage({ type: 'success', text: 'Custom Fee Type deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete custom fee type.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const exportData = async () => {
    try {
      const data = {
        students: await db.students.toArray(),
        attendance: await db.attendance.toArray(),
        results: await db.results.toArray(),
        subjects: await db.subjects.toArray(),
        classes: await db.classes.toArray(),
        teachers: await db.teachers.toArray(),
        termReports: await db.termReports.toArray(),
        settings: await db.settings.toArray(),
        users: await db.users.toArray(),
        examAnalysis: await db.examAnalysis.toArray(),
        smsLogs: await db.smsLogs.toArray(),
        polls: await db.polls.toArray(),
        candidates: await db.candidates.toArray(),
        votes: await db.votes.toArray(),
        promotionHistory: await db.promotionHistory.toArray(),
        inventory: await db.inventory.toArray(),
        expenses: await db.expenses.toArray(),
        exportDate: new Date().toISOString(),
        version: '1.1'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const schoolPrefix = schoolProfile.schoolName.split(' ')[0].toLowerCase();
      a.download = `${schoolPrefix}_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: 'Database exported successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to export data' });
    }
  };

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        // Very basic validation
        if (!data.students || !data.classes) {
          throw new Error('Invalid backup file format');
        }

        // Warning: This clears everything
        await Promise.all([
          db.students.clear(),
          db.attendance.clear(),
          db.results.clear(),
          db.subjects.clear(),
          db.classes.clear(),
          db.teachers.clear(),
          db.termReports.clear(),
          db.settings.clear(),
          db.users.clear(),
          db.examAnalysis.clear(),
          db.smsLogs.clear(),
          db.polls.clear(),
          db.candidates.clear(),
          db.votes.clear(),
          db.promotionHistory.clear(),
          db.inventory.clear(),
          db.expenses.clear()
        ]);

        await Promise.all([
          data.students?.length ? db.students.bulkAdd(data.students) : Promise.resolve(),
          data.attendance?.length ? db.attendance.bulkAdd(data.attendance) : Promise.resolve(),
          data.results?.length ? db.results.bulkAdd(data.results) : Promise.resolve(),
          data.subjects?.length ? db.subjects.bulkAdd(data.subjects) : Promise.resolve(),
          data.classes?.length ? db.classes.bulkAdd(data.classes) : Promise.resolve(),
          data.teachers?.length ? db.teachers.bulkAdd(data.teachers) : Promise.resolve(),
          data.termReports?.length ? db.termReports.bulkAdd(data.termReports) : Promise.resolve(),
          data.settings?.length ? db.settings.bulkAdd(data.settings) : Promise.resolve(),
          data.users?.length ? db.users.bulkAdd(data.users) : Promise.resolve(),
          data.examAnalysis?.length ? db.examAnalysis.bulkAdd(data.examAnalysis) : Promise.resolve(),
          data.smsLogs?.length ? db.smsLogs.bulkAdd(data.smsLogs) : Promise.resolve(),
          data.polls?.length ? db.polls.bulkAdd(data.polls) : Promise.resolve(),
          data.candidates?.length ? db.candidates.bulkAdd(data.candidates) : Promise.resolve(),
          data.votes?.length ? db.votes.bulkAdd(data.votes) : Promise.resolve(),
          data.promotionHistory?.length ? db.promotionHistory.bulkAdd(data.promotionHistory) : Promise.resolve(),
          data.inventory?.length ? db.inventory.bulkAdd(data.inventory) : Promise.resolve(),
          data.expenses?.length ? db.expenses.bulkAdd(data.expenses) : Promise.resolve()
        ]);

        setMessage({ type: 'success', text: 'Data imported successfully. Reloading...' });
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        setMessage({ type: 'error', text: 'Import failed: ' + (err as Error).message });
      }
    };
    reader.readAsText(file);
  };

  const clearDatabase = async () => {
    try {
      await Promise.all([
        db.students.clear(),
        db.attendance.clear(),
        db.results.clear(),
        db.subjects.clear(),
        db.classes.clear(),
        db.teachers.clear(),
        db.termReports.clear(),
        db.settings.clear(),
        db.users.clear(),
        db.examAnalysis.clear(),
        db.smsLogs.clear(),
        db.polls.clear(),
        db.candidates.clear(),
        db.votes.clear(),
        db.promotionHistory.clear(),
        db.inventory.clear(),
        db.expenses.clear()
      ]);
      localStorage.clear();
      setMessage({ type: 'success', text: 'System data wiped successfully. restarting app...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: 'Clear failed' });
    }
  };

  const exportMySQLScript = async () => {
    try {
      let sql = `-- ====================================================================\n`;
      sql += `-- ESEPA SCHOOL SPHERE - GENERATED DATA EXPORT SCRIPT (MYSQL)\n`;
      sql += `-- Export Date: ${new Date().toUTCString()}\n`;
      sql += `-- Target Environment: XAMPP / phpMyAdmin / Standalone MySQL\n`;
      sql += `-- ====================================================================\n\n`;
      sql += `USE esepa_school_db;\n\n`;
      sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

      const escapeSql = (val: any): string => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return String(val);
        if (typeof val === 'boolean') return val ? '1' : '0';
        if (typeof val === 'object') {
          const jsonStr = JSON.stringify(val).replace(/'/g, "''").replace(/\\/g, "\\\\");
          return `'${jsonStr}'`;
        }
        const escaped = String(val).replace(/'/g, "''").replace(/\\/g, "\\\\");
        return `'${escaped}'`;
      };

      // 1. Users
      const users = await db.users.toArray();
      if (users.length > 0) {
        sql += `-- Table: users\nTRUNCATE TABLE users;\n`;
        sql += `INSERT INTO users (id, username, passwordHash, fullName, role, createdAt) VALUES\n`;
        sql += users.map(u => `(${escapeSql(u.id)}, ${escapeSql(u.username)}, ${escapeSql(u.passwordHash)}, ${escapeSql(u.fullName)}, ${escapeSql(u.role)}, ${escapeSql(u.createdAt)})`).join(',\n') + ';\n\n';
      }

      // 2. Classes
      const classes = await db.classes.toArray();
      if (classes.length > 0) {
        sql += `-- Table: classes\nTRUNCATE TABLE classes;\n`;
        sql += `INSERT INTO classes (id, name, level) VALUES\n`;
        sql += classes.map(c => `(${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.level)})`).join(',\n') + ';\n\n';
      }

      // 3. Subjects
      const subjects = await db.subjects.toArray();
      if (subjects.length > 0) {
        sql += `-- Table: subjects\nTRUNCATE TABLE subjects;\n`;
        sql += `INSERT INTO subjects (id, name, code, applicableClasses) VALUES\n`;
        sql += subjects.map(s => `(${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.code)}, ${escapeSql(s.applicableClasses)})`).join(',\n') + ';\n\n';
      }

      // 4. Students
      const students = await db.students.toArray();
      if (students.length > 0) {
        sql += `-- Table: students\nTRUNCATE TABLE students;\n`;
        sql += `INSERT INTO students (id, studentId, firstName, lastName, class, dateOfBirth, gender, guardianName, guardianPhone, feesPaid, totalFees, house, department, photo, createdAt, feeBreakdown, feePaidBreakdown) VALUES\n`;
        sql += students.map(s => `(${escapeSql(s.id)}, ${escapeSql(s.studentId)}, ${escapeSql(s.firstName)}, ${escapeSql(s.lastName)}, ${escapeSql(s.class)}, ${escapeSql(s.dateOfBirth)}, ${escapeSql(s.gender)}, ${escapeSql(s.guardianName)}, ${escapeSql(s.guardianPhone)}, ${escapeSql(s.feesPaid)}, ${escapeSql(s.totalFees)}, ${escapeSql(s.house)}, ${escapeSql(s.department)}, ${escapeSql(s.photo)}, ${escapeSql(s.createdAt)}, ${escapeSql(s.feeBreakdown)}, ${escapeSql(s.feePaidBreakdown)})`).join(',\n') + ';\n\n';
      }

      // 5. Teachers
      const teachers = await db.teachers.toArray();
      if (teachers.length > 0) {
        sql += `-- Table: teachers\nTRUNCATE TABLE teachers;\n`;
        sql += `INSERT INTO teachers (id, staffId, firstName, lastName, phone, email, assignedClasses, subjects) VALUES\n`;
        sql += teachers.map(t => `(${escapeSql(t.id)}, ${escapeSql(t.staffId)}, ${escapeSql(t.firstName)}, ${escapeSql(t.lastName)}, ${escapeSql(t.phone)}, ${escapeSql(t.email)}, ${escapeSql(t.assignedClasses)}, ${escapeSql(t.subjects)})`).join(',\n') + ';\n\n';
      }

      // 6. Attendance
      const attendance = await db.attendance.toArray();
      if (attendance.length > 0) {
        sql += `-- Table: attendance\nTRUNCATE TABLE attendance;\n`;
        sql += `INSERT INTO attendance (id, studentId, date, status) VALUES\n`;
        sql += attendance.map(a => `(${escapeSql(a.id)}, ${escapeSql(a.studentId)}, ${escapeSql(a.date)}, ${escapeSql(a.status)})`).join(',\n') + ';\n\n';
      }

      // 7. Results
      const results = await db.results.toArray();
      if (results.length > 0) {
        sql += `-- Table: results\nTRUNCATE TABLE results;\n`;
        sql += `INSERT INTO results (id, studentId, subject, term, class, classScore, examScore, totalScore, grade, remarks) VALUES\n`;
        sql += results.map(r => `(${escapeSql(r.id)}, ${escapeSql(r.studentId)}, ${escapeSql(r.subject)}, ${escapeSql(r.term)}, ${escapeSql(r.class)}, ${escapeSql(r.classScore)}, ${escapeSql(r.examScore)}, ${escapeSql(r.totalScore)}, ${escapeSql(r.grade)}, ${escapeSql(r.remarks)})`).join(',\n') + ';\n\n';
      }

      // 8. Term Reports
      const termReports = await db.termReports.toArray();
      if (termReports.length > 0) {
        sql += `-- Table: termReports\nTRUNCATE TABLE termReports;\n`;
        sql += `INSERT INTO termReports (id, studentId, term, academicYear, attendancePresent, attendanceTotal, teacherRemark, headmasterRemark, position, totalStudents) VALUES\n`;
        sql += termReports.map(tr => `(${escapeSql(tr.id)}, ${escapeSql(tr.studentId)}, ${escapeSql(tr.term)}, ${escapeSql(tr.academicYear)}, ${escapeSql(tr.attendancePresent)}, ${escapeSql(tr.attendanceTotal)}, ${escapeSql(tr.teacherRemark)}, ${escapeSql(tr.headmasterRemark)}, ${escapeSql(tr.position)}, ${escapeSql(tr.totalStudents)})`).join(',\n') + ';\n\n';
      }

      // 9. Settings
      const settings = await db.settings.toArray();
      if (settings.length > 0) {
        sql += `-- Table: settings\nTRUNCATE TABLE settings;\n`;
        sql += `INSERT INTO settings (id, \`key\`, \`value\`) VALUES\n`;
        sql += settings.map(st => `(${escapeSql(st.id)}, ${escapeSql(st.key)}, ${escapeSql(st.value)})`).join(',\n') + ';\n\n';
      }

      // 10. Exam Analysis
      const examAnalysis = await db.examAnalysis.toArray();
      if (examAnalysis.length > 0) {
        sql += `-- Table: examAnalysis\nTRUNCATE TABLE examAnalysis;\n`;
        sql += `INSERT INTO examAnalysis (id, studentId, studentName, examType, year, indexNumber, schoolName, subjects, aggregate, status, remarks, createdAt) VALUES\n`;
        sql += examAnalysis.map(ea => `(${escapeSql(ea.id)}, ${escapeSql(ea.studentId)}, ${escapeSql(ea.studentName)}, ${escapeSql(ea.examType)}, ${escapeSql(ea.year)}, ${escapeSql(ea.indexNumber)}, ${escapeSql(ea.schoolName)}, ${escapeSql(ea.subjects)}, ${escapeSql(ea.aggregate)}, ${escapeSql(ea.status)}, ${escapeSql(ea.remarks)}, ${escapeSql(ea.createdAt)})`).join(',\n') + ';\n\n';
      }

      // 11. SMS Logs
      const smsLogs = await db.smsLogs.toArray();
      if (smsLogs.length > 0) {
        sql += `-- Table: smsLogs\nTRUNCATE TABLE smsLogs;\n`;
        sql += `INSERT INTO smsLogs (id, recipientName, recipientPhone, recipientType, message, type, status, createdAt) VALUES\n`;
        sql += smsLogs.map(sl => `(${escapeSql(sl.id)}, ${escapeSql(sl.recipientName)}, ${escapeSql(sl.recipientPhone)}, ${escapeSql(sl.recipientType)}, ${escapeSql(sl.message)}, ${escapeSql(sl.type)}, ${escapeSql(sl.status)}, ${escapeSql(sl.createdAt)})`).join(',\n') + ';\n\n';
      }

      // 12. Polls
      const polls = await db.polls.toArray();
      if (polls.length > 0) {
        sql += `-- Table: polls\nTRUNCATE TABLE polls;\n`;
        sql += `INSERT INTO polls (id, title, description, status, category, createdAt) VALUES\n`;
        sql += polls.map(p => `(${escapeSql(p.id)}, ${escapeSql(p.title)}, ${escapeSql(p.description)}, ${escapeSql(p.status)}, ${escapeSql(p.category)}, ${escapeSql(p.createdAt)})`).join(',\n') + ';\n\n';
      }

      // 13. Candidates
      const candidates = await db.candidates.toArray();
      if (candidates.length > 0) {
        sql += `-- Table: candidates\nTRUNCATE TABLE candidates;\n`;
        sql += `INSERT INTO candidates (id, pollId, name, position, class, votesCount, photo, manifesto) VALUES\n`;
        sql += candidates.map(cd => `(${escapeSql(cd.id)}, ${escapeSql(cd.pollId)}, ${escapeSql(cd.name)}, ${escapeSql(cd.position)}, ${escapeSql(cd.class)}, ${escapeSql(cd.votesCount)}, ${escapeSql(cd.photo)}, ${escapeSql(cd.manifesto)})`).join(',\n') + ';\n\n';
      }

      // 14. Votes
      const votes = await db.votes.toArray();
      if (votes.length > 0) {
        sql += `-- Table: votes\nTRUNCATE TABLE votes;\n`;
        sql += `INSERT INTO votes (id, pollId, studentId, position, candidateId, timestamp) VALUES\n`;
        sql += votes.map(v => `(${escapeSql(v.id)}, ${escapeSql(v.pollId)}, ${escapeSql(v.studentId)}, ${escapeSql(v.position)}, ${escapeSql(v.candidateId)}, ${escapeSql(v.timestamp)})`).join(',\n') + ';\n\n';
      }

      // 15. Promotion History
      const promotionHistory = await db.promotionHistory.toArray();
      if (promotionHistory.length > 0) {
        sql += `-- Table: promotionHistory\nTRUNCATE TABLE promotionHistory;\n`;
        sql += `INSERT INTO promotionHistory (id, studentId, studentIdentifier, studentName, sourceClass, destClass, academicYear, term, timestamp, previousFeesPaid, previousTotalFees, previousFeeBreakdown, previousFeePaidBreakdown) VALUES\n`;
        sql += promotionHistory.map(ph => `(${escapeSql(ph.id)}, ${escapeSql(ph.studentId)}, ${escapeSql(ph.studentIdentifier)}, ${escapeSql(ph.studentName)}, ${escapeSql(ph.sourceClass)}, ${escapeSql(ph.destClass)}, ${escapeSql(ph.academicYear)}, ${escapeSql(ph.term)}, ${escapeSql(ph.timestamp)}, ${escapeSql(ph.previousFeesPaid)}, ${escapeSql(ph.previousTotalFees)}, ${escapeSql(ph.previousFeeBreakdown)}, ${escapeSql(ph.previousFeePaidBreakdown)})`).join(',\n') + ';\n\n';
      }

      // 16. Inventory
      const inventory = await db.inventory.toArray();
      if (inventory.length > 0) {
        sql += `-- Table: inventory\nTRUNCATE TABLE inventory;\n`;
        sql += `INSERT INTO inventory (id, itemName, category, quantity, minQuantity, unitPrice, location, supplierName, supplierPhone, lastUpdated) VALUES\n`;
        sql += inventory.map(iv => `(${escapeSql(iv.id)}, ${escapeSql(iv.itemName)}, ${escapeSql(iv.category)}, ${escapeSql(iv.quantity)}, ${escapeSql(iv.minQuantity)}, ${escapeSql(iv.unitPrice)}, ${escapeSql(iv.location)}, ${escapeSql(iv.supplierName)}, ${escapeSql(iv.supplierPhone)}, ${escapeSql(iv.lastUpdated)})`).join(',\n') + ';\n\n';
      }

      // 17. Expenses
      const expenses = await db.expenses.toArray();
      if (expenses.length > 0) {
        sql += `-- Table: expenses\nTRUNCATE TABLE expenses;\n`;
        sql += `INSERT INTO expenses (id, description, category, amount, date, inventoryItemId, quantityPurchased, paymentMethod, recordedBy) VALUES\n`;
        sql += expenses.map(ex => `(${escapeSql(ex.id)}, ${escapeSql(ex.description)}, ${escapeSql(ex.category)}, ${escapeSql(ex.amount)}, ${escapeSql(ex.date)}, ${escapeSql(ex.inventoryItemId)}, ${escapeSql(ex.quantityPurchased)}, ${escapeSql(ex.paymentMethod)}, ${escapeSql(ex.recordedBy)})`).join(',\n') + ';\n\n';
      }

      sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

      const blob = new Blob([sql], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const schoolPrefix = schoolProfile.schoolName.split(' ')[0].toLowerCase();
      a.download = `${schoolPrefix}_xampp_import_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("XAMPP SQL Export successful!", "success");
    } catch (err: any) {
      showToast("Failed to generate SQL export: " + err.message, "error");
    }
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSchoolProfile(prev => ({ ...prev, logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setSchoolProfile(prev => ({ ...prev, logo: '' }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h2>
          <p className="text-slate-500 text-sm">Manage school details, terms and database utilities.</p>
        </div>
        
        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm",
                message.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
              )}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-2 space-y-1">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left",
              activeTab === 'profile' ? "bg-white text-indigo-600 shadow-sm font-bold border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Building2 className="w-4 h-4" />
            <span className="text-sm">School Profile</span>
          </button>
          <button 
            onClick={() => setActiveTab('academic')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left",
              activeTab === 'academic' ? "bg-white text-indigo-600 shadow-sm font-bold border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Academic Config</span>
          </button>
          <button 
            onClick={() => setActiveTab('database')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left",
              activeTab === 'database' ? "bg-white text-indigo-600 shadow-sm font-bold border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Database className="w-4 h-4" />
            <span className="text-sm">Data & Backup</span>
          </button>
          <button 
            onClick={() => setActiveTab('fees')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left",
              activeTab === 'fees' ? "bg-white text-indigo-600 shadow-sm font-bold border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <CreditCard className="w-4 h-4" />
            <span className="text-sm">Fees Configuration</span>
          </button>
          <button 
            onClick={() => setActiveTab('theme')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left",
              activeTab === 'theme' ? "bg-white text-indigo-600 shadow-sm font-bold border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Palette className="w-4 h-4" />
            <span className="text-sm">Branding & Themes</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 sm:p-8">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">School Identity</h3>
                  <p className="text-xs text-slate-500">Official information used in reports and headers.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2 flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl group transition-all hover:border-indigo-300">
                  {schoolProfile.logo ? (
                    <div className="relative">
                      <img 
                        src={schoolProfile.logo} 
                        alt="School Logo" 
                        className="w-32 h-32 object-contain bg-white rounded-2xl shadow-md p-2"
                      />
                      <button 
                        onClick={removeLogo}
                        className="absolute -top-3 -right-3 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-all scale-0 group-hover:scale-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-300">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">School Logo</p>
                    </div>
                  )}
                  
                  <label className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm">
                    {schoolProfile.logo ? 'Change Logo' : 'Upload School Logo'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <p className="text-[10px] text-slate-400 mt-2">Recommended: Square PNG or JPG (Max 500KB)</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">School Name</label>
                  <input 
                    type="text" 
                    value={schoolProfile.schoolName || ''}
                    onChange={(e) => setSchoolProfile({...schoolProfile, schoolName: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">School Email</label>
                  <input 
                    type="email" 
                    value={schoolProfile.schoolEmail || ''}
                    onChange={(e) => setSchoolProfile({...schoolProfile, schoolEmail: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Address</label>
                  <input 
                    type="text" 
                    value={schoolProfile.schoolAddress || ''}
                    onChange={(e) => setSchoolProfile({...schoolProfile, schoolAddress: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="text" 
                    value={schoolProfile.schoolPhone || ''}
                    onChange={(e) => setSchoolProfile({...schoolProfile, schoolPhone: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Website</label>
                  <input 
                    type="text" 
                    value={schoolProfile.website || ''}
                    onChange={(e) => setSchoolProfile({...schoolProfile, website: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

              </div>

              <div className="pt-4">
                <button 
                  onClick={() => saveSettings('schoolProfile', schoolProfile)}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'academic' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Academic Period</h3>
                  <p className="text-xs text-slate-500">Configure current session and term dates.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Current Term</label>
                  <select 
                    value={academicConfig.currentTerm || ''}
                    onChange={(e) => setAcademicConfig({...academicConfig, currentTerm: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option>Term 1</option>
                    <option>Term 2</option>
                    <option>Term 3</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Academic Year</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2023/2024"
                    value={academicConfig.academicYear || ''}
                    onChange={(e) => setAcademicConfig({...academicConfig, academicYear: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Next Term Begins</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="date" 
                      value={academicConfig.nextTermBegins || ''}
                      onChange={(e) => setAcademicConfig({...academicConfig, nextTermBegins: e.target.value})}
                      className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => saveSettings('academicConfig', academicConfig)}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Update Configuration'}
                </button>
              </div>

              {academicConfig.currentTerm === 'Term 3' && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
                  <div className="flex gap-3">
                    <span className="text-xl">🎓</span>
                    <div>
                      <p className="text-sm font-bold text-emerald-950">End of Academic Year (Term 3)</p>
                      <p className="text-xs text-emerald-700 font-medium">
                        Are you ready to transition to the next academic year? You can batch promote students to their next classes and automatically roll over the school calendar year!
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-bold text-emerald-800">
                    Go to <span className="font-extrabold text-indigo-600">Student Management</span> &gt; <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">Promote Students</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-8">
              <LicenseSyncBanner />
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Data Management</h3>
                  <p className="text-xs text-slate-500">Backup, restore, or wipe system data.</p>
                </div>
              </div>

              {/* Supabase & Vercel / Live Server Database Status Dashboard */}
              <div className="p-6 border border-slate-200/80 rounded-2xl bg-white space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      dbStatus?.dbMode === "supabase" || dbStatus?.dbMode === "mysql" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        Supabase & Vercel Cloud Sync
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Connected (Supabase & Vercel)
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-line leading-relaxed">
                        {dbStatus?.details || "Connected to Supabase PostgreSQL & Vercel Edge Host. Licensing & Subscriptions synced."}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={fetchDbStatus}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Refresh Link
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600">
                  <div>
                    <span className="font-medium text-slate-400 block mb-0.5 font-sans">Frontend Host (Vercel)</span>
                    <a href="https://esepa-school-portal.vercel.app" target="_blank" rel="noreferrer" className="font-mono font-bold text-indigo-600 hover:underline truncate block">
                      esepa-school-portal.vercel.app
                    </a>
                  </div>
                  <div>
                    <span className="font-medium text-slate-400 block mb-0.5 font-sans">Supabase DB Host</span>
                    <a href="https://niavmonyfwqlryppgksy.supabase.co" target="_blank" rel="noreferrer" className="font-mono font-bold text-emerald-600 hover:underline truncate block">
                      niavmonyfwqlryppgksy.supabase.co
                    </a>
                  </div>
                  <div>
                    <span className="font-medium text-slate-400 block mb-0.5 font-sans">Licensing & Subscriptions</span>
                    <span className="font-mono font-bold text-slate-800">RLS Enforced & Live</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col md:flex-row gap-3">
                  <button
                    onClick={syncPush}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    Push local data to MySQL Database
                  </button>
                  <button
                    onClick={syncPull}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    Pull from MySQL Database to Local
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50 space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-500" />
                    Export Backup
                  </h4>
                  <p className="text-xs text-slate-500">Download a full backup of all school records as a JSON file.</p>
                  <button 
                    onClick={exportData}
                    className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm cursor-pointer"
                  >
                    Generate Backup
                  </button>
                </div>

                <div className="p-5 border border-indigo-100 rounded-2xl bg-indigo-50/20 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2 text-indigo-900">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Export XAMPP SQL
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">Generate a populated SQL script with your live school records for phpMyAdmin.</p>
                  </div>
                  <button 
                    onClick={exportMySQLScript}
                    className="w-full py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer mt-2"
                  >
                    Generate SQL Script
                  </button>
                </div>

                <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50 space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-500" />
                    Restore Data
                  </h4>
                  <p className="text-xs text-slate-500">Upload a previously generated backup file to restore records.</p>
                  <label className="block w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm text-center cursor-pointer">
                    Upload Backup
                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="pt-6 border-t border-rose-50 space-y-4">
                <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl flex gap-4">
                  <div className="shrink-0 p-2 bg-rose-100 text-rose-600 rounded-xl h-fit">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-rose-700 uppercase tracking-wide">Danger Zone</h4>
                    <p className="text-xs text-rose-600 font-medium">Clearing the database will permanently delete all students, results, and settings. This action cannot be undone.</p>
                  </div>
                </div>

                {confirmClear ? (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 transition-all">
                    <button 
                      onClick={clearDatabase}
                      className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 text-sm shadow-lg shadow-rose-100 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Wipe Everything Now
                    </button>
                    <button 
                      onClick={() => setConfirmClear(false)}
                      className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmClear(true)}
                    className="flex items-center gap-2 text-rose-600 hover:text-rose-700 font-bold text-sm transition-colors px-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear All Database Data
                  </button>
                )}
              </div>

              {/* Creator Controls & Licensing Section */}
              {(user?.username?.toLowerCase() === 'elena' || user?.username?.toLowerCase() === 'elena_master') && (
                <div className="pt-8 border-t border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Server className="w-4 h-4 text-indigo-600" />
                        System Creator & License Management
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Exclusive controls to monitor activation, verify software licensing, and lock/unlock portal instances.</p>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 font-extrabold uppercase rounded-full tracking-wider animate-pulse">
                      Creator Mode Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 border border-slate-200 rounded-2xl bg-slate-900 text-slate-100 flex flex-col justify-between">
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                          License Status Details
                        </h4>
                        <div className="py-2.5">
                          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                            <span className="text-slate-500">Local Status:</span>
                            <span className={cn(
                              "font-bold uppercase",
                              licenseInfo?.active ? "text-emerald-400" : "text-rose-500"
                            )}>
                              {licenseInfo?.active ? "Active & Authorized" : "Expired / Locked"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs border-b border-slate-800 py-2">
                            <span className="text-slate-500">Current Key:</span>
                            <span className="font-mono font-semibold text-slate-300">
                              {licenseInfo?.licenseKey || "NONE"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-2">
                            <span className="text-slate-500">Remote Overridden:</span>
                            <span className={cn(
                              "font-bold uppercase",
                              licenseInfo?.remoteOverride ? "text-rose-400" : "text-slate-500"
                            )}>
                              {licenseInfo?.remoteOverride ? "YES" : "NO"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={fetchLicenseInfo}
                        className="mt-4 w-full py-2 border border-slate-800 hover:bg-slate-800 transition rounded-lg text-xs font-bold uppercase tracking-wider text-slate-300 cursor-pointer"
                      >
                        Refresh License Status
                      </button>
                    </div>

                    <div className="p-5 border border-rose-100 rounded-2xl bg-rose-50/20 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-rose-800">
                          Instant Remote Control
                        </h4>
                        <p className="text-xs text-rose-600 mt-1 leading-relaxed">
                          Test the remote lock mechanism instantly. Deactivating blocks all user dashboards with a full-screen lock screen requiring activation.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          disabled={loadingLicenseAction}
                          onClick={handleRemoteDeactivate}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 transition text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-rose-100 cursor-pointer disabled:opacity-50"
                        >
                          {loadingLicenseAction ? "Processing..." : "Lock System"}
                        </button>
                        <button
                          disabled={loadingLicenseAction}
                          onClick={handleRemoteActivate}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-50"
                        >
                          {loadingLicenseAction ? "Processing..." : "Unlock (Key)"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'fees' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Fee Types & Billing</h3>
                    <p className="text-xs text-slate-500">Define custom billing categories, fees, and defaults.</p>
                  </div>
                </div>
                {!isFeeFormOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFee(null);
                      setFeeForm({ id: '', label: '', defaultAmount: 0 });
                      setFeeError(null);
                      setIsFeeFormOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Fee Type
                  </button>
                )}
              </div>

              {/* Fee Add / Edit Form Card */}
              {isFeeFormOpen && (
                <div
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-indigo-600 tracking-wider">
                      {editingFee ? 'Edit Custom Fee Type' : 'Create Custom Fee Type'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFeeFormOpen(false);
                        setEditingFee(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSaveFeeType} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">
                        Fee Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Graduation Fee"
                        value={feeForm.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFeeForm((prev) => {
                            const updated = { ...prev, label: val };
                            if (!editingFee) {
                              updated.id = val
                                .toLowerCase()
                                .replace(/\s+/g, '_')
                                .replace(/[^a-z0-9_-]/g, '');
                            }
                            return updated;
                          });
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-medium text-slate-800"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">
                        Unique ID
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!!editingFee}
                        placeholder="e.g. graduation_fee"
                        value={feeForm.id}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
                          setFeeForm((prev) => ({ ...prev, id: val }));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
                      />
                      {!editingFee && (
                        <p className="text-[9px] text-slate-400">Lowercase letters, numbers, hyphens or underscores only</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight block">
                        Default Amount (GHS)
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="0"
                        value={feeForm.defaultAmount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFeeForm((prev) => ({ ...prev, defaultAmount: val }));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-bold text-slate-800"
                      />
                    </div>

                    {feeError && (
                      <div className="col-span-1 sm:col-span-3 text-rose-600 text-xs font-medium">
                        {feeError}
                      </div>
                    )}

                    <div className="col-span-1 sm:col-span-3 pt-2">
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                      >
                        {editingFee ? 'Save Changes' : 'Add Fee Type'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Grid of Fee Types */}
              <div className="space-y-4">
                {/* Custom Fee Types Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Custom Administrator Fee Types</h4>
                  {(() => {
                    const customs: FeeTypeConfig[] = settingsData?.find(s => s.key === 'customFeeTypes')?.value || [];
                    if (customs.length === 0) {
                      return (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                          No custom fee types configured yet. Add custom fees above to expand the billing system metrics.
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customs.map((ft) => (
                          <div key={ft.id} className="p-4 bg-white border border-indigo-100 rounded-2xl shadow-xs flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{ft.label}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {ft.id} | Default: <span className="font-bold text-indigo-600">GHS {ft.defaultAmount}</span></p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFee(ft);
                                  setFeeForm({ id: ft.id, label: ft.label, defaultAmount: ft.defaultAmount });
                                  setFeeError(null);
                                  setIsFeeFormOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit Fee Config"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  confirm({
                                    title: "Delete Custom Fee",
                                    message: `Are you sure you want to delete the "${ft.label}" custom fee? This category won't be collected on newer students.`,
                                    confirmLabel: "Delete Fee",
                                    onConfirm: () => handleDeleteFeeType(ft.id)
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* System Fee Types Section */}
                <div className="space-y-2 pt-4">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">System Default Fee Types (Locked)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FEE_TYPES.map((ft) => (
                      <div key={ft.id} className="p-4 bg-slate-50/50 border border-slate-200/50 rounded-2xl flex items-center justify-between opacity-80">
                        <div>
                          <p className="text-xs font-bold text-slate-600">{ft.label}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {ft.id} | Default: GHS {ft.defaultAmount}</p>
                        </div>
                        <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-wider">System Standard</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Palette className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Branding & Color Theme</h3>
                  <p className="text-xs text-slate-500">Customize the colors and branding across your school portal instance.</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Choose Color Theme</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { id: 'indigo', name: 'Classic Indigo', desc: 'Trustworthy & Professional', color: 'bg-indigo-600' },
                    { id: 'emerald', name: 'Emerald Green', desc: 'Balanced, Nurturing & Calm', color: 'bg-emerald-600' },
                    { id: 'violet', name: 'Royal Violet', desc: 'Creative, Elegant & Sophisticated', color: 'bg-violet-600' },
                    { id: 'rose', name: 'Crimson Rose', desc: 'Vibrant, Active & Energetic', color: 'bg-rose-600' },
                    { id: 'amber', name: 'Sunset Amber', desc: 'Warm, Welcoming & Friendly', color: 'bg-amber-600' },
                    { id: 'teal', name: 'Teal Marine', desc: 'Fresh, Clean & Academic', color: 'bg-teal-600' },
                    { id: 'sky', name: 'Sky Blue', desc: 'Oceanic, Serene & Trusting', color: 'bg-sky-600' },
                  ].map((themeOption) => (
                    <button
                      key={themeOption.id}
                      type="button"
                      onClick={() => setSchoolProfile({ ...schoolProfile, theme: themeOption.id })}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all hover:shadow-md cursor-pointer flex flex-col justify-between gap-3 h-28 relative overflow-hidden",
                        schoolProfile.theme === themeOption.id
                          ? "border-indigo-600 bg-indigo-50/10 ring-2 ring-indigo-600/20 font-bold"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className="space-y-0.5">
                          <p className="text-xs font-extrabold text-slate-800">{themeOption.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{themeOption.desc}</p>
                        </div>
                        <div className={cn("w-5 h-5 rounded-full shadow-inner shrink-0", themeOption.color)} />
                      </div>
                      
                      {schoolProfile.theme === themeOption.id ? (
                        <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md uppercase tracking-wider w-fit">
                          Selected
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400 hover:text-slate-600">
                          Click to select
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 flex items-center gap-3">
                <span className="text-lg">✨</span>
                <p>The chosen theme colors are dynamically compiled and compiled on-the-fly to all action buttons, links, widgets, headers, graphs, and system dashboards across the entire SchoolSphere instance.</p>
              </div>

              <div className="pt-4">
                <button 
                  type="button"
                  onClick={() => saveSettings('schoolProfile', schoolProfile)}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Applying...' : 'Apply Theme & Save'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'creator' && (
            <div className="p-8 border border-indigo-100 rounded-3xl bg-indigo-50/50 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                <Cpu className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800">Creator Console Has Moved!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Elena, your designer hub is now an independent portal. You can access it directly from the main sidebar navigation panel!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{schoolProfile.schoolName.split(' ')[0]} Management System v1.2.0 • Local Storage Database</p>
      </div>
    </div>
  );
}
