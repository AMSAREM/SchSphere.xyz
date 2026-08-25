export interface LicenseRecord {
  key: string;
  schoolName: string;
  tier: string;
  durationMonths: string;
  expiryDate: number | null;
  createdAt: number;
  status: 'active' | 'suspended' | 'expired';
  syncStatus: 'synced' | 'local_only' | 'sync_failed';
  syncError?: string | null;
  activeModules?: string[];
  [key: string]: any;
}

const STORAGE_KEY = 'esepa_generated_licenses';

export function getStoredLicenses(): LicenseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          ...item,
          syncStatus: item.syncStatus || 'local_only',
        }));
      }
    }
  } catch (e) {
    console.error('Error reading stored licenses:', e);
  }
  return [];
}

export function saveStoredLicenses(licenses: LicenseRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(licenses));
    window.dispatchEvent(new Event('esepa_licenses_updated'));
  } catch (e) {
    console.error('Error saving stored licenses:', e);
  }
}

export function getPendingSyncCount(): number {
  const licenses = getStoredLicenses();
  return licenses.filter(
    (l) => l.syncStatus === 'local_only' || l.syncStatus === 'sync_failed'
  ).length;
}

export async function syncPendingLicenses(): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
  licenses?: LicenseRecord[];
}> {
  const licenses = getStoredLicenses();
  const pending = licenses.filter(
    (l) => l.syncStatus !== 'synced'
  );

  if (pending.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0, licenses };
  }

  try {
    const res = await fetch('/api/license/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenses: pending }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        const resultMap = new Map<string, LicenseRecord>();
        data.results.forEach((r: LicenseRecord) => resultMap.set(r.key, r));

        const updated = licenses.map((lic) => {
          if (resultMap.has(lic.key)) {
            return resultMap.get(lic.key)!;
          }
          return lic;
        });

        saveStoredLicenses(updated);
        return {
          success: true,
          syncedCount: data.syncedCount || 0,
          failedCount: data.failedCount || 0,
          licenses: updated,
        };
      }
    }
  } catch (err) {
    console.warn('Notice syncing pending licenses (will retry when online):', err);
  }

  return { success: false, syncedCount: 0, failedCount: pending.length, licenses };
}

// Auto-run sync on online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingLicenses();
  });
}
