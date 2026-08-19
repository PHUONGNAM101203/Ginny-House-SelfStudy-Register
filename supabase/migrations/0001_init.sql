create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type user_role as enum ('admin', 'quan_sinh');
create type registration_status as enum ('active', 'cancelled');
create type registration_source as enum ('guest_self', 'recurring_auto', 'admin_manual');

create table branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table desks (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, label)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  lark_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'quan_sinh',
  created_at timestamptz not null default now()
);

create table recurring_registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  desk_id uuid not null references desks(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  student_name text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  desk_id uuid not null references desks(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  status registration_status not null default 'active',
  source registration_source not null,
  student_name text not null,
  recurring_registration_id uuid references recurring_registrations(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  time_range tsrange generated always as (
    tsrange((date + start_time)::timestamp, (date + end_time)::timestamp, '[)')
  ) stored
);

create index registrations_desk_date_idx on registrations (desk_id, date) where status = 'active';

alter table registrations add constraint registrations_no_overlap
  exclude using gist (desk_id with =, time_range with &&)
  where (status = 'active');

create table slot_locks (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  desk_id uuid references desks(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  reason text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger students_set_updated_at before update on students
  for each row execute function set_updated_at();

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

alter table branches enable row level security;
alter table desks enable row level security;
alter table students enable row level security;
alter table profiles enable row level security;
alter table recurring_registrations enable row level security;
alter table registrations enable row level security;
alter table slot_locks enable row level security;

create policy branches_select_all on branches for select using (true);
create policy desks_select_all on desks for select using (true);
create policy slot_locks_select_all on slot_locks for select using (true);
create policy registrations_select_all on registrations for select using (true);
create policy recurring_registrations_staff_select on recurring_registrations for select using (is_staff());

create policy branches_admin_write on branches for all using (is_admin()) with check (is_admin());
create policy desks_admin_write on desks for all using (is_admin()) with check (is_admin());
create policy slot_locks_admin_write on slot_locks for all using (is_admin()) with check (is_admin());
create policy profiles_admin_write on profiles for all using (is_admin()) with check (is_admin());
create policy profiles_self_select on profiles for select using (id = auth.uid() or is_admin());
create policy students_staff_select on students for select using (is_staff());
