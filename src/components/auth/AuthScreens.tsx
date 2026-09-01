import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  LogIn, 
  ShieldCheck, 
  Mail, 
  RefreshCw, 
  Trash2, 
  ArrowLeft, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  ExternalLink, 
  Copy, 
  Check, 
  HelpCircle,
  Sparkles,
  Building2,
  ChevronDown,
  Search,
  School as SchoolIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, School } from '../../db/schema';
import { useNotifications } from '../../contexts/NotificationContext';
import { authApi, schoolsApi } from '../../lib/api';

interface AuthScreensProps {
  onBackToGetStarted?: () => void;
}

type AuthMode = 'login' | 'magic' | 'magic_sent' | 'forgot' | 'sent' | 'reset';

export function AuthScreens({ onBackToGetStarted }: AuthScreensProps) {
  const settings = useLiveQuery(() => db.settings.toArray());
  const { showToast, confirm } = useNotifications();
  const schoolProfile = useMemo(() => 
    settings?.find(s => s.key === 'schoolProfile')?.value || { schoolName: 'SCHOOL SPHERE', logo: 'https://cdn.pixabay.com/photo/2016/10/06/19/03/graduation-cap-1719744_1280.png' }, 
    [settings]
  );

  const { handleLogin, signInWithMagicLink, verifyOtp, setSchoolContext } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-detection state for multi-school tenancy
  const [detectedSchool, setDetectedSchool] = useState<any | null>(null);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Auto-detect school based on input in real-time
  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean || clean.length < 2) {
      setDetectedSchool(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/resolve-school?input=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.school) {
            setDetectedSchool(data.school);
          } else {
            setDetectedSchool(null);
          }
        }
      } catch (e) {
        setDetectedSchool(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  // Magic link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicTokenInput, setMagicTokenInput] = useState('');
  const [magicActionUrl, setMagicActionUrl] = useState<string | null>(null);
  const [magicOtpCode, setMagicOtpCode] = useState<string | null>(null);

  // Forgot password form state
  const [forgotInput, setForgotInput] = useState('');
  const [recoveryData, setRecoveryData] = useState<{
    email: string;
    rawEmail?: string;
    username?: string;
    fullName?: string;
    resetToken?: string;
    resetCode?: string;
    supabaseRecoveryUrl?: string | null;
    message?: string;
  } | null>(null);

  // Reset password form state
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const activeDisplaySchool = detectedSchool || (schoolProfile.schoolName !== 'SCHOOL SPHERE' ? schoolProfile : null);

  const handleQuickLogin = async (usr: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    setUsername(usr);
    setPassword(pass);
    try {
      const result = await handleLogin(usr, pass, detectedSchool?.id);
      if (!result.success) {
        setError(result.error || 'Invalid username or password');
      } else {
        const schoolName = result.school?.name || (result.school as any)?.schoolName || 'your school';
        showToast(`Welcome back to ${schoolName}, ${result.user?.fullName || usr}!`, 'success');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await handleLogin(username, password, detectedSchool?.id);
      if (!result.success) {
        setError(result.error || 'Invalid username or password');
      } else {
        const schoolName = result.school?.name || (result.school as any)?.schoolName || 'your school';
        showToast(`Welcome back to ${schoolName}, ${result.user?.fullName || username}!`, 'success');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!magicEmail.trim() || !magicEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await signInWithMagicLink(magicEmail.trim());
      if (resp.success) {
        if (resp.magicLinkUrl) setMagicActionUrl(resp.magicLinkUrl);
        if (resp.emailOtpCode) {
          setMagicOtpCode(resp.emailOtpCode);
          setMagicTokenInput(resp.emailOtpCode);
        }
        setAuthMode('magic_sent');
        showToast('Magic login link dispatched via Supabase!', 'success');
      } else {
        setError(resp.error || 'Failed to dispatch magic link. Please verify your email.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send magic link. Please check network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!magicTokenInput.trim()) {
      setError('Please enter the verification code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await verifyOtp(magicEmail.trim(), magicTokenInput.trim());
      if (resp.success) {
        showToast('Email verified and logged in successfully!', 'success');
      } else {
        setError(resp.error || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim()) {
      setError('Please provide your registered email address or username');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await authApi.forgotPassword(forgotInput.trim());
      if (resp.success) {
        setRecoveryData(resp);
        if (resp.resetCode) {
          setResetCodeInput(resp.resetCode);
        }
        setAuthMode('sent');
        showToast('Password reset link generated & dispatched via Supabase!', 'success');
      } else {
        setError(resp.error || 'Unable to verify email address');
      }
    } catch (err: any) {
      setError(err?.message || 'No registered account found with that email. Please check and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const resp = await authApi.resetPassword({
        token: recoveryData?.resetToken,
        code: resetCodeInput.trim() || recoveryData?.resetCode,
        username: recoveryData?.username,
        email: recoveryData?.rawEmail,
        newPassword
      });

      if (resp.success) {
        showToast('Password successfully reset! You can now log in.', 'success');
        if (recoveryData?.username) {
          setUsername(recoveryData.username);
        }
        setPassword(newPassword);
        setAuthMode('login');
        setNewPassword('');
        setConfirmPassword('');
        setResetCodeInput('');
      } else {
        setError(resp.error || 'Failed to update password');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please check your reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRecoveryUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    showToast('Supabase recovery link copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
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
          {/* Multi-School Context Header */}
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-5 items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xs border border-slate-100 shrink-0 overflow-hidden p-1.5 bg-slate-50/20">
                {activeDisplaySchool?.logo || activeDisplaySchool?.logo_url ? (
                  <img 
                    src={activeDisplaySchool.logo || activeDisplaySchool.logo_url} 
                    alt={activeDisplaySchool.name || activeDisplaySchool.schoolName} 
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-indigo-600" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-snug truncate">
                    {detectedSchool ? (detectedSchool.name || detectedSchool.schoolName) : (schoolProfile.schoolName || 'UNIVERSAL CAMPUS PORTAL')}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn(
                    "inline-block w-1.5 h-1.5 rounded-full",
                    detectedSchool ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"
                  )} />
                  <p className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider truncate">
                    {detectedSchool ? `Verified Campus • Auto-Detected` : `Auto-Detect My School (Universal)`}
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border border-indigo-100/80 shadow-2xs">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>Smart Detect</span>
            </div>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {/* MODE 1: LOGIN */}
              {authMode === 'login' && (
                <motion.form 
                  key="login-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLoginSubmit} 
                  className="space-y-5"
                >
                  {error && (
                    <div className="p-3.5 rounded-xl text-xs font-bold transition-colors bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Auto-detected school banner notification */}
                  {detectedSchool && (
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">Campus: <strong>{detectedSchool.name}</strong></span>
                      </div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 shrink-0 bg-emerald-100 px-2 py-0.5 rounded-md">Auto-Detected</span>
                    </motion.div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username / Email</label>
                      <span className="text-[10px] text-slate-400 font-medium">Any registered school</span>
                    </div>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        required
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="e.g. admin or user@school"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setForgotInput(username);
                          setAuthMode('forgot');
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-all"
                      >
                        Forgot password?
                      </button>
                    </div>
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

                  <div className="space-y-2 pt-1">
                    <button 
                      disabled={isLoading}
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
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

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setError(null);
                        setMagicEmail(username.includes('@') ? username : '');
                        setAuthMode('magic');
                      }}
                      className="w-full py-2.5 px-4 bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-indigo-100/80 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Sign In with Passwordless Magic Link</span>
                    </button>
                  </div>
                </motion.form>
              )}

              {/* MODE: MAGIC LINK SIGN IN */}
              {authMode === 'magic' && (
                <motion.form 
                  key="magic-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleMagicLinkSubmit} 
                  className="space-y-5"
                >
                  <div className="text-center space-y-1 pb-2">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-indigo-100 shadow-xs">
                      <Sparkles className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-900">Passwordless Magic Link</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Enter your institutional email address. We'll dispatch a secure one-click sign-in link via Supabase directly to your inbox.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-xl text-xs font-bold transition-colors bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        required
                        type="email"
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="e.g. admin@school.edu.gh"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <button 
                      disabled={isLoading}
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Send Magic Link to Inbox</span>
                        </>
                      )}
                    </button>

                    <button 
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setError(null);
                        setAuthMode('login');
                      }}
                      className="w-full py-3 text-slate-500 hover:text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Password Login</span>
                    </button>
                  </div>
                </motion.form>
              )}

              {/* MODE: MAGIC LINK SENT CONFIRMATION */}
              {authMode === 'magic_sent' && (
                <motion.div
                  key="magic-sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center space-y-4"
                >
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900">Check Your Email!</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                      A secure Supabase magic authentication link has been dispatched to:
                    </p>
                    <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 break-all">
                      {magicEmail}
                    </div>
                  </div>

                  {/* OTP Token Verification Form */}
                  <form onSubmit={handleVerifyOtpSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-left">
                    <label className="text-xs font-bold text-slate-700 block">
                      Enter Verification Code (OTP)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={magicTokenInput}
                        onChange={(e) => setMagicTokenInput(e.target.value)}
                        placeholder="6-digit code e.g. 123456"
                        className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 tracking-wider text-center focus:border-indigo-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isLoading || !magicTokenInput.trim()}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify Code'}
                      </button>
                    </div>
                    {magicOtpCode && (
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>Pre-filled with your generated code: <strong className="text-indigo-700">{magicOtpCode}</strong></span>
                      </p>
                    )}
                  </form>

                  {/* Direct Action Link for Testing in Preview */}
                  {magicActionUrl && (
                    <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Direct Magic Link (Development Testing)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(magicActionUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-indigo-200 cursor-pointer"
                        >
                          {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <a
                        href={magicActionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        <span>Open & Complete Supabase Verification &rarr;</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    <button
                      onClick={() => handleMagicLinkSubmit({ preventDefault: () => {} } as any)}
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                      <span>Resend Magic Link</span>
                    </button>

                    <button
                      onClick={() => {
                        setError(null);
                        setAuthMode('login');
                      }}
                      className="w-full py-2 text-indigo-600 hover:text-indigo-700 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Return to Password Login</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* MODE 2: FORGOT PASSWORD REQUEST */}
              {authMode === 'forgot' && (
                <motion.form 
                  key="forgot-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleForgotPasswordSubmit} 
                  className="space-y-5"
                >
                  <div className="text-center space-y-1 pb-2">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-indigo-100">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-black text-slate-900">Forgot Password?</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Enter your registered email address or username. We will validate your account and generate a secure password reset link via Supabase.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-xl text-xs font-bold transition-colors bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Registered Email or Username</label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        required
                        type="text"
                        value={forgotInput}
                        onChange={(e) => setForgotInput(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="e.g. admin@schoolsphere.xyz or username"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <button 
                      disabled={isLoading}
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Generate Supabase Reset Link</span>
                        </>
                      )}
                    </button>

                    <button 
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setError(null);
                        setAuthMode('login');
                      }}
                      className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Login</span>
                    </button>
                  </div>
                </motion.form>
              )}

              {/* MODE 3: SENT CONFIRMATION & RECOVERY LINK */}
              {authMode === 'sent' && (
                <motion.div 
                  key="sent-confirmation"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-black text-slate-900">Reset Instructions Dispatched</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      A secure recovery session has been initialized for <strong className="text-slate-800">{recoveryData?.email}</strong>.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span>Verified Account:</span>
                      <span className="font-bold text-slate-900">{recoveryData?.fullName || recoveryData?.username}</span>
                    </div>
                    
                    {recoveryData?.resetCode && (
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold">6-Digit Reset Code:</span>
                        <span className="font-mono font-black text-sm tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {recoveryData.resetCode}
                        </span>
                      </div>
                    )}

                    {recoveryData?.supabaseRecoveryUrl && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supabase Action Link:</span>
                        <div className="flex items-center gap-2">
                          <input 
                            readOnly
                            type="text" 
                            value={recoveryData.supabaseRecoveryUrl} 
                            className="w-full text-[11px] font-mono bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-600 select-all truncate"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyRecoveryUrl(recoveryData.supabaseRecoveryUrl!)}
                            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 shrink-0"
                            title="Copy link"
                          >
                            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => {
                        setError(null);
                        setAuthMode('reset');
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Enter Code & Set New Password</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => {
                        setError(null);
                        setAuthMode('login');
                      }}
                      className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Login</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* MODE 4: RESET PASSWORD FORM */}
              {authMode === 'reset' && (
                <motion.form 
                  key="reset-password-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleResetPasswordSubmit} 
                  className="space-y-4"
                >
                  <div className="text-center space-y-1 pb-1">
                    <h3 className="text-base font-black text-slate-900">Set New Password</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Enter the 6-digit verification code and choose a new secure password.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-xl text-xs font-bold transition-colors bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">6-Digit Code / Token</label>
                    <input 
                      required
                      type="text"
                      value={resetCodeInput}
                      onChange={(e) => setResetCodeInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-mono font-bold tracking-widest text-center"
                      placeholder="123456"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        required
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm New Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        required
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button 
                      disabled={isLoading}
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Update Password & Log In</span>
                        </>
                      )}
                    </button>

                    <button 
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setError(null);
                        setAuthMode('login');
                      }}
                      className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Cancel & Back to Login</span>
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

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

