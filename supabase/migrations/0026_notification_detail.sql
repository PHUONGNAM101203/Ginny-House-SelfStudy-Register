-- The bell said "Nguyễn Nhật Minh · L0-03-26 — 04/09 14:30-17:30" and
-- nothing else, so there was no way to tell which cơ sở or which chỗ to look
-- at — with two cơ sở on screen at a time, the honest answer to "why can't I
-- see this booking?" was often "you're looking at the other one". Both
-- notification bodies now name the cơ sở and the chỗ.
--
-- The link goes to the exact day and cơ sở too, instead of dropping the
-- reader on whatever week the calendar happened to open at — Gin Anh: "khi
-- chị bấm vào thông báo, nó k nhảy ra tới chỗ hs đã đăng ký".
-- date_trunc('week') is Monday in Postgres, which is what the calendar's
-- `week` param expects.

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

create or replace function cancel_registration(
  p_registration_id uuid,
  p_full_name text default null,
  p_phone text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reg registrations;
  v_phone text;
  v_branch_name text;
  v_desk_label text;
begin
  select * into v_reg from registrations where id = p_registration_id and status = 'active';
  if v_reg is null then
    raise exception 'Registration not found or already cancelled';
  end if;

  if is_admin() then
    update registrations set status = 'cancelled' where id = p_registration_id;
    if v_reg.recurring_registration_id is not null then
      update recurring_registrations set active = false where id = v_reg.recurring_registration_id;
    end if;
    return;
  end if;

  select phone into v_phone from students where id = v_reg.student_id;
  if lower(trim(v_reg.student_name)) is distinct from lower(trim(coalesce(p_full_name, '')))
     or v_phone is distinct from trim(coalesce(p_phone, '')) then
    raise exception 'Name or phone does not match';
  end if;

  update registrations set status = 'cancelled' where id = p_registration_id;
  if v_reg.recurring_registration_id is not null then
    update recurring_registrations set active = false where id = v_reg.recurring_registration_id;
  end if;

  select b.name, d.label into v_branch_name, v_desk_label
  from desks d join branches b on b.id = d.branch_id
  where d.id = v_reg.desk_id;

  insert into notifications (type, title, body, link, target_role)
  values (
    'registration_cancelled',
    'Guest huỷ lịch',
    coalesce(v_reg.student_name, 'Không rõ tên')
      || case when v_reg.class_name is not null then ' · ' || v_reg.class_name else '' end
      || ' — ' || to_char(v_reg.date, 'DD/MM') || ' '
      || to_char(v_reg.start_time, 'HH24:MI') || '-' || to_char(v_reg.end_time, 'HH24:MI')
      || ' · ' || coalesce(v_branch_name, '?') || ' · ' || coalesce(v_desk_label, '?'),
    '/noi-bo/lich?branch=' || v_reg.branch_id
      || '&day=' || to_char(v_reg.date, 'YYYY-MM-DD')
      || '&week=' || to_char(date_trunc('week', v_reg.date), 'YYYY-MM-DD'),
    null
  );
end;
$$;
