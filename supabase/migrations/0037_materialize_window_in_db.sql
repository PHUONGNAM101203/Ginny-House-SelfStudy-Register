-- materialize_recurring_registrations is granted to anon (migration 0003) so
-- the guest calendar can fill its own week. Its only bound on WHICH week —
-- current week through +8 — lived in the TypeScript wrapper, which means the
-- RPC itself would happily accept any Monday from anyone holding the anon key
-- (public, it ships in the browser).
--
-- Measured, not theorised: an anonymous caller asking for the week a year ago
-- inserted 53 rows, and three years ahead inserted 53 more. Backdated rows are
-- attendance for sessions that never happened, which is exactly what poisons
-- the dashboard's trend chart and frequency ranking; future ones hold every
-- desk against real bookings.
--
-- The window moves into the function, where nothing can route around it. The
-- wrapper keeps its own check purely to save a round-trip.
create or replace function materialize_recurring_registrations(p_week_start date)
returns integer
language plpgsql security definer set search_path = public as $$
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

  -- date_trunc('week') is Monday in Postgres, and the centre runs on Vietnam
  -- time, so "this week" has to be computed there rather than in UTC.
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
