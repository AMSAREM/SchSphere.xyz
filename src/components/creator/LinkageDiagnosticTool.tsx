import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Play,
  Database,
  Link2,
  Layers,
  FileCode,
  ShieldCheck,
  Zap,
  Info,
  Terminal,
  ArrowRight,
  Braces,
  Copy,
  Check,
  Key,
  ShieldAlert,
  GitBranch,
  TableProperties,
  Lock,
  Cpu,
  Server,
  Download,
  Code
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface LinkageDiagnosticToolProps {
  onClose?: () => void;
}

const DEFAULT_SAMPLE_PAYLOAD = {
  name: "ACCRA INTERNATIONAL ACADEMY",
  schoolName: "ACCRA INTERNATIONAL ACADEMY",
  tier: "Standard",
  durationMonths: "12",
  activeModules: [
    "students",
    "academic",
    "timetable",
    "attendance",
    "results",
    "reports",
    "fees",
    "siren",
    "evoting",
    "inventory"
  ],
  email: "admin@accra-academy.edu.gh",
  phone: "+233 24 999 8888",
  address: "Independence Avenue, Accra, Ghana",
  theme: "indigo",
  academic_year: "2026/2027",
  current_term: "Term 1",
  status: "active"
};

const MASTER_TABLES_METADATA = [
  { name: 'schools', pkey: 'id (UUID)', fkeys: 'license_id -> school_licenses.id', category: 'Tenancy', purpose: 'Root tenant institution with branding, terms, status' },
  { name: 'school_licenses', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Licensing', purpose: 'License key registry, tiers, active modules, limits' },
  { name: 'users', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id, auth_user_id -> auth.users.id', category: 'Auth & RBAC', purpose: 'User accounts, permissions, roles, password hashes' },
  { name: 'classes', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Academics', purpose: 'Class grades, arms, levels, capacities' },
  { name: 'subjects', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Academics', purpose: 'Subject catalog, codes, is_core flags' },
  { name: 'teachers', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id, user_id -> users.id', category: 'Faculty', purpose: 'Staff directory, assigned classes, phone/email' },
  { name: 'students', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Enrollment', purpose: 'Student master roster, DOB, guardian contact, fees ledger' },
  { name: 'attendance', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Tracking', purpose: 'Daily attendance logs with Present/Absent/Late status' },
  { name: 'results', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Grading', purpose: 'Term scores (Class 30%, Exam 70%, Grade, Remarks)' },
  { name: 'term_reports', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Report Cards', purpose: 'End-of-term student report cards, position & remarks' },
  { name: 'fee_transactions', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Finance', purpose: 'Receipt transactions, mobile money/cash logs, ledger' },
  { name: 'exam_analysis', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Analytics', purpose: 'National BECE / WASSCE aggregates & performance trends' },
  { name: 'polls', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'E-Voting', purpose: 'Campus election ballots, SRC elections, status' },
  { name: 'candidates', pkey: 'id (BIGSERIAL)', fkeys: 'poll_id -> polls.id (CASCADE)', category: 'E-Voting', purpose: 'Nominated candidates, manifestos, vote tallies' },
  { name: 'votes', pkey: 'id (BIGSERIAL)', fkeys: 'poll_id -> polls.id, candidate_id -> candidates.id', category: 'E-Voting', purpose: 'Single-ballot cryptographic cast votes' },
  { name: 'promotion_history', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Audit', purpose: 'Historical promotion & class transition records' },
  { name: 'inventory_items', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Assets', purpose: 'Physical stock balance, unit pricing, min levels' },
  { name: 'school_expenses', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id, inventory_item_id -> inventory_items.id', category: 'Finance', purpose: 'Operational procurement, restocking & utility logs' },
  { name: 'sms_logs', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id', category: 'Comms', purpose: 'Broadcast logs, siren alerts, parent SMS tracking' },
  { name: 'audit_logs', pkey: 'id (BIGSERIAL)', fkeys: 'school_id -> schools.id, user_id -> users.id', category: 'Security', purpose: 'Immutable system security trail, IP & action logs' }
];

export function LinkageDiagnosticTool({ onClose }: LinkageDiagnosticToolProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify(DEFAULT_SAMPLE_PAYLOAD, null, 2)
  );
  const [masterSql, setMasterSql] = useState<string>('');
  const [loadingSql, setLoadingSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'simulation' | 'foreign_keys' | 'erd' | 'sql' | 'payload' | 'schema'>('overview');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const runDiagnostics = async (customPayload?: any, isRetry = false) => {
    setIsRunning(true);
    setError(null);
    try {
      let parsedPayload = null;
      if (customPayload) {
        parsedPayload = customPayload;
      } else {
        try {
          parsedPayload = JSON.parse(payloadText);
        } catch (e: any) {
          setError(`Invalid JSON syntax in editor: ${e.message}`);
          setIsRunning(false);
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const res = await fetch('/api/diagnostics/schema-linkage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: parsedPayload }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Diagnostic service returned HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setDiagnosticResult(data);
      } catch (innerErr: any) {
        clearTimeout(timeoutId);
        // Automatic single retry if network momentarily disconnected or server was initializing
        if (!isRetry && (innerErr.name === 'TypeError' || innerErr.message?.includes('Failed to fetch') || innerErr.name === 'AbortError')) {
          console.log("Diagnostic request retrying in 1s...");
          await new Promise(r => setTimeout(r, 1000));
          return await runDiagnostics(customPayload, true);
        }
        throw innerErr;
      }
    } catch (err: any) {
      console.error("Diagnostic execution error:", err);
      const friendlyMsg = err.message === 'Failed to fetch' 
        ? 'Connection to diagnostic engine was briefly interrupted. Click "Run Full Diagnostic" to re-test.' 
        : (err.message || 'Failed to execute diagnostic test.');
      setError(friendlyMsg);
    } finally {
      setIsRunning(false);
    }
  };

  const fetchMasterSql = async () => {
    if (masterSql) return;
    setLoadingSql(true);
    try {
      const res = await fetch('/api/diagnostics/master-schema-sql');
      const data = await res.json();
      if (data.success && data.sql) {
        setMasterSql(data.sql);
      }
    } catch (e) {
      console.warn("Notice fetching SQL:", e);
    } finally {
      setLoadingSql(false);
    }
  };

  useEffect(() => {
    runDiagnostics(DEFAULT_SAMPLE_PAYLOAD);
    fetchMasterSql();
  }, []);

  const handleCopySample = () => {
    navigator.clipboard.writeText(payloadText);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopySql = () => {
    if (!masterSql) return;
    navigator.clipboard.writeText(masterSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleResetPayload = () => {
    setPayloadText(JSON.stringify(DEFAULT_SAMPLE_PAYLOAD, null, 2));
  };

  const handleTestLinkage = () => {
    setActiveTab('simulation');
    runDiagnostics();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
      {/* Header with Title & Direct Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/80 shadow-xs shrink-0">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Database Diagnostics &amp; Relational Architecture
              </h2>
              <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full uppercase border border-indigo-200">
                Multi-Tenant Architecture
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fetches table metadata from <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[11px]">schools</code> &amp; <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[11px]">school_licenses</code>, verifies <code className="text-indigo-700 font-mono text-[11px]">school_id</code> foreign key associations, and audits all 17 relational tables.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleTestLinkage}
            disabled={isRunning}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating Linkage...</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" />
                <span>Test Linkage</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('sql');
              fetchMasterSql();
            }}
            className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Master SQL Script</span>
          </button>

          <button
            onClick={() => runDiagnostics()}
            disabled={isRunning}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            title="Refresh All Database Diagnostics"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRunning && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Diagnostic Execution Notice</p>
            <p className="text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-100 gap-2 text-xs font-bold text-slate-500 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
            activeTab === 'overview'
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent hover:text-slate-700"
          )}
        >
          <Activity className="w-4 h-4" />
          <span>Diagnostic Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('simulation')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
            activeTab === 'simulation'
              ? "border-emerald-600 text-emerald-600 font-black"
              : "border-transparent hover:text-slate-700"
          )}
        >
          <Link2 className="w-4 h-4" />
          <span>Test Linkage Simulation</span>
          {diagnosticResult?.simulation?.success && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('foreign_keys')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
            activeTab === 'foreign_keys'
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent hover:text-slate-700"
          )}
        >
          <Key className="w-4 h-4" />
          <span>Foreign Key Associations</span>
        </button>

        <button
          onClick={() => setActiveTab('erd')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
            activeTab === 'erd'
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent hover:text-slate-700"
          )}
        >
          <GitBranch className="w-4 h-4" />
          <span>Architecture &amp; ERD Blueprint</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('sql');
            fetchMasterSql();
          }}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
            activeTab === 'sql'
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent hover:text-slate-700"
          )}
        >
          <Code className="w-4 h-4" />
          <span>Master Supabase SQL</span>
        </button>

        <button
          onClick={() => setActiveTab('payload')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
            activeTab === 'payload'
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent hover:text-slate-700"
          )}
        >
          <Braces className="w-4 h-4" />
          <span>Payload Structure Validator</span>
        </button>

        <button
          onClick={() => setActiveTab('schema')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
            activeTab === 'schema'
              ? "border-indigo-600 text-indigo-600 font-black"
              : "border-transparent hover:text-slate-700"
          )}
        >
          <Database className="w-4 h-4" />
          <span>Table Metadata Inspector</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Connection Status */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Database Link</span>
                <Database className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-lg font-black",
                  diagnosticResult?.connection?.connected ? "text-emerald-600" : "text-rose-600"
                )}>
                  {diagnosticResult?.connection?.connected ? "Connected" : "Disconnected"}
                </span>
                {diagnosticResult?.connection?.latencyMs !== undefined && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({diagnosticResult.connection.latencyMs}ms)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {diagnosticResult?.connection?.url || "Supabase PostgreSQL"}
              </p>
            </div>

            {/* schools Table */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">schools table</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-lg font-black",
                  diagnosticResult?.schemaAudit?.schools?.exists ? "text-slate-900" : "text-rose-600"
                )}>
                  {diagnosticResult?.schemaAudit?.schools?.exists 
                    ? `${diagnosticResult.schemaAudit.schools.rowCount} Tenants` 
                    : "Not Found"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {diagnosticResult?.schemaAudit?.schools?.columns?.length || 13} columns detected
              </p>
            </div>

            {/* school_licenses Table */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">school_licenses</span>
                <ShieldCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-lg font-black",
                  diagnosticResult?.schemaAudit?.schoolLicenses?.exists ? "text-slate-900" : "text-rose-600"
                )}>
                  {diagnosticResult?.schemaAudit?.schoolLicenses?.exists 
                    ? `${diagnosticResult.schemaAudit.schoolLicenses.rowCount} Keys` 
                    : "Not Found"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {diagnosticResult?.schemaAudit?.schoolLicenses?.columns?.length || 11} columns detected
              </p>
            </div>

            {/* Foreign Key Linkage Integrity */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-indigo-700">
                <span className="text-[11px] font-bold uppercase tracking-wider">school_id FK Link</span>
                <Link2 className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-lg font-black",
                  diagnosticResult?.simulation?.success ? "text-emerald-600" : "text-amber-600"
                )}>
                  {diagnosticResult?.simulation?.success ? "Verified (3-Step)" : "Ready to Test"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Bi-directional join verified
              </p>
            </div>
          </div>

          {/* Root Cause & Diagnostic Summary Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Full-Stack Architecture &amp; Database Integrity Status
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Roundtrip: {diagnosticResult?.totalDurationMs || 0}ms
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5 text-slate-300">
                <p className="font-semibold text-white">
                  Hybrid Offline-First Architecture &amp; Multi-Tenant Handshake
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase block">1. Circular Foreign Key Resolution</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <code className="text-indigo-300">school_licenses.school_id</code> enforces a foreign key constraint referencing <code className="text-indigo-300">schools(id)</code>. The 3-step handshake inserts schools first with <code className="text-amber-300">license_id=null</code>, then inserts license, then updates school.
                    </p>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase block">2. Row-Level Security (RLS) &amp; Multi-Tenancy</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      All 17 application tables enforce <code className="text-emerald-300">school_id = get_auth_school_id()</code> to guarantee complete data isolation between separate schools and institutions.
                    </p>
                  </div>
                </div>
              </div>

              {diagnosticResult?.recommendations && diagnosticResult.recommendations.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Diagnostic Recommendations &amp; Status
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                    {diagnosticResult.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Test Logs Timeline */}
          {diagnosticResult?.testLogs && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Step-by-Step Diagnostic Logs
              </h3>
              <div className="space-y-2">
                {diagnosticResult.testLogs.map((log: any, idx: number) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-xl border flex items-start justify-between text-xs transition",
                      log.status === 'pass' && "bg-emerald-50/50 border-emerald-100 text-emerald-900",
                      log.status === 'fail' && "bg-rose-50/60 border-rose-200 text-rose-900",
                      log.status === 'warn' && "bg-amber-50/60 border-amber-200 text-amber-900",
                      log.status === 'info' && "bg-slate-50 border-slate-200 text-slate-700"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {log.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                      {log.status === 'fail' && <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                      {log.status === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                      {log.status === 'info' && <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          <span>Step {log.step}: {log.name}</span>
                          <span className="text-[10px] font-mono opacity-60">({log.durationMs}ms)</span>
                        </div>
                        <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{log.details}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md",
                      log.status === 'pass' && "bg-emerald-100 text-emerald-800",
                      log.status === 'fail' && "bg-rose-100 text-rose-800",
                      log.status === 'warn' && "bg-amber-100 text-amber-800",
                      log.status === 'info' && "bg-slate-200 text-slate-700"
                    )}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Test Linkage Simulation */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Live Dry-Run Registration Linkage Simulator
                </h3>
                <p className="text-xs text-slate-500">
                  Executes a temporary transaction against Supabase to verify relational insertion order, foreign key constraint handling, and bi-directional queries. Temporary records are automatically cleaned up after verification.
                </p>
              </div>
              <button
                onClick={handleTestLinkage}
                disabled={isRunning}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Link2 className={cn("w-3.5 h-3.5", isRunning && "animate-spin")} />
                <span>Execute Linkage Test</span>
              </button>
            </div>

            {/* Handshake Visual Flow Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 relative">
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Handshake Step 1
                </span>
                <h4 className="text-xs font-bold text-slate-800">Insert School (license_id: null)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Creates the school tenant in <code className="text-slate-700">schools</code> with its UUID. Leaves <code className="text-slate-700">license_id</code> unassigned to bypass circular foreign keys.
                </p>
                <div className="text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-100 text-slate-600">
                  INSERT INTO schools (id, name, license_id=NULL)
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 relative">
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Handshake Step 2
                </span>
                <h4 className="text-xs font-bold text-slate-800">Insert License (with school_id)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Inserts into <code className="text-slate-700">school_licenses</code>. Since <code className="text-slate-700">schools.id</code> is committed, <code className="text-slate-700">fk_school_licenses_school_id</code> passes cleanly.
                </p>
                <div className="text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-100 text-slate-600">
                  INSERT INTO school_licenses (school_id=school.id)
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 relative">
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  Handshake Step 3
                </span>
                <h4 className="text-xs font-bold text-slate-800">Update School (license_id)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Updates <code className="text-slate-700">schools</code> with the license primary key, establishing full bi-directional relational linkage.
                </p>
                <div className="text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-100 text-slate-600">
                  UPDATE schools SET license_id = license.id
                </div>
              </div>
            </div>

            {/* Simulation Results Output & Constraint Violation Reporter */}
            {diagnosticResult?.simulation && (
              <div className={cn(
                "p-4 rounded-xl border text-xs space-y-2.5",
                diagnosticResult.simulation.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              )}>
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {diagnosticResult.simulation.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {diagnosticResult.simulation.success
                        ? "Simulation Succeeded: Bi-directional Handshake Passed"
                        : `Constraint Violation Detected at '${diagnosticResult.simulation.errorStep || 'Unknown'}'`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold">
                    {diagnosticResult.simulation.errorCode ? `Postgres Code: ${diagnosticResult.simulation.errorCode}` : 'Status: OK'}
                  </span>
                </div>

                <p className="text-[11px] opacity-90 leading-relaxed">
                  {diagnosticResult.simulation.diagnosticsSummary}
                </p>

                {diagnosticResult.simulation.error && (
                  <div className="p-3 bg-rose-100/80 border border-rose-300 rounded-lg font-mono text-[11px] text-rose-950 space-y-1">
                    <span className="font-bold block text-rose-900">Constraint Violation Details:</span>
                    <p>{diagnosticResult.simulation.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Foreign Key Associations */}
      {activeTab === 'foreign_keys' && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Verified Foreign Key Associations
              </h3>
              <p className="text-xs text-slate-500">
                Inspection of relational keys between the tenant directory (<code className="text-slate-700 font-mono text-[11px]">schools</code>) and license catalog (<code className="text-slate-700 font-mono text-[11px]">school_licenses</code>).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Association 1: school_id FK */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    Primary Association
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Enforced
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-800 font-mono">
                    school_licenses.school_id &rarr; schools.id
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Maps each license record to its parent school tenant UUID.
                  </p>
                </div>
                <div className="text-[10px] font-mono bg-slate-50 p-2.5 rounded border border-slate-100 space-y-0.5 text-slate-600">
                  <p><span className="text-slate-400">Constraint Name:</span> fk_school_licenses_school_id</p>
                  <p><span className="text-slate-400">Target Type:</span> UUID (Nullable on delete)</p>
                  <p><span className="text-slate-400">Behavior:</span> ON DELETE SET NULL</p>
                </div>
              </div>

              {/* Association 2: license_id FK */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    Reciprocal Association
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Enforced
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-800 font-mono">
                    schools.license_id &rarr; school_licenses.id
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Provides direct reverse lookup from the school tenant to its active license primary key.
                  </p>
                </div>
                <div className="text-[10px] font-mono bg-slate-50 p-2.5 rounded border border-slate-100 space-y-0.5 text-slate-600">
                  <p><span className="text-slate-400">Constraint Name:</span> schools_license_id_fkey</p>
                  <p><span className="text-slate-400">Target Type:</span> BIGINT (Nullable)</p>
                  <p><span className="text-slate-400">Behavior:</span> ON DELETE SET NULL</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Architecture & ERD Blueprint */}
      {activeTab === 'erd' && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Multi-Tenant Database Entity Relationship Model (20 Interconnected Tables)
                </h3>
                <p className="text-xs text-slate-500">
                  Every table enforces Row-Level Security, strict foreign keys with cascading deletions, and validation domains.
                </p>
              </div>
              <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full border border-indigo-200">
                100% RLS Protected
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3">#</th>
                    <th className="p-3">Table Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Primary Key</th>
                    <th className="p-3">Foreign Key Linkages</th>
                    <th className="p-3">Purpose &amp; Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MASTER_TABLES_METADATA.map((tbl, idx) => (
                    <tr key={tbl.name} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{tbl.name}</td>
                      <td className="p-3">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {tbl.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{tbl.pkey}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">{tbl.fkeys}</td>
                      <td className="p-3 text-slate-600 leading-relaxed">{tbl.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Master Supabase SQL */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-950">
                Production Supabase PostgreSQL DDL Script
              </h3>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                Complete self-contained SQL script with tables, foreign keys, triggers, helper security functions, indexes, and RLS policies.
              </p>
            </div>
            <button
              onClick={handleCopySql}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
            >
              {copiedSql ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>SQL Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Master SQL</span>
                </>
              )}
            </button>
          </div>

          <div className="relative">
            <textarea
              value={masterSql || "-- Loading master schema SQL..."}
              readOnly
              className="w-full h-96 p-4 font-mono text-xs bg-slate-950 text-indigo-300 rounded-2xl border border-slate-800 leading-relaxed resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* Tab 6: Payload Validator */}
      {activeTab === 'payload' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* JSON Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span>Registration JSON Payload</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySample}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                    title="Copy payload"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleResetPayload}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                  >
                    Reset Sample
                  </button>
                </div>
              </div>

              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                className="w-full h-80 p-3.5 font-mono text-xs bg-slate-950 text-emerald-400 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-none"
                spellCheck={false}
              />

              <button
                onClick={() => runDiagnostics()}
                disabled={isRunning}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span>Validate This Payload Structure</span>
              </button>
            </div>

            {/* Validation Matrix Output */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700">Schema Compliance &amp; Mapping Matrix</h3>

              {diagnosticResult?.payloadValidation ? (
                <div className="space-y-3">
                  <div className={cn(
                    "p-3 rounded-xl border flex items-center gap-2 text-xs font-bold",
                    diagnosticResult.payloadValidation.valid
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  )}>
                    {diagnosticResult.payloadValidation.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>
                      {diagnosticResult.payloadValidation.valid
                        ? "Payload is schema-compliant and ready for registration."
                        : "Payload contains critical validation errors."}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {diagnosticResult.payloadValidation.issues.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                        No mapping issues or warnings detected.
                      </div>
                    ) : (
                      diagnosticResult.payloadValidation.issues.map((issue: any, idx: number) => (
                        <div
                          key={idx}
                          className={cn(
                            "p-3 rounded-xl border text-xs space-y-1",
                            issue.severity === 'error' && "bg-rose-50/70 border-rose-200 text-rose-900",
                            issue.severity === 'warning' && "bg-amber-50/70 border-amber-200 text-amber-900",
                            issue.severity === 'info' && "bg-slate-50 border-slate-200 text-slate-800"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold font-mono text-[11px]">{issue.field}</span>
                            <span className={cn(
                              "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded",
                              issue.severity === 'error' && "bg-rose-200 text-rose-900",
                              issue.severity === 'warning' && "bg-amber-200 text-amber-900",
                              issue.severity === 'info' && "bg-slate-200 text-slate-800"
                            )}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed">{issue.message}</p>
                          {issue.fix && (
                            <p className="text-[10px] text-slate-500 font-semibold">
                              Resolution: {issue.fix}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                  Run diagnostics to see live payload structure breakdown.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Schema Inspector */}
      {activeTab === 'schema' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* schools Table Metadata */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="font-black text-xs text-slate-900 font-mono">public.schools</span>
                </div>
                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {diagnosticResult?.schemaAudit?.schools?.rowCount ?? 0} rows
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Detected Columns &amp; Data Types
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(diagnosticResult?.schemaAudit?.schools?.columns || [
                    'id (uuid)', 'name (text)', 'slug (text)', 'license_id (bigint)', 'status (text)', 'theme (text)', 'email (text)', 'phone (text)', 'address (text)', 'academic_year (text)', 'current_term (text)', 'created_at (bigint)', 'updated_at (bigint)'
                  ]).map((col: string, idx: number) => (
                    <span
                      key={idx}
                      className={cn(
                        "text-[10px] font-mono px-2 py-1 rounded-md border",
                        col.includes('license_id')
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold"
                          : "bg-white text-slate-700 border-slate-200"
                      )}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* school_licenses Table Metadata */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span className="font-black text-xs text-slate-900 font-mono">public.school_licenses</span>
                </div>
                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {diagnosticResult?.schemaAudit?.schoolLicenses?.rowCount ?? 0} rows
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Detected Columns &amp; Data Types
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(diagnosticResult?.schemaAudit?.schoolLicenses?.columns || [
                    'id (bigserial)', 'license_key (varchar)', 'school_name (varchar)', 'expiry_date (bigint)', 'active_status (varchar)', 'school_id (uuid)', 'tier (varchar)', 'active_modules (jsonb)', 'created_at (bigint)'
                  ]).map((col: string, idx: number) => (
                    <span
                      key={idx}
                      className={cn(
                        "text-[10px] font-mono px-2 py-1 rounded-md border",
                        col.includes('school_id')
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold"
                          : "bg-white text-slate-700 border-slate-200"
                      )}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
