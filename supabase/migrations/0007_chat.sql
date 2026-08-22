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

-- Thêm loại notification mới vào enum đã tạo ở migration 0006, TRƯỚC khi
-- định nghĩa send_guest_chat_message bên dưới dùng giá trị này (ALTER TYPE
-- ADD VALUE phải đứng trước bất kỳ chỗ nào tham chiếu giá trị mới trong
-- cùng transaction).
alter type notification_type add value 'chat_message';

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

  -- `v_session is not null` would be wrong here: for a composite row
  -- variable, `IS NOT NULL` is true only when EVERY field is non-null —
  -- and `ended_at` is nullable and null for any active session, so that
  -- check would always be false even when a row was genuinely found,
  -- falling through to the insert below and hitting the unique-constraint
  -- violation on every second call. `FOUND` (set by the SELECT INTO
  -- itself) is the correct plpgsql idiom for "did this query match a row".
  select * into v_session from chat_sessions where registration_id = p_registration_id;
  if found then
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

grant execute on function get_or_create_chat_session to anon, authenticated;
grant execute on function send_guest_chat_message to anon, authenticated;
grant execute on function send_staff_chat_message to authenticated;
grant select on chat_sessions to authenticated;
grant select on chat_messages to authenticated;
