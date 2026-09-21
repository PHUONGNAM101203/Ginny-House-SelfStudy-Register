-- Khoá lịch lẻ: một ngày, một khoảng ngày, hoặc lặp theo thứ như cũ.
--
-- Trung tâm tổ chức thi thử một hôm và cần khoá đúng hôm đó. slot_locks chỉ
-- biết khoá theo thứ, lặp vô thời hạn — "mở ra là mở hết các tuần luôn nên c
-- mở sớm mất thôi" — nên khi mở lịch tuần sau, ngày thi thử mở theo và học
-- sinh đăng ký đúng vào hôm đang thi.
--
-- Một khái niệm, bốn hình dạng, không thêm bảng:
--
--   day_of_week | effective_from | effective_to | nghĩa
--   ------------+----------------+--------------+----------------------------
--   6           | null           | null         | mọi Thứ 7, mãi mãi (như cũ)
--   6           | 2026-09-20     | 2026-10-31   | mọi Thứ 7 trong khoảng đó
--   null        | 2026-09-19     | 2026-09-19   | đúng một ngày
--   null        | 2026-09-15     | 2026-09-21   | một khoảng ngày
--
-- Mọi bản ghi đang có đều có day_of_week và hai cột ngày null, nên chúng rơi
-- vào dòng đầu tiên và hành xử không đổi. Không cần chuyển đổi dữ liệu.
alter table slot_locks alter column day_of_week drop not null;

alter table slot_locks
  add column if not exists effective_from date,
  add column if not exists effective_to date;

alter table slot_locks
  add constraint slot_locks_effective_range
    check (effective_from is null or effective_to is null or effective_to >= effective_from);

-- Cả day_of_week lẫn effective_from cùng null nghĩa là "khoá mọi ngày, mãi
-- mãi" — gần như chắc chắn là bấm nhầm chứ không phải ý định, nên chặn ngay
-- tại CSDL thay vì chờ phát hiện ra khi cả trung tâm không đăng ký được.
alter table slot_locks
  add constraint slot_locks_needs_scope
    check (day_of_week is not null or effective_from is not null);

-- Điều kiện khoá nằm ở ba chỗ (đặt chỗ, duyệt phiếu đổi lịch, và vòng
-- materialise lịch cố định) và trước đây được chép ba lần. Gom về một hàm để
-- lần sau sửa một chỗ là đủ — ba bản chép là ba cơ hội lệch nhau.
create or replace function slot_lock_blocks(
  p_branch_id uuid,
  p_desk_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from slot_locks
    where active
      and branch_id = p_branch_id
      and (desk_id = p_desk_id or desk_id is null)
      -- null = áp cho mọi thứ nằm trong khoảng ngày (khoá lẻ)
      and (day_of_week is null or day_of_week = extract(isodow from p_date))
      -- null = không giới hạn ở đầu đó (khoá cố định cũ không có hạn nào)
      and (effective_from is null or p_date >= effective_from)
      and (effective_to is null or p_date <= effective_to)
      and start_time < p_end_time
      and end_time > p_start_time
  );
$$;

grant execute on function slot_lock_blocks(uuid, uuid, date, time, time) to anon, authenticated;

-- Ba hàm dưới đây lấy nguyên văn từ định nghĩa đang chạy trong CSDL
-- (pg_get_functiondef), chỉ thay đúng khối kiểm tra khoá bằng lời gọi hàm
-- trên. Chép tay lại từ file migration cũ là cách chắc chắn nhất để vô tình
-- quay ngược một bản vá: create_registration và review_registration_change
-- được sửa lần cuối ở 0034, còn materialize ở 0038.

-- create_registration
CREATE OR REPLACE FUNCTION public.create_registration(p_desk_id uuid, p_date date, p_start_time time without time zone, p_end_time time without time zone, p_full_name text, p_phone text, p_class_name text DEFAULT NULL::text, p_is_recurring boolean DEFAULT false, p_admin_created boolean DEFAULT false, p_zalo_contact text DEFAULT NULL::text)
 RETURNS registrations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if slot_lock_blocks(v_branch_id, p_desk_id, p_date, p_start_time, p_end_time) then
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
$function$;

-- materialize_recurring_registrations
CREATE OR REPLACE FUNCTION public.materialize_recurring_registrations(p_week_start date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer := 0;
  v_rule recurring_registrations%rowtype;
  v_date date;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_current_monday date;
begin
  if extract(isodow from p_week_start) <> 1 then
    raise exception 'p_week_start must be a Monday';
  end if;

  v_current_monday := date_trunc('week', v_today)::date;
  if p_week_start < v_current_monday or p_week_start > v_current_monday + 56 then
    return 0;
  end if;

  for v_rule in select * from recurring_registrations where active loop
    v_date := p_week_start + (v_rule.day_of_week - 1);

    if v_rule.start_date is not null and v_date < v_rule.start_date then
      continue;
    end if;
    if v_rule.end_date is not null and v_date > v_rule.end_date then
      continue;
    end if;

    -- This rule already produced this date once. Whether that booking is
    -- still active or has since been cancelled, it is not ours to make
    -- again — re-creating a cancelled one is the resurrection bug.
    if exists (
      select 1 from registrations
      where recurring_registration_id = v_rule.id and date = v_date
    ) then
      continue;
    end if;

    if slot_lock_blocks(v_rule.branch_id, v_rule.desk_id, v_date, v_rule.start_time, v_rule.end_time) then
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
      -- Someone else holds that desk and half hour. Their booking wins.
      continue;
    end;
  end loop;

  return v_count;
end;
$function$;

-- review_registration_change
CREATE OR REPLACE FUNCTION public.review_registration_change(p_request_id uuid, p_approve boolean, p_admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if slot_lock_blocks(v_new_branch_id, v_req.new_desk_id, v_req.new_date, v_req.new_start_time, v_req.new_end_time) then
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
$function$;
