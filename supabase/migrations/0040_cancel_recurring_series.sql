-- "tại sao hủy lịch cố định không đưa ra popup cho chọn xóa mỗi sự kiện này
-- hoặc hủy hết toàn bộ lịch cố định ... cả admin và quản sinh đều có nhé"
--
-- Migration 0038 made cancel_registration cancel exactly one buổi and stop
-- touching the weekly rule — the right default, and what was asked for at the
-- time. But it left no way to end a lịch cố định from the calendar at all:
-- the only "dừng hẳn" was deactivateRecurringRegistrationAction, admin-only,
-- on the Học sinh page. So this adds the second half of the choice rather
-- than changing the first.
--
-- Scope is "this session and every one after it", the same rule a calendar
-- app means by "this and following events". Sessions before the clicked date
-- are attendance that already happened; marking them cancelled would rewrite
-- a fact, and the dashboard counts them.
create or replace function cancel_recurring_series(p_registration_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_reg registrations;
  v_count integer;
begin
  select * into v_reg from registrations where id = p_registration_id;
  if v_reg is null then
    raise exception 'Registration not found';
  end if;
  if v_reg.recurring_registration_id is null then
    raise exception 'Booking is not part of a recurring schedule';
  end if;

  -- Same gate as cancel_registration: staff-wide since migration 0034, so
  -- quản sinh gets this too. A học sinh still has to send a phiếu.
  if not is_staff() then
    raise exception 'Cancellations require admin approval' using errcode = 'GH001';
  end if;

  -- Stop the rule from producing any further weeks.
  update recurring_registrations
  set active = false
  where id = v_reg.recurring_registration_id;

  -- And cancel the buổi that was clicked plus every one still ahead of it.
  -- materialize_recurring_registrations (0038) will not re-create these:
  -- it skips any (rule, date) it has already produced, cancelled or not.
  with cancelled as (
    update registrations
    set status = 'cancelled'
    where recurring_registration_id = v_reg.recurring_registration_id
      and status = 'active'
      and date >= v_reg.date
    returning 1
  )
  select count(*) into v_count from cancelled;

  return v_count;
end;
$$;

-- A function nobody may execute is a door nobody can reach: this grant is
-- what makes it callable by a signed-in admin or quản sinh.
grant execute on function cancel_recurring_series(uuid) to authenticated;
