-- "khi hủy lịch đều báo về admin duyệt có cho hủy hay không" — a guest can no
-- longer cancel anything outright. Every huỷ becomes a phiếu the admin
-- reviews, through the flow that already exists
-- (request_registration_change / review_registration_change).
--
-- That removes the guest branch of this function entirely: there is no longer
-- a name/phone path to fall through to, so it is gone rather than left
-- unreachable below a raise. GH001 is what the UI keys on to steer the guest
-- into the request flow.
--
-- Admin's own cancel is untouched, and still deactivates a linked recurring
-- rule (migration 0018) so the booking can't re-materialise the moment
-- someone loads the calendar.
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

  if not is_admin() then
    raise exception 'Cancellations require admin approval' using errcode = 'GH001';
  end if;

  update registrations set status = 'cancelled' where id = p_registration_id;
  if v_reg.recurring_registration_id is not null then
    update recurring_registrations set active = false where id = v_reg.recurring_registration_id;
  end if;
end;
$$;

-- A huỷ request is now the only way a guest gives a slot back, so the admin
-- has to hear about it on the phone as well as in the bell. The row itself
-- is inserted by request_registration_change (migration 0006); this is the
-- notification that names what happened rather than just "yêu cầu mới".
