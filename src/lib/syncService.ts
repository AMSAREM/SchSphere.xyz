import { db, normalizeStudentRecord } from '../db/schema';
import { supabase, getCurrentSchoolId } from './supabase';

/**
 * Reconcile classes in Dexie IndexedDB in-place without creating duplicate rows
 */
export async function reconcileClassesInDexie(remoteClasses: any[]) {
  if (!Array.isArray(remoteClasses)) return;
  const localClasses = await db.classes.toArray();
  const nameMap = new Map<string, any>();
  const idMap = new Map<string | number, any>();

  for (const local of localClasses) {
    if (local.id) idMap.set(local.id, local);
    const key = (local.name || '').trim().toLowerCase();
    if (key && !nameMap.has(key)) {
      nameMap.set(key, local);
    } else if (key && nameMap.has(key)) {
      // Remove duplicate local class
      if (local.id) await db.classes.delete(local.id);
    }
  }

  for (const remote of remoteClasses) {
    if (!remote || !remote.name) continue;
    const key = String(remote.name).trim().toLowerCase();
    let existing = nameMap.get(key);
    if (!existing && remote.id && idMap.has(remote.id)) {
      existing = idMap.get(remote.id);
    }

    if (existing) {
      await db.classes.update(existing.id, {
        ...remote,
        id: existing.id
      });
    } else {
      const { id, ...rest } = remote;
      const newId = await db.classes.add(rest);
      nameMap.set(key, { ...remote, id: newId });
    }
  }
}

/**
 * Reconcile teachers in Dexie IndexedDB in-place without creating duplicate rows
 */
export async function reconcileTeachersInDexie(remoteTeachers: any[]) {
  if (!Array.isArray(remoteTeachers)) return;
  const localTeachers = await db.teachers.toArray();
  const staffMap = new Map<string, any>();
  const idMap = new Map<string | number, any>();

  for (const local of localTeachers) {
    if (local.id) idMap.set(local.id, local);
    const staffId = (local.staffId || (local as any).staff_id || '').trim().toLowerCase();
    const nameKey = `${local.firstName || ''}_${local.lastName || ''}`.trim().toLowerCase();
    const key = staffId || nameKey;
    if (key && !staffMap.has(key)) {
      staffMap.set(key, local);
    } else if (key && staffMap.has(key)) {
      if (local.id) await db.teachers.delete(local.id);
    }
  }

  for (const remote of remoteTeachers) {
    if (!remote) continue;
    const staffId = (remote.staffId || remote.staff_id || '').trim().toLowerCase();
    const nameKey = `${remote.firstName || ''}_${remote.lastName || ''}`.trim().toLowerCase();
    const key = staffId || nameKey;
    let existing = key ? staffMap.get(key) : null;
    if (!existing && remote.id && idMap.has(remote.id)) {
      existing = idMap.get(remote.id);
    }

    const payload = {
      ...remote,
      assignedClasses: typeof remote.assignedClasses === 'string' ? JSON.parse(remote.assignedClasses || '[]') : (remote.assignedClasses || []),
      subjects: typeof remote.subjects === 'string' ? JSON.parse(remote.subjects || '[]') : (remote.subjects || [])
    };

    if (existing) {
      await db.teachers.update(existing.id, {
        ...payload,
        id: existing.id
      });
    } else {
      const { id, ...rest } = payload;
      const newId = await db.teachers.add(rest);
      if (key) staffMap.set(key, { ...payload, id: newId });
    }
  }
}

/**
 * Reconcile subjects in Dexie IndexedDB in-place without creating duplicate rows
 */
export async function reconcileSubjectsInDexie(remoteSubjects: any[]) {
  if (!Array.isArray(remoteSubjects)) return;
  const localSubjects = await db.subjects.toArray();
  const codeMap = new Map<string, any>();
  const idMap = new Map<string | number, any>();

  for (const local of localSubjects) {
    if (local.id) idMap.set(local.id, local);
    const code = (local.code || '').trim().toLowerCase();
    const name = (local.name || '').trim().toLowerCase();
    const key = code || name;
    if (key && !codeMap.has(key)) {
      codeMap.set(key, local);
    } else if (key && codeMap.has(key)) {
      if (local.id) await db.subjects.delete(local.id);
    }
  }

  for (const remote of remoteSubjects) {
    if (!remote) continue;
    const code = (remote.code || '').trim().toLowerCase();
    const name = (remote.name || '').trim().toLowerCase();
    const key = code || name;
    let existing = key ? codeMap.get(key) : null;
    if (!existing && remote.id && idMap.has(remote.id)) {
      existing = idMap.get(remote.id);
    }

    const payload = {
      ...remote,
      applicableClasses: typeof remote.applicableClasses === 'string' ? JSON.parse(remote.applicableClasses || '[]') : (remote.applicableClasses || ['All'])
    };

    if (existing) {
      await db.subjects.update(existing.id, {
        ...payload,
        id: existing.id
      });
    } else {
      const { id, ...rest } = payload;
      const newId = await db.subjects.add(rest);
      if (key) codeMap.set(key, { ...payload, id: newId });
    }
  }
}

/**
 * Reconcile students in Dexie IndexedDB in-place without creating duplicate rows
 */
export async function reconcileStudentsInDexie(remoteStudents: any[]) {
  if (!Array.isArray(remoteStudents)) return;
  const localStudents = await db.students.toArray();
  const stuMap = new Map<string, any>();
  const idMap = new Map<string | number, any>();

  for (const local of localStudents) {
    if (local.id) idMap.set(local.id, local);
    const stuId = (local.studentId || (local as any).student_id || '').trim().toLowerCase();
    const nameKey = `${local.firstName || ''}_${local.lastName || ''}_${local.dateOfBirth || ''}`.trim().toLowerCase();
    const key = stuId || nameKey;
    if (key && !stuMap.has(key)) {
      stuMap.set(key, local);
    } else if (key && stuMap.has(key)) {
      if (local.id) await db.students.delete(local.id);
    }
  }

  for (const remote of remoteStudents) {
    if (!remote) continue;
    const norm = normalizeStudentRecord(remote);
    const stuId = (norm.studentId || norm.student_id || '').trim().toLowerCase();
    const nameKey = `${norm.firstName || ''}_${norm.lastName || ''}_${norm.dateOfBirth || ''}`.trim().toLowerCase();
    const key = stuId || nameKey;
    let existing = key ? stuMap.get(key) : null;
    if (!existing && norm.id && idMap.has(norm.id)) {
      existing = idMap.get(norm.id);
    }

    if (existing) {
      await db.students.update(existing.id, {
        ...norm,
        id: existing.id
      });
    } else {
      const { id, ...rest } = norm;
      const newId = await db.students.add(rest);
      if (key) stuMap.set(key, { ...norm, id: newId });
    }
  }
}

/**
 * Reconcile attendance records in Dexie
 */
export async function reconcileAttendanceInDexie(remoteRecords: any[]) {
  if (!Array.isArray(remoteRecords)) return;
  const local = await db.attendance.toArray();
  const map = new Map<string, any>();
  for (const item of local) {
    const k = `${item.studentId || (item as any).student_id}_${item.date}`;
    map.set(k, item);
  }

  for (const remote of remoteRecords) {
    if (!remote || !remote.date) continue;
    const studentId = remote.studentId || remote.student_id;
    if (!studentId) continue;
    const k = `${studentId}_${remote.date}`;
    const existing = map.get(k);
    if (existing) {
      await db.attendance.update(existing.id, { ...remote, studentId, id: existing.id });
    } else {
      const { id, ...rest } = remote;
      await db.attendance.add({ ...rest, studentId });
    }
  }
}

/**
 * Reconcile results records in Dexie
 */
export async function reconcileResultsInDexie(remoteResults: any[]) {
  if (!Array.isArray(remoteResults)) return;
  const local = await db.results.toArray();
  const map = new Map<string, any>();
  for (const item of local) {
    const k = `${item.studentId || (item as any).student_id}_${(item.subject || '').toLowerCase()}_${(item.term || '').toLowerCase()}`;
    map.set(k, item);
  }

  for (const remote of remoteResults) {
    if (!remote) continue;
    const studentId = remote.studentId || remote.student_id;
    const k = `${studentId}_${(remote.subject || '').toLowerCase()}_${(remote.term || '').toLowerCase()}`;
    const existing = map.get(k);
    if (existing) {
      await db.results.update(existing.id, { ...remote, studentId, id: existing.id });
    } else {
      const { id, ...rest } = remote;
      await db.results.add({ ...rest, studentId });
    }
  }
}

/**
 * Reconcile term reports in Dexie
 */
export async function reconcileTermReportsInDexie(remoteReports: any[]) {
  if (!Array.isArray(remoteReports)) return;
  const local = await db.termReports.toArray();
  const map = new Map<string, any>();
  for (const item of local) {
    const k = `${item.studentId || (item as any).student_id}_${(item.term || '').toLowerCase()}`;
    map.set(k, item);
  }

  for (const remote of remoteReports) {
    if (!remote) continue;
    const studentId = remote.studentId || remote.student_id;
    const k = `${studentId}_${(remote.term || '').toLowerCase()}`;
    const existing = map.get(k);
    if (existing) {
      await db.termReports.update(existing.id, { ...remote, studentId, id: existing.id });
    } else {
      const { id, ...rest } = remote;
      await db.termReports.add({ ...rest, studentId });
    }
  }
}

/**
 * Reconcile settings in Dexie
 */
export async function reconcileSettingsInDexie(remoteSettings: any[]) {
  if (!Array.isArray(remoteSettings)) return;
  const local = await db.settings.toArray();
  const map = new Map<string, any>();
  for (const item of local) {
    if (item.key) map.set(item.key, item);
  }

  for (const remote of remoteSettings) {
    if (!remote || !remote.key) continue;
    const existing = map.get(remote.key);
    const value = typeof remote.value === 'string' ? JSON.parse(remote.value) : remote.value;
    if (existing) {
      await db.settings.update(existing.id, { key: remote.key, value, id: existing.id });
    } else {
      const { id, ...rest } = remote;
      await db.settings.add({ ...rest, value });
    }
  }
}

/**
 * Master Sync: Pull all datasets from Backend/Supabase and reconcile Dexie in-place
 */
export async function syncAllDataFromBackend(schoolId?: string, forceFresh = true): Promise<boolean> {
  try {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    
    // 1. Fetch complete dataset from Backend /api/db/sync
    const url = `/api/db/sync?fresh=${forceFresh ? 'true' : 'false'}&school_id=${encodeURIComponent(targetSchoolId || '')}`;
    const res = await fetch(url, {
      headers: { 'x-school-id': targetSchoolId || '' }
    });

    if (res.ok) {
      const json = await res.json();
      const dataset = json.data || json;
      if (dataset && typeof dataset === 'object') {
        if (Array.isArray(dataset.classes)) await reconcileClassesInDexie(dataset.classes);
        if (Array.isArray(dataset.teachers)) await reconcileTeachersInDexie(dataset.teachers);
        if (Array.isArray(dataset.subjects)) await reconcileSubjectsInDexie(dataset.subjects);
        if (Array.isArray(dataset.students)) await reconcileStudentsInDexie(dataset.students);
        if (Array.isArray(dataset.attendance)) await reconcileAttendanceInDexie(dataset.attendance);
        if (Array.isArray(dataset.results)) await reconcileResultsInDexie(dataset.results);
        if (Array.isArray(dataset.termReports)) await reconcileTermReportsInDexie(dataset.termReports);
        if (Array.isArray(dataset.settings)) await reconcileSettingsInDexie(dataset.settings);
        
        // Notify other components of database reconciliation
        window.dispatchEvent(new CustomEvent('database-reconciled', { detail: { timestamp: Date.now() } }));
        return true;
      }
    }
  } catch (err) {
    console.warn('[SyncService] Backend pull notice:', err);
  }
  return false;
}

/**
 * BroadcastChannel for instant cross-tab sync
 */
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('school_sphere_db_sync');
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'RECORD_UPDATED' || event.data?.type === 'SYNC_REQUEST') {
        syncAllDataFromBackend(undefined, true).catch(() => {});
      }
    };
  }
} catch (e) {}

export function broadcastLocalMutation(table: string, action: string, data: any) {
  try {
    broadcastChannel?.postMessage({
      type: 'RECORD_UPDATED',
      table,
      action,
      data,
      timestamp: Date.now()
    });
  } catch (e) {}
}

/**
 * Initialize Realtime Supabase + Polling Synchronizer
 */
export function initRealtimeAndAutoSync() {
  let isSubscribed = false;

  // 1. Initial Pull immediately
  syncAllDataFromBackend(undefined, true).catch(() => {});

  // 2. Setup Supabase Postgres Changes Realtime Listener
  try {
    if (supabase && typeof supabase.channel === 'function') {
      const channel = supabase
        .channel('schema-live-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          async (payload: any) => {
            const table = payload.table;
            const eventType = payload.eventType; // 'INSERT', 'UPDATE', 'DELETE'
            const newRecord = payload.new;
            const oldRecord = payload.old;

            console.log(`[Supabase Realtime] ${eventType} on ${table}:`, newRecord || oldRecord);

            if (table === 'classes') {
              if (eventType === 'DELETE') {
                if (oldRecord?.id) await db.classes.delete(oldRecord.id);
                if (oldRecord?.name) await db.classes.where('name').equals(oldRecord.name).delete();
              } else if (newRecord) {
                await reconcileClassesInDexie([newRecord]);
              }
            } else if (table === 'teachers') {
              if (eventType === 'DELETE') {
                if (oldRecord?.id) await db.teachers.delete(oldRecord.id);
                if (oldRecord?.staffId) await db.teachers.where('staffId').equals(oldRecord.staffId).delete();
                if (oldRecord?.staff_id) await db.teachers.where('staffId').equals(oldRecord.staff_id).delete();
              } else if (newRecord) {
                await reconcileTeachersInDexie([newRecord]);
              }
            } else if (table === 'subjects') {
              if (eventType === 'DELETE') {
                if (oldRecord?.id) await db.subjects.delete(oldRecord.id);
                if (oldRecord?.code) await db.subjects.where('code').equals(oldRecord.code).delete();
                if (oldRecord?.name) await db.subjects.where('name').equals(oldRecord.name).delete();
              } else if (newRecord) {
                await reconcileSubjectsInDexie([newRecord]);
              }
            } else if (table === 'students') {
              if (eventType === 'DELETE') {
                if (oldRecord?.id) await db.students.delete(oldRecord.id);
                if (oldRecord?.studentId) await db.students.where('studentId').equals(oldRecord.studentId).delete();
                if (oldRecord?.student_id) await db.students.where('studentId').equals(oldRecord.student_id).delete();
              } else if (newRecord) {
                await reconcileStudentsInDexie([newRecord]);
              }
            } else if (table === 'attendance') {
              if (newRecord) await reconcileAttendanceInDexie([newRecord]);
            } else if (table === 'results') {
              if (newRecord) await reconcileResultsInDexie([newRecord]);
            } else if (table === 'settings') {
              if (newRecord) await reconcileSettingsInDexie([newRecord]);
            } else {
              // Trigger a fresh sync for any other tables
              syncAllDataFromBackend(undefined, true).catch(() => {});
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            console.log('[Supabase Realtime] Connected and listening to database mutations');
          }
        });
    }
  } catch (e) {
    console.warn('[SyncService] Supabase Realtime setup note:', e);
  }

  // 3. Fast Periodic Polling (every 5 seconds) to guarantee sync even without websocket
  const pollInterval = setInterval(() => {
    syncAllDataFromBackend(undefined, false).catch(() => {});
  }, 5000);

  // 4. Instant sync on window focus & tab visibility change
  const onFocusOrVisible = () => {
    if (document.visibilityState === 'visible') {
      syncAllDataFromBackend(undefined, true).catch(() => {});
    }
  };

  window.addEventListener('focus', onFocusOrVisible);
  document.addEventListener('visibilitychange', onFocusOrVisible);

  return () => {
    clearInterval(pollInterval);
    window.removeEventListener('focus', onFocusOrVisible);
    document.removeEventListener('visibilitychange', onFocusOrVisible);
  };
}
