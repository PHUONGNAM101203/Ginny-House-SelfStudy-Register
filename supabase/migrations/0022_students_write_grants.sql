-- Two write paths in the admin UI have been failing with "permission denied
-- for table ..." — a GRANT problem, not an RLS one, so no policy would have
-- fixed it on its own.
--
-- students only ever had SELECT granted to `authenticated` and a single
-- SELECT policy, because every write went through a SECURITY DEFINER RPC
-- (create_student_admin, import_students_admin). The later "sửa / xoá học
-- sinh" buttons went straight at the table instead, so neither has ever
-- worked. Reported live: deleting a student whose bookings were all
-- cancelled still refused.
--
-- recurring_registrations is the subtler one: migration 0004 added an UPDATE
-- *policy* but never the matching UPDATE *grant*, so the policy has been
-- guarding a door nobody could reach. That is the table
-- deactivateRecurringRegistrationAction writes to when an admin turns a lịch
-- cố định off from the Học sinh page.
--
-- RLS still does the real restricting: the grants open the table to
-- `authenticated` generally, and is_admin() in the policies narrows it to
-- admins. quan_sinh gets no write path from either.

grant update, delete on students to authenticated;

create policy students_admin_update on students
  for update using (is_admin()) with check (is_admin());

create policy students_admin_delete on students
  for delete using (is_admin());

grant update on recurring_registrations to authenticated;
