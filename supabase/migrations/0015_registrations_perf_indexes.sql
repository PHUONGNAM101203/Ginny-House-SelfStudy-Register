-- Compute-tier audit (Micro, 1GB RAM/2-core shared) found two hot queries
-- doing a sequential scan on `registrations` with no supporting index —
-- confirmed via EXPLAIN ANALYZE locally (Seq Scan, ~180 rows), and this
-- scan cost grows linearly with total table size as real bookings
-- accumulate daily. Both queries already existed before this migration;
-- only the missing indexes are new.

-- getScheduleData (lib/schedule-data.ts) — runs on every guest AND staff
-- calendar page load (day + week views alike): filters by branch_id,
-- status='active', and a date range. The only existing index
-- (desk_id, date) doesn't help since this query has no desk_id predicate.
create index registrations_branch_date_idx on registrations (branch_id, date) where status = 'active';

-- Dashboard's occupancy/trend/frequency-ranking query (app/noi-bo/dashboard/page.tsx)
-- deliberately spans ALL branches (no branch_id filter) over an 8-week
-- window — the branch+date index above can't serve a query with no
-- branch_id predicate, so a separate date-only partial index is needed.
create index registrations_active_date_idx on registrations (date) where status = 'active';

-- getStudentHistoryAction (actions/students.ts) — admin viewing one
-- student's booking history, filtered by student_id alone. Lower traffic
-- (admin-only) than the two above, but the column has no index despite
-- being a foreign key — Postgres does not auto-index FK columns.
create index registrations_student_id_idx on registrations (student_id);
