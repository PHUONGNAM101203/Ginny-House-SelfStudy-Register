-- "nếu lịch cố định thì hủy mỗi buổi đó nếu người đăng ký bảo hủy mỗi buổi
-- đó nhé chứ ko phải kéo hết tất cả."
--
-- Cancelling one booking that belonged to a lịch cố định switched the whole
-- weekly rule off. Kim Anh's report — students with a weekly slot having to
-- register again the next week — is exactly this: on production 5 of 30
-- rules were off, and every one of them had a cancelled booking against it.
--
-- That behaviour came from migration 0018, which fixed a real bug: a
-- cancelled recurring booking reappeared on the very next page load, because
-- registrations_no_overlap only covers status='active', so a cancelled row
-- does not stop materialise from inserting a fresh one. Deactivating the rule
-- stopped the resurrection, but it conflated "huỷ buổi này" with "dừng hẳn
-- lịch cố định" — and once quản sinh could cancel directly (migration 0034),
-- the second meaning fired every time someone meant the first.
--
-- Fixed at the real cause instead: materialise now skips a (rule, date) it
-- has already produced, whatever that row's status. A cancelled week stays
-- cancelled, later weeks keep coming, and the rule stays on. Stopping a lịch
-- cố định for good remains its own deliberate action — the "Huỷ lịch cố định"
-- button on the Học sinh page (deactivateRecurringRegistrationAction).
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
      -- Someone else holds that desk and half hour. Their booking wins.
      continue;
    end;
  end loop;

  return v_count;
end;
$$;

-- And the cancel itself stops touching the rule.
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

  -- One occurrence only. The weekly rule is left alone; materialise above
  -- will not re-create this date, and next week still arrives.
  update registrations set status = 'cancelled' where id = p_registration_id;
end;
$$;

-- Switch the five rules back on that were turned off by a per-occurrence
-- cancel. Every rule below is inactive AND has a cancelled booking against
-- it, which is the fingerprint of the bug rather than of someone
-- deliberately ending a schedule. The cancelled buổi themselves stay
-- cancelled — only the weekly rule resumes.
update recurring_registrations r
set active = true
where not r.active
  and exists (
    select 1 from registrations g
    where g.recurring_registration_id = r.id and g.status = 'cancelled'
  );
