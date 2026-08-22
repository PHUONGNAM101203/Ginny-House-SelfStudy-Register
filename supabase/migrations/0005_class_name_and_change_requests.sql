-- Adds the class-name field Gin Anh asked for on every booking, plus the
-- "phiếu xin xoá + đổi lịch" request/approval workflow: a guest submits a
-- cancel-or-reschedule request (no exact name/phone match required — the
-- whole point is lower friction than the direct self-cancel path), an admin
-- reviews and approves/rejects it. Admin's own direct edit/cancel bypasses
-- this entirely (see cancel_registration's existing is_admin() branch).

alter table registrations add column class_name text;
alter table recurring_registrations add column class_name text;

-- Dropped first: CREATE OR REPLACE only replaces a function whose argument
-- *types* match exactly — inserting p_class_name into the middle of the
-- parameter list makes Postgres treat this as a brand-new overload instead,
-- leaving the old 8-arg version in place and making the later `grant
-- execute ... to anon, authenticated` (no arg-type list) ambiguous between
-- the two. Drop the exact original signature so only one survives.
drop function if exists create_registration(uuid, date, time, time, text, text, boolean, boolean);

create function create_registration(
  p_desk_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_full_name text,
  p_phone text,
  p_class_name text default null,
  p_is_recurring boolean default false,
  p_admin_created boolean default false
) returns registrations
language plpgsql security definer set search_path = public as $$
declare
  v_branch_id uuid;
  v_day_of_week smallint;
  v_student_id uuid;
  v_registration registrations;
  v_recurring_id uuid;
begin
  if p_admin_created and not is_admin() then
    raise exception 'Only admin can create registrations on behalf of a student';
  end if;

  select branch_id into v_branch_id from desks where id = p_desk_id and active;
  if v_branch_id is null then
    raise exception 'Desk not found or inactive';
  end if;

  v_day_of_week := extract(isodow from p_date);

  if exists (
    select 1 from slot_locks
    where active
      and branch_id = v_branch_id
      and (desk_id = p_desk_id or desk_id is null)
      and day_of_week = v_day_of_week
      and start_time < p_end_time
      and end_time > p_start_time
  ) then
    raise exception 'Slot is locked';
  end if;

  insert into students (full_name, phone)
  values (p_full_name, p_phone)
  on conflict (phone) do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_student_id;

  insert into registrations (
    student_id, branch_id, desk_id, date, start_time, end_time,
    status, source, student_name, class_name, created_by
  ) values (
    v_student_id, v_branch_id, p_desk_id, p_date, p_start_time, p_end_time,
    'active',
    case when p_admin_created then 'admin_manual'::registration_source else 'guest_self'::registration_source end,
    p_full_name,
    p_class_name,
    auth.uid()
  ) returning * into v_registration;

  if p_is_recurring then
    insert into recurring_registrations (
      student_id, branch_id, desk_id, day_of_week, start_time, end_time, student_name, class_name, created_by
    ) values (
      v_student_id, v_branch_id, p_desk_id, v_day_of_week, p_start_time, p_end_time, p_full_name, p_class_name, auth.uid()
    ) returning id into v_recurring_id;

    update registrations set recurring_registration_id = v_recurring_id where id = v_registration.id;
    v_registration.recurring_registration_id := v_recurring_id;
  end if;

  return v_registration;
end;
$$;

-- Also carry class_name into every future materialized week's rows, so a
-- recurring booking's class name survives past the week it was created in.
create or replace function materialize_recurring_registrations(p_week_start date)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  v_rule recurring_registrations%rowtype;
  v_date date;
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'p_week_start must be a Monday';
  end if;

  for v_rule in select * from recurring_registrations where active loop
    v_date := p_week_start + (v_rule.day_of_week - 1);

    if exists (
      select 1 from slot_locks
      where active
        and branch_id = v_rule.branch_id
        and (desk_id = v_rule.desk_id or desk_id is null)
        and day_of_week = v_rule.day_of_week
        and start_time < v_rule.end_time
        and end_time > v_rule.start_time
    ) then
      continue;
    end if;

    begin
      insert into registrations (
        student_id, branch_id, desk_id, date, start_time, end_time,
        status, source, student_name, class_name, recurring_registration_id
      ) values (
        v_rule.student_id, v_rule.branch_id, v_rule.desk_id, v_date, v_rule.start_time, v_rule.end_time,
        'active', 'recurring_auto', v_rule.student_name, v_rule.class_name, v_rule.id
      );
      v_count := v_count + 1;
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Change-request workflow
-- ---------------------------------------------------------------------------

create type change_request_kind as enum ('cancel', 'reschedule');
create type change_request_status as enum ('pending', 'approved', 'rejected');

create table registration_change_requests (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  kind change_request_kind not null,
  requested_by_name text not null,
  requested_by_phone text not null,
  reason text,
  -- New slot the guest would like instead — all optional, even for a
  -- 'reschedule' request (see request_registration_change): a guest may
  -- just describe what they want in `reason` and leave the exact new slot
  -- for admin to sort out.
  new_desk_id uuid references desks(id),
  new_date date,
  new_start_time time,
  new_end_time time,
  status change_request_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);

-- One live request per registration at a time — a second submit while one
-- is still pending would otherwise silently pile up duplicate work for admin.
create unique index registration_change_requests_one_pending_idx
  on registration_change_requests (registration_id) where status = 'pending';

alter table registration_change_requests enable row level security;

-- Staff-only read: unlike registrations (publicly viewable on the calendar),
-- a request row carries a phone number and free-text reason — no anon select.
create policy change_requests_staff_select on registration_change_requests for select using (is_staff());
create policy change_requests_admin_write on registration_change_requests for update using (is_admin()) with check (is_admin());

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

  return v_request;
end;
$$;

-- Admin-only. Approving a 'cancel' request cancels the registration exactly
-- like the existing admin branch of cancel_registration. Approving a
-- 'reschedule' request always cancels the old registration; if the guest
-- picked a specific new slot it also books that slot (reusing the same lock
-- check create_registration does — a slot that got locked or taken between
-- the request and the review is rejected here, same as any other booking
-- attempt). If no new slot was picked, only the cancel half happens — admin
-- rebooks the student manually afterward via the normal admin booking flow.
create or replace function review_registration_change(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_req registration_change_requests;
  v_reg registrations;
  v_new_branch_id uuid;
  v_new_day_of_week smallint;
begin
  if not is_admin() then
    raise exception 'Only admin can review change requests';
  end if;

  select * into v_req from registration_change_requests where id = p_request_id and status = 'pending';
  if v_req is null then
    raise exception 'Request not found or already reviewed';
  end if;

  if not p_approve then
    update registration_change_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = p_admin_note
    where id = p_request_id;
    return;
  end if;

  select * into v_reg from registrations where id = v_req.registration_id and status = 'active';
  if v_reg is null then
    raise exception 'Registration already cancelled';
  end if;

  update registrations set status = 'cancelled' where id = v_req.registration_id;

  if v_req.kind = 'reschedule' and v_req.new_desk_id is not null then
    select branch_id into v_new_branch_id from desks where id = v_req.new_desk_id and active;
    if v_new_branch_id is null then
      raise exception 'Requested desk not found or inactive';
    end if;

    v_new_day_of_week := extract(isodow from v_req.new_date);
    if exists (
      select 1 from slot_locks
      where active
        and branch_id = v_new_branch_id
        and (desk_id = v_req.new_desk_id or desk_id is null)
        and day_of_week = v_new_day_of_week
        and start_time < v_req.new_end_time
        and end_time > v_req.new_start_time
    ) then
      raise exception 'Requested slot is now locked';
    end if;

    insert into registrations (
      student_id, branch_id, desk_id, date, start_time, end_time,
      status, source, student_name, class_name, created_by
    ) values (
      v_reg.student_id, v_new_branch_id, v_req.new_desk_id, v_req.new_date, v_req.new_start_time, v_req.new_end_time,
      'active', 'admin_manual', v_reg.student_name, v_reg.class_name, auth.uid()
    );
  end if;

  update registration_change_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = p_admin_note
  where id = p_request_id;
end;
$$;

grant execute on function create_registration to anon, authenticated;
grant execute on function materialize_recurring_registrations to authenticated;
grant execute on function request_registration_change to anon, authenticated;
grant execute on function review_registration_change to authenticated;

-- No anon/authenticated select grant on purpose (see the RLS comment above)
-- — the client only ever reaches this table through the two RPCs, except
-- the admin review page's own listing query, which needs select.
grant select on registration_change_requests to authenticated;
grant select, insert, update, delete on registration_change_requests to service_role;
