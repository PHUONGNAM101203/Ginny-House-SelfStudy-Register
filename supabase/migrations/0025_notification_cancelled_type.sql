-- 0026 files a notification when a guest cancels, which needs a type for it.
-- Postgres refuses to read a new enum value inside the transaction that added
-- it, so the ALTER lives here, one migration ahead of its first use.
--
-- (The same value exists on the vacant-recurring-slot branch; whichever
-- lands first wins and the other is a no-op — hence IF NOT EXISTS.)
alter type notification_type add value if not exists 'registration_cancelled';
