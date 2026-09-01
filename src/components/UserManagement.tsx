import { useState, useEffect, FormEvent } from 'react';
import { db, User } from '../db/schema';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
import { usersApi } from '../lib/api';
import { 
  ROLE_DEFINITIONS, 
  UserRole, 
  getRoleInfo, 
  getRolePermissions 
} from '../lib/permissions';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  Calendar, 
  Search, 
  MoreVertical, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Check, 
  Ban, 
  Lock, 
  KeyRound, 
  Eye, 
  Filter, 
  RefreshCw, 
  ShieldCheck, 
  Info,
  Building,
  Mail,
  Phone
} from 'lucide-react';
import { cn } from '../lib/utils';
import bcrypt from 'bcryptjs';

export default function UserManagement() {
  const { user: currentUser, school } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [inspectUser, setInspectUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // New user form
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'teacher' as UserRole,
    status: 'active'
  });

  useEffect(() => {
    loadUsers();
  }, [school?.id]);

  const loadUsers = async () => {
    try {
      const fetched = await usersApi.getAll(school?.id);
      if (Array.isArray(fetched) && fetched.length > 0) {
        setUsers(fetched);
      } else {
        const local = await db.users.toArray();
        setUsers(local);
      }
    } catch (e) {
      const local = await db.users.toArray();
      setUsers(local);
    }
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback(null);

    try {
      const cleanUsername = formData.username.trim().toLowerCase();
      const existing = users.find(u => u.username?.toLowerCase() === cleanUsername);
      if (existing) {
        setFeedback({ type: 'error', msg: 'Username already exists' });
        setIsLoading(false);
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(formData.password, salt);

      const newUser: User = {
        username: cleanUsername,
        fullName: formData.fullName.trim() || cleanUsername,
        full_name: formData.fullName.trim() || cleanUsername,
        email: formData.email.trim() || `${cleanUsername}@schoolsphere.xyz`,
        phone: formData.phone.trim() || '',
        passwordHash,
        password_hash: passwordHash,
        role: formData.role,
        status: formData.status || 'active',
        schoolId: formData.role === 'super_admin' ? undefined : school?.id,
        school_id: formData.role === 'super_admin' ? undefined : school?.id,
        createdAt: Date.now(),
        lastLogin: Date.now()
      };

      await usersApi.create(newUser, school?.id);
      setFeedback({ type: 'success', msg: 'User account created and synchronized successfully' });
      setIsAddModalOpen(false);
      setFormData({ username: '', fullName: '', email: '', phone: '', password: '', role: 'teacher', status: 'active' });
      await loadUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Failed to create user' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (userToUpdate: User) => {
    if (!userToUpdate.id) return;
    const isMaster = userToUpdate.username?.toLowerCase() === 'elena' || userToUpdate.username?.toLowerCase() === 'elena_master';
    if (isMaster) {
      showToast("Cannot modify status of master super admin account.", "error");
      return;
    }

    const newStatus = (userToUpdate.status || 'active') === 'active' ? 'suspended' : 'active';
    try {
      await usersApi.update(userToUpdate.id, { status: newStatus });
      showToast(`User status updated to ${newStatus}`, "success");
      await loadUsers();
    } catch (err) {
      showToast("Failed to update status", "error");
    }
  };

  const handleAdminResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !resetPasswordUser.id || !newResetPassword) return;

    if (newResetPassword.length < 4) {
      showToast("Password must be at least 4 characters", "error");
      return;
    }

    setIsLoading(true);
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newResetPassword, salt);
      await usersApi.update(resetPasswordUser.id, { passwordHash, password: newResetPassword });
      showToast(`Password successfully reset for @${resetPasswordUser.username}`, "success");
      setResetPasswordUser(null);
      setNewResetPassword('');
      await loadUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to reset password", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: number | string) => {
    if (id === currentUser?.id) {
      showToast("You cannot delete your own account", "error");
      return;
    }

    const targetUser = users.find(u => u.id === id);
    if (targetUser && (targetUser.username?.toLowerCase() === 'elena' || targetUser.username?.toLowerCase() === 'elena_master')) {
      showToast("This master super admin account is protected and cannot be deleted.", "error");
      return;
    }

    confirm({
      title: "Delete User Account",
      message: `Are you sure you want to permanently delete user @${targetUser?.username || 'account'}?`,
      confirmLabel: "Delete User",
      onConfirm: async () => {
        try {
          await usersApi.delete(id);
          await loadUsers();
          showToast("User deleted successfully!", "success");
        } catch (err) {
          showToast("Failed to delete user", "error");
        }
      }
    });
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName || u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Restricted</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Only administrators can manage platform user accounts and permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">User & Role Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Configure authentication credentials, role matrices, and institutional permissions</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add User Account
        </button>
      </div>

      {feedback && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl flex items-center gap-3 font-semibold text-sm border",
            feedback.type === 'success' 
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" 
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          )}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="hover:opacity-70"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
          { label: 'Active Users', value: users.filter(u => (u.status || 'active') === 'active').length, icon: Activity, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Administrators', value: users.filter(u => u.role === 'super_admin' || u.role === 'admin' || u.role === 'headteacher').length, icon: Shield, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
          { label: 'Suspended', value: users.filter(u => (u.status || 'active') === 'suspended' || u.status === 'inactive').length, icon: Ban, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className={cn("p-2.5 sm:p-3 rounded-xl", stat.bg)}>
              <stat.icon className={cn("w-5 h-5 sm:w-6 sm:h-6", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 shrink-0 mr-1">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        {[
          { id: 'all', label: 'All Roles' },
          { id: 'super_admin', label: 'Super Admins' },
          { id: 'admin', label: 'Admins' },
          { id: 'headteacher', label: 'Head Teachers' },
          { id: 'teacher', label: 'Teachers' },
          { id: 'accountant', label: 'Accountants' },
          { id: 'student', label: 'Students' },
          { id: 'parent', label: 'Parents' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedRoleFilter(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0",
              selectedRoleFilter === tab.id
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by username, full name, or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
          <button 
            onClick={loadUsers} 
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User Identity</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role & Privileges</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Institution</th>
                <th className="px-6 py-3.5 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredUsers.map((user) => {
                const isActive = (user.status || 'active') === 'active';
                const isMaster = user.username?.toLowerCase() === 'elena' || user.username?.toLowerCase() === 'elena_master';
                const roleInfo = getRoleInfo(user.role);

                return (
                  <tr 
                    key={user.id || user.username} 
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-linear-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-bold text-sm border border-indigo-200/50 dark:border-indigo-800/50">
                          {user.fullName ? user.fullName[0]?.toUpperCase() : (user.username?.[0]?.toUpperCase() || 'U')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.fullName || user.full_name || user.username}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{user.username} {user.email ? `• ${user.email}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1",
                          roleInfo.badgeColor.bg,
                          roleInfo.badgeColor.text,
                          roleInfo.badgeColor.border
                        )}>
                          <Shield className="w-3 h-3" />
                          {roleInfo.name}
                        </span>
                        <button
                          onClick={() => setInspectUser(user)}
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          title="View Role Capabilities & Permissions"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={isMaster}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors",
                          isActive 
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100" 
                            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100",
                          isMaster && "cursor-default"
                        )}
                        title={isMaster ? "Protected account" : "Click to toggle active status"}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-rose-500")} />
                        {user.status || 'active'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {user.schoolName || school?.name || 'Assigned School'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setResetPasswordUser(user)}
                          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 transition-colors"
                          title="Reset Password for this account"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => user.id && handleDeleteUser(user.id)}
                          disabled={user.id === currentUser?.id || isMaster}
                          className={cn(
                            "p-2 rounded-lg border transition-all",
                            (user.id === currentUser?.id || isMaster)
                              ? "opacity-30 cursor-not-allowed bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-800" 
                              : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50 hover:bg-rose-600 hover:text-white"
                          )}
                          title={isMaster ? "Protected Master Account" : (user.id === currentUser?.id ? "Cannot delete self" : "Delete User")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No matching users found in database</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create User Account</h2>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                    placeholder="e.g. John Mensah"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Username (Login ID)</label>
                  <input 
                    required
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    placeholder="e.g. jmensah"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email (Optional)</label>
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="user@school.edu"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone (Optional)</label>
                    <input 
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="024XXXXXXX"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Initial Password</label>
                  <input 
                    required
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="Enter secure initial password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">System Role</label>
                    <select 
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="super_admin">Super Administrator</option>
                      <option value="admin">School Administrator</option>
                      <option value="headteacher">Head Teacher</option>
                      <option value="teacher">Teacher</option>
                      <option value="accountant">Accountant / Bursar</option>
                      <option value="student">Student</option>
                      <option value="parent">Parent</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Status</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isLoading}
                    type="submit"
                    className="flex-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 text-xs"
                  >
                    {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Create Account"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Permissions Inspector Modal */}
      <AnimatePresence>
        {inspectUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Role Privileges: {inspectUser.fullName || inspectUser.username}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Role: {inspectUser.role}</p>
                  </div>
                </div>
                <button onClick={() => setInspectUser(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
                  {getRoleInfo(inspectUser.role).description}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Assigned Capabilities</h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {getRolePermissions(inspectUser.role).map((perm) => (
                      <div key={perm} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-mono text-[11px]">{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Reset Password Modal */}
      <AnimatePresence>
        {resetPasswordUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Admin Password Reset</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">User: @{resetPasswordUser.username}</p>
                  </div>
                </div>
                <button onClick={() => setResetPasswordUser(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAdminResetPassword} className="p-6 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  As an administrator, you can directly set a new temporary or permanent password for this account.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">New Password</label>
                  <input
                    type="password"
                    required
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setResetPasswordUser(null)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !newResetPassword}
                    className="flex-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 text-xs"
                  >
                    {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Save New Password"}
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
