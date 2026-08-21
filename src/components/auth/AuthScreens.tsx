import { useState, FormEvent, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, LogIn, ShieldCheck, Mail, RefreshCw, Trash2, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useNotifications } from '../../contexts/NotificationContext';

interface AuthScreensProps {
  onBackToGetStarted?: () => void;
}

export function AuthScreens({ onBackToGetStarted }: AuthScreensProps) {
  const settings = useLiveQuery(() => db.settings.toArray());
  const { showToast, confirm } = useNotifications();
  const schoolProfile = useMemo(() => 
    settings?.find(s => s.key === 'schoolProfile')?.value || { schoolName: 'SCHOOL SPHERE', logo: 'https://cdn.pixabay.com/photo/2016/10/06/19/03/graduation-cap-1719744_1280.png' }, 
    [settings]
  );

  const { handleLogin, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleQuickLogin = async (usr: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    setUsername(usr);
    setPassword(pass);
    try {
      const result = await handleLogin(usr, pass);
      if (!result.success) {
        setError(result.error || 'Invalid username or password');
      } else {
        showToast(`Welcome back, ${result.user?.fullName || usr}!`, 'success');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await handleLogin(username, password);
      if (!result.success) {
        setError(result.error || 'Invalid username or password');
      } else {
        showToast(`Welcome back, ${result.user?.fullName || username}!`, 'success');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-2xl flex flex-col items-center">
        {onBackToGetStarted && (
          <button
            onClick={onBackToGetStarted}
            className="mb-4 flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-250 transition-all duration-150 cursor-pointer shadow-xs active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Command Gate</span>
          </button>
        )}

        {/* School Sphere Platform Branding Header */}
        <div className="text-center mb-8 w-full flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center p-4"
          >
            <div className="flex flex-col items-center justify-center mb-4">
              <img 
                src="/sch sphere logo1.png" 
                alt="School Sphere Logo" 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover pointer-events-none mb-4 select-none filter drop-shadow-sm animate-pulse-subtle sharpen-image" 
                referrerPolicy="no-referrer" 
              />
              <span className="font-extrabold text-[40px] sm:text-[48px] tracking-tight leading-none text-slate-900 select-none">
                School<span className="text-indigo-600">Sphere</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
              Institutional Administration System
            </p>
          </motion.div>
        </div>

        {/* Dedicated School Portal Authorization Card */}
        <motion.div 
          layout
          className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden w-full max-w-md"
        >
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-6 items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow shadow-indigo-100 border border-slate-100 shrink-0 overflow-hidden p-1.5 bg-slate-50/20">
              {schoolProfile.logo ? (
                <img src={schoolProfile.logo} alt={schoolProfile.schoolName} className="w-full h-full object-contain" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-snug truncate">
                {schoolProfile.schoolName}
              </h2>
              <p className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider mt-0.5">Secure Workspace Portal</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <AnimatePresence mode="wait">
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {error && (
                  <div className="p-3 rounded-xl text-xs font-bold transition-colors bg-rose-50 text-rose-600">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      required
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                      placeholder="admin"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Quick Portal Access Shortcuts */}
                <div className="pt-3 border-t border-slate-100/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Demo Portal Quick Access
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleQuickLogin('school_admin', 'july94bab')}
                      className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-100 rounded-xl text-left transition-all text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-sm">🏢</span>
                      <div className="min-w-0">
                        <p className="truncate leading-none text-slate-800">School Admin</p>
                        <span className="text-[8px] text-slate-400 font-medium">Main School Dashboard</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleQuickLogin('ebenezer', 'july94bab')}
                      className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-100 rounded-xl text-left transition-all text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-sm">👨‍🏫</span>
                      <div className="min-w-0">
                        <p className="truncate leading-none text-slate-800">Teacher</p>
                        <span className="text-[8px] text-slate-400 font-medium">Academics</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleQuickLogin('alice', 'july94bab')}
                      className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-100 rounded-xl text-left transition-all text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-sm">💰</span>
                      <div className="min-w-0">
                        <p className="truncate leading-none text-slate-800">Accountant</p>
                        <span className="text-[8px] text-slate-400 font-medium">Finance</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleQuickLogin('kofi', 'july94bab')}
                      className="flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-100 rounded-xl text-left transition-all text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-sm">🎓</span>
                      <div className="min-w-0">
                        <p className="truncate leading-none text-slate-800">Student</p>
                        <span className="text-[8px] text-slate-400 font-medium">Personal</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleQuickLogin('ama', 'july94bab')}
                      className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 border border-slate-100 rounded-xl text-center transition-all text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-sm">👪</span>
                      <span>Access Parent Portal (Wards Portfolio)</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <button 
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mt-2"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Log In to System</span>
                </>
              )}
            </button>
          </form>

          <div className="p-6 bg-slate-50 border-t border-slate-100 text-center space-y-3">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              SchoolSphere Cloud & Database Portal <br/> Authenticated staff access
            </p>
            <div className="pt-2 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  confirm({
                    title: "Reset Database",
                    message: "Are you sure you want to completely refresh and restart all data? All changes, accounts, and logs will be permanently reseeded.",
                    confirmLabel: "Reset Database",
                    onConfirm: async () => {
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
                          db.users.clear()
                        ]);
                        localStorage.clear();
                        showToast("Database refreshed! System reseeded.", "success");
                        setTimeout(() => window.location.reload(), 1000);
                      } catch (e) {
                        showToast("Error resetting database. Please refresh page manually.", "error");
                      }
                    }
                  });
                }}
                className="text-[10px] text-rose-500 hover:text-rose-600 font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 mx-auto active:scale-95 duration-100 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset Database & Start Fresh</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
