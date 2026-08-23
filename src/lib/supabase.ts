import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

export const supabaseUrl =
  env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : '') ||
  'https://niavmonyfwqlryppgksy.supabase.co';

export const supabaseAnonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY : '') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pYXZtb255ZndxbHJ5cHBna3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2OTg3MDIsImV4cCI6MjEwMTI3NDcwMn0.JtZL7wwDN48z6_8K5uK-RYK3CKNQx8a6N4Rfh50hX_U';

declare global {
  // eslint-disable-next-line no-var
  var __supabaseInstance: any;
}

export const supabase: any =
  globalThis.__supabaseInstance ||
  (globalThis.__supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }));



/**
 * Get active school ID for multi-tenant query filtering
 * Checks Supabase Auth User profile, then stored active session, with fallback
 */
export async function getCurrentSchoolId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: userData } = await supabase
        .from('users')
        .select('school_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (userData?.school_id) {
        return userData.school_id;
      }
    }
  } catch (e) {
    // Auth check fallback
  }

  try {
    const stored = localStorage.getItem('esepa_active_school');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.id) return parsed.id;
    }
    const license = localStorage.getItem('esepa_active_license');
    if (license) {
      const parsedLic = JSON.parse(license);
      if (parsedLic?.school_id) return parsedLic.school_id;
    }
  } catch (e) {
    // Storage fallback
  }

  return 'fca16e63-4259-4de7-aae1-8b4432ea0ea3'; // Default Primary School Sphere Tenant
}

/**
 * Get current active school profile
 */
export async function getCurrentSchool(): Promise<any> {
  const schoolId = await getCurrentSchoolId();
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .maybeSingle();

    if (!error && data) return data;
  } catch (e) {}

  try {
    const stored = localStorage.getItem('esepa_active_school');
    if (stored) return JSON.parse(stored);
  } catch (e) {}

  return {
    id: schoolId,
    name: 'School Sphere Academy',
    slug: 'school-sphere-academy',
    status: 'active'
  };
}

/**
 * Helper to apply school_id filter to Supabase queries
 */
export function withSchoolFilter(query: any, schoolId?: string) {
  const targetId = schoolId || 'fca16e63-4259-4de7-aae1-8b4432ea0ea3';
  return query.eq('school_id', targetId);
}

export default supabase;
