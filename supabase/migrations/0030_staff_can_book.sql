-- Quản sinh đặt hộ học sinh trong lớp, but must not cancel — that stays an
-- admin decision, same as approving a huỷ request.
--
-- create_registration's p_admin_created guard was is_admin(); it becomes
-- is_staff(). The source value stays 'admin_manual' rather than gaining a
-- 'staff_manual' sibling: it already means "booked from inside, not by the
-- guest themselves", which is exactly what a quản sinh booking is, and
-- splitting it would reshape every report that groups on source.
--
-- cancel_registration is untouched: its is_admin() branch still only lets an
-- admin bypass the name/phone check, so a quản sinh has no cancel path at
-- all — enforced here, not just hidden in the UI.
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
    -- A staff-placed recurring schedule is approved on the spot; only a
    -- guest's request waits for review.
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
