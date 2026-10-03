-- "C thấy cái chỗ hs huỷ phải qua admin duyệt nó đang k có tác dụng gì lắm.
--  C bỏ cái đó giúp c nhé. Cho cno xin huỷ lịch là cho huỷ luôn đi. Xong đội
--  qsinh vẫn xem đc đó là lịch huỷ."
--
-- Từ migration 0031, học sinh muốn huỷ phải gửi phiếu cho admin duyệt. Trên
-- thực tế phiếu đọng lại: lúc viết migration này có 5 phiếu huỷ đang chờ, 4
-- trong số đó xin ngay trong ngày hôm nay và buổi học vẫn đang giữ chỗ. Chỗ
-- thì không ai ngồi, mà người khác cũng không đăng ký được.
--
-- Nên bỏ bước duyệt cho việc huỷ: học sinh tự huỷ được ngay, với điều kiện
-- khai đúng tên và số điện thoại của chính lịch đó. Không phải vì thủ tục —
-- đó là thứ duy nhất máy chủ kiểm chứng được rằng người bấm huỷ là người đã
-- đặt, chứ localStorage của trình duyệt thì không thể tin.
--
-- Huỷ xong lịch chuyển sang 'cancelled' chứ không xoá, nên quản sinh vẫn
-- thấy nguyên thẻ "Lịch huỷ" màu xám trên lịch — đúng yêu cầu.
--
-- Phiếu "xin đổi lịch" giữ nguyên: nó đã được dùng 39 lần và là việc khác
-- hẳn (muốn chuyển sang giờ khác, cần người sắp xếp).
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

  -- Staff huỷ thẳng, không cần khai gì (migration 0034 mở cho cả quản sinh).
  if not is_staff() then
    if p_full_name is null or p_phone is null then
      raise exception 'Cancellations need the name and phone on the booking' using errcode = 'GH001';
    end if;

    select s.phone into v_phone from students s where s.id = v_reg.student_id;

    -- Tên: bỏ dấu và không phân biệt hoa thường. Học sinh gõ "dang vu mai
    -- phuong" hay "Đặng Vũ Mai Phương" đều phải huỷ được — ép gõ đúng dấu
    -- chỉ tạo ra một hàng rào mới thay cho hàng rào vừa dỡ.
    --
    -- extensions.unaccent chứ không phải unaccent: hàm này chạy với
    -- search_path = public, còn extension nằm ở schema `extensions` (cả local
    -- lẫn production), nên gọi trống tên schema sẽ lỗi "function does not
    -- exist" ngay lần huỷ đầu tiên.
    -- Số điện thoại: chỉ so chữ số, bỏ khoảng trắng và dấu chấm.
    if v_reg.student_id is null
      or v_phone is null
      or regexp_replace(v_phone, '\D', '', 'g') <> regexp_replace(p_phone, '\D', '', 'g')
      or lower(extensions.unaccent(btrim(coalesce(v_reg.student_name, ''))))
         <> lower(extensions.unaccent(btrim(p_full_name)))
    then
      raise exception 'Name or phone does not match this booking' using errcode = 'GH001';
    end if;
  end if;

  -- Một buổi thôi. Lịch cố định hằng tuần không bị đụng tới: materialise
  -- (migration 0038) sẽ không tạo lại đúng ngày này, và tuần sau vẫn tới.
  -- Muốn dừng cả chuỗi thì dùng cancel_recurring_series (migration 0040).
  update registrations set status = 'cancelled' where id = p_registration_id;
end;
$$;
