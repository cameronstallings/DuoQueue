-- Admin audit log: closes the gap the Trust & Safety doc (docs/legal/trust-and-safety.md,
-- section 2.3 GAP and section 6 GAP, item 3 in the open-items tracker) discloses by name —
-- an is_admin account can read any reported conversation, approve/reject any photo or
-- voice intro, and resolve any report, and none of it produces a record of who did what,
-- to whom, or when. Section 9's "manual record" fallback exists only because this table
-- didn't.
--
-- Design choices, stated once here rather than repeated at every call site below:
--
-- 1. admin_id and every target_* column are plain uuid with NO foreign key. This is a
--    deliberate departure from the FK-heavy rest of the schema, for the same reason 0042
--    gave reported_profile_id its own non-FK copy: an audit log's job is to keep pointing
--    at what happened even after the thing it points to is gone (profile deleted, report's
--    reported_id nulled by its own FK, a rejected photo's profile_media row cleaned up
--    later). An `on delete cascade`/`set null` FK here would let the very account-deletion
--    or content-cleanup path an audit entry might need to explain also erase the entry
--    about it. reports.reviewed_by already has no FK in this schema (0001) — same
--    precedent, now applied consistently to a table whose entire purpose is preservation.
--
-- 2. `action` is a checked text column, not an enum. Every other controlled-vocabulary
--    column in this schema (report_status_enum, moderation_status_enum, ...) is something
--    other rows and app logic branch on structurally; `action` is closer to a structured
--    log line — new admin capabilities will keep adding new action strings over time, and
--    a CHECK constraint extends with a two-line migration (drop constraint, add constraint)
--    without the cross-session ALTER TYPE ADD VALUE ceremony an enum would need. Scoped
--    for now to exactly the four actions this migration actually wires up.
--
-- 3. Nothing can UPDATE or DELETE this table — not even service_role gets a grant for it,
--    because none is given and the schema-wide default that lets service_role reach every
--    other table (see app_config's / swipe_refresh_notifications' header comments) never
--    included write access this table doesn't grant. Per the task: an audit log that can
--    be edited is not an audit log. Enforced at the grant layer (fails closed unconditionally,
--    the 0041 lesson: PUBLIC revokes and RLS policies both have to be right, a missing GRANT
--    doesn't have to be) with RLS as the second, independent layer restricting SELECT/INSERT
--    to admins.
--
-- 4. Server-side logging, not client-side, for all three call sites the task named. A
--    client-side `admin/index.html` call to a logger RPC after the fact is exactly the gap
--    (d) warns about — a malicious admin's browser simply skips it, and the log shows
--    nothing happened. So instead:
--      - review_photo / review_voice_intro (existing SECURITY DEFINER RPCs, 0033 / 0024)
--        are redefined here to log as part of the same transaction as the moderation write
--        — the write and the log happen together or not at all.
--      - resolve_report is a NEW SECURITY DEFINER RPC replacing what was, until this
--        migration, a raw `supabase.from('reports').update(...)` from the client
--        (admin/index.html's updateReportStatus), authorized only by
--        `reports_update_admin using (is_admin_user())` with a blanket column-level UPDATE
--        grant and no with_check — meaning any admin could silently rewrite a report's
--        reason/details/reporter_id/reported_id, not just its status, with nothing
--        recording that they had. resolve_report narrows the write to status/reviewed_by/
--        reviewed_at, logs it, and the broad UPDATE grant + reports_update_admin policy are
--        removed below so this RPC becomes the only write path — same shape review_photo
--        already uses against profile_media.
--      - admin_view_conversation is a NEW SECURITY DEFINER RPC replacing the direct
--        `supabase.from('messages').select(...)` in admin/index.html's loadConversation,
--        which read under `messages_select_admin using (is_admin_user())` with no logging
--        of any kind. This was flagged in the task as "the important one" — reading a
--        stranger's private messages is the most sensitive thing this console does — so it
--        gets the same treatment: read and log in one atomic call, and
--        messages_select_admin is dropped below so a direct client query can no longer
--        reach another user's messages at all; admin_view_conversation is the only door.
--
--    log_admin_action itself is also directly GRANTed to authenticated, satisfying the
--    task's (b) literally (an RPC the admin tool can call to record an entry, deriving the
--    admin from auth.uid()) and available for any admin action added later that doesn't
--    yet have — or doesn't need — a dedicated wrapping RPC of its own. It is NOT how any of
--    the three required call sites are logged, for the reason above: the client is never
--    trusted to remember to call it.

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  target_profile_id uuid,
  target_match_id uuid,
  target_report_id uuid,
  target_media_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_action_check check (
    action in ('view_conversation', 'review_photo', 'review_voice_intro', 'report_status_change')
  )
);

create index admin_audit_log_admin_id_idx on public.admin_audit_log (admin_id);
create index admin_audit_log_target_profile_id_idx on public.admin_audit_log (target_profile_id);
create index admin_audit_log_target_report_id_idx on public.admin_audit_log (target_report_id);
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_select_admin" on public.admin_audit_log
  for select using (public.is_admin_user());

-- with_check pins admin_id to the caller even on a hypothetical direct client insert
-- (log_admin_action already does this by construction, since it writes auth.uid() itself
-- and never accepts an admin id argument — this is the second, independent enforcement
-- of the same rule, at the row-security layer rather than the function layer).
create policy "admin_audit_log_insert_admin" on public.admin_audit_log
  for insert with check (public.is_admin_user() and admin_id = auth.uid());

revoke all on public.admin_audit_log from public, anon, authenticated;
grant select, insert on public.admin_audit_log to authenticated;
-- No update/delete grant follows this line, to anyone, ever. That absence is the point.

-- ---------------------------------------------------------------------------
-- Shared logging primitive. SECURITY DEFINER so it can INSERT despite the table having
-- no update/delete grant for anyone — INSERT is still explicitly granted above, this
-- SECURITY DEFINER is what makes admin_id trustworthy (derived from auth.uid() inside the
-- function body, never accepted as an argument) rather than about bypassing a missing
-- grant.
-- ---------------------------------------------------------------------------

create or replace function public.log_admin_action(
  p_action text,
  p_target_profile_id uuid default null,
  p_target_match_id uuid default null,
  p_target_report_id uuid default null,
  p_target_media_id uuid default null,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  insert into public.admin_audit_log (
    admin_id, action, target_profile_id, target_match_id, target_report_id, target_media_id, detail
  ) values (
    auth.uid(), p_action, p_target_profile_id, p_target_match_id, p_target_report_id, p_target_media_id,
    coalesce(p_detail, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_admin_action(text, uuid, uuid, uuid, uuid, jsonb) to authenticated;
revoke execute on function public.log_admin_action(text, uuid, uuid, uuid, uuid, jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- review_photo (0033): unchanged behavior, now logs inside the same transaction as the
-- moderation_status write. Grants restated identically to 0033's (verified live via
-- pg_proc.proacl before writing this migration: authenticated + service_role only, no
-- anon/public entry — CREATE OR REPLACE preserves ACL anyway, but this schema's own
-- convention, per 0042's header, is to restate it rather than rely on that silently).
-- ---------------------------------------------------------------------------

create or replace function public.review_photo(p_media_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.profile_media
  set moderation_status = case
        when p_approve then 'approved'::moderation_status_enum
        else 'rejected'::moderation_status_enum
      end
  where id = p_media_id
  returning profile_id into v_profile_id;

  if not found then
    raise exception 'Media not found';
  end if;

  perform public.log_admin_action(
    'review_photo',
    p_target_profile_id => v_profile_id,
    p_target_media_id => p_media_id,
    p_detail => jsonb_build_object('approved', p_approve)
  );
end;
$$;

revoke execute on function public.review_photo(uuid, boolean) from public, anon;
grant execute on function public.review_photo(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- review_voice_intro (0024): same treatment. 0024 never stated an explicit revoke from
-- public/anon (only a grant to authenticated); live proacl check before writing this
-- migration showed no anon/public entry regardless, but the revoke is added explicitly
-- now anyway, closing the same class of gap 0041 found elsewhere on principle rather than
-- because this one was live.
-- ---------------------------------------------------------------------------

create or replace function public.review_voice_intro(p_profile_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.profile_voice_intro
  set moderation_status = case when p_approve then 'approved'::moderation_status_enum else 'rejected'::moderation_status_enum end
  where profile_id = p_profile_id;

  if not found then
    raise exception 'Voice intro not found';
  end if;

  perform public.log_admin_action(
    'review_voice_intro',
    p_target_profile_id => p_profile_id,
    p_detail => jsonb_build_object('approved', p_approve)
  );
end;
$$;

grant execute on function public.review_voice_intro(uuid, boolean) to authenticated;
revoke execute on function public.review_voice_intro(uuid, boolean) from public, anon;

-- ---------------------------------------------------------------------------
-- resolve_report: NEW. Replaces admin/index.html's raw `.from('reports').update(...)`.
-- Narrows what an admin write to a report can touch (status/reviewed_by/reviewed_at only
-- — previously any column, per the live grant checked before writing this migration) and
-- logs every status change. The broad grant/policy this replaces are removed immediately
-- below so this function is the only remaining write path, mirroring how review_photo is
-- already the only write path to profile_media.moderation_status.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_report(p_report_id uuid, p_status report_status_enum)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reported_profile_id uuid;
  v_match_id uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.reports
  set status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_report_id
  returning reported_profile_id, match_id into v_reported_profile_id, v_match_id;

  if not found then
    raise exception 'Report not found';
  end if;

  perform public.log_admin_action(
    'report_status_change',
    p_target_profile_id => v_reported_profile_id,
    p_target_match_id => v_match_id,
    p_target_report_id => p_report_id,
    p_detail => jsonb_build_object('status', p_status)
  );
end;
$$;

grant execute on function public.resolve_report(uuid, report_status_enum) to authenticated;
revoke execute on function public.resolve_report(uuid, report_status_enum) from public, anon;

drop policy if exists "reports_update_admin" on public.reports;
revoke update on public.reports from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_view_conversation: NEW. Replaces admin/index.html's raw
-- `.from('messages').select(...)`, gated only by messages_select_admin. That policy is
-- dropped below so this RPC becomes the only way an is_admin account can read a match it
-- isn't a participant in — messages_select_participant (untouched) still covers everyone
-- reading their own conversations normally. p_report_id is optional context for the log
-- entry only (the admin console's "View chat" always opens from a specific report row
-- today) — it is not otherwise validated or enforced; the policy commitment described in
-- trust-and-safety.md section 6 ("only opened in direct response to an open report")
-- remains a written policy, not a technical restriction, same as before this migration.
-- What changes is that every open is now attributable.
-- ---------------------------------------------------------------------------

create or replace function public.admin_view_conversation(p_match_id uuid, p_report_id uuid default null)
returns table (sender_id uuid, content text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  perform public.log_admin_action(
    'view_conversation',
    p_target_match_id => p_match_id,
    p_target_report_id => p_report_id
  );

  return query
  select m.sender_id, m.content, m.created_at
  from public.messages m
  where m.match_id = p_match_id
  order by m.created_at
  limit 100;
end;
$$;

grant execute on function public.admin_view_conversation(uuid, uuid) to authenticated;
revoke execute on function public.admin_view_conversation(uuid, uuid) from public, anon;

drop policy if exists "messages_select_admin" on public.messages;
