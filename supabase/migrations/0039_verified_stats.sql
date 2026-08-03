-- Verified game STATS (rank, playtime) to sit alongside verified game ACCOUNTS
-- (0025_linked_accounts.sql). Linking a Steam/Riot account proves *who you are* on that
-- platform; this table proves *how you actually play* — pulled straight from the
-- platform's own API by the `sync-verified-stats` Edge Function (service role only, see
-- that function's header comment) rather than typed into `profile_games.rank_text` by
-- the profile owner. Verified beats self-reported wherever both exist; the client only
-- overrides the chip when a row is here.
--
-- Deliberately dormant: `sync-verified-stats` no-ops per provider whenever
-- STEAM_WEB_API_KEY / RIOT_API_KEY isn't set (same fail-closed-but-silent posture the
-- function's header explains), so this table stays empty and every existing profile
-- keeps rendering exactly as it does today until Cameron gets real keys AND runs the
-- sync. No feature flag needed — an empty table is already the dormant state.
--
-- game_id is nullable (not every verified fact is game-scoped — e.g. a future
-- account-level Steam stat) even though neither provider wired up below produces one
-- yet; both Steam playtime and Riot rank always set it in practice.
--
-- Known gap, accepted for now to keep this migration scoped to the stats plumbing:
-- unlinking a platform account (`useUnlinkAccount`, deletes from `linked_accounts`)
-- does not cascade-delete the matching `verified_stats` rows, since the two tables
-- aren't FK'd to each other. A stat written before an unlink goes stale rather than
-- disappearing immediately — it's overwritten on the next successful sync for that
-- provider, or manually cleaned up. Revisit if that staleness window ever matters more
-- than the extra join/trigger would cost.
create type verified_stat_kind_enum as enum ('rank', 'playtime_hours');

create table public.verified_stats (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider linked_account_provider_enum not null,
  game_id uuid references public.games (id) on delete cascade,
  stat_kind verified_stat_kind_enum not null,
  stat_value text not null,
  fetched_at timestamptz not null default now(),
  constraint unique_verified_stat unique (profile_id, provider, game_id, stat_kind)
);

create index verified_stats_profile_id_idx on public.verified_stats (profile_id);

alter table public.verified_stats enable row level security;

create policy "verified_stats_select_own" on public.verified_stats
  for select using (auth.uid() = profile_id);

-- No insert/update/delete grant, same posture as linked_accounts: only
-- sync-verified-stats (service role, after querying the real platform API) ever writes
-- a row here. Unlike linked_accounts there's no user-initiated unlink action for a
-- single stat, so authenticated doesn't even get delete.
grant select on public.verified_stats to authenticated;

-- Public read path, following the block-aware pattern 0035 applied to every other
-- public_profile_* view — filtered to active+onboarded profiles and excluding either
-- direction of a block, so a verified rank can't leak around the block list any more
-- than a self-reported one can. left join to games (not inner) so a future game_id-less
-- row still resolves, just with a null game_name.
create view public.public_verified_stats as
select vs.profile_id, vs.provider, vs.game_id, g.name as game_name, vs.stat_kind, vs.stat_value, vs.fetched_at
from public.verified_stats vs
left join public.games g on g.id = vs.game_id
join public.profiles p on p.id = vs.profile_id
where p.is_active = true
  and p.onboarding_completed = true
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

grant select on public.public_verified_stats to authenticated;

-- =========================================================================
-- games: external-id mapping for the two providers sync-verified-stats knows about.
-- =========================================================================

alter table public.games
  add column steam_app_id bigint,
  add column riot_queue text;

-- One catalog row per Steam AppID — otherwise two rows could both claim (say) 730 and
-- GetOwnedGames playtime would land ambiguously.
create unique index games_steam_app_id_idx on public.games (steam_app_id) where steam_app_id is not null;

-- Seed the launch mapping for titles already sitting in the live catalog (checked
-- 2026-08-02 — see supabase/seed/games.json for the full list). Matched by name, not id,
-- since ids are generated per-environment; a name that isn't present in a given
-- environment's catalog is simply a no-op update. Steam AppIDs are public, permanent
-- identifiers (steamdb.info) — Counter-Strike 2 inherited 730 from the original CS:GO.
update public.games set steam_app_id = 730 where lower(name) = lower('Counter-Strike 2');
update public.games set steam_app_id = 570 where lower(name) = lower('Dota 2');
update public.games set steam_app_id = 1172470 where lower(name) = lower('Apex Legends');
update public.games set steam_app_id = 578080 where lower(name) = lower('PUBG: Battlegrounds');
update public.games set steam_app_id = 252490 where lower(name) = lower('Rust');
update public.games set steam_app_id = 440 where lower(name) = lower('Team Fortress 2');
update public.games set steam_app_id = 550 where lower(name) = lower('Left 4 Dead 2');

-- League's ranked solo/duo queue — the one queue type that maps to the single rank a
-- profile chip has room to show. league-v4 also returns flex-queue and other entries;
-- sync-verified-stats filters to whichever entry's queueType matches this column.
update public.games set riot_queue = 'RANKED_SOLO_5x5' where lower(name) = lower('League of Legends');
