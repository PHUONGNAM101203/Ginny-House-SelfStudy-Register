-- (1) create_registration now notifies staff on a successful GUEST
-- self-booking (admin-created bookings skip this — the admin already knows,
-- they just made it themselves). Body includes date/time so the toast/bell
-- is useful without opening the calendar.
--
-- (2) review_registration_change now deletes its own pending-request
-- notification once resolved (approved or rejected) — dedupe_key already
-- stores 'change_request:<request_id>' (migration 0006), so no new column
-- is needed to find it. This is the "auto xoá khi hành động đã được thực
-- hiện" case: once admin acts on the request, the "there's a pending
-- request" notice is stale by definition.
--
-- Both redefinitions are otherwise byte-identical to their prior versions
-- (0005/0006) — only the noted insert/delete is new.

create or replace function create_registration(
  p_desk_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_full_name text,
  p_phone text,
  p_class_name text default null,
  p_is_recurring boolean default false,
  p_admin_created boolean default false,
  p_zalo_contact text default null
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
    status, source, student_name, class_name, zalo_contact, created_by
  ) values (
    v_student_id, v_branch_id, p_desk_id, p_date, p_start_time, p_end_time,
    'active',
    case when p_admin_created then 'admin_manual'::registration_source else 'guest_self'::registration_source end,
    p_full_name,
    p_class_name,
    p_zalo_contact,
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

  if not p_admin_created then
    insert into notifications (type, title, body, link, target_role)
    values (
      'registration_created',
      'Đăng ký lịch mới',
      p_full_name || case when p_class_name is not null then ' · ' || p_class_name else '' end
        || ' — ' || to_char(p_date, 'DD/MM') || ' ' || to_char(p_start_time, 'HH24:MI') || '-' || to_char(p_end_time, 'HH24:MI'),
      '/noi-bo/lich',
      null
    );
  end if;

  return v_registration;
end;
$$;

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
    delete from notifications where dedupe_key = 'change_request:' || p_request_id;
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

  delete from notifications where dedupe_key = 'change_request:' || p_request_id;
end;
$$;

grant execute on function create_registration to anon, authenticated;
grant execute on function review_registration_change to authenticated;
