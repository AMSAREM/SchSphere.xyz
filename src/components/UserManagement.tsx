import { useState, useEffect, FormEvent } from 'react';
import { db, User } from '../db/schema';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../contexts/NotificationContext';
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
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import bcrypt from 'bcryptjs';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { showToast, confirm } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // New user form
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'teacher' as User['role']
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const allUsers = await db.users.toArray();
    setUsers(allUsers);
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback(null);

    try {
      const existing = await db.users.where('username').equals(formData.username).first();
      if (existing) {
        setFeedback({ type: 'error', msg: 'Username already exists' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(formData.password, salt);

      const newUser: User = {
        username: formData.username,
        fullName: formData.fullName,
        passwordHash,
        role: formData.role,
        createdAt: Date.now()
      };

      await db.users.add(newUser);
      setFeedback({ type: 'success', msg: 'User created successfully' });
      setIsAddModalOpen(false);
      setFormData({ username: '', fullName: '', password: '', role: 'teacher' });
      loadUsers();
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Failed to create user' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (id === currentUser?.id) {
      showToast("You cannot delete your own account", "error");
      return;
    }

    const targetUser = users.find(u => u.id === id);
    if (targetUser && (targetUser.username.toLowerCase() === 'elena' || targetUser.username.toLowerCase() === 'elena_master')) {
      showToast("This master super admin account is protected and cannot be deleted.", "error");
      return;
    }

    confirm({
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      confirmLabel: "Delete User",
      onConfirm: async () => {
        try {
          await db.users.delete(id);
          loadUsers();
          showToast("User deleted successfully!", "success");
        } catch (err) {
          showToast("Failed to delete user", "error");
        }
      }
    });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only the Super Admin can access this module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">User Management</h1>
          <p className="text-slate-500 font-medium">Control system access and permissions</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      {feedback && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-2xl flex items-center gap-3 font-bold text-sm border",
            feedback.type === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
          )}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {feedback.msg}
          <button onClick={() => setFeedback(null)} className="ml-auto hover:opacity-70"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'System Admins', value: users.filter(u => u.role === 'super_admin' || u.role === 'admin').length, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Staff & Members', value: users.filter(u => u.role !== 'admin' && u.role !== 'super_admin').length, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={cn("p-3 rounded-2xl", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & List */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">User Info</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <motion.tr 
                  layout
                  key={user.id} 
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center border border-indigo-200">
                        <Users className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{user.fullName}</p>
                        <p className="text-xs text-slate-500 font-medium">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      user.role === 'super_admin' 
                        ? "bg-purple-50 text-purple-600 border-purple-100" 
                        : user.role === 'admin' 
                          ? "bg-indigo-50 text-indigo-600 border-indigo-100" 
                          : user.role === 'headteacher'
                            ? "bg-sky-50 text-sky-600 border-sky-100"
                            : user.role === 'teacher' 
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                              : user.role === 'accountant'
                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                : user.role === 'student'
                                  ? "bg-teal-50 text-teal-600 border-teal-100"
                                  : "bg-rose-50 text-rose-600 border-rose-100" // parent
                    )}>
                      {user.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => user.id && handleDeleteUser(user.id)}
                      disabled={user.id === currentUser?.id || user.username?.toLowerCase() === 'elena' || user.username?.toLowerCase() === 'elena_master'}
                      className={cn(
                        "p-2 rounded-xl border transition-all",
                        (user.id === currentUser?.id || user.username?.toLowerCase() === 'elena' || user.username?.toLowerCase() === 'elena_master')
                          ? "opacity-30 cursor-not-allowed bg-slate-50 text-slate-300 border-slate-100" 
                          : "bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-600 hover:text-white hover:shadow-lg hover:shadow-rose-100"
                      )}
                      title={(user.username?.toLowerCase() === 'elena' || user.username?.toLowerCase() === 'elena_master') ? "Protected Master Account" : (user.id === currentUser?.id ? "Cannot delete self" : "Delete User")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No users found</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Create User Account</h2>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.fullName}
                    onChange={e => setFormData({...formData, fullName: e.target.value})}
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Username</label>
                  <input 
                    required
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    placeholder="Choose username"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Initial Password</label>
                  <input 
                    required
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">System Role</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as any})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:bg-white transition-all text-sm font-bold text-slate-700"
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Administrator</option>
                    <option value="headteacher">Head Teacher</option>
                    <option value="teacher">Teacher</option>
                    <option value="accountant">Accountant</option>
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isLoading}
                    type="submit"
                    className="flex-3 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-sm"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save User Account"}
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

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
