-- Web push subscriptions, one row per browser/device a staff member has
-- enabled notifications on. `endpoint` is unique so re-subscribing the same
-- device (e.g. after clearing site data) upserts in place instead of
-- accumulating dead rows. Push payloads are sent server-side only (service
-- role, lib/push/send.ts) — no RLS policy needs to allow cross-user reads,
-- since staff never lists other staff's subscriptions from the client.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_profile_id_idx on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;
create policy push_subscriptions_own_select on push_subscriptions for select using (profile_id = auth.uid());
create policy push_subscriptions_own_insert on push_subscriptions for insert with check (profile_id = auth.uid());
create policy push_subscriptions_own_update on push_subscriptions for update using (profile_id = auth.uid());
create policy push_subscriptions_own_delete on push_subscriptions for delete using (profile_id = auth.uid());

grant select, insert, update, delete on push_subscriptions to authenticated;
grant select, insert, update, delete on push_subscriptions to service_role;
