-- Audit hardening pass: six confirmed findings from the security/legal audit, all on
-- the database side. Each section is labelled to match the audit's own lettering.
--
-- (a) storage *_select_approved policies had no block check, unlike every public_*
--     view (0035) — a blocked pair could keep minting signed URLs to each other's
--     approved photo/voice-intro objects forever if either side had ever seen the path.
-- (b) get_deck/get_standouts/get_online_now/get_party_deck took a caller-supplied
--     p_limit with no server-side clamp — one call could scrape the entire user base.
-- (c) delete-account hard-deletes the auth user, and reports.reported_id cascaded with
--     it, so a harasser could erase every report filed against them by deleting their
--     own account, then re-sign up with a clean slate. Two independent pieces:
--       1. reported_id now survives as SET NULL (report row + content persist) instead
--          of cascading away, plus a non-FK reported_profile_id copy so reports against
--          the same (now-deleted) person still correlate with each other.
--       2. a minimal admin-only ban flag on profiles that actually blocks app use
--          (discovery, swiping, messaging) for as long as the account exists. It does
--          not (and is not meant to) stop a banned identity from deleting their account
--          and signing up fresh under a new uuid — that needs an email/device-level
--          block independent of the profiles row lifecycle, which is a materially
--          bigger feature than "minimal ban mechanism" and is deliberately left out.
-- (d) public_linked_accounts was the one public_* view 0035 missed — no block
--     predicate, so a blocked pair could still read each other's linked Steam/Riot
--     handle and rank tier.
-- (e) games.riot_queue had no uniqueness constraint (unlike steam_app_id), so a
--     self-scoped custom-game insert could collide with the real catalog row and
--     corrupt which game a future Riot rank sync writes verified stats against.
-- (f) no rate limit on 1:1 or party message sending. Enforced as a BEFORE INSERT
--     trigger on messages/party_messages rather than inside send-message's Edge
--     Function or send_party_message's RPC, since a trigger catches both the
--     service-role edge-function insert path and the SECURITY DEFINER RPC path with
--     one definition, and can't be routed around by either.
--
-- Note on function grants: CREATE OR REPLACE FUNCTION on an existing function is
-- immediately followed here by an explicit re-grant to `authenticated` and an
-- explicit revoke from `public, anon` for every function this migration redefines,
-- per the exact grant-list this project already had live for each one (checked via
-- pg_proc.proacl before writing this migration) — not left to chance.

-- ---------------------------------------------------------------------------
-- (c) 1/2 — minimal admin-set ban flag. Defined before (b) since get_deck and friends
-- reference it below. Not in the authenticated column-update grant list on profiles
-- (0031 section 1), so it is already unwritable by a plain client update, same
-- protection is_admin/dob/timezone get; the only write path is set_profile_ban()
-- below, gated on is_admin_user().
-- ---------------------------------------------------------------------------

alter table public.profiles add column is_banned boolean not null default false;
alter table public.profiles add column banned_at timestamptz;
alter table public.profiles add column ban_reason text;

alter table public.profiles
  add constraint ban_reason_length check (ban_reason is null or char_length(ban_reason) <= 500) not valid;

-- Internal predicate, same shape and same lockdown as is_premium/is_blocked_pair
-- (0031 section 2): callable from other SECURITY DEFINER functions (which run as the
-- function owner, not the invoking role), never directly by a client.
create or replace function public.is_banned_user(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_banned from public.profiles p where p.id = p_profile_id), false);
$$;

revoke execute on function public.is_banned_user(uuid) from public, anon, authenticated;

-- Admin-only write path, same SECURITY DEFINER + is_admin_user() gate as
-- review_photo/review_voice_intro. Unbanning clears the reason/timestamp along with
-- the flag so a stale reason doesn't linger on a since-cleared account.
create or replace function public.set_profile_ban(p_profile_id uuid, p_banned boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set is_banned = p_banned,
      banned_at = case when p_banned then now() else null end,
      ban_reason = case when p_banned then p_reason else null end
  where id = p_profile_id;
end;
$$;

grant execute on function public.set_profile_ban(uuid, boolean, text) to authenticated;
revoke execute on function public.set_profile_ban(uuid, boolean, text) from public, anon;

-- ---------------------------------------------------------------------------
-- (a) HIGH — storage block bypass. Port 0035's exact block-exclusion predicate into
-- both storage policies, joined the same way the policy already resolves the owning
-- profile for the moderation/active/onboarding checks. `(storage.foldername(name))[1]`
-- is the object path's first segment, and the upload code
-- (apps/mobile/src/features/profile/usePhotoUpload.ts:29,
-- apps/mobile/src/features/profile/useVoiceIntro.ts:74) always writes
-- `${profileId}/...`, so it is the owner's profile id — confirmed against both upload
-- call sites, not assumed. When auth.uid() is null (service role / dashboard), both
-- sides of the NOT EXISTS's OR are NULL, the WHERE clause never matches any row, EXISTS
-- is false, and NOT EXISTS passes — privileged callers keep full visibility, same
-- reasoning 0035's header comment gives for the public_* views.
-- ---------------------------------------------------------------------------

drop policy if exists "profile_photos_select_approved" on storage.objects;
create policy "profile_photos_select_approved" on storage.objects
  for select to authenticated using (
    bucket_id = 'profile-photos'
    and exists (
      select 1
      from public.profile_media pm
      join public.profiles p on p.id = pm.profile_id
      where pm.storage_path = storage.objects.name
        and pm.moderation_status = 'approved'
        and p.is_active = true
        and p.onboarding_completed = true
        and (storage.foldername(storage.objects.name))[1] = pm.profile_id::text
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
             or (b.blocker_id = p.id and b.blocked_id = auth.uid())
        )
    )
  );

drop policy if exists "voice_intros_select_approved" on storage.objects;
create policy "voice_intros_select_approved" on storage.objects
  for select to authenticated using (
    bucket_id = 'voice-intros'
    and exists (
      select 1
      from public.profile_voice_intro pvi
      join public.profiles p on p.id = pvi.profile_id
      where pvi.storage_path = storage.objects.name
        and pvi.moderation_status = 'approved'
        and p.is_active = true
        and p.onboarding_completed = true
        and (storage.foldername(storage.objects.name))[1] = pvi.profile_id::text
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
             or (b.blocker_id = p.id and b.blocked_id = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- (d) MEDIUM — public_linked_accounts was the one public_* view 0035 missed.
-- CREATE OR REPLACE VIEW preserves the view's existing ACL (0035's own header comment
-- documents this same fact for the views it touched), but the grant/revoke pair is
-- restated explicitly anyway so this section doesn't depend on that going unverified.
-- ---------------------------------------------------------------------------

create or replace view public.public_linked_accounts as
select la.profile_id, la.provider, la.display_name, la.rank_tier
from public.linked_accounts la
join public.profiles p on p.id = la.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

grant select on public.public_linked_accounts to authenticated;
revoke select on public.public_linked_accounts from anon;

-- ---------------------------------------------------------------------------
-- (e) MEDIUM — games.riot_queue has no uniqueness constraint, unlike steam_app_id
-- (games_steam_app_id_idx, 0039). Dedup defensively first (checked live before writing
-- this migration: zero duplicate riot_queue values exist today, only the seeded League
-- of Legends row is non-null) so this migration is safe to run again in any
-- environment that does have a collision, keeping whichever row was created first and
-- nulling the rest rather than failing the index build outright.
-- ---------------------------------------------------------------------------

with ranked as (
  select id, row_number() over (partition by riot_queue order by created_at, id) as rn
  from public.games
  where riot_queue is not null
)
update public.games g
set riot_queue = null
from ranked r
where g.id = r.id and r.rn > 1;

create unique index games_riot_queue_idx on public.games (riot_queue) where riot_queue is not null;

-- ---------------------------------------------------------------------------
-- (b) HIGH — clamp p_limit server-side in every deck-style RPC, and (c) 2/2 — make
-- each of them refuse a banned caller and stop surfacing banned profiles as
-- candidates. Each function's own existing default is preserved in its clamp
-- (get_standouts defaults to 8, get_online_now to 30, the other two to 20) — only the
-- upper bound (50) and lower bound (1) are new.
-- ---------------------------------------------------------------------------

create or replace function public.get_deck(p_limit int default 20)
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count int,
  shared_shows_count int,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_is_premium boolean;
  v_min_age smallint;
  v_max_age smallint;
  v_preferred_genders gender_enum[];
  v_preferred_regions region_enum[];
  v_required_language text;
  v_filter_game_id uuid;
  v_filter_platform platform_enum;
  v_filter_skill_level skill_level_enum;
  v_filter_playstyle playstyle_tag_enum;
  v_filter_show_id uuid;
  v_filter_recently_active boolean;
  v_my_region region_enum;
  v_my_timezone text;
  v_my_play_start smallint;
  v_my_play_end smallint;
  v_i_am_minor boolean;
  v_effective_min_age smallint;
  v_effective_max_age smallint;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  v_is_premium := public.is_premium(v_me);
  v_i_am_minor := public.is_minor(v_me);

  select pr.min_age, pr.max_age, pr.preferred_genders, pr.preferred_regions, pr.required_language,
         pr.filter_game_id, pr.filter_platform, pr.filter_skill_level, pr.filter_playstyle,
         pr.filter_show_id, pr.filter_recently_active
  into v_min_age, v_max_age, v_preferred_genders, v_preferred_regions, v_required_language,
       v_filter_game_id, v_filter_platform, v_filter_skill_level, v_filter_playstyle,
       v_filter_show_id, v_filter_recently_active
  from public.preferences pr
  where pr.profile_id = v_me;

  select p.region, p.timezone, p.usual_play_start_hour, p.usual_play_end_hour
  into v_my_region, v_my_timezone, v_my_play_start, v_my_play_end
  from public.profiles p where p.id = v_me;

  if not v_is_premium then
    v_filter_game_id := null;
    v_filter_platform := null;
    v_filter_skill_level := null;
    v_filter_playstyle := null;
    v_filter_show_id := null;
    v_filter_recently_active := false;
  end if;

  if v_i_am_minor then
    v_effective_min_age := 15;
    v_effective_max_age := 17;
  else
    v_effective_min_age := greatest(coalesce(v_min_age, 18), 18);
    v_effective_max_age := coalesce(v_max_age, 99);
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.display_name,
      extract(year from age(current_date, p.dob))::int as c_age,
      p.gender,
      p.region,
      p.bio,
      p.last_active_at,
      p.timezone,
      p.usual_play_start_hour,
      p.usual_play_end_hour
    from public.profiles p
    where p.id <> v_me
      and p.is_active = true
      and p.onboarding_completed = true
      and p.is_banned = false
      and not exists (
        select 1 from public.swipes s where s.swiper_id = v_me and s.target_id = p.id
      )
      and not public.is_blocked_pair(v_me, p.id)
      and extract(year from age(current_date, p.dob))::int
            between v_effective_min_age and v_effective_max_age
      and (
        v_preferred_genders is null or array_length(v_preferred_genders, 1) is null
        or p.gender = any (v_preferred_genders)
      )
      and (
        v_preferred_regions is null or array_length(v_preferred_regions, 1) is null
        or p.region = any (v_preferred_regions)
      )
      and (
        v_required_language is null or exists (
          select 1 from public.profile_languages pl
          where pl.profile_id = p.id and pl.language_code = v_required_language
        )
      )
      and (
        v_filter_platform is null or exists (
          select 1 from public.profile_platforms pp
          where pp.profile_id = p.id and pp.platform = v_filter_platform
        )
      )
      and (
        v_filter_game_id is null or exists (
          select 1 from public.profile_games pg
          where pg.profile_id = p.id and pg.game_id = v_filter_game_id
        )
      )
      and (
        v_filter_skill_level is null or exists (
          select 1 from public.profile_games pg
          where pg.profile_id = p.id and pg.skill_level = v_filter_skill_level
        )
      )
      and (
        v_filter_playstyle is null or exists (
          select 1 from public.profile_playstyles pps
          where pps.profile_id = p.id and pps.tag = v_filter_playstyle
        )
      )
      and (
        v_filter_show_id is null or exists (
          select 1 from public.profile_shows psh
          where psh.profile_id = p.id and psh.show_id = v_filter_show_id
        )
      )
      and (
        not v_filter_recently_active
        or (p.last_active_at is not null and p.last_active_at > now() - interval '24 hours')
      )
  ),
  shared_games as (
    select
      c.id as profile_id,
      count(*)::int as shared_count,
      count(*) filter (where mine.skill_level = theirs.skill_level)::int as skill_match_count
    from candidates c
    join public.profile_games theirs on theirs.profile_id = c.id
    join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
    group by c.id
  ),
  shared_shows as (
    select c.id as profile_id, count(*)::int as shared_count
    from candidates c
    join public.profile_shows theirs on theirs.profile_id = c.id
    join public.profile_shows mine on mine.show_id = theirs.show_id and mine.profile_id = v_me
    group by c.id
  ),
  shared_languages as (
    select c.id as profile_id, count(*)::int as shared_count
    from candidates c
    join public.profile_languages theirs on theirs.profile_id = c.id
    join public.profile_languages mine on mine.language_code = theirs.language_code and mine.profile_id = v_me
    group by c.id
  ),
  boosted as (
    select distinct ab.profile_id from public.active_boosts ab where ab.expires_at > now()
  )
  select
    c.id,
    c.display_name,
    c.c_age,
    c.gender,
    c.region,
    c.bio,
    coalesce(sg.shared_count, 0),
    coalesce(ss.shared_count, 0),
    (
      coalesce(sg.shared_count, 0) * 10
      + coalesce(sg.skill_match_count, 0) * 2
      + coalesce(ss.shared_count, 0) * 5
      + coalesce(sl.shared_count, 0) * 2
      + case when c.region = v_my_region then 3 else 0 end
      + least(
          public.play_window_overlap_hours(
            v_my_play_start, v_my_play_end, v_my_timezone,
            c.usual_play_start_hour, c.usual_play_end_hour, c.timezone
          ), 6
        )
      + case when b.profile_id is not null then 1000 else 0 end
    )::numeric as score
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  left join shared_languages sl on sl.profile_id = c.id
  left join boosted b on b.profile_id = c.id
  order by score desc, c.last_active_at desc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.get_deck(int) to authenticated;
revoke execute on function public.get_deck(int) from public, anon;

create or replace function public.get_standouts(p_limit int default 8)
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count int,
  shared_shows_count int,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_today date := current_date;
  v_existing_count int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 8), 1), 50);

  select count(*) into v_existing_count
  from public.daily_standouts ds
  where ds.profile_id = v_me and ds.day = v_today;

  if v_existing_count = 0 then
    insert into public.daily_standouts (profile_id, standout_id, day, position)
    select
      v_me,
      c.id,
      v_today,
      row_number() over (order by coalesce(sg.shared_count, 0) desc, random()) - 1
    from (
      select p.id
      from public.profiles p
      where p.id <> v_me
        and p.is_active = true
        and p.onboarding_completed = true
        and p.is_banned = false
        and not exists (
          select 1 from public.swipes s where s.swiper_id = v_me and s.target_id = p.id
        )
        and not public.is_blocked_pair(v_me, p.id)
        and public.same_age_band(v_me, p.id)
    ) c
    left join (
      select theirs.profile_id, count(*)::int as shared_count
      from public.profile_games theirs
      join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
      group by theirs.profile_id
    ) sg on sg.profile_id = c.id
    order by coalesce(sg.shared_count, 0) desc, random()
    limit p_limit;
  end if;

  return query
  select
    p.id,
    p.display_name,
    extract(year from age(current_date, p.dob))::int,
    p.gender,
    p.region,
    p.bio,
    coalesce(sg.shared_count, 0),
    coalesce(ss.shared_count, 0),
    0::numeric
  from public.daily_standouts ds
  join public.profiles p on p.id = ds.standout_id
  left join (
    select theirs.profile_id, count(*)::int as shared_count
    from public.profile_games theirs
    join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
    group by theirs.profile_id
  ) sg on sg.profile_id = p.id
  left join (
    select theirs.profile_id, count(*)::int as shared_count
    from public.profile_shows theirs
    join public.profile_shows mine on mine.show_id = theirs.show_id and mine.profile_id = v_me
    group by theirs.profile_id
  ) ss on ss.profile_id = p.id
  where ds.profile_id = v_me and ds.day = v_today
  order by ds.position;
end;
$$;

grant execute on function public.get_standouts(int) to authenticated;
revoke execute on function public.get_standouts(int) from public, anon;

create or replace function public.get_online_now(p_limit int default 30)
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count int,
  shared_shows_count int,
  last_active_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_is_premium boolean;
  v_min_age smallint;
  v_max_age smallint;
  v_preferred_genders gender_enum[];
  v_preferred_regions region_enum[];
  v_required_language text;
  v_filter_game_id uuid;
  v_filter_platform platform_enum;
  v_filter_skill_level skill_level_enum;
  v_filter_playstyle playstyle_tag_enum;
  v_i_am_minor boolean;
  v_effective_min_age smallint;
  v_effective_max_age smallint;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 30), 1), 50);

  v_is_premium := public.is_premium(v_me);
  v_i_am_minor := public.is_minor(v_me);

  select pr.min_age, pr.max_age, pr.preferred_genders, pr.preferred_regions, pr.required_language,
         pr.filter_game_id, pr.filter_platform, pr.filter_skill_level, pr.filter_playstyle
  into v_min_age, v_max_age, v_preferred_genders, v_preferred_regions, v_required_language,
       v_filter_game_id, v_filter_platform, v_filter_skill_level, v_filter_playstyle
  from public.preferences pr
  where pr.profile_id = v_me;

  if not v_is_premium then
    v_filter_game_id := null;
    v_filter_platform := null;
    v_filter_skill_level := null;
    v_filter_playstyle := null;
  end if;

  if v_i_am_minor then
    v_effective_min_age := 15;
    v_effective_max_age := 17;
  else
    v_effective_min_age := greatest(coalesce(v_min_age, 18), 18);
    v_effective_max_age := coalesce(v_max_age, 99);
  end if;

  return query
  with candidates as (
    select
      p.id,
      p.display_name,
      extract(year from age(current_date, p.dob))::int as c_age,
      p.gender,
      p.region,
      p.bio,
      p.last_active_at
    from public.profiles p
    where p.id <> v_me
      and p.is_active = true
      and p.onboarding_completed = true
      and p.is_banned = false
      and p.is_looking_now = true
      and p.looking_now_expires_at > now()
      and not exists (
        select 1 from public.swipes s where s.swiper_id = v_me and s.target_id = p.id
      )
      and not public.is_blocked_pair(v_me, p.id)
      and extract(year from age(current_date, p.dob))::int
            between v_effective_min_age and v_effective_max_age
      and (
        v_preferred_genders is null or array_length(v_preferred_genders, 1) is null
        or p.gender = any (v_preferred_genders)
      )
      and (
        v_preferred_regions is null or array_length(v_preferred_regions, 1) is null
        or p.region = any (v_preferred_regions)
      )
      and (
        v_required_language is null or exists (
          select 1 from public.profile_languages pl
          where pl.profile_id = p.id and pl.language_code = v_required_language
        )
      )
      and (
        v_filter_platform is null or exists (
          select 1 from public.profile_platforms pp
          where pp.profile_id = p.id and pp.platform = v_filter_platform
        )
      )
      and (
        v_filter_game_id is null or exists (
          select 1 from public.profile_games pg
          where pg.profile_id = p.id and pg.game_id = v_filter_game_id
        )
      )
      and (
        v_filter_skill_level is null or exists (
          select 1 from public.profile_games pg
          where pg.profile_id = p.id and pg.skill_level = v_filter_skill_level
        )
      )
      and (
        v_filter_playstyle is null or exists (
          select 1 from public.profile_playstyles pps
          where pps.profile_id = p.id and pps.tag = v_filter_playstyle
        )
      )
  ),
  shared_games as (
    select c.id as profile_id, count(*)::int as shared_count
    from candidates c
    join public.profile_games theirs on theirs.profile_id = c.id
    join public.profile_games mine on mine.game_id = theirs.game_id and mine.profile_id = v_me
    group by c.id
  ),
  shared_shows as (
    select c.id as profile_id, count(*)::int as shared_count
    from candidates c
    join public.profile_shows theirs on theirs.profile_id = c.id
    join public.profile_shows mine on mine.show_id = theirs.show_id and mine.profile_id = v_me
    group by c.id
  )
  select
    c.id,
    c.display_name,
    c.c_age,
    c.gender,
    c.region,
    c.bio,
    coalesce(sg.shared_count, 0),
    coalesce(ss.shared_count, 0),
    c.last_active_at
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  order by c.last_active_at desc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.get_online_now(int) to authenticated;
revoke execute on function public.get_online_now(int) from public, anon;

create or replace function public.get_party_deck(p_party_id uuid, p_limit int default 20)
returns table (
  profile_id uuid,
  display_name text,
  age int,
  gender gender_enum,
  region region_enum,
  bio text,
  shared_games_count int,
  shared_shows_count int,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  return query
  with party_member_ids as (
    select pm.profile_id as member_profile_id from public.party_members pm where pm.party_id = p_party_id
  ),
  candidates as (
    select p.id, p.display_name, extract(year from age(current_date, p.dob))::int as c_age, p.gender, p.region, p.bio
    from public.profiles p
    where p.is_active = true
      and p.onboarding_completed = true
      and p.is_banned = false
      and p.id not in (select member_profile_id from party_member_ids)
      and not exists (
        select 1 from public.party_swipes ps
        where ps.party_id = p_party_id and ps.member_id = v_me and ps.target_id = p.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = p.id and b.blocked_id in (select member_profile_id from party_member_ids))
           or (b.blocked_id = p.id and b.blocker_id in (select member_profile_id from party_member_ids))
      )
      and extract(year from age(current_date, p.dob))::int between 18 and 99
  ),
  shared_games as (
    select c.id as candidate_id, count(*)::int as shared_count
    from candidates c
    join public.profile_games theirs on theirs.profile_id = c.id
    join public.profile_games mine on mine.game_id = theirs.game_id
      and mine.profile_id in (select member_profile_id from party_member_ids)
    group by c.id
  ),
  shared_shows as (
    select c.id as candidate_id, count(*)::int as shared_count
    from candidates c
    join public.profile_shows theirs on theirs.profile_id = c.id
    join public.profile_shows mine on mine.show_id = theirs.show_id
      and mine.profile_id in (select member_profile_id from party_member_ids)
    group by c.id
  )
  select
    c.id, c.display_name, c.c_age, c.gender, c.region, c.bio,
    coalesce(sg.shared_count, 0), coalesce(ss.shared_count, 0),
    coalesce(sg.shared_count, 0)::numeric * 5 + coalesce(ss.shared_count, 0)::numeric
  from candidates c
  left join shared_games sg on sg.candidate_id = c.id
  left join shared_shows ss on ss.candidate_id = c.id
  order by coalesce(sg.shared_count, 0) desc
  limit p_limit;
end;
$$;

grant execute on function public.get_party_deck(uuid, int) to authenticated;
revoke execute on function public.get_party_deck(uuid, int) from public, anon;

-- ---------------------------------------------------------------------------
-- (c) 2/2 continued — block the write side too, not just the read/discovery side.
-- perform_party_swipe and send_party_message both insert into tables the (f) trigger
-- below also guards (party_swipes has no such trigger, so perform_party_swipe needs
-- its own check; party_messages does, so send_party_message doesn't need a duplicate
-- one — the trigger already covers it).
-- ---------------------------------------------------------------------------

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

create or replace function public.perform_party_swipe(p_party_id uuid, p_target_id uuid, p_action swipe_action_enum)
returns table (invited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_member_count int;
  v_like_count int;
  v_blocked boolean;
  v_cross_band boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if public.is_banned_user(v_me) then
    raise exception 'account_banned';
  end if;
  if not public.is_party_member(p_party_id, v_me) then
    raise exception 'Not a party member';
  end if;
  if v_me = p_target_id then
    raise exception 'Cannot swipe on yourself';
  end if;

  -- The target must be clear of *every* member, not just the caller: an invite drops
  -- the target into a chat with all of them.
  select exists (
    select 1 from public.party_members pm
    where pm.party_id = p_party_id
      and public.is_blocked_pair(pm.profile_id, p_target_id)
  ) into v_blocked;
  if v_blocked then
    raise exception 'Cannot swipe on a blocked user';
  end if;

  select exists (
    select 1 from public.party_members pm
    where pm.party_id = p_party_id
      and coalesce(public.same_age_band(pm.profile_id, p_target_id), false) = false
  ) into v_cross_band;
  if v_cross_band then
    raise exception 'Cannot interact across age groups';
  end if;

  insert into public.party_swipes (party_id, member_id, target_id, action)
  values (p_party_id, v_me, p_target_id, p_action)
  on conflict (party_id, member_id, target_id) do update set action = excluded.action, created_at = now();

  invited := false;

  if p_action = 'like' then
    select count(*) into v_member_count from public.party_members where party_id = p_party_id;
    select count(*) into v_like_count
    from public.party_swipes ps
    where ps.party_id = p_party_id and ps.target_id = p_target_id and ps.action = 'like'
      and ps.member_id in (select profile_id from public.party_members where party_id = p_party_id);

    if v_member_count > 0 and v_like_count >= v_member_count then
      insert into public.party_invites (party_id, target_id) values (p_party_id, p_target_id)
      on conflict (party_id, target_id) do nothing;
      invited := true;
    end if;
  end if;

  return next;
end;
$$;

grant execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) to authenticated;
revoke execute on function public.perform_party_swipe(uuid, uuid, swipe_action_enum) from public, anon;

-- ---------------------------------------------------------------------------
-- (c) 1/2 continued — reports.reported_id no longer cascades away. Changed to SET
-- NULL (needs the column to be nullable, so the plain NOT NULL constraint is dropped);
-- reported_profile_id is a non-FK copy taken at insert time that keeps its value
-- regardless of what later happens to the reported profile, so multiple historical
-- reports against the same (possibly long-deleted) person still correlate with each
-- other by that id. The insert-time trigger is what actually keeps reported_id
-- required on new rows now that the column-level NOT NULL is gone — it only runs
-- BEFORE INSERT, so it never fights the FK's own BEFORE-trigger-driven UPDATE that
-- nulls reported_id out when the reported profile is deleted.
-- ---------------------------------------------------------------------------

alter table public.reports drop constraint reports_reported_id_fkey;
alter table public.reports alter column reported_id drop not null;
alter table public.reports add constraint reports_reported_id_fkey
  foreign key (reported_id) references public.profiles (id) on delete set null;

alter table public.reports add column reported_profile_id uuid;
update public.reports set reported_profile_id = reported_id where reported_profile_id is null;
alter table public.reports alter column reported_profile_id set not null;

create index reports_reported_profile_id_idx on public.reports (reported_profile_id);

create or replace function public.reports_require_reported_id_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reported_id is null then
    raise exception 'reported_id is required';
  end if;
  new.reported_profile_id := new.reported_id;
  return new;
end;
$$;

revoke execute on function public.reports_require_reported_id_on_insert() from public, anon, authenticated;

drop trigger if exists reports_require_reported_id_on_insert_trigger on public.reports;
create trigger reports_require_reported_id_on_insert_trigger
  before insert on public.reports
  for each row execute function public.reports_require_reported_id_on_insert();

-- ---------------------------------------------------------------------------
-- (f) MEDIUM — per-sender rate limit on both message tables, mirroring the shape of
-- the daily_swipe_counters quota (a check against a count, before the write) but
-- counting straight off the tables themselves rather than a separate bookkeeping
-- table, since a sliding 10-second/1-hour window doesn't fit a single-bucket-per-day
-- counter shape the way the swipe quota does. Also doubles as the (c) 2/2 enforcement
-- point for messages, which has no RPC of its own to put a public.is_banned_user()
-- check into (send-message is an Edge Function that inserts directly).
--
-- Limits are deliberately generous — 8 messages per 10 seconds, 300 per hour, well
-- above anything a real back-and-forth conversation produces — so this only ever
-- catches a scripted flood, never a fast typist. Both error strings are distinct from
-- each other and from 'account_banned' so the client can show the right message for
-- each case rather than a generic failure.
-- ---------------------------------------------------------------------------

create index if not exists messages_sender_id_created_at_idx on public.messages (sender_id, created_at);
create index if not exists party_messages_sender_id_created_at_idx on public.party_messages (sender_id, created_at);

create or replace function public.enforce_message_send_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_banned boolean;
  v_short_count int;
  v_hourly_count int;
begin
  select p.is_banned into v_is_banned from public.profiles p where p.id = new.sender_id;
  if coalesce(v_is_banned, false) then
    raise exception 'account_banned';
  end if;

  if tg_table_name = 'messages' then
    select count(*) into v_short_count from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '10 seconds';
    select count(*) into v_hourly_count from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 hour';
  else
    select count(*) into v_short_count from public.party_messages
      where sender_id = new.sender_id and created_at > now() - interval '10 seconds';
    select count(*) into v_hourly_count from public.party_messages
      where sender_id = new.sender_id and created_at > now() - interval '1 hour';
  end if;

  if v_short_count >= 8 then
    raise exception 'message_rate_limit_short';
  end if;
  if v_hourly_count >= 300 then
    raise exception 'message_rate_limit_hourly';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_message_send_guard() from public, anon, authenticated;

drop trigger if exists enforce_message_send_guard_trigger on public.messages;
create trigger enforce_message_send_guard_trigger
  before insert on public.messages
  for each row execute function public.enforce_message_send_guard();

drop trigger if exists enforce_message_send_guard_trigger on public.party_messages;
create trigger enforce_message_send_guard_trigger
  before insert on public.party_messages
  for each row execute function public.enforce_message_send_guard();
