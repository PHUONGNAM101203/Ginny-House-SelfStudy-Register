-- "Ngừng hoạt động" instead of deleting. Deleting a student cascades away
-- their whole booking history, which is exactly the data the centre wants
-- for reporting later — so archiving becomes the normal way to take someone
-- off the roster, and the hard delete stays only for genuine mistakes.
--
-- Matches the flag already used by desks, slot_locks and
-- recurring_registrations, so "active" means the same thing everywhere.
alter table students add column active boolean not null default true;

-- An archived student must stop being bookable, or the flag would be
-- cosmetic: they'd still surface in the staff dropdown and the guest's name
-- autocomplete and could be booked straight back in.
create or replace function search_students(p_query text)
returns table (id uuid, full_name text, class_name text, phone text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_norm text := unaccent(lower(trim(coalesce(p_query, ''))));
  v_staff boolean := is_staff();
begin
  if char_length(v_norm) < 2 then
    return;
  end if;

  return query
    select
      s.id,
      s.full_name,
      coalesce(
        (select r.class_name from registrations r
          where r.student_id = s.id and r.class_name is not null
          order by r.date desc, r.created_at desc limit 1),
        (select rr.class_name from recurring_registrations rr
          where rr.student_id = s.id and rr.class_name is not null
          order by rr.created_at desc limit 1)
      ) as class_name,
      case when v_staff then s.phone else null end as phone
    from students s
    where s.active
      and (
        unaccent(lower(s.full_name)) like '%' || v_norm || '%'
        or (v_staff and s.phone like v_norm || '%')
      )
    order by similarity(unaccent(lower(s.full_name)), v_norm) desc, s.full_name
    limit 20;
end;
$$;

-- Same reasoning for the returning-guest phone prefill (migration 0008).
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
    where s.active and s.phone like p_phone_prefix || '%'
    limit 1;
end;
$$;
