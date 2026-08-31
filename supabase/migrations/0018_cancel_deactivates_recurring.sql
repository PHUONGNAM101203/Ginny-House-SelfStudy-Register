-- Real bug reported live: cancelling a booking tied to a recurring
-- schedule (either the guest's own self-cancel, or admin's direct cancel)
-- only set that ONE week's registrations.status = 'cancelled' — it never
-- touched the recurring_registrations rule itself. Since that rule stayed
-- active, the very next materializeWeek() call (which runs on every
-- calendar page load) silently re-inserted a fresh 'recurring_auto' row
-- for the same desk+date+time, making the "cancelled" booking reappear
-- immediately. Now cancelling a recurring-linked registration also
-- deactivates its rule, matching what deactivateRecurringRegistrationAction
-- already does when triggered from the Học sinh page.

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
    if v_reg.recurring_registration_id is not null then
      update recurring_registrations set active = false where id = v_reg.recurring_registration_id;
    end if;
    return;
  end if;

  select phone into v_phone from students where id = v_reg.student_id;
  if lower(trim(v_reg.student_name)) is distinct from lower(trim(coalesce(p_full_name, '')))
     or v_phone is distinct from trim(coalesce(p_phone, '')) then
    raise exception 'Name or phone does not match';
  end if;

  update registrations set status = 'cancelled' where id = p_registration_id;
  if v_reg.recurring_registration_id is not null then
    update recurring_registrations set active = false where id = v_reg.recurring_registration_id;
  end if;
end;
$$;
