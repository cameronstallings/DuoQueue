-- DuoQueue Phase 1 schema: full data model per the approved design.
-- RLS is enabled on every table with no default-permissive policy (deny-all until granted).

create extension if not exists pgcrypto;

grant usage on schema public to authenticated, anon;

-- =========================================================================
-- Enums
-- =========================================================================

create type gender_enum as enum ('male', 'female', 'non_binary', 'prefer_not_to_say');
create type region_enum as enum ('na_east', 'na_west', 'sa', 'eu', 'mena', 'africa', 'asia', 'sea', 'oce');
create type platform_enum as enum ('pc', 'playstation', 'xbox', 'switch', 'mobile');
create type skill_level_enum as enum ('casual', 'intermediate', 'competitive', 'ranked_grinder');
create type report_reason_enum as enum ('harassment', 'spam', 'inappropriate_content', 'underage', 'other');
create type report_status_enum as enum ('open', 'reviewed', 'actioned', 'dismissed');
create type swipe_action_enum as enum ('like', 'pass');
create type subscription_status_enum as enum ('active', 'trialing', 'expired', 'cancelled', 'refunded', 'grace_period');
create type subscription_store_enum as enum ('app_store', 'play_store');
create type moderation_status_enum as enum ('pending', 'approved', 'rejected');
create type show_category_enum as enum ('show', 'movie', 'anime');
create type playstyle_tag_enum as enum (
  'chill', 'competitive', 'mic_required', 'no_mic', 'late_night',
  'weekend_warrior', 'casual_coop', 'grinder', 'team_player', 'solo_queue'
);

-- =========================================================================
-- Helper trigger functions
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- profiles
-- =========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  dob date,
  gender gender_enum,
  region region_enum,
  timezone text,
  bio text,
  discord_username text,
  onboarding_completed boolean not null default false,
  is_active boolean not null default true,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_name_length check (display_name is null or char_length(display_name) between 2 and 30),
  constraint bio_length check (bio is null or char_length(bio) <= 300),
  constraint profile_must_be_18 check (dob is null or dob <= (current_date - interval '18 years')::date)
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

grant select, update on public.profiles to authenticated;

-- =========================================================================
-- profile_media
-- =========================================================================

create table public.profile_media (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  "position" smallint not null,
  moderation_status moderation_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  constraint position_range check ("position" between 0 and 5),
  constraint unique_profile_position unique (profile_id, "position")
);

create index profile_media_profile_id_idx on public.profile_media (profile_id);

alter table public.profile_media enable row level security;

create policy "profile_media_all_own" on public.profile_media
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.profile_media to authenticated;

-- =========================================================================
-- profile_platforms / profile_languages / profile_playstyles
-- =========================================================================

create table public.profile_platforms (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform platform_enum not null,
  primary key (profile_id, platform)
);

alter table public.profile_platforms enable row level security;

create policy "profile_platforms_all_own" on public.profile_platforms
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.profile_platforms to authenticated;

create table public.profile_languages (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  language_code text not null,
  primary key (profile_id, language_code)
);

alter table public.profile_languages enable row level security;

create policy "profile_languages_all_own" on public.profile_languages
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.profile_languages to authenticated;

create table public.profile_playstyles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag playstyle_tag_enum not null,
  primary key (profile_id, tag)
);

alter table public.profile_playstyles enable row level security;

create policy "profile_playstyles_all_own" on public.profile_playstyles
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.profile_playstyles to authenticated;

-- =========================================================================
-- games / profile_games
-- =========================================================================

create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  igdb_id bigint,
  is_custom boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index games_name_lower_idx on public.games (lower(name));

alter table public.games enable row level security;

create policy "games_select_all" on public.games
  for select using (true);

create policy "games_insert_custom" on public.games
  for insert with check (is_custom = true and created_by = auth.uid());

grant select, insert on public.games to authenticated;

create table public.profile_games (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  skill_level skill_level_enum not null,
  rank_text text,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint unique_profile_game unique (profile_id, game_id)
);

create index profile_games_profile_id_idx on public.profile_games (profile_id);
create index profile_games_game_id_idx on public.profile_games (game_id);

alter table public.profile_games enable row level security;

create policy "profile_games_all_own" on public.profile_games
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.profile_games to authenticated;

-- =========================================================================
-- shows / profile_shows
-- =========================================================================

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category show_category_enum,
  is_custom boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index shows_name_lower_idx on public.shows (lower(name));

alter table public.shows enable row level security;

create policy "shows_select_all" on public.shows
  for select using (true);

create policy "shows_insert_custom" on public.shows
  for insert with check (is_custom = true and created_by = auth.uid());

grant select, insert on public.shows to authenticated;

create table public.profile_shows (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  show_id uuid not null references public.shows (id) on delete cascade,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint unique_profile_show unique (profile_id, show_id)
);

create index profile_shows_profile_id_idx on public.profile_shows (profile_id);

alter table public.profile_shows enable row level security;

create policy "profile_shows_all_own" on public.profile_shows
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.profile_shows to authenticated;

-- =========================================================================
-- preferences (matching filters)
-- =========================================================================

create table public.preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  min_age smallint not null default 18,
  max_age smallint not null default 99,
  preferred_genders gender_enum[],
  preferred_regions region_enum[],
  required_language text,
  filter_game_id uuid references public.games (id) on delete set null,
  filter_platform platform_enum,
  filter_skill_level skill_level_enum,
  filter_playstyle playstyle_tag_enum,
  updated_at timestamptz not null default now(),
  constraint age_range_valid check (min_age >= 18 and max_age >= min_age)
);

create trigger set_preferences_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

alter table public.preferences enable row level security;

create policy "preferences_all_own" on public.preferences
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.preferences to authenticated;

-- =========================================================================
-- swipes / daily_swipe_counters (server-enforced writes only)
-- =========================================================================

create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action swipe_action_enum not null,
  created_at timestamptz not null default now(),
  constraint swipe_not_self check (swiper_id <> target_id),
  constraint unique_swipe_pair unique (swiper_id, target_id)
);

create index swipes_swiper_id_idx on public.swipes (swiper_id);
create index swipes_target_id_idx on public.swipes (target_id);

alter table public.swipes enable row level security;

create policy "swipes_select_own" on public.swipes
  for select using (auth.uid() = swiper_id);

-- No insert/update/delete policy or grant for `authenticated`: writes happen only
-- through the (future) perform_swipe() SECURITY DEFINER RPC, which runs as the
-- function owner and therefore bypasses this restriction intentionally.
grant select on public.swipes to authenticated;

create table public.daily_swipe_counters (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  swipe_count integer not null default 0,
  primary key (profile_id, day)
);

alter table public.daily_swipe_counters enable row level security;
-- Intentionally no policies/grants for `authenticated` — this table is internal
-- bookkeeping for the swipe-quota RPC (accessed via SECURITY DEFINER / service role only).

-- =========================================================================
-- matches
-- =========================================================================

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  matched_at timestamptz not null default now(),
  unmatched_at timestamptz,
  unmatched_by uuid references public.profiles (id) on delete set null,
  constraint match_not_self check (user_a_id <> user_b_id),
  constraint match_canonical_order check (user_a_id < user_b_id),
  constraint unique_match_pair unique (user_a_id, user_b_id)
);

create index matches_user_a_id_idx on public.matches (user_a_id);
create index matches_user_b_id_idx on public.matches (user_b_id);

alter table public.matches enable row level security;

create policy "matches_select_participant" on public.matches
  for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- No insert/update grant: created by perform_swipe() RPC, unmatched via a future
-- unmatch() RPC — both SECURITY DEFINER, bypassing the lack of a client grant here.
grant select on public.matches to authenticated;

create or replace function public.handle_match_unmatched()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unmatched_at is not null and old.unmatched_at is null then
    update public.discord_shares
    set revoked = true
    where match_id = new.id and revoked = false;
  end if;
  return new;
end;
$$;

-- =========================================================================
-- messages
-- =========================================================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  is_flagged boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_match_id_created_at_idx on public.messages (match_id, created_at);

alter table public.messages enable row level security;

create policy "messages_select_participant" on public.messages
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and (auth.uid() = m.user_a_id or auth.uid() = m.user_b_id)
    )
  );

-- No insert grant for `authenticated`: all sends go through the send-message Edge
-- Function (profanity/abuse filter + active-conversation cap) using the service role,
-- which also enforces `matches.unmatched_at is null` before inserting.
grant select on public.messages to authenticated;

-- =========================================================================
-- discord_shares
-- =========================================================================

create table public.discord_shares (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  shared_by uuid not null references public.profiles (id) on delete cascade,
  revoked boolean not null default false,
  shared_at timestamptz not null default now(),
  constraint unique_share_per_match_direction unique (match_id, shared_by)
);

create trigger on_match_unmatched
  after update on public.matches
  for each row execute function public.handle_match_unmatched();

alter table public.discord_shares enable row level security;

create policy "discord_shares_select_participant" on public.discord_shares
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = discord_shares.match_id
        and (auth.uid() = m.user_a_id or auth.uid() = m.user_b_id)
    )
  );

create policy "discord_shares_insert_own" on public.discord_shares
  for insert with check (
    shared_by = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = discord_shares.match_id
        and m.unmatched_at is null
        and (auth.uid() = m.user_a_id or auth.uid() = m.user_b_id)
    )
  );

grant select, insert on public.discord_shares to authenticated;

-- =========================================================================
-- reports / blocks
-- =========================================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason report_reason_enum not null,
  details text,
  match_id uuid references public.matches (id) on delete set null,
  status report_status_enum not null default 'open',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_not_self check (reporter_id <> reported_id)
);

create index reports_reported_id_idx on public.reports (reported_id);
create index reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter_id);

create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter_id);

grant select, insert on public.reports to authenticated;

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint block_not_self check (blocker_id <> blocked_id),
  constraint unique_block_pair unique (blocker_id, blocked_id)
);

create index blocks_blocker_id_idx on public.blocks (blocker_id);
create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy "blocks_select_own" on public.blocks
  for select using (auth.uid() = blocker_id);

create policy "blocks_insert_own" on public.blocks
  for insert with check (auth.uid() = blocker_id);

grant select, insert on public.blocks to authenticated;

-- Blocking someone immediately ends any active match between the pair, which in turn
-- (via on_match_unmatched above) revokes any shared Discord card — satisfies "blocked
-- users can never appear in each other's chats".
create or replace function public.handle_new_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.matches
  set unmatched_at = now(), unmatched_by = new.blocker_id
  where unmatched_at is null
    and (
      (user_a_id = new.blocker_id and user_b_id = new.blocked_id)
      or (user_a_id = new.blocked_id and user_b_id = new.blocker_id)
    );
  return new;
end;
$$;

create trigger on_block_created
  after insert on public.blocks
  for each row execute function public.handle_new_block();

-- =========================================================================
-- subscriptions (RevenueCat-driven, Phase 4) / super_pings
-- =========================================================================

create table public.subscriptions (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  revenuecat_app_user_id text not null,
  product_id text not null,
  status subscription_status_enum not null,
  entitlement text not null default 'premium',
  current_period_end timestamptz,
  will_renew boolean not null default false,
  is_trial boolean not null default false,
  store subscription_store_enum not null,
  raw_event jsonb,
  updated_at timestamptz not null default now()
);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = profile_id);

-- No insert/update grant: written only by the revenuecat-webhook Edge Function
-- (service role), never directly by the client.
grant select on public.subscriptions to authenticated;

create table public.super_pings (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint super_ping_not_self check (sender_id <> receiver_id)
);

create index super_pings_sender_id_idx on public.super_pings (sender_id);
create index super_pings_receiver_id_idx on public.super_pings (receiver_id);

alter table public.super_pings enable row level security;

create policy "super_pings_select_involved" on public.super_pings
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- No insert grant: created only via the (future) send_super_ping() RPC, which checks
-- premium status and the 1/day cap before inserting.
grant select on public.super_pings to authenticated;

-- =========================================================================
-- push_tokens / notification_settings
-- =========================================================================

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  device_info jsonb,
  created_at timestamptz not null default now()
);

create index push_tokens_profile_id_idx on public.push_tokens (profile_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_all_own" on public.push_tokens
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.push_tokens to authenticated;

create table public.notification_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  new_match boolean not null default true,
  new_message boolean not null default true,
  super_ping boolean not null default true,
  daily_swipes_refreshed boolean not null default true
);

alter table public.notification_settings enable row level security;

create policy "notification_settings_all_own" on public.notification_settings
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

grant select, insert, update, delete on public.notification_settings to authenticated;

-- =========================================================================
-- Public, column-limited views for deck/match/chat rendering.
--
-- These views are created (and thus owned) by the migration-running role, which owns
-- the underlying tables and therefore bypasses their per-row RLS policies. Each view
-- deliberately re-implements its own row/column filter below (active profiles only,
-- approved media only, no private columns) so that "bypassing RLS" never means
-- "unfiltered" — this is the standard Supabase pattern for exposing a safe slice of an
-- otherwise locked-down table to other authenticated users.
-- =========================================================================

create view public.public_profiles as
select
  p.id,
  p.display_name,
  extract(year from age(current_date, p.dob))::int as age,
  p.gender,
  p.region,
  p.bio,
  p.created_at
from public.profiles p
where p.is_active = true and p.onboarding_completed = true;

grant select on public.public_profiles to authenticated;

create view public.public_profile_media as
select pm.id, pm.profile_id, pm.storage_path, pm."position"
from public.profile_media pm
join public.profiles p on p.id = pm.profile_id
where pm.moderation_status = 'approved' and p.is_active = true;

grant select on public.public_profile_media to authenticated;

create view public.public_profile_games as
select pg.profile_id, pg.game_id, g.name as game_name, pg.skill_level, pg.rank_text, pg.priority
from public.profile_games pg
join public.games g on g.id = pg.game_id
join public.profiles p on p.id = pg.profile_id
where p.is_active = true;

grant select on public.public_profile_games to authenticated;

create view public.public_profile_shows as
select ps.profile_id, ps.show_id, s.name as show_name, s.category, ps.priority
from public.profile_shows ps
join public.shows s on s.id = ps.show_id
join public.profiles p on p.id = ps.profile_id
where p.is_active = true;

grant select on public.public_profile_shows to authenticated;

create view public.public_profile_platforms as
select pp.profile_id, pp.platform
from public.profile_platforms pp
join public.profiles p on p.id = pp.profile_id
where p.is_active = true;

grant select on public.public_profile_platforms to authenticated;

create view public.public_profile_languages as
select pl.profile_id, pl.language_code
from public.profile_languages pl
join public.profiles p on p.id = pl.profile_id
where p.is_active = true;

grant select on public.public_profile_languages to authenticated;

create view public.public_profile_playstyles as
select pps.profile_id, pps.tag
from public.profile_playstyles pps
join public.profiles p on p.id = pps.profile_id
where p.is_active = true;

grant select on public.public_profile_playstyles to authenticated;

-- =========================================================================
-- New user bootstrap: minimal profile + default preferences/notification rows.
-- The onboarding wizard fills in the rest via UPDATE, then sets onboarding_completed.
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');

  insert into public.preferences (profile_id) values (new.id);
  insert into public.notification_settings (profile_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
