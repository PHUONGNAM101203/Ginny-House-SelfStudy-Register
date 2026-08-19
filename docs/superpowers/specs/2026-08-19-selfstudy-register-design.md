# Thiết kế: Ginny House – Đăng ký Tự học

**Ngày:** 2026-08-19
**Trạng thái:** Đã duyệt (approved by user in conversation)

## 1. Bối cảnh & Mục tiêu

Trung tâm Ginny House hiện quản lý lịch đăng ký tự học của học sinh bằng file Excel
(`Đăng ký tự học 2026 - Không xoá lịch của người khác.xlsx`), mỗi tuần 1 sheet, mỗi
sheet gồm 2 cơ sở (Hoàng Gia, Hồ Xương Rồng) × 7 ngày × 10 chỗ × các khung 30 phút
(8:00–12:00 và 14:00–22:00). Một số ô bị bôi đen thủ công để đánh dấu "không có
phòng". Một số học sinh đăng ký cố định hàng tuần, một số đăng ký theo từng tuần.
Dữ liệu học sinh hiện được lưu song song trên Lark Base.

Mục tiêu: xây dựng web app (Next.js + Supabase) thay thế quy trình Excel này, giữ
nguyên giao diện/thiết kế/thiết lập kỹ thuật của app nội bộ có sẵn
**Calendar-Ginny-House** (`/Users/phuongnam/Documents/Calendar-GInny-House`) để dễ bảo
trì và quen thuộc với đội ngũ, nhưng khác về domain (đặt chỗ tự học thay vì xếp ca
làm) và về mô hình role (đơn giản hơn nhiều — 3 vai trò thay vì 12).

## 2. Vai trò & Truy cập

- **`admin`** — toàn quyền: quản lý cơ sở/chỗ ngồi, khoá/mở lịch, đăng ký hộ học
  sinh, quản lý học sinh, tạo tài khoản nhân sự (`admin`/`quan_sinh`), xem dashboard.
- **`quan_sinh`** — chỉ đọc: xem lịch tất cả cơ sở + xem dashboard thống kê. Không
  tạo/sửa/huỷ được bất kỳ đăng ký nào.
- **`guest`** — học sinh, không có tài khoản, không qua Supabase Auth. Vào thẳng
  trang chủ `/` để xem lịch trống và tự đăng ký/huỷ chỗ của chính mình.

Không có nút hoặc link "Đăng nhập" ở bất kỳ đâu trong giao diện công khai. Trang
đăng nhập nội bộ nằm ở route không được liên kết từ UI công khai (ví dụ
`/noi-bo/dang-nhap`) — admin/quản sinh tự biết đường link để vào. Đây **chỉ là tiện
lợi UX, không phải rào chắn bảo mật**: bảo mật thật nằm ở Supabase Auth + Row Level
Security (RLS) + hàm `requireProfile()` / `requireAdmin()` chạy ở đầu mọi trang nội
bộ, giống nguyên tắc đã áp dụng trong Calendar-Ginny-House (`lib/supabase/proxy.ts`
chỉ là gate tiện lợi, không phải security boundary).

Tài khoản `admin`/`quan_sinh` **không có form tự đăng ký công khai** — được tạo bởi
admin qua màn "Quản lý nhân sự" (dùng Supabase Admin API `auth.admin.createUser` qua
`lib/supabase/admin.ts`, theo đúng pattern service-role client đã có trong app mẫu),
đăng nhập bằng email + mật khẩu.

## 3. Tech Stack

Bám sát app mẫu Calendar-Ginny-House để tái sử dụng kinh nghiệm vận hành và giao
diện quen thuộc:

- **Next.js 16** (App Router, Turbopack mặc định), **React 19**, **TypeScript**
  strict mode, alias `@/*`.
- **Package manager: npm** (đồng bộ với `package-lock.json` của app mẫu).
- **Supabase**: `@supabase/ssr` + `@supabase/supabase-js`, 4 client factory giống
  hệt app mẫu:
  - `lib/supabase/server.ts` — server components/actions, cookie-bound.
  - `lib/supabase/client.ts` — client components.
  - `lib/supabase/admin.ts` — service-role, dùng cho `ensureProfile`, tạo tài khoản
    nhân sự, import Lark Base.
  - `lib/supabase/public.ts` — anon, không cookie, dùng trong các Server Action xử
    lý hành động của **guest** (guest không có session để cookie-bind).
- **UI**: shadcn/ui, style `radix-nova`, base color `neutral`, Tailwind CSS v4
  (CSS-first config trong `app/globals.css`), copy nguyên bộ design token (màu,
  radius ladder, motion tokens, font Barlow) từ app mẫu, đổi tên thương hiệu/logo.
  `next-themes` cho dark mode.
- **Forms**: `react-hook-form` + `zod` (`lib/validations/*.ts`, 1 file/entity, dùng
  lại ở cả client resolver và server action).
- **Ngày giờ**: `date-fns` + locale `vi`.
- **Toast**: `sonner`.
- **Không dùng `react-big-calendar`**: lịch tự học là lưới cố định 2 chiều (cột =
  ngày×chỗ, hàng = khung 30 phút) giống hệt layout Excel, nên tự xây component lưới
  riêng (`components/schedule/`) thay vì tái dùng thư viện lịch kiểu Google Calendar
  vốn thiết kế cho events tự do.
- **Business logic quan trọng nằm trong Postgres RPC function `SECURITY DEFINER`**
  (giống pattern `request_shift_swap` của app mẫu) để đảm bảo atomic (chống double
  booking) và để guest có thể ghi dữ liệu mà không cần lộ service-role key ra
  browser — Server Action gọi RPC qua client `public.ts`.

## 4. Mô hình dữ liệu

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `branches` | id, code, name | Cơ sở. Admin CRUD. Seed: Hoàng Gia, Hồ Xương Rồng. |
| `desks` | id, branch_id, label, active | "Chỗ ngồi". Admin CRUD, mặc định 10/cơ sở. |
| `students` | id, full_name, phone (unique, khoá match), lark_record_id (nullable) | Định danh mềm bằng SĐT. `lark_record_id` để dành cho import/sync Lark Base sau này. |
| `profiles` | id (FK auth.users), full_name, role (`admin`\|`quan_sinh`) | Tài khoản nội bộ. |
| `recurring_registrations` | id, student_id, branch_id, desk_id, day_of_week, start_time, end_time, active, created_by | Nguồn của "đăng ký cố định". |
| `registrations` | id, student_id, branch_id, desk_id, date, start_time, end_time, status (`active`\|`cancelled`), source (`guest_self`\|`recurring_auto`\|`admin_manual`), created_by | Lịch thực tế theo ngày cụ thể. Exclusion constraint chống trùng giờ trên cùng 1 desk (giống `shifts_no_overlap` của app mẫu). |
| `slot_locks` | id, branch_id, desk_id (nullable = khoá cả cơ sở), day_of_week, start_time, end_time, reason, active, created_by | Khoá lịch lặp hàng tuần ("bôi đen"). |

**Khung giờ (8:00–12:00 và 14:00–22:00, bước 30 phút)**: hardcode làm hằng số dùng
chung trong `lib/time-slots.ts`, không tách bảng DB riêng cho v1 — dễ nâng cấp
thành cấu hình linh hoạt sau nếu cần.

RLS bật trên mọi bảng. `registrations`/`recurring_registrations` cho phép INSERT
qua RPC (không insert trực tiếp từ client), SELECT công khai (để guest xem lịch
trống — chỉ lộ tên/giờ, không lộ SĐT ra ngoài response công khai). `profiles`,
`slot_locks`, `branches`, `desks` chỉ ghi được bởi `admin` (kiểm tra qua hàm SQL
`is_admin()` như `is_manager()` trong app mẫu).

## 5. Flow đặt chỗ (Guest)

1. Vào `/`, chọn cơ sở → chọn tuần (hiện tại/tuần sau) → xem lưới: trống / đã có
   người / đã khoá (không cho chọn).
2. Chọn 1 hoặc nhiều khung 30 phút liên tục trên 1 chỗ → nhập **Tên + SĐT** → xác
   nhận.
3. Server Action gọi RPC `create_registration(desk_id, date, start_time, end_time,
   full_name, phone, is_recurring)`:
   - Kiểm tra atomic: khung giờ chưa bị đặt trùng (status=active) và chưa bị khoá
     (`slot_locks` active khớp `day_of_week` + giờ).
   - Upsert vào `students` theo `phone` (tạo mới nếu SĐT chưa có, cập nhật tên nếu
     khác).
   - Ghi `registrations` (source=`guest_self`).
   - Nếu `is_recurring=true`: ghi thêm `recurring_registrations` active.
4. **Đăng ký cố định tự động giữ chỗ mỗi tuần**: khi có người mở xem tuần kế tiếp
   (hoặc qua Supabase Cron chạy định kỳ), hàm `materialize_recurring_registrations()`
   sinh `registrations` (source=`recurring_auto`) cho tuần đó từ mọi
   `recurring_registrations` active, **bỏ qua** nếu slot đó đã bị `slot_locks` khoá
   cho tuần đó (không sinh ra bản ghi, không báo lỗi — chỉ đơn giản là không có chỗ
   tuần đó, admin/quản sinh sẽ thấy trong dashboard "chưa đăng ký tuần này").
5. **Huỷ/sửa của guest**: bấm vào ô lịch của mình → nhập lại đúng Tên + SĐT đã dùng
   để đăng ký → nếu khớp, cho huỷ (set `status=cancelled`) qua RPC
   `cancel_registration(registration_id, full_name, phone)`. Huỷ 1 tuần lẻ **không**
   ảnh hưởng `recurring_registrations` gốc — huỷ vĩnh viễn lịch cố định là hành
   động riêng (cùng màn hình, có nút "Huỷ luôn lịch cố định này").

## 6. Tính năng Admin

- **Quản lý cơ sở & chỗ ngồi**: CRUD `branches`, `desks`.
- **Khoá/mở lịch** (`slot_locks`): chọn cơ sở/chỗ (hoặc cả cơ sở)/thứ trong tuần/
  khung giờ → khoá lặp lại hàng tuần cho đến khi admin mở lại. Áp dụng ngay cho
  tuần hiện tại và mọi tuần sau (không hồi tố các `registrations` đã tồn tại).
- **Đăng ký hộ học sinh**: dùng lại RPC `create_registration` nhưng
  `created_by=admin`, `source=admin_manual`, **không cần** bước xác thực lại Tên+SĐT
  (vì admin đã xác thực qua Supabase Auth).
- **Quản lý học sinh**: xem/sửa danh sách `students`, xem lịch sử đăng ký của từng
  học sinh.
- **Quản lý nhân sự**: tạo/vô hiệu hoá tài khoản `admin`/`quan_sinh`.

## 7. Dashboard thống kê (Admin + Quản sinh, quản sinh read-only)

4 chỉ số ưu tiên cho v1:

1. **Tỷ lệ lấp đầy** theo cơ sở/ngày/khung giờ (số chỗ đã đặt / tổng chỗ khả dụng
   sau khi trừ chỗ bị khoá).
2. **Danh sách học sinh chưa đăng ký tuần này** — học sinh có `recurring_registrations`
   active nhưng chưa có `registrations` active tương ứng cho tuần hiện tại, **cộng
   thêm** học sinh có lịch sử đăng ký tuần trước (không cố định) nhưng tuần này
   chưa đăng ký gì. Admin/quản sinh dùng danh sách này để tự nhắn Zalo/gọi điện
   nhắc thủ công (v1 không gửi tin tự động).
3. **Xu hướng đăng ký theo tuần/tháng** — biểu đồ tổng lượt `registrations` active
   theo thời gian (dùng `recharts`, đồng bộ style với app mẫu).
4. **Xếp hạng học sinh theo tần suất học** — đếm số buổi active trong khoảng thời
   gian chọn được (ví dụ 4 tuần gần nhất).

## 8. Import dữ liệu từ Lark Base (v1: một lần)

Script chạy tay (Node script trong `scripts/import-lark.ts`, dùng `admin.ts`
client) đọc export từ Lark Base (CSV hoặc gọi Lark Base API) để seed bảng
`students` (khớp theo SĐT, set `lark_record_id`) và lịch sử đăng ký hiện có, chạy
một lần lúc setup. Không chạy tự động, không có UI trigger trong v1.

## 9. Ngoài phạm vi v1 (Phase 2 — không build trong lần triển khai này)

- Đồng bộ tự động một chiều Lark Base → app khi có học sinh mới (schema đã chừa sẵn
  `students.lark_record_id` để làm việc này dễ dàng sau).
- Định danh học sinh bằng mã học sinh lấy từ file upload.
- Gửi nhắc nhở tự động qua SMS/Zalo ZNS (v1 chỉ có danh sách trong dashboard để
  nhắc thủ công).
- Khoá lịch ngoại lệ theo từng tuần cụ thể (v1 chỉ có khoá lặp lại hàng tuần).
- Cấu hình khung giờ linh hoạt qua UI (v1 hardcode 8:00–12:00 / 14:00–22:00, bước
  30 phút).

## 10. Testing

- Unit test cho các hàm thuần (`lib/time-slots.ts`, tính tỷ lệ lấp đầy, tính danh
  sách chưa đăng ký).
- Integration test cho các RPC quan trọng (`create_registration`,
  `cancel_registration`, `materialize_recurring_registrations`) chạy trên Supabase
  local (Supabase CLI + Postgres test container), test các case: double booking bị
  chặn, slot bị khoá bị chặn, huỷ sai Tên/SĐT bị từ chối.
- E2E (Playwright) cho golden path: guest đặt chỗ → thấy trên dashboard admin →
  guest huỷ đúng Tên/SĐT thành công, sai Tên/SĐT bị từ chối.
