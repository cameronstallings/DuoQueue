-- Moderation integrity + a handful of medium/low findings from the same audit pass.
--
-- 1. HIGH — moderate-photo could overturn a human moderator.
--
-- moderate-photo (Edge Function, service role) re-runs the automated NSFW check and
-- unconditionally overwrites profile_media.moderation_status. review_photo() is the
-- only path an admin has to reject a photo, but nothing stopped the same mediaId being
-- POSTed to moderate-photo again afterwards — the automated check would run a second
-- time and silently flip an admin's "rejected" back to "approved" (or vice versa),
-- with no audit trail and no way for the admin to know it happened. Same shape exists
-- for profile_voice_intro/review_voice_intro, even though no automated re-check exists
-- for audio today — the marker is added there too so the guard is ready if one ever
-- does, and so both review paths stay symmetric (0033's stated goal).
--
-- Fix: a durable, admin-only marker (admin_reviewed_at) that review_photo/
-- review_voice_intro set on every call, and that a fresh upload (storage_path change)
-- clears — new bytes deserve a fresh look, and the trigger that already resets
-- moderation_status to 'pending' on repointing is the natural place to also clear the
-- marker. moderate-photo (application code, see index.ts) refuses to touch a row once
-- the marker is set, returning 409. Only review_photo can move it again after that.
alter table public.profile_media add column admin_reviewed_at timestamptz;
alter table public.profile_voice_intro add column admin_reviewed_at timestamptz;

create or replace function public.review_photo(p_media_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
  where id = p_media_id;
end;
$$;

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
end;
$$;

-- Repointing the file (a genuine re-upload of new bytes) clears both the moderation
-- status AND the admin marker — an admin's decision about the OLD bytes must not block
-- automated (or manual) review of bytes they never saw.
create or replace function public.reset_media_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.storage_path is distinct from old.storage_path then
    new.moderation_status := 'pending';
    new.admin_reviewed_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.reset_voice_intro_moderation()
returns trigger
language plpgsql
as $$
begin
  if new.storage_path is distinct from old.storage_path then
    new.moderation_status := 'pending';
    new.admin_reviewed_at := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. MEDIUM — ban enforcement on the swipe/match-creation path checked only the caller.
--
-- perform_swipe already rejects a banned CALLER (is_banned_user(v_swiper_id), added in
-- 0042), but never checked the TARGET. A banned user's pre-ban 'like' row on someone
-- else survives the ban (banning doesn't delete swipes). If that someone else later
-- swipes 'like' on the banned account — e.g. the deck row was cached client-side before
-- the ban took effect, or they already knew the id — perform_swipe finds the banned
-- user's old 'like', calls it a mutual like, and creates a brand-new match. The banned
-- account can't act on it, but the other person still gets matched to (and can still
-- message, per 0042's messages_before_insert) an account the app has already banned.
-- send_super_ping and send_rose both call perform_swipe internally, so this closes the
-- same hole for those entry points too.
create or replace function public.perform_swipe(p_target_id uuid, p_action swipe_action_enum)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swiper_id uuid := auth.uid();
  v_timezone text;
  v_local_day date;
  v_is_premium boolean;
  v_swipe_count int;
  v_existing_action swipe_action_enum;
  v_mutual_like boolean;
  v_user_a uuid;
  v_user_b uuid;
begin
  if v_swiper_id is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_swiper_id) then
    raise exception 'account_banned';
  end if;
  if public.is_banned_user(p_target_id) then
    raise exception 'target_banned';
  end if;
  -- 1/sec sustained, well above the fastest realistic flick-swiping. The free-tier
  -- 25/day cap below already binds tighter for non-premium callers; this exists for
  -- premium/unlimited swipers, who currently have no server-side rate cap at all.
  perform public.check_rate_limit('perform_swipe', 60, interval '1 minute');
  if v_swiper_id = p_target_id then
    raise exception 'Cannot swipe on yourself';
  end if;
  if public.is_blocked_pair(v_swiper_id, p_target_id) then
    raise exception 'Cannot swipe on a blocked user';
  end if;
  if not public.same_age_band(v_swiper_id, p_target_id) then
    raise exception 'Cannot interact across age groups';
  end if;

  select action into v_existing_action
  from public.swipes
  where swiper_id = v_swiper_id and target_id = p_target_id;

  if v_existing_action is not null then
    select m.id into match_id
    from public.matches m
    where m.user_a_id = least(v_swiper_id, p_target_id)
      and m.user_b_id = greatest(v_swiper_id, p_target_id)
      and m.unmatched_at is null;

    matched := match_id is not null;
    return next;
    return;
  end if;

  v_is_premium := public.is_premium(v_swiper_id);

  if not v_is_premium then
    select timezone into v_timezone from public.profiles where id = v_swiper_id;
    v_local_day := (now() at time zone coalesce(v_timezone, 'utc'))::date;

    insert into public.daily_swipe_counters (profile_id, day, swipe_count)
    values (v_swiper_id, v_local_day, 0)
    on conflict (profile_id, day) do nothing;

    select swipe_count into v_swipe_count
    from public.daily_swipe_counters
    where profile_id = v_swiper_id and day = v_local_day
    for update;

    if v_swipe_count >= 25 then
      raise exception 'daily_swipe_limit_reached';
    end if;

    update public.daily_swipe_counters
    set swipe_count = swipe_count + 1
    where profile_id = v_swiper_id and day = v_local_day;
  end if;

  insert into public.swipes (swiper_id, target_id, action)
  values (v_swiper_id, p_target_id, p_action);

  matched := false;
  match_id := null;

  if p_action = 'like' then
    select exists (
      select 1 from public.swipes
      where swiper_id = p_target_id and target_id = v_swiper_id and action = 'like'
    ) into v_mutual_like;

    if v_mutual_like then
      v_user_a := least(v_swiper_id, p_target_id);
      v_user_b := greatest(v_swiper_id, p_target_id);

      insert into public.matches (user_a_id, user_b_id)
      values (v_user_a, v_user_b)
      on conflict (user_a_id, user_b_id) do update set unmatched_at = null, unmatched_by = null
      returning id into match_id;

      matched := true;
    end if;
  end if;

  return next;
end;
$$;

grant execute on function public.perform_swipe(uuid, swipe_action_enum) to authenticated;
revoke execute on function public.perform_swipe(uuid, swipe_action_enum) from public, anon;

-- ---------------------------------------------------------------------------
-- 5a. LOW — get_reputation had no relationship requirement.
--
-- 0031 already stopped a stranger from seeing someone's private 'flaked' tally, but
-- every OTHER tag (good_comms, chill_after_losses, showed_up_on_time) was still
-- readable for any profile id by any authenticated caller — walk public_profiles and
-- build a reputation dossier on everyone, matched or not. submit_match_feedback already
-- requires the rater to be a match participant; reading should require the same
-- relationship. Matched-pair check ignores unmatched_at (mirrors submit_match_feedback,
-- which also lets feedback stand after an unmatch) so reputation earned in a match
-- doesn't vanish the moment either side unmatches.
create or replace function public.get_reputation(p_profile_id uuid)
returns table (tag match_feedback_tag_enum, tag_count int)
language sql
stable
security definer
set search_path = public
as $$
  select mf.tag, count(*)::int
  from public.match_feedback mf
  where mf.ratee_id = p_profile_id
    and (
      p_profile_id = auth.uid()
      or exists (
        select 1 from public.matches m
        where m.user_a_id = least(auth.uid(), p_profile_id)
          and m.user_b_id = greatest(auth.uid(), p_profile_id)
      )
    )
    and (p_profile_id = auth.uid() or mf.tag <> 'flaked')
  group by mf.tag;
$$;

-- ---------------------------------------------------------------------------
-- 5b. LOW — profiles.last_active_at was directly client-writable.
--
-- 0031's column-level UPDATE grant on profiles included last_active_at alongside real
-- profile fields, but this column drives deck ranking (order by ... last_active_at desc)
-- and the premium "recently active" filter — a client could set it to any timestamp,
-- including one in the future, and always sort to the top / always pass the filter.
-- heartbeat() (0021) already exists as the correct server-side touch: SECURITY DEFINER,
-- always writes now() for auth.uid(), no caller-supplied value possible. Removing the
-- column from the client grant forces every write through it.
--
-- apps/mobile/src/store/session-store.ts (outside this track's file ownership) still
-- does a direct `.update({ last_active_at: ... })` on sign-in; that call will now fail
-- (caught, logged as a warning, non-fatal) since the column grant is gone. It should be
-- swapped for `supabase.rpc('heartbeat')` — flagged separately, not fixed here.
revoke update (last_active_at) on public.profiles from authenticated;
