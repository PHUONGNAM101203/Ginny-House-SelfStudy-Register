# Kế hoạch triển khai: Chatbot thời gian thực Guest ↔ Admin/Quản sinh

> **✅ HOÀN THÀNH 2026-08-22.** Cả 9 task đã triển khai, kiểm thử end-to-end và lên production (ginnyhouse.space). Khác với thiết kế ban đầu: giao diện phía staff (Task 8) là **floating popup góc dưới-phải** (giống hệt guest), không phải icon trên header + trang riêng — trang `/noi-bo/quan-ly/chat` vẫn còn nhưng chỉ là điểm đến phụ cho link trong notification. Có thêm một cải tiến ngoài kế hoạch: kênh broadcast cố định `chat:staff-inbox` để staff thấy guest xuất hiện ngay lập tức thay vì chờ poll 30 giây.

> **Dành cho agent thực thi:** BẮT BUỘC dùng skill superpowers:subagent-driven-development (khuyến nghị) hoặc superpowers:executing-plans để triển khai kế hoạch này theo từng task. Các bước dùng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Cho phép guest (học sinh, không đăng nhập) chat trực tiếp, thời gian thực, với admin/quản sinh trong đúng khoảng thời gian ca đăng ký tự học của họ; mỗi guest chỉ thấy được cuộc chat của chính mình, không thấy/chat được với guest khác; phiên chat tự động hết hiệu lực khi ca học kết thúc.

**Kiến trúc:**
- Mỗi `registration` (lượt đăng ký) có một `chat_session` 1-1, được tạo "lười" (lazy) ngay lần đầu guest hoặc staff mở khung chat.
- Guest không có tài khoản — "credential" của guest chính là `registration_id` mà trình duyệt của họ đã giữ sẵn (giống hệt cách `cancelRegistrationAction`/`requestRegistrationChangeAction` đã tin tưởng UUID này làm định danh, không cần đăng nhập thêm).
- Mọi thao tác đọc/ghi tin nhắn của guest đi qua RPC `SECURITY DEFINER` (không cấp quyền `select`/`insert` bảng `chat_messages` trực tiếp cho `anon`) — RPC tự kiểm tra "hiện tại có nằm trong khung giờ ca đăng ký hay không" mỗi lần gọi.
- Cập nhật thời gian thực dùng **Supabase Realtime Broadcast** trên kênh đặt tên `chat:<session_id>` — không dùng Postgres Changes (vì Postgres Changes bắt buộc guest phải vượt qua RLS trên bảng thật, mà `anon` không có định danh riêng để RLS lọc theo từng guest). Tên kênh chứa UUID không đoán được đóng vai trò "vé vào phòng" — cùng mô hình tin tưởng UUID đã dùng cho `registration_id` ở các luồng huỷ/đổi lịch hiện có.
- Staff (admin + quản sinh) không bị giới hạn theo khung giờ — có trang inbox nội bộ liệt kê mọi phiên đang active.
- Tin nhắn mới từ guest tạo thêm một `notification` (loại `chat_message`), tái dùng bảng `notifications` đã có (migration 0006).

**Tech Stack:** Next.js Server Actions, Supabase Postgres (RLS + RPC `SECURITY DEFINER`), Supabase Realtime Broadcast (`@supabase/supabase-js` client-side `channel()`), Zod, react-hook-form (không cần cho khung chat, chỉ cần cho form input đơn giản).

## Ràng buộc chung (Global Constraints)

- Giờ hệ thống dùng cho việc "còn trong ca hay không" luôn tính theo giờ Việt Nam (`lib/vn-date.ts`'s `VN_TIME_ZONE = "Asia/Ho_Chi_Minh"`), không dùng giờ UTC thô hay giờ trình duyệt.
- Không tạo bảng/kênh nào cho phép `anon` liệt kê được danh sách toàn bộ phiên chat hoặc tin nhắn của người khác — mọi truy cập của `anon` phải đi qua một `registration_id` cụ thể mà client đã có sẵn.
- Không dùng `console.log`. Không dùng màu sắc/token CSS tuỳ tiện — tái dùng class Tailwind + component `ui/` đã có (`Button`, `Input`, `Textarea`, `DropdownMenu`...).
- Toàn bộ text hiển thị bằng tiếng Việt (đúng phong cách hiện tại của app).
- Sau khi ca học kết thúc (`now >= date + end_time`), khung chat của guest phải tự ẩn/khoá — không cần cron, chỉ cần kiểm tra thời gian mỗi lần render + mỗi lần gọi RPC.
- Không xoá lịch sử tin nhắn khi phiên kết thúc — chỉ khoá gửi tin mới.

---

### Task 1: Migration — bảng `chat_sessions`, `chat_messages`, cột `zalo_contact`, RPC, tích hợp notification

**Files:**
- Create: `supabase/migrations/0007_chat.sql`

**Interfaces:**
- Produces: bảng `chat_sessions(id, registration_id, status, created_at, ended_at)`, bảng `chat_messages(id, session_id, sender_role, sender_profile_id, body, created_at)`, cột `registrations.zalo_contact text`.
- Produces: RPC `get_or_create_chat_session(p_registration_id uuid) returns chat_sessions` (gọi được bởi `anon`, `authenticated`).
- Produces: RPC `send_guest_chat_message(p_registration_id uuid, p_body text) returns chat_messages` (gọi được bởi `anon`, `authenticated`).
- Produces: RPC `send_staff_chat_message(p_session_id uuid, p_body text) returns chat_messages` (chỉ `authenticated`, yêu cầu `is_staff()`).
- Produces: hàm helper SQL `chat_session_is_open(p_registration_id uuid) returns boolean` — dùng chung bởi 2 RPC ở trên để tránh lặp logic kiểm tra khung giờ.

- [ ] **Bước 1: Viết migration**

```sql
-- supabase/migrations/0007_chat.sql
-- Chat thời gian thực giữa guest (đang trong ca đăng ký tự học) và
-- admin/quản sinh. Guest không có tài khoản — "chứng chỉ" truy cập của họ
-- là registration_id mà trình duyệt đã giữ từ lúc đặt chỗ, giống hệt cách
-- cancelRegistrationAction/requestRegistrationChangeAction đã tin tưởng
-- UUID này mà không cần thêm bước đăng nhập. Vì vậy KHÔNG cấp select/insert
-- trực tiếp trên chat_messages cho anon — mọi truy cập của guest đi qua RPC
-- SECURITY DEFINER, tự kiểm tra registration_id hợp lệ và còn trong khung
-- giờ ca học ở mỗi lần gọi.

alter table registrations add column zalo_contact text;

create type chat_session_status as enum ('active', 'ended');
create type chat_sender_role as enum ('guest', 'staff');

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete cascade,
  status chat_session_status not null default 'active',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  sender_role chat_sender_role not null,
  sender_profile_id uuid references profiles(id),
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index chat_messages_session_id_idx on chat_messages (session_id, created_at);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

-- Chỉ staff mới có quyền SELECT trực tiếp trên 2 bảng này (dùng cho trang
-- inbox nội bộ, liệt kê mọi phiên đang active). Guest KHÔNG có policy nào
-- ở đây — luôn đi qua RPC bên dưới.
create policy chat_sessions_staff_select on chat_sessions for select using (is_staff());
create policy chat_messages_staff_select on chat_messages for select using (is_staff());

-- Dùng chung bởi cả 2 RPC gửi tin nhắn — kiểm tra registration còn active
-- VÀ thời điểm hiện tại (giờ Việt Nam) còn nằm trong [date+start_time,
-- date+end_time). Sau khi ca kết thúc, hàm này trả về false, RPC sẽ từ
-- chối gửi tin mới — không cần cron để "đóng" phiên, chỉ cần kiểm tra
-- ngay tại thời điểm gọi.
create or replace function chat_session_is_open(p_registration_id uuid)
returns boolean
language plpgsql stable set search_path = public as $$
declare
  v_reg registrations;
  v_now_vn timestamp;
begin
  select * into v_reg from registrations where id = p_registration_id and status = 'active';
  if v_reg is null then
    return false;
  end if;

  v_now_vn := now() at time zone 'Asia/Ho_Chi_Minh';
  return v_now_vn >= (v_reg.date + v_reg.start_time) and v_now_vn < (v_reg.date + v_reg.end_time);
end;
$$;

create or replace function get_or_create_chat_session(p_registration_id uuid)
returns chat_sessions
language plpgsql security definer set search_path = public as $$
declare
  v_session chat_sessions;
begin
  if not chat_session_is_open(p_registration_id) then
    raise exception 'Chat is not open for this registration';
  end if;

  select * into v_session from chat_sessions where registration_id = p_registration_id;
  if v_session is not null then
    return v_session;
  end if;

  insert into chat_sessions (registration_id) values (p_registration_id)
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function send_guest_chat_message(p_registration_id uuid, p_body text)
returns chat_messages
language plpgsql security definer set search_path = public as $$
declare
  v_session chat_sessions;
  v_reg registrations;
  v_message chat_messages;
begin
  v_session := get_or_create_chat_session(p_registration_id);
  select * into v_reg from registrations where id = p_registration_id;

  insert into chat_messages (session_id, sender_role, body)
  values (v_session.id, 'guest', p_body)
  returning * into v_message;

  -- Báo cho admin + quản sinh biết có tin nhắn mới từ guest, tái dùng
  -- bảng notifications đã có (migration 0006). Không dedupe_key vì mỗi
  -- tin nhắn là một sự kiện riêng biệt, không phải trạng thái cần gộp.
  insert into notifications (type, title, body, link, target_role)
  values (
    'chat_message',
    'Tin nhắn chat mới',
    v_reg.student_name || case when v_reg.class_name is not null then ' · ' || v_reg.class_name else '' end
      || ': ' || left(p_body, 100),
    '/noi-bo/quan-ly/chat',
    null
  );

  return v_message;
end;
$$;

create or replace function send_staff_chat_message(p_session_id uuid, p_body text)
returns chat_messages
language plpgsql security definer set search_path = public as $$
declare
  v_message chat_messages;
begin
  if not is_staff() then
    raise exception 'Only staff can send from this function';
  end if;

  insert into chat_messages (session_id, sender_role, sender_profile_id, body)
  values (p_session_id, 'staff', auth.uid(), p_body)
  returning * into v_message;

  return v_message;
end;
$$;

-- Thêm loại notification mới vào enum đã tạo ở migration 0006. ALTER TYPE
-- ADD VALUE không thể chạy trong cùng transaction với câu lệnh dùng giá
-- trị đó ngay sau — nhưng vì hàm send_guest_chat_message ở trên được định
-- nghĩa (không thực thi) trong cùng migration, và Postgres chỉ resolve giá
-- trị enum lúc RUNTIME (không phải lúc CREATE FUNCTION), nên thứ tự này an
-- toàn: ALTER TYPE phải đứng TRƯỚC bất kỳ INSERT/RPC nào thực sự dùng giá
-- trị 'chat_message' — ở migration sau (không phải migration này) nếu có
-- dữ liệu insert trực tiếp. Ở đây an toàn vì send_guest_chat_message chỉ
-- được gọi (không phải chạy ngay) sau khi migration này commit xong.
alter type notification_type add value 'chat_message';

grant execute on function get_or_create_chat_session to anon, authenticated;
grant execute on function send_guest_chat_message to anon, authenticated;
grant execute on function send_staff_chat_message to authenticated;
grant select on chat_sessions to authenticated;
grant select on chat_messages to authenticated;
```

- [ ] **Bước 2: Kiểm tra migration áp dụng sạch**

Chạy: `npx supabase db reset`
Kết quả mong đợi: tất cả migration (kể cả `0007_chat.sql`) apply thành công, không lỗi.

- [ ] **Bước 3: Kiểm tra thủ công bằng RPC (không qua UI)**

Viết một script Node throwaway (theo đúng cách các phase trước trong dự án này đã làm — đặt file `.mjs` ngay trong thư mục gốc dự án để Node ESM resolve được `node_modules`, xoá sau khi xong), gọi:
1. Tạo 1 `registrations` row có `date`/`start_time`/`end_time` trùng với "bây giờ" (giờ Việt Nam) — dùng service-role client để chèn thẳng.
2. Gọi `get_or_create_chat_session` bằng anon client → kỳ vọng trả về session, không lỗi.
3. Gọi `send_guest_chat_message` → kỳ vọng chèn được message, và có 1 row mới trong `notifications` với `type = 'chat_message'`.
4. Tạo 1 registration khác có `end_time` đã qua (ví dụ giờ kết thúc là 1 tiếng trước) → gọi `get_or_create_chat_session` → kỳ vọng RPC raise exception "Chat is not open for this registration".
5. Đăng nhập admin (service-role tạo user + profile, giống các phase trước) → gọi `send_staff_chat_message` → kỳ vọng thành công, `sender_profile_id` đúng admin đó.

- [ ] **Bước 4: Commit**

```bash
git add supabase/migrations/0007_chat.sql
git commit -m "feat: chat_sessions/chat_messages tables, RPCs, notification integration"
```

---

### Task 2: Trường "Zalo liên hệ" trong form đặt chỗ

**Files:**
- Modify: `lib/validations/registration.ts`
- Modify: `components/booking/BookingDialog.tsx`
- Modify: `actions/registrations.ts` (truyền `p_zalo_contact` — **lưu ý:** đây là tham số MỚI chèn vào RPC `create_registration`, phải áp dụng đúng bài học từ migration 0005: `drop function if exists create_registration(...)` với đúng chữ ký 9-tham số hiện tại trước khi `create function` với tham số thứ 10, nếu không sẽ tạo overload trùng và làm `grant execute` (không kèm kiểu tham số) bị "not unique" — xem lại `supabase/migrations/0005_class_name_and_change_requests.sql` dòng 11-17 để hiểu lỗi gốc.)
- Modify: `supabase/migrations/0007_chat.sql` (thêm đoạn drop+recreate `create_registration` vào cuối file, SAU phần chat ở Task 1 — cùng 1 migration, không tạo file mới)

**Interfaces:**
- Consumes: `createRegistrationSchema` hiện có (từ Task đã hoàn thành ở phase trước — có `className`).
- Produces: `createRegistrationSchema` có thêm field optional `zaloContact: z.string().trim().max(50).optional()`.

- [ ] **Bước 1: Thêm field vào schema**

```typescript
// lib/validations/registration.ts — thêm vào createRegistrationSchema, ngay sau className
zaloContact: z.string().trim().max(50).optional(),
```

- [ ] **Bước 2: Thêm đoạn drop + recreate `create_registration` vào cuối `0007_chat.sql`**

```sql
-- Thêm p_zalo_contact vào cuối danh sách tham số (default null) để khớp
-- đúng bài học ở migration 0005: chèn tham số MỚI vào giữa danh sách sẽ
-- tạo overload trùng, phải drop chữ ký cũ trước.
drop function if exists create_registration(uuid, date, time, time, text, text, text, boolean, boolean);

create function create_registration(
  p_desk_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_full_name text,
  p_phone text,
  p_class_name text default null,
  p_is_recurring boolean default false,
  p_admin_created boolean default false,
  p_zalo_contact text default null
) returns registrations
language plpgsql security definer set search_path = public as $$
-- (thân hàm giữ nguyên như migration 0005, chỉ thêm zalo_contact vào
-- insert into registrations — sao chép lại toàn bộ logic, không được bỏ
-- sót phần kiểm tra slot_locks/is_admin đã có)
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
    status, source, student_name, class_name, zalo_contact, created_by
  ) values (
    v_student_id, v_branch_id, p_desk_id, p_date, p_start_time, p_end_time,
    'active',
    case when p_admin_created then 'admin_manual'::registration_source else 'guest_self'::registration_source end,
    p_full_name,
    p_class_name,
    p_zalo_contact,
    auth.uid()
  ) returning * into v_registration;

  if p_is_recurring then
    insert into recurring_registrations (
      student_id, branch_id, desk_id, day_of_week, start_time, end_time, student_name, class_name, created_by
    ) values (
      v_student_id, v_branch_id, p_desk_id, v_day_of_week, p_start_time, p_end_time, p_full_name, p_class_name, auth.uid()
    ) returning id into v_recurring_id;

    update registrations set recurring_registration_id = v_recurring_id where id = v_registration.id;
    v_registration.recurring_registration_id := v_recurring_id;
  end if;

  return v_registration;
end;
$$;

grant execute on function create_registration to anon, authenticated;
```

- [ ] **Bước 3: Thêm UI field**

```typescript
// components/booking/BookingDialog.tsx — thêm ngay sau field "Tên lớp"
<FormField
  control={form.control}
  name="zaloContact"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Zalo liên hệ (không bắt buộc)</FormLabel>
      <FormControl>
        <Input placeholder="Số điện thoại hoặc tên Zalo" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

Và thêm `zaloContact: ""` vào `defaultValues` của `useForm`.

- [ ] **Bước 4: Truyền tham số trong action**

```typescript
// actions/registrations.ts — trong cả createRegistrationAction và createRegistrationAsAdminAction,
// thêm vào object truyền cho supabase.rpc("create_registration", {...}):
p_zalo_contact: parsed.data.zaloContact || null,
```

- [ ] **Bước 5: Kiểm tra và chạy test**

Chạy: `npx supabase db reset && npx tsc --noEmit && npx vitest run tests/unit`
Kết quả mong đợi: không lỗi.

- [ ] **Bước 6: Commit**

```bash
git add lib/validations/registration.ts components/booking/BookingDialog.tsx actions/registrations.ts supabase/migrations/0007_chat.sql
git commit -m "feat: optional Zalo contact field on booking form"
```

---

### Task 3: Helper kiểm tra khung giờ ca học (dùng chung client + server)

**Files:**
- Create: `lib/chat-window.ts`
- Test: `tests/unit/chat-window.test.ts`

**Interfaces:**
- Produces: `isChatWindowOpen(date: string, startTime: string, endTime: string, now: Date): boolean` — hàm thuần (pure function), input `now` được truyền vào (không tự gọi `new Date()` bên trong) để test được dễ dàng và để UI có thể tái tính toán theo một `setInterval` timer riêng.

- [ ] **Bước 1: Viết test trước**

```typescript
// tests/unit/chat-window.test.ts
import { describe, it, expect } from "vitest"
import { isChatWindowOpen } from "@/lib/chat-window"

describe("isChatWindowOpen", () => {
  it("returns true when now is inside the slot window (VN time)", () => {
    // 2026-08-22 08:15 giờ VN = 2026-08-22T01:15:00Z (UTC+7)
    const now = new Date("2026-08-22T01:15:00Z")
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(true)
  })

  it("returns false before the slot starts", () => {
    const now = new Date("2026-08-22T00:00:00Z") // 07:00 giờ VN
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(false)
  })

  it("returns false after the slot ends", () => {
    const now = new Date("2026-08-22T02:00:00Z") // 09:00 giờ VN
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(false)
  })

  it("end_time is exclusive — exactly at end_time is closed", () => {
    const now = new Date("2026-08-22T01:30:00Z") // đúng 08:30 giờ VN
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(false)
  })
})
```

- [ ] **Bước 2: Chạy test, xác nhận FAIL**

Chạy: `npx vitest run tests/unit/chat-window.test.ts`
Kết quả mong đợi: FAIL vì `lib/chat-window.ts` chưa tồn tại.

- [ ] **Bước 3: Viết implementation**

```typescript
// lib/chat-window.ts
// Cùng logic với chat_session_is_open() ở migration 0007 (server-side,
// SQL) — bản này chạy client-side để ẩn/hiện widget mà không cần round-trip
// mạng. RPC vẫn là nguồn sự thật cuối cùng (server luôn re-check), hàm này
// chỉ quyết định UI hiển thị gì.
export function isChatWindowOpen(date: string, startTime: string, endTime: string, now: Date): boolean {
  const start = new Date(`${date}T${startTime}:00+07:00`)
  const end = new Date(`${date}T${endTime}:00+07:00`)
  return now >= start && now < end
}
```

- [ ] **Bước 4: Chạy test, xác nhận PASS**

Chạy: `npx vitest run tests/unit/chat-window.test.ts`
Kết quả mong đợi: PASS, cả 4 test.

- [ ] **Bước 5: Commit**

```bash
git add lib/chat-window.ts tests/unit/chat-window.test.ts
git commit -m "feat: add isChatWindowOpen slot-window helper with tests"
```

---

### Task 4: Zod schema + Server Actions cho chat

**Files:**
- Create: `lib/validations/chat.ts`
- Create: `actions/chat.ts`

**Interfaces:**
- Consumes: RPC `get_or_create_chat_session`, `send_guest_chat_message`, `send_staff_chat_message` (Task 1).
- Produces: `sendGuestChatMessageAction(input: unknown): Promise<ActionResult<{ id: string; body: string; createdAt: string }>>`
- Produces: `sendStaffChatMessageAction(input: unknown): Promise<ActionResult<{ id: string; body: string; createdAt: string }>>`
- Produces: `getOrCreateChatSessionAction(registrationId: string): Promise<ActionResult<{ sessionId: string }>>`

- [ ] **Bước 1: Viết validation schema**

```typescript
// lib/validations/chat.ts
import { z } from "zod"

export const sendGuestChatMessageSchema = z.object({
  registrationId: z.string().uuid(),
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(1000),
})

export const sendStaffChatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(1000),
})
```

- [ ] **Bước 2: Viết server actions**

```typescript
// actions/chat.ts
"use server"

import { createPublicClient } from "@/lib/supabase/public"
import { createServerClient } from "@/lib/supabase/server"
import { requireProfile } from "@/lib/auth"
import { sendGuestChatMessageSchema, sendStaffChatMessageSchema } from "@/lib/validations/chat"
import type { ActionResult } from "@/types"

export async function getOrCreateChatSessionAction(registrationId: string): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("get_or_create_chat_session", { p_registration_id: registrationId })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { sessionId: data.id } }
}

export async function sendGuestChatMessageAction(
  input: unknown
): Promise<ActionResult<{ id: string; body: string; createdAt: string }>> {
  const parsed = sendGuestChatMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("send_guest_chat_message", {
    p_registration_id: parsed.data.registrationId,
    p_body: parsed.data.body,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { id: data.id, body: data.body, createdAt: data.created_at } }
}

export async function sendStaffChatMessageAction(
  input: unknown
): Promise<ActionResult<{ id: string; body: string; createdAt: string }>> {
  await requireProfile()
  const parsed = sendStaffChatMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("send_staff_chat_message", {
    p_session_id: parsed.data.sessionId,
    p_body: parsed.data.body,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { id: data.id, body: data.body, createdAt: data.created_at } }
}
```

- [ ] **Bước 3: Kiểm tra type**

Chạy: `npx tsc --noEmit`
Kết quả mong đợi: không lỗi.

- [ ] **Bước 4: Commit**

```bash
git add lib/validations/chat.ts actions/chat.ts
git commit -m "feat: server actions for guest/staff chat messages"
```

---

### Task 5: Helper kết nối Realtime Broadcast (dùng chung guest + staff)

**Files:**
- Create: `lib/chat-realtime.ts`

**Interfaces:**
- Produces: `subscribeToChatChannel(sessionId: string, onMessage: (msg: ChatMessagePayload) => void): () => void` — trả về hàm `unsubscribe`.
- Produces: `broadcastChatMessage(sessionId: string, message: ChatMessagePayload): Promise<void>`.
- Produces: type `ChatMessagePayload = { id: string; senderRole: "guest" | "staff"; body: string; createdAt: string }`.

- [ ] **Bước 1: Viết implementation**

```typescript
// lib/chat-realtime.ts
// Dùng Broadcast (không phải Postgres Changes) vì guest truy cập bằng anon
// key, không có auth.uid() riêng để RLS lọc theo từng session khi
// subscribe qua Postgres Changes. Tên kênh chứa session_id (UUID không
// đoán được) đóng vai trò "vé vào phòng" — ai gửi tin nhắn (qua RPC, xem
// actions/chat.ts) cũng đồng thời broadcast lên đúng kênh này để phía còn
// lại nhận theo thời gian thực.
import { createBrowserClient } from "@/lib/supabase/client"

export type ChatMessagePayload = {
  id: string
  senderRole: "guest" | "staff"
  body: string
  createdAt: string
}

const CHANNEL_EVENT = "new_message"

function channelName(sessionId: string): string {
  return `chat:${sessionId}`
}

export function subscribeToChatChannel(sessionId: string, onMessage: (msg: ChatMessagePayload) => void): () => void {
  const supabase = createBrowserClient()
  const channel = supabase
    .channel(channelName(sessionId))
    .on("broadcast", { event: CHANNEL_EVENT }, ({ payload }) => onMessage(payload as ChatMessagePayload))
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function broadcastChatMessage(sessionId: string, message: ChatMessagePayload): Promise<void> {
  const supabase = createBrowserClient()
  const channel = supabase.channel(channelName(sessionId))
  await channel.send({ type: "broadcast", event: CHANNEL_EVENT, payload: message })
  supabase.removeChannel(channel)
}
```

- [ ] **Bước 2: Kiểm tra `lib/supabase/client.ts` đã export `createBrowserClient`**

Chạy: `grep -n "export function createBrowserClient" lib/supabase/client.ts`
Kết quả mong đợi: có dòng match (component này đã tồn tại, dùng bởi `UserMenu.tsx`).

- [ ] **Bước 3: Kiểm tra type**

Chạy: `npx tsc --noEmit`

- [ ] **Bước 4: Commit**

```bash
git add lib/chat-realtime.ts
git commit -m "feat: Realtime Broadcast helper for chat channels"
```

---

### Task 6: Component UI dùng chung — luồng tin nhắn (ChatThread)

**Files:**
- Create: `components/chat/ChatThread.tsx`

**Interfaces:**
- Consumes: `subscribeToChatChannel`, `ChatMessagePayload` (Task 5).
- Produces: component `<ChatThread sessionId={string} currentRole={"guest"|"staff"} initialMessages={ChatMessagePayload[]} onSend={(body: string) => Promise<void>} disabled={boolean} disabledReason={string} />` — dùng chung cho cả widget của guest và panel của staff, chỉ khác nhau ở component cha truyền `onSend`/`disabled` gì.

- [ ] **Bước 1: Viết component**

```typescript
// components/chat/ChatThread.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { subscribeToChatChannel, type ChatMessagePayload } from "@/lib/chat-realtime"

export function ChatThread({
  sessionId,
  currentRole,
  initialMessages,
  onSend,
  disabled,
  disabledReason,
}: {
  sessionId: string
  currentRole: "guest" | "staff"
  initialMessages: ChatMessagePayload[]
  onSend: (body: string) => Promise<void>
  disabled: boolean
  disabledReason?: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return subscribeToChatChannel(sessionId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  async function handleSend() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft("")
    try {
      await onSend(body)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
              m.senderRole === currentRole ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 border-t p-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={disabled ? (disabledReason ?? "Không thể gửi") : "Nhập tin nhắn..."}
          disabled={disabled || sending}
        />
        <Button size="icon-sm" onClick={handleSend} disabled={disabled || sending || !draft.trim()}>
          <SendIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Bước 2: Kiểm tra type**

Chạy: `npx tsc --noEmit`

- [ ] **Bước 3: Commit**

```bash
git add components/chat/ChatThread.tsx
git commit -m "feat: shared ChatThread UI component"
```

---

### Task 7: Widget chat phía guest + lưu trạng thái "đăng ký đang active" trong trình duyệt

**Files:**
- Create: `components/chat/GuestChatWidget.tsx`
- Modify: `components/booking/BookingDialog.tsx` (gọi callback sau khi đặt chỗ thành công)
- Modify: `components/schedule/ScheduleGridClient.tsx` (giữ state "registration đang active của guest này" + render widget)

**Interfaces:**
- Consumes: `getOrCreateChatSessionAction`, `sendGuestChatMessageAction`, `broadcastChatMessage`, `ChatThread`, `isChatWindowOpen`.
- Produces: `<GuestChatWidget registration={{ id, date, startTime, endTime, studentName, className }} />` — tự ẩn khi ngoài khung giờ, tự polling lại `isChatWindowOpen` mỗi 30 giây để tự đóng đúng lúc ca kết thúc.

- [ ] **Bước 1: Viết component widget**

```typescript
// components/chat/GuestChatWidget.tsx
"use client"

import { useEffect, useState } from "react"
import { MessageCircleIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatThread } from "@/components/chat/ChatThread"
import { getOrCreateChatSessionAction, sendGuestChatMessageAction } from "@/actions/chat"
import { broadcastChatMessage, type ChatMessagePayload } from "@/lib/chat-realtime"
import { isChatWindowOpen } from "@/lib/chat-window"

type GuestRegistration = {
  id: string
  date: string
  startTime: string
  endTime: string
}

// Thanh nổi ở góc dưới-phải, chỉ hiện khi guest đang thực sự trong khung
// giờ ca đăng ký của họ — kiểm tra lại mỗi 30s bằng setInterval để widget
// tự biến mất ngay khi ca kết thúc, không cần guest tự đóng tay.
export function GuestChatWidget({ registration }: { registration: GuestRegistration }) {
  const [open, setOpen] = useState(false)
  const [windowOpen, setWindowOpen] = useState(() =>
    isChatWindowOpen(registration.date, registration.startTime, registration.endTime, new Date())
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessagePayload[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setWindowOpen(isChatWindowOpen(registration.date, registration.startTime, registration.endTime, new Date()))
    }, 30_000)
    return () => clearInterval(interval)
  }, [registration])

  useEffect(() => {
    if (!open || sessionId) return
    getOrCreateChatSessionAction(registration.id).then((result) => {
      if (result.ok) setSessionId(result.data.sessionId)
    })
  }, [open, sessionId, registration.id])

  if (!windowOpen) return null

  async function handleSend(body: string) {
    if (!sessionId) return
    const result = await sendGuestChatMessageAction({ registrationId: registration.id, body })
    if (result.ok) {
      const payload: ChatMessagePayload = { id: result.data.id, senderRole: "guest", body: result.data.body, createdAt: result.data.createdAt }
      setMessages((prev) => [...prev, payload])
      await broadcastChatMessage(sessionId, payload)
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {open ? (
        <div className="flex h-96 w-80 flex-col rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b p-2">
            <span className="text-sm font-medium">Hỗ trợ trong ca học</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <XIcon className="size-4" />
            </Button>
          </div>
          {sessionId ? (
            <ChatThread sessionId={sessionId} currentRole="guest" initialMessages={messages} onSend={handleSend} disabled={false} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Đang kết nối...</div>
          )}
        </div>
      ) : (
        <Button size="icon" className="size-12 rounded-full shadow-lg" onClick={() => setOpen(true)}>
          <MessageCircleIcon className="size-5" />
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Bước 2: Lưu registration đang active vào localStorage sau khi đặt chỗ thành công**

Trong `BookingDialog.tsx`, sau khi `createRegistrationAction` trả về `ok: true`, thêm:

```typescript
localStorage.setItem(
  "activeRegistration",
  JSON.stringify({ id: result.data.id, date: values.date, startTime: values.startTime, endTime: values.endTime })
)
```

(Điều chỉnh tên field theo đúng shape thật của `result.data` và `values` hiện có trong file — đọc lại `BookingDialog.tsx` trước khi sửa vì đây là chỉnh sửa vào code đã tồn tại, không phải viết mới.)

- [ ] **Bước 3: Đọc lại localStorage và render widget trong `ScheduleGridClient.tsx`**

```typescript
// Trong ScheduleGridClient.tsx — đọc 1 lần lúc mount (useEffect + useState),
// không đọc trực tiếp trong render vì localStorage không tồn tại lúc SSR.
const [activeRegistration, setActiveRegistration] = useState<GuestRegistration | null>(null)
useEffect(() => {
  const raw = localStorage.getItem("activeRegistration")
  if (raw) setActiveRegistration(JSON.parse(raw))
}, [])

// ...trong JSX, render ở cuối:
{activeRegistration && <GuestChatWidget registration={activeRegistration} />}
```

- [ ] **Bước 4: Kiểm tra type**

Chạy: `npx tsc --noEmit`

- [ ] **Bước 5: Kiểm tra thủ công bằng Playwright** (script throwaway, xoá sau khi chạy)

Kịch bản: đặt chỗ ở slot giờ hiện tại (giống cách Task 1 Bước 3 tính "bây giờ") → xác nhận nút chat nổi lên góc dưới-phải → click mở → gõ tin nhắn → gửi → xác nhận tin nhắn hiện trong khung.

- [ ] **Bước 6: Commit**

```bash
git add components/chat/GuestChatWidget.tsx components/booking/BookingDialog.tsx components/schedule/ScheduleGridClient.tsx
git commit -m "feat: guest-side floating chat widget scoped to active booking"
```

---

### Task 8: Trang inbox chat nội bộ cho admin/quản sinh

**Files:**
- Create: `app/noi-bo/quan-ly/chat/page.tsx`
- Create: `components/chat/StaffChatPanel.tsx`
- Modify: `components/layout/AppLauncher.tsx` (thêm mục menu — cho cả admin và quản sinh, khác với `yeu-cau-doi-lich` chỉ admin)

**Interfaces:**
- Consumes: `chat_sessions`/`chat_messages` (đọc trực tiếp qua `createServerClient()`, được phép nhờ RLS `is_staff()` ở Task 1), `sendStaffChatMessageAction`, `ChatThread`.

- [ ] **Bước 1: Viết trang liệt kê phiên đang active**

```typescript
// app/noi-bo/quan-ly/chat/page.tsx
import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { StaffChatPanel } from "@/components/chat/StaffChatPanel"

// Không dùng requireAdmin — cả admin và quản sinh đều được xem/trả lời
// chat, khác với trang duyệt yêu cầu huỷ/đổi (chỉ admin).
export default async function ChatInboxPage() {
  await requireProfile()
  const supabase = await createServerClient()

  // Join thủ công trong TS thay vì PostgREST embed sâu — đúng quy ước đã
  // thiết lập ở trang co-so/yeu-cau-doi-lich (tránh embed-shape ambiguity).
  const { data: sessions } = await supabase.from("chat_sessions").select("id, registration_id, status").eq("status", "active")
  const registrationIds = (sessions ?? []).map((s) => s.registration_id)
  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, student_name, class_name, date, start_time, end_time")
    .in("id", registrationIds)

  const rows = (sessions ?? [])
    .map((s) => {
      const reg = (registrations ?? []).find((r) => r.id === s.registration_id)
      if (!reg) return null
      return { sessionId: s.id, ...reg }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Chat với học sinh</h1>
      <StaffChatPanel rows={rows} />
    </div>
  )
}
```

**Lưu ý quan trọng cho người triển khai:** danh sách `sessions` ở trên lấy TẤT CẢ session có `status = 'active'`, kể cả những session mà ca học đã kết thúc (vì Task 1 không có cron nào tự chuyển `status` sang `'ended'`). Trang này phải tự lọc thêm bằng `isChatWindowOpen` (Task 3) ở phía client trước khi hiển thị "đang active" — nếu không sẽ hiện nhầm các phiên đã hết hạn. Đưa việc lọc này vào `StaffChatPanel` (Bước 2), không lọc ở server component để tận dụng cùng 1 hàm dùng chung với guest.

- [ ] **Bước 2: Viết panel danh sách + chi tiết**

```typescript
// components/chat/StaffChatPanel.tsx
"use client"

import { useState } from "react"
import { ChatThread } from "@/components/chat/ChatThread"
import { sendStaffChatMessageAction } from "@/actions/chat"
import { broadcastChatMessage, type ChatMessagePayload } from "@/lib/chat-realtime"
import { isChatWindowOpen } from "@/lib/chat-window"

type Row = { sessionId: string; id: string; student_name: string; class_name: string | null; date: string; start_time: string; end_time: string }

export function StaffChatPanel({ rows }: { rows: Row[] }) {
  const openRows = rows.filter((r) => isChatWindowOpen(r.date, r.start_time, r.end_time, new Date()))
  const [selected, setSelected] = useState<Row | null>(null)
  const [messages, setMessages] = useState<ChatMessagePayload[]>([])

  if (openRows.length === 0) {
    return <p className="text-sm text-muted-foreground">Không có phiên chat nào đang mở.</p>
  }

  async function handleSend(body: string) {
    if (!selected) return
    const result = await sendStaffChatMessageAction({ sessionId: selected.sessionId, body })
    if (result.ok) {
      const payload: ChatMessagePayload = { id: result.data.id, senderRole: "staff", body: result.data.body, createdAt: result.data.createdAt }
      setMessages((prev) => [...prev, payload])
      await broadcastChatMessage(selected.sessionId, payload)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <ul className="flex flex-col gap-1">
        {openRows.map((r) => (
          <li key={r.sessionId}>
            <button
              className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                setSelected(r)
                setMessages([])
              }}
            >
              <div className="font-medium">{r.student_name}</div>
              {r.class_name && <div className="text-xs text-muted-foreground">{r.class_name}</div>}
            </button>
          </li>
        ))}
      </ul>
      <div className="h-[500px] rounded-lg border">
        {selected ? (
          <ChatThread sessionId={selected.sessionId} currentRole="staff" initialMessages={messages} onSend={handleSend} disabled={false} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chọn một cuộc chat để bắt đầu</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Bước 3: Thêm vào menu**

```typescript
// components/layout/AppLauncher.tsx — thêm vào mảng APPS
{ href: "/noi-bo/quan-ly/chat", label: "Chat với học sinh", icon: MessageCircleIcon },
```

**Lưu ý:** đọc lại cách `AppLauncher.tsx` hiện lọc menu theo role (một số mục chỉ admin thấy) — mục chat này phải hiện với CẢ admin và quản sinh, khác với các mục `quan-ly/*` khác thường chỉ dành cho admin. Có thể cần thêm cờ `roles: ["admin", "quan_sinh"]` vào từng item nếu cấu trúc hiện tại không hỗ trợ — kiểm tra file trước khi sửa.

- [ ] **Bước 4: Kiểm tra type và build**

Chạy: `npx tsc --noEmit && npx next build`

- [ ] **Bước 5: Kiểm tra thủ công bằng Playwright**

Kịch bản: guest gửi tin nhắn (dùng script Task 7 Bước 5 hoặc gọi RPC trực tiếp) → admin mở `/noi-bo/quan-ly/chat` → thấy phiên trong danh sách → click vào → thấy tin nhắn của guest → gửi phản hồi → xác nhận tin nhắn hiện trong khung của admin. Lặp lại với tài khoản quản sinh để xác nhận quyền truy cập đúng như thiết kế.

- [ ] **Bước 6: Commit**

```bash
git add app/noi-bo/quan-ly/chat components/chat/StaffChatPanel.tsx components/layout/AppLauncher.tsx
git commit -m "feat: staff chat inbox page for admin and quan_sinh"
```

---

### Task 9: Chạy toàn bộ ship-loop và đẩy migration lên production

**Files:** không tạo/sửa file — chỉ chạy lệnh.

- [ ] **Bước 1:** `npx supabase db reset` — xác nhận mọi migration (0001–0007) apply sạch.
- [ ] **Bước 2:** `npx tsc --noEmit` — xác nhận không lỗi type.
- [ ] **Bước 3:** `npx vitest run tests/unit` — xác nhận toàn bộ unit test pass (bao gồm test mới ở Task 3).
- [ ] **Bước 4:** `npx next build` — xác nhận build production sạch.
- [ ] **Bước 5:** `npx playwright test tests/e2e/booking.spec.ts` — xác nhận không có regression (lưu ý: 2 test trong file này có thể fail nếu chạy vào ban đêm do phụ thuộc "hôm nay 08:00" chưa qua — đây là vấn đề đã biết từ trước, không liên quan đến chat, xem ghi chú trong `feedback_ginnyhouse_workflow.md`).
- [ ] **Bước 6:** Đẩy migration lên Supabase Cloud (production) TRƯỚC khi push code: `npx supabase db push` — xác nhận `0007_chat.sql` nằm trong danh sách migration được áp dụng.
- [ ] **Bước 7:** `git push origin main` — kích hoạt Vercel tự động deploy.
- [ ] **Bước 8:** Xác nhận deploy live bằng `npx vercel inspect https://ginnyhouse.space` — kiểm tra `created` là vài phút trước (không phải deploy cũ), và `curl -s -o /dev/null -w "%{http_code}" https://ginnyhouse.space/` trả về `200`.
