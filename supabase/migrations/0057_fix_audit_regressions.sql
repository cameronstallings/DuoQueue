-- Fixes four regressions found by the verification pass over 0053-0056
-- (scratchpad/verify-final.md), applied and re-verified live before this migration
-- was written. Numbered to match that report's own numbering.

-- =========================================================================
-- (1) BROKEN FLOW — no admin can suspend anyone.
--
-- 0053 added set_profile_suspension(), which calls log_admin_action('set_profile_
-- suspension', ...). 0047's admin_audit_log_action_check allow-list was never
-- extended to include that string, so every call raises
-- "new row for relation admin_audit_log violates check constraint
-- admin_audit_log_action_check" and the update never lands (the log_admin_action
-- call happens after the profiles UPDATE in the same function, but the whole
-- function is one transaction — the exception rolls the UPDATE back too).
-- 100% reproducible live before this migration; confirmed live after.
--
-- Full audit of every log_admin_action call site (grep across supabase/migrations
-- and admin/index.html — the admin console never calls log_admin_action directly,
-- only through the wrapping RPCs below):
--   0047: review_photo            -> 'review_photo'
--   0047: review_voice_intro      -> 'review_voice_intro'
--   0047: resolve_report          -> 'report_status_change'
--   0047: admin_view_conversation -> 'view_conversation'
--   0053: set_profile_suspension  -> 'set_profile_suspension'   <- missing
-- set_profile_ban (0042, redefined 0054) does NOT call log_admin_action at all,
-- before or after this batch — out of scope for this constraint, unaffected.
-- That is the complete set of action strings in use; the constraint now covers all
-- five of them (the original four, unchanged, plus the one 0053 introduced).
-- =========================================================================

alter table public.admin_audit_log drop constraint admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check
  check (
    action in (
      'view_conversation', 'review_photo', 'review_voice_intro', 'report_status_change',
      'set_profile_suspension'
    )
  );

-- =========================================================================
-- (2) REGRESSION — admin moderation silently stopped being audit-logged, and a bad
-- media/profile id silently no-ops instead of raising.
--
-- 0055's `create or replace function review_photo/review_voice_intro` was written
-- from an older body (pre-0047) to add the admin_reviewed_at marker, and in doing
-- so dropped two things 0047 had added: the `perform log_admin_action(...)` call,
-- and the `if not found then raise exception` check. Confirmed live (pg_proc.prosrc
-- before this migration): no `log_admin_action` anywhere in either body, and no
-- `not found` check either.
--
-- Fixed by merging 0047's audit-log call + not-found guard back in, on top of
-- 0055's own admin_reviewed_at write (kept verbatim — that's the fix that stops
-- moderate-photo from overturning a human decision, and must not be lost again).
-- Neither migration's contribution is reverted; both are present in the body below.
-- =========================================================================

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
      end,
      admin_reviewed_at = now()
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
  set moderation_status = case when p_approve then 'approved'::moderation_status_enum else 'rejected'::moderation_status_enum end,
      admin_reviewed_at = now()
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

-- =========================================================================
-- (3) LATENT — TRUNCATE granted to anon AND authenticated on every table in public.
--
-- TRUNCATE bypasses RLS entirely; PostgREST doesn't expose it today, which is the
-- only reason this isn't already Critical. Verified live before this migration:
-- exactly 44 of the 47 tables in public had TRUNCATE granted to both anon and
-- authenticated (the 3 exceptions — messages, banned_identities, admin_audit_log —
-- were already closed by 0053/0047's own explicit `revoke all`/`revoke insert,
-- update, delete, truncate`). Closed the same way 0052 closed write access on the
-- discovery views: loop over the live catalog rather than a hand-typed table list,
-- so nothing is missed and nothing added later by mistake is skipped.
--
-- Deliberately NOT touched: SELECT/INSERT/UPDATE/DELETE grants on every table stay
-- exactly as they were — only TRUNCATE is named in the revoke below. Verified on
-- `profiles` before/after (see r-regressions.md).
-- =========================================================================

do $$
declare
  v_table text;
begin
  for v_table in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke truncate on public.%I from public, anon, authenticated', v_table);
  end loop;
end;
$$;

-- Schema-wide default so a table created later doesn't inherit TRUNCATE either.
-- Belt and suspenders: 0052 already ran
--   `alter default privileges in schema public
--      revoke insert, update, delete, truncate, references, trigger on tables
--      from anon, authenticated;`
-- as the role that creates tables in this project's migrations, and it is still in
-- effect (confirmed live via pg_default_acl before writing this migration — new
-- tables owned by that role already default anon/authenticated to SELECT only, no
-- TRUNCATE). This restates just the TRUNCATE slice explicitly and idempotently, the
-- same defensive pattern 0056 used for profile_must_be_18, in case some future
-- migration ever runs ALTER DEFAULT PRIVILEGES again and narrows what it revokes.
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;

-- =========================================================================
-- (4) HYGIENE — enforce_messages_read_only_update (0053's trigger function) never
-- had its default PUBLIC/anon/authenticated EXECUTE grant revoked. Not exploitable
-- (Postgres refuses to run a trigger function outside trigger context: "trigger
-- functions can only be called as triggers", independent of privilege — confirmed
-- live), but every other new function in 0053-0056 explicitly revoked public/anon,
-- and this one didn't. Revoking EXECUTE does not stop it firing as a trigger —
-- trigger invocation is not privilege-checked against the invoking role.
--
-- Naming all three (public, anon, authenticated) rather than just public: revoking
-- from PUBLIC alone does not remove a role's own separate explicit grant, and
-- pg_proc.proacl confirmed live that anon and authenticated each hold a distinct
-- explicit EXECUTE entry here, not just inherited-via-PUBLIC access.
-- =========================================================================

revoke execute on function public.enforce_messages_read_only_update() from public, anon, authenticated;

-- Sweep for any other function in public still carrying an anon/authenticated
-- EXECUTE grant that shouldn't have one (pg_proc.proacl, cross-checked against
-- information_schema.role_routine_grants, live before this migration):
-- has_disallowed_control_chars() is the only other one, and it's correct as-is,
-- not touched here. It's IMMUTABLE, side-effect-free (a pure regex predicate) and
-- is called directly inside CHECK constraints on columns authenticated writes
-- through ordinary table grants without going through a SECURITY DEFINER RPC:
-- profiles.display_name/bio/ban_reason, profile_prompts.answer, profile_games.
-- rank_text, reports.details, messages.content, party_messages.content, games.name,
-- shows.name, hidden_words.word. A CHECK constraint runs as the inserting/updating
-- role, so authenticated genuinely needs EXECUTE for those writes to succeed at
-- all; anon's copy of the grant is vestigial (RLS has no INSERT policy that ever
-- lets anon's row through) but harmless given the function has no side effects and
-- returns only a boolean derived from the input text already in the statement.
-- Every other function returned by the sweep already showed only `authenticated`
-- (no anon, no PUBLIC) as its grantee.
