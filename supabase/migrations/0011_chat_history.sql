-- Neither side could see prior messages when (re)opening a chat — ChatThread
-- always started from an empty list, relying only on Realtime Broadcast
-- messages sent AFTER it subscribed. For a staff inbox that's a real
-- usability gap (the point of an inbox is seeing what the guest already
-- said). Staff reads chat_messages directly (already RLS-granted to
-- authenticated via is_staff(), migration 0007) — this RPC is only needed
-- for the guest side, which has no direct table grant.
--
-- No time-window check here (unlike send_guest_chat_message): reading past
-- messages after the slot ends is reasonable — only sending new ones is
-- gated. registration_id is still the only credential required, same as
-- every other guest-facing chat entry point.
create or replace function get_chat_messages(p_registration_id uuid)
returns setof chat_messages
language plpgsql security definer set search_path = public as $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from chat_sessions where registration_id = p_registration_id;
  if v_session_id is null then
    return;
  end if;

  return query select * from chat_messages where session_id = v_session_id order by created_at asc;
end;
$$;

grant execute on function get_chat_messages to anon, authenticated;
