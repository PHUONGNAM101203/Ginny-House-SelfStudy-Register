-- Sửa thông tin ngay trên card, cho admin và quản sinh — gõ nhầm tên hay lớp
-- thì không phải huỷ rồi đặt lại.
--
-- registrations keeps a *snapshot* of the name and lớp as booked (that is why
-- cancelling used to compare against it rather than the live students row),
-- so an edit has to touch both: the booking being looked at, and the student
-- record everything else reads from.
--
-- Phone is the unique key on students. Handing it to someone else's number
-- would silently merge two people, so that case is refused with a message the
-- UI can show as-is rather than a raw constraint error.
create or replace function update_registration_details(
  p_registration_id uuid,
  p_full_name text,
  p_phone text,
  p_class_name text default null,
  p_zalo_contact text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reg registrations;
  v_name text := trim(coalesce(p_full_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_class text := nullif(trim(coalesce(p_class_name, '')), '');
  v_zalo text := nullif(trim(coalesce(p_zalo_contact, '')), '');
  v_owner uuid;
begin
  if not is_staff() then
    raise exception 'Only staff can edit a registration';
  end if;

  select * into v_reg from registrations where id = p_registration_id;
  if v_reg is null then
    raise exception 'Registration not found';
  end if;
  -- A vacant placeholder belongs to nobody; there is nothing to correct.
  if v_reg.student_id is null then
    raise exception 'Chỗ này đang trống, chưa có thông tin để sửa';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'Tên quá ngắn';
  end if;

  select id into v_owner from students where phone = v_phone;
  if v_owner is not null and v_owner <> v_reg.student_id then
    raise exception 'Số điện thoại này đã thuộc về học sinh khác';
  end if;

  update students
  set full_name = v_name,
      phone = v_phone,
      class_name = coalesce(v_class, class_name),
      updated_at = now()
  where id = v_reg.student_id;

  update registrations
  set student_name = v_name,
      class_name = v_class,
      zalo_contact = coalesce(v_zalo, zalo_contact)
  where id = p_registration_id;

  -- Keep a linked lịch cố định in step, or next week's materialised rows
  -- would come back carrying the old name.
  if v_reg.recurring_registration_id is not null then
    update recurring_registrations
    set student_name = v_name, class_name = v_class
    where id = v_reg.recurring_registration_id;
  end if;
end;
$$;
