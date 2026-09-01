import { useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { ROLE_DEFINITIONS, UserRole, getRoleInfo, getRolePermissions } from '../../lib/permissions';
import { 
  Shield, 
  KeyRound, 
  User, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Building, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  ShieldCheck, 
  Key, 
  Clock, 
  Smartphone, 
  Mail, 
  Fingerprint,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface SecurityProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityProfileModal({ isOpen, onClose }: SecurityProfileModalProps) {
  const { user, school, token, changePassword, switchRole } = useAuth();
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<'profile' | 'permissions' | 'security'>('profile');
  
  // Password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !user) return null;

  const roleInfo = getRoleInfo(user.role);
  const grantedPermissions = getRolePermissions(user.role);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 6) score += 25;
    if (pass.length >= 10) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const strength = getPasswordStrength(newPassword);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast('Please enter your current password', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirmation do not match', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        showToast('Password updated successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setActiveTab('profile');
      } else {
        showToast(res.error || 'Failed to update password', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error communicating with authentication service', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Permission categories for inspector
  const permissionCategories = [
    {
      title: 'Student & Academic Records',
      keys: [
        { code: 'students:view', label: 'View Student Directory' },
        { code: 'students:create', label: 'Enroll New Students' },
        { code: 'students:edit', label: 'Edit Student Details' },
        { code: 'students:delete', label: 'Delete Student Records' },
        { code: 'attendance:mark', label: 'Mark Classroom Attendance' },
        { code: 'results:record', label: 'Input & Edit Scores' },
        { code: 'results:publish', label: 'Publish Terminal Results' },
        { code: 'reports:generate', label: 'Generate Terminal Reports' },
      ]
    },
    {
      title: 'Finance & Payments',
      keys: [
        { code: 'fees:view', label: 'View Fee Balances' },
        { code: 'fees:record_payment', label: 'Collect Fees & Issue Receipts' },
        { code: 'fees:manage_structure', label: 'Manage Fee Tariffs' },
        { code: 'inventory:manage', label: 'Manage Inventory Records' },
      ]
    },
    {
      title: 'School Systems & Safety',
      keys: [
        { code: 'timetable:manage', label: 'Configure Timetables & Bells' },
        { code: 'siren:trigger', label: 'Activate Emergency Siren / Intercom' },
        { code: 'evoting:manage_polls', label: 'Create & Manage E-Voting Polls' },
        { code: 'evoting:vote', label: 'Cast Election Ballot' },
      ]
    },
    {
      title: 'Administration & Security',
      keys: [
        { code: 'users:create', label: 'Provision New User Accounts' },
        { code: 'users:edit', label: 'Modify Staff / User Accounts' },
        { code: 'users:reset_password', label: 'Admin Password Resets' },
        { code: 'settings:edit_school_profile', label: 'Edit Institutional Profile' },
        { code: 'platform:manage_schools', label: 'Multi-School Governance' },
        { code: 'platform:manage_licenses', label: 'License Activation' },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Account & Access Control</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage security credentials, sessions, and view role authorization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 gap-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors",
              activeTab === 'profile'
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <User className="w-4 h-4" />
            Profile & Session
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={cn(
              "py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors",
              activeTab === 'permissions'
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <Shield className="w-4 h-4" />
            Role Permissions
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {grantedPermissions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={cn(
              "py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors",
              activeTab === 'security'
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <KeyRound className="w-4 h-4" />
            Change Password
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* User Identity Banner */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {user.fullName ? user.fullName[0]?.toUpperCase() : (user.username?.[0]?.toUpperCase() || 'U')}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{user.fullName || user.username}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{user.username}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5",
                  roleInfo.badgeColor.bg,
                  roleInfo.badgeColor.text,
                  roleInfo.badgeColor.border
                )}>
                  <Shield className="w-3.5 h-3.5" />
                  <span>{roleInfo.name}</span>
                </div>
              </div>

              {/* Account Meta Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Registered Email</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.email || 'Not specified'}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Building className="w-3.5 h-3.5" />
                    <span>Assigned Institution</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{school?.name || 'Global Multi-Tenant'}</p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Authentication Token</span>
                  </div>
                  <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {token ? 'Signed Bearer Session (Active)' : 'Local Verified Session'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Last Login Timestamp</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Current session'}
                  </p>
                </div>
              </div>

              {/* Role description card */}
              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                  <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Role Responsibility: {roleInfo.category}</span>
                </div>
                <p className="text-xs text-indigo-950/80 dark:text-indigo-200/80 leading-relaxed">
                  {roleInfo.description}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Privilege Matrix</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Computed permissions for role: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{roleInfo.name}</span>
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-medium">
                  {grantedPermissions.length} Capabilities Granted
                </span>
              </div>

              <div className="space-y-4">
                {permissionCategories.map(cat => (
                  <div key={cat.title} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{cat.title}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.keys.map(item => {
                        const isGranted = (grantedPermissions as string[]).includes(item.code);
                        return (
                          <div
                            key={item.code}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg text-xs font-medium border",
                              isGranted
                                ? "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40"
                                : "bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800 opacity-60"
                            )}
                          >
                            {isGranted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="truncate">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg mx-auto">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Changing your password will immediately update your credentials across all SchoolSphere sessions and database records.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full pl-3 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Enter new password (min. 6 characters)"
                    className="w-full pl-3 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          strength <= 25 ? "bg-red-500 w-1/4" :
                          strength <= 50 ? "bg-amber-500 w-2/4" :
                          strength <= 75 ? "bg-blue-500 w-3/4" :
                          "bg-emerald-500 w-full"
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Password strength: {strength <= 25 ? 'Weak' : strength <= 50 ? 'Fair' : strength <= 75 ? 'Good' : 'Strong'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-type new password"
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="w-full mt-4 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
