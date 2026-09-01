import { supabase, getCurrentSchoolId } from './supabase';
import { db, normalizeStudentRecord } from '../db/schema';
import { 
  reconcileClassesInDexie, 
  reconcileTeachersInDexie, 
  reconcileSubjectsInDexie, 
  reconcileStudentsInDexie,
  reconcileAttendanceInDexie,
  reconcileResultsInDexie,
  reconcileTermReportsInDexie,
  reconcileSettingsInDexie,
  syncAllDataFromBackend,
  broadcastLocalMutation
} from './syncService';

/**
 * SchoolSphere 1.0 - Centralized Multi-Tenant API Client
 * Automatically applies school_id tenant scoping to all database and backend operations.
 */

// ==========================================
// 1. STUDENTS API
// ==========================================
export const studentsApi = {
  getAll: async (schoolId?: string, forceBackendFirst = true) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());

    // 1. Primary Backend-First Retrieval (Server API / Supabase)
    if (forceBackendFirst) {
      try {
        const res = await fetch(`/api/students?school_id=${encodeURIComponent(targetSchoolId || '')}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const normalizedData = data.map(item => normalizeStudentRecord(item));
            // Reconcile and update local IndexedDB cache so all live queries reflect backend state
            for (const item of normalizedData) {
              const studentIdVal = item.studentId || item.student_id;
              if (studentIdVal) {
                const existing = await db.students.where('studentId').equals(studentIdVal).first();
                if (existing) {
                  await db.students.update(existing.id!, {
                    ...item,
                    id: existing.id
                  });
                } else {
                  await db.students.add(item);
                }
              }
            }
            return normalizedData;
          }
        }
      } catch (e) {
        console.warn('Notice querying /api/students backend:', e);
      }

      // Supabase direct fallback
      try {
        if (targetSchoolId) {
          const { data, error } = await supabase
            .from('students')
            .select('*')
            .or(`school_id.eq.${targetSchoolId},school_id.is.null`)
            .order('id', { ascending: false });

          if (!error && data && Array.isArray(data)) {
            const normalized = data.map(s => normalizeStudentRecord(s));
            for (const item of normalized) {
              const studentIdVal = item.studentId || item.student_id;
              if (studentIdVal) {
                const existing = await db.students.where('studentId').equals(studentIdVal).first();
                if (existing) {
                  await db.students.update(existing.id!, { ...item, id: existing.id });
                } else {
                  await db.students.add(item);
                }
              }
            }
            return normalized;
          }
        }
      } catch (e) {
        console.warn('Notice querying Supabase students directly:', e);
      }
    }

    // Offline / Local Dexie DB Fallback
    const local = await db.students.toArray();
    const normalizedLocal = local.map(s => normalizeStudentRecord(s));
    return targetSchoolId ? normalizedLocal.filter((s: any) => !s.schoolId || s.schoolId === targetSchoolId || s.school_id === targetSchoolId) : normalizedLocal;
  },

  getById: async (id: number | string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) return normalizeStudentRecord(data);
    } catch (e) {}

    const local = await db.students.get(Number(id));
    return local ? normalizeStudentRecord(local) : undefined;
  },

  getByClass: async (className: string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      let query = supabase.from('students').select('*').eq('class', className);
      if (targetSchoolId) {
        query = query.or(`school_id.eq.${targetSchoolId},school_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data.map(s => normalizeStudentRecord(s));
    } catch (e) {}

    const local = await db.students.where('class').equals(className).toArray();
    const normalizedLocal = local.map(s => normalizeStudentRecord(s));
    return targetSchoolId ? normalizedLocal.filter((s: any) => !s.schoolId || s.schoolId === targetSchoolId || s.school_id === targetSchoolId) : normalizedLocal;
  },

  /**
   * Option B: Push All Local Data to Supabase Backend Database
   */
  syncLocalToRemote: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const rawStudents = await db.students.toArray();
    const normalizedStudents = rawStudents.map(s => normalizeStudentRecord(s));

    const payload = {
      students: normalizedStudents,
      classes: await db.classes.toArray(),
      subjects: await db.subjects.toArray(),
      teachers: await db.teachers.toArray(),
      attendance: await db.attendance.toArray(),
      results: await db.results.toArray(),
      termReports: await db.termReports.toArray(),
      settings: await db.settings.toArray(),
      inventory: await db.inventory.toArray(),
      expenses: await db.expenses.toArray(),
      promotionHistory: await db.promotionHistory.toArray()
    };

    const res = await fetch(`/api/db/sync?school_id=${encodeURIComponent(targetSchoolId || '')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-school-id': targetSchoolId || ''
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: 'Sync failed' }));
      throw new Error(errJson.error || 'Database sync failed');
    }

    return await res.json();
  },

  create: async (student: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const normalized = normalizeStudentRecord({
      ...student,
      school_id: targetSchoolId,
      schoolId: targetSchoolId
    });

    // Save to local Dexie immediately
    const localId = await db.students.add(normalized);
    normalized.id = localId;

    // Direct server API call
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(normalized)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const finalNorm = normalizeStudentRecord({ ...json.data, id: localId });
          await db.students.update(localId, finalNorm);
          return finalNorm;
        }
      }
    } catch (e) {
      console.warn('Notice calling /api/students:', e);
    }

    return normalized;
  },

  bulkCreate: async (studentsList: any[], schoolId?: string, fileInfo?: { fileHash?: string; fileName?: string }) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const prepared = studentsList.map(s => normalizeStudentRecord({
      ...s,
      school_id: targetSchoolId,
      schoolId: targetSchoolId
    }));

    const remotePayload = prepared.map(s => {
      const copy: any = { ...s };
      delete copy.id;
      delete copy.schoolId;
      return copy;
    });

    // 1. Call server bulk endpoint first to enforce rate-limiting & duplicate file checks
    let serverSuccess = false;
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || '',
          ...(fileInfo?.fileHash ? { 'x-file-hash': fileInfo.fileHash } : {})
        },
        body: JSON.stringify({ 
          students: remotePayload, 
          schoolId: targetSchoolId,
          fileHash: fileInfo?.fileHash,
          fileName: fileInfo?.fileName
        })
      });

      if (res.status === 409) {
        const json = await res.json();
        throw new Error(json.message || 'Duplicate file detected. This file was already imported.');
      }

      if (res.status === 429) {
        const json = await res.json();
        throw new Error(json.error || 'Rate limit exceeded on imports. Please wait before importing again.');
      }

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          serverSuccess = true;
          const normalizedIncoming = json.data.map((item: any) => normalizeStudentRecord(item));
          // Add to local Dexie after server confirmed
          for (const item of normalizedIncoming) {
            const sid = item.studentId || item.student_id;
            if (sid) {
              const existing = await db.students.where('studentId').equals(sid).first();
              if (existing) {
                await db.students.update(existing.id!, { ...item, id: existing.id });
              } else {
                await db.students.add(item);
              }
            }
          }
          return normalizedIncoming;
        }
      }
    } catch (e: any) {
      if (e.message && (e.message.includes('Duplicate file') || e.message.includes('Rate limit'))) {
        throw e;
      }
      console.warn('Notice calling /api/students/bulk:', e);
    }

    // 2. Fallback direct client Supabase insert
    if (!serverSuccess) {
      try {
        const { data, error } = await supabase.from('students').insert(remotePayload).select();
        if (!error && data) {
          const normalizedIncoming = data.map((item: any) => normalizeStudentRecord(item));
          for (const item of normalizedIncoming) {
            const sid = item.studentId || item.student_id;
            if (sid) {
              const existing = await db.students.where('studentId').equals(sid).first();
              if (existing) {
                await db.students.update(existing.id!, { ...item, id: existing.id });
              } else {
                await db.students.add(item);
              }
            }
          }
          return normalizedIncoming;
        }
      } catch (e) {
        console.warn('Notice bulk syncing students to Supabase directly:', e);
      }
    }

    // 3. Add to local Dexie fallback
    for (const item of prepared) {
      const sid = item.studentId || item.student_id;
      if (sid) {
        const existing = await db.students.where('studentId').equals(sid).first();
        if (existing) {
          await db.students.update(existing.id!, { ...item, id: existing.id });
        } else {
          await db.students.add(item);
        }
      }
    }

    return prepared;
  },

  update: async (id: number | string, updates: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    
    // Find existing student from Dexie to retrieve primary keys and identifiers
    let existing: any = null;
    try {
      if (typeof id === 'number') {
        existing = await db.students.get(id);
      } else {
        existing = await db.students.where('studentId').equals(String(id)).first();
      }
    } catch (e) {}

    const studentIdentifier = existing?.studentId || existing?.student_id || updates.studentId || updates.student_id || (typeof id === 'string' ? id : '');
    const mergedRecord = {
      ...(existing || {}),
      ...updates,
      school_id: targetSchoolId,
      schoolId: targetSchoolId
    };

    const normalizedUpdates = normalizeStudentRecord(mergedRecord);
    
    // 1. Update local Dexie immediately for snappy UI
    try {
      if (typeof id === 'number') {
        await db.students.update(id, normalizedUpdates);
      } else if (existing && existing.id) {
        await db.students.update(existing.id, normalizedUpdates);
      } else if (studentIdentifier) {
        const bySid = await db.students.where('studentId').equals(studentIdentifier).first();
        if (bySid && bySid.id) await db.students.update(bySid.id, normalizedUpdates);
      }
    } catch (e) {}

    // Prepare snake_case and camelCase payload for backend
    const cleanUpdates: any = { ...normalizedUpdates };
    delete cleanUpdates.id;
    delete cleanUpdates.schoolId;
    if (targetSchoolId) cleanUpdates.school_id = targetSchoolId;
    if (studentIdentifier) {
      cleanUpdates.studentId = studentIdentifier;
      cleanUpdates.student_id = studentIdentifier;
    }

    // 2. Call Server PUT /api/students/:id Endpoint
    try {
      const qParams = new URLSearchParams();
      if (targetSchoolId) qParams.set('school_id', targetSchoolId);
      if (studentIdentifier) qParams.set('student_id', studentIdentifier);

      const targetId = existing?.id || id;
      const res = await fetch(`/api/students/${encodeURIComponent(String(targetId))}?${qParams.toString()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(cleanUpdates)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const normResult = normalizeStudentRecord(json.data);
          if (existing?.id) {
            await db.students.update(existing.id, normResult);
          }
          return normResult;
        }
      }
    } catch (e) {
      console.warn('Notice calling server PUT /api/students/:id:', e);
    }

    // 3. Direct Supabase fallback
    try {
      const snakeObj: any = {
        first_name: normalizedUpdates.firstName,
        last_name: normalizedUpdates.lastName,
        class: normalizedUpdates.class,
        gender: normalizedUpdates.gender,
        date_of_birth: normalizedUpdates.dateOfBirth,
        guardian_name: normalizedUpdates.guardianName,
        guardian_phone: normalizedUpdates.guardianPhone,
        fees_paid: normalizedUpdates.feesPaid,
        total_fees: normalizedUpdates.totalFees,
        fee_breakdown: normalizedUpdates.feeBreakdown,
        fee_paid_breakdown: normalizedUpdates.feePaidBreakdown,
        school_id: targetSchoolId
      };
      if (normalizedUpdates.house) snakeObj.house = normalizedUpdates.house;
      if (normalizedUpdates.department) snakeObj.department = normalizedUpdates.department;
      if (normalizedUpdates.photo) snakeObj.photo = normalizedUpdates.photo;
      if (normalizedUpdates.status) snakeObj.status = normalizedUpdates.status;
      if (studentIdentifier) snakeObj.student_id = studentIdentifier;

      if (existing?.id && !isNaN(Number(existing.id))) {
        const { data } = await supabase
          .from('students')
          .update(snakeObj)
          .eq('id', Number(existing.id))
          .select()
          .maybeSingle();
        if (data) return normalizeStudentRecord(data);
      }
      if (studentIdentifier) {
        const { data } = await supabase
          .from('students')
          .update(snakeObj)
          .eq('student_id', studentIdentifier)
          .select()
          .maybeSingle();
        if (data) return normalizeStudentRecord(data);
      }
    } catch (e) {
      console.warn('Notice updating student in Supabase directly:', e);
    }

    return normalizedUpdates;
  },

  delete: async (id: number | string, schoolId?: string, studentId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    
    // 1. Get record info from Dexie before deleting to catch studentId identifier
    let foundStudentId = studentId;
    try {
      if (typeof id === 'number') {
        const rec = await db.students.get(id);
        if (rec && rec.studentId) foundStudentId = rec.studentId;
      } else if (typeof id === 'string') {
        const rec = await db.students.where('studentId').equals(id).first();
        if (rec && rec.studentId) foundStudentId = rec.studentId;
      }
    } catch (e) {}

    // 2. Immediate Local Dexie Deletion (Front-end reactive update)
    try {
      if (typeof id === 'number') {
        await db.students.delete(id);
      }
      if (typeof id === 'string') {
        await db.students.where('studentId').equals(id).delete();
        if (!isNaN(Number(id))) {
          await db.students.delete(Number(id));
        }
      }
      if (foundStudentId) {
        await db.students.where('studentId').equals(foundStudentId).delete();
      }
    } catch (e) {
      console.warn('Notice removing student from local Dexie DB:', e);
    }

    // 3. Server API Delete Endpoint
    try {
      const qParams = new URLSearchParams();
      if (targetSchoolId) qParams.set('school_id', targetSchoolId);
      if (foundStudentId) qParams.set('student_id', foundStudentId);
      
      await fetch(`/api/students/${encodeURIComponent(String(id))}?${qParams.toString()}`, { 
        method: 'DELETE',
        headers: {
          'x-school-id': targetSchoolId || ''
        }
      });
    } catch (e) {
      console.warn('Notice calling DELETE /api/students/:id:', e);
    }

    // 4. Supabase Direct Deletion fallback
    try {
      if (id) {
        await supabase.from('students').delete().eq('id', id);
      }
      if (foundStudentId) {
        await supabase.from('students').delete().eq('studentId', foundStudentId);
        await supabase.from('students').delete().eq('student_id', foundStudentId);
      }
    } catch (e) {
      console.warn('Notice deleting student from Supabase directly:', e);
    }

    return true;
  },

  bulkDelete: async (ids: (number | string)[], schoolId?: string, studentIds?: string[]) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    if (!ids || ids.length === 0) return { success: true, count: 0 };

    // 1. Gather all student identifiers and numeric IDs
    const numericIds: number[] = [];
    const allStudentIds: string[] = Array.isArray(studentIds) ? [...studentIds] : [];

    for (const rawId of ids) {
      if (typeof rawId === 'number') {
        numericIds.push(rawId);
      } else if (typeof rawId === 'string') {
        if (!isNaN(Number(rawId))) {
          numericIds.push(Number(rawId));
        }
        allStudentIds.push(rawId);
      }
    }

    // Search Dexie for studentId strings for the numeric IDs
    try {
      if (numericIds.length > 0) {
        const records = await db.students.where('id').anyOf(numericIds).toArray();
        records.forEach(r => {
          if (r.studentId && !allStudentIds.includes(r.studentId)) {
            allStudentIds.push(r.studentId);
          }
        });
      }
    } catch (e) {}

    // 2. Immediate Local Dexie Deletion (Front-end reactive synchronization)
    try {
      if (numericIds.length > 0) {
        await db.students.bulkDelete(numericIds);
      }
      for (const sId of allStudentIds) {
        await db.students.where('studentId').equals(sId).delete();
      }
    } catch (e) {
      console.warn('Notice removing bulk students from local Dexie:', e);
    }

    // 3. Server API Bulk Delete Endpoint
    try {
      const res = await fetch('/api/students/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify({
          ids: numericIds,
          studentIds: allStudentIds,
          schoolId: targetSchoolId
        })
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, count: json.count || ids.length };
      }
    } catch (e) {
      console.warn('Notice calling /api/students/bulk-delete:', e);
    }

    // 4. Supabase Direct Bulk Deletion fallback
    try {
      if (numericIds.length > 0) {
        await supabase.from('students').delete().in('id', numericIds);
      }
      if (allStudentIds.length > 0) {
        try {
          await supabase.from('students').delete().in('studentId', allStudentIds);
        } catch (e) {}
        try {
          await supabase.from('students').delete().in('student_id', allStudentIds);
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Notice bulk deleting students from Supabase directly:', e);
    }

    return { success: true, count: ids.length };
  }
};

// ==========================================
// 2. CLASSES API
// ==========================================
export const classesApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    
    // 1. Try Backend API
    try {
      const res = await fetch(`/api/classes?school_id=${encodeURIComponent(targetSchoolId || '')}`, {
        headers: { 'x-school-id': targetSchoolId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try {
            await reconcileClassesInDexie(data);
          } catch (e) {}
          return data;
        }
      }
    } catch (e) {}

    // 2. Try direct Supabase
    try {
      if (targetSchoolId) {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .or(`school_id.eq.${targetSchoolId},school_id.is.null`);

        if (!error && data && data.length > 0) {
          try {
            await reconcileClassesInDexie(data);
          } catch (e) {}
          return data;
        }
      }
    } catch (e) {}

    // 3. Fallback to Local Dexie
    const local = await db.classes.toArray();
    return targetSchoolId ? local.filter((c: any) => !c.schoolId || c.schoolId === targetSchoolId || c.school_id === targetSchoolId) : local;
  },

  create: async (classData: { name: string; level: string; capacity?: number }, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = {
      ...classData,
      capacity: classData.capacity || 50,
      school_id: targetSchoolId,
      schoolId: targetSchoolId,
      createdAt: Date.now()
    };
    
    // 1. Optimistic local Dexie entry
    const localId = await db.classes.add(payload as any);
    let officialRecord: any = { ...payload, id: localId };

    // 2. Persist to Backend API
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          officialRecord = json.data;
          try {
            await reconcileClassesInDexie([officialRecord]);
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 3. Direct Supabase sync if needed
    try {
      const { data } = await supabase.from('classes').insert([payload]).select().single();
      if (data && (!officialRecord || !officialRecord.id)) {
        officialRecord = data;
        try {
          await reconcileClassesInDexie([officialRecord]);
        } catch (e) {}
      }
    } catch (e) {}

    broadcastLocalMutation('classes', 'create', officialRecord);
    return officialRecord;
  },

  update: async (id: number | string, updates: Partial<{ name: string; level: string; capacity?: number }>, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const mergedUpdates = { ...updates, updatedAt: Date.now(), school_id: targetSchoolId, schoolId: targetSchoolId };

    // 1. Immediate in-place optimistic Dexie update
    let localKey: number | undefined = typeof id === 'number' ? id : undefined;
    try {
      if (typeof id === 'number') {
        await db.classes.update(id, mergedUpdates);
        localKey = id;
      } else {
        const found = await db.classes.where('name').equals(String(id)).first();
        if (found && found.id) {
          await db.classes.update(found.id, mergedUpdates);
          localKey = found.id;
        }
      }
    } catch (e) {}

    // 2. Persist in-place to Backend API
    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(mergedUpdates)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          try {
            await reconcileClassesInDexie([json.data]);
          } catch (e) {}
          broadcastLocalMutation('classes', 'update', json.data);
          return json.data;
        }
      }
    } catch (e) {}

    // 3. Direct Supabase sync
    try {
      if (typeof id === 'number') {
        await supabase.from('classes').update(mergedUpdates).eq('id', id);
      } else {
        await supabase.from('classes').update(mergedUpdates).eq('name', id);
      }
    } catch (e) {}

    broadcastLocalMutation('classes', 'update', { id, ...mergedUpdates });
    return true;
  },

  delete: async (id: number | string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());

    // 1. Immediate local Dexie deletion
    try {
      if (typeof id === 'number') {
        await db.classes.delete(id);
      } else {
        await db.classes.where('name').equals(String(id)).delete();
      }
    } catch (e) {}

    // 2. Backend API Deletion
    try {
      await fetch(`/api/classes/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
        headers: { 'x-school-id': targetSchoolId || '' }
      });
    } catch (e) {}

    // 3. Direct Supabase Deletion
    try {
      if (typeof id === 'number') {
        await supabase.from('classes').delete().eq('id', id);
      } else {
        await supabase.from('classes').delete().eq('name', id);
      }
    } catch (e) {}

    broadcastLocalMutation('classes', 'delete', { id });
    return true;
  }
};

// ==========================================
// 3. SUBJECTS API
// ==========================================
export const subjectsApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());

    // 1. Try Backend API
    try {
      const res = await fetch(`/api/subjects?school_id=${encodeURIComponent(targetSchoolId || '')}`, {
        headers: { 'x-school-id': targetSchoolId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try {
            await reconcileSubjectsInDexie(data);
          } catch (e) {}
          return data;
        }
      }
    } catch (e) {}

    // 2. Try direct Supabase
    try {
      if (targetSchoolId) {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .or(`school_id.eq.${targetSchoolId},school_id.is.null`);

        if (!error && data && data.length > 0) {
          const parsed = data.map((sub: any) => ({
            ...sub,
            applicableClasses: typeof sub.applicableClasses === 'string' ? JSON.parse(sub.applicableClasses || '[]') : (sub.applicableClasses || [])
          }));
          try {
            await reconcileSubjectsInDexie(parsed);
          } catch (e) {}
          return parsed;
        }
      }
    } catch (e) {}

    // 3. Fallback to Local Dexie
    const local = await db.subjects.toArray();
    return targetSchoolId ? local.filter((s: any) => !s.schoolId || s.schoolId === targetSchoolId || s.school_id === targetSchoolId) : local;
  },

  create: async (subjectData: { name: string; code: string; applicableClasses?: string[] }, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = {
      ...subjectData,
      applicableClasses: subjectData.applicableClasses || ['All'],
      school_id: targetSchoolId,
      schoolId: targetSchoolId,
      createdAt: Date.now()
    };
    
    // 1. Optimistic local Dexie entry
    const localId = await db.subjects.add(payload as any);
    let officialRecord: any = { ...payload, id: localId };

    // 2. Persist to Backend API
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          officialRecord = json.data;
          try {
            await reconcileSubjectsInDexie([officialRecord]);
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 3. Direct Supabase sync
    try {
      const { data } = await supabase.from('subjects').insert([payload]).select().single();
      if (data && (!officialRecord || !officialRecord.id)) {
        officialRecord = data;
        try {
          await reconcileSubjectsInDexie([officialRecord]);
        } catch (e) {}
      }
    } catch (e) {}

    broadcastLocalMutation('subjects', 'create', officialRecord);
    return officialRecord;
  },

  update: async (id: number | string, updates: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const mergedUpdates = { ...updates, updatedAt: Date.now(), school_id: targetSchoolId, schoolId: targetSchoolId };

    // 1. Immediate in-place optimistic Dexie update
    let localKey: number | undefined = typeof id === 'number' ? id : undefined;
    try {
      if (typeof id === 'number') {
        await db.subjects.update(id, mergedUpdates);
        localKey = id;
      } else {
        const found = await db.subjects.where('code').equals(String(id)).first() || await db.subjects.where('name').equals(String(id)).first();
        if (found && found.id) {
          await db.subjects.update(found.id, mergedUpdates);
          localKey = found.id;
        }
      }
    } catch (e) {}

    // 2. Persist in-place to Backend API
    try {
      const res = await fetch(`/api/subjects/${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(mergedUpdates)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          try {
            await reconcileSubjectsInDexie([json.data]);
          } catch (e) {}
          broadcastLocalMutation('subjects', 'update', json.data);
          return json.data;
        }
      }
    } catch (e) {}

    // 3. Direct Supabase sync
    try {
      if (typeof id === 'number') {
        await supabase.from('subjects').update(mergedUpdates).eq('id', id);
      } else {
        await supabase.from('subjects').update(mergedUpdates).or(`code.eq.${id},name.eq.${id}`);
      }
    } catch (e) {}

    broadcastLocalMutation('subjects', 'update', { id, ...mergedUpdates });
    return true;
  },

  delete: async (id: number | string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());

    // 1. Immediate local Dexie deletion
    try {
      if (typeof id === 'number') {
        await db.subjects.delete(id);
      } else {
        await db.subjects.where('code').equals(String(id)).delete();
      }
    } catch (e) {}

    // 2. Backend API Deletion
    try {
      await fetch(`/api/subjects/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
        headers: { 'x-school-id': targetSchoolId || '' }
      });
    } catch (e) {}

    // 3. Direct Supabase Deletion
    try {
      if (typeof id === 'number') {
        await supabase.from('subjects').delete().eq('id', id);
      } else {
        await supabase.from('subjects').delete().or(`code.eq.${id},name.eq.${id}`);
      }
    } catch (e) {}

    broadcastLocalMutation('subjects', 'delete', { id });
    return true;
  }
};

// ==========================================
// 4. TEACHERS & STAFF API
// ==========================================
export const teachersApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());

    // 1. Try Backend API
    try {
      const res = await fetch(`/api/teachers?school_id=${encodeURIComponent(targetSchoolId || '')}`, {
        headers: { 'x-school-id': targetSchoolId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          try {
            await reconcileTeachersInDexie(data);
          } catch (e) {}
          return data;
        }
      }
    } catch (e) {}

    // 2. Try direct Supabase
    try {
      if (targetSchoolId) {
        const { data, error } = await supabase
          .from('teachers')
          .select('*')
          .or(`school_id.eq.${targetSchoolId},school_id.is.null`);

        if (!error && data && data.length > 0) {
          const parsed = data.map((t: any) => ({
            ...t,
            assignedClasses: typeof t.assignedClasses === 'string' ? JSON.parse(t.assignedClasses || '[]') : (t.assignedClasses || []),
            subjects: typeof t.subjects === 'string' ? JSON.parse(t.subjects || '[]') : (t.subjects || [])
          }));
          try {
            await reconcileTeachersInDexie(parsed);
          } catch (e) {}
          return parsed;
        }
      }
    } catch (e) {}

    // 3. Fallback to Local Dexie
    const local = await db.teachers.toArray();
    return targetSchoolId ? local.filter((t: any) => !t.schoolId || t.schoolId === targetSchoolId || t.school_id === targetSchoolId) : local;
  },

  create: async (teacher: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = {
      ...teacher,
      assignedClasses: teacher.assignedClasses || [],
      subjects: teacher.subjects || [],
      school_id: targetSchoolId,
      schoolId: targetSchoolId,
      createdAt: Date.now()
    };

    // 1. Optimistic local Dexie entry
    const localId = await db.teachers.add(payload as any);
    let officialRecord: any = { ...payload, id: localId };

    // 2. Persist to Backend API
    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          officialRecord = json.data;
          try {
            await reconcileTeachersInDexie([officialRecord]);
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 3. Direct Supabase sync
    try {
      const { data } = await supabase.from('teachers').insert([payload]).select().single();
      if (data && (!officialRecord || !officialRecord.id)) {
        officialRecord = data;
        try {
          await reconcileTeachersInDexie([officialRecord]);
        } catch (e) {}
      }
    } catch (e) {}

    broadcastLocalMutation('teachers', 'create', officialRecord);
    return officialRecord;
  },

  update: async (id: number | string, updates: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const mergedUpdates = { ...updates, updatedAt: Date.now(), school_id: targetSchoolId, schoolId: targetSchoolId };

    // 1. Immediate in-place optimistic Dexie update
    let localKey: number | undefined = typeof id === 'number' ? id : undefined;
    try {
      if (typeof id === 'number') {
        await db.teachers.update(id, mergedUpdates);
        localKey = id;
      } else {
        const found = await db.teachers.where('staffId').equals(String(id)).first();
        if (found && found.id) {
          await db.teachers.update(found.id, mergedUpdates);
          localKey = found.id;
        }
      }
    } catch (e) {}

    // 2. Persist in-place to Backend API
    try {
      const res = await fetch(`/api/teachers/${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': targetSchoolId || ''
        },
        body: JSON.stringify(mergedUpdates)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          try {
            await reconcileTeachersInDexie([json.data]);
          } catch (e) {}
          broadcastLocalMutation('teachers', 'update', json.data);
          return json.data;
        }
      }
    } catch (e) {}

    // 3. Direct Supabase sync
    try {
      if (typeof id === 'number') {
        await supabase.from('teachers').update(mergedUpdates).eq('id', id);
      } else {
        await supabase.from('teachers').update(mergedUpdates).or(`staffId.eq.${id},staff_id.eq.${id}`);
      }
    } catch (e) {}

    broadcastLocalMutation('teachers', 'update', { id, ...mergedUpdates });
    return true;
  },

  delete: async (id: number | string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());

    // 1. Immediate local Dexie deletion
    try {
      if (typeof id === 'number') {
        await db.teachers.delete(id);
      } else {
        await db.teachers.where('staffId').equals(String(id)).delete();
      }
    } catch (e) {}

    // 2. Backend API Deletion
    try {
      await fetch(`/api/teachers/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
        headers: { 'x-school-id': targetSchoolId || '' }
      });
    } catch (e) {}

    // 3. Direct Supabase Deletion
    try {
      if (typeof id === 'number') {
        await supabase.from('teachers').delete().eq('id', id);
      } else {
        await supabase.from('teachers').delete().or(`staffId.eq.${id},staff_id.eq.${id}`);
      }
    } catch (e) {}

    broadcastLocalMutation('teachers', 'delete', { id });
    return true;
  }
};

// ==========================================
// 5. TENANT ACADEMIC DATA SYNCHRONIZATION
// ==========================================
export const syncTenantAcademicData = async (targetSchoolId: string) => {
  if (!targetSchoolId) return false;
  try {
    const res = await fetch(`/api/academic/sync-tenant/${encodeURIComponent(targetSchoolId)}`);
    if (res.ok) {
      const { data } = await res.json();
      if (data) {
        // Hydrate local Dexie with tenant's records in-place without duplicating rows
        if (Array.isArray(data.students)) await reconcileStudentsInDexie(data.students);
        if (Array.isArray(data.teachers)) await reconcileTeachersInDexie(data.teachers);
        if (Array.isArray(data.classes)) await reconcileClassesInDexie(data.classes);
        if (Array.isArray(data.subjects)) await reconcileSubjectsInDexie(data.subjects);
        if (Array.isArray(data.attendance)) await reconcileAttendanceInDexie(data.attendance);
        if (Array.isArray(data.results)) await reconcileResultsInDexie(data.results);
        return true;
      }
    }
  } catch (e) {
    console.warn('Notice hydrating tenant academic data:', e);
  }
  return false;
};

// ==========================================
// 4. ATTENDANCE API
// ==========================================
export const attendanceApi = {
  getByDate: async (date: string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_id', targetSchoolId)
        .eq('date', date);

      if (!error && data && data.length > 0) return data;
    } catch (e) {}
    return await db.attendance.where('date').equals(date).toArray();
  },

  recordAttendance: async (records: Array<{ studentId: string; date: string; status: 'Present' | 'Absent' | 'Late' | string }>, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const recordsWithTenant: any[] = records.map(r => ({ ...r, school_id: targetSchoolId }));
    
    // Save to Dexie
    await db.attendance.bulkPut(recordsWithTenant as any);

    // Save to Supabase
    try {
      await supabase.from('attendance').upsert(recordsWithTenant);
    } catch (e) {}
    return true;
  }
};

// ==========================================
// 5. RESULTS & EXAM ANALYSIS API
// ==========================================
export const resultsApi = {
  getByClassAndTerm: async (className: string, term: string, subject?: string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      let query = supabase
        .from('results')
        .select('*')
        .eq('school_id', targetSchoolId)
        .eq('class', className)
        .eq('term', term);

      if (subject) {
        query = query.eq('subject', subject);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
    } catch (e) {}

    let localResults = await db.results.where({ class: className, term: term }).toArray();
    if (subject) {
      localResults = localResults.filter(r => r.subject === subject);
    }
    return localResults;
  },

  recordScores: async (scores: any[], schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const recordsWithTenant = scores.map(s => ({ ...s, school_id: targetSchoolId }));
    
    await db.results.bulkPut(recordsWithTenant);
    try {
      await supabase.from('results').upsert(recordsWithTenant);
    } catch (e) {}
    return true;
  }
};

// ==========================================
// 6. PROMOTIONS & ACADEMIC TRANSITIONS API
// ==========================================
export const promotionsApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      if (targetSchoolId) {
        const { data, error } = await supabase
          .from('promotionHistory')
          .select('*')
          .or(`school_id.eq.${targetSchoolId},school_id.is.null`)
          .order('timestamp', { ascending: false });

        if (!error && data && data.length > 0) return data;
      }
    } catch (e) {}

    return await db.promotionHistory.toArray();
  },

  recordPromotion: async (record: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = { ...record, school_id: targetSchoolId, schoolId: targetSchoolId };
    
    // 1. Add to Dexie
    const localId = await db.promotionHistory.add(payload);

    // 2. Persist to Supabase
    try {
      await supabase.from('promotionHistory').insert([payload]);
    } catch (e) {
      try {
        await supabase.from('promotion_history').insert([payload]);
      } catch (e2) {}
    }

    return localId;
  },

  revertPromotion: async (id: number, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    
    // 1. Delete from Dexie
    await db.promotionHistory.delete(id);

    // 2. Delete from Supabase
    try {
      await supabase.from('promotionHistory').delete().eq('id', id);
    } catch (e) {
      try {
        await supabase.from('promotion_history').delete().eq('id', id);
      } catch (e2) {}
    }

    return true;
  }
};

// ==========================================
// 7. FEES & FINANCIAL TRANSACTIONS API
// ==========================================
export const feesApi = {
  recordPayment: async (paymentData: { studentId: string; amount: number; description?: string }, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const student = await db.students.where('studentId').equals(paymentData.studentId).first();
    if (student && student.id) {
      const newFeesPaid = (student.feesPaid || 0) + paymentData.amount;
      await db.students.update(student.id, { feesPaid: newFeesPaid });

      try {
        await supabase
          .from('students')
          .update({ feesPaid: newFeesPaid })
          .eq('school_id', targetSchoolId)
          .eq('studentId', paymentData.studentId);
      } catch (e) {}
    }
    return true;
  }
};

// ==========================================
// 7. MULTI-TENANT SCHOOLS DIRECTORY API
// ==========================================
export const schoolsApi = {
  getAll: async () => {
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tenants)) {
          return data.tenants;
        }
      }
    } catch (e) {}

    try {
      const { data, error } = await supabase.from('schools').select('*');
      if (!error && data) return data;
    } catch (e) {}

    return [
      {
        id: 'fca16e63-4259-4de7-aae1-8b4432ea0ea3',
        name: 'School Sphere Academy',
        slug: 'school-sphere-academy',
        status: 'active',
        theme: 'indigo'
      }
    ];
  },

  getCurrent: getCurrentSchoolId
};

export { getCurrentSchoolId };

// ==========================================
// 8. LICENSE VERIFICATION & STATUS API
// ==========================================
export const licenseApi = {
  getStatus: async () => {
    const schoolId = await getCurrentSchoolId();
    if (!schoolId) {
      return { active: true, activeModules: [] };
    }

    try {
      const { data } = await supabase
        .from('school_licenses')
        .select('*')
        .eq('school_id', schoolId)
        .or('active_status.eq.active,status.eq.active')
        .maybeSingle();

      if (data) {
        // Returns activeModules specific to that school's license tier
        return {
          active: true,
          tier: data.tier || 'enterprise',
          activeModules: data.active_modules || data.activeModules || [] // Per-school features
        };
      }
    } catch (e) {
      console.warn('Notice loading school license from Supabase:', e);
    }

    try {
      const res = await fetch('/api/license/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e: any) {}

    return {
      active: true,
      activeModules: [
        'students', 'academic', 'timetable', 'attendance',
        'results', 'exam_analysis', 'reports', 'fees',
        'siren', 'evoting', 'inventory'
      ]
    };
  },

  validate: async (licenseKey: string) => {
    try {
      const res = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: licenseKey })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

export const licensesApi = licenseApi;

// ==========================================
// 9. USERS & AUTHENTICATION API
// ==========================================
export const usersApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        // Filter by school if school_id is present
        const filtered = targetSchoolId 
          ? data.filter(u => !u.school_id || u.school_id === targetSchoolId || u.role === 'super_admin')
          : data;
        return filtered.map(u => ({
          id: u.id,
          username: u.username,
          fullName: u.full_name || u.fullName || u.username,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status || 'active',
          schoolId: u.school_id,
          school_id: u.school_id,
          createdAt: u.created_at || Date.now(),
          lastLogin: u.last_login
        }));
      }
    } catch (e) {
      console.warn('Notice querying Supabase users:', e);
    }

    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          return data.users;
        }
      }
    } catch (e) {}

    // Offline / Local Dexie fallback
    return await db.users.toArray();
  },

  create: async (userData: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = {
      username: userData.username.trim().toLowerCase(),
      password_hash: userData.passwordHash || userData.password_hash || '',
      full_name: userData.fullName || userData.full_name || userData.username,
      email: userData.email || null,
      phone: userData.phone || null,
      role: userData.role || 'teacher',
      status: userData.status || 'active',
      school_id: userData.role === 'super_admin' ? null : targetSchoolId,
      created_at: userData.createdAt || Date.now(),
      updated_at: Date.now(),
      last_login: Date.now()
    };

    // Save to local Dexie
    let localId: number | undefined;
    try {
      const allDb = await db.users.toArray();
      const existing = allDb.find(u => u.username?.toLowerCase() === payload.username);
      const dexieUserPayload = {
        ...payload,
        fullName: payload.full_name,
        passwordHash: payload.password_hash,
        createdAt: payload.created_at || Date.now()
      };

      if (existing && existing.id) {
        await db.users.update(existing.id, dexieUserPayload);
        localId = existing.id;
      } else {
        localId = (await db.users.add(dexieUserPayload as any)) as number;
      }
    } catch (e) {}

    // Insert/upsert into Supabase
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert([payload], { onConflict: 'school_id,username' })
        .select()
        .single();

      if (!error && data) {
        return {
          ...data,
          id: data.id,
          fullName: data.full_name,
          passwordHash: data.password_hash
        };
      }
    } catch (e) {
      console.warn('Notice saving user to Supabase:', e);
    }

    // Call server API route
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) return data.user;
      }
    } catch (e) {}

    return { ...payload, id: localId, fullName: payload.full_name };
  },

  update: async (id: number | string, updates: any) => {
    // Update local Dexie
    if (typeof id === 'number') {
      await db.users.update(id, updates);
    }

    // Update Supabase
    try {
      const supabaseUpdates: any = { updated_at: Date.now() };
      if (updates.fullName) supabaseUpdates.full_name = updates.fullName;
      if (updates.full_name) supabaseUpdates.full_name = updates.full_name;
      if (updates.role) supabaseUpdates.role = updates.role;
      if (updates.status) supabaseUpdates.status = updates.status;
      if (updates.passwordHash) supabaseUpdates.password_hash = updates.passwordHash;
      if (updates.password_hash) supabaseUpdates.password_hash = updates.password_hash;
      if (updates.email !== undefined) supabaseUpdates.email = updates.email;
      if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone;
      if (updates.lastLogin) supabaseUpdates.last_login = updates.lastLogin;

      await supabase.from('users').update(supabaseUpdates).eq('id', id);
    } catch (e) {
      console.warn('Notice updating user on Supabase:', e);
    }

    // Update server endpoint
    try {
      await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {}

    return true;
  },

  delete: async (id: number | string) => {
    if (typeof id === 'number') {
      await db.users.delete(id);
    }

    try {
      await supabase.from('users').delete().eq('id', id);
    } catch (e) {}

    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
    } catch (e) {}

    return true;
  }
};

// ==========================================
// 10. AUTH & RECOVERY API
// ==========================================
export const authApi = {
  forgotPassword: async (emailOrUsername: string) => {
    const cleanInput = emailOrUsername.trim().toLowerCase();

    // 1. Direct validation against Supabase database
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, username, full_name, email, status')
        .or(`email.ilike.${cleanInput},username.ilike.${cleanInput}`)
        .maybeSingle();

      if (dbUser) {
        const status = (dbUser.status || 'active').toLowerCase();
        if (status === 'suspended' || status === 'inactive') {
          return {
            success: false,
            error: "This account is currently inactive or suspended. Please contact your administrator."
          };
        }

        const targetEmail = dbUser.email || `${dbUser.username}@schoolsphere.xyz`;
        // Trigger Supabase client-side recovery email
        try {
          await supabase.auth.resetPasswordForEmail(targetEmail, {
            redirectTo: `${window.location.origin}/auth/reset-password`
          });
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Client Supabase auth lookup notice:", e);
    }

    // 2. Call authoritative backend API to generate secure reset link and code
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanInput, username: cleanInput })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to process forgot password request.");
    }

    return data;
  },

  resetPassword: async (params: { token?: string; code?: string; email?: string; username?: string; newPassword: string }) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to reset password.");
    }

    return data;
  }
};

// ==========================================
// 11. LICENSE CODES & APP-DRIVEN EMAIL API
// ==========================================
export const licenseCodesApi = {
  sendLicense: async (payload: {
    to?: string;
    email?: string;
    userId?: string;
    schoolName?: string;
    recipientName?: string;
    tier?: string;
  }) => {
    const res = await fetch('/api/send-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || (!data.ok && !data.success)) {
      throw new Error(data.error || 'Failed to generate and send license code');
    }
    return data;
  },

  signup: async (payload: {
    email: string;
    password?: string;
    fullName?: string;
    schoolName?: string;
    tier?: string;
    role?: string;
  }) => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || (!data.ok && !data.success)) {
      throw new Error(data.error || 'Failed to complete signup');
    }
    return data;
  },

  verifyCode: async (payload: {
    license_code: string;
    email?: string;
    userId?: string;
  }) => {
    const res = await fetch('/api/license/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || (!data.ok && !data.success)) {
      throw new Error(data.error || 'Invalid or unverified license code');
    }
    return data;
  },

  resendCode: async (payload: {
    email: string;
    userId?: string;
    schoolName?: string;
    fullName?: string;
  }) => {
    const res = await fetch('/api/license/resend-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || (!data.ok && !data.success)) {
      throw new Error(data.error || 'Failed to resend license code');
    }
    return data;
  },

  testSmtp: async (payload?: {
    to?: string;
    customHost?: string;
    customPort?: number;
    customUser?: string;
    customPass?: string;
    customFrom?: string;
  }) => {
    const res = await fetch('/api/email/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to send test email');
    }
    return data;
  }
};


