-- Autocomplete for the guest booking form: once a returning guest has typed
-- enough of their OWN phone number, offer to prefill name/class from their
-- most recent registration. Deliberately keyed on phone (not name) — a
-- guest already knows their own phone number, so requiring a phone prefix
-- (not just a name) keeps this from being a general "look up anyone by
-- name" directory. At most one row is ever returned, and a short prefix is
-- rejected outright.
create or replace function find_student_by_phone_prefix(p_phone_prefix text)
returns table (full_name text, phone text, class_name text)
language plpgsql security definer set search_path = public as $$
begin
  if char_length(p_phone_prefix) < 4 then
    raise exception 'Phone prefix too short';
  end if;

  return query
    select
      s.full_name,
      s.phone,
      coalesce(
        (select r.class_name from registrations r where r.student_id = s.id and r.class_name is not null order by r.date desc, r.created_at desc limit 1),
        (select rr.class_name from recurring_registrations rr where rr.student_id = s.id and rr.class_name is not null order by rr.created_at desc limit 1)
      ) as class_name
    from students s
    where s.phone like p_phone_prefix || '%'
    limit 1;
end;
$$;

grant execute on function find_student_by_phone_prefix to anon, authenticated;
