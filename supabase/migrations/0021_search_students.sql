-- Now that the student list is synced from Lark, nobody should be retyping
-- a name, lớp and số điện thoại that the system already knows. This backs
-- the staff dropdown on the booking form and the guest's name autocomplete.
--
-- Who sees what is the whole point of the design here:
--
--   * Staff (is_staff()) get the phone back, because the internal calendar
--     already shows it to them anyway.
--   * Anonymous guests get name + lớp and a NULL phone. Names are already
--     public on the guest calendar, but phone deliberately is not — see the
--     comment on find_student_by_phone_prefix (migration 0008), which keyed
--     guest lookup on phone precisely so it couldn't become a "type a
--     surname, harvest everyone's number" directory. Returning phone here
--     would undo that: one common Vietnamese surname would dump the phone
--     number of every student in the centre.
--
-- unaccent + trigram similarity give the "gần giống / lệch hoa thường"
-- matching: "nguyen van a", "NGUYỄN VĂN A" and "nguyên van a" all find
-- "Nguyễn Văn A".

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function search_students(p_query text)
returns table (id uuid, full_name text, class_name text, phone text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_norm text := unaccent(lower(trim(coalesce(p_query, ''))));
  v_staff boolean := is_staff();
begin
  -- A blank query would otherwise return an arbitrary 20 students to anyone.
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
    where unaccent(lower(s.full_name)) like '%' || v_norm || '%'
       -- Searching by number is staff-only for the same reason as above.
       or (v_staff and s.phone like v_norm || '%')
    order by similarity(unaccent(lower(s.full_name)), v_norm) desc, s.full_name
    limit 20;
end;
$$;

grant execute on function search_students to anon, authenticated;
