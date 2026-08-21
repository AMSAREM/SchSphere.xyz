-- =================================================================
-- SchoolSphere 1.0 - Core Multi-Tenant Schema: Schools & School Licenses
-- =================================================================

-- 1. Create School Licenses Table
CREATE TABLE IF NOT EXISTS public.school_licenses (
  id bigserial not null,
  license_key character varying(255) not null,
  school_name character varying(255) not null,
  expiry_date bigint null,
  active_status character varying(50) not null default 'active'::character varying,
  created_at bigint not null default (
    (
      EXTRACT(
        epoch
        from
          now()
      ) * (1000)::numeric
    )
  )::bigint,
  school_id uuid null,
  tier character varying(50) null default 'Standard'::character varying,
  active_modules jsonb null default '["students", "academic", "timetable", "attendance", "results", "reports", "fees"]'::jsonb,
  constraint school_licenses_pkey primary key (id),
  constraint school_licenses_license_key_key unique (license_key)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_school_licenses_school_name on public.school_licenses using btree (school_name) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_school_licenses_license_key on public.school_licenses using btree (license_key) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_school_licenses_school_id on public.school_licenses using btree (school_id) TABLESPACE pg_default;


-- 2. Create Schools Table
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid not null default gen_random_uuid (),
  name character varying(255) not null,
  slug character varying(255) not null,
  license_id bigint null,
  email character varying(255) null,
  phone character varying(50) null,
  address text null,
  logo_url text null,
  theme character varying(50) null default 'indigo'::character varying,
  academic_year character varying(50) null default '2026/2027'::character varying,
  current_term character varying(50) null default 'Term 1'::character varying,
  created_at bigint not null default (
    (
      EXTRACT(
        epoch
        from
          now()
      ) * (1000)::numeric
    )
  )::bigint,
  updated_at bigint not null default (
    (
      EXTRACT(
        epoch
        from
          now()
      ) * (1000)::numeric
    )
  )::bigint,
  status character varying(50) not null default 'active'::character varying,
  constraint schools_pkey primary key (id),
  constraint schools_slug_key unique (slug),
  constraint schools_license_id_fkey foreign KEY (license_id) references school_licenses (id) on delete set null,
  constraint schools_status_check check (
    (
      (status)::text = any (
        (
          array[
            'active'::character varying,
            'suspended'::character varying,
            'expired'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_schools_slug on public.schools using btree (slug) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_schools_license_id on public.schools using btree (license_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_schools_status on public.schools using btree (status) TABLESPACE pg_default;

-- Add foreign key from school_licenses to schools after schools table exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_school_licenses_school_id'
  ) THEN
    ALTER TABLE public.school_licenses 
    ADD CONSTRAINT fk_school_licenses_school_id 
    FOREIGN KEY (school_id) REFERENCES public.schools (id) ON DELETE SET NULL;
  END IF;
END $$;
