-- Track 3 (input sanitization / payload limits) — database-layer half. The DB is the
-- real boundary here (PostgREST lets a client write these tables directly, or close to
-- it, in several cases below), so this closes the columns that had no CHECK constraint
-- at all, and adds a control-character/blank guard to the columns that had a length
-- bound but nothing stopping control characters or an all-whitespace value from getting
-- through. Existing rows were queried for violations before writing this (see the audit
-- notes at the bottom) — the project has exactly 2 real profiles right now, and none of
-- the checked columns had a violation, so every constraint below is added already
-- VALIDATED rather than NOT VALID.
--
-- Columns intentionally left alone:
--   * "party name" (mentioned in the task brief) — public.parties has no name/label
--     column at all (0026_parties.sql); nothing to constrain.
--   * linked_accounts.display_name/rank_tier/avatar_url and verified_stats.stat_value —
--     not client-writable (no RLS INSERT/UPDATE policy; only link-steam-callback and
--     sync-verified-stats write them, via the service role). They're covered anyway,
--     below, as defense-in-depth against a misbehaving upstream provider — modest, will
--     never bind on real data.
--   * profiles.timezone — already gated by is_valid_timezone() (0031), which is a
--     stricter check than a regex would be.
--   * RPC arguments (get_deck & friends' p_limit, reorder_gallery_photo's
--     p_new_position, etc.) — audited against the live function bodies. uuid/enum
--     parameters are type-checked by Postgres before the function body ever runs, and
--     every numeric parameter that accepts unbounded client input already clamps
--     server-side (0042_audit_hardening.sql section (b), reorder_gallery_photo's
--     explicit range check). Nothing there was left trusting raw input unvalidated.

-- ---------------------------------------------------------------------------
-- Shared predicate: true when `t` contains a control character a normal text field has
-- no business carrying — a terminal escape sequence, a null byte smuggled in some other
-- way, a form-feed, etc. `allow_newlines` toggles whether tab/LF/CR count as
-- "disallowed": single-line fields (display name, a hidden word, a rank string) reject
-- them outright, multi-line fields (bio, chat messages, report details) let them
-- through since that's legitimate content there.
-- ---------------------------------------------------------------------------
create or replace function public.has_disallowed_control_chars(t text, allow_newlines boolean default false)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when t is null then false
    when allow_newlines then t ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'
    else t ~ '[\x01-\x1F\x7F]'
  end;
$$;

comment on function public.has_disallowed_control_chars(text, boolean) is
  'Used by CHECK constraints across this migration. Deliberately excludes \x00 from the '
  'ranges tested — Postgres text columns cannot physically store a null byte, the server '
  'rejects the write with "invalid byte sequence" before a CHECK ever runs, so testing '
  'for it here would be dead code.';

-- ---------------------------------------------------------------------------
-- profiles: display_name (had a length bound, nothing stopping "  " or a control char),
-- bio (had a length bound only), discord_username (had NO constraint at all — the
-- client's zod schema, packages/shared-types/src/profile.ts, is the only thing that
-- currently stops a malformed one, and that's bypassable by any direct PostgREST call),
-- ban_reason (admin-set via set_profile_ban, but still worth guarding).
-- ---------------------------------------------------------------------------

alter table public.profiles
  add constraint display_name_not_blank check (display_name is null or char_length(btrim(display_name)) > 0);

alter table public.profiles
  add constraint display_name_no_control_chars
  check (display_name is null or not public.has_disallowed_control_chars(display_name, false));

alter table public.profiles
  add constraint bio_no_control_chars
  check (bio is null or not public.has_disallowed_control_chars(bio, true));

-- Mirrors packages/shared-types/src/profile.ts's discordUsernameSchema exactly
-- (`.trim().max(32).regex(/^[a-z0-9._]{2,32}$/i)`) — same bounds, same character class.
-- The regex is itself an allow-list (alnum, '.', '_' only), so it already excludes every
-- control character; no separate has_disallowed_control_chars check is needed here.
alter table public.profiles
  add constraint discord_username_format
  check (discord_username is null or discord_username ~ '^[A-Za-z0-9._]{2,32}$');

alter table public.profiles
  add constraint ban_reason_no_control_chars
  check (ban_reason is null or not public.has_disallowed_control_chars(ban_reason, true));

-- ---------------------------------------------------------------------------
-- profile_prompts.answer: had a length bound (1-150, trimmed) but no control-char
-- guard. The edit UI is multiline (apps/mobile/app/edit-prompts.tsx), so newlines stay
-- allowed.
-- ---------------------------------------------------------------------------
alter table public.profile_prompts
  add constraint prompt_answer_no_control_chars
  check (not public.has_disallowed_control_chars(answer, true));

-- ---------------------------------------------------------------------------
-- hidden_words.word: had a non-blank guard but NO max length and no control-char guard.
-- Single-line input (apps/mobile/app/hidden-words.tsx has no multiline prop) — newlines
-- disallowed. 50 chars is generous for "a word or phrase" per that screen's own label.
-- ---------------------------------------------------------------------------
alter table public.hidden_words
  add constraint hidden_word_max_length check (char_length(btrim(word)) <= 50);

alter table public.hidden_words
  add constraint hidden_word_no_control_chars check (not public.has_disallowed_control_chars(word, false));

-- ---------------------------------------------------------------------------
-- reports.details: had NO constraint at all. apps/mobile/src/components/ReportModal.tsx
-- sends this straight from an uncapped multiline TextInput — a client could currently
-- submit a multi-megabyte "details" string. 1000 chars comfortably covers a real report
-- while capping the abuse case; multiline allowed (it's a free-text explanation box).
-- ---------------------------------------------------------------------------
alter table public.reports
  add constraint report_details_length check (details is null or char_length(details) <= 1000);

alter table public.reports
  add constraint report_details_no_control_chars
  check (details is null or not public.has_disallowed_control_chars(details, true));

-- ---------------------------------------------------------------------------
-- messages.content / party_messages.content: both already have a 1-2000 length CHECK
-- (0004_chat.sql, 0026_parties.sql) but nothing stopping control characters. Chat is
-- multiline by nature.
-- ---------------------------------------------------------------------------
alter table public.messages
  add constraint messages_content_no_control_chars
  check (not public.has_disallowed_control_chars(content, true));

alter table public.party_messages
  add constraint party_messages_content_no_control_chars
  check (not public.has_disallowed_control_chars(content, true));

-- ---------------------------------------------------------------------------
-- profile_games.rank_text: had NO constraint at all, despite being a free-typed field
-- ("e.g. Diamond II") writable directly by the client (profile_games_insert_own /
-- profile_games_update_own RLS policies, no RPC in between). 40 chars mirrors
-- packages/shared-types/src/profile.ts's profileGameInputSchema.rankText bound exactly.
-- Single-line input (apps/mobile/app/edit-details.tsx's rank TextField has no multiline
-- prop) — newlines disallowed.
-- ---------------------------------------------------------------------------
alter table public.profile_games
  add constraint rank_text_length check (rank_text is null or char_length(btrim(rank_text)) <= 40);

alter table public.profile_games
  add constraint rank_text_no_control_chars
  check (rank_text is null or not public.has_disallowed_control_chars(rank_text, false));

-- ---------------------------------------------------------------------------
-- games.name / shows.name: already length-bounded 1-80 (0001/0010 init), but a
-- self-scoped custom entry (games_insert_custom / shows_insert_custom, is_custom=true)
-- had no control-char guard, and a custom game/show name is visible to every other user
-- who shares it via profile_games/profile_shows.
-- ---------------------------------------------------------------------------
alter table public.games
  add constraint games_name_no_control_chars check (not public.has_disallowed_control_chars(name, false));

alter table public.shows
  add constraint shows_name_no_control_chars check (not public.has_disallowed_control_chars(name, false));

-- ---------------------------------------------------------------------------
-- Defense-in-depth on the externally-sourced columns noted at the top: not directly
-- client-writable today, but nothing stops a future code path (or a Steam/Riot response
-- shape change) from writing something unbounded. Generous enough to never bind on real
-- data (verified_stats currently holds values like "0.7h" or "Gold II (30 LP)"; Steam
-- personas are capped well under 100 chars by Steam itself).
-- ---------------------------------------------------------------------------
alter table public.linked_accounts
  add constraint linked_accounts_display_name_length check (char_length(display_name) <= 100);

alter table public.linked_accounts
  add constraint linked_accounts_rank_tier_length check (rank_tier is null or char_length(rank_tier) <= 50);

alter table public.linked_accounts
  add constraint linked_accounts_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 500);

alter table public.verified_stats
  add constraint verified_stats_stat_value_length check (char_length(stat_value) <= 200);

-- ---------------------------------------------------------------------------
-- Audit performed before writing the constraints above (all zero rows / clean):
--   select ... from profiles/hidden_words/reports/profile_games/profile_prompts/
--     messages/games/shows where <col> ~ '[\x01-\x1F\x7F]' (or the allow-newlines
--     variant) — zero matches across every table.
--   select id, discord_username from profiles where discord_username !~
--     '^[A-Za-z0-9._]{2,32}$' — zero matches.
--   hidden_words and reports were empty tables at migration time.
--   profile_games.rank_text longest existing value: 8 chars ("Unranked").
--   linked_accounts and verified_stats were empty tables at migration time.
-- ---------------------------------------------------------------------------
