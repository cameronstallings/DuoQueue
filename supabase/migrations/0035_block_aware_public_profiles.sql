-- Make every public_profile* view block-aware.
--
-- Blocking is the app's primary safety control; nothing may route around it (0031 §5).
-- Every discovery RPC (get_deck, get_standouts, get_online_now, get_admirers, the party
-- deck) excludes blocked pairs via is_blocked_pair(), and blocking severs any active
-- match (handle_new_block, 0001). But the public_profile* views — the by-id read path —
-- had no block awareness at all. Concretely: the profile modal (useProfileCard.ts) and
-- the party member list (usePartyMembers in useParty.ts) both select from
-- public_profiles by id, so a user could still open the full profile card of someone
-- they blocked, or someone who blocked them. And because the views are plain PostgREST
-- endpoints, the sibling views leaked the rest of the profile (photos, games, prompts,
-- vibe, schedule, activity, voice intro) to direct API calls even where the app's UI
-- never surfaced it. This mirrors the RPCs' exclusion at the view layer, where it
-- cannot be bypassed by any client.
--
-- Mechanics — why the pair check is inlined rather than calling is_blocked_pair():
-- permission checks for *functions* referenced in a view run as the querying user, and
-- 0031 deliberately revoked EXECUTE on is_blocked_pair() from `authenticated` (it takes
-- two arbitrary ids, so it let anyone probe strangers' block relationships). Table
-- access inside a view, by contrast, is checked against the view owner, which owns
-- public.blocks and bypasses its RLS — the same "view re-implements its own filter"
-- pattern documented at the top of 0001's view section. For service-role/dashboard
-- access auth.uid() is null, both arms of the pair check are unknown, and the NOT
-- EXISTS passes — privileged callers keep full visibility.
--
-- What a blocked user observes: the profile resolves to zero rows, exactly as if the
-- account had been deactivated — the same signal get_deck already gives, so no new
-- information leaks in either direction.
--
-- CREATE OR REPLACE preserves each view's existing ACLs, so 0031's `revoke ... from
-- anon` and the `authenticated` SELECT grants carry over untouched; nothing here
-- touches grants.

create or replace view public.public_profiles as
select
  p.id,
  p.display_name,
  extract(year from age(current_date, p.dob))::int as age,
  p.gender,
  p.region,
  p.bio,
  p.created_at
from public.profiles p
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_media as
select pm.id, pm.profile_id, pm.storage_path, pm.photo_role
from public.profile_media pm
join public.profiles p on p.id = pm.profile_id
where pm.moderation_status = 'approved'
  and p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_games as
select pg.profile_id, pg.game_id, g.name as game_name, pg.skill_level, pg.rank_text, pg.priority
from public.profile_games pg
join public.games g on g.id = pg.game_id
join public.profiles p on p.id = pg.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_shows as
select ps.profile_id, ps.show_id, s.name as show_name, s.category, ps.priority
from public.profile_shows ps
join public.shows s on s.id = ps.show_id
join public.profiles p on p.id = ps.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_platforms as
select pp.profile_id, pp.platform
from public.profile_platforms pp
join public.profiles p on p.id = pp.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_languages as
select pl.profile_id, pl.language_code
from public.profile_languages pl
join public.profiles p on p.id = pl.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_playstyles as
select pps.profile_id, pps.tag
from public.profile_playstyles pps
join public.profiles p on p.id = pps.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_prompts as
select pp.profile_id, pp."position", pr.question, pp.answer
from public.profile_prompts pp
join public.prompts pr on pr.id = pp.prompt_id
join public.profiles p on p.id = pp.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_vibe as
select pv.profile_id, pv.intensity, pv.comms_style, pv.coaching_pref, pv.tilt_handling
from public.profile_vibe pv
join public.profiles p on p.id = pv.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_schedule as
select p.id as profile_id, p.usual_play_start_hour, p.usual_play_end_hour
from public.profiles p
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

create or replace view public.public_profile_activity as
select
  p.id as profile_id,
  case
    when p.hide_last_active then false
    else p.last_active_at is not null and p.last_active_at > now() - interval '24 hours'
  end as is_recently_active
from public.profiles p
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

-- public_profile_voice_intro additionally gains the onboarding_completed filter it has
-- been missing since 0024: 0028 hangs the email-verification guarantee entirely on
-- onboarding_completed ("an unverified account is automatically invisible everywhere"),
-- and 0031 §9 brought the other sub-profile views in line but missed this one.
create or replace view public.public_profile_voice_intro as
select pvi.profile_id, pvi.storage_path, pvi.duration_seconds
from public.profile_voice_intro pvi
join public.profiles p on p.id = pvi.profile_id
where pvi.moderation_status = 'approved'
  and p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );
