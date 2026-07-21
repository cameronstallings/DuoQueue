-- Phase 5: admin moderation access, and DB-trigger-driven push notifications.

-- =========================================================================
-- Admin moderation queue access. is_admin is flipped manually in the DB by an
-- operator (there is no self-service "become admin" path) — the admin web
-- page (admin/index.html) is the only consumer of these broadened policies.
-- =========================================================================

alter table public.profiles add column is_admin boolean not null default false;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

grant execute on function public.is_admin_user() to authenticated;

create policy "reports_select_admin" on public.reports
  for select using (public.is_admin_user());

create policy "reports_update_admin" on public.reports
  for update using (public.is_admin_user());

grant update on public.reports to authenticated;

create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin_user());

create policy "messages_select_admin" on public.messages
  for select using (public.is_admin_user());

-- =========================================================================
-- Internal config for Postgres-trigger -> Edge Function calls. No grants to
-- authenticated/anon at all (not even RLS — there's simply no privilege to
-- read or write this table via the API); only SECURITY DEFINER functions
-- (running as the table owner) can see it. Set both keys once after deploying:
--   insert into public.app_config (key, value) values
--     ('edge_function_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('internal_trigger_token', '<a-random-shared-secret>');
-- =========================================================================

create table public.app_config (
  key text primary key,
  value text not null
);

-- =========================================================================
-- Push notification triggers: fire-and-forget HTTP calls (via pg_net) to the
-- send-push-notification Edge Function, which does the actual notification-
-- settings check, push-token lookup, and Expo Push API call. If app_config
-- isn't populated yet (e.g. local dev), these silently no-op rather than
-- erroring — a missing notification is not worth failing the underlying
-- swipe/message/ping write over.
-- =========================================================================

create extension if not exists pg_net;

create or replace function public.notify_via_edge_function(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_token text;
begin
  select value into v_base_url from public.app_config where key = 'edge_function_base_url';
  select value into v_token from public.app_config where key = 'internal_trigger_token';

  if v_base_url is null or v_token is null then
    return;
  end if;

  perform net.http_post(
    url := v_base_url || '/send-push-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_token),
    body := p_body
  );
exception
  when others then
    -- Never let a notification delivery problem fail the write that triggered it.
    raise warning 'notify_via_edge_function failed: %', sqlerrm;
end;
$$;

create or replace function public.notify_new_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'new_match', 'matchId', new.id, 'userAId', new.user_a_id, 'userBId', new.user_b_id)
  );
  return new;
end;
$$;

create trigger on_match_created
  after insert on public.matches
  for each row execute function public.notify_new_match();

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'new_message', 'matchId', new.match_id, 'messageId', new.id, 'senderId', new.sender_id)
  );
  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.notify_new_message();

create or replace function public.notify_super_ping()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_via_edge_function(
    jsonb_build_object('type', 'super_ping', 'senderId', new.sender_id, 'receiverId', new.receiver_id)
  );
  return new;
end;
$$;

create trigger on_super_ping_created
  after insert on public.super_pings
  for each row execute function public.notify_super_ping();

-- =========================================================================
-- Close a gap from 0001_init.sql: profile_media's blanket UPDATE grant let an
-- owner flip their own moderation_status directly (e.g. straight to
-- 'approved'), bypassing moderation entirely. Restrict client updates to the
-- columns that are actually theirs to change; moderation_status can only be
-- set by the moderate-photo Edge Function (service role).
-- =========================================================================

revoke update on public.profile_media from authenticated;
grant update (storage_path, "position") on public.profile_media to authenticated;

-- =========================================================================
-- "Daily swipes refreshed" notification support. This is a scheduled (not
-- trigger-driven) notification — see the daily-swipes-refreshed Edge
-- Function, invoked hourly by an external scheduler. Dedupe state lives here
-- rather than being inferred from daily_swipe_counters, since that table
-- only gets a row lazily on a user's first swipe of the day. No grants for
-- authenticated/anon — service-role only, same as daily_swipe_counters.
-- =========================================================================

create table public.swipe_refresh_notifications (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  last_notified_day date not null
);

create or replace function public.get_profiles_needing_swipe_refresh_notification()
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.is_active = true
    and p.onboarding_completed = true
    and extract(hour from (now() at time zone coalesce(p.timezone, 'utc'))) = 0
    and not public.is_premium(p.id)
    and not exists (
      select 1 from public.swipe_refresh_notifications srn
      where srn.profile_id = p.id
        and srn.last_notified_day = (now() at time zone coalesce(p.timezone, 'utc'))::date
    );
$$;
