import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Briefcase,
  DollarSign,
  Megaphone,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  PlusCircle,
  Filter,
  Calculator,
  Mail,
  Send,
  Zap,
  Lock,
  CheckCircle2,
  CloudOff,
  AlertTriangle,
  X,
  Sparkles,
  RefreshCw,
  Globe,
  ExternalLink,
  MessageSquare,
  FileText,
  Share2,
  Info,
  Phone
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LicenseSyncBanner } from '../LicenseSyncBanner';
import { validateEmailSyntax, verifyEmailWithBackend, EmailValidationResult } from '../../lib/emailValidation';
import { 
  signInWithGoogle, 
  signOutGoogle, 
  getGoogleAccessToken, 
  getCurrentGoogleUser, 
  sendLicenseViaGmailApi,
  getGmailWebComposeUrl,
  getMailtoComposeUrl,
  getWhatsAppShareUrl,
  buildLicensePlainText
} from '../../lib/gmailService';

interface SalesSuiteProps {
  activePanel: string;
  licensesList: any[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterTier: string;
  setFilterTier: (tier: string) => void;
  filteredLicenses: any[];
  handleGenerateKey: (e: React.FormEvent) => void;
  genSchoolName: string;
  setGenSchoolName: (name: string) => void;
  genDuration: string;
  setGenDuration: (duration: string) => void;
  genTier: string;
  setGenTier: (tier: string) => void;
  genSelectedModules: string[];
  setGenSelectedModules: (modules: string[]) => void;
  isGenerating: boolean;
  isRevoking: string | null;
  handleRevokeKey: (key: string) => void;
  availableModules: any[];

  // Pricing calculator props
  calcNumStudents: number;
  setCalcNumStudents: (val: number) => void;
  calcTier: string;
  setCalcTier: (tier: string) => void;
  calcSMSAddon: boolean;
  setCalcSMSAddon: (val: boolean) => void;
  calcVotingAddon: boolean;
  setCalcVotingAddon: (val: boolean) => void;
  calcSupportLevel: string;
  setCalcSupportLevel: (level: string) => void;
  copiedProposal: boolean;
  copyProposalToClipboard: () => void;
  pricing: any;

  // Client email delivery props
  genClientEmail?: string;
  setGenClientEmail?: (email: string) => void;
  genContactPerson?: string;
  setGenContactPerson?: (name: string) => void;
  sendEmailOnGenerate?: boolean;
  setSendEmailOnGenerate?: (val: boolean) => void;
  handleSendLicenseEmail?: (licenseKey: string, recipientEmail: string, schoolName?: string, contactPerson?: string) => Promise<boolean>;
}

export default function SalesSuite({
  activePanel,
  licensesList,
  searchQuery,
  setSearchQuery,
  filterTier,
  setFilterTier,
  filteredLicenses,
  handleGenerateKey,
  genSchoolName,
  setGenSchoolName,
  genDuration,
  setGenDuration,
  genTier,
  setGenTier,
  genSelectedModules,
  setGenSelectedModules,
  isGenerating,
  isRevoking,
  handleRevokeKey,
  availableModules,

  calcNumStudents,
  setCalcNumStudents,
  calcTier,
  setCalcTier,
  calcSMSAddon,
  setCalcSMSAddon,
  calcVotingAddon,
  setCalcVotingAddon,
  calcSupportLevel,
  setCalcSupportLevel,
  copiedProposal,
  copyProposalToClipboard,
  pricing,

  genClientEmail = '',
  setGenClientEmail = () => {},
  genContactPerson = '',
  setGenContactPerson = () => {},
  sendEmailOnGenerate = true,
  setSendEmailOnGenerate = () => {},
  handleSendLicenseEmail
}: SalesSuiteProps) {

  // Local state for CRM
  const [crmLeads, setCrmLeads] = useState<any[]>(() => {
    const cached = localStorage.getItem('esepa_creator_crm_leads');
    if (cached) return JSON.parse(cached);
    return [
      { id: '1', schoolName: 'Kumasi Science High School', contactPerson: 'Principal Isaac Osei', phone: '+233 24 555 1212', email: 'kumasitech@edu.gh', status: 'Demo Scheduled', notes: 'Very interested in eVoting and Results SMS.' },
      { id: '2', schoolName: 'Tema International Pre-School', contactPerson: 'Director Sarah Mensah', phone: '+233 20 888 3434', email: 'temapreschool@gmail.com', status: 'Lead', notes: 'Inquired about fee management system.' },
      { id: '3', schoolName: 'Legon Academic Academy', contactPerson: 'Dr. John Arthur', phone: '+233 30 123 4567', email: 'legonacademy@edu.gh', status: 'Proposal Sent', notes: 'Sent Standard proposal ($950/yr + sms addon).' }
    ];
  });

  const [leadSchool, setLeadSchool] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadStatus, setLeadStatus] = useState('Lead');
  const [leadNotes, setLeadNotes] = useState('');

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadSchool.trim()) return;
    const newLead = {
      id: Date.now().toString(),
      schoolName: leadSchool.trim(),
      contactPerson: leadContact.trim(),
      phone: leadPhone.trim(),
      email: leadEmail.trim(),
      status: leadStatus,
      notes: leadNotes.trim()
    };
    const updated = [...crmLeads, newLead];
    setCrmLeads(updated);
    localStorage.setItem('esepa_creator_crm_leads', JSON.stringify(updated));
    setLeadSchool('');
    setLeadContact('');
    setLeadPhone('');
    setLeadEmail('');
    setLeadNotes('');
  };

  const handleUpdateLeadStatus = (id: string, newStatus: string) => {
    const updated = crmLeads.map(l => l.id === id ? { ...l, status: newStatus } : l);
    setCrmLeads(updated);
    localStorage.setItem('esepa_creator_crm_leads', JSON.stringify(updated));
  };

  const handleRemoveLead = (id: string) => {
    const updated = crmLeads.filter(l => l.id !== id);
    setCrmLeads(updated);
    localStorage.setItem('esepa_creator_crm_leads', JSON.stringify(updated));
  };

  // Local state for Invoicing
  const [billingSchool, setBillingSchool] = useState('');
  const [billingAmount, setBillingAmount] = useState('');
  const [billingType, setBillingType] = useState('Setup Fee');
  const [billingStatus, setBillingStatus] = useState('Paid');
  const [invoices, setInvoices] = useState<any[]>(() => {
    const cached = localStorage.getItem('esepa_creator_invoices');
    if (cached) return JSON.parse(cached);
    return [
      { id: 'inv-101', school: 'Accra Science Academy', type: 'Annual Renewal', amount: 950, status: 'Paid', date: '2026-06-25' },
      { id: 'inv-102', school: 'Kumasi Science High', type: 'Setup & Install', amount: 580, status: 'Pending', date: '2026-06-28' },
      { id: 'inv-103', school: 'Tema International School', type: 'SMS Pack Purchase', amount: 350, status: 'Overdue', date: '2026-06-05' }
    ];
  });

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingSchool || !billingAmount) return;
    const newInv = {
      id: `inv-${Math.floor(100 + Math.random() * 900)}`,
      school: billingSchool,
      type: billingType,
      amount: parseFloat(billingAmount) || 0,
      status: billingStatus,
      date: new Date().toISOString().split('T')[0]
    };
    const updated = [...invoices, newInv];
    setInvoices(updated);
    localStorage.setItem('esepa_creator_invoices', JSON.stringify(updated));
    setBillingSchool('');
    setBillingAmount('');
  };

  const handleToggleInvoiceStatus = (id: string) => {
    const updated = invoices.map(inv => {
      if (inv.id === id) {
        const nextStatus = inv.status === 'Paid' ? 'Pending' : inv.status === 'Pending' ? 'Overdue' : 'Paid';
        return { ...inv, status: nextStatus };
      }
      return inv;
    });
    setInvoices(updated);
    localStorage.setItem('esepa_creator_invoices', JSON.stringify(updated));
  };

  // Local state for copy feedback & freshly issued key
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newlyIssuedLicense, setNewlyIssuedLicense] = useState<any | null>(null);

  // Google Gmail state
  const [googleUser, setGoogleUser] = useState<any | null>(() => getCurrentGoogleUser());
  const [googleToken, setGoogleToken] = useState<string | null>(() => getGoogleAccessToken());
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Real-time email validation state for generator form
  const [genEmailValidation, setGenEmailValidation] = useState<EmailValidationResult | null>(null);
  const [isValidatingGenEmail, setIsValidatingGenEmail] = useState(false);

  // Email dispatch modal states
  const [emailModalLicense, setEmailModalLicense] = useState<any | null>(null);
  const [customEmailRecipient, setCustomEmailRecipient] = useState('');
  const [customPhoneRecipient, setCustomPhoneRecipient] = useState('');
  const [customContactPerson, setCustomContactPerson] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [preferredMethod, setPreferredMethod] = useState<'gmail' | 'supabase'>('supabase');
  const [modalEmailValidation, setModalEmailValidation] = useState<EmailValidationResult | null>(null);
  const [isValidatingModalEmail, setIsValidatingModalEmail] = useState(false);
  const [isSendingCustomEmail, setIsSendingCustomEmail] = useState(false);
  const [emailSentSuccessMsg, setEmailSentSuccessMsg] = useState<string | null>(null);
  const [emailSentMethod, setEmailSentMethod] = useState<string | null>(null);
  const [dispatchedEmailPackage, setDispatchedEmailPackage] = useState<any | null>(null);
  const [copiedEmailBody, setCopiedEmailBody] = useState(false);
  const [copiedActivationLink, setCopiedActivationLink] = useState(false);

  // Validate generator email on change
  useEffect(() => {
    if (!genClientEmail || !genClientEmail.trim()) {
      setGenEmailValidation(null);
      return;
    }
    const clean = genClientEmail.trim();
    const syntax = validateEmailSyntax(clean);
    setGenEmailValidation(syntax);

    if (syntax.isValid) {
      setIsValidatingGenEmail(true);
      const timer = setTimeout(async () => {
        const deep = await verifyEmailWithBackend(clean);
        setGenEmailValidation(deep);
        setIsValidatingGenEmail(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [genClientEmail]);

  // Validate modal email on change
  useEffect(() => {
    if (!customEmailRecipient || !customEmailRecipient.trim()) {
      setModalEmailValidation(null);
      return;
    }
    const clean = customEmailRecipient.trim();
    const syntax = validateEmailSyntax(clean);
    setModalEmailValidation(syntax);

    if (syntax.isValid) {
      setIsValidatingModalEmail(true);
      const timer = setTimeout(async () => {
        const deep = await verifyEmailWithBackend(clean);
        setModalEmailValidation(deep);
        setIsValidatingModalEmail(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [customEmailRecipient]);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await signInWithGoogle();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err: any) {
      console.warn('Google authorization notice:', err?.message || err);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSendViaGmailDirect = async () => {
    if (!emailModalLicense || !customEmailRecipient.trim()) return;

    const val = validateEmailSyntax(customEmailRecipient.trim());
    if (!val.isValid) {
      alert(`Invalid email address: ${val.error}`);
      return;
    }

    setIsSendingCustomEmail(true);
    setEmailSentSuccessMsg(null);

    try {
      let token = googleToken || getGoogleAccessToken();
      if (!token) {
        const res = await signInWithGoogle();
        if (!res?.accessToken) {
          throw new Error('Google Sign-in was cancelled or denied. You can use 1-Click Web Gmail Compose instead.');
        }
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        token = res.accessToken;
      }

      const result = await sendLicenseViaGmailApi({
        licenseKey: emailModalLicense.key,
        recipientEmail: customEmailRecipient.trim(),
        schoolName: emailModalLicense.schoolName,
        contactPerson: customContactPerson.trim() || undefined,
        tier: emailModalLicense.tier,
        durationMonths: emailModalLicense.durationMonths,
        customMessage: customMessage.trim() || undefined,
        activeModules: emailModalLicense.activeModules,
        accessToken: token
      });

      if (result.success) {
        setEmailSentMethod('gmail');
        setEmailSentSuccessMsg(`License key delivered directly via your Google/Gmail account to ${customEmailRecipient.trim()}!`);
        setDispatchedEmailPackage({
          licenseKey: emailModalLicense.key,
          recipientEmail: customEmailRecipient.trim(),
          schoolName: emailModalLicense.schoolName,
          dispatchMethod: 'gmail',
          emailDispatched: true
        });
      }
    } catch (err: any) {
      console.error('Direct Gmail send failed:', err);
      alert(`Gmail Dispatch Notice: ${err.message || 'Could not send via Gmail API. You can use 1-Click Web Gmail or Cloud Server below.'}`);
    } finally {
      setIsSendingCustomEmail(false);
    }
  };

  const handleTriggerSendEmailModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModalLicense || !customEmailRecipient.trim()) return;

    // Syntax validation guard
    const val = validateEmailSyntax(customEmailRecipient.trim());
    if (!val.isValid) {
      alert(`Invalid email address: ${val.error}`);
      return;
    }

    setIsSendingCustomEmail(true);
    setEmailSentSuccessMsg(null);
    setDispatchedEmailPackage(null);

    try {
      const activeToken = googleToken || getGoogleAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/license/send-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          licenseKey: emailModalLicense.key,
          recipientEmail: customEmailRecipient.trim(),
          schoolName: emailModalLicense.schoolName,
          contactPerson: customContactPerson.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
          googleAccessToken: activeToken || undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const method = data.dispatchMethod || (data.emailDispatched ? 'cloud_email' : 'direct_delivery_ready');
        setEmailSentMethod(method);
        setEmailSentSuccessMsg(data.message || `License package prepared for ${customEmailRecipient.trim()}!`);
        setDispatchedEmailPackage({
          licenseKey: data.licenseKey || emailModalLicense.key,
          recipientEmail: data.recipientEmail || customEmailRecipient.trim(),
          schoolName: data.schoolName || emailModalLicense.schoolName,
          subject: data.mailSubject,
          textBody: data.mailBodyText,
          htmlBody: data.mailBodyHtml,
          mailtoUrl: data.mailtoUrl,
          activationUrl: data.activationUrl,
          magicLinkUrl: data.magicLinkUrl,
          emailOtpCode: data.emailOtpCode,
          dispatchMethod: method,
          emailDispatched: data.emailDispatched
        });
      } else {
        throw new Error(data.error || 'Failed to dispatch license email.');
      }
    } catch (err: any) {
      console.error('Failed to send license email:', err);
      alert(`Email dispatch notice: ${err.message || 'Please verify email recipient.'}`);
    } finally {
      setIsSendingCustomEmail(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genSchoolName.trim()) return;
    const previousCount = licensesList.length;
    await handleGenerateKey(e);
  };

  // Finance lists
  const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.amount, 0);
  const totalCollected = invoices.filter(i => i.status === 'Paid').reduce((acc, inv) => acc + inv.amount, 0);

  if (activePanel === 'subscription_billing') {
    return (
      <div className="space-y-6">
        {/* Vercel Frontend ⚡ Supabase Cloud Database Bridge Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-indigo-900/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600/30 text-indigo-300 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black tracking-wide text-white">Vercel Frontend ⚡ Supabase Cloud Database Link</h2>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">
                    ACTIVE & SYNCED
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Synchronizing client school licenses, subscription plans, and renewal quotas live between Vercel Edge Frontend & Supabase Cloud PostgreSQL.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://esepa-school-portal.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-indigo-600/40 hover:bg-indigo-600 text-indigo-100 rounded-xl text-xs font-bold border border-indigo-500/40 transition flex items-center gap-1.5"
              >
                Vercel Host ↗
              </a>
              <a
                href="https://niavmonyfwqlryppgksy.supabase.co"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-100 rounded-xl text-xs font-bold border border-emerald-500/40 transition flex items-center gap-1.5"
              >
                Supabase DB ↗
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Frontend Origin</span>
              <span className="text-xs font-mono font-bold text-indigo-300 block truncate mt-0.5">https://esepa-school-portal.vercel.app</span>
              <span className="text-[9px] text-emerald-400 font-bold block mt-1">🟢 Connected (Vercel Edge)</span>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Supabase PostgreSQL DB</span>
              <span className="text-xs font-mono font-bold text-emerald-300 block truncate mt-0.5">niavmonyfwqlryppgksy.supabase.co</span>
              <span className="text-[9px] text-emerald-400 font-bold block mt-1">🟢 Connected (Port 5432 / REST)</span>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Licensing & Subscriptions</span>
              <span className="text-xs font-bold text-white block mt-0.5">RLS Security Enforced</span>
              <span className="text-[9px] text-indigo-300 font-bold block mt-1">⚡ Instant Sync Enabled</span>
            </div>
          </div>
        </div>

        {/* Sales proposal & Pricing calculator */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Proposal Pricing Architect</h2>
                <p className="text-[11px] text-slate-500">Formulate and export precise commercial invoices for prospective school authorities.</p>
              </div>
            </div>
            <button
              onClick={copyProposalToClipboard}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              {copiedProposal ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Proposal Proposal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Client School Size ({calcNumStudents} Students)</label>
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="50"
                  value={calcNumStudents}
                  onChange={(e) => setCalcNumStudents(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">System License Tier</label>
                  <select
                    value={calcTier}
                    onChange={(e) => setCalcTier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-hidden"
                  >
                    <option value="Basic">Basic Edition</option>
                    <option value="Standard">Standard Edition</option>
                    <option value="Professional">Professional</option>
                    <option value="Developer">Developer Bypass</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">SLA Support Level</label>
                  <select
                    value={calcSupportLevel}
                    onChange={(e) => setCalcSupportLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-hidden"
                  >
                    <option value="basic">Standard (Email only)</option>
                    <option value="premium">Premium (Termly visits)</option>
                    <option value="all_access">All-Access (24/7 Hotlines)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Core Add-ons</span>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={calcSMSAddon}
                      onChange={(e) => setCalcSMSAddon(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    SMS Alerts Pack (+$350)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={calcVotingAddon}
                      onChange={(e) => setCalcVotingAddon(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    eVoting Module (+$200)
                  </label>
                </div>
              </div>
            </div>

            <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase text-indigo-800 tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Estimated Commercial Quote
                </h3>
                <div className="grid grid-cols-2 gap-4 py-2">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Installation Setup</span>
                    <div className="text-xl font-black text-slate-800 font-mono mt-0.5">${pricing.setupFee}</div>
                    <span className="text-[10px] font-bold text-indigo-600">~ GHS {pricing.localGHSSetup.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Annual License Fee</span>
                    <div className="text-xl font-black text-slate-800 font-mono mt-0.5">${pricing.annualLicense}</div>
                    <span className="text-[10px] font-bold text-indigo-600">~ GHS {pricing.localGHSAnnual.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 bg-white border border-slate-100 p-2.5 rounded-lg font-semibold mt-4">
                💡 <strong>Ghana Collection Tip:</strong> Most local schools prefer paying per term (e.g. quarterly) to align with school fees collections timelines.
              </div>
            </div>
          </div>
        </div>

        {/* Invoices panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Draft New Invoice</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Target School</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Accra Science Academy"
                  value={billingSchool}
                  onChange={(e) => setBillingSchool(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Total Fee ($)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 950"
                    value={billingAmount}
                    onChange={(e) => setBillingAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Status</label>
                  <select
                    value={billingStatus}
                    onChange={(e) => setBillingStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Category Type</label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  <option value="Setup Fee">Setup Fee</option>
                  <option value="Annual License">Annual License</option>
                  <option value="SMS Add-on">SMS Add-on</option>
                  <option value="Support Add-on">Support Add-on</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
              >
                Publish Invoice
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Invoices & Payments Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pr-2">Invoice ID</th>
                    <th className="pb-3 pr-2">School</th>
                    <th className="pb-3 pr-2">Category</th>
                    <th className="pb-3 pr-2">Amount</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-mono text-slate-500 pr-2">{inv.id}</td>
                      <td className="py-2.5 font-bold text-slate-800 pr-2">{inv.school}</td>
                      <td className="py-2.5 text-slate-600 pr-2">{inv.type}</td>
                      <td className="py-2.5 font-mono font-bold text-slate-700 pr-2">${inv.amount}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleToggleInvoiceStatus(inv.id)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border transition cursor-pointer',
                            inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            inv.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-rose-50 text-rose-600 border-rose-100'
                          )}
                        >
                          {inv.status}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'crm') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Sales Pipeline (CRM)</h2>
            <p className="text-xs text-slate-500">Track prospective schools through our direct marketing funnel.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Log New Prospect</h3>
            <form onSubmit={handleAddLead} className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 block mb-0.5">SCHOOL NAME</label>
                <input
                  type="text" required placeholder="e.g. Kumasi Secondary Tech"
                  value={leadSchool} onChange={(e) => setLeadSchool(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">CONTACT PERSON</label>
                  <input
                    type="text" placeholder="Principal Isaac"
                    value={leadContact} onChange={(e) => setLeadContact(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">PHONE NUMBER</label>
                  <input
                    type="text" placeholder="+233..."
                    value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">EMAIL ADDRESS</label>
                  <input
                    type="email" placeholder="school@edu.gh"
                    value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">PIPELINE STATUS</label>
                  <select
                    value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden text-slate-700"
                  >
                    <option value="Lead">Cold Lead</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Demo Scheduled">Demo Scheduled</option>
                    <option value="Proposal Sent">Proposal Sent</option>
                    <option value="Won">Won</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 block mb-0.5">CONVERSATION NOTES</label>
                <textarea
                  placeholder="Inquired about grading terminal..." rows={2}
                  value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-hidden resize-none"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition">
                Register Lead
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Active Deals & Outreach Leads</h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {crmLeads.map((lead) => (
                <div key={lead.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2 flex flex-col justify-between md:flex-row md:items-center gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-xs">{lead.schoolName}</h4>
                    <p className="text-[10px] text-slate-500">
                      Contact: <strong>{lead.contactPerson || 'N/A'}</strong> | {lead.phone} | {lead.email}
                    </p>
                    {lead.notes && <p className="text-[10px] text-indigo-600 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/30 font-semibold">{lead.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                    <select
                      value={lead.status}
                      onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                      className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 focus:outline-hidden"
                    >
                      <option value="Lead">Lead</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Demo Scheduled">Demo Scheduled</option>
                      <option value="Proposal Sent">Proposal Sent</option>
                      <option value="Won">Won</option>
                    </select>
                    <button
                      onClick={() => handleRemoveLead(lead.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'finance') {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Finance & Revenue Ledger</h2>
            <p className="text-xs text-slate-500">Track software sales, licensing collections and operational expenditures.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Invoiced Billing</span>
            <span className="text-2xl font-black text-slate-800 font-mono mt-1 block">${totalInvoiced}</span>
          </div>
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actual Collected Earnings</span>
            <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">${totalCollected}</span>
          </div>
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstandings Balance</span>
            <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">${totalInvoiced - totalCollected}</span>
          </div>
        </div>

        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Ghana Cedi Exchange Converter</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">USD AMOUNT ($)</span>
              <div className="font-mono font-bold text-base bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700">
                ${totalCollected}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">GHS EQUIVALENT (₵, RATE: 15.2)</span>
              <div className="font-mono font-bold text-base bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-4 py-2">
                ₵ {(totalCollected * 15.2).toLocaleString()} GHS
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activePanel === 'marketing') {
    const marketingPitches = [
      {
        title: '🌟 Pitch 1: Standard Academic Compliance Pitch',
        subject: 'Modernize Grading & Instant Terminal Reports compliance for Academic Year',
        body: 'Provide headteachers with one-click automatic class marks summaries, WASSCE cumulative records compliance grading tables, and instant student WhatsApp terminal results cards.'
      },
      {
        title: '⚡ Pitch 2: Financial Efficiency & Fee Invoicing',
        subject: 'Stop fee leakages. Instant parent tuition payment SMS invoices.',
        body: 'Local banks integration setup, instant printed billing sheets for class levels, real-time parent mobile transaction notifications, and automatic outstanding arrears statements logs.'
      },
      {
        title: '🔒 Pitch 3: Parent Engagement & Crisis Siren Alert',
        subject: 'Emergency Parent Broadcaster & Public School Bells automation.',
        body: 'Direct computerized school horn bells synchronizations, instant SMS portal triggers, automatic attendance biometric parent alerts, and public election portals.'
      }
    ];

    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Marketing Kit & Sales Material</h2>
            <p className="text-xs text-slate-500">Ready-made sales flyer content and email outbound drafts to copy and convert prospects.</p>
          </div>
        </div>

        <div className="space-y-4">
          {marketingPitches.map((pitch, idx) => (
            <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide">{pitch.title}</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${pitch.subject}\n\n${pitch.body}`);
                    alert("Marketing pitch template copied to clipboard!");
                  }}
                  className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Pitch
                </button>
              </div>
              <p className="text-xs font-bold text-indigo-600">Subject: {pitch.subject}</p>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">{pitch.body}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activePanel === 'license_management') {
    const latestLicense = filteredLicenses[0] || licensesList[0];

    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <LicenseSyncBanner />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Client License Keys Registry & Issuance</h2>
              <p className="text-[11px] text-slate-500">Issue single-use RSA license validation tokens for schools with real-time Supabase authorization & Gmail dispatch.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-2.5 py-1 rounded-full uppercase border border-indigo-100">
              Active RSA Key-Gen
            </span>
          </div>
        </div>

        {/* License Issuance Form */}
        <form onSubmit={handleGenerateKey} className="space-y-4">
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest block">
                Issue New Client School License
              </span>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-400 font-semibold">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => setGenSchoolName('Accra Science & Tech Academy')}
                  className="text-indigo-600 hover:underline font-bold"
                >
                  Accra Sci
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setGenSchoolName('Kumasi International High')}
                  className="text-indigo-600 hover:underline font-bold"
                >
                  Kumasi High
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setGenSchoolName('Tema Excellence College')}
                  className="text-indigo-600 hover:underline font-bold"
                >
                  Tema College
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Client School Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Peters Senior High School"
                  value={genSchoolName}
                  onChange={(e) => setGenSchoolName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-xs text-slate-800 focus:outline-hidden transition"
                />
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block flex items-center justify-between">
                  <span>Client Email (For Auto Delivery)</span>
                  <span className="text-[9px] text-indigo-600 font-semibold lowercase">sends key & link</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="principal@school.edu.gh"
                    value={genClientEmail}
                    onChange={(e) => setGenClientEmail(e.target.value)}
                    className={cn(
                      "w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl focus:ring-2 font-medium text-xs text-slate-800 focus:outline-hidden transition",
                      genEmailValidation
                        ? genEmailValidation.isValid
                          ? "border-emerald-300 focus:ring-emerald-500"
                          : "border-rose-300 focus:ring-rose-500 bg-rose-50/20"
                        : "border-slate-200 focus:ring-indigo-500"
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Contact Person / Authority (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Peter Osei (Headmaster)"
                  value={genContactPerson}
                  onChange={(e) => setGenContactPerson(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-xs text-slate-800 focus:outline-hidden transition"
                />
              </div>
            </div>

            {/* Real-time Email Validation Feedback */}
            {genClientEmail.trim() && genEmailValidation && (
              <div className="px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 border transition-all animate-in fade-in duration-150">
                {genEmailValidation.isValid ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200 w-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-medium">
                      Valid Email Format & Domain Exchanger <strong>({genEmailValidation.domain})</strong>
                    </span>
                    {isValidatingGenEmail && <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 ml-auto" />}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-200 w-full">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="text-[11px] font-bold">{genEmailValidation.error}</span>
                  </div>
                )}

                {genEmailValidation.suggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      if (genEmailValidation.suggestion) {
                        setGenClientEmail(genEmailValidation.suggestion);
                      }
                    }}
                    className="shrink-0 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Did you mean <u>{genEmailValidation.suggestion}</u>?
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">License Tier</label>
                <select
                  value={genTier}
                  onChange={(e) => setGenTier(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Basic">Basic ($450/yr)</option>
                  <option value="Standard">Standard ($950/yr)</option>
                  <option value="Professional">Professional ($1,850/yr)</option>
                  <option value="Developer">Developer ($3,500/yr)</option>
                  <option value="Enterprise">Enterprise ($5,000/yr)</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Duration</label>
                <select
                  value={genDuration}
                  onChange={(e) => setGenDuration(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="1">1 Month (Trial)</option>
                  <option value="3">3 Months (1 Term)</option>
                  <option value="6">6 Months (Semester)</option>
                  <option value="12">12 Months (1 Year)</option>
                  <option value="24">24 Months (2 Years)</option>
                  <option value="perpetual">Perpetual (Eternal)</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <button
                  type="submit"
                  id="btn-issue-license-email"
                  disabled={isGenerating || !genSchoolName.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition shadow-sm"
                >
                  {isGenerating ? (
                    <>
                      <Zap className="w-4 h-4 animate-spin text-emerald-300" />
                      <span>{genClientEmail.trim() && sendEmailOnGenerate ? 'Issuing & Sending...' : 'Issuing...'}</span>
                    </>
                  ) : (
                    <>
                      {genClientEmail.trim() && sendEmailOnGenerate ? (
                        <>
                          <Mail className="w-4 h-4 text-indigo-200" />
                          <span>Issue & Dispatch Email</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Issue License</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/50">
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={sendEmailOnGenerate}
                  onChange={(e) => setSendEmailOnGenerate(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                />
                <span>Automatically dispatch license key & onboarding link to verified email & store in database</span>
              </label>

              {sendEmailOnGenerate && genClientEmail.trim() && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Auto-email active for: {genClientEmail.trim()}
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
              <div>
                <h4 className="text-xs font-bold text-slate-700">Determine Modules Authorized for Purchase</h4>
                <p className="text-[10px] text-slate-500 font-medium">Select feature sets unlocked when this school activates their license key.</p>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setGenSelectedModules(availableModules.map(m => m.id))}
                  className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300 text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setGenSelectedModules([])}
                  className="text-[10px] text-slate-500 font-bold hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {availableModules.map((mod) => {
                const checked = genSelectedModules.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={cn(
                      "flex items-start gap-2 p-2.5 rounded-xl border text-left cursor-pointer transition-all select-none",
                      checked ? "bg-white border-indigo-200 ring-2 ring-indigo-50/40 shadow-xs" : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          setGenSelectedModules(genSelectedModules.filter(id => id !== mod.id));
                        } else {
                          setGenSelectedModules([...genSelectedModules, mod.id]);
                        }
                      }}
                      className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block">{mod.label}</span>
                      <span className="text-[9px] text-slate-400 font-medium leading-normal block">{mod.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </form>

        {/* Dynamic Serial Logs Index & Table */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Issued License Keys Registry</h3>
              <p className="text-[10px] text-slate-400 font-medium">All single-use authorization keys issued to client educational institutions.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search school or key..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden text-slate-700"
                />
              </div>

              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-hidden"
              >
                <option value="all">All Tiers</option>
                <option value="Basic">Basic</option>
                <option value="Standard">Standard</option>
                <option value="Professional">Professional</option>
                <option value="Developer">Developer</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Client School</th>
                  <th className="py-3 px-3">Serial Key</th>
                  <th className="py-3 px-3">Tier</th>
                  <th className="py-3 px-3">Sync Status</th>
                  <th className="py-3 px-3">Expires On</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLicenses.map((lic) => {
                  const syncState = lic.syncStatus || 'local_only';
                  const isCopied = copiedKey === lic.key;
                  return (
                    <tr key={lic.key} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm tracking-tight">{lic.schoolName}</span>
                            {lic.clientEmail && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/70">
                                <Mail className="w-3 h-3 text-indigo-500" />
                                <span>{lic.clientEmail}</span>
                              </span>
                            )}
                          </div>
                          {lic.activeModules && lic.activeModules.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {lic.activeModules.slice(0, 5).map((m: string) => {
                                const label = availableModules.find(mod => mod.id === m)?.label || m;
                                return (
                                  <span key={m} className="text-[9px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-md border border-indigo-100/60">
                                    {label.replace(' Records', '').replace(' Portal', '').replace(' Terminal', '').replace(' Registry', '').replace(' School', '')}
                                  </span>
                                );
                              })}
                              {lic.activeModules.length > 5 && (
                                <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-md">
                                  +{lic.activeModules.length - 5} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="inline-flex items-center gap-1.5 bg-indigo-50/60 px-2.5 py-1 rounded-lg border border-indigo-100/70">
                          <span className="font-mono font-bold text-indigo-700 select-all text-xs tracking-wider">
                            {lic.key}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(lic.key)}
                            title="Copy License Key"
                            className="p-1 hover:bg-indigo-100 text-indigo-500 hover:text-indigo-700 rounded transition cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg whitespace-nowrap">
                          {lic.tier || 'Standard'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {syncState === 'synced' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Synced
                          </span>
                        ) : syncState === 'sync_failed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-full whitespace-nowrap" title={lic.syncError || "Sync failed"}>
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-full whitespace-nowrap">
                            <CloudOff className="w-3 h-3 text-amber-600" /> Local
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium whitespace-nowrap text-xs">
                        {lic.expiryDate ? new Date(lic.expiryDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Perpetual'}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={cn(
                          'px-2.5 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider border whitespace-nowrap inline-block',
                          lic.status === 'active' 
                            ? (lic.used ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200') 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        )}>
                          {lic.status === 'active' ? (lic.used ? 'Used' : 'Active') : lic.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {lic.clientEmail && (
                            <a
                              href={getGmailWebComposeUrl({
                                recipientEmail: lic.clientEmail,
                                licenseKey: lic.key,
                                schoolName: lic.schoolName,
                                tier: lic.tier,
                                durationMonths: lic.durationMonths,
                                contactPerson: lic.contactPerson,
                                activeModules: lic.activeModules
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open Gmail Compose for ${lic.clientEmail}`}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200/80 transition cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <a
                            href={getWhatsAppShareUrl({
                              licenseKey: lic.key,
                              schoolName: lic.schoolName,
                              tier: lic.tier,
                              durationMonths: lic.durationMonths,
                              contactPerson: lic.contactPerson,
                              phoneNumber: lic.phone || lic.clientPhone
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Send via WhatsApp"
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl border border-emerald-200/80 transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              setEmailModalLicense(lic);
                              setCustomEmailRecipient(lic.clientEmail || '');
                              setCustomPhoneRecipient(lic.phone || lic.clientPhone || '');
                              setCustomContactPerson(lic.contactPerson || '');
                              setEmailSentSuccessMsg(null);
                            }}
                            title="Dispatch Package"
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>

                          {lic.status === 'active' && (
                            <button
                              disabled={isRevoking === lic.key}
                              onClick={() => handleRevokeKey(lic.key)}
                              title="Revoke License Key"
                              className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl border border-slate-200 hover:border-rose-200 transition disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredLicenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-sm italic">No matching keys located.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Send License Email Modal */}
        {emailModalLicense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-xl w-full space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Dispatch License to Client</h3>
                    <p className="text-[10px] text-slate-500 font-medium">1-Click Web Gmail, Gmail API, WhatsApp & Database Sync</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailModalLicense(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {emailSentSuccessMsg ? (
                <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3.5 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950">License Prepared & Dispatched</h4>
                    <p className="text-xs text-emerald-800 font-medium mt-0.5">{emailSentSuccessMsg}</p>
                  </div>
                  
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 text-left space-y-1.5 text-[11px] text-slate-800">
                    <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                      <span className="font-bold text-slate-500">Recipient:</span>
                      <span className="font-semibold text-slate-900 font-mono">{customEmailRecipient}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                      <span className="font-bold text-slate-500">Dispatch Status:</span>
                      <span className="font-mono uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {emailSentMethod === 'gmail' ? '⚡ Sent via Gmail API' : (emailSentMethod || 'Direct Delivery Ready')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-500">Database Sync:</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Logged to Supabase DB
                      </span>
                    </div>
                  </div>

                  {/* Guaranteed 1-Click Delivery Buttons */}
                  <div className="space-y-2 pt-1 text-left">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Multi-Channel 1-Click Dispatch & Share:</span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={getGmailWebComposeUrl({
                          recipientEmail: customEmailRecipient,
                          licenseKey: emailModalLicense.key,
                          schoolName: emailModalLicense.schoolName,
                          tier: emailModalLicense.tier,
                          durationMonths: emailModalLicense.durationMonths,
                          contactPerson: customContactPerson,
                          customMessage: customMessage,
                          activeModules: emailModalLicense.activeModules
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer text-center"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Send via Web Gmail</span>
                      </a>

                      <a
                        href={getWhatsAppShareUrl({
                          licenseKey: emailModalLicense.key,
                          schoolName: emailModalLicense.schoolName,
                          tier: emailModalLicense.tier,
                          durationMonths: emailModalLicense.durationMonths,
                          contactPerson: customContactPerson,
                          phoneNumber: customPhoneRecipient
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition border border-emerald-600 cursor-pointer text-center"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send via WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const body = buildLicensePlainText({
                            recipientEmail: customEmailRecipient,
                            licenseKey: emailModalLicense.key,
                            schoolName: emailModalLicense.schoolName,
                            tier: emailModalLicense.tier,
                            durationMonths: emailModalLicense.durationMonths,
                            contactPerson: customContactPerson,
                            customMessage: customMessage,
                            activeModules: emailModalLicense.activeModules
                          });
                          navigator.clipboard.writeText(body);
                          setCopiedEmailBody(true);
                          setTimeout(() => setCopiedEmailBody(false), 2500);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition border border-slate-200 cursor-pointer"
                      >
                        {copiedEmailBody ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Email Text Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>Copy Formatted Email</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyKey(emailModalLicense.key)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition border border-slate-200 cursor-pointer"
                      >
                        {copiedKey === emailModalLicense.key ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Key Copied!</span>
                          </>
                        ) : (
                          <>
                            <Key className="w-3.5 h-3.5 text-slate-600" />
                            <span>Copy Serial Key</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSentSuccessMsg(null);
                        setDispatchedEmailPackage(null);
                      }}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Back to Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailModalLicense(null);
                        setEmailSentSuccessMsg(null);
                        setDispatchedEmailPackage(null);
                      }}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Target School:</span>
                      <span className="text-slate-800 font-extrabold">{emailModalLicense.schoolName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>License Serial Key:</span>
                      <span className="font-mono text-indigo-600 font-black">{emailModalLicense.key}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Tier / Duration:</span>
                      <span className="text-slate-700 font-bold">{emailModalLicense.tier || 'Standard'} • {emailModalLicense.durationMonths ? `${emailModalLicense.durationMonths} Mos` : 'Perpetual'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                        Client Email Address <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="email"
                          required
                          placeholder="recipient@school.edu.gh"
                          value={customEmailRecipient}
                          onChange={(e) => setCustomEmailRecipient(e.target.value)}
                          className={cn(
                            "w-full pl-9 pr-3.5 py-2 bg-white border rounded-xl focus:ring-2 font-bold text-xs text-slate-800 focus:outline-hidden transition",
                            modalEmailValidation
                              ? modalEmailValidation.isValid
                                ? "border-emerald-300 focus:ring-emerald-500"
                                : "border-rose-300 focus:ring-rose-500 bg-rose-50/20"
                              : "border-slate-200 focus:ring-indigo-500"
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block flex items-center justify-between">
                        <span>WhatsApp / Phone Number</span>
                        <span className="text-[9px] text-emerald-600 font-semibold lowercase">for direct chat</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="tel"
                          placeholder="+233 24 555 1212"
                          value={customPhoneRecipient}
                          onChange={(e) => setCustomPhoneRecipient(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold text-xs text-slate-800 focus:outline-hidden transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Modal Real-time Email Validation Notice */}
                  {customEmailRecipient.trim() && modalEmailValidation && (
                    <div className="text-[11px] space-y-1">
                      {modalEmailValidation.isValid ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Verified recipient domain ({modalEmailValidation.domain})</span>
                          {isValidatingModalEmail && <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 ml-auto" />}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span className="font-bold">{modalEmailValidation.error}</span>
                        </div>
                      )}

                      {modalEmailValidation.suggestion && (
                        <button
                          type="button"
                          onClick={() => {
                            if (modalEmailValidation.suggestion) {
                              setCustomEmailRecipient(modalEmailValidation.suggestion);
                            }
                          }}
                          className="w-full text-left bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Did you mean <u>{modalEmailValidation.suggestion}</u>? Click to apply.</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                        Contact Person / Authority (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Headmaster John Arthur"
                        value={customContactPerson}
                        onChange={(e) => setCustomContactPerson(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-xs text-slate-800 focus:outline-hidden transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                        Custom Note / Greeting (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. For the 2025/2026 academic calendar"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-xs text-slate-800 focus:outline-hidden transition"
                      />
                    </div>
                  </div>

                  {/* Primary Dispatch Action Buttons */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block">
                      Select Dispatch Method:
                    </span>

                    {/* Option 1: Direct Web Gmail 1-Click */}
                    <div className="p-3 bg-red-50/70 border border-red-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-red-600" />
                          <span className="text-xs font-bold text-red-950">Option 1: 1-Click Web Gmail (Instant & Guaranteed)</span>
                        </div>
                        <p className="text-[10px] text-red-800 font-medium mt-0.5">
                          Opens Gmail composer with recipient, official activation template & key ready to send.
                        </p>
                      </div>

                      <a
                        href={getGmailWebComposeUrl({
                          recipientEmail: customEmailRecipient || 'client@school.edu.gh',
                          licenseKey: emailModalLicense.key,
                          schoolName: emailModalLicense.schoolName,
                          tier: emailModalLicense.tier,
                          durationMonths: emailModalLicense.durationMonths,
                          contactPerson: customContactPerson,
                          customMessage: customMessage,
                          activeModules: emailModalLicense.activeModules
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0 text-center"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Launch Web Gmail</span>
                      </a>
                    </div>

                    {/* Option 2: Connected Google Account / Gmail API */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-blue-950">Option 2: Direct Gmail API Send</span>
                        </div>
                        <p className="text-[10px] text-blue-800 font-medium mt-0.5">
                          {googleUser ? `Send seamlessly from ${googleUser.email}` : 'Sign in with your Google account to dispatch in the background.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSendViaGmailDirect}
                        disabled={isSendingCustomEmail || !customEmailRecipient.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        {isSendingCustomEmail ? (
                          <>
                            <Zap className="w-3.5 h-3.5 animate-spin text-blue-200" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{googleUser ? 'Send via Gmail API' : 'Connect & Send via Gmail'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Option 3: WhatsApp & Copy */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={getWhatsAppShareUrl({
                          licenseKey: emailModalLicense.key,
                          schoolName: emailModalLicense.schoolName,
                          tier: emailModalLicense.tier,
                          durationMonths: emailModalLicense.durationMonths,
                          contactPerson: customContactPerson,
                          phoneNumber: customPhoneRecipient
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 text-center"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Send via WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const body = buildLicensePlainText({
                            recipientEmail: customEmailRecipient,
                            licenseKey: emailModalLicense.key,
                            schoolName: emailModalLicense.schoolName,
                            tier: emailModalLicense.tier,
                            durationMonths: emailModalLicense.durationMonths,
                            contactPerson: customContactPerson,
                            customMessage: customMessage,
                            activeModules: emailModalLicense.activeModules
                          });
                          navigator.clipboard.writeText(body);
                          setCopiedEmailBody(true);
                          setTimeout(() => setCopiedEmailBody(false), 2500);
                        }}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {copiedEmailBody ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                        <span>{copiedEmailBody ? 'Email Copied!' : 'Copy Formatted Email'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEmailModalLicense(null)}
                      className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerSendEmailModal}
                      disabled={isSendingCustomEmail || !customEmailRecipient.trim()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Dispatch via Cloud Server</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
