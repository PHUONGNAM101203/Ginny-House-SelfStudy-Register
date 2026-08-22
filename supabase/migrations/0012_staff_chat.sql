-- Internal admin ↔ quan_sinh chat — a single shared room (not paired DMs;
-- with just two roles and typically one account each, a shared room is
-- simpler than modeling per-pair conversations and scales fine if a second
-- quan_sinh account is ever added). Deliberately a separate table from
-- chat_messages rather than making chat_sessions.registration_id nullable —
-- that FK is meaningfully "which booking is this chat about", and a staff
-- room has no booking at all.
create table staff_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references profiles(id),
  -- Denormalized rather than joined against `profiles` when reading a
  -- message back out: profiles' own RLS (`id = auth.uid() OR is_admin()`,
  -- migration 0001) only lets a non-admin staff member see their OWN
  -- profile row, not a colleague's — quan_sinh reading admin's messages
  -- would silently fail to resolve a name. The sender already knows their
  -- own name at send time.
  sender_name text not null,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index staff_chat_messages_created_at_idx on staff_chat_messages (created_at);

alter table staff_chat_messages enable row level security;
create policy staff_chat_messages_staff_select on staff_chat_messages for select using (is_staff());
create policy staff_chat_messages_staff_insert on staff_chat_messages for insert with check (is_staff() and sender_profile_id = auth.uid());

grant select, insert on staff_chat_messages to authenticated;
grant select, insert, update, delete on staff_chat_messages to service_role;
