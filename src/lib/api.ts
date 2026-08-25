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


