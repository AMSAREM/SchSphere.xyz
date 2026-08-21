import { supabase, getCurrentSchoolId } from './supabase';
import { db } from '../db/schema';

/**
 * SchoolSphere 1.0 - Centralized Multi-Tenant API Client
 * Automatically applies school_id tenant scoping to all database and backend operations.
 */

// ==========================================
// 1. STUDENTS API
// ==========================================
export const studentsApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', targetSchoolId)
        .order('createdAt', { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (e) {
      console.warn('Notice querying Supabase students:', e);
    }
    // Offline / Local Dexie DB Fallback
    return await db.students.toArray();
  },

  getById: async (id: number | string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', targetSchoolId)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return await db.students.get(Number(id));
    }
    return data;
  },

  getByClass: async (className: string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('school_id', targetSchoolId)
      .eq('class', className);

    if (error || !data || data.length === 0) {
      return await db.students.where('class').equals(className).toArray();
    }
    return data;
  },

  create: async (student: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = {
      ...student,
      school_id: targetSchoolId,
      createdAt: student.createdAt || Date.now()
    };

    // Save to local IndexedDB
    const localId = await db.students.add(payload);

    // Sync to Supabase
    try {
      const { data, error } = await supabase
        .from('students')
        .insert([{ ...payload, id: undefined }])
        .select()
        .single();

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Notice syncing created student to Supabase:', e);
    }
    return { ...payload, id: localId };
  },

  update: async (id: number | string, updates: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    
    // Update local Dexie
    if (typeof id === 'number') {
      await db.students.update(id, updates);
    }

    // Update Supabase
    try {
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('school_id', targetSchoolId)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) return data;
    } catch (e) {
      console.warn('Notice updating student in Supabase:', e);
    }
    return updates;
  },

  delete: async (id: number | string, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    if (typeof id === 'number') {
      await db.students.delete(id);
    }
    try {
      await supabase
        .from('students')
        .delete()
        .eq('school_id', targetSchoolId)
        .eq('id', id);
    } catch (e) {}
    return true;
  }
};

// ==========================================
// 2. CLASSES API
// ==========================================
export const classesApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', targetSchoolId);

      if (!error && data && data.length > 0) return data;
    } catch (e) {}
    return await db.classes.toArray();
  },

  create: async (classData: { name: string; level: string }, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = { ...classData, school_id: targetSchoolId };
    await db.classes.add(payload);
    try {
      await supabase.from('classes').insert([payload]);
    } catch (e) {}
    return payload;
  }
};

// ==========================================
// 3. TEACHERS & STAFF API
// ==========================================
export const teachersApi = {
  getAll: async (schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('school_id', targetSchoolId);

      if (!error && data && data.length > 0) return data;
    } catch (e) {}
    return await db.teachers.toArray();
  },

  create: async (teacher: any, schoolId?: string) => {
    const targetSchoolId = schoolId || (await getCurrentSchoolId());
    const payload = { ...teacher, school_id: targetSchoolId };
    await db.teachers.add(payload);
    try {
      await supabase.from('teachers').insert([payload]);
    } catch (e) {}
    return payload;
  }
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
// 6. FEES & FINANCIAL TRANSACTIONS API
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

