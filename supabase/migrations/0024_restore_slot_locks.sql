-- Undo of migration 0020. Those seven khoá lịch were not test data after all
-- — Gin Anh had set them deliberately and needs them back exactly as they
-- were ("khôi phục lịch khóa y chang như lúc xóa").
--
-- This is why 0020 flipped `active` instead of deleting: every row survived,
-- so the restore is exact rather than a reconstruction from a screenshot.
-- Targeted by id, not `set active = true` across the table, so any lock an
-- admin turns off in the future is unaffected if this ever re-runs.
--
-- Verified against production before writing: slot_locks held exactly these
-- seven rows and nothing else, all inactive, so no lock that was already off
-- for its own reasons gets switched back on here.
update slot_locks set active = true
where id in (
  'e315e326-7df0-4411-a33e-aac5539259c7',  -- Hồ Xương Rồng · Thứ 3 · 14:00-22:00
  '86fb9de7-31df-4a5f-a1ad-82d8d275d518',  -- Hồ Xương Rồng · Thứ 4 · 17:30-19:30
  'ed60e001-00c1-442d-b435-b374810027a9',  -- Hồ Xương Rồng · Thứ 5 · 17:00-22:00
  'a53dc196-c5f0-4329-80d7-ed9dc0a6c31b',  -- Hoàng Gia     · Thứ 6 · 17:30-19:30
  '214cf45a-9ed5-4579-a061-be45593ed90c',  -- Hồ Xương Rồng · Thứ 7 · 17:00-19:30
  '55ba07b9-55fb-4dbe-8f7d-941dd6718789',  -- Hoàng Gia     · Chủ nhật · 17:30-19:30
  '0a999683-2b44-45c3-b8a7-a6dbe02ffb59'   -- Hồ Xương Rồng · Chủ nhật · 17:30-19:30
);
