-- "có hs đăng ký được lịch cố định mà k có sđt cũng đky được luôn".
--
-- students.phone is NOT NULL, but '' satisfies that, so every guard was in
-- the app layer where a new RPC could quietly skip it — and one did:
-- update_registration_details (migration 0035) validated the name and never
-- the phone. The rule moves into the database, where no future path can
-- forget it.
--
-- >= 9 digits rather than an exact Vietnamese pattern: the Lark import
-- normalises to 10 digits starting 0, but older rows predate that and
-- refusing to load them would be worse than accepting a slightly loose
-- number.
alter table students
  add constraint students_phone_not_blank
  check (char_length(regexp_replace(phone, '\D', '', 'g')) >= 9);

-- And the missing check in the edit RPC, so the failure is a readable
-- message rather than a constraint violation.
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
  if v_reg.student_id is null then
    raise exception 'Chỗ này đang trống, chưa có thông tin để sửa';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'Tên quá ngắn';
  end if;
  if char_length(regexp_replace(v_phone, '\D', '', 'g')) < 9 then
    raise exception 'Phải nhập số điện thoại';
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

  if v_reg.recurring_registration_id is not null then
    update recurring_registrations
    set student_name = v_name, class_name = v_class
    where id = v_reg.recurring_registration_id;
  end if;
end;
$$;
