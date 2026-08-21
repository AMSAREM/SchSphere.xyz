import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, CloudOff, Database } from 'lucide-react';
import {
  getStoredLicenses,
  getPendingSyncCount,
  syncPendingLicenses,
  LicenseRecord,
} from '../lib/licenseSync';

interface LicenseSyncBannerProps {
  onSynced?: (updatedLicenses: LicenseRecord[]) => void;
  className?: string;
}

export const LicenseSyncBanner: React.FC<LicenseSyncBannerProps> = ({
  onSynced,
  className = '',
}) => {
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    message: string;
    type: 'success' | 'error' | null;
  }>({ message: '', type: null });

  const refreshLicenses = () => {
    const list = getStoredLicenses();
    setLicenses(list);
  };

  useEffect(() => {
    refreshLicenses();

    // Auto sync on load if pending items exist
    const pendingCount = getPendingSyncCount();
    if (pendingCount > 0) {
      handleSync();
    }

    const handleUpdate = () => refreshLicenses();
    window.addEventListener('esepa_licenses_updated', handleUpdate);
    window.addEventListener('online', handleSync);

    return () => {
      window.removeEventListener('esepa_licenses_updated', handleUpdate);
      window.removeEventListener('online', handleSync);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setLastSyncResult({ message: '', type: null });
    try {
      const res = await syncPendingLicenses();
      refreshLicenses();
      if (res.syncedCount > 0) {
        setLastSyncResult({
          message: `Successfully synced ${res.syncedCount} license(s) to Supabase server!`,
          type: 'success',
        });
      } else if (res.failedCount > 0) {
        setLastSyncResult({
          message: `Failed to sync ${res.failedCount} license(s). Checked database connection.`,
          type: 'error',
        });
      }
      if (onSynced && res.licenses) {
        onSynced(res.licenses);
      }
    } catch (err) {
      console.error('Error in LicenseSyncBanner sync:', err);
      setLastSyncResult({
        message: 'Sync process encountered a network error.',
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingList = licenses.filter((l) => l.syncStatus !== 'synced');
  const failedList = licenses.filter((l) => l.syncStatus === 'sync_failed');

  if (pendingList.length === 0 && !lastSyncResult.message) {
    return null;
  }

  return (
    <div className={`mb-6 rounded-xl border p-4 transition-all shadow-sm ${className} ${
      failedList.length > 0 
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' 
        : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            {failedList.length > 0 ? (
              <AlertTriangle className="w-5 h-5 animate-pulse text-amber-500" />
            ) : (
              <CloudOff className="w-5 h-5 text-indigo-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">
                {pendingList.length === 1
                  ? '1 License Saved Locally (Not Synced to Supabase Server)'
                  : `${pendingList.length} Licenses Saved Locally (Not Synced to Supabase Server)`}
              </h4>
              <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                Action Required
              </span>
            </div>
            <p className="text-xs opacity-85 mt-1">
              These license records exist only on this browser/device. Click <b>Sync Now</b> to reconcile and push them to the persistent Supabase database server.
            </p>
            {pendingList.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingList.map((lic) => (
                  <span
                    key={lic.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
                  >
                    <Database className="w-3 h-3 text-amber-500" />
                    <span className="font-semibold">{lic.schoolName}</span> ({lic.key})
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      {lic.syncStatus === 'sync_failed' ? 'Sync Failed' : 'Local Only'}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {lastSyncResult.message && (
              <p className={`text-xs mt-2 font-medium flex items-center gap-1.5 ${
                lastSyncResult.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {lastSyncResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                {lastSyncResult.message}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="self-start sm:self-center shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing to Supabase...' : 'Sync Now'}
        </button>
      </div>
    </div>
  );
};
