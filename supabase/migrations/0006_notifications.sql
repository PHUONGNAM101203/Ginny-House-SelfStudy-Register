-- In-app notification center for admin/quan_sinh: a persisted event log
-- (not a live-computed badge) so history survives past the moment the
-- triggering state changes — e.g. a "missing this week" notice stays in the
-- list even after the student registers.

create type notification_type as enum ('change_request_pending', 'missing_registration_weekly');

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type notification_type not null,
  title text not null,
  body text,
  link text,
  -- null = visible to every internal role (admin + quan_sinh); a specific
  -- role restricts it (e.g. change-request review is admin-only action, so
  -- only admin gets that notification).
  target_role user_role,
  -- Lets an event source upsert idempotently instead of re-notifying on
  -- every recomputation (e.g. 'missing:<student_id>:<week_monday>' so
  -- revisiting the dashboard mid-week doesn't duplicate the same notice).
  dedupe_key text,
  created_at timestamptz not null default now()
);

-- Not a partial index: Postgres already allows multiple NULLs in a plain
-- unique index (NULL <> NULL), and a partial index's WHERE predicate would
-- have to be repeated verbatim in every ON CONFLICT clause that targets it —
-- something supabase-js's .upsert({onConflict}) has no way to express.
create unique index notifications_dedupe_key_idx on notifications (dedupe_key);
create index notifications_created_at_idx on notifications (created_at desc);

alter table notifications enable row level security;
create policy notifications_staff_select on notifications for select using (is_staff());
create policy notifications_staff_insert on notifications for insert with check (is_staff());

-- Per-profile read tracking, separate from the notification row itself since
-- a broadcast notification (target_role null) is read independently by each
-- of admin and quan_sinh.
create table notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, profile_id)
);

alter table notification_reads enable row level security;
create policy notification_reads_own_select on notification_reads for select using (profile_id = auth.uid());
create policy notification_reads_own_insert on notification_reads for insert with check (profile_id = auth.uid());

grant select, insert on notifications to authenticated;
grant select, insert on notification_reads to authenticated;
grant select, insert, update, delete on notifications to service_role;
grant select, insert, update, delete on notification_reads to service_role;

-- Change requests already run through this SECURITY DEFINER RPC (anon can
-- call it), so it bypasses notifications' RLS the same way it already
-- bypasses registration_change_requests' RLS — no separate grant needed for
-- the anon path, just the insert itself.
create or replace function request_registration_change(
  p_registration_id uuid,
  p_kind change_request_kind,
  p_requested_by_name text,
  p_requested_by_phone text,
  p_reason text default null,
  p_new_desk_id uuid default null,
  p_new_date date default null,
  p_new_start_time time default null,
  p_new_end_time time default null
) returns registration_change_requests
language plpgsql security definer set search_path = public as $$
declare
  v_reg registrations;
  v_request registration_change_requests;
begin
  select * into v_reg from registrations where id = p_registration_id and status = 'active';
  if v_reg is null then
    raise exception 'Registration not found or already cancelled';
  end if;

  insert into registration_change_requests (
    registration_id, kind, requested_by_name, requested_by_phone, reason,
    new_desk_id, new_date, new_start_time, new_end_time
  ) values (
    p_registration_id, p_kind, p_requested_by_name, p_requested_by_phone, p_reason,
    p_new_desk_id, p_new_date, p_new_start_time, p_new_end_time
  ) returning * into v_request;

  insert into notifications (type, title, body, link, target_role, dedupe_key)
  values (
    'change_request_pending',
    case when p_kind = 'cancel' then 'Yêu cầu huỷ lịch mới' else 'Yêu cầu đổi lịch mới' end,
    v_reg.student_name || case when v_reg.class_name is not null then ' · ' || v_reg.class_name else '' end,
    '/noi-bo/quan-ly/yeu-cau-doi-lich',
    'admin',
    'change_request:' || v_request.id
  );

  return v_request;
end;
$$;
