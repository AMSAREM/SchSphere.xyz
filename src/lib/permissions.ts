/**
 * SchoolSphere 1.0 - Role-Based Access Control (RBAC) & Authorization Matrix
 * Provides granular permissions, role hierarchies, and module-level access rules.
 */

export type UserRole =
  | 'super_admin'
  | 'creator'
  | 'admin'
  | 'headteacher'
  | 'teacher'
  | 'accountant'
  | 'student'
  | 'parent';

export type AppPermission =
  // Dashboard & Overview
  | 'dashboard:view'
  | 'analytics:view'

  // Student Management
  | 'students:view'
  | 'students:create'
  | 'students:edit'
  | 'students:delete'
  | 'students:export'

  // Academic & Curriculum
  | 'academic:view'
  | 'academic:manage_classes'
  | 'academic:manage_subjects'
  | 'academic:manage_teachers'

  // Timetable
  | 'timetable:view'
  | 'timetable:manage'

  // Attendance
  | 'attendance:view'
  | 'attendance:mark'
  | 'attendance:export'

  // Results & Grading
  | 'results:view'
  | 'results:record'
  | 'results:edit'
  | 'results:publish'
  | 'exam_analysis:view'
  | 'exam_analysis:manage'

  // Report Cards & Terminal Reports
  | 'reports:view'
  | 'reports:generate'
  | 'reports:sign'

  // Fees & Financials
  | 'fees:view'
  | 'fees:record_payment'
  | 'fees:manage_structure'
  | 'fees:export'

  // Siren & Intercom System
  | 'siren:view'
  | 'siren:trigger'
  | 'siren:manage_audio'

  // E-Voting
  | 'evoting:view'
  | 'evoting:vote'
  | 'evoting:manage_polls'

  // Inventory
  | 'inventory:view'
  | 'inventory:manage'

  // Security & User Administration
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:toggle_status'
  | 'users:reset_password'
  | 'users:delete'

  // System & School Configuration
  | 'settings:view'
  | 'settings:edit_school_profile'
  | 'settings:academic_year'
  | 'settings:database_sync'

  // Multi-Tenancy & Platform Control
  | 'platform:manage_schools'
  | 'platform:manage_licenses'
  | 'platform:creator_console'
  | 'platform:audit_logs';

export interface RoleDefinition {
  role: UserRole;
  name: string;
  category: 'Platform Leadership' | 'School Administration' | 'Instructional Staff' | 'Finance' | 'Community';
  description: string;
  badgeColor: {
    bg: string;
    text: string;
    border: string;
    iconColor: string;
  };
  permissions: AppPermission[];
  allowedModules: string[];
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  super_admin: {
    role: 'super_admin',
    name: 'Super Administrator',
    category: 'Platform Leadership',
    description: 'Complete unrestricted platform and multi-tenant administrative authority across all registered schools, licenses, and databases.',
    badgeColor: {
      bg: 'bg-purple-100 dark:bg-purple-950/50',
      text: 'text-purple-800 dark:text-purple-300',
      border: 'border-purple-300 dark:border-purple-800',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    permissions: [
      'dashboard:view', 'analytics:view',
      'students:view', 'students:create', 'students:edit', 'students:delete', 'students:export',
      'academic:view', 'academic:manage_classes', 'academic:manage_subjects', 'academic:manage_teachers',
      'timetable:view', 'timetable:manage',
      'attendance:view', 'attendance:mark', 'attendance:export',
      'results:view', 'results:record', 'results:edit', 'results:publish', 'exam_analysis:view', 'exam_analysis:manage',
      'reports:view', 'reports:generate', 'reports:sign',
      'fees:view', 'fees:record_payment', 'fees:manage_structure', 'fees:export',
      'siren:view', 'siren:trigger', 'siren:manage_audio',
      'evoting:view', 'evoting:vote', 'evoting:manage_polls',
      'inventory:view', 'inventory:manage',
      'users:view', 'users:create', 'users:edit', 'users:toggle_status', 'users:reset_password', 'users:delete',
      'settings:view', 'settings:edit_school_profile', 'settings:academic_year', 'settings:database_sync',
      'platform:manage_schools', 'platform:manage_licenses', 'platform:creator_console', 'platform:audit_logs'
    ],
    allowedModules: [
      'dashboard', 'students', 'academic', 'timetable', 'attendance', 'results',
      'exam_analysis', 'reports', 'fees', 'siren', 'evoting', 'inventory',
      'users', 'settings', 'creator', 'school_management'
    ]
  },
  creator: {
    role: 'creator',
    name: 'Platform Creator',
    category: 'Platform Leadership',
    description: 'System creator with master debugging authority, license generation, school onboarding, and direct runtime overrides.',
    badgeColor: {
      bg: 'bg-indigo-100 dark:bg-indigo-950/50',
      text: 'text-indigo-800 dark:text-indigo-300',
      border: 'border-indigo-300 dark:border-indigo-800',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    permissions: [
      'dashboard:view', 'analytics:view',
      'students:view', 'students:create', 'students:edit', 'students:delete', 'students:export',
      'academic:view', 'academic:manage_classes', 'academic:manage_subjects', 'academic:manage_teachers',
      'timetable:view', 'timetable:manage',
      'attendance:view', 'attendance:mark', 'attendance:export',
      'results:view', 'results:record', 'results:edit', 'results:publish', 'exam_analysis:view', 'exam_analysis:manage',
      'reports:view', 'reports:generate', 'reports:sign',
      'fees:view', 'fees:record_payment', 'fees:manage_structure', 'fees:export',
      'siren:view', 'siren:trigger', 'siren:manage_audio',
      'evoting:view', 'evoting:vote', 'evoting:manage_polls',
      'inventory:view', 'inventory:manage',
      'users:view', 'users:create', 'users:edit', 'users:toggle_status', 'users:reset_password', 'users:delete',
      'settings:view', 'settings:edit_school_profile', 'settings:academic_year', 'settings:database_sync',
      'platform:manage_schools', 'platform:manage_licenses', 'platform:creator_console', 'platform:audit_logs'
    ],
    allowedModules: [
      'dashboard', 'students', 'academic', 'timetable', 'attendance', 'results',
      'exam_analysis', 'reports', 'fees', 'siren', 'evoting', 'inventory',
      'users', 'settings', 'creator', 'school_management'
    ]
  },
  admin: {
    role: 'admin',
    name: 'School Administrator / Headmaster',
    category: 'School Administration',
    description: 'Principal / Head Administrator of the active school institution with full authority over student records, academic structure, staff, finances, and settings.',
    badgeColor: {
      bg: 'bg-blue-100 dark:bg-blue-950/50',
      text: 'text-blue-800 dark:text-blue-300',
      border: 'border-blue-300 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    permissions: [
      'dashboard:view', 'analytics:view',
      'students:view', 'students:create', 'students:edit', 'students:delete', 'students:export',
      'academic:view', 'academic:manage_classes', 'academic:manage_subjects', 'academic:manage_teachers',
      'timetable:view', 'timetable:manage',
      'attendance:view', 'attendance:mark', 'attendance:export',
      'results:view', 'results:record', 'results:edit', 'results:publish', 'exam_analysis:view', 'exam_analysis:manage',
      'reports:view', 'reports:generate', 'reports:sign',
      'fees:view', 'fees:record_payment', 'fees:manage_structure', 'fees:export',
      'siren:view', 'siren:trigger', 'siren:manage_audio',
      'evoting:view', 'evoting:vote', 'evoting:manage_polls',
      'inventory:view', 'inventory:manage',
      'users:view', 'users:create', 'users:edit', 'users:toggle_status', 'users:reset_password',
      'settings:view', 'settings:edit_school_profile', 'settings:academic_year', 'settings:database_sync'
    ],
    allowedModules: [
      'dashboard', 'students', 'academic', 'timetable', 'attendance', 'results',
      'exam_analysis', 'reports', 'fees', 'siren', 'evoting', 'inventory',
      'users', 'settings'
    ]
  },
  headteacher: {
    role: 'headteacher',
    name: 'Head Teacher / Vice Principal',
    category: 'School Administration',
    description: 'Supervises academic schedules, attendance verification, exam grading, report card approvals, and staff timetables.',
    badgeColor: {
      bg: 'bg-teal-100 dark:bg-teal-950/50',
      text: 'text-teal-800 dark:text-teal-300',
      border: 'border-teal-300 dark:border-teal-800',
      iconColor: 'text-teal-600 dark:text-teal-400'
    },
    permissions: [
      'dashboard:view', 'analytics:view',
      'students:view', 'students:create', 'students:edit', 'students:export',
      'academic:view', 'academic:manage_classes', 'academic:manage_subjects', 'academic:manage_teachers',
      'timetable:view', 'timetable:manage',
      'attendance:view', 'attendance:mark', 'attendance:export',
      'results:view', 'results:record', 'results:edit', 'results:publish', 'exam_analysis:view', 'exam_analysis:manage',
      'reports:view', 'reports:generate', 'reports:sign',
      'fees:view',
      'siren:view', 'siren:trigger',
      'evoting:view', 'evoting:vote',
      'inventory:view',
      'settings:view'
    ],
    allowedModules: [
      'dashboard', 'students', 'academic', 'timetable', 'attendance', 'results',
      'exam_analysis', 'reports', 'fees', 'siren', 'evoting', 'inventory',
      'settings'
    ]
  },
  teacher: {
    role: 'teacher',
    name: 'Teacher / Instructor',
    category: 'Instructional Staff',
    description: 'Manages classroom student rosters, marks daily attendance, inputs assessment scores, enters remarks, and views timetables.',
    badgeColor: {
      bg: 'bg-emerald-100 dark:bg-emerald-950/50',
      text: 'text-emerald-800 dark:text-emerald-300',
      border: 'border-emerald-300 dark:border-emerald-800',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    permissions: [
      'dashboard:view',
      'students:view',
      'academic:view',
      'timetable:view',
      'attendance:view', 'attendance:mark',
      'results:view', 'results:record', 'results:edit', 'exam_analysis:view',
      'reports:view', 'reports:generate',
      'siren:view', 'siren:trigger',
      'settings:view'
    ],
    allowedModules: [
      'dashboard', 'students', 'timetable', 'attendance', 'results',
      'exam_analysis', 'reports', 'siren', 'settings'
    ]
  },
  accountant: {
    role: 'accountant',
    name: 'Bursar / Accountant',
    category: 'Finance',
    description: 'Specialized financial operator responsible for billing, fee collections, invoice receipts, student payment tracking, and school inventory logs.',
    badgeColor: {
      bg: 'bg-amber-100 dark:bg-amber-950/50',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-300 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400'
    },
    permissions: [
      'dashboard:view',
      'students:view',
      'fees:view', 'fees:record_payment', 'fees:manage_structure', 'fees:export',
      'reports:view',
      'inventory:view', 'inventory:manage'
    ],
    allowedModules: [
      'dashboard', 'students', 'fees', 'reports', 'inventory'
    ]
  },
  student: {
    role: 'student',
    name: 'Student',
    category: 'Community',
    description: 'Enrolled student view for accessing personal timetable, terminal report cards, exam performance analysis, fee statement, and participating in school elections.',
    badgeColor: {
      bg: 'bg-sky-100 dark:bg-sky-950/50',
      text: 'text-sky-800 dark:text-sky-300',
      border: 'border-sky-300 dark:border-sky-800',
      iconColor: 'text-sky-600 dark:text-sky-400'
    },
    permissions: [
      'dashboard:view',
      'timetable:view',
      'results:view',
      'exam_analysis:view',
      'reports:view',
      'fees:view',
      'evoting:view', 'evoting:vote'
    ],
    allowedModules: [
      'dashboard', 'timetable', 'results', 'exam_analysis', 'reports', 'fees', 'evoting'
    ]
  },
  parent: {
    role: 'parent',
    name: 'Parent / Guardian',
    category: 'Community',
    description: 'Family portal for monitoring child attendance, performance reports, grade history, and making online fee payments.',
    badgeColor: {
      bg: 'bg-rose-100 dark:bg-rose-950/50',
      text: 'text-rose-800 dark:text-rose-300',
      border: 'border-rose-300 dark:border-rose-800',
      iconColor: 'text-rose-600 dark:text-rose-400'
    },
    permissions: [
      'dashboard:view',
      'timetable:view',
      'attendance:view',
      'results:view',
      'reports:view',
      'fees:view', 'fees:record_payment'
    ],
    allowedModules: [
      'dashboard', 'timetable', 'attendance', 'results', 'reports', 'fees'
    ]
  }
};

/**
 * Check if a given user role has a specific permission capability.
 */
export function hasPermission(role: UserRole | string | undefined, permission: AppPermission): boolean {
  if (!role) return false;
  const def = ROLE_DEFINITIONS[role as UserRole];
  if (!def) return false;
  return def.permissions.includes(permission);
}

/**
 * Check if a role can access a module based on role rules AND school active license modules.
 */
export function canAccessModule(
  role: UserRole | string | undefined,
  moduleId: string,
  activeLicenseModules?: string[]
): boolean {
  if (!role) return false;
  const def = ROLE_DEFINITIONS[role as UserRole];
  if (!def) return false;

  // 1. Check if the role is allowed to view this module
  const isRoleAllowed = def.allowedModules.includes(moduleId);
  if (!isRoleAllowed) return false;

  // 2. Core modules are always accessible if role allows
  const CORE_MODULES = ['dashboard', 'settings', 'users', 'creator', 'school_management'];
  if (CORE_MODULES.includes(moduleId)) return true;

  // 3. For academic / feature modules, check if active on the school's license
  if (activeLicenseModules && activeLicenseModules.length > 0) {
    return activeLicenseModules.includes(moduleId);
  }

  return true;
}

/**
 * Get all permissions assigned to a role.
 */
export function getRolePermissions(role: UserRole | string | undefined): AppPermission[] {
  if (!role) return [];
  const def = ROLE_DEFINITIONS[role as UserRole];
  return def ? def.permissions : [];
}

/**
 * Get display metadata for a user role.
 */
export function getRoleInfo(role: UserRole | string | undefined): RoleDefinition {
  if (!role || !ROLE_DEFINITIONS[role as UserRole]) {
    return ROLE_DEFINITIONS.teacher;
  }
  return ROLE_DEFINITIONS[role as UserRole];
}
