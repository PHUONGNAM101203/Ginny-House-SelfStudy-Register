-- A month-end counterpart to the Sunday weekly digest (migration 0019):
-- "tổng kết hàng tháng vào ngày cuối tháng ... để nắm tình hình tổng cả
-- tháng". Written by the cron route at app/api/cron/monthly-digest.
--
-- Its own enum value so the bell can tell a month wrap-up from a week one —
-- and, like 0019, in its own migration because Postgres refuses to read a
-- new enum value inside the transaction that added it.
alter type notification_type add value 'monthly_digest';
