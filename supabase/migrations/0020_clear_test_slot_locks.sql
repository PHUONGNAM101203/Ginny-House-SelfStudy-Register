-- One-off data cleanup, not a schema change. The seven khoá lịch showing on
-- /noi-bo/quan-ly/khoa-lich were left over from testing ("xóa hết các khóa
-- lịch vì không để test nữa") and were blacking out real bookable slots.
--
-- Deactivates rather than deletes: `active = false` is exactly what the
-- "Mở lại" button in the admin UI does, it drops them out of every query the
-- app makes, and it stays reversible — `update slot_locks set active = true
-- where id = '...'` brings any one of them back if a lock turns out to have
-- been real after all.
update slot_locks set active = false where active;
