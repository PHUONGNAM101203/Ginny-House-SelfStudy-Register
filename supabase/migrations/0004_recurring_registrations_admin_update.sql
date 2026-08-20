-- Deactivating a recurring registration ("Huỷ lịch cố định").
--
-- 0001_init.sql only ever gave recurring_registrations a SELECT policy
-- (recurring_registrations_staff_select) and 0002 only granted SELECT to
-- `authenticated`, so once a recurring rule was created there was no way to
-- release it short of direct DB access: the slot stayed reserved forever and
-- kept re-materializing every week.
--
-- Kept deliberately narrow:
--   * a column-level grant, so `authenticated` can only ever write `active` —
--     never the student, desk, branch, day or times of an existing rule;
--   * an RLS policy gated on is_admin(), so quan_sinh staff (who pass is_staff()
--     for the read policy) still cannot deactivate anything.
grant update (active) on recurring_registrations to authenticated;

create policy recurring_registrations_admin_update on recurring_registrations
  for update using (is_admin()) with check (is_admin());
