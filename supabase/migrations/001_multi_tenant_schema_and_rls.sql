-- =================================================================
-- SchoolSphere 1.0 - Multi-Tenant Database Schema & RLS Policies
-- =================================================================

-- 1. Schools Tenant Table
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  license_id BIGINT,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  theme TEXT DEFAULT 'indigo',
  academic_year TEXT DEFAULT '2026/2027',
  current_term TEXT DEFAULT 'Term 1',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- 2. Students Table with school_id isolation
CREATE TABLE IF NOT EXISTS public.students (
  id BIGSERIAL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  class TEXT NOT NULL,
  "dateOfBirth" TEXT,
  gender TEXT,
  "guardianName" TEXT,
  "guardianPhone" TEXT,
  "feesPaid" NUMERIC DEFAULT 0,
  "totalFees" NUMERIC DEFAULT 0,
  house TEXT,
  department TEXT,
  photo TEXT,
  "createdAt" BIGINT,
  "feeBreakdown" JSONB,
  "feePaidBreakdown" JSONB,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE
);

-- 3. Results Table with school_id isolation
CREATE TABLE IF NOT EXISTS public.results (
  id BIGSERIAL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  subject TEXT NOT NULL,
  term TEXT NOT NULL,
  class TEXT NOT NULL,
  "classScore" NUMERIC DEFAULT 0,
  "examScore" NUMERIC DEFAULT 0,
  "totalScore" NUMERIC DEFAULT 0,
  grade TEXT,
  remarks TEXT,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE
);

-- 4. Attendance Table with school_id isolation
CREATE TABLE IF NOT EXISTS public.attendance (
  id BIGSERIAL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE
);

-- 5. Enable Row-Level Security (RLS)
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 6. Row-Level Security Policies for Multi-Tenant Data Isolation
CREATE POLICY "Allow public select for active schools" ON public.schools
  FOR SELECT USING (status = 'active');

CREATE POLICY "Tenant isolation for students" ON public.students
  FOR ALL USING (
    school_id = (
      SELECT school_id FROM public.users 
      WHERE auth_user_id = auth.uid()
    ) OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant isolation for results" ON public.results
  FOR ALL USING (
    school_id = (
      SELECT school_id FROM public.users 
      WHERE auth_user_id = auth.uid()
    ) OR auth.role() = 'service_role'
  );

CREATE POLICY "Tenant isolation for attendance" ON public.attendance
  FOR ALL USING (
    school_id = (
      SELECT school_id FROM public.users 
      WHERE auth_user_id = auth.uid()
    ) OR auth.role() = 'service_role'
  );
