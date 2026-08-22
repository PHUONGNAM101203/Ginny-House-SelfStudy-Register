-- migration 0007 granted chat_sessions/chat_messages select to
-- `authenticated` (used by the staff inbox page and RLS-gated reads) but
-- missed the service_role grant that 0006's notifications table got —
-- service_role bypasses RLS but still needs the underlying table privilege
-- to read/write at all. Without this, any service-role tooling against
-- these tables fails with "permission denied for table chat_messages".
grant select, insert, update, delete on chat_sessions to service_role;
grant select, insert, update, delete on chat_messages to service_role;
