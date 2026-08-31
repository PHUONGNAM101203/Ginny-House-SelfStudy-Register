-- New enum value in its own migration file, deliberately: `ALTER TYPE ...
-- ADD VALUE` cannot be used in the same transaction as a statement that
-- reads the new value (Postgres rejects it as "unsafe use of new value of
-- enum type"), and each migration file runs in one transaction — the RPC
-- that inserts a 'registration_created' row has to live in the next file.
alter type notification_type add value 'registration_created';

-- Manual "xoá thông báo" support (task: notification badge/delete) — staff
-- can dismiss a stale item from the shared feed the same way they can
-- already read it (notifications_staff_select/insert, migration 0006).
create policy notifications_staff_delete on notifications for delete using (is_staff());
grant delete on notifications to authenticated;
