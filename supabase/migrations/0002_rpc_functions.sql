create or replace function create_registration(
  p_desk_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_full_name text,
  p_phone text,
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
    status, source, student_name, created_by
  ) values (
    v_student_id, v_branch_id, p_desk_id, p_date, p_start_time, p_end_time,
    'active',
    case when p_admin_created then 'admin_manual'::registration_source else 'guest_self'::registration_source end,
    p_full_name,
    auth.uid()
  ) returning * into v_registration;

  if p_is_recurring then
    insert into recurring_registrations (
      student_id, branch_id, desk_id, day_of_week, start_time, end_time, student_name, created_by
    ) values (
      v_student_id, v_branch_id, p_desk_id, v_day_of_week, p_start_time, p_end_time, p_full_name, auth.uid()
    ) returning id into v_recurring_id;

    update registrations set recurring_registration_id = v_recurring_id where id = v_registration.id;
    v_registration.recurring_registration_id := v_recurring_id;
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
begin
  select * into v_reg from registrations where id = p_registration_id and status = 'active';
  if v_reg is null then
    raise exception 'Registration not found or already cancelled';
  end if;

  if is_admin() then
    update registrations set status = 'cancelled' where id = p_registration_id;
    return;
  end if;

  select phone into v_phone from students where id = v_reg.student_id;
  if lower(trim(v_reg.student_name)) is distinct from lower(trim(coalesce(p_full_name, '')))
     or v_phone is distinct from trim(coalesce(p_phone, '')) then
    raise exception 'Name or phone does not match';
  end if;

  update registrations set status = 'cancelled' where id = p_registration_id;
end;
$$;

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
        status, source, student_name, recurring_registration_id
      ) values (
        v_rule.student_id, v_rule.branch_id, v_rule.desk_id, v_date, v_rule.start_time, v_rule.end_time,
        'active', 'recurring_auto', v_rule.student_name, v_rule.id
      );
      v_count := v_count + 1;
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function create_registration to anon, authenticated;
grant execute on function cancel_registration to anon, authenticated;
grant execute on function materialize_recurring_registrations to authenticated;

-- NOTE: not part of the Task 3 brief's SQL. Task 2's 0001_init.sql defines
-- RLS policies (e.g. desks_select_all using (true)) but never grants the
-- underlying table-level privileges to anon/authenticated, so RLS never
-- even gets consulted (Postgres denies at the grant layer first). These
-- grants are the prerequisite the existing RLS policies in 0001_init.sql
-- need to actually take effect; RLS still restricts who succeeds (e.g.
-- is_admin() on the write policies).
grant select on branches to anon, authenticated;
grant insert, update, delete on branches to authenticated;

grant select on desks to anon, authenticated;
grant insert, update, delete on desks to authenticated;

grant select on registrations to anon, authenticated;

grant select on recurring_registrations to authenticated;

grant select on slot_locks to anon, authenticated;
grant insert, update, delete on slot_locks to authenticated;

grant select on students to authenticated;

grant select on profiles to authenticated;
grant insert, update, delete on profiles to authenticated;

-- NOTE: also not part of the brief. Discovered while adding the
-- admin-bypass integration test: unlike a typical Supabase bootstrap
-- (where service_role gets full default privileges on every table),
-- this local project's service_role has no table-level grants either —
-- same root cause as above, just a different role. service_role bypasses
-- RLS by design (it's the platform's trusted admin key), but Postgres
-- still requires the base GRANT before RLS is even consulted. Without
-- this, the service-role admin client this app uses for staff/admin
-- account provisioning (e.g. inserting into profiles) fails outright.
grant select, insert, update, delete on branches, desks, students, profiles,
  recurring_registrations, registrations, slot_locks to service_role;
