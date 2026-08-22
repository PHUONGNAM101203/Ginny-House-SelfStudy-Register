-- Admin-facing student management (create one directly, import a batch from
-- Lark Base) and standalone "lịch cố định" creation (not routed through a
-- booking). students/recurring_registrations never got insert RLS/grants —
-- every row so far has only ever come from create_registration's own inline
-- upsert (SECURITY DEFINER). Same pattern here rather than opening up direct
-- table writes: admin-only RPCs, each responsible for its own auth check.

alter table recurring_registrations add column start_date date;
alter table recurring_registrations add column end_date date;

-- materialize_recurring_registrations now needs to skip a week that falls
-- outside [start_date, end_date] — existing rules (start_date/end_date both
-- null) are unaffected, matching their current "always active" behavior.
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

create or replace function create_student_admin(p_full_name text, p_phone text)
returns students
language plpgsql security definer set search_path = public as $$
declare
  v_student students;
begin
  if not is_admin() then
    raise exception 'Only admin can create students directly';
  end if;

  insert into students (full_name, phone)
  values (p_full_name, p_phone)
  on conflict (phone) do update set full_name = excluded.full_name, updated_at = now()
  returning * into v_student;

  return v_student;
end;
$$;

-- p_rows: jsonb array of {"full_name": text, "phone": text, "lark_record_id": text}
-- — mirrors scripts/import-lark.ts's CSV shape, so the same export file
-- format works for both the CLI script and this in-app import.
create or replace function import_students_admin(p_rows jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  v_row jsonb;
begin
  if not is_admin() then
    raise exception 'Only admin can import students';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into students (full_name, phone, lark_record_id)
    values (v_row->>'full_name', v_row->>'phone', v_row->>'lark_record_id')
    on conflict (phone) do update set full_name = excluded.full_name, lark_record_id = excluded.lark_record_id, updated_at = now();
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Creates only the recurring rule itself — deliberately does NOT also book
-- an immediate one-off registration for "today" the way create_registration
-- does when p_is_recurring is set from the booking dialog. The regular
-- materialize_recurring_registrations sweep (already called on every
-- calendar page load) picks it up starting whichever week it next runs for,
-- bounded by start_date/end_date same as any other rule.
create or replace function create_recurring_registration_admin(
  p_full_name text,
  p_phone text,
  p_branch_id uuid,
  p_desk_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_class_name text default null,
  p_start_date date default null,
  p_end_date date default null
) returns recurring_registrations
language plpgsql security definer set search_path = public as $$
declare
  v_student_id uuid;
  v_rule recurring_registrations;
begin
  if not is_admin() then
    raise exception 'Only admin can create a recurring schedule directly';
  end if;

  if p_day_of_week not between 1 and 7 then
    raise exception 'p_day_of_week must be between 1 and 7';
  end if;

  insert into students (full_name, phone)
  values (p_full_name, p_phone)
  on conflict (phone) do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_student_id;

  insert into recurring_registrations (
    student_id, branch_id, desk_id, day_of_week, start_time, end_time,
    student_name, class_name, start_date, end_date, created_by
  ) values (
    v_student_id, p_branch_id, p_desk_id, p_day_of_week, p_start_time, p_end_time,
    p_full_name, p_class_name, p_start_date, p_end_date, auth.uid()
  ) returning * into v_rule;

  return v_rule;
end;
$$;

grant execute on function create_student_admin to authenticated;
grant execute on function import_students_admin to authenticated;
grant execute on function create_recurring_registration_admin to authenticated;
