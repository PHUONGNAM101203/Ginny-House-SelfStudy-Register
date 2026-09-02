-- Gin Anh wants one Sunday-night wrap-up of the week in the notification
-- bell ("tổng hợp thông báo theo tuần vào tối chủ nhật 22h"), rather than
-- reconstructing the week by scrolling the individual events. Written by
-- the cron route at app/api/cron/weekly-digest.
--
-- Its own enum value so the digest is distinguishable from the per-event
-- notifications — and in its own migration because Postgres refuses to read
-- a new enum value inside the transaction that added it.
alter type notification_type add value 'weekly_digest';
