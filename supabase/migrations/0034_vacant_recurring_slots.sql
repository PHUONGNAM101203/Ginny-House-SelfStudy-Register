-- Huỷ một lịch cố định không xoá chỗ đi nữa. Khi admin duyệt phiếu huỷ, ô đó
-- vẫn nằm trên lịch nhưng bỏ trống tên / lớp / SĐT / zalo — để người khác
-- thấy mà lắp vào. Ai đăng ký đúng ô đó thì nhận luôn lịch cố định hằng tuần.
--
-- Representing "trống" needs student_id nullable — no sentinel UUID works for
-- a real foreign key — so student_name follows it rather than carrying a
-- stale name next to a null id.
alter table registrations alter column student_id drop not null;
alter table registrations alter column student_name drop not null;
alter table recurring_registrations alter column student_id drop not null;
alter table recurring_registrations alter column student_name drop not null;

-- Approving a huỷ on a recurring-linked booking vacates rather than cancels:
-- status stays 'active' so the exclusion constraint keeps holding the desk,
-- but nobody is named against it. The rule is vacated the same way and stays
-- active, so future weeks keep showing the placeholder instead of reverting
-- to a plain empty desk. A 'reschedule', or a huỷ on a one-off booking, is
-- untouched — those still cancel outright.
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

  if v_req.kind = 'cancel' and v_reg.recurring_registration_id is not null then
    update registrations
    set student_id = null, student_name = null, class_name = null, zalo_contact = null
    where id = v_reg.id;

    update recurring_registrations
    set student_id = null, student_name = null, class_name = null
    where id = v_reg.recurring_registration_id;
  else
    update registrations set status = 'cancelled' where id = v_req.registration_id;
  end if;

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

-- Booking a desk+time that a vacant placeholder is holding claims that row in
-- place instead of colliding with it through registrations_no_overlap — and
-- takes the weekly rule over with it, which is the whole reason the slot was
-- kept rather than deleted ("để thay người khác vào"). No second rule is
-- created even if p_is_recurring is set: they already hold one.
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
  v_creator_role user_role;
  v_title text;
  v_vacant_id uuid;
  v_vacant_rule_id uuid;
begin
  if p_admin_created and not is_staff() then
    raise exception 'Only staff can create registrations on behalf of a student';
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

  select id, recurring_registration_id into v_vacant_id, v_vacant_rule_id
  from registrations
  where desk_id = p_desk_id
    and date = p_date
    and status = 'active'
    and student_id is null
    and start_time < p_end_time
    and end_time > p_start_time
  limit 1;

  if v_vacant_id is not null then
    update registrations
    set student_id = v_student_id,
        student_name = p_full_name,
        class_name = p_class_name,
        zalo_contact = p_zalo_contact,
        source = case when p_admin_created then 'admin_manual'::registration_source else 'guest_self'::registration_source end,
        created_by = auth.uid()
    where id = v_vacant_id
    returning * into v_registration;

    if v_vacant_rule_id is not null then
      update recurring_registrations
      set student_id = v_student_id, student_name = p_full_name, class_name = p_class_name
      where id = v_vacant_rule_id;
    end if;
  else
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
  end if;

  if p_is_recurring and v_vacant_rule_id is null then
    insert into recurring_registrations (
      student_id, branch_id, desk_id, day_of_week, start_time, end_time,
      student_name, class_name, created_by
    ) values (
      v_student_id, v_branch_id, p_desk_id, v_day_of_week, p_start_time, p_end_time,
      p_full_name, p_class_name, auth.uid()
    ) returning id into v_recurring_id;

    update registrations set recurring_registration_id = v_recurring_id where id = v_registration.id;
    v_registration.recurring_registration_id := v_recurring_id;
  end if;

  select role into v_creator_role from profiles where id = auth.uid();

  if not p_admin_created then
    v_title := case
      when v_vacant_rule_id is not null then 'Học sinh nhận chỗ cố định còn trống'
      when p_is_recurring then 'Học sinh đăng ký lịch cố định'
      else 'Học sinh đăng ký lịch mới'
    end;
  elsif v_creator_role = 'quan_sinh' then
    v_title := 'Quản sinh đăng ký cho học sinh';
  else
    v_title := null;
  end if;

  if v_title is not null then
    insert into notifications (type, title, body, link, target_role)
    values (
      'registration_created',
      v_title,
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

-- Quản sinh huỷ được và không phải chờ ai duyệt; chỉ học sinh mới phải gửi
-- phiếu. Same shape as migration 0031, widened from is_admin() to is_staff().
create or replace function cancel_registration(
  p_registration_id uuid,
  p_full_name text default null,
  p_phone text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reg registrations;
begin
  select * into v_reg from registrations where id = p_registration_id and status = 'active';
  if v_reg is null then
    raise exception 'Registration not found or already cancelled';
  end if;

  if not is_staff() then
    raise exception 'Cancellations require admin approval' using errcode = 'GH001';
  end if;

  update registrations set status = 'cancelled' where id = p_registration_id;
  if v_reg.recurring_registration_id is not null then
    update recurring_registrations set active = false where id = v_reg.recurring_registration_id;
  end if;
end;
$$;
