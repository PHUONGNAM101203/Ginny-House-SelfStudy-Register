-- Enum values must be added a migration ahead of the statements that read
-- them (Postgres refuses both in one transaction).
alter type notification_type add value if not exists 'recurring_pending';
alter type notification_type add value if not exists 'recurring_approved';
