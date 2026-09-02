-- Lớp becomes a property of the student, not something re-derived from their
-- last booking every time. Gin Anh: "khi bạn đấy nhập lớp lần đầu thì nó sẽ
-- cập nhật vào DB lớp của bạn đấy và sau này sẽ lấy lớp đó".
--
-- The derived "most recent class from registrations" fallback stays for
-- students who predate this column and have never booked since.
alter table students add column class_name text;

-- Guests now get the phone back too, but only when the query narrows to a
-- single student.
--
-- Gin Anh asked for "chỉ nhập tên vào nó sẽ auto ra đc full thông tin cả lớp
-- cả sđt". Handing a phone to every partial match would turn one common
-- surname into a bulk export of every student's number — which is exactly
-- what migration 0008 was written to prevent. Gating on an unambiguous match
-- gives the asked-for behaviour (a student typing their own full name gets
-- their own number) while a fishing query for "Nguyễn" returns names only.
create or replace function search_students(p_query text)
returns table (id uuid, full_name text, class_name text, phone text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_norm text := unaccent(lower(trim(coalesce(p_query, ''))));
  v_staff boolean := is_staff();
  v_matches integer;
begin
  if char_length(v_norm) < 2 then
    return;
  end if;

  select count(*) into v_matches
  from students s
  where s.active and unaccent(lower(s.full_name)) like '%' || v_norm || '%';

  return query
    select
      s.id,
      s.full_name,
      coalesce(
        s.class_name,
        (select r.class_name from registrations r
          where r.student_id = s.id and r.class_name is not null
          order by r.date desc, r.created_at desc limit 1),
        (select rr.class_name from recurring_registrations rr
          where rr.student_id = s.id and rr.class_name is not null
          order by rr.created_at desc limit 1)
      ) as class_name,
      case when v_staff or v_matches = 1 then s.phone else null end as phone
    from students s
    where s.active
      and (
        unaccent(lower(s.full_name)) like '%' || v_norm || '%'
        or (v_staff and s.phone like v_norm || '%')
      )
    order by similarity(unaccent(lower(s.full_name)), v_norm) desc, s.full_name
    limit 20;
end;
$$;

create or replace function find_student_by_phone_prefix(p_phone_prefix text)
returns table (full_name text, phone text, class_name text)
language plpgsql security definer set search_path = public as $$
begin
  if char_length(p_phone_prefix) < 4 then
    raise exception 'Phone prefix too short';
  end if;

  return query
    select
      s.full_name,
      s.phone,
      coalesce(
        s.class_name,
        (select r.class_name from registrations r where r.student_id = s.id and r.class_name is not null order by r.date desc, r.created_at desc limit 1),
        (select rr.class_name from recurring_registrations rr where rr.student_id = s.id and rr.class_name is not null order by rr.created_at desc limit 1)
      ) as class_name
    from students s
    where s.active and s.phone like p_phone_prefix || '%'
    limit 1;
end;
$$;

-- Booking with a lớp filled in teaches the system that student's lớp, so the
-- next booking only needs their name. Latest wins: a student who moves up a
-- class shouldn't be stuck with the old one.
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
    -- Only overwrite when this booking actually carried a lớp: a later
    -- booking left blank must not wipe what the student already told us.
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
