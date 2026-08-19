# Ginny House Self-Study Registration — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the weekly Excel self-study registration sheet with a Next.js + Supabase web app: guests book/cancel self-study desk slots with no login, admin manages branches/desks/locks/students/staff and books on behalf of students, admin and quản sinh view a read-only calendar and a stats dashboard.

**Architecture:** Next.js 16 App Router, Server Components for data reads, Server Actions calling Postgres `SECURITY DEFINER` RPC functions for all writes (atomic double-booking prevention via a GIST exclusion constraint), Supabase Auth + RLS for the two internal roles, no auth at all for guests (identified by name+phone, verified again on cancel).

**Tech Stack:** Next.js 16, React 19, TypeScript, npm, Supabase (`@supabase/ssr`, Postgres, Supabase CLI for local dev), shadcn/ui (`radix-nova` style, ported from the reference app), Tailwind CSS v4, `react-hook-form` + `zod`, `date-fns` (locale `vi`), `sonner`, `next-themes`, `recharts`, Vitest for unit + integration tests, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-08-19-selfstudy-register-design.md`
**Reference app (UI/settings source):** `/Users/phuongnam/Documents/Calendar-GInny-House`

## Global Constraints

- Package manager is **npm** (matches reference app's `package-lock.json`) — never introduce `yarn.lock`/`pnpm-lock.yaml`.
- Every write to `registrations` / `recurring_registrations` goes through the `create_registration` / `cancel_registration` / `materialize_recurring_registrations` RPC functions — never insert/update these tables directly from a Server Action or client.
- `day_of_week` is **ISO** (1 = Monday … 7 = Sunday) everywhere in schema, RPCs, and TypeScript — matches the Vietnamese week layout ("Thứ 2" first) and must stay consistent across every task.
- Time-of-day values are `"HH:MM"` 24h strings in TypeScript, Postgres `time` in SQL. Dates are `"YYYY-MM-DD"` strings in TypeScript, Postgres `date` in SQL.
- No public RLS policy ever exposes `students.phone`. The `registrations` / `recurring_registrations` tables carry a denormalized `student_name` column precisely so the public grid never needs to join `students`.
- Every Server Action returns `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }` (defined in `types/index.ts`), matching the reference app's convention.
- No file exceeds ~400 lines; split by responsibility, not by technical layer, following `components/<feature>/`, `actions/<feature>.ts`, `lib/validations/<entity>.ts` conventions from the reference app.

---

## File Structure Overview

```
app/
  layout.tsx                        # fonts, ThemeProvider, Toaster
  globals.css                       # design tokens ported from reference app
  page.tsx                          # guest landing (branch/week schedule)
  noi-bo/
    dang-nhap/page.tsx              # hidden staff login
    layout.tsx                      # authenticated shell (header, requireProfile)
    lich/page.tsx                   # read-only calendar (admin + quan_sinh) + admin book-on-behalf
    dashboard/page.tsx              # stats dashboard
    quan-ly/
      co-so/page.tsx                # branches + desks CRUD (admin only)
      khoa-lich/page.tsx            # slot_locks CRUD (admin only)
      hoc-sinh/page.tsx             # students list (admin only)
      nhan-su/page.tsx              # staff accounts CRUD (admin only)
components/
  ui/                               # shadcn primitives (generated)
  schedule/
    BranchTabs.tsx
    WeekPicker.tsx
    ScheduleGrid.tsx
    SlotCell.tsx
  booking/
    BookingDialog.tsx                 # accepts an `action` prop — reused as-is for admin book-on-behalf
    CancelDialog.tsx
  admin/
    BranchDeskManager.tsx
    SlotLockForm.tsx
    SlotLockTable.tsx
    StudentTable.tsx
    StaffForm.tsx
    StaffTable.tsx
  dashboard/
    OccupancyChart.tsx
    MissingRegistrationsList.tsx
    TrendChart.tsx
    FrequencyRanking.tsx
  layout/
    AppHeader.tsx
    ThemeToggle.tsx
actions/
  registrations.ts
  branches.ts
  desks.ts
  slot-locks.ts
  students.ts
  staff.ts
lib/
  supabase/{server,client,admin,public}.ts
  time-slots.ts
  week.ts
  auth.ts
  roles.ts
  utils.ts
  dashboard.ts
  validations/{registration.ts,branch.ts,desk.ts,slot-lock.ts,staff.ts}
types/index.ts
supabase/migrations/0001_init.sql
supabase/migrations/0002_rpc_functions.sql
supabase/seed.sql
scripts/import-lark.ts
proxy.ts
tests/
  unit/{time-slots,week,dashboard}.test.ts
  integration/{create-registration,cancel-registration,materialize-recurring}.test.ts
  e2e/booking.spec.ts
```

---

### Task 1: Project scaffold + ported design system

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `components.json`, `lib/utils.ts`
- Reference (read/copy from, do not modify): `/Users/phuongnam/Documents/Calendar-GInny-House/app/globals.css`, `/Users/phuongnam/Documents/Calendar-GInny-House/app/layout.tsx`, `/Users/phuongnam/Documents/Calendar-GInny-House/components.json`

**Interfaces:**
- Produces: `cn()` util in `lib/utils.ts` (shadcn standard `clsx` + `tailwind-merge` combiner) used by every component task from here on.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --turbopack --use-npm --yes
```

If it warns about existing files (`.git`, `.claude`, `docs/`, `.gitignore`), continue — these don't conflict with the generated files.

- [ ] **Step 2: Verify the dev server boots**

Run: `npm run build`
Expected: build succeeds with the default Next.js starter page.

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init -y -b neutral
```

- [ ] **Step 4: Port design tokens from the reference app**

```bash
cp /Users/phuongnam/Documents/Calendar-GInny-House/app/globals.css app/globals.css
```

Open `app/globals.css` and replace any literal occurrences of "Ginny House Calendar" / "MeetAgain" brand text with "Ginny House – Đăng ký Tự học". Keep every color/radius/motion token identical — that's the whole point of copying this file.

- [ ] **Step 5: Port the font setup**

Open `/Users/phuongnam/Documents/Calendar-GInny-House/app/layout.tsx` and copy its `next/font/google` Barlow import + `<html>`/`<body>` font-variable wiring into the new `app/layout.tsx`. Keep `ThemeProvider` (`next-themes`, `attribute="class"`, `defaultTheme="system"`) and add a `<Toaster />` from `sonner`. Set `<title>` to "Ginny House – Đăng ký Tự học".

```bash
npm install next-themes sonner
```

- [ ] **Step 6: Add the shadcn primitives this project will need**

```bash
npx shadcn@latest add button dialog input label table tabs card badge dropdown-menu select form calendar popover sonner separator
```

- [ ] **Step 7: Verify build + commit**

Run: `npm run build`
Expected: succeeds, no type errors.

```bash
git add -A
git commit -m "feat: scaffold Next.js app with ported design system"
git push
```

---

### Task 2: Supabase local project + core schema

**Files:**
- Create: `supabase/config.toml` (via CLI), `supabase/migrations/0001_init.sql`, `supabase/seed.sql`, `.env.local.example`

**Interfaces:**
- Produces: tables `branches`, `desks`, `students`, `profiles`, `recurring_registrations`, `registrations`, `slot_locks` — exact columns below, consumed by every later task.

- [ ] **Step 1: Install Supabase CLI and init**

```bash
npm install -g supabase 2>/dev/null || brew install supabase/tap/supabase
supabase init
supabase start
```

Note the printed `API URL`, `anon key`, and `service_role key` — you'll need them in Task 5.

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/0001_init.sql`:

```sql
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
```

- [ ] **Step 3: Write the seed data**

Create `supabase/seed.sql`:

```sql
insert into branches (code, name) values
  ('hoang-gia', 'Cơ sở Hoàng Gia'),
  ('ho-xuong-rong', 'Cơ sở Hồ Xương Rồng');

insert into desks (branch_id, label)
select b.id, 'Chỗ ' || n
from branches b, generate_series(1, 10) n;
```

- [ ] **Step 4: Apply and verify**

```bash
supabase db reset
```

Expected: migration + seed apply with no errors. Verify:

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '\"')" -c "select count(*) from desks;"
```

Expected: `20` (2 branches × 10 desks).

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add core Supabase schema (branches, desks, students, registrations)"
git push
```

---

### Task 3: RPC functions for booking, cancelling, and recurring materialization

**Files:**
- Create: `supabase/migrations/0002_rpc_functions.sql`
- Test: `tests/integration/registrations-rpc.test.ts`

**Interfaces:**
- Produces: RPC `create_registration(p_desk_id uuid, p_date date, p_start_time time, p_end_time time, p_full_name text, p_phone text, p_is_recurring boolean, p_admin_created boolean) returns registrations`
- Produces: RPC `cancel_registration(p_registration_id uuid, p_full_name text, p_phone text) returns void`
- Produces: RPC `materialize_recurring_registrations(p_week_start date) returns integer` — `p_week_start` must be a Monday.
- Consumes: schema from Task 2.

- [ ] **Step 1: Write the RPC migration**

Create `supabase/migrations/0002_rpc_functions.sql`:

```sql
create or replace function create_registration(
  p_desk_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_full_name text,
  p_phone text,
  p_is_recurring boolean default false,
  p_admin_created boolean default false
) returns registrations
language plpgsql security definer set search_path = public as $$
declare
  v_branch_id uuid;
  v_day_of_week smallint;
  v_student_id uuid;
  v_registration registrations;
  v_recurring_id uuid;
begin
  if p_admin_created and not is_admin() then
    raise exception 'Only admin can create registrations on behalf of a student';
  end if;

  select branch_id into v_branch_id from desks where id = p_desk_id and active;
  if v_branch_id is null then
    raise exception 'Desk not found or inactive';
  end if;

  v_day_of_week := extract(isodow from p_date);

  if exists (
    select 1 from slot_locks
    where active
      and branch_id = v_branch_id
      and (desk_id = p_desk_id or desk_id is null)
      and day_of_week = v_day_of_week
      and start_time < p_end_time
      and end_time > p_start_time
  ) then
    raise exception 'Slot is locked';
  end if;

  insert into students (full_name, phone)
  values (p_full_name, p_phone)
  on conflict (phone) do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_student_id;

  insert into registrations (
    student_id, branch_id, desk_id, date, start_time, end_time,
    status, source, student_name, created_by
  ) values (
    v_student_id, v_branch_id, p_desk_id, p_date, p_start_time, p_end_time,
    'active',
    case when p_admin_created then 'admin_manual'::registration_source else 'guest_self'::registration_source end,
    p_full_name,
    auth.uid()
  ) returning * into v_registration;

  if p_is_recurring then
    insert into recurring_registrations (
      student_id, branch_id, desk_id, day_of_week, start_time, end_time, student_name, created_by
    ) values (
      v_student_id, v_branch_id, p_desk_id, v_day_of_week, p_start_time, p_end_time, p_full_name, auth.uid()
    ) returning id into v_recurring_id;

    update registrations set recurring_registration_id = v_recurring_id where id = v_registration.id;
    v_registration.recurring_registration_id := v_recurring_id;
  end if;

  return v_registration;
end;
$$;

create or replace function cancel_registration(
  p_registration_id uuid,
  p_full_name text default null,
  p_phone text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_reg registrations;
  v_student students;
begin
  select * into v_reg from registrations where id = p_registration_id and status = 'active';
  if v_reg is null then
    raise exception 'Registration not found or already cancelled';
  end if;

  if is_admin() then
    update registrations set status = 'cancelled' where id = p_registration_id;
    return;
  end if;

  select * into v_student from students where id = v_reg.student_id;
  if lower(trim(v_student.full_name)) is distinct from lower(trim(coalesce(p_full_name, '')))
     or v_student.phone is distinct from trim(coalesce(p_phone, '')) then
    raise exception 'Name or phone does not match';
  end if;

  update registrations set status = 'cancelled' where id = p_registration_id;
end;
$$;

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
        status, source, student_name, recurring_registration_id
      ) values (
        v_rule.student_id, v_rule.branch_id, v_rule.desk_id, v_date, v_rule.start_time, v_rule.end_time,
        'active', 'recurring_auto', v_rule.student_name, v_rule.id
      );
      v_count := v_count + 1;
    exception when exclusion_violation then
      continue;
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function create_registration to anon, authenticated;
grant execute on function cancel_registration to anon, authenticated;
grant execute on function materialize_recurring_registrations to authenticated;
```

- [ ] **Step 2: Apply migration**

```bash
supabase db reset
```

Expected: applies cleanly.

- [ ] **Step 3: Install Vitest and write the integration test**

```bash
npm install -D vitest @supabase/supabase-js dotenv
```

Create `tests/integration/registrations-rpc.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
)

let deskId: string

beforeAll(async () => {
  const { data } = await supabase.from("desks").select("id").limit(1).single()
  deskId = data!.id
})

describe("create_registration", () => {
  it("creates a registration for a free slot", async () => {
    const { data, error } = await supabase.rpc("create_registration", {
      p_desk_id: deskId,
      p_date: "2026-08-24",
      p_start_time: "08:00",
      p_end_time: "08:30",
      p_full_name: "Nguyễn Văn A",
      p_phone: "0900000001",
      p_is_recurring: false,
      p_admin_created: false,
    })
    expect(error).toBeNull()
    expect(data.status).toBe("active")
  })

  it("rejects a double booking on the same desk/time", async () => {
    await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-25", p_start_time: "09:00", p_end_time: "09:30",
      p_full_name: "A", p_phone: "0900000002", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-25", p_start_time: "09:00", p_end_time: "09:30",
      p_full_name: "B", p_phone: "0900000003", p_is_recurring: false, p_admin_created: false,
    })
    expect(error).not.toBeNull()
  })
})

describe("cancel_registration", () => {
  it("cancels when name+phone match", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-26", p_start_time: "10:00", p_end_time: "10:30",
      p_full_name: "Trần Thị B", p_phone: "0900000004", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Trần Thị B", p_phone: "0900000004",
    })
    expect(error).toBeNull()
  })

  it("rejects when phone does not match", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-27", p_start_time: "11:00", p_end_time: "11:30",
      p_full_name: "Lê Văn C", p_phone: "0900000005", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Lê Văn C", p_phone: "0900000099",
    })
    expect(error).not.toBeNull()
  })
})

describe("materialize_recurring_registrations", () => {
  it("creates one registration per active recurring rule for the given week", async () => {
    await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-31", p_start_time: "12:00", p_end_time: "12:30",
      p_full_name: "Phạm D", p_phone: "0900000006", p_is_recurring: true, p_admin_created: false,
    })
    const { data: count, error } = await supabase.rpc("materialize_recurring_registrations", {
      p_week_start: "2026-09-07",
    })
    expect(error).toBeNull()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
```

Add to `package.json` scripts: `"test:integration": "vitest run tests/integration"`.

- [ ] **Step 4: Run and verify tests pass**

Run: `supabase db reset && npm run test:integration`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_rpc_functions.sql tests/integration/registrations-rpc.test.ts package.json package-lock.json
git commit -m "feat: add booking RPC functions with atomic double-booking prevention"
git push
```

---

### Task 4: Time-slot constants, week helpers, and zod validation schemas

**Files:**
- Create: `lib/time-slots.ts`, `lib/week.ts`, `lib/validations/registration.ts`
- Test: `tests/unit/time-slots.test.ts`, `tests/unit/week.test.ts`

**Interfaces:**
- Produces: `TIME_SLOTS: TimeSlot[]`, `type TimeSlot = { start: string; end: string }`
- Produces: `getMondayOfWeek(date: Date): Date`, `getWeekDates(monday: Date): Date[]` (7 dates, Mon→Sun)
- Produces: `createRegistrationSchema`, `cancelRegistrationSchema` (zod), `type CreateRegistrationInput`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/time-slots.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { TIME_SLOTS } from "@/lib/time-slots"

describe("TIME_SLOTS", () => {
  it("has 24 thirty-minute slots (8-12 + 14-22, no lunch)", () => {
    expect(TIME_SLOTS).toHaveLength(24)
  })
  it("starts at 08:00 and ends at 22:00, skipping 12:00-14:00", () => {
    expect(TIME_SLOTS[0]).toEqual({ start: "08:00", end: "08:30" })
    expect(TIME_SLOTS.at(-1)).toEqual({ start: "21:30", end: "22:00" })
    expect(TIME_SLOTS.some((s) => s.start === "12:00")).toBe(false)
    expect(TIME_SLOTS.some((s) => s.start === "13:30")).toBe(false)
  })
})
```

Create `tests/unit/week.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"

describe("getMondayOfWeek", () => {
  it("returns the same Monday when given a Wednesday", () => {
    const monday = getMondayOfWeek(new Date("2026-08-19"))
    expect(monday.toISOString().slice(0, 10)).toBe("2026-08-17")
  })
})

describe("getWeekDates", () => {
  it("returns 7 consecutive dates starting Monday", () => {
    const dates = getWeekDates(new Date("2026-08-17"))
    expect(dates).toHaveLength(7)
    expect(dates[0].toISOString().slice(0, 10)).toBe("2026-08-17")
    expect(dates[6].toISOString().slice(0, 10)).toBe("2026-08-23")
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/unit`
Expected: FAIL — `lib/time-slots` and `lib/week` don't exist yet.

- [ ] **Step 3: Implement `lib/time-slots.ts`**

```typescript
export type TimeSlot = { start: string; end: string }

const SLOT_MINUTES = 30
const RANGES: [string, string][] = [
  ["08:00", "12:00"],
  ["14:00", "22:00"],
]

function generateSlots(start: string, end: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  let [h, m] = start.split(":").map(Number)
  const [endH, endM] = end.split(":").map(Number)
  while (h < endH || (h === endH && m < endM)) {
    const startStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    m += SLOT_MINUTES
    if (m >= 60) {
      m -= 60
      h += 1
    }
    const endStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    slots.push({ start: startStr, end: endStr })
  }
  return slots
}

export const TIME_SLOTS: TimeSlot[] = RANGES.flatMap(([start, end]) => generateSlots(start, end))
```

- [ ] **Step 4: Implement `lib/week.ts`**

```typescript
import { startOfWeek, addDays } from "date-fns"

export function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
```

```bash
npm install date-fns
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run tests/unit`
Expected: PASS.

- [ ] **Step 6: Implement `lib/validations/registration.ts`**

```typescript
import { z } from "zod"

export const phoneRegex = /^0\d{9}$/

export const createRegistrationSchema = z.object({
  deskId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  isRecurring: z.boolean().default(false),
})
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>

export const cancelRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().regex(phoneRegex),
})
export type CancelRegistrationInput = z.infer<typeof cancelRegistrationSchema>
```

```bash
npm install zod react-hook-form @hookform/resolvers
```

- [ ] **Step 7: Commit**

```bash
git add lib/ tests/unit package.json package-lock.json
git commit -m "feat: add time-slot constants, week helpers, registration zod schemas"
git push
```

---

### Task 5: Supabase client factories, auth helpers, and the proxy gate

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts`, `lib/supabase/public.ts`, `lib/auth.ts`, `lib/roles.ts`, `proxy.ts`, `types/index.ts`, `.env.local`

**Interfaces:**
- Produces: `createServerClient()`, `createBrowserClient()`, `createAdminClient()`, `createPublicClient()`
- Produces: `getSessionProfile(): Promise<Profile | null>`, `requireProfile(): Promise<Profile>`, `requireAdmin(): Promise<Profile>`
- Produces: `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }`, `type Profile = { id: string; fullName: string; role: "admin" | "quan_sinh" }`

- [ ] **Step 1: Install ssr package and set env vars**

```bash
npm install @supabase/ssr @supabase/supabase-js
```

Create `.env.local` (values from `supabase start` output in Task 2):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase start>
```

- [ ] **Step 2: Write the client factories**

`lib/supabase/client.ts`:

```typescript
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"

export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`lib/supabase/server.ts`:

```typescript
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createServerClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )
}
```

`lib/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

`lib/supabase/public.ts`:

```typescript
import { createClient } from "@supabase/supabase-js"

export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}
```

- [ ] **Step 3: Write `types/index.ts`**

```typescript
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type Role = "admin" | "quan_sinh"

export type Profile = {
  id: string
  fullName: string
  role: Role
}
```

- [ ] **Step 4: Write `lib/roles.ts`**

```typescript
import type { Role } from "@/types"

export function canManage(role: Role): boolean {
  return role === "admin"
}
```

- [ ] **Step 5: Write `lib/auth.ts`**

```typescript
import { redirect } from "next/navigation"
import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type { Profile } from "@/types"

export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single()

  if (!profile) return null
  return { id: profile.id, fullName: profile.full_name, role: profile.role }
})

export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile()
  if (!profile) redirect("/noi-bo/dang-nhap")
  return profile
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== "admin") redirect("/noi-bo/lich")
  return profile
}
```

- [ ] **Step 6: Write `proxy.ts` (Next.js 16 middleware equivalent)**

```typescript
import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getClaims().then(
    (r) => ({ data: { user: r.data?.claims ? { id: r.data.claims.sub } : null } }),
    () => ({ data: { user: null } })
  )

  const path = request.nextUrl.pathname
  const isInternal = path.startsWith("/noi-bo") && path !== "/noi-bo/dang-nhap"

  if (isInternal && !user) {
    return NextResponse.redirect(new URL("/noi-bo/dang-nhap", request.url))
  }
  if (path === "/noi-bo/dang-nhap" && user) {
    return NextResponse.redirect(new URL("/noi-bo/lich", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
}
```

This is a convenience gate only — every internal `page.tsx` still calls `requireProfile()`/`requireAdmin()` directly, matching the reference app's documented principle (`lib/supabase/proxy.ts:48-50`) that the proxy is not the security boundary.

- [ ] **Step 7: Verify build succeeds**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add lib/supabase lib/auth.ts lib/roles.ts proxy.ts types/ .env.local.example package.json package-lock.json
git commit -m "feat: add Supabase client factories, auth helpers, and proxy gate"
git push
```

Note: create `.env.local.example` (same keys as `.env.local`, placeholder values) and add it to git — `.env.local` itself stays gitignored.

---

### Task 6: Hidden staff login + authenticated internal shell

**Files:**
- Create: `app/noi-bo/dang-nhap/page.tsx`, `app/noi-bo/layout.tsx`, `components/layout/AppHeader.tsx`, `components/layout/ThemeToggle.tsx`
- Test: `tests/e2e/login.spec.ts`

**Interfaces:**
- Consumes: `requireProfile()` from Task 5, shadcn `Button`/`Input`/`Card`/`Form` from Task 1.
- Produces: `<AppHeader profile={Profile} />` used by every `noi-bo/*` page from here on.

- [ ] **Step 1: Write `app/noi-bo/dang-nhap/page.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError("Email hoặc mật khẩu không đúng")
      return
    }
    router.push("/noi-bo/lich")
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Đăng nhập nội bộ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Write `components/layout/ThemeToggle.tsx`**

```tsx
"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  )
}
```

```bash
npx shadcn@latest add button 2>/dev/null; npm install lucide-react
```

- [ ] **Step 3: Write `components/layout/AppHeader.tsx`**

```tsx
import Link from "next/link"
import type { Profile } from "@/types"
import { ThemeToggle } from "@/components/layout/ThemeToggle"

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <Link href="/noi-bo/lich" className="font-semibold">Ginny House – Tự học</Link>
          <Link href="/noi-bo/lich" className="text-sm text-muted-foreground">Lịch</Link>
          <Link href="/noi-bo/dashboard" className="text-sm text-muted-foreground">Dashboard</Link>
          {profile.role === "admin" && (
            <Link href="/noi-bo/quan-ly/co-so" className="text-sm text-muted-foreground">Quản lý</Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">{profile.fullName}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Write `app/noi-bo/layout.tsx`**

```tsx
import { requireProfile } from "@/lib/auth"
import { AppHeader } from "@/components/layout/AppHeader"

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </>
  )
}
```

- [ ] **Step 5: Create a bootstrap admin user for manual testing**

```bash
supabase status -o env
```

Use the printed `SERVICE_ROLE_KEY` to run a one-off Node script (or the Supabase Studio UI at the printed Studio URL) to create one `auth.users` row + matching `profiles` row with `role='admin'`, so Task 6 is testable end-to-end. Document the email/password you chose in `.env.local` as `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (local-only, gitignored).

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, visit `/noi-bo/dang-nhap`, log in with the seeded admin — expect redirect to `/noi-bo/lich` (will 404 until Task 7 exists; a 404 on a page that required auth to reach confirms the gate worked). Visit `/noi-bo/lich` directly while logged out — expect redirect back to `/noi-bo/dang-nhap`.

- [ ] **Step 7: Commit**

```bash
git add app/noi-bo/dang-nhap app/noi-bo/layout.tsx components/layout
git commit -m "feat: add hidden staff login and authenticated internal shell"
git push
```

---

### Task 7: Guest landing — branch/week selection and schedule data fetch

**Files:**
- Create: `app/page.tsx`, `components/schedule/BranchTabs.tsx`, `components/schedule/WeekPicker.tsx`, `lib/schedule-data.ts`

**Interfaces:**
- Produces: `getScheduleData(branchId: string, weekMonday: Date): Promise<{ desks: Desk[]; registrations: RegistrationRow[]; locks: SlotLock[] }>` — consumed by Task 8's `ScheduleGrid`.
- Produces: `type Desk = { id: string; label: string }`, `type RegistrationRow = { id: string; deskId: string; date: string; startTime: string; endTime: string; studentName: string }`, `type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }`

- [ ] **Step 1: Write `lib/schedule-data.ts`**

```typescript
import { createPublicClient } from "@/lib/supabase/public"
import { getWeekDates } from "@/lib/week"
import { format } from "date-fns"

export type Desk = { id: string; label: string }
export type RegistrationRow = { id: string; deskId: string; date: string; startTime: string; endTime: string; studentName: string }
export type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }

export async function getScheduleData(branchId: string, weekMonday: Date) {
  const supabase = createPublicClient()
  const dates = getWeekDates(weekMonday)
  const from = format(dates[0], "yyyy-MM-dd")
  const to = format(dates[6], "yyyy-MM-dd")

  const [{ data: desks }, { data: registrations }, { data: locks }] = await Promise.all([
    supabase.from("desks").select("id, label").eq("branch_id", branchId).eq("active", true).order("label"),
    supabase
      .from("registrations")
      .select("id, desk_id, date, start_time, end_time, student_name")
      .eq("branch_id", branchId)
      .eq("status", "active")
      .gte("date", from)
      .lte("date", to),
    supabase.from("slot_locks").select("desk_id, day_of_week, start_time, end_time").eq("branch_id", branchId).eq("active", true),
  ])

  return {
    desks: (desks ?? []) as Desk[],
    registrations: (registrations ?? []).map((r) => ({
      id: r.id, deskId: r.desk_id, date: r.date, startTime: r.start_time, endTime: r.end_time, studentName: r.student_name,
    })) as RegistrationRow[],
    locks: (locks ?? []).map((l) => ({
      deskId: l.desk_id, dayOfWeek: l.day_of_week, startTime: l.start_time, endTime: l.end_time,
    })) as SlotLock[],
  }
}

export async function getBranches() {
  const supabase = createPublicClient()
  const { data } = await supabase.from("branches").select("id, code, name").order("name")
  return data ?? []
}
```

- [ ] **Step 2: Write `components/schedule/WeekPicker.tsx`**

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format } from "date-fns"
import { Button } from "@/components/ui/button"

export function WeekPicker({ monday }: { monday: Date }) {
  const router = useRouter()
  const params = useSearchParams()

  function goTo(newMonday: Date) {
    const p = new URLSearchParams(params)
    p.set("week", format(newMonday, "yyyy-MM-dd"))
    router.push(`/?${p.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(monday, -7))}>← Tuần trước</Button>
      <span className="text-sm font-medium">Tuần {format(monday, "dd/MM/yyyy")}</span>
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(monday, 7))}>Tuần sau →</Button>
    </div>
  )
}
```

- [ ] **Step 3: Write `components/schedule/BranchTabs.tsx`**

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function BranchTabs({ branches, activeBranchId }: { branches: { id: string; name: string }[]; activeBranchId: string }) {
  const router = useRouter()
  const params = useSearchParams()

  function onChange(branchId: string) {
    const p = new URLSearchParams(params)
    p.set("branch", branchId)
    router.push(`/?${p.toString()}`)
  }

  return (
    <Tabs value={activeBranchId} onValueChange={onChange}>
      <TabsList>
        {branches.map((b) => (
          <TabsTrigger key={b.id} value={b.id}>{b.name}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
```

```bash
npx shadcn@latest add tabs 2>/dev/null
```

- [ ] **Step 4: Write `app/page.tsx`**

```tsx
import { getBranches, getScheduleData } from "@/lib/schedule-data"
import { getMondayOfWeek } from "@/lib/week"
import { BranchTabs } from "@/components/schedule/BranchTabs"
import { WeekPicker } from "@/components/schedule/WeekPicker"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; week?: string }>
}) {
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = params.branch ?? branches[0]?.id
  const monday = getMondayOfWeek(params.week ? new Date(params.week) : new Date())
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-xl font-semibold">Đăng ký chỗ tự học</h1>
      <div className="mb-4 flex items-center justify-between">
        {activeBranchId && <BranchTabs branches={branches} activeBranchId={activeBranchId} />}
        <WeekPicker monday={monday} />
      </div>
      {schedule && (
        <p className="text-sm text-muted-foreground">
          {schedule.desks.length} chỗ, {schedule.registrations.length} lượt đăng ký tuần này.
        </p>
      )}
    </div>
  )
}
```

(The actual grid rendering is Task 8 — this task only wires up data fetching + branch/week navigation, verifiable by the desk/registration counts rendering correctly.)

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `/`. Expect to see 2 branch tabs, "20 chỗ, 0 lượt đăng ký tuần này" (until Task 3's test data is present — reset the DB with `supabase db reset` first if leftover test rows from Task 3 confuse the count, or just check the desk count of 10 per branch).

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/schedule lib/schedule-data.ts
git commit -m "feat: add guest landing page with branch/week selection"
git push
```

---

### Task 8: Schedule grid rendering (free / booked / locked)

**Files:**
- Create: `components/schedule/ScheduleGrid.tsx`, `components/schedule/SlotCell.tsx`
- Modify: `app/page.tsx` (render `<ScheduleGrid />` instead of the placeholder text)

**Interfaces:**
- Consumes: `Desk`, `RegistrationRow`, `SlotLock` from Task 7, `TIME_SLOTS` from Task 4.
- Produces: `<ScheduleGrid desks branchId date registrations locks onSlotClick={(desk, slot, existingRegistration) => void} />` — `onSlotClick` is wired to the booking/cancel dialogs in Tasks 9–10.

- [ ] **Step 1: Write `components/schedule/SlotCell.tsx`**

```tsx
"use client"

import { cn } from "@/lib/utils"
import type { TimeSlot } from "@/lib/time-slots"
import type { RegistrationRow } from "@/lib/schedule-data"

type SlotState = "free" | "booked" | "locked"

export function SlotCell({
  slot, state, registration, onClick,
}: { slot: TimeSlot; state: SlotState; registration?: RegistrationRow; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={`slot-${slot.start}`}
      onClick={onClick}
      disabled={state === "locked"}
      className={cn(
        "flex h-8 w-full items-center justify-center rounded-sm border text-xs transition-colors",
        state === "free" && "border-dashed border-muted-foreground/30 hover:bg-accent",
        state === "booked" && "cursor-pointer border-primary/30 bg-primary/10 text-primary",
        state === "locked" && "cursor-not-allowed border-none bg-muted text-muted-foreground/50"
      )}
      title={registration?.studentName}
    >
      {state === "booked" ? registration!.studentName.split(" ").at(-1) : state === "locked" ? "—" : ""}
    </button>
  )
}
```

- [ ] **Step 2: Write `components/schedule/ScheduleGrid.tsx`**

```tsx
"use client"

import { format } from "date-fns"
import { TIME_SLOTS } from "@/lib/time-slots"
import { getWeekDates } from "@/lib/week"
import { SlotCell } from "@/components/schedule/SlotCell"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export type SlotClickPayload = {
  desk: Desk
  date: string
  startTime: string
  endTime: string
  registration?: RegistrationRow
}

export function ScheduleGrid({
  desks, monday, registrations, locks, onSlotClick,
}: {
  desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[]
  onSlotClick: (payload: SlotClickPayload) => void
}) {
  const dates = getWeekDates(monday)

  function findRegistration(deskId: string, date: string, startTime: string) {
    return registrations.find((r) => r.deskId === deskId && r.date === date && r.startTime === startTime)
  }

  function isLocked(deskId: string, isoDow: number, startTime: string, endTime: string) {
    return locks.some(
      (l) => (l.deskId === deskId || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < endTime && l.endTime > startTime
    )
  }

  return (
    <div className="overflow-x-auto">
      {dates.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd")
        const isoDow = ((date.getDay() + 6) % 7) + 1
        return (
          <div key={dateStr} className="mb-6">
            <h3 className="mb-2 text-sm font-medium">{format(date, "EEEE dd/MM")}</h3>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${desks.length}, minmax(60px, 1fr))` }}>
              {desks.map((desk) => (
                <div key={desk.id} className="flex flex-col gap-1">
                  <span className="text-center text-xs text-muted-foreground">{desk.label}</span>
                  {TIME_SLOTS.map((slot) => {
                    const registration = findRegistration(desk.id, dateStr, slot.start)
                    const locked = !registration && isLocked(desk.id, isoDow, slot.start, slot.end)
                    const state = registration ? "booked" : locked ? "locked" : "free"
                    return (
                      <SlotCell
                        key={slot.start}
                        slot={slot}
                        state={state}
                        registration={registration}
                        onClick={() =>
                          onSlotClick({ desk, date: dateStr, startTime: slot.start, endTime: slot.end, registration })
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Wire into `app/page.tsx`**

Replace the placeholder `<p>` with a client wrapper. Create `components/schedule/ScheduleGridClient.tsx`:

```tsx
"use client"

import { useState } from "react"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function ScheduleGridClient({
  desks, monday, registrations, locks,
}: { desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[] }) {
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid desks={desks} monday={monday} registrations={registrations} locks={locks} onSlotClick={setSelected} />
      {/* BookingDialog / CancelDialog wired in Tasks 9-10, reading `selected` */}
    </>
  )
}
```

Update `app/page.tsx`'s JSX to render `<ScheduleGridClient desks={schedule.desks} monday={monday} registrations={schedule.registrations} locks={schedule.locks} />` instead of the placeholder paragraph.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, visit `/`. Expect a 7-day grid, 10 desk columns per day, 24 time-slot rows each, all rendered as free (dashed) cells since no bookings exist yet.

- [ ] **Step 5: Commit**

```bash
git add components/schedule app/page.tsx
git commit -m "feat: render the weekly schedule grid (free/booked/locked states)"
git push
```

---

### Task 9: Booking dialog + guest create-registration action

**Files:**
- Create: `actions/registrations.ts`, `components/booking/BookingDialog.tsx`
- Modify: `components/schedule/ScheduleGridClient.tsx`

**Interfaces:**
- Produces: `createRegistrationAction(input: CreateRegistrationInput): Promise<ActionResult<{ id: string }>>`
- Produces: `<BookingDialog action?={...} .../>` — the `action` prop defaults to `createRegistrationAction` but accepts any function matching `(input: unknown) => Promise<ActionResult<{ id: string }>>`. Task 14 reuses this exact component (no duplicate file) by passing `action={createRegistrationAsAdminAction}`.
- Consumes: `createRegistrationSchema` (Task 4), `createPublicClient` (Task 5), `SlotClickPayload` (Task 8), `ActionResult` (Task 5).

- [ ] **Step 1: Write `actions/registrations.ts`**

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createPublicClient } from "@/lib/supabase/public"
import { createRegistrationSchema, cancelRegistrationSchema } from "@/lib/validations/registration"
import type { ActionResult } from "@/types"

export async function createRegistrationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("create_registration", {
    p_desk_id: parsed.data.deskId,
    p_date: parsed.data.date,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_is_recurring: parsed.data.isRecurring,
    p_admin_created: false,
  })

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Khung giờ này vừa có người đặt, vui lòng chọn khung khác" }
    }
    if (error.message.includes("Slot is locked")) {
      return { ok: false, error: "Khung giờ này đã bị khoá, không có phòng" }
    }
    return { ok: false, error: "Có lỗi xảy ra, vui lòng thử lại" }
  }

  revalidatePath("/")
  return { ok: true, data: { id: data.id } }
}

export async function cancelRegistrationAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = cancelRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = createPublicClient()
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: parsed.data.registrationId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
  })

  if (error) {
    return { ok: false, error: "Tên hoặc số điện thoại không khớp" }
  }

  revalidatePath("/")
  return { ok: true, data: null }
}
```

- [ ] **Step 2: Write `components/booking/BookingDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { createRegistrationSchema, type CreateRegistrationInput } from "@/lib/validations/registration"
import { createRegistrationAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/types"

export function BookingDialog({
  open, onOpenChange, deskId, deskLabel, date, startTime, endTime, onSuccess,
  action = createRegistrationAction,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  deskId: string; deskLabel: string; date: string; startTime: string; endTime: string
  onSuccess: () => void
  action?: (input: unknown) => Promise<ActionResult<{ id: string }>>
}) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateRegistrationInput>({
    resolver: zodResolver(createRegistrationSchema),
    defaultValues: { deskId, date, startTime, endTime, isRecurring: false },
  })

  async function onSubmit(values: CreateRegistrationInput) {
    setSubmitting(true)
    const result = await action(values)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Đăng ký thành công!")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đăng ký {deskLabel} — {startTime}-{endTime}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="fullName">Họ tên</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={watch("isRecurring")} onChange={(e) => setValue("isRecurring", e.target.checked)} />
            Đăng ký cố định (tự giữ chỗ mỗi tuần)
          </label>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Đang đăng ký..." : "Xác nhận"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

```bash
npx shadcn@latest add dialog label 2>/dev/null
```

- [ ] **Step 3: Wire into `components/schedule/ScheduleGridClient.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function ScheduleGridClient({
  desks, monday, registrations, locks,
}: { desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid desks={desks} monday={monday} registrations={registrations} locks={locks} onSlotClick={setSelected} />
      {selected && !selected.registration && (
        <BookingDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          deskId={selected.desk.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, visit `/`, click a free slot, fill name + phone, submit. Expect a success toast and the cell now showing the student's last name. Verify a race by opening two browser tabs and racing two submissions on the same still-free slot — one should succeed, the other should show "Khung giờ này vừa có người đặt".

- [ ] **Step 5: Commit**

```bash
git add actions/registrations.ts components/booking/BookingDialog.tsx components/schedule/ScheduleGridClient.tsx
git commit -m "feat: add guest booking dialog and create-registration action"
git push
```

---

### Task 10: Self-service cancel dialog

**Files:**
- Create: `components/booking/CancelDialog.tsx`
- Modify: `components/schedule/ScheduleGridClient.tsx`

**Interfaces:**
- Consumes: `cancelRegistrationAction` (Task 9), `cancelRegistrationSchema` (Task 4).

- [ ] **Step 1: Write `components/booking/CancelDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cancelRegistrationSchema, type CancelRegistrationInput } from "@/lib/validations/registration"
import { cancelRegistrationAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function CancelDialog({
  open, onOpenChange, registrationId, deskLabel, startTime, endTime, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  registrationId: string; deskLabel: string; startTime: string; endTime: string
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<CancelRegistrationInput>({
    resolver: zodResolver(cancelRegistrationSchema),
    defaultValues: { registrationId },
  })

  async function onSubmit(values: CancelRegistrationInput) {
    setSubmitting(true)
    const result = await cancelRegistrationAction(values)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Đã huỷ đăng ký")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Huỷ đăng ký {deskLabel} — {startTime}-{endTime}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Nhập lại đúng Tên + SĐT đã dùng để đăng ký để xác nhận huỷ.</p>
          <div>
            <Label htmlFor="fullName">Họ tên</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? "Đang huỷ..." : "Xác nhận huỷ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire into `components/schedule/ScheduleGridClient.tsx`**

Add the booked-cell branch alongside the existing free-cell branch (import `CancelDialog` at the top of the file):

```tsx
{selected?.registration && (
  <CancelDialog
    open
    onOpenChange={(v) => !v && setSelected(null)}
    registrationId={selected.registration.id}
    deskLabel={selected.desk.label}
    startTime={selected.startTime}
    endTime={selected.endTime}
    onSuccess={() => router.refresh()}
  />
)}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, book a slot, click the now-booked cell, enter the *wrong* phone — expect "Tên hoặc số điện thoại không khớp" toast and the booking still present. Retry with the correct name+phone — expect success toast and the cell reverting to free.

- [ ] **Step 4: Commit**

```bash
git add components/booking/CancelDialog.tsx components/schedule/ScheduleGridClient.tsx
git commit -m "feat: add guest self-cancel dialog with name+phone verification"
git push
```

---

### Task 11: Recurring registration materialization on week view

**Files:**
- Create: `supabase/migrations/0003_materialize_grant_anon.sql`
- Modify: `app/page.tsx`, `lib/schedule-data.ts`

**Interfaces:**
- Consumes: `materialize_recurring_registrations` RPC (Task 3). This task only wires it up server-side — the booking-time `isRecurring` checkbox and RPC call already exist from Task 9.

- [ ] **Step 1: Grant the materialize RPC to anon**

`materialize_recurring_registrations` is granted to `authenticated` only (Task 3) — guests are anon, so the guest-facing page needs it callable without a session. Create `supabase/migrations/0003_materialize_grant_anon.sql`:

```sql
grant execute on function materialize_recurring_registrations to anon;
```

This is safe: it's idempotent and only materializes rows from already-existing active recurring rules for a given date, no user-supplied data beyond the date.

- [ ] **Step 2: Add `materializeWeek` to `lib/schedule-data.ts`**

```typescript
export async function materializeWeek(weekMonday: Date) {
  const supabase = createPublicClient()
  await supabase.rpc("materialize_recurring_registrations", {
    p_week_start: format(weekMonday, "yyyy-MM-dd"),
  })
}
```

- [ ] **Step 3: Wire the call into `app/page.tsx`**

```tsx
import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
// ...
const monday = getMondayOfWeek(params.week ? new Date(params.week) : new Date())
await materializeWeek(monday)
const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null
```

- [ ] **Step 4: Apply migration and verify**

```bash
supabase db reset
```

Manual check: book a slot with "Đăng ký cố định" checked, note its day-of-week. Navigate the week picker forward — expect the same desk/time to show as booked again the following week, with the same student name, without re-registering.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_materialize_grant_anon.sql app/page.tsx lib/schedule-data.ts
git commit -m "feat: auto-materialize recurring registrations when a week is viewed"
git push
```

---

### Task 12: Admin — branches & desks management

**Files:**
- Create: `app/noi-bo/quan-ly/co-so/page.tsx`, `components/admin/BranchDeskManager.tsx`, `actions/branches.ts`, `actions/desks.ts`, `lib/validations/branch.ts`, `lib/validations/desk.ts`

**Interfaces:**
- Produces: `createBranchAction`, `createDeskAction`, `toggleDeskActiveAction` (all `requireAdmin()`-gated, `ActionResult<...>`).

- [ ] **Step 1: Write validation schemas**

`lib/validations/branch.ts`:

```typescript
import { z } from "zod"

export const branchSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, "Chỉ chữ thường, số và dấu gạch ngang"),
  name: z.string().trim().min(2).max(100),
})
export type BranchInput = z.infer<typeof branchSchema>
```

`lib/validations/desk.ts`:

```typescript
import { z } from "zod"

export const deskSchema = z.object({
  branchId: z.string().uuid(),
  label: z.string().trim().min(1).max(50),
  active: z.boolean().default(true),
})
export type DeskInput = z.infer<typeof deskSchema>
```

- [ ] **Step 2: Write `actions/branches.ts` and `actions/desks.ts`**

`actions/branches.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { branchSchema } from "@/lib/validations/branch"
import type { ActionResult } from "@/types"

export async function createBranchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = branchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase.from("branches").insert(parsed.data).select("id").single()
  if (error) return { ok: false, error: error.code === "23505" ? "Mã cơ sở đã tồn tại" : error.message }

  revalidatePath("/noi-bo/quan-ly/co-so")
  return { ok: true, data: { id: data.id } }
}
```

`actions/desks.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { deskSchema } from "@/lib/validations/desk"
import type { ActionResult } from "@/types"

export async function createDeskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = deskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("desks")
    .insert({ branch_id: parsed.data.branchId, label: parsed.data.label, active: parsed.data.active })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.code === "23505" ? "Tên chỗ đã tồn tại trong cơ sở này" : error.message }

  revalidatePath("/noi-bo/quan-ly/co-so")
  return { ok: true, data: { id: data.id } }
}

export async function toggleDeskActiveAction(deskId: string, active: boolean): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from("desks").update({ active }).eq("id", deskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/noi-bo/quan-ly/co-so")
  return { ok: true, data: null }
}
```

- [ ] **Step 3: Write `components/admin/BranchDeskManager.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createBranchAction } from "@/actions/branches"
import { createDeskAction, toggleDeskActiveAction } from "@/actions/desks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Branch = { id: string; code: string; name: string }
type Desk = { id: string; branch_id: string; label: string; active: boolean }

export function BranchDeskManager({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  const [newBranch, setNewBranch] = useState({ code: "", name: "" })
  const [newDesk, setNewDesk] = useState<{ branchId: string; label: string }>({ branchId: branches[0]?.id ?? "", label: "" })

  async function addBranch() {
    const result = await createBranchAction(newBranch)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã thêm cơ sở")
    setNewBranch({ code: "", name: "" })
  }

  async function addDesk() {
    const result = await createDeskAction({ ...newDesk, active: true })
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã thêm chỗ")
    setNewDesk({ ...newDesk, label: "" })
  }

  async function toggleDesk(id: string, active: boolean) {
    const result = await toggleDeskActiveAction(id, active)
    if (!result.ok) toast.error(result.error)
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 font-medium">Cơ sở</h2>
        <div className="mb-4 flex gap-2">
          <Input placeholder="Mã (vd: hoang-gia)" value={newBranch.code} onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })} />
          <Input placeholder="Tên cơ sở" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
          <Button onClick={addBranch}>Thêm</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Mã</TableHead><TableHead>Tên</TableHead></TableRow></TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}><TableCell>{b.code}</TableCell><TableCell>{b.name}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Chỗ ngồi</h2>
        <div className="mb-4 flex gap-2">
          <select className="rounded border px-2" value={newDesk.branchId} onChange={(e) => setNewDesk({ ...newDesk, branchId: e.target.value })}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Input placeholder="Tên chỗ (vd: Chỗ 11)" value={newDesk.label} onChange={(e) => setNewDesk({ ...newDesk, label: e.target.value })} />
          <Button onClick={addDesk}>Thêm</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Cơ sở</TableHead><TableHead>Chỗ</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader>
          <TableBody>
            {desks.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{branches.find((b) => b.id === d.branch_id)?.name}</TableCell>
                <TableCell>{d.label}</TableCell>
                <TableCell>
                  <Button size="sm" variant={d.active ? "outline" : "secondary"} onClick={() => toggleDesk(d.id, !d.active)}>
                    {d.active ? "Đang mở — tắt" : "Đã tắt — bật lại"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
```

```bash
npx shadcn@latest add table 2>/dev/null
```

- [ ] **Step 4: Write `app/noi-bo/quan-ly/co-so/page.tsx`**

```tsx
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { BranchDeskManager } from "@/components/admin/BranchDeskManager"

export default async function BranchDeskPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const [{ data: branches }, { data: desks }] = await Promise.all([
    supabase.from("branches").select("id, code, name").order("name"),
    supabase.from("desks").select("id, branch_id, label, active").order("label"),
  ])

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Quản lý cơ sở & chỗ ngồi</h1>
      <BranchDeskManager branches={branches ?? []} desks={desks ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: Manual verification**

Log in as admin, visit `/noi-bo/quan-ly/co-so`. Add a branch, add a desk to it, toggle a desk off — expect it to disappear from the guest grid at `/` after refresh.

- [ ] **Step 6: Commit**

```bash
git add app/noi-bo/quan-ly/co-so actions/branches.ts actions/desks.ts lib/validations/branch.ts lib/validations/desk.ts components/admin/BranchDeskManager.tsx
git commit -m "feat: add admin branch and desk management"
git push
```

---

### Task 13: Admin — slot lock management (recurring weekly closures)

**Files:**
- Create: `app/noi-bo/quan-ly/khoa-lich/page.tsx`, `components/admin/SlotLockForm.tsx`, `components/admin/SlotLockTable.tsx`, `actions/slot-locks.ts`, `lib/validations/slot-lock.ts`

**Interfaces:**
- Produces: `createSlotLockAction`, `deactivateSlotLockAction`.

- [ ] **Step 1: Write `lib/validations/slot-lock.ts`**

```typescript
import { z } from "zod"

export const slotLockSchema = z.object({
  branchId: z.string().uuid(),
  deskId: z.string().uuid().nullable(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(200).optional(),
})
export type SlotLockInput = z.infer<typeof slotLockSchema>

export const DAY_LABELS: Record<number, string> = {
  1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật",
}
```

- [ ] **Step 2: Write `actions/slot-locks.ts`**

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { slotLockSchema } from "@/lib/validations/slot-lock"
import type { ActionResult } from "@/types"

export async function createSlotLockAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireAdmin()
  const parsed = slotLockSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("slot_locks")
    .insert({
      branch_id: parsed.data.branchId,
      desk_id: parsed.data.deskId,
      day_of_week: parsed.data.dayOfWeek,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      reason: parsed.data.reason,
      created_by: profile.id,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/khoa-lich")
  revalidatePath("/")
  return { ok: true, data: { id: data.id } }
}

export async function deactivateSlotLockAction(id: string): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from("slot_locks").update({ active: false }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/khoa-lich")
  revalidatePath("/")
  return { ok: true, data: null }
}
```

- [ ] **Step 3: Write `components/admin/SlotLockForm.tsx`**

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Branch = { id: string; name: string }
type Desk = { id: string; branch_id: string; label: string }

export function SlotLockForm({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  const [form, setForm] = useState({
    branchId: branches[0]?.id ?? "", deskId: "", dayOfWeek: 1, startTime: "08:00", endTime: "12:00", reason: "",
  })

  async function submit() {
    const result = await createSlotLockAction({
      branchId: form.branchId,
      deskId: form.deskId || null,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      reason: form.reason || undefined,
    })
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã khoá lịch")
  }

  const branchDesks = desks.filter((d) => d.branch_id === form.branchId)

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select className="rounded border px-2 py-2" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, deskId: "" })}>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select className="rounded border px-2 py-2" value={form.deskId} onChange={(e) => setForm({ ...form, deskId: e.target.value })}>
        <option value="">Cả cơ sở</option>
        {branchDesks.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
      <select className="rounded border px-2 py-2" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
        {Object.entries(DAY_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
      <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
      <Input placeholder="Lý do (tuỳ chọn)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      <Button onClick={submit}>Khoá</Button>
    </div>
  )
}
```

- [ ] **Step 4: Write `components/admin/SlotLockTable.tsx`**

```tsx
"use client"

import { toast } from "sonner"
import { deactivateSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Lock = { id: string; branch_name: string; desk_label: string | null; day_of_week: number; start_time: string; end_time: string; reason: string | null }

export function SlotLockTable({ locks }: { locks: Lock[] }) {
  async function deactivate(id: string) {
    const result = await deactivateSlotLockAction(id)
    if (!result.ok) toast.error(result.error)
    else toast.success("Đã mở lại")
  }

  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Cơ sở</TableHead><TableHead>Chỗ</TableHead><TableHead>Thứ</TableHead><TableHead>Giờ</TableHead><TableHead>Lý do</TableHead><TableHead /></TableRow>
      </TableHeader>
      <TableBody>
        {locks.map((l) => (
          <TableRow key={l.id}>
            <TableCell>{l.branch_name}</TableCell>
            <TableCell>{l.desk_label ?? "Cả cơ sở"}</TableCell>
            <TableCell>{DAY_LABELS[l.day_of_week]}</TableCell>
            <TableCell>{l.start_time}-{l.end_time}</TableCell>
            <TableCell>{l.reason ?? "—"}</TableCell>
            <TableCell><Button size="sm" variant="outline" onClick={() => deactivate(l.id)}>Mở lại</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 5: Write `app/noi-bo/quan-ly/khoa-lich/page.tsx`**

```tsx
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { SlotLockForm } from "@/components/admin/SlotLockForm"
import { SlotLockTable } from "@/components/admin/SlotLockTable"

export default async function SlotLockPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const [{ data: branches }, { data: desks }, { data: locks }] = await Promise.all([
    supabase.from("branches").select("id, name").order("name"),
    supabase.from("desks").select("id, branch_id, label").order("label"),
    supabase
      .from("slot_locks")
      .select("id, day_of_week, start_time, end_time, reason, branches(name), desks(label)")
      .eq("active", true),
  ])

  const rows = (locks ?? []).map((l: any) => ({
    id: l.id, branch_name: l.branches?.name ?? "", desk_label: l.desks?.label ?? null,
    day_of_week: l.day_of_week, start_time: l.start_time, end_time: l.end_time, reason: l.reason,
  }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Khoá / mở lịch</h1>
      <SlotLockForm branches={branches ?? []} desks={desks ?? []} />
      <SlotLockTable locks={rows} />
    </div>
  )
}
```

- [ ] **Step 6: Manual verification**

Log in as admin, visit `/noi-bo/quan-ly/khoa-lich`, lock "Thứ 2, 17:00-22:00, cả cơ sở" for Hoàng Gia. Visit `/`, navigate to the Monday of the current or next week — expect those cells to render as locked (`—`, not clickable). Click "Mở lại" — expect the cells to become free again.

- [ ] **Step 7: Commit**

```bash
git add app/noi-bo/quan-ly/khoa-lich components/admin/SlotLockForm.tsx components/admin/SlotLockTable.tsx actions/slot-locks.ts lib/validations/slot-lock.ts
git commit -m "feat: add admin recurring slot-lock management"
git push
```

---

### Task 14: Internal read-only calendar + admin book-on-behalf

**Files:**
- Create: `app/noi-bo/lich/page.tsx`, `components/schedule/InternalScheduleGridClient.tsx`
- Modify: `actions/registrations.ts` (add `createRegistrationAsAdminAction`)

**Interfaces:**
- Produces: `createRegistrationAsAdminAction(input: CreateRegistrationInput): Promise<ActionResult<{ id: string }>>` — `requireAdmin()`-gated, sets `p_admin_created: true`, skips the guest identity re-check.

- [ ] **Step 1: Add `createRegistrationAsAdminAction` to `actions/registrations.ts`**

Add these imports at the top and this function at the bottom of the existing `actions/registrations.ts`:

```typescript
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"

export async function createRegistrationAsAdminAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = createRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("create_registration", {
    p_desk_id: parsed.data.deskId,
    p_date: parsed.data.date,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_is_recurring: parsed.data.isRecurring,
    p_admin_created: true,
  })

  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Khung giờ này đã có người đặt" }
    return { ok: false, error: error.message }
  }

  revalidatePath("/noi-bo/lich")
  revalidatePath("/")
  return { ok: true, data: { id: data.id } }
}
```

- [ ] **Step 2: Write `components/schedule/InternalScheduleGridClient.tsx`**

Reuses `BookingDialog` from Task 9 unmodified, passing `action={createRegistrationAsAdminAction}` — no separate admin dialog component, no duplicated JSX/logic.

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { createRegistrationAsAdminAction } from "@/actions/registrations"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function InternalScheduleGridClient({
  desks, monday, registrations, locks, canBook,
}: { desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[]; canBook: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid
        desks={desks} monday={monday} registrations={registrations} locks={locks}
        onSlotClick={canBook ? setSelected : () => {}}
      />
      {canBook && selected && !selected.registration && (
        <BookingDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          deskId={selected.desk.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          action={createRegistrationAsAdminAction}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
```

`quan_sinh` gets `canBook={false}`, so clicks are inert — matching "chỉ xem, không tạo/sửa/huỷ".

- [ ] **Step 3: Write `app/noi-bo/lich/page.tsx`**

```tsx
import { requireProfile } from "@/lib/auth"
import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
import { getMondayOfWeek } from "@/lib/week"
import { BranchTabs } from "@/components/schedule/BranchTabs"
import { WeekPicker } from "@/components/schedule/WeekPicker"
import { InternalScheduleGridClient } from "@/components/schedule/InternalScheduleGridClient"

export default async function InternalCalendarPage({
  searchParams,
}: { searchParams: Promise<{ branch?: string; week?: string }> }) {
  const profile = await requireProfile()
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = params.branch ?? branches[0]?.id
  const monday = getMondayOfWeek(params.week ? new Date(params.week) : new Date())
  await materializeWeek(monday)
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Lịch tự học</h1>
      <div className="mb-4 flex items-center justify-between">
        {activeBranchId && <BranchTabs branches={branches} activeBranchId={activeBranchId} />}
        <WeekPicker monday={monday} />
      </div>
      {schedule && (
        <InternalScheduleGridClient
          desks={schedule.desks} monday={monday} registrations={schedule.registrations} locks={schedule.locks}
          canBook={profile.role === "admin"}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Manual verification**

Log in as admin, visit `/noi-bo/lich`, click a free slot, register a student — expect it to appear both there and on the public `/` grid. Log in as a `quan_sinh` account (create one manually via Supabase Studio with `role='quan_sinh'` for this check) — expect clicking any cell to do nothing.

- [ ] **Step 5: Commit**

```bash
git add app/noi-bo/lich components/schedule/InternalScheduleGridClient.tsx actions/registrations.ts
git commit -m "feat: add internal read-only calendar with admin book-on-behalf"
git push
```

---

### Task 15: Admin — student list and staff account management

**Files:**
- Create: `app/noi-bo/quan-ly/hoc-sinh/page.tsx`, `app/noi-bo/quan-ly/nhan-su/page.tsx`, `components/admin/StudentTable.tsx`, `components/admin/StaffForm.tsx`, `components/admin/StaffTable.tsx`, `actions/students.ts`, `actions/staff.ts`, `lib/validations/staff.ts`

**Interfaces:**
- Produces: `createStaffAction(input: StaffInput): Promise<ActionResult<{ id: string }>>` — uses `createAdminClient().auth.admin.createUser`.

- [ ] **Step 1: Write `lib/validations/staff.ts`**

```typescript
import { z } from "zod"

export const staffSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["admin", "quan_sinh"]),
})
export type StaffInput = z.infer<typeof staffSchema>
```

- [ ] **Step 2: Write `actions/staff.ts`**

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { staffSchema } from "@/lib/validations/staff"
import type { ActionResult } from "@/types"

export async function createStaffAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = staffSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const admin = createAdminClient()
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (userError || !userData.user) return { ok: false, error: userError?.message ?? "Không tạo được tài khoản" }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: userData.user.id, full_name: parsed.data.fullName, role: parsed.data.role })
  if (profileError) return { ok: false, error: profileError.message }

  revalidatePath("/noi-bo/quan-ly/nhan-su")
  return { ok: true, data: { id: userData.user.id } }
}
```

- [ ] **Step 3: Write `actions/students.ts`**

```typescript
"use server"

import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"

export async function getStudentHistoryAction(studentId: string) {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data } = await supabase
    .from("registrations")
    .select("date, start_time, end_time, status, source")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
  return data ?? []
}
```

- [ ] **Step 4: Write `components/admin/StudentTable.tsx`**

```tsx
"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Student = { id: string; full_name: string; phone: string; created_at: string }

export function StudentTable({ students }: { students: Student[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>SĐT</TableHead><TableHead>Ngày tạo</TableHead></TableRow></TableHeader>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.id}>
            <TableCell>{s.full_name}</TableCell>
            <TableCell>{s.phone}</TableCell>
            <TableCell>{new Date(s.created_at).toLocaleDateString("vi-VN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 5: Write `components/admin/StaffForm.tsx` and `StaffTable.tsx`**

`StaffForm.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createStaffAction } from "@/actions/staff"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function StaffForm() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "quan_sinh" as "admin" | "quan_sinh" })

  async function submit() {
    const result = await createStaffAction(form)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã tạo tài khoản")
    setForm({ fullName: "", email: "", password: "", role: "quan_sinh" })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input placeholder="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Input placeholder="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <select className="rounded border px-2 py-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "quan_sinh" })}>
        <option value="quan_sinh">Quản sinh</option>
        <option value="admin">Admin</option>
      </select>
      <Button onClick={submit}>Tạo tài khoản</Button>
    </div>
  )
}
```

`StaffTable.tsx`:

```tsx
"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Staff = { id: string; full_name: string; role: string }

export function StaffTable({ staff }: { staff: Staff[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Vai trò</TableHead></TableRow></TableHeader>
      <TableBody>
        {staff.map((s) => (
          <TableRow key={s.id}><TableCell>{s.full_name}</TableCell><TableCell>{s.role === "admin" ? "Admin" : "Quản sinh"}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 6: Write the two pages**

`app/noi-bo/quan-ly/hoc-sinh/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { StudentTable } from "@/components/admin/StudentTable"

export default async function StudentsPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data: students } = await supabase.from("students").select("id, full_name, phone, created_at").order("full_name")

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Học sinh</h1>
      <StudentTable students={students ?? []} />
    </div>
  )
}
```

`app/noi-bo/quan-ly/nhan-su/page.tsx`:

```tsx
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { StaffForm } from "@/components/admin/StaffForm"
import { StaffTable } from "@/components/admin/StaffTable"

export default async function StaffPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data: staff } = await supabase.from("profiles").select("id, full_name, role").order("full_name")

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nhân sự</h1>
      <StaffForm />
      <StaffTable staff={staff ?? []} />
    </div>
  )
}
```

- [ ] **Step 7: Manual verification**

Log in as admin, visit `/noi-bo/quan-ly/hoc-sinh` — expect students created in earlier tasks' testing to appear. Visit `/noi-bo/quan-ly/nhan-su`, create a `quan_sinh` account, log out, log in as that account — expect `/noi-bo/quan-ly/*` to redirect away (per `requireAdmin()`).

- [ ] **Step 8: Commit**

```bash
git add app/noi-bo/quan-ly/hoc-sinh app/noi-bo/quan-ly/nhan-su components/admin/StudentTable.tsx components/admin/StaffForm.tsx components/admin/StaffTable.tsx actions/students.ts actions/staff.ts lib/validations/staff.ts
git commit -m "feat: add admin student list and staff account management"
git push
```

---

### Task 16: Dashboard data library + unit tests

**Files:**
- Create: `lib/dashboard.ts`
- Test: `tests/unit/dashboard.test.ts`

**Interfaces:**
- Produces: `computeOccupancy(desks, registrations, locks, dates): OccupancyRow[]`, `findMissingRegistrations(recurring, registrations, weekMonday): MissingStudent[]`, `computeFrequencyRanking(registrations, sinceDate): FrequencyRow[]` — all pure functions, no I/O, so they're unit-testable without a live database.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/dashboard.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { computeOccupancy, findMissingRegistrations, computeFrequencyRanking } from "@/lib/dashboard"

describe("computeOccupancy", () => {
  it("computes booked/total/locked per desk-day and rolls up a rate", () => {
    const desks = [{ id: "d1", label: "Chỗ 1" }]
    const registrations = [{ deskId: "d1", date: "2026-08-17", startTime: "08:00", endTime: "08:30" }]
    const locks: { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }[] = []
    const result = computeOccupancy(desks, registrations, locks, ["2026-08-17"])
    expect(result[0].totalSlots).toBe(24)
    expect(result[0].bookedSlots).toBe(1)
    expect(result[0].rate).toBeCloseTo(1 / 24)
  })

  it("excludes locked slots from the available total", () => {
    const desks = [{ id: "d1", label: "Chỗ 1" }]
    const locks = [{ deskId: "d1", dayOfWeek: 1, startTime: "08:00", endTime: "22:00" }]
    const result = computeOccupancy(desks, [], locks, ["2026-08-17"])
    expect(result[0].totalSlots).toBe(0)
  })
})

describe("findMissingRegistrations", () => {
  it("flags a student with an active recurring rule but no registration this week", () => {
    const recurring = [{ studentId: "s1", studentName: "A", dayOfWeek: 1, active: true }]
    const registrations: { studentId: string; date: string }[] = []
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(1)
    expect(missing[0].studentName).toBe("A")
  })

  it("does not flag a student who already has a registration this week", () => {
    const recurring = [{ studentId: "s1", studentName: "A", dayOfWeek: 1, active: true }]
    const registrations = [{ studentId: "s1", date: "2026-08-17" }]
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(0)
  })
})

describe("computeFrequencyRanking", () => {
  it("counts active sessions per student since a date, descending", () => {
    const registrations = [
      { studentId: "s1", studentName: "A", date: "2026-08-17", status: "active" as const },
      { studentId: "s1", studentName: "A", date: "2026-08-18", status: "active" as const },
      { studentId: "s2", studentName: "B", date: "2026-08-18", status: "active" as const },
      { studentId: "s1", studentName: "A", date: "2026-08-10", status: "active" as const },
    ]
    const ranking = computeFrequencyRanking(registrations, "2026-08-15")
    expect(ranking[0]).toEqual({ studentId: "s1", studentName: "A", count: 2 })
    expect(ranking[1]).toEqual({ studentId: "s2", studentName: "B", count: 1 })
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/unit/dashboard.test.ts`
Expected: FAIL — `lib/dashboard` doesn't exist.

- [ ] **Step 3: Implement `lib/dashboard.ts`**

```typescript
import { TIME_SLOTS } from "@/lib/time-slots"

export type OccupancyRow = { deskId: string; date: string; totalSlots: number; bookedSlots: number; rate: number }

export function computeOccupancy(
  desks: { id: string; label: string }[],
  registrations: { deskId: string; date: string; startTime: string; endTime: string }[],
  locks: { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }[],
  dates: string[]
): OccupancyRow[] {
  return desks.flatMap((desk) =>
    dates.map((date) => {
      const isoDow = ((new Date(date).getDay() + 6) % 7) + 1
      const availableSlots = TIME_SLOTS.filter(
        (slot) =>
          !locks.some(
            (l) => (l.deskId === desk.id || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < slot.end && l.endTime > slot.start
          )
      )
      const booked = registrations.filter((r) => r.deskId === desk.id && r.date === date).length
      return {
        deskId: desk.id,
        date,
        totalSlots: availableSlots.length,
        bookedSlots: booked,
        rate: availableSlots.length === 0 ? 0 : booked / availableSlots.length,
      }
    })
  )
}

export type MissingStudent = { studentId: string; studentName: string }

export function findMissingRegistrations(
  recurring: { studentId: string; studentName: string; dayOfWeek: number; active: boolean }[],
  registrations: { studentId: string; date: string }[],
  weekMonday: string
): MissingStudent[] {
  const monday = new Date(weekMonday)
  const weekDates = new Set(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  )
  const registeredStudentIds = new Set(registrations.filter((r) => weekDates.has(r.date)).map((r) => r.studentId))

  return recurring
    .filter((r) => r.active && !registeredStudentIds.has(r.studentId))
    .map((r) => ({ studentId: r.studentId, studentName: r.studentName }))
}

export type FrequencyRow = { studentId: string; studentName: string; count: number }

export function computeFrequencyRanking(
  registrations: { studentId: string; studentName: string; date: string; status: "active" | "cancelled" }[],
  sinceDate: string
): FrequencyRow[] {
  const counts = new Map<string, FrequencyRow>()
  for (const r of registrations) {
    if (r.status !== "active" || r.date < sinceDate) continue
    const existing = counts.get(r.studentId)
    if (existing) existing.count += 1
    else counts.set(r.studentId, { studentId: r.studentId, studentName: r.studentName, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/unit/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard.ts tests/unit/dashboard.test.ts
git commit -m "feat: add pure dashboard metric functions (occupancy, missing, frequency)"
git push
```

---

### Task 17: Dashboard page UI

**Files:**
- Create: `app/noi-bo/dashboard/page.tsx`, `components/dashboard/OccupancyChart.tsx`, `components/dashboard/MissingRegistrationsList.tsx`, `components/dashboard/TrendChart.tsx`, `components/dashboard/FrequencyRanking.tsx`

**Interfaces:**
- Consumes: `computeOccupancy`, `findMissingRegistrations`, `computeFrequencyRanking` from Task 16.

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Write the four dashboard components**

`components/dashboard/OccupancyChart.tsx`:

```tsx
"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import type { OccupancyRow } from "@/lib/dashboard"

export function OccupancyChart({ rows }: { rows: OccupancyRow[] }) {
  const byDate = Object.values(
    rows.reduce<Record<string, { date: string; booked: number; total: number }>>((acc, r) => {
      acc[r.date] ??= { date: r.date, booked: 0, total: 0 }
      acc[r.date].booked += r.bookedSlots
      acc[r.date].total += r.totalSlots
      return acc
    }, {})
  ).map((d) => ({ ...d, rate: d.total === 0 ? 0 : Math.round((d.booked / d.total) * 100) }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={byDate}>
        <XAxis dataKey="date" fontSize={12} />
        <YAxis unit="%" fontSize={12} />
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Bar dataKey="rate" fill="#3b82f6" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

`components/dashboard/MissingRegistrationsList.tsx`:

```tsx
import type { MissingStudent } from "@/lib/dashboard"

export function MissingRegistrationsList({ students }: { students: MissingStudent[] }) {
  if (students.length === 0) return <p className="text-sm text-muted-foreground">Mọi học sinh cố định đã đăng ký tuần này.</p>
  return (
    <ul className="flex flex-col gap-1">
      {students.map((s) => (
        <li key={s.studentId} className="text-sm">{s.studentName}</li>
      ))}
    </ul>
  )
}
```

`components/dashboard/TrendChart.tsx`:

```tsx
"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export function TrendChart({ points }: { points: { period: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points}>
        <XAxis dataKey="period" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

`components/dashboard/FrequencyRanking.tsx`:

```tsx
import type { FrequencyRow } from "@/lib/dashboard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function FrequencyRanking({ rows }: { rows: FrequencyRow[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Học sinh</TableHead><TableHead>Số buổi</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.slice(0, 20).map((r) => (
          <TableRow key={r.studentId}><TableCell>{r.studentName}</TableCell><TableCell>{r.count}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 3: Write `app/noi-bo/dashboard/page.tsx`**

```tsx
import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"
import { computeOccupancy, findMissingRegistrations, computeFrequencyRanking } from "@/lib/dashboard"
import { OccupancyChart } from "@/components/dashboard/OccupancyChart"
import { MissingRegistrationsList } from "@/components/dashboard/MissingRegistrationsList"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { FrequencyRanking } from "@/components/dashboard/FrequencyRanking"
import { format, subWeeks } from "date-fns"

export default async function DashboardPage() {
  await requireProfile()
  const supabase = await createServerClient()
  const monday = getMondayOfWeek(new Date())
  const weekDates = getWeekDates(monday).map((d) => format(d, "yyyy-MM-dd"))
  const eightWeeksAgo = format(subWeeks(monday, 8), "yyyy-MM-dd")

  const [{ data: desks }, { data: registrations }, { data: locks }, { data: recurring }] = await Promise.all([
    supabase.from("desks").select("id, label").eq("active", true),
    supabase.from("registrations").select("student_id, student_name, desk_id, date, start_time, end_time, status").gte("date", eightWeeksAgo),
    supabase.from("slot_locks").select("desk_id, day_of_week, start_time, end_time").eq("active", true),
    supabase.from("recurring_registrations").select("student_id, student_name, day_of_week, active").eq("active", true),
  ])

  const occupancy = computeOccupancy(
    desks ?? [],
    (registrations ?? []).map((r) => ({ deskId: r.desk_id, date: r.date, startTime: r.start_time, endTime: r.end_time })),
    (locks ?? []).map((l) => ({ deskId: l.desk_id, dayOfWeek: l.day_of_week, startTime: l.start_time, endTime: l.end_time })),
    weekDates
  )

  const missing = findMissingRegistrations(
    (recurring ?? []).map((r) => ({ studentId: r.student_id, studentName: r.student_name, dayOfWeek: r.day_of_week, active: r.active })),
    (registrations ?? []).map((r) => ({ studentId: r.student_id, date: r.date })),
    format(monday, "yyyy-MM-dd")
  )

  const ranking = computeFrequencyRanking(
    (registrations ?? []).map((r) => ({ studentId: r.student_id, studentName: r.student_name, date: r.date, status: r.status })),
    format(subWeeks(monday, 4), "yyyy-MM-dd")
  )

  const trendByWeek = new Map<string, number>()
  for (const r of registrations ?? []) {
    if (r.status !== "active") continue
    const weekKey = format(getMondayOfWeek(new Date(r.date)), "dd/MM")
    trendByWeek.set(weekKey, (trendByWeek.get(weekKey) ?? 0) + 1)
  }
  const trendPoints = [...trendByWeek.entries()].map(([period, count]) => ({ period, count }))

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Dashboard thống kê</h1>
      <section>
        <h2 className="mb-2 font-medium">Tỷ lệ lấp đầy tuần này</h2>
        <OccupancyChart rows={occupancy} />
      </section>
      <section>
        <h2 className="mb-2 font-medium">Học sinh chưa đăng ký tuần này</h2>
        <MissingRegistrationsList students={missing} />
      </section>
      <section>
        <h2 className="mb-2 font-medium">Xu hướng đăng ký theo tuần (8 tuần gần nhất)</h2>
        <TrendChart points={trendPoints} />
      </section>
      <section>
        <h2 className="mb-2 font-medium">Xếp hạng tần suất học (4 tuần gần nhất)</h2>
        <FrequencyRanking rows={ranking} />
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Manual verification**

Log in as admin or `quan_sinh`, visit `/noi-bo/dashboard`. Expect all 4 sections to render without error (empty states are fine if there's little test data — book a few slots across different weeks first to see non-trivial charts).

- [ ] **Step 5: Commit**

```bash
git add app/noi-bo/dashboard components/dashboard package.json package-lock.json
git commit -m "feat: add stats dashboard (occupancy, missing, trend, frequency)"
git push
```

---

### Task 18: Lark Base one-time import script

**Files:**
- Create: `scripts/import-lark.ts`, `scripts/lark-export-sample.csv`

**Interfaces:**
- Produces: a standalone Node script, not imported by app code. Run manually once during setup.

- [ ] **Step 1: Write a sample CSV to develop against**

Create `scripts/lark-export-sample.csv`:

```csv
lark_record_id,full_name,phone
rec001,Nguyễn Văn A,0900000010
rec002,Trần Thị B,0900000011
```

- [ ] **Step 2: Write `scripts/import-lark.ts`**

```typescript
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

type LarkRow = { lark_record_id: string; full_name: string; phone: string }

function parseCsv(path: string): LarkRow[] {
  const lines = readFileSync(path, "utf-8").trim().split("\n")
  const [header, ...rows] = lines
  const cols = header.split(",")
  return rows.map((line) => {
    const values = line.split(",")
    const row = Object.fromEntries(cols.map((c, i) => [c, values[i]])) as LarkRow
    return row
  })
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error("Usage: tsx scripts/import-lark.ts <path-to-export.csv>")
    process.exit(1)
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const rows = parseCsv(csvPath)

  let imported = 0
  let skipped = 0
  for (const row of rows) {
    const { error } = await supabase
      .from("students")
      .upsert({ full_name: row.full_name, phone: row.phone, lark_record_id: row.lark_record_id }, { onConflict: "phone" })
    if (error) {
      console.error(`Skipped ${row.full_name} (${row.phone}): ${error.message}`)
      skipped += 1
    } else {
      imported += 1
    }
  }

  console.log(`Imported ${imported} students, skipped ${skipped}.`)
}

main()
```

- [ ] **Step 3: Add a run script and tsx dependency**

```bash
npm install -D tsx
```

Add to `package.json` scripts: `"import:lark": "tsx scripts/import-lark.ts"`.

- [ ] **Step 4: Verify against the sample CSV**

Run: `npm run import:lark scripts/lark-export-sample.csv`
Expected: `Imported 2 students, skipped 0.` Verify in Supabase Studio that both rows appear in `students` with `lark_record_id` set.

- [ ] **Step 5: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "feat: add one-time Lark Base CSV import script"
git push
```

---

### Task 19: End-to-end golden path test

**Files:**
- Create: `tests/e2e/booking.spec.ts`, `playwright.config.ts`
- Modify: `components/schedule/SlotCell.tsx` already has `data-testid` from Task 8.

**Interfaces:**
- Consumes: the full running app (`npm run dev`) + local Supabase (`supabase start`).

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  use: { baseURL: "http://localhost:3000" },
})
```

- [ ] **Step 3: Write `tests/e2e/booking.spec.ts`**

```typescript
import { test, expect } from "@playwright/test"

test("guest books a slot, it appears on the grid, wrong-credential cancel is rejected, correct cancel succeeds", async ({ page }) => {
  await page.goto("/")

  const freeCell = page.locator('[data-testid^="slot-08:00"]').first()
  await freeCell.click()

  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0912345678")
  await page.getByRole("button", { name: "Xác nhận" }).click()

  await expect(page.getByText("Đăng ký thành công!")).toBeVisible()

  const bookedCell = page.getByTitle("Playwright Tester")
  await expect(bookedCell).toBeVisible()
  await bookedCell.click()

  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0999999999")
  await page.getByRole("button", { name: "Xác nhận huỷ" }).click()
  await expect(page.getByText("Tên hoặc số điện thoại không khớp")).toBeVisible()

  await bookedCell.click()
  await page.getByLabel("Họ tên").fill("Playwright Tester")
  await page.getByLabel("Số điện thoại").fill("0912345678")
  await page.getByRole("button", { name: "Xác nhận huỷ" }).click()
  await expect(page.getByText("Đã huỷ đăng ký")).toBeVisible()
})
```

Add to `package.json` scripts: `"test:e2e": "playwright test"`.

- [ ] **Step 4: Run and verify**

Run: `supabase db reset && npx playwright test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e playwright.config.ts package.json package-lock.json
git commit -m "test: add E2E golden path (book, wrong-credential reject, correct cancel)"
git push
```

---

## Self-Review Notes

- **Spec coverage:** §2 roles/access → Tasks 5–6, 14–15. §3 tech stack → Task 1. §4 data model → Tasks 2–3. §5 guest flow → Tasks 7–11. §6 admin features → Tasks 12–15. §7 dashboard → Tasks 16–17. §8 Lark import → Task 18. §9 out-of-scope items are deliberately absent from every task. §10 testing → unit tests in Tasks 4/16, integration in Task 3, E2E in Task 19.
- **Type consistency checked:** `Desk`/`RegistrationRow`/`SlotLock` (Task 7) are reused verbatim by `ScheduleGrid` (Task 8), `ScheduleGridClient`/`InternalScheduleGridClient` (Tasks 9, 14), and `lib/dashboard.ts` consumers (Task 17) via inline mapping — field names (`deskId`, `startTime`, `studentName`, …) match across every task. `CreateRegistrationInput`/`CancelRegistrationInput` (Task 4) are the single shape used by both guest and admin actions (Tasks 9, 14). `day_of_week`/`dayOfWeek` is ISO 1–7 in every SQL and TS reference, per the Global Constraints.
- **No placeholders:** every step has runnable code or an exact shell command; no "TBD"/"add validation" style steps remain.
- **Fixed during self-review:** Task 8's `SlotCell` gained a `data-testid={\`slot-${slot.start}\`}` prop (originally missing its `slot` destructure) so Task 19's E2E test has a stable selector instead of matching on empty button text; the `OccupancyChart`/`TrendChart` color props were changed from unresolvable `var(--color-blue-500, ...)` CSS-var guesses to plain hex fallbacks since the exact reference-app token names aren't confirmed until Task 1 actually copies `globals.css`.
