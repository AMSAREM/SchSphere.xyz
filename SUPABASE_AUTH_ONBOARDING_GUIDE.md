# SchoolSphere — Complete Supabase Auth & Multi-Tenant Onboarding Guide

This document summarizes the architecture, database migrations, Edge Function code, dashboard configurations, and testing workflows for **Supabase Auth + Row Level Security (RLS) + License Key Tenant Onboarding**.

---

## 1. Architecture Overview

### Why This Is the Best Approach
* **Single Source of Truth**: All authentication is delegated to `auth.users` via Supabase Auth (Magic Links / OTPs & Passwords).
* **Zero Custom Password Hashing**: Avoids storing plaintext passwords or custom hashes in `public.users.password_hash`.
* **Native RLS Protection**: Every authenticated request passes the Supabase JWT. Postgres functions (`auth.uid()`) automatically match tenant rows based on `public.users.school_id`.
* **Automated License Consumption**: Head Administrators activating institutional licenses are provisioned with `role = 'admin'` and bound directly to their `school_id`.

---

## 2. Postgres Schema & RLS Policies (SQL)

Execute this entire SQL script inside your **Supabase SQL Editor** to establish tenant isolation and user-to-auth mapping:

```sql
-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ensure Schools Tenant Table exists with RLS
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 3. Ensure School Licenses Table exists with RLS
CREATE TABLE IF NOT EXISTS public.school_licenses (
  id BIGSERIAL PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  tier TEXT DEFAULT 'Standard',
  duration_months INT DEFAULT 12,
  active_modules JSONB DEFAULT '["students","academic","attendance","results","fees"]'::jsonb,
  used BOOLEAN DEFAULT false,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.school_licenses ENABLE ROW LEVEL SECURITY;

-- 4. Establish public.users linked directly to auth.users.id
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('super_admin', 'admin', 'headteacher', 'teacher', 'accountant', 'student', 'parent')),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON public.users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 5. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS & POLICIES
-- =========================================================================

-- Helper: Retrieve current user's school_id from their auth JWT
CREATE OR REPLACE FUNCTION public.get_current_user_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper: Check if current user is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() AND role IN ('super_admin', 'creator')
  );
$$;

-- A) Policies for public.users
DROP POLICY IF EXISTS "Users can view self or peers in same school" ON public.users;
CREATE POLICY "Users can view self or peers in same school"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth.uid() = auth_user_id 
  OR school_id = public.get_current_user_school_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- B) Policies for public.schools
DROP POLICY IF EXISTS "Users can view assigned school" ON public.schools;
CREATE POLICY "Users can view assigned school"
ON public.schools
FOR SELECT
TO authenticated
USING (
  id = public.get_current_user_school_id()
  OR public.is_super_admin()
);

-- C) Generic Tenant Isolation Policy Pattern for School-Scoped Tables
-- (Apply to classes, subjects, teachers, students, attendance, results, fees, etc.)
/*
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for students"
ON public.students
FOR ALL
TO authenticated
USING (
  school_id = public.get_current_user_school_id()
  OR public.is_super_admin()
)
WITH CHECK (
  school_id = public.get_current_user_school_id()
  OR public.is_super_admin()
);
*/
```

---

## 3. Supabase Dashboard Setup Checklist

Complete these 3 configuration steps in your **Supabase Project Dashboard**:

### 1. Enable Email Provider & OTP / Magic Link
1. Go to **Authentication** → **Providers** → **Email**.
2. Ensure **Enable Email provider** is **ON**.
3. Ensure **Confirm email** is enabled (or configured per your workflow).

### 2. Configure Redirect URL Allowlist
1. Go to **Authentication** → **URL Configuration**.
2. In **Site URL**, set: `https://ai.studio/apps/a3dcbc82-0bbd-43c0-9bc8-6b9090159f51` (or your production domain).
3. In **Redirect URLs**, add:
   * `https://ai.studio/apps/a3dcbc82-0bbd-43c0-9bc8-6b9090159f51`
   * `https://www.schoolsphere.xyz`
   * `http://localhost:3000` (for local development)
4. Click **Save**.

### 3. Edge Function Secrets & Send Email Hook (Custom Resend Hook)
To customize and brand your Supabase Auth emails with **Resend** and **React Email**:
1. **Set Edge Function Secrets** in Supabase:
   * `RESEND_API_KEY`: Your Resend API key (`re_...`)
   * `SEND_EMAIL_HOOK_SECRET`: The webhook secret generated from the Auth Hooks dashboard (`v1,whsec_...`)
   * `SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
2. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy send-email --no-verify-jwt
   ```
3. **Configure Supabase Auth Hook**:
   * Go to **Authentication** → **Hooks** → **Send Email Hook**.
   * Select **HTTPS** (or Edge Function `send-email`).
   * Hook URL: `https://<your-project-ref>.supabase.co/functions/v1/send-email`
   * Copy the webhook secret into `SEND_EMAIL_HOOK_SECRET`.
   * Click **Save**.

The source code for this hook is located at `/supabase/functions/send-email/index.ts`.

---

## 4. Server-Side License Provisioning Logic

When a school head signs up with a license key, use this server-side flow (`service_role` client) to provision the account:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key allows admin operations
);

export async function provisionLicensedSchoolAdmin(params: {
  licenseKey: string;
  email: string;
  fullName?: string;
  schoolName?: string;
  redirectUrl?: string;
}) {
  const { licenseKey, email, fullName, schoolName, redirectUrl } = params;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Validate License Key
  const { data: license, error: licErr } = await supabaseAdmin
    .from('school_licenses')
    .select('*')
    .eq('license_key', licenseKey.trim().toUpperCase())
    .maybeSingle();

  if (licErr || !license) {
    throw new Error('Invalid or unrecognized license key.');
  }

  if (license.used) {
    throw new Error('This license key has already been activated.');
  }

  // 2. Create or Retrieve School Tenant
  let schoolId = license.school_id;
  if (!schoolId) {
    const { data: newSchool, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .insert([{
        name: (schoolName || license.school_name || 'My School').toUpperCase(),
        email: cleanEmail,
        status: 'active'
      }])
      .select()
      .single();

    if (schoolErr) throw schoolErr;
    schoolId = newSchool.id;
  }

  // 3. Create or Link Auth User in auth.users
  let authUserId: string;
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = userList?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

  if (existingUser) {
    authUserId = existingUser.id;
  } else {
    const { data: newAuth, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || 'Head Administrator',
        role: 'admin',
        school_id: schoolId
      }
    });
    if (authErr) throw authErr;
    authUserId = newAuth.user.id;
  }

  // 4. Insert or Upsert into public.users with role = 'admin'
  const username = cleanEmail.split('@')[0];
  const { data: publicUser, error: userErr } = await supabaseAdmin
    .from('users')
    .upsert([{
      auth_user_id: authUserId,
      email: cleanEmail,
      username: username,
      full_name: fullName || 'Head Administrator',
      role: 'admin',
      school_id: schoolId,
      status: 'active'
    }], { onConflict: 'auth_user_id' })
    .select()
    .single();

  if (userErr) throw userErr;

  // 5. Mark license as used
  await supabaseAdmin
    .from('school_licenses')
    .update({
      used: true,
      school_id: schoolId,
      activated_at: new Date().toISOString()
    })
    .eq('id', license.id);

  // 6. Trigger Magic Link to Admin's Inbox
  await supabaseAdmin.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      emailRedirectTo: redirectUrl || 'https://ai.studio/apps/a3dcbc82-0bbd-43c0-9bc8-6b9090159f51'
    }
  });

  return {
    success: true,
    schoolId,
    authUserId,
    publicUser
  };
}
```

---

## 5. Frontend Magic Link Trigger & Verification Steps

### Triggering the Magic Link from Client Code:
```typescript
import { supabase } from './lib/supabase';

export async function requestMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: 'https://ai.studio/apps/a3dcbc82-0bbd-43c0-9bc8-6b9090159f51',
      shouldCreateUser: true
    }
  });

  if (error) {
    throw error;
  }
  return { success: true };
}
```

### Verification Checklist:
1. **Trigger**: Navigate to the login portal and click **"Sign In with Passwordless Magic Link"**. Enter your email and click Send.
2. **Inbox**: Open the email received from Supabase / Resend and click the **"Sign In"** link.
3. **Landing**: The browser should open and redirect to:
   `https://ai.studio/apps/a3dcbc82-0bbd-43c0-9bc8-6b9090159f51`
4. **Session Hydration**: The app's `supabase.auth.onAuthStateChange` listener intercepts the session token, retrieves the linked `public.users` row matching `auth_user_id = auth.uid()`, and logs the user directly into their school dashboard.
