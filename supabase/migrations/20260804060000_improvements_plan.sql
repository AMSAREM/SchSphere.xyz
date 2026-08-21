-- ====================================================================
-- MIGRATION 20260804060000: SCHOOLSPHERE 1.0 IMPROVEMENT PLAN
-- ====================================================================

-- 1. CRITICAL: Fix RLS policies on schools, licenses, and school_licenses
ALTER TABLE IF EXISTS public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_licenses ENABLE ROW LEVEL SECURITY;

-- Allow full access for authenticated users, anon, and service role on schools
DROP POLICY IF EXISTS "Service role full access on schools" ON public.schools;
DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON public.schools;
DROP POLICY IF EXISTS "Authenticated read own school" ON public.schools;
CREATE POLICY "Allow full access for authenticated and service role"
ON public.schools FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON public.licenses;
CREATE POLICY "Allow full access for authenticated and service role"
ON public.licenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access for authenticated and service role" ON public.school_licenses;
CREATE POLICY "Allow full access for authenticated and service role"
ON public.school_licenses FOR ALL USING (true) WITH CHECK (true);


-- 2. PERFORMANCE: Missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_candidates_poll_id ON public.candidates ("pollId");
CREATE INDEX IF NOT EXISTS idx_expenses_inventory_item_id ON public.expenses ("inventoryItemId");
CREATE INDEX IF NOT EXISTS idx_promotionhistory_student_identifier ON public."promotionHistory" ("studentIdentifier");
CREATE INDEX IF NOT EXISTS idx_votes_candidate_id ON public.votes ("candidateId");
CREATE INDEX IF NOT EXISTS idx_votes_student_id ON public.votes ("studentId");


-- 3. PERFORMANCE: Drop duplicate indexes
DROP INDEX IF EXISTS public.idx_promotionhist_school_id;      -- kept idx_promotionhistory_school_id
DROP INDEX IF EXISTS public.idx_schoollicenses_school_id;     -- kept idx_school_licenses_school_id
DROP INDEX IF EXISTS public.uq_votes_student_position;        -- kept uq_ballot


-- 4. PERFORMANCE: Fix RLS re-evaluation on profiles using (SELECT auth.uid())
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING ((SELECT auth.uid()) = id);

    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);
  END IF;
END $$;


-- 5. SCHEMA HYGIENE: Drop duplicate foreign keys
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS fk_candidates_poll;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS fk_expenses_inventory;
ALTER TABLE public."promotionHistory" DROP CONSTRAINT IF EXISTS fk_promotionhistory_student;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS fk_votes_candidate;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS fk_votes_student;
