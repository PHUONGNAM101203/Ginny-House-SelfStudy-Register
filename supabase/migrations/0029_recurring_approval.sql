-- Lịch cố định holds a desk every week for months, so it should be the
-- centre's decision, not a checkbox a guest ticks on the way out. A guest
-- asking for one now creates the rule as pending: the slot they picked for
-- this week still stands, but nothing repeats until an admin approves.
--
-- Admin-created recurring schedules are approved on creation — the admin IS
-- the approval.
alter table recurring_registrations
  add column approved boolean not null default true;

-- Only approved rules hold future weeks. A pending rule that materialised
-- would defeat the whole point: it would reserve the desk for months while
-- the request was still a request.
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

  for v_rule in select * from recurring_registrations where active and approved loop
    v_date := p_week_start + (v_rule.day_of_week - 1);

    if v_rule.start_date is not null and v_date < v_rule.start_date then
      continue;
    end if;
    if v_rule.end_date is not null and v_date > v_rule.end_date then
      continue;
    end if;

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
  v_branch_name text;
  v_desk_label text;
begin
  if p_admin_created and not is_admin() then
    raise exception 'Only admin can create registrations on behalf of a student';
  end if;

  select d.branch_id, d.label, b.name into v_branch_id, v_desk_label, v_branch_name
  from desks d join branches b on b.id = d.branch_id
  where d.id = p_desk_id and d.active;
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

  insert into students (full_name, phone, class_name)
  values (p_full_name, p_phone, nullif(trim(coalesce(p_class_name, '')), ''))
  on conflict (phone) do update set
    full_name = excluded.full_name,
    class_name = coalesce(excluded.class_name, students.class_name),
    updated_at = now()
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
      student_id, branch_id, desk_id, day_of_week, start_time, end_time,
      student_name, class_name, created_by, approved
    ) values (
      v_student_id, v_branch_id, p_desk_id, v_day_of_week, p_start_time, p_end_time,
      p_full_name, p_class_name, auth.uid(), p_admin_created
    ) returning id into v_recurring_id;

    update registrations set recurring_registration_id = v_recurring_id where id = v_registration.id;
    v_registration.recurring_registration_id := v_recurring_id;
  end if;

  if not p_admin_created then
    insert into notifications (type, title, body, link, target_role)
    values (
      case when p_is_recurring then 'recurring_pending' else 'registration_created' end::notification_type,
      case when p_is_recurring then 'Lịch cố định chờ duyệt' else 'Đăng ký lịch mới' end,
      p_full_name || case when p_class_name is not null then ' · ' || p_class_name else '' end
        || ' — ' || to_char(p_date, 'DD/MM') || ' ' || to_char(p_start_time, 'HH24:MI') || '-' || to_char(p_end_time, 'HH24:MI')
        || ' · ' || v_branch_name || ' · ' || v_desk_label,
      '/noi-bo/lich?branch=' || v_branch_id
        || '&day=' || to_char(p_date, 'YYYY-MM-DD')
        || '&week=' || to_char(date_trunc('week', p_date), 'YYYY-MM-DD'),
      null
    );
  end if;

  return v_registration;
end;
$$;

-- Approving is admin-only and does the materialising on the spot, so the
-- weeks appear the moment it's approved rather than on whoever's next page
-- load. Rejecting deactivates the rule; the guest keeps the single booking
-- they already made for that week.
create or replace function review_recurring_registration(p_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_rule recurring_registrations;
  v_monday date := date_trunc('week', (now() at time zone 'Asia/Ho_Chi_Minh')::date)::date;
begin
  if not is_admin() then
    raise exception 'Only admin can review recurring registrations';
  end if;

  select * into v_rule from recurring_registrations where id = p_id;
  if v_rule is null then
    raise exception 'Recurring registration not found';
  end if;

  if p_approve then
    update recurring_registrations set approved = true, active = true where id = p_id;
    perform materialize_recurring_registrations(v_monday);
    perform materialize_recurring_registrations(v_monday + 7);

    insert into notifications (type, title, body, link, target_role)
    values (
      'recurring_approved',
      'Đã duyệt lịch cố định',
      v_rule.student_name || case when v_rule.class_name is not null then ' · ' || v_rule.class_name else '' end,
      '/noi-bo/quan-ly/hoc-sinh',
      null
    );
  else
    update recurring_registrations set approved = false, active = false where id = p_id;
  end if;

  delete from notifications
  where type = 'recurring_pending'
    and body like v_rule.student_name || '%';
end;
$$;
