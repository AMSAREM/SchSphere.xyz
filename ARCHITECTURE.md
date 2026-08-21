# SchoolSphere 1.0 - Full-Stack Design Architecture & Database Blueprint

## 1. Executive Summary & Design Architecture

**SchoolSphere 1.0** is an enterprise-grade, multi-tenant School Information & Management SaaS platform engineered for primary, secondary, and tertiary academic institutions. It operates on a **hybrid offline-first client architecture** synchronized in real-time with a secure **Supabase (PostgreSQL 15+) cloud backend**.

```
+-------------------------------------------------------------------------------+
|                             CLIENT-SIDE LAYER                                 |
|                                                                               |
|  +-------------------+  +-------------------+  +---------------------------+  |
|  | React 18 + Vite   |  | Lucide Icons      |  | Motion animations         |  |
|  | Tailwind CSS      |  | Recharts / D3.js  |  | Multi-Tenant Contexts     |  |
|  +-------------------+  +-------------------+  +---------------------------+  |
|                                     │                                         |
|                                     ▼                                         |
|                  +─────────────────────────────────────+                      |
|                  |     Dexie.js (IndexedDB Cache)      |                      |
|                  |  100% Offline-First Zero Latency    |                      |
|                  +─────────────────────────────────────+                      |
+─────────────────────────────────────┬─────────────────────────────────────────+
                                      │ HTTP / REST / Realtime Sync
                                      ▼
+───────────────────────────────────────────────────────────────────────────────+
|                         APPLICATION SERVER (Express.js)                       |
|                                                                               |
|  +---------------------+  +----------------------+  +----------------------+  |
|  | 3-Step Registration |  | License Verification |  | Automated Sync Logs  |  |
|  | Handshake Engine    |  | & Active Module ACL  |  | & Integrity Scrubber |  |
|  +---------------------+  +----------------------+  +----------------------+  |
+─────────────────────────────────────┬─────────────────────────────────────────+
                                      │ PostgreSQL Wire / Supabase Client
                                      ▼
+───────────────────────────────────────────────────────────────────────────────+
|                    CLOUD DATABASE (Supabase PostgreSQL 15+)                   |
|                                                                               |
|  +─────────────────────────────────────────────────────────────────────────+  |
|  | Row Level Security (RLS) Policies on all 17 Tables                      |  |
|  | get_auth_school_id() & is_super_admin() Security Definers               |  |
|  +─────────────────────────────────────────────────────────────────────────+  |
|  | Foreign Key Constraints & Cascades (ON DELETE CASCADE / SET NULL)       |  |
|  | CHECK Constraints on Enums, Ranges, and Scores (0-100%)                 |  |
|  | B-Tree Indexes on (school_id, ...) for high-speed tenant partitioning  |  |
|  | Automated Triggers for set_updated_at_timestamp()                       |  |
|  +─────────────────────────────────────────────────────────────────────────+  |
+-------------------------------------------------------------------------------+
```

---

## 2. Architectural Pillars

### Pillar A: Offline-First Hybrid Persistence
- **Client Tier (Dexie.js / IndexedDB)**: Schools and educators in environments with intermittent internet can record daily attendance, enter exam marks, and register students with zero latency.
- **Background Cloud Synchronization (`src/lib/api.ts`)**: Changes recorded locally automatically attempt synchronization to Supabase when connectivity is present. In the event of network disruption, local state is preserved and synchronized when reconnected.

### Pillar B: Multi-Tenant Isolation
- Every core table contains a strict `school_id` foreign key referencing `public.schools(id)`.
- Multi-tenancy is enforced at three distinct layers:
  1. **Database Layer (RLS)**: PostgreSQL `ROW LEVEL SECURITY` verifies `school_id = get_auth_school_id()` on all queries.
  2. **API Client Layer (`src/lib/api.ts`)**: All queries automatically inject `.eq('school_id', currentSchoolId)`.
  3. **Server Route Layer (`server.ts`)**: Express endpoints validate tenant authentication headers and tenant tokens.

### Pillar C: 3-Step Atomic Registration Handshake
To prevent circular foreign key constraint violations (PostgreSQL error `23503`) between `schools` and `school_licenses`:
1. **Step 1**: Insert the `schools` tenant row with `license_id = null`.
2. **Step 2**: Insert the `school_licenses` row with `school_id = school.id` (`fk_school_licenses_school_id`).
3. **Step 3**: Update `schools` setting `license_id = license.id` (`schools_license_id_fkey`).

---

## 3. Master Database Entity Relationship Model (17 Interconnected Tables)

| # | Table Name | Purpose | Primary Key | Foreign Keys & Relations | Key Constraints & Validations |
|---|------------|---------|-------------|--------------------------|-------------------------------|
| 1 | `school_licenses` | Software license catalog & tiers | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(license_key)`, `CHECK(tier)`, `CHECK(active_status)` |
| 2 | `schools` | Tenant institution master | `id` (UUID) | `license_id -> school_licenses.id` | `UNIQUE(slug)`, `CHECK(status)` |
| 3 | `users` | User accounts & RBAC profiles | `id` (BIGSERIAL) | `school_id -> schools.id`, `auth_user_id -> auth.users.id` | `UNIQUE(school_id, username)`, `CHECK(role)` |
| 4 | `classes` | Class arms & levels | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(school_id, name)`, `CHECK(capacity > 0)` |
| 5 | `subjects` | Academic subject catalog | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(school_id, code)` |
| 6 | `teachers` | Faculty & staff directory | `id` (BIGSERIAL) | `school_id -> schools.id`, `user_id -> users.id` | `UNIQUE(school_id, staff_id)`, `CHECK(status)` |
| 7 | `students` | Student records & enrollment | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(school_id, student_id)`, `CHECK(gender)`, `CHECK(fees_paid >= 0)` |
| 8 | `attendance` | Daily student attendance logs | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(school_id, student_id, date)`, `CHECK(status)` |
| 9 | `results` | Academic grades & exam scores | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(school_id, student_id, subject, term, academic_year)`, `CHECK(scores 0-100)` |
| 10 | `term_reports` | End of term report cards & rank | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(school_id, student_id, term, academic_year)` |
| 11 | `fee_transactions` | Student fee payments & receipts | `id` (BIGSERIAL) | `school_id -> schools.id` | `UNIQUE(school_id, receipt_number)`, `CHECK(amount > 0)` |
| 12 | `exam_analysis` | National exam trends (BECE/WASSCE) | `id` (BIGSERIAL) | `school_id -> schools.id` | `CHECK(year >= 2000)`, `CHECK(exam_type)` |
| 13 | `polls` | E-Voting election definitions | `id` (BIGSERIAL) | `school_id -> schools.id` | `CHECK(status IN ('draft', 'active', 'completed'))` |
| 14 | `candidates` | Election candidates | `id` (BIGSERIAL) | `poll_id -> polls.id (CASCADE)` | `CHECK(votes_count >= 0)` |
| 15 | `votes` | Cast ballot records | `id` (BIGSERIAL) | `poll_id -> polls.id`, `candidate_id -> candidates.id` | `UNIQUE(poll_id, student_id, position)` (One vote per ballot) |
| 16 | `promotion_history`| Student transition audit ledger | `id` (BIGSERIAL) | `school_id -> schools.id` | Historical snapshots of class progression |
| 17 | `inventory_items` | School assets & physical stock | `id` (BIGSERIAL) | `school_id -> schools.id` | `CHECK(quantity >= 0)`, `CHECK(unit_price >= 0)` |
| 18 | `school_expenses` | Financial operational expenses | `id` (BIGSERIAL) | `school_id -> schools.id`, `inventory_item_id -> inventory_items.id` | `CHECK(amount > 0)` |
| 19 | `sms_logs` | Emergency siren & SMS logs | `id` (BIGSERIAL) | `school_id -> schools.id` | Status delivery tracking |
| 20 | `audit_logs` | Security & compliance logs | `id` (BIGSERIAL) | `school_id -> schools.id`, `user_id -> users.id` | Immutable security audit ledger |

---

## 4. Security Enforcement & Row-Level Security (RLS)

All tables strictly enforce PostgreSQL Row Level Security:
```sql
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for students" ON public.students
  FOR ALL USING (
    school_id = public.get_auth_school_id() 
    OR public.is_super_admin()
  );
```

### Security Definers
- `get_auth_school_id()` dynamically extracts the active tenant context directly from `public.users` matching `auth.uid()` or verified JWT app metadata.
- `is_super_admin()` grants master maintenance and creator hub access only to authenticated super administrators and backend service roles.
