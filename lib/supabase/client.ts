import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};

const supabaseUrl =
  env.VITE_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://niavmonyfwqlryppgksy.supabase.co';

const supabaseAnonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pYXZtb255ZndxbHJ5cHBna3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2OTg3MDIsImV4cCI6MjEwMTI3NDcwMn0.JtZL7wwDN48z6_8K5uK-RYK3CKNQx8a6N4Rfh50hX_U';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

/**
 * Get active school ID from localStorage or fallback default
 */
export function getActiveSchoolId(): string {
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
    // Ignore storage errors
  }
  return '00000000-0000-0000-0000-000000000001';
}

/**
 * Helper to apply school_id filter to Supabase queries
 */
export function withSchoolFilter(query: any, schoolId?: string) {
  const targetId = schoolId || getActiveSchoolId();
  if (targetId) {
    return query.eq('school_id', targetId);
  }
  return query;
}
