# League rank picker and Solo/Duo duo eligibility: design

- **Date:** 2026-09-23
- **Status:** design approved by Cameron (goal, not this text). Adversarially reviewed 2026-09-23; changes are listed in "Review notes" at the end. Build after the Sign in with Apple work (0067/0068) lands, because both touch `apps/mobile` and `supabase`.
- **Migration:** `supabase/migrations/0069_league_rank_duo.sql` (hosted DB is at 0066; 0067 and 0068 are written but unapplied and are being edited by another job).
- **Ships in:** the 1 Oct 2026 build. The migration is backward compatible and can be applied before that build is approved.

## 0. What ships, in one screen

1. League of Legends players pick their Ranked Solo/Duo rank from a fixed list (tier, then division, or Unranked) instead of typing it. Every other game keeps the free-text rank field.
2. The rank is stored as two nullable columns on the League row of `profile_games` (`lol_tier`, `lol_division`). A trigger keeps `rank_text` equal to the canonical label ("Gold II"), so every existing reader, including the build 10 client, keeps working, and a build 10 save of "plat 2" is parsed into a structured rank.
3. A pure, immutable SQL function `lol_solo_duo_eligible(...)` encodes Riot's published duo table and returns `true`, `false`, or `null` (unknown). There is no score, no MMR, no rank distance.
4. `get_deck` gains one trailing output column, `lol_duo_eligible`, and one ORDER BY key: live Power-Ups first (a paid promise), then eligible pairs, then today's score. The WHERE clause is untouched, so nobody is filtered out and the deck never empties because of this feature.
5. Deck cards show a small positive "Can duo with you" chip when, and only when, the server returned `true` for that pair.
6. The App Review account and three NA demo personas get League ranks so the reviewer sees the feature on the first cards.

---

## 1. Riot's rules

### 1.1 Sources, checked 2026-09-23

| Source | URL | Date on the source |
|---|---|---|
| Riot Support, "Ranked Tiers, Divisions, and Queues" (the duo table) | https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues | Page shows "May 7, 2026". Content re-read 2026-09-23. |
| Patch 26.15 notes (Master duo returns, GM/Challenger duo removed) | https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-15-notes/ | Published 2026-07-28, live 2026-07-29 |
| Riot Developer Policies, General (no alternative ranking systems; legal boilerplate; registration; free tier) | https://developer.riotgames.com/policies/general | Checked 2026-09-23 |

The one rule this whole design is built around, from the developer policy: "Products cannot create alternatives for official skill ranking systems such as the ranked ladder." The policy names MMR and ELO calculators as examples. Everything below uses only Riot's tiers and Riot's own duo table.

**Date caveat.** The Support page displays 7 May 2026, but its Master row (duo within 400 LP) matches Patch 26.15, which shipped on 29 July. Treat the page as current and the displayed date as unreliable. Re-check the page before each release that touches this code; the check is 2 minutes and the table lives in exactly two places (section 6.1 and section 4.4).

**Independent re-check (review, 2026-09-23).** The Support page was read again row by row by the reviewer and every row in 1.3 matches it, including "Diamond III to Master players with less than 200 LP" for Diamond I and "within 400 LP from each other" for Master. The Developer Policy's Game Integrity section was re-read too: "Prohibited alternatives include MMR or ELO calculators." Patch 26.15 (published 2026-07-28) was re-read for the apex rules. The checksum in 1.4 was recomputed from Riot's rows by a separate script, not from the lo/hi table below, and agrees.

### 1.2 Tiers and divisions (Riot's ladder, lowest to highest)

Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond each have divisions IV (lowest) to I (highest). Master, Grandmaster, Challenger have no divisions. "Unranked" is the client's state before placements; Riot's page does not list it as a tier.

### 1.3 The Solo/Duo duo table, restated as data

Each row is "a player of this rank may queue Solo/Duo with a partner in this range", as Riot's page states it.

| Player's rank | Partner range Riot allows |
|---|---|
| Iron | Iron to Silver |
| Bronze | Iron to Silver |
| Silver | Iron to Gold |
| Gold | Silver to Platinum |
| Platinum | Gold to Emerald |
| Emerald | Platinum to Diamond III |
| Diamond IV, III, II | Emerald II to Diamond II |
| Diamond I | Diamond III to Master (only Master players under 200 LP) |
| Master | Diamond I (only if the Master player is under 200 LP), or Master players within 400 LP of each other |
| Grandmaster | Duo not available |
| Challenger | Duo not available |

Other rules on the page and in the patch notes:

- **Hidden MMR.** From Emerald up to Diamond II you cannot duo with a player who has Master-tier MMR while being Diamond or lower. Patch 26.15 says GM, Challenger, and anyone with GM or Challenger MMR cannot duo. The Support page also still carries an older "Master+ MMR Restrictions" paragraph calling Master-or-higher MMR solo-only; it contradicts the Master row and the patch notes and reads as stale. DuoQueue cannot see MMR, so these rules are handled by wording (section 6.5), not by logic.
- **Unranked / placements.** The page says nothing about unranked or provisional players. DuoQueue therefore never claims eligibility for an Unranked player (result `null`).
- **Master and above.** Master pairs depend on LP. DuoQueue does not collect LP (section 10), so Master with Master and Master with Diamond I are `null`, never `true`. Every other Master pairing is `false`. GM and Challenger are `false` with everyone. The Support page also says Master players in contention for Grandmaster are solo-only; that needs LP too and is already covered because no Master pair is ever labeled.
- **Flex.** Flex has no rank restrictions for Diamond and below; to play Flex with Master or above you must be at least Emerald. Flex parties may be 1, 2, 3 or 5 (not 4). This feature labels Solo/Duo only. No Flex label (section 10).
- **Same server.** Not on the page, but a duo needs both accounts on the same League server. DuoQueue's `profiles.region` is not a League server. v1 only claims eligibility when both profiles are in `na_east` or `na_west` (both NA). Every other region pair returns `null`.

### 1.4 From Riot's table to an exact eligibility table

**Ordinal.** Iron IV = 0, Iron III = 1, Iron II = 2, Iron I = 3, Bronze IV = 4 ... Diamond IV = 24, Diamond III = 25, Diamond II = 26, Diamond I = 27, Master = 28, Grandmaster = 29, Challenger = 30. Formula for divisional tiers: `tier_index * 4 + (4 - division)` with `tier_index` Iron = 0 ... Diamond = 6 and `division` 1..4 meaning I..IV. Unranked or anything malformed has no ordinal (`null`). The ordinal is used only to index Riot's rows. It is never stored, shown, or compared as a skill number.

**Riot's rows as inclusive ordinal ranges** (for Iron IV..Diamond I; Master+ handled separately):

| Ordinal of player | lo | hi | Riot row |
|---|---|---|---|
| 0..7 (Iron, Bronze) | 0 | 11 | Iron to Silver |
| 8..11 (Silver) | 0 | 15 | Iron to Gold |
| 12..15 (Gold) | 8 | 19 | Silver to Platinum |
| 16..19 (Platinum) | 12 | 23 | Gold to Emerald |
| 20..23 (Emerald) | 16 | 25 | Platinum to Diamond III |
| 24..26 (Diamond IV..II) | 22 | 26 | Emerald II to Diamond II |
| 27 (Diamond I) | 25 | 27 | Diamond III to Diamond I (Master part handled below) |

**Decision rule** (both players' ordinals `a`, `b`):

1. Either ordinal is null (Unranked, no League row, no rank) -> `null`.
2. Either is Grandmaster or Challenger (>= 29) -> `false`.
3. Either is Master (28): if the other is Master or Diamond I (`least(a, b) >= 27`) -> `null` (depends on LP); otherwise `false`.
4. Otherwise: `a_ok = b in [lo(a), hi(a)]`, `b_ok = a in [lo(b), hi(b)]`.
   - both -> `true`
   - exactly one -> `null` (Riot's published table disagrees with itself for this pair; do not claim)
   - neither -> `false`

**Why both sides must agree.** A "Can duo with you" that the League client then refuses is the failure that matters; a missing label costs nothing. Riot's rows are not symmetric in three places, and requiring both rows to allow the pair is the conservative reading. The eight unordered pairs where the rows disagree, all returning `null`:

- Emerald IV x Diamond IV, Emerald IV x Diamond III, Emerald III x Diamond IV, Emerald III x Diamond III (Emerald's row allows; Diamond IV..II's row starts at Emerald II)
- Emerald II x Diamond II, Emerald I x Diamond II (Diamond II's row allows; Emerald's row stops at Diamond III)
- Diamond III x Diamond I, Diamond II x Diamond I (Diamond I's row allows; Diamond IV..II's row stops at Diamond II)

A consequence worth knowing: under this rule a Diamond I player is labeled eligible only with other Diamond I players.

**Resulting table** (`true` range per rank; everything else `false` unless listed as `null`):

| Rank | `true` with | `null` with (besides Unranked) |
|---|---|---|
| Iron IV..I, Bronze IV..I | Iron IV to Silver I (12 ranks) | none |
| Silver IV..I | Iron IV to Gold I (16) | none |
| Gold IV..I | Silver IV to Platinum I (12) | none |
| Platinum IV..I | Gold IV to Emerald I (12) | none |
| Emerald IV, III | Platinum IV to Emerald I (8) | Diamond IV, Diamond III |
| Emerald II, I | Platinum IV to Diamond III (10) | Diamond II |
| Diamond IV | Emerald II to Diamond II (5) | Emerald IV, Emerald III |
| Diamond III | Emerald II to Diamond II (5) | Emerald IV, Emerald III, Diamond I |
| Diamond II | Diamond IV to Diamond II (3) | Emerald II, Emerald I, Diamond I |
| Diamond I | Diamond I (1) | Diamond III, Diamond II, Master |
| Master | none | Diamond I, Master |
| Grandmaster, Challenger | none | none |
| Unranked | none | everyone |

**Checksum, used by both the SQL and TS tests.** Over the 32 choices (28 divisional ranks, Master, Grandmaster, Challenger, Unranked), the 1,024 ordered pairs split into **306 `true`, 636 `false`, 82 `null`**. The relation is symmetric (f(a,b) = f(b,a) for every pair). The 82 nulls are 63 involving Unranked, 3 Master/LP pairs, and 16 (8 unordered) table-disagreement pairs. These numbers were computed from the rule above on 2026-09-23 with a scratch script; if either implementation disagrees, one of them has drifted.

---

## 2. Code touchpoints (as of 2026-09-23)

Line numbers are for the current working tree. `onboarding-store.ts` and `0067` were being edited by another job while this was written, so their numbers are approximate; the symbol names are exact.

### 2.1 Database

| What | Where | Notes |
|---|---|---|
| `profile_games` table | `supabase/migrations/0001_init.sql:171-183` | `skill_level skill_level_enum not null`, `rank_text text`, `priority`, unique `(profile_id, game_id)` |
| `profile_games` grants | `0001_init.sql:190` | `grant select, insert, update, delete ... to authenticated` (table-wide; new columns are covered) |
| `profile_games` RLS | `0001_init.sql:185-188`, split per operation in `0029_split_for_all_policies.sql:13-60` | `profile_games_{select,insert,update,delete}_own`, all `profile_id = auth.uid()` |
| `rank_text` constraints | `0049_input_constraints.sql:133-145` | `rank_text_length` (<= 40 after btrim), `rank_text_no_control_chars` |
| `games` table, grants, policies | `0001_init.sql:150-169` | `grant select, insert on public.games to authenticated` (table-wide INSERT, so a client can write `riot_queue`; see 4.2) |
| League marker `games.riot_queue` | `0039_verified_stats.sql:77-100` | League row set to `RANKED_SOLO_5x5` by name. On a fresh local `db reset` this is a no-op because `supabase/seed/seed.sql:38` inserts League after migrations run, without `riot_queue` |
| `riot_queue` uniqueness | `0042_audit_hardening.sql:172-191` | `games_riot_queue_idx` unique where not null |
| Hosted League row | live DB, read 2026-09-23 | `29dd006a-6f06-45f9-a5b2-30fb91b3f71a`, `is_custom = false`, `riot_queue = 'RANKED_SOLO_5x5'` |
| `public_profile_games` view | last flat definition `0059_review_demo_visibility.sql:932-945` (earlier: 0001:618-625, 0031:551-602, 0035:65, 0053:925) | Exposes `profile_id, game_id, game_name, skill_level, rank_text, priority`; block-aware, demo-gated; grants re-asserted `0059:1095-1127` (authenticated SELECT only; anon none) |
| Age-gate wrap of the view | `0067_post_auth_age_gate.sql` section 6 (loop over 14 views, `viewer_age_verified()` at section 2) | Rewraps via `pg_get_viewdef`. Its "THE PRICE" note: a flat `create or replace view` later drops the guard. This design does NOT touch the view (4.1) |
| `get_deck(integer)` | latest `0060_remove_gender_filtering.sql:81-285` (order by at 279; grants 284-285). Earlier bodies 0003, 0007, 0013, 0014, 0020, 0042, 0048, 0053, 0059 | SECURITY DEFINER plpgsql; scores shared games; premium filters `filter_game_id`, `filter_skill_level` at 195-206 |
| Live `get_deck` state | hosted, read-only query 2026-09-23 (review) | `md5(prosrc)` = `de4158bd67faded3865df843b5ff2fd2`, identical to 0060's body on disk. ACL `{postgres=X, authenticated=X, service_role=X}`. No `pg_depend` rows reference it, and no other function body in `public` mentions `get_deck(`. Re-check all three before writing the file (4 preamble); this is a snapshot |
| Live `profile_games` / `games` state | hosted, same query | `profile_games` has no triggers today, so 0069's trigger is the only one. Both tables' ACL is `anon=arwdxtm, authenticated=arwdxtm` (table-wide INSERT/UPDATE/DELETE for both; RLS is what stops them). `games` columns: `id, name, igdb_id, is_custom, created_by, created_at, steam_app_id, riot_queue` |
| Deck predicate mirrors | `0062_deck_visibility_gates.sql:78-105` (`deck_gate_hard`), `120-174` (`deck_gate_preferences`, game/skill filters 157-162), `202-235` (`get_deck_pool_size`) | Must change with get_deck's WHERE clause. This design does not change the WHERE clause, so they stay as they are |
| `get_standouts(integer)` | `0059_review_demo_visibility.sql:555-647` | Daily snapshot ordered by shared games then random. Not changed (10.2) |
| `get_online_now(integer)` | `0060_remove_gender_filtering.sql:291-442` | Not changed (10.2) |
| `get_party_deck(uuid, integer)` | `0059_review_demo_visibility.sql:468-546` | Not changed |
| `get_profile_card(uuid)` | `0060_remove_gender_filtering.sql:523-560` | Not changed; returns no eligibility, so no label on the matched-profile route |
| New-player alerts | `0063_new_player_alerts.sql:251-342` (`get_new_player_alert_batch`, shared-game join 297-313); cron `0064` | Not changed (10.2). It does not call get_deck; it calls `deck_gate_*` |
| `is_minor` raising on a profile-less caller | `0067_post_auth_age_gate.sql` section 5 | get_deck must keep calling `is_minor` (0067's stated obligation). The rebuilt body keeps that line |
| Verified rank (dormant) | `0039_verified_stats.sql`; `supabase/functions/sync-verified-stats/index.ts:161-196` | Writes "Gold II" or "Master (250 LP)" into `verified_stats`. Not used for eligibility in v1 (10.3) |

### 2.2 Shared types (`packages/shared-types/src`)

| What | Where |
|---|---|
| `SKILL_LEVELS` | `enums.ts:30-31` |
| `VERIFIED_STAT_KINDS` comment about `rank_text` | `enums.ts:83-87` |
| `GameRow.riot_queue` | `database.ts:160-174` (field at 170) |
| `ProfileGameRow` (no lol fields yet) | `database.ts:176-184` |
| `PreferencesRow.filter_game_id`, `filter_skill_level` | `database.ts:209, 211` |
| `DeckCandidate` (get_deck row) | `matching.ts:4-14`; `PartyDeckCandidate = DeckCandidate` at 67 |
| `RANK_TEXT_MAX_LENGTH` | `profile.ts:10-11` |
| `profileGameInputSchema` | `profile.ts:118-124`, used at 141 and 154 |
| Barrel | `index.ts` |

### 2.3 Mobile

| What | Where | Today |
|---|---|---|
| Onboarding games step | `apps/mobile/app/(onboarding)/games.tsx:65-75` | Skill `ChipSelect` + `TextField` "Rank (optional)" for every game |
| Onboarding store | `apps/mobile/src/store/onboarding-store.ts`: `SelectedGame` (~9-14), `updateGameRank` (~61, ~142-143), `addGame` (~137), `submit` profile_games rows (~199-208), `toUserMessage` P0001 hint mapping (~80-92) | Delete-then-insert of `profile_games` with `rank_text: g.rankText \|\| null`. `toUserMessage` already shows a RAISE's `hint`, so `lol_rank_not_league` surfaces properly in onboarding |
| Edit save error | `apps/mobile/app/edit-details.tsx:~136` | `Alert.alert("Something went wrong", err.message)`: shows the machine token, not the hint. Route it through the same P0001 hint mapping as onboarding (6.3) |
| Edit details screen | `apps/mobile/app/edit-details.tsx`: `updateGameRank` 88-90, save mapping 124-127, add game 199-201, rank `TextField` 217-223 | Same free-text field |
| Edit load | `apps/mobile/src/features/profile/useEditableProfileDetails.ts`: `EditableGame` 6-11, select 43, map 94-99 | Reads `game_id, skill_level, rank_text, priority` from base table |
| Edit save | `apps/mobile/src/features/profile/useSaveProfileDetails.ts:8, 24-33, 48-55` | Delete-then-insert |
| Own profile read | `apps/mobile/src/features/profile/useOwnProfileDetails.ts:6-10, 23, 64-68` | Reads `rank_text` |
| Own profile display | `apps/mobile/app/(tabs)/profile.tsx:187-191` (mapping), `357-370` (chips) | Chip detail = verified ?? `rank_text` ?? skill |
| Catalog search / custom game insert | `apps/mobile/src/features/onboarding/useCatalogSearch.ts:34-39, 47-59` | Inserts `{ name, is_custom: true, created_by }` only |
| Deck fetch | `apps/mobile/src/features/swipe/useDeck.ts:25-31` | `rpc("get_deck", { p_limit: 20 })`, cast to `DeckCandidate[]` |
| Enrichment | `apps/mobile/src/features/swipe/enrichCandidates.ts`: `PublicProfileGameRow` 15-20, `public_profile_games` select `*` at 71, `topGames` 119-122 | Keeps only `name`, `skillLevel`; drops `rank_text` and `game_id` |
| Card types | `apps/mobile/src/features/swipe/types.ts`: `DeckCardGame` 3-6, `DeckCard` 20-36 | |
| Deck card chip | `apps/mobile/src/features/swipe/SwipeCard.tsx:351-355` | One chip: `topGames[0].name` + skill label. Stranger ranks are never shown today |
| Deck card overlap line | `SwipeCard.tsx:386-404` | "N games in common" console line; unchanged |
| Profile detail games | `apps/mobile/src/features/swipe/ProfileDetailContent.tsx:245-251` | Passes `rank: undefined`, so strangers never see a rank today |
| Games chips component | `apps/mobile/src/features/profile/sections/GamesSection.tsx:17-42` | Verified stat overrides |
| Standouts / online now / party | `useStandouts.ts:13`, `online-now/useOnlineNow.ts:18`, `party/usePartyDeck.ts:12` | No code change, but all three pass their rows through `enrichCandidates`, so after 6.4 they show the League rank chip too (never the eligibility label, since their rows carry no `lol_duo_eligible`) |
| Matched profile route | `apps/mobile/src/features/profile/useProfileCard.ts:51-65` | Builds a `DeckCandidate` without eligibility and calls `enrichCandidates`; shows the League rank, no label |
| Premium filters | `apps/mobile/app/filters.tsx:80, 97, 102-107, 141-143, 247-248`; defaults `src/features/swipe/EmptyDeck.tsx:21-32` | Game and skill filters. No change |
| Chip component | `apps/mobile/src/components/Chip.tsx` | Tones: default, volt, success, amber, danger, soft |
| ChipSelect | `apps/mobile/src/components/ChipSelect.tsx:7-30` | `options`, `selected[]`, `onToggle` |

### 2.4 Scripts, seeds, docs, tests

| What | Where |
|---|---|
| Review demo seed | `scripts/seed-review-demo.mjs`: deck-order notes 143-163, `REVIEWER` 166-202 (region 170, games 174-188), shared-count note "TWO PROPERTIES" 211-220 (the per-persona shared counts change), Dae 276-303 (region 280, League 286), Ophelia 614-639, Devon 642-667, `FILMING_STANDOUT_SLUGS` ~694, profile_games insert ~884-895 |
| Filming footage notes that name Dae | `marketing/video/src/data/clips.ts:41, 228`, `marketing/video/public/footage/README.md:253`, `marketing/store/out/frames/manifest.json:11` | Dae is the abstract card Cameron asked the edit to ignore. Eligible-first would make Dae the first card of every future `--filming` run of the review account (9.3). Read-only here: another job owns `marketing/` |
| Privacy policy | `docs/legal/privacy-policy.md:63` (Games bullet); published through `node scripts/build-site.mjs` and the gh-pages worktree | Today it says rank is collected. After this feature the League rank is shown to other users and used to order the deck, and the neighbouring bullets (region, languages, schedule) each name their ranking use, so this one must too (12). Another job is editing this file now |
| App Review measurement table | `docs/APP-STORE-SUBMISSION.md` section 1.5, the "deck of 13" row (~105) | The count should stay 13 (ordering only), but the table claims a measured date; re-measure and restate after the seed re-run |
| Fake profile generator (dev) | `scripts/generate-fake-profiles.ts:97` (random `rank_text` on any game) |
| Games seed | `supabase/seed/seed.sql:38` (League), `:563` `on conflict (lower(name)) do nothing`; generated by `scripts/build-seed-sql.ts` from `supabase/seed/games.json` |
| Migration runner | `scripts/db/apply-migration.ps1` (dry run by default), `scripts/db/run-sql.ps1` |
| DB skill conventions | `.claude/skills/db/SKILL.md` (temp table + `set local role authenticated` + jwt claims inside `begin; ... rollback;`) |
| App Review notes / demo account | `docs/APP-STORE-SUBMISSION.md` section 1.5 (line 61) and Part 4 (line 615) |
| Test runner | `apps/mobile/vitest.config.mts` includes `src/**/*.test.ts`, `../../supabase/functions/**/*.test.ts`, `../../packages/shared-types/src/**/*.test.ts` |
| Existing tests (unaffected) | `apps/mobile/src/features/swipe/deckQueue.test.ts`, `emptyDeckDecisions.test.ts`, `packages/shared-types/src/profile.test.ts`, `supabase/functions/_shared/new-player-alert.test.ts` |
| SQL tests | None in the repo today. This design adds the first file (8.1) |

### 2.5 Live data that shapes the backfill (read-only query, 2026-09-23)

- 19 profiles: 4 real onboarded, 15 demo.
- League rows with a rank: `Iron 1` (real, casual), `Iron 3` (real, ranked_grinder), `Diamond II` (demo, Dae). All three parse (section 4.4).
- Other games' `rank_text` values ("Plat 2", "Diamond", "Immortal 1", "Savage Cleared", "Master Rank", "Grand Champion", ...) are on non-League rows and are never touched.
- Demo regions: only Priya (the pre-built match, never in the deck), Chase, Devon (na_east), Wren, Ophelia (na_west) are NA. The review account is na_east and has no League row.

---

## 3. Data model

### 3.1 Options

**A. Two nullable columns on `profile_games`, meaningful only on the League row** (recommended)

```
lol_tier     text      null   -- 'unranked' | 'iron' ... 'challenger'
lol_division smallint  null   -- 1..4 meaning I..IV; null for unranked and Master+
```

**B. A separate table** `profile_lol_rank (profile_id pk, tier, division, updated_at)`.

### 3.2 Recommendation: A

- **It inherits every existing guard for free.** `profile_games` already has per-operation own-row RLS (0029), the rank_text constraints (0049), and a public read path that is block-aware, demo-gated and (after 0067) age-gated. A new table needs four new policies, a new grant set, and a 15th public view that would have to join 0067's view list and its `viewer_age_verified()` wrap. Every one of those has been gotten wrong at least once in this repo.
- **The rank lives and dies with "I play League".** Removing League removes the rank. With B, removing League from the games list leaves an orphan rank that still drives eligibility, unless a trigger on `profile_games` deletes it, and that trigger would fire on every save because both save paths delete and re-insert all games (`useSaveProfileDetails.ts:48-55`, `onboarding-store.ts` submit).
- **Old clients keep the rank intact.** With A, a build 10 save re-inserts the League row with its `rank_text`; the trigger (4.5) parses the canonical label back into the same tier and division. With B, a build 10 save could not update the rank at all, and a changed rank typed in build 10 would silently disagree with the stored one.
- **The cost of A** is that "only on the League row" cannot be a CHECK constraint (it needs `games`). A trigger enforces it and raises (4.5). That is one trigger, versus B's policies, view, grants and sync trigger.

### 3.3 Why text + CHECK and not a Postgres enum

Riot added Emerald in 2023. Adding an enum value mid-list is `alter type ... add value before`, which cannot be used in the transaction that adds it (the 0036/0037 split). A text column with a CHECK is changed by dropping and re-adding one constraint in one migration. The ordering an enum would give for free is not needed: the ordinal is computed by `lol_rank_ordinal` (4.4).

### 3.4 Why `rank_text` stays and is kept in sync

`rank_text` is what every existing reader shows (own profile, the view, build 10). The trigger overwrites it with the canonical label whenever a structured rank exists, so it is always one of 32 fixed strings on a structured League row, never free text. That is also what makes it safe to show a stranger's League rank (6.4).

### 3.5 Identifying the League row

Server: `public.lol_game_id()` returns `games.id` where `riot_queue = 'RANKED_SOLO_5x5' and is_custom = false`. It is unique by `games_riot_queue_idx` (0042). It is not matched by name.

Client: the same query through PostgREST (`games?riot_queue=eq.RANKED_SOLO_5x5&is_custom=eq.false&select=id`), memoized for the app session (6.2). If it returns nothing or errors, every League surface falls back to today's free-text behaviour.

---

## 4. Migration 0069 outline: `supabase/migrations/0069_league_rank_duo.sql`

House rules this file must follow (all from earlier migrations):

- Header comment explains why, quotes the source URL and the date checked, and names what was deliberately not changed.
- Every function this file creates or recreates revokes EXECUTE from `public, anon, authenticated` and grants back only what is needed. Supabase default privileges grant EXECUTE to anon, authenticated and service_role at creation; revoking PUBLIC does not remove a role's own grant (0013 -> 0041).
- `get_deck` is rebuilt from the LIVE definition, not only from 0060 on disk. Before writing the file, run (read-only) `select pg_get_functiondef('public.get_deck(integer)'::regprocedure)` through `scripts/db/run-sql.ps1` and diff it against `0060:81-282`. If they differ, build from the live body and say so in the header. This is the 0054 -> 0056 lesson.
- Dry run with `scripts/db/apply-migration.ps1` (no `-Commit`) together with the SQL test (8.1) before committing.
- First statement of the file: `set local lock_timeout = '5s';`. The runner wraps the file in `begin; ... commit;`, so `set local` holds for the whole migration. `alter table public.profile_games add column` takes an ACCESS EXCLUSIVE lock; without a timeout it queues behind any long read and every deck, profile and save request queues behind it. With the timeout the migration fails fast and is simply re-run. The dry run takes the same lock for its whole transaction (including the get_deck calls in 8.1 D), so run it at a quiet hour.
- No CHECK constraint may call one of the new helpers. A CHECK runs as the writing role (0057's note on `has_disallowed_control_chars`), and the helpers are revoked from `authenticated`, so such a CHECK would make every client save of a game fail. The two CHECKs in 4.3 are plain CASE/IN expressions for that reason.
- Do not rely on `raise notice` output: the Management API endpoint `run-sql.ps1` and `apply-migration.ps1` use returns result rows, and notices are not something either script prints. The census in 4.6 is a courtesy for the SQL editor; the check that counts is 8.1 item 16, run as a query.

Sections, in order:

### 4.1 Header: what is deliberately NOT touched

- `public_profile_games` and the other 13 public views: not recreated. `rank_text` already carries the label, and a flat rewrite would drop 0067's `viewer_age_verified()` wrap (0067 section 6, "THE PRICE"). The base-table columns are not exposed to other users at all.
- `get_deck`'s WHERE clause, and therefore `deck_gate_hard`, `deck_gate_preferences`, `get_deck_pool_size`, `get_new_player_alert_batch`: unchanged. 0062's rule ("IF YOU CHANGE get_deck's WHERE CLAUSE, CHANGE THESE TWO FUNCTIONS") is not triggered, and the header says so, so nobody "helpfully" edits them.
- `get_standouts`, `get_online_now`, `get_party_deck`, `get_profile_card`: unchanged.
- No dependency on 0067/0068. Apply in number order anyway.

### 4.2 The League catalog row, and who may write `riot_queue`

```sql
-- Make the League row exist and carry its marker in EVERY environment. On a fresh local
-- `supabase db reset`, 0039's name-matched UPDATE ran against an empty catalog and seed.sql
-- then inserted League without riot_queue, so the marker was missing locally. Upserting here
-- fixes that: seed.sql's `on conflict (lower(name)) do nothing` then leaves this row alone.
insert into public.games as g (name, is_custom, riot_queue)
values ('League of Legends', false, 'RANKED_SOLO_5x5')
on conflict ((lower(name))) do update
  set riot_queue = excluded.riot_queue
  where g.is_custom = false
    and g.riot_queue is distinct from excluded.riot_queue;   -- hosted: no write at all

do $$
begin
  if (select count(*) from public.games
      where riot_queue = 'RANKED_SOLO_5x5' and is_custom = false) <> 1 then
    raise exception '0069 refuses to run: expected exactly one non-custom games row with riot_queue RANKED_SOLO_5x5.';
  end if;
end;
$$;

-- games INSERT was table-wide (0001:169), so any signed-in user could insert a custom game
-- carrying riot_queue or steam_app_id. On hosted the unique index already blocks a second
-- RANKED_SOLO_5x5, but the League identity this feature keys on should not rest on "somebody
-- got there first". The only client insert (useCatalogSearch.ts:54) names exactly these three
-- columns, in build 10 as well as now.
revoke insert on public.games from anon, authenticated;
grant insert (name, is_custom, created_by) on public.games to authenticated;
```

Verify before and after with `information_schema.column_privileges` (the DB skill's query). Before, read live 2026-09-23: authenticated holds INSERT on all eight columns, `riot_queue`, `steam_app_id` and `igdb_id` included, and anon holds table-wide INSERT too (inert only because `games_insert_custom` needs `created_by = auth.uid()`). After: authenticated on exactly `name, is_custom, created_by`, anon none. `id` and `created_at` use defaults and need no insert privilege; PostgREST names only the payload's keys in its INSERT column list, so `createCustomCatalogEntry` (`insert({ name, is_custom, created_by }).select("id, name")`) keeps working, and its `.select()` rides on SELECT, which stays table-wide. Nothing else inserts into `games` from a client, an Edge Function or an invoker function (grepped 2026-09-23); scripts and `seed.sql` run as postgres or service_role. This hardening is separable from the feature: if it causes any doubt at dry-run time, drop these two lines and keep the rest.

### 4.3 Columns and constraints

```sql
alter table public.profile_games
  add column if not exists lol_tier text,
  add column if not exists lol_division smallint;

alter table public.profile_games drop constraint if exists lol_tier_valid;
alter table public.profile_games add constraint lol_tier_valid check (
  lol_tier is null or lol_tier in (
    'unranked', 'iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond',
    'master', 'grandmaster', 'challenger')
);

-- Written as a CASE so every branch is a definite true/false and a NULL can never satisfy it
-- by accident (the 0031 section 7 lesson).
alter table public.profile_games drop constraint if exists lol_division_matches_tier;
alter table public.profile_games add constraint lol_division_matches_tier check (
  case
    when lol_tier is null then lol_division is null
    when lol_tier in ('iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond')
      then lol_division is not null and lol_division between 1 and 4
    else lol_division is null
  end
);
```

No new index: get_deck reads the League row by `(profile_id, game_id)`, which `unique_profile_game` already indexes.

### 4.4 Pure helpers

All `language sql`, `immutable` (except `lol_game_id`, which is `stable`), `parallel safe`, `set search_path = public` (the advisor flags a mutable search_path; the lost inlining does not matter at this scale). None is SECURITY DEFINER. Each ends with `revoke execute ... from public, anon, authenticated;`. Their only callers are SECURITY DEFINER code owned by postgres (get_deck, the trigger), which calls them as the owner. The client never calls them; it has the TypeScript mirror (6.1).

**Division parameters are `integer`, not `smallint`.** The column stays `smallint`, and a `smallint` argument widens to `integer` implicitly. The reverse does not: a bare literal such as `2` is typed `integer`, and `integer -> smallint` is only an assignment cast, so `lol_rank_label('gold', 2)` against a `smallint` parameter fails with "function does not exist". Every test in 8.1 and the checksum's `values` list would have hit that.

```sql
create or replace function public.lol_rank_ordinal(p_tier text, p_division integer)
returns integer language sql immutable parallel safe set search_path = public as $fn$
  select case
    when p_tier in ('iron','bronze','silver','gold','platinum','emerald','diamond')
         and p_division between 1 and 4
      then (array_position(array['iron','bronze','silver','gold','platinum','emerald','diamond'], p_tier) - 1) * 4
           + (4 - p_division)
    when p_tier = 'master'      and p_division is null then 28
    when p_tier = 'grandmaster' and p_division is null then 29
    when p_tier = 'challenger'  and p_division is null then 30
  end;   -- 'unranked', null, or malformed -> null
$fn$;

create or replace function public.lol_rank_label(p_tier text, p_division integer)
returns text language sql immutable parallel safe set search_path = public as $fn$
  select case
    when p_tier = 'unranked' and p_division is null then 'Unranked'
    when public.lol_rank_ordinal(p_tier, p_division) is null then null
    when p_division is null then initcap(p_tier)                       -- Master, Grandmaster, Challenger
    else initcap(p_tier) || ' ' || (array['I','II','III','IV'])[p_division]
  end;
$fn$;
```

`lol_parse_rank_text(p_text text, out tier text, out division smallint)`: one regex, identical in SQL and TS. (Its OUT `division` stays `smallint` because the trigger selects it INTO the `smallint` column; comparing it to an integer literal in a test works, since comparison operators exist across the two types.) The pattern is anchored at both ends, so every accepted string has exactly one parse, which is why Postgres's leftmost-longest matching and JavaScript's backtracking give the same groups.

- Normalize: `lower(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')))`.
- Match: `^(iron|bronze|silver|gold|plat|platinum|emerald|diamond|master|masters|grandmaster|grand master|gm|challenger|unranked) ?(iv|iii|ii|i|4|3|2|1)?$`
- Map aliases: plat -> platinum, masters -> master, grand master and gm -> grandmaster. Map division: i/1 -> 1, ii/2 -> 2, iii/3 -> 3, iv/4 -> 4.
- Accept only: a divisional tier WITH a division; Master/Grandmaster/Challenger with no division or with I/1 (Riot's API reports apex ranks as "I"), stored with division null; `unranked` with no division.
- Anything else returns (null, null): "Diamond" (no division), "Gold V", "Immortal 1", "Master 400 LP", empty, null. A partial parse is no parse; the text is kept and the user is asked to pick (6.3).
- It must always return exactly one row, (null, null) included, because the trigger selects INTO from it. Build it as `select <tier expr>, <division expr> from (select 1) one left join <parsed> t on true`.

```sql
create or replace function public.lol_solo_duo_eligible(
  p_a_tier text, p_a_division integer, p_b_tier text, p_b_division integer)
returns boolean language sql immutable parallel safe set search_path = public as $fn$
  with o as (
    select public.lol_rank_ordinal(p_a_tier, p_a_division) as a,
           public.lol_rank_ordinal(p_b_tier, p_b_division) as b
  ), r as (
    -- Riot's row for each player as an inclusive ordinal range over Iron IV (0)..Diamond I (27).
    -- Source and date: see this file's header. Master+ is decided before these are read.
    select a, b,
      case when a <= 11 then 0 when a <= 15 then 8 when a <= 19 then 12
           when a <= 23 then 16 when a <= 26 then 22 else 25 end as a_lo,
      case when a <= 7 then 11 when a <= 11 then 15 when a <= 15 then 19
           when a <= 19 then 23 when a <= 23 then 25 when a <= 26 then 26 else 27 end as a_hi,
      case when b <= 11 then 0 when b <= 15 then 8 when b <= 19 then 12
           when b <= 23 then 16 when b <= 26 then 22 else 25 end as b_lo,
      case when b <= 7 then 11 when b <= 11 then 15 when b <= 15 then 19
           when b <= 19 then 23 when b <= 23 then 25 when b <= 26 then 26 else 27 end as b_hi
    from o
  )
  select case
    when a is null or b is null then null                    -- Unranked or not given
    when a >= 29 or b >= 29 then false                       -- Grandmaster / Challenger: no duo
    when a = 28 or b = 28 then
      case when least(a, b) >= 27 then null else false end   -- Master: depends on LP we do not collect
    when b between a_lo and a_hi and a between b_lo and b_hi then true
    when b between a_lo and a_hi or  a between b_lo and b_hi then null  -- Riot's rows disagree
    else false
  end
  from r;
$fn$;

create or replace function public.lol_game_id()
returns uuid language sql stable parallel safe set search_path = public as $fn$
  select g.id from public.games g
  where g.riot_queue = 'RANKED_SOLO_5x5' and g.is_custom = false;
$fn$;
```

Add `comment on function` for each, naming the source URL and 2026-09-23.

### 4.5 The sync trigger

```sql
create or replace function public.sync_profile_game_lol_rank()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- Not the League row: a structured rank is an error, and rank_text is left exactly as typed.
  if new.game_id is distinct from public.lol_game_id() then
    if new.lol_tier is not null or new.lol_division is not null then
      raise exception 'lol_rank_not_league'
        using hint = 'A League of Legends rank can only be set on the League of Legends game.';
    end if;
    return new;
  end if;

  -- A text-only UPDATE (a direct PATCH naming rank_text alone): the text is the newer
  -- statement, so the structured rank is re-derived from it rather than overwriting it.
  -- (Both shipped save paths delete and re-insert, so they arrive as INSERTs, below.)
  if tg_op = 'UPDATE'
     and new.rank_text is distinct from old.rank_text
     and new.lol_tier is not distinct from old.lol_tier
     and new.lol_division is not distinct from old.lol_division then
    new.lol_tier := null;
    new.lol_division := null;
  end if;

  -- No structured rank given: try the text. This is the path build 10 takes on every save,
  -- and the path the backfill below takes.
  if new.lol_tier is null and new.rank_text is not null then
    select p.tier, p.division into new.lol_tier, new.lol_division
    from public.lol_parse_rank_text(new.rank_text) p;
  end if;

  -- Structured rank wins: rank_text becomes the canonical label, for every old reader.
  -- An invalid tier/division pair yields a null label here and then fails
  -- lol_division_matches_tier, loudly, with 23514.
  if new.lol_tier is not null then
    new.rank_text := public.lol_rank_label(new.lol_tier, new.lol_division);
  end if;

  return new;
end;
$fn$;

drop trigger if exists profile_games_lol_rank_sync on public.profile_games;
create trigger profile_games_lol_rank_sync
  before insert or update on public.profile_games
  for each row execute function public.sync_profile_game_lol_rank();

-- EXECUTE is checked at CREATE TRIGGER time, not at fire time (0063's note), so this stops
-- direct calls without stopping the trigger.
revoke execute on function public.sync_profile_game_lol_rank() from public, anon, authenticated;
```

SECURITY DEFINER is what lets the trigger call the helpers after they are revoked from `authenticated` (a client insert fires it as `authenticated`). It reads `games` and nothing else, and only rewrites the row being written.

Error surfacing: the client never sends a tier on a non-League row (6.3), so `lol_rank_not_league` means a client bug. Onboarding's `toUserMessage` already shows a P0001's hint; Edit details does not yet, and 6.3 fixes that.

### 4.6 Backfill (see section 7)

```sql
do $$
declare
  v_league uuid := public.lol_game_id();
  v_structured int;
  v_text_only int;
begin
  -- A no-op write routes every existing League rank through the same trigger live writes use.
  update public.profile_games
     set rank_text = rank_text
   where game_id = v_league and lol_tier is null and rank_text is not null;

  select count(*) filter (where lol_tier is not null),
         count(*) filter (where lol_tier is null and rank_text is not null)
    into v_structured, v_text_only
    from public.profile_games where game_id = v_league;

  raise notice '0069: League rows with a structured rank: %. League rows left as free text: %.',
    v_structured, v_text_only;
end;
$$;
```

Expected on hosted today: 3 structured, 0 free text.

### 4.7 `get_deck`: drop and recreate with one extra column

Adding an output column changes the return type, which `create or replace` cannot do. So:

```sql
drop function if exists public.get_deck(integer);
create function public.get_deck(p_limit integer default 20)
 returns table(profile_id uuid, display_name text, age integer, gender gender_enum,
               region region_enum, bio text, shared_games_count integer,
               shared_shows_count integer, score numeric,
               lol_duo_eligible boolean)          -- NEW, appended last
 language plpgsql security definer set search_path to 'public'
as $function$ ... $function$;

revoke execute on function public.get_deck(integer) from public, anon, authenticated;
grant execute on function public.get_deck(integer) to authenticated, service_role;
comment on function public.get_deck(integer) is '... 0069: eligible Solo/Duo pairs ordered first, never filtered ...';
notify pgrst, 'reload schema';
```

The grants restore the live ACL exactly, `{postgres=X, authenticated=X, service_role=X}` (read 2026-09-23). service_role would come back through Supabase's default privileges anyway, but stating it makes the after-state match the before-state on paper, which is what 8.1 item 19 compares. `notify` inside the runner's transaction is delivered at commit; until PostgREST reloads, its cached metadata still names `get_deck(p_limit)`, the SQL it sends does not reference the function's OID, and the extra output column simply rides along, so there is no window where the RPC fails.

The drop and create are in one transaction, so no caller ever sees the function missing. Nothing in the schema should depend on get_deck (plpgsql bodies are not tracked dependencies; the client calls it by name). Confirm with a read-only `pg_depend` query on `'public.get_deck(integer)'::regprocedure` before writing the file, and keep the DROP without CASCADE so a surprise dependency fails loudly (0060's rule for its view drop). The body is 0060's (or the live one, per 4's preamble) with exactly these edits:

```sql
-- declare, after v_viewer_is_demo:
  v_lol_game_id uuid;
  v_my_lol_tier text;
  v_my_lol_division smallint;
  v_my_region_is_na boolean;

-- after `select p.region, p.timezone, ... into v_my_region, ... from public.profiles p where p.id = v_me;`
  v_lol_game_id := public.lol_game_id();
  v_my_region_is_na := v_my_region in ('na_east', 'na_west');
  select pg.lol_tier, pg.lol_division
    into v_my_lol_tier, v_my_lol_division
    from public.profile_games pg
   where pg.profile_id = v_me and pg.game_id = v_lol_game_id;   -- no row leaves both null

-- the final SELECT: one new trailing column, two joins, new ORDER BY. Score is unchanged.
  select
    c.id, c.display_name, c.c_age, c.gender, c.region, c.bio,
    coalesce(sg.shared_count, 0),
    coalesce(ss.shared_count, 0),
    ( ...0060's score expression, byte for byte... )::numeric as score,
    d.duo
  from candidates c
  left join shared_games sg on sg.profile_id = c.id
  left join shared_shows ss on ss.profile_id = c.id
  left join shared_languages sl on sl.profile_id = c.id
  left join boosted b on b.profile_id = c.id
  left join public.profile_games lol
         on lol.profile_id = c.id and lol.game_id = v_lol_game_id
  cross join lateral (
    select case
      when v_my_region_is_na and c.region in ('na_east', 'na_west')
        then public.lol_solo_duo_eligible(v_my_lol_tier, v_my_lol_division,
                                          lol.lol_tier, lol.lol_division)
    end as duo
  ) d
  order by
    (b.profile_id is not null) desc,   -- a live Power-Up keeps its promise: "near the top of other people's decks"
    (d.duo is true) desc,              -- then pairs Riot's table lets duo in Solo/Duo
    score desc,                        -- then today's order, unchanged
    c.last_active_at desc nulls last
  limit p_limit;
```

Everything else stays byte for byte: the auth and ban preamble, `check_rate_limit('get_deck', 40, ...)`, the `p_limit` clamp, `is_premium`, `is_minor` (0067 depends on this call), `is_demo_viewer`, the preferences fetch, the premium nulling, the age band, every WHERE predicate, the four CTEs, the score formula.

Pitfalls the implementer must respect:

- **Name collisions with OUT parameters.** In a `returns table` plpgsql function every output column is a variable. Keep every column reference qualified (`c.region`, `lol.lol_tier`, `d.duo`). The output column is `lol_duo_eligible` and the function is `lol_solo_duo_eligible`, on purpose; do not rename either to match. `score desc` works only because it is a bare output name in ORDER BY (as in 0060); do not wrap it in an expression.
- **Boost above eligibility.** The Power-Up is sold as "30 minutes near the top of other people's decks" (`paywall.tsx:199`, `(tabs)/index.tsx:107-110`). Putting eligibility above it would break a paid promise for League viewers. Boosted rows already carry +1000 score; the explicit first key makes the tier visible.
- **Why eligible-first cannot empty the deck.** Only ORDER BY changed. The candidate set, and therefore `get_deck_pool_size` and the empty-deck messaging, are identical to today. The SQL test asserts the same set of ids with and without the viewer's rank (8.1 item 23, guarded by item 22's pool-size precondition).
- **Refill behaviour.** `useDeck` refills by calling get_deck again and appending ids it does not have (`deckQueue.ts`). The new order is deterministic for a given state, so refill dedupe is unaffected. The client's "deck is finished" signal (`mergeDeckPage` returns `exhausted` when a page adds nobody new) cannot be tripped by ordering either: the refill fires at 5 queued cards and asks for 20, so a page adds nobody new only when every unswiped candidate is already queued, whatever order they come back in.
- **No new failure path.** The added code cannot raise for any stored data: the CHECKs in 4.3 guarantee every stored pair is one the helpers accept, `lol_game_id()` returning null (League row missing or unmarked) makes every `duo` null and the deck unchanged, and the left join is on the `(profile_id, game_id)` unique key so it cannot duplicate a candidate row.
- **Cost.** One indexed left join and one immutable function call per candidate before the limit. Negligible at current size; revisit alongside 0063's scale note.

### 4.8 Re-running and removal

Re-run safety: `add column if not exists`, constraints dropped and re-added, `create or replace` helpers, `drop trigger if exists`, `drop function if exists get_deck`, idempotent upsert (a no-op on hosted), `revoke`/`grant` restated, backfill only touches rows with `lol_tier is null`. No applied migration is edited: the local-reset gap in 0039 is closed by 0069's upsert, not by touching 0039 or `seed.sql`. One re-run trap: `create or replace function` cannot change a function's argument or result types, so if a helper's signature ever changes after 0069 is applied, the next migration must `drop function` it first.

Removal (write it in the header, like 0059's REMOVAL section): recreate get_deck from the pre-0069 live body (0060's, unless the step 2 diff found otherwise) with the live ACL, drop the trigger and the six functions, drop the two constraints and columns. `rank_text` already holds the labels, so no data is lost. **But once the build that sends `lol_tier`/`lol_division` is in users' hands, dropping the columns breaks that build**: its Edit screen selects them and both writers send them, and PostgREST rejects an unknown column. After that point, removal means keeping the columns (and the trigger that keeps `rank_text` canonical) and reverting only get_deck.

Migration history: 0069 has no dependency on 0067/0068 and the plan is to apply it after them. If they slip and 0069 goes first, apply it with `apply-migration.ps1 -Commit` (it records the version itself). The history then has a gap below an applied version, and a later `supabase db push` of 0067/0068 needs `--include-all`; `apply-migration.ps1` does not care.

---

## 5. Card label: what it shows and when

- **Shows** exactly when the row came from `get_deck` and `lol_duo_eligible === true`.
- **Text:** "Can duo with you". Accessibility label: "Can duo with you in Ranked Solo/Duo".
- **Never shows** for `false` or `null` (Unranked, Master LP pairs, table-disagreement pairs, non-NA pairs, no League row on either side), or for rows from `get_standouts`, `get_online_now`, `get_party_deck`, `get_profile_card` (they carry no eligibility). "The server checked this pair" is the only meaning the label has.
- **No negative label.** Nothing ever says "can't duo".
- **Look:** a `Chip` with `tone="success"` and a 13px `people` Ionicon, in the same wrap row as the game chip. Plain text, no rank emblem, no tier colour palette. Check legibility over the photo gradient on a device in both schemes; if success green fails, use `tone="volt"`. If new token pairs are added, run `pnpm audit:contrast`.

---

## 6. Client

### 6.1 Shared types

New `packages/shared-types/src/lol-rank.ts`, exported from `index.ts`:

```ts
export const LEAGUE_RIOT_QUEUE = "RANKED_SOLO_5x5";
export const LOL_TIERS = ["iron","bronze","silver","gold","platinum","emerald","diamond","master","grandmaster","challenger"] as const;
export const LOL_DIVISIONAL_TIERS = ["iron","bronze","silver","gold","platinum","emerald","diamond"] as const;
export type LolTier = (typeof LOL_TIERS)[number];
export type LolTierChoice = LolTier | "unranked";          // mirrors profile_games.lol_tier_valid
export type LolDivision = 1 | 2 | 3 | 4;                   // 1 = I (highest) .. 4 = IV
export interface LolRank { tier: LolTierChoice; division: LolDivision | null }

export const LOL_TIER_LABELS: Record<LolTierChoice, string>;   // "Unranked", "Iron", ... "Challenger"
export function formatLolRank(rank: LolRank): string | null;   // mirrors lol_rank_label
export function parseLolRankText(text: string | null | undefined): LolRank | null;  // mirrors lol_parse_rank_text, same regex
export function isCanonicalLolRankLabel(text: string | null | undefined): boolean;  // parse then format === text
function lolRankOrdinal(rank: LolRank | null): number | null;                     // NOT exported; mirrors lol_rank_ordinal
export function lolSoloDuoEligible(a: LolRank | null, b: LolRank | null): boolean | null; // mirrors lol_solo_duo_eligible
export function lolDuoRuleSummary(rank: LolRank): string;       // picker helper copy, 6.3
export const LOL_DUO_RULES_SOURCE = {
  url: "https://support.riotgames.com/en-us/league-of-legends/gameplay/ranked-tiers-divisions-and-queues",
  checked: "2026-09-23",
} as const;
```

The client uses `lolSoloDuoEligible` only in tests; the server is the authority for labels. `lolDuoRuleSummary` is what the picker shows. Keeping the TS mirror is justified by the picker copy and by the cross-language checksum test (8.2).

`lolRankOrdinal` stays private to the module (tests reach it through `lolSoloDuoEligible`, which is what the checksum exercises). A public "rank to number" helper in the shared package is the one thing that would make it easy for later UI code to sort, compare or display players by a DuoQueue-computed number, which is the Riot policy line (1.1). The SQL twin is likewise revoked from every client role.

Other type edits:

- `database.ts` `ProfileGameRow`: add `lol_tier: LolTierChoice | null; lol_division: LolDivision | null;`.
- `matching.ts` `DeckCandidate`: add `lol_duo_eligible?: boolean | null;`. Optional, because standouts, party deck and profile card rows reuse this type and do not carry it.
- `profile.ts` `profileGameInputSchema`: add optional `lolTier` (`z.enum([...LOL_TIERS, "unranked"])`) and `lolDivision` (`z.number().int().min(1).max(4)`), with a refinement matching `lol_division_matches_tier`. Parity only; nothing server-side consumes it yet.

### 6.2 Finding League on the client

New `apps/mobile/src/features/league/leagueGame.ts`:

- `getLeagueGameId(): Promise<string | null>`: one PostgREST read of `games` filtered on `riot_queue = LEAGUE_RIOT_QUEUE` and `is_custom = false`, memoized as a module-level promise; a failed read clears the memo so the next call retries.
- `useLeagueGameId()`: react-query wrapper, key `["league-game-id"]`, `staleTime: Infinity`.
- Everywhere below: if the id is `null`, behave exactly like today (free-text field, no League chip).

### 6.3 The rank picker

New `apps/mobile/src/features/league/LeagueRankPicker.tsx`, plus a pure state module `rankPickerState.ts`. Used in two places, and only for the game whose `gameId === leagueGameId`:

- `app/(onboarding)/games.tsx`: replaces the rank `TextField` at 70-75 for the League card only.
- `app/edit-details.tsx`: replaces the rank `TextField` at 217-223 for the League card only.

Every other game keeps its `TextField` and skill `ChipSelect` exactly as now. The League card keeps its skill `ChipSelect` too; skill level and rank are different questions.

Layout, inline inside the existing game `Card` (no sheet, no new screen):

1. `SectionLabel`-style caption: "Solo/Duo rank".
2. Tier `ChipSelect`, single select, wrapping: Unranked, Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond, Master, Grandmaster, Challenger. Tapping the selected tier clears the rank.
3. Only for Iron..Diamond: division `ChipSelect` with IV, III, II, I (lowest to highest, as the League client orders them). Changing tier clears the division. Choosing Unranked, Master, Grandmaster or Challenger hides it and sets the division to null.
4. Helper line (caption, muted), from `lolDuoRuleSummary`, only once the rank is complete. It restates Riot's row as plain text:
   - Iron, Bronze: "In Solo/Duo you can duo with Iron to Silver."
   - Silver: "In Solo/Duo you can duo with Iron to Gold."
   - Gold: "In Solo/Duo you can duo with Silver to Platinum."
   - Platinum: "In Solo/Duo you can duo with Gold to Emerald."
   - Emerald: "In Solo/Duo you can duo with Platinum to Diamond III."
   - Diamond IV to II: "In Solo/Duo you can duo with Emerald II to Diamond II."
   - Diamond I: "In Solo/Duo you can duo with Diamond III to Master (under 200 LP)."
   - Master: "Under 200 LP you can duo with Diamond I, and you can duo with Master players within 400 LP of you. DuoQueue doesn't track LP, so Master duos aren't labeled." (Riot's Diamond I condition is on the Master player's LP; the earlier draft dropped it.)
   - Grandmaster, Challenger: "Duo isn't available at Grandmaster or Challenger."
   - Unranked: "Not placed yet? Pick your rank after placements to see who you can duo with."
5. Legacy note, only when the stored row has `rank_text` but no `lol_tier` (unparseable old text): `You wrote "{rank_text}". Pick your rank from the list so we can show who you can duo with.` followed by a small "Remove" text button. The old text is kept and re-sent until the user picks a rank or taps Remove (the League card has no text field any more, so without this button there would be no way to delete it).

Validation (Continue in onboarding, Save in edit): a divisional tier with no division blocks with "Pick a division for your League rank, or tap the tier again to clear it." The rank stays optional.

No rank emblems, tier icons or Riot colours anywhere. No em dashes in any string (standing rule).

State and writes:

- `SelectedGame` (onboarding store) and `EditableGame` gain `lolTier: LolTierChoice | null` and `lolDivision: LolDivision | null`.
- `useEditableProfileDetails.ts:43` selects `game_id, skill_level, rank_text, lol_tier, lol_division, priority` and maps them. `useOwnProfileDetails.ts` needs no change (it shows `rank_text`, which is now canonical).
- Both writers (`onboarding-store.ts` submit, `useSaveProfileDetails.ts:26-32`) send, per row: `lol_tier`, `lol_division` (null for non-League rows, always), and `rank_text` computed by the rule below. The server overwrites `rank_text` anyway when a tier is set; sending the label keeps optimistic UI and the server identical.
- **`rank_text` for the League row, exactly:** tier set -> `formatLolRank(...)`. Tier not set -> the loaded text only if it does NOT parse (`parseLolRankText(text) === null`, i.e. genuine legacy text the note is showing), otherwise `null`. The "otherwise null" is load-bearing: a structured row loads with `rank_text = "Gold II"`, and if clearing the tier re-sent that text, the trigger (4.5) would parse it straight back into Gold II and the user could never clear their rank. Tapping Remove on the legacy note sets the text to `null`.
- A pure `toProfileGameRow(game, leagueGameId)` in `rankPickerState.ts` builds the row, and is what the unit test covers. It never sets `lol_*` on a non-League row, which is the only way to hit `lol_rank_not_league`.
- Save errors: onboarding already maps a P0001 to its `hint` (`toUserMessage`, onboarding-store ~80-92). `edit-details.tsx` (~136) shows `err.message`, which for a RAISE is the machine token. Move `toUserMessage` somewhere shared (for example `src/lib/`) and use it in both, so any raise from the trigger reads as a sentence.

### 6.4 Showing a League rank to other people

Today no stranger's rank is shown anywhere (`ProfileDetailContent.tsx:248` passes `rank: undefined`, and the card shows only the skill label). This feature shows exactly one rank to strangers: the League label, and only when it is canonical.

- `enrichCandidates.ts`: add `getLeagueGameId()` to the existing `Promise.all`; extend `PublicProfileGameRow` with `game_id` and `rank_text` (already returned by `select("*")`); compute `lolRank` = the candidate's League row `rank_text` when `isCanonicalLolRankLabel(rank_text)`, else `null`; add `isLeague` to each `topGames` entry.
- `types.ts`: `DeckCard` gains `lolRank: string | null`; `DeckCardGame` gains `isLeague: boolean`.
- Free text is never shown to strangers. After 0069 every parseable League rank is canonical, so a non-canonical League `rank_text` is unparsed legacy text and stays unrendered. Other games' ranks stay hidden from strangers as today (showing free text would open a new UGC surface).
- Where it shows: `enrichCandidates` also builds the cards for Standouts, Online now, the party deck and the `/profile/[profileId]` route (`useStandouts`, `useOnlineNow`, `usePartyDeck`, `useProfileCard`), so the League rank chip appears on all of them. The "Can duo with you" label appears only on `get_deck` rows, because only they carry `lol_duo_eligible`.
- Not a new data exposure. `public_profile_games` has returned every game's `rank_text` to any signed-in, unblocked, non-demo-gated viewer since 0001; the app simply never rendered it. This feature renders one already-readable field. `lol_tier`/`lol_division` are not in any view, and get_deck's boolean is derived from exactly the rank the viewer can already read, so it tells them nothing new.

### 6.5 Deck card and profile detail

A pure helper `apps/mobile/src/features/swipe/cardChips.ts` decides the card's chip row, so the rule is unit-tested rather than living in JSX:

- `card.lol_duo_eligible === true` and `card.lolRank`: `[League of Legends · {lolRank}]` then `["Can duo with you", tone success, people icon]`. The League chip is promoted even if League is not the top game, so the label sits next to the rank it is about.
- Otherwise: today's single chip `topGames[0]`; if that game `isLeague` and `lolRank` is set, its detail is `lolRank` instead of the skill label.

`SwipeCard.tsx:351-355` renders whatever the helper returns (the row already wraps).

`ProfileDetailContent.tsx:245-251`:

- Games chips: League's detail is `lolRank` when set (still overridden by a verified stat, as `GamesSection` does today); other games unchanged. If eligible and League is not in `topGames`, prepend the League chip.
- When `card.lol_duo_eligible === true`, add one caption under the Games section: "Can duo with you in Ranked Solo/Duo, based on the ranks you both listed and League's published duo rules. The League client has the final say."

That caption is where the hidden-MMR and self-reporting caveats live. The card chip stays short.

Own profile (`(tabs)/profile.tsx`): no code change. It already shows `rank_text`, now canonical.

---

## 7. Backfill of existing `rank_text`

- Done in 0069 (4.6) through the trigger, so the backfill and live writes share one parser.
- Only the League row is touched, and only when `lol_tier is null` and `rank_text is not null`.
- Parsed rows get a structured rank and `rank_text` is normalized to the label. Today that turns the two real users' "Iron 1" and "Iron 3" into "Iron I" and "Iron III" (a visible but harmless change on their own profile), and the demo "Diamond II" stays "Diamond II".
- Unparsed rows keep their text and get no tier. The client shows the legacy note (6.3) and treats them as unranked for eligibility (`null`).
- Non-League rows are never read or written, including ones that look like League ranks ("Plat 2", "Diamond").
- No data is deleted, so there is nothing to back up. The census notice records the counts.

---

## 8. Tests

### 8.1 SQL: `supabase/checks/0069_league_rank_duo.sql`

First SQL test file in the repo. Starts with `begin;`, ends with `rollback;`, uses plpgsql `assert` in `do` blocks, and leaves nothing behind. It lives in `supabase/checks/`, not `supabase/tests/`: the Supabase CLI's `supabase test db` runs everything under `supabase/tests/` through pg_prove as pgTAP, and a plain assert script there reads as a failed plan to whoever runs that command next. Calls use bare integer literals for divisions, which works because the helpers take `integer` (4.4).

- **Before commit:** concatenate `0069_league_rank_duo.sql` and the test body into a scratch file inside one `begin; ... rollback;` and run it with `scripts/db/run-sql.ps1 -QueryFile`.
- **After commit:** run the test file alone the same way.

A. Pure functions (as postgres)

1. Riot rows, at least one `true` and one `false` per row: Iron IV x Silver I true; Iron I x Gold IV false; Bronze II x Iron IV true; Bronze I x Gold IV false; Silver IV x Gold I true; Silver I x Platinum IV false; Gold II x Silver IV true; Gold II x Platinum I true; Gold IV x Bronze I false; Gold I x Emerald IV false; Platinum III x Gold IV true; Platinum I x Emerald I true; Platinum I x Diamond IV false; Emerald II x Diamond III true; Emerald I x Platinum IV true; Emerald IV x Gold I false; Diamond IV x Emerald II true; Diamond II x Diamond IV true; Diamond IV x Diamond I false; Diamond I x Diamond I true; Diamond I x Emerald I false.
2. `null` cases: Unranked x Gold II; (null, null) x Gold II; Master x Master; Master x Diamond I; all eight table-disagreement pairs from 1.4.
3. `false` apex cases: Master x Diamond II; Grandmaster x Grandmaster; Challenger x Master; Grandmaster x Iron IV.
4. Checksum: a `values` list of the 32 choices, cross joined, gives exactly 306 true, 636 false, 82 null.
5. Symmetry: zero rows where `f(a,b) is distinct from f(b,a)`.
6. Parser: 'Iron 1' -> (iron,1); 'Iron 3' -> (iron,3); 'Diamond II' -> (diamond,2); 'plat 2' -> (platinum,2); 'GOLD iv' -> (gold,4); 'gold4' -> (gold,4); '  Silver   I ' -> (silver,1); 'Master' -> (master,null); 'Master I' -> (master,null); 'gm' -> (grandmaster,null); 'Grand Master' -> (grandmaster,null); 'Unranked' -> (unranked,null); and (null,null) for 'Diamond', 'Gold V', 'Immortal 1', 'Master 400 LP', '', null.
7. Labels: ('gold',2) -> 'Gold II'; ('iron',4) -> 'Iron IV'; ('master',null) -> 'Master'; ('grandmaster',null) -> 'Grandmaster'; ('unranked',null) -> 'Unranked'; ('gold',null) -> null.

B. Constraints and trigger (as postgres, on a real profile's rows, rolled back)

8. `lol_tier='gold', lol_division=null` on the League row fails with 23514; so do `('master',1)`, `('silver',5)`, `('Gold',2)`.
9. A tier on a non-League row (for example Valorant) raises `lol_rank_not_league`.
10. Insert League with `rank_text 'plat 2'`, no tier -> (platinum, 2, 'Platinum II').
11. Insert League with tier (gold, 2) and `rank_text 'whatever'` -> `rank_text 'Gold II'`.
12. Insert League with `rank_text 'hardstuck'` -> tier null, text kept.
13. Update League `rank_text` only, 'Gold II' -> 'Silver I' -> tier (silver, 1).
14. Update League tier only to (emerald, 4) -> `rank_text 'Emerald IV'`.
15. Non-League row with `rank_text 'Gold II'` -> tier null and text untouched (not normalized).
16. Backfill census: after 0069 on hosted, the three live League rows are structured, and zero League rows have a `rank_text` that `lol_parse_rank_text` accepts while `lol_tier` is null.
17. Clearing, the server half of 6.3's rule: insert League with tier null and `rank_text` null -> both stay null. And the trap the client rule exists for: insert League with tier null and `rank_text 'Gold II'` -> (gold, 2), i.e. re-sending a canonical label re-creates the rank.

C. Grants

18. `has_function_privilege` is false for anon AND authenticated on `lol_rank_ordinal(text,integer)`, `lol_rank_label(text,integer)`, `lol_parse_rank_text(text)`, `lol_solo_duo_eligible(text,integer,text,integer)`, `lol_game_id()`, `sync_profile_game_lol_rank()`.
19. `get_deck(integer)`: `proacl` equals the pre-0069 live ACL, `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`; so anon false, authenticated true.
20. `information_schema.column_privileges`: authenticated has INSERT on `games` for exactly `name, is_custom, created_by`; anon has none. Then, as the review account under `set local role authenticated`, `insert into public.games (name, is_custom, created_by) values ('0069 check game', true, <reviewer id>)` succeeds and the same insert naming `riot_queue` fails with 42501 (both rolled back): the grant is proven by use, not only by catalog.
21. `public_profile_games`: anon has no SELECT; authenticated has SELECT and nothing else; if 0067 is applied, `pg_get_viewdef` still contains `viewer_age_verified` (proves 0069 left it alone).

D. `get_deck` as the review account (the DB skill pattern)

Setup as postgres: look up the review account id from `auth.users` (`review@duoqueue.io`); delete its swipes and all `active_boosts` rows (rolled back); set its `preferences` filters to null (`preferred_regions`, `required_language`, every `filter_*`, and `filter_recently_active = false`) so no persona is removed for a reason unrelated to 0069; give it a League row at (gold, 2) and region na_east; pick three demo personas and set: P1 na_west (silver, 1), P2 na_east (emerald, 4), P3 no League row. Create `pg_temp.deck_a(...)` and `pg_temp.deck_b(...)` with get_deck's ten columns plus `pos bigint`, and grant insert/select on them to authenticated. Then `set local role authenticated` and `set local request.jwt.claims` to the reviewer's `sub`.

22. `insert into pg_temp.deck_a select * from public.get_deck(50) with ordinality`. (`with ordinality` numbers rows in the function's output order; `row_number() over ()` does not promise that.) Precondition: `count(*) < 50` in `deck_a`, else raise "pool larger than the limit: set comparison in D23 is not valid". The review account sees real users as well as demo ones, so after launch the pool will outgrow 50 and the limit, not the WHERE clause, would decide who is in each page. Assert: P1 has `lol_duo_eligible = true`; P2 has `false` and is present; P3 has `null` and is present; every `true` row has a lower `pos` than every non-true row.
23. As postgres, delete the reviewer's League row, then as the reviewer fill `deck_b` the same way. Assert: the set of `profile_id` in `deck_b` equals the set in `deck_a` (eligibility never filters); every `lol_duo_eligible` in `deck_b` is null; `score` never increases as `pos` increases (today's order, with no boosts present).
24. Restore the League row; set P1's region to `eu`; call again. P1 is now `null`.
25. Insert an `active_boosts` row for P2 (expires in 30 minutes); call again. P2 is at `pos = 1` although it is not eligible.

Rate limit: that is at most five calls, under get_deck's 40 per minute.

### 8.2 Unit tests (vitest, picked up by the existing config)

- `packages/shared-types/src/lol-rank.test.ts`: the same cases as 8.1 A1-A7, including the 306 / 636 / 82 checksum and symmetry over all 32 x 32 pairs. The checksum is the drift alarm between SQL and TS: if either side changes and the other does not, one of the two suites fails. Also assert that no `lolDuoRuleSummary` string contains an em dash, and that `LOL_TIERS` order matches the ladder.
- `apps/mobile/src/features/league/rankPickerState.test.ts`: tier change clears division; apex and Unranked force division null; tapping the selected tier clears; divisional tier without division fails validation; `toProfileGameRow` never sets `lol_*` on a non-League row; unparseable legacy text is preserved when no tier is picked; Remove sets it to null; `rank_text` equals `formatLolRank` when a tier is set; **a row loaded as (gold, 2, "Gold II") whose tier is then cleared produces `rank_text: null`, not "Gold II"** (the 6.3 trap); a non-League row passes its typed text through unchanged.
- The helper copy for every tier matches 6.3 word for word, and the Master line mentions 200 LP.
- `apps/mobile/src/features/swipe/cardChips.test.ts`: eligible -> League chip plus label (League promoted even when it is not the top game); eligible but `lolRank` null -> no label; `false` or `null` -> today's chip; League top game with canonical rank -> rank as detail; non-canonical League text -> skill label, text never shown.
- Existing suites (`deckQueue`, `emptyDeckDecisions`, `profile`, `new-player-alert`) must stay green unchanged.
- `pnpm typecheck` and `pnpm lint` green.

### 8.3 On a device (render before claiming)

Signed in as the review account after the seed re-run: first two deck cards show "Can duo with you" with a League rank chip; the Emerald persona appears later with no label; the picker works in onboarding and in Edit details in both colour schemes; a build 10 install still saves a profile.

---

## 9. Compatibility and rollout

### 9.1 Build 10 (approved 1.0, release cancelled 23 Sept) against the new backend

| Build 10 behaviour | After 0069 |
|---|---|
| Calls `get_deck`, casts to `DeckCandidate[]` | Extra `lol_duo_eligible` key is carried and ignored. Order changes (eligible first) with no label; acceptable. |
| Onboarding / Edit save: delete then insert `profile_games` with `rank_text` only | Trigger parses the text; a canonical "Gold II" round-trips to the same structured rank; new text re-derives it; unparseable text stays text. No error path: build 10 never sends `lol_*`. |
| Shows own `rank_text` | Now the canonical label ("Iron I" instead of "Iron 1"). |
| Shows strangers' games | Unchanged (no ranks). |
| Custom game insert `{ name, is_custom, created_by }` | Still allowed by the narrowed column grant (8.1 item 20 proves it by performing that exact insert as a signed-in user). |
| Clears its rank text field and saves | `rank_text` null, no tier: the rank is cleared. Build 10 has no way to re-send a stale label unless the user leaves the field as it is, in which case keeping the rank is what they asked for. |

So 0069 can be applied as soon as it passes its tests, ahead of the Oct 1 binary, and the old binary keeps working if the new one is rejected. The reverse is not true: the new binary needs 0069 (it selects and writes the new columns), so 0069 must be live before the new build reaches review, and must not be removed while that build is in use (4.8).

### 9.2 Order of operations

1. 0067 and 0068 land (other job). No hard dependency, but keep numbering order; if they slip, see 4.8 on applying 0069 first.
2. Read the live `get_deck` definition and diff against 0060 (section 4 preamble). As of 2026-09-23 they are identical (2.1); the step stays because the other job could still change it.
3. Dry run 0069 plus the SQL test (8.1) at a quiet hour (the dry run holds an ACCESS EXCLUSIVE lock on `profile_games` for its whole transaction). Fix until green. Then `apply-migration.ps1 ... -Commit`.
4. Run the SQL test file again against the committed schema.
5. Update and re-run `node scripts/seed-review-demo.mjs` in plain mode, never `--filming`, before any submission (9.3). Re-measure the reviewer's deck order with get_deck(50) and update the seed's comments (143-163 and the shared-count note at 211-220) and the measurement table in `docs/APP-STORE-SUBMISSION.md` section 1.5.
6. Update the Games bullet of `docs/legal/privacy-policy.md` (2.4) and republish the legal site, before the build that shows ranks to strangers is released. Suggested wording, no em dashes: "Your League of Legends rank, if you add one, is shown to other users and used to put players you can duo with in Ranked Solo/Duo nearer the top of your deck."
7. Build the client changes; device pass (8.3); ship in the Oct 1 build.

No Edge Function changes or deploys. No App Store metadata change is required. The App Privacy answers should not need to change either, since no new kind of data is collected (the policy already lists self-reported rank per game); confirm that against what was declared in App Store Connect rather than assuming it.

### 9.3 App Review demo account

The reviewer must see the feature on the first cards, so:

- `REVIEWER.games` (seed 174-188): add `{ name: "League of Legends", skill: "competitive", rank: "Gold II" }` at index 0, so the reviewer's own profile and Edit screen show the League row and picker first. Region stays na_east.
- **Dae** (the existing League support main): region `sea` -> `na_west`, timezone `Asia/Manila` -> `America/Los_Angeles`, rank "Diamond II" -> "Platinum I". Gold II and Platinum I are eligible both ways. Bio already fits.
- **Devon** (na_east): add `{ name: "League of Legends", skill: "casual", rank: "Silver I" }` at the end of his list. Eligible with Gold II.
- **Ophelia** (na_west): add `{ name: "League of Legends", skill: "competitive", rank: "Emerald IV" }` at the end. Not eligible with Gold II. She shows that ineligible players stay in the deck, just later.
- Plain-text ranks are enough: the seed inserts `rank_text` as the service role and the trigger parses it.
- Expected deck order for the reviewer: Dae and Devon first (eligible), then everyone else by score. Measure it; do not reason it (the seed's own warning).
- The added shared game raises Dae's, Devon's and Ophelia's score by 10 (+2 on a skill match, which only Ophelia gets: both competitive), and Dae's timezone move changes the play-window overlap term too, so the non-eligible part of the order moves as well. That is why step 9.2.5 re-measures.
- **This account is also the filming account.** Eligible-first puts Dae and Devon, both abstract-art personas, at the top of the reviewer's deck in every mode. The seed's own notes (143-163) and the footage notes in `marketing/` treat Dae as the abstract card Cameron asked the edit to ignore, and today's filming order opens on photographs. Proposed: under `--filming` only, the seeder leaves `REVIEWER`'s League game out, so the reviewer has no rank, no pair is eligible, the League rows on Dae, Devon and Ophelia add nothing to their shared count with the reviewer, and the order is score-only again (only Dae's timezone change remains; re-measure). Plain mode, which is what App Review sees, keeps League. Cameron's call (11).
- Deck cards for Devon and Ophelia will show League only if eligible (Devon) or if League is their top game (it is not), which is the intended demo.
- Optional, only if Part 4 of `docs/APP-STORE-SUBMISSION.md` has room (it was at 3,992 of 4,000 characters in August): one sentence, "League of Legends players pick their Solo/Duo rank from a list, and the deck shows who can duo with you under League's published rules. Ranks are self-reported." The feature is visible on the first two cards without it.
- Before shipping, check that no new store screenshot or preview frame shows the label before the feature is in the submitted build.

---

## 10. What not to build, and what comes next

### 10.1 Not in this pass

- **No custom skill score, MMR, ELO, "rank distance", or "skill match %".** The ordinal is an index into Riot's rows and is never stored, shown, exported from the shared package, or executable by a client role. The deck sort key it feeds is a yes/no from Riot's own table, not a number. Riot's policy forbids alternatives to the ladder.
- **No season-reset handling.** Self-reported ranks go stale when Riot resets ranks between splits; v1 has no "is this still your rank?" prompt. A cheap follow-up once there is data on how often people edit.
- **No LP field.** It would make Master pairs decidable for a tiny group and it goes stale daily. Master pairs stay `null`.
- **No filtering by eligibility**, free or premium. Ordering only, so the deck never empties. Eligibility stays free (Riot also requires a free tier for registered products).
- **No Flex label.** Flex is unrestricted below Diamond, so a Flex label would be on nearly every pair and would mean nothing.
- **No rank emblems, tier icons, Riot art, or tier colour palette.** Plain text only; no production key yet.
- **No change to** `public_profile_games` or any public view, `get_standouts`, `get_online_now`, `get_party_deck`, `get_profile_card`, `deck_gate_*`, `get_deck_pool_size`, the new-player sweep, or any Edge Function.
- **No server/shard field.** v1 claims eligibility only for NA pairs (1.3).
- **No role field in 0069.** It is not trivial: it needs a column, a picker, and an ordering rule.

### 10.2 Follow-ups, in the order I would do them

1. **Role field (next).** Riot position names as plain text (Top, Jungle, Mid, Bot, Support, plus Fill), a primary and a secondary role stored on the same League row (`lol_primary_role`, `lol_secondary_role` with a CHECK, and the same "League row only" trigger guard), a picker under the rank picker, and one more ORDER BY key inside the eligible bucket for complementary pairs (Bot with Support first). That is a preference ordering, not a skill score, so it stays inside Riot's policy. Separate spec and migration.
2. **Standouts and Online now.** Prefer eligible pairs in the daily Standouts pick and return `lol_duo_eligible` from `get_standouts` and `get_online_now` (both are return-type changes: drop and recreate, re-assert grants). Online now is where "can duo right now" is most useful.
3. **New-player alert copy.** Add an eligible count to `get_new_player_alert_batch` so the push can say who can duo with you. Return-type change plus an Edge Function redeploy; keep the old copy path working for the shipped client's settings.
4. **Verified rank.** Once a production key and Riot account linking exist, prefer the verified tier over the self-reported one in eligibility, and use verified LP to decide Master pairs.
5. **Riot legal boilerplate.** Riot's developer policies require a visible "not endorsed by Riot Games" statement for registered products. Add it to Settings or the legal site when DuoQueue registers on the Developer Portal. Cameron's call on timing.
6. **Regions beyond NA.** Needs a real League server field, because `eu` and `sa` each map to two servers.

---

## 11. Decisions this spec made that Cameron may want to overrule

1. **Conservative reading of Riot's table** (both players' rows must allow the pair). This means Diamond I is labeled only with Diamond I, and the eight inconsistent pairs are unlabeled. The alternative, "either row allows", risks labels the client refuses.
2. **NA-only label.** Any pair outside na_east/na_west is unlabeled.
3. **Power-Up above eligibility** in the deck order, to keep the paid promise.
4. **Demo changes:** Dae moves to NA West and becomes Platinum I; Devon and Ophelia gain League.
5. **League rank shown to strangers** (only the canonical label), which is new: no stranger rank is shown today. It shows on every surface built by `enrichCandidates` (deck, Standouts, Online now, party deck, profile route), and needs the privacy policy line in 9.2.6.
6. **Filming order.** Eligible-first makes Dae and Devon (abstract art) the first two cards of the review/filming account. Proposed: `--filming` leaves the reviewer's League game out so the filming deck stays score-ordered (9.3). The alternative is to accept abstract first cards in future footage.
7. **The `games` INSERT narrowing rides along in 0069** (4.2). It is hardening that protects the League marker this feature keys on, and it is separable: drop those two lines if it should ship on its own.

## 12. Implementation checklist

1. Read the live `get_deck` definition; diff against 0060.
2. Write `0069_league_rank_duo.sql` (sections 4.1 to 4.8).
3. Write `supabase/checks/0069_league_rank_duo.sql` (8.1); dry-run both together at a quiet hour; commit the migration; re-run the test.
4. `packages/shared-types`: `lol-rank.ts` + test; type edits (6.1).
5. `apps/mobile/src/features/league/`: `leagueGame.ts`, `rankPickerState.ts` + test, `LeagueRankPicker.tsx`.
6. Wire the picker into `(onboarding)/games.tsx` and `edit-details.tsx`; extend the store, the edit loader, and both writers (with 6.3's exact `rank_text` rule); share `toUserMessage` and use it in `edit-details.tsx`'s save error.
7. `enrichCandidates.ts`, `types.ts`, `cardChips.ts` + test, `SwipeCard.tsx`, `ProfileDetailContent.tsx`.
8. Seed changes (9.3), including the `--filming` branch if Cameron takes it; re-run in plain mode; re-measure; update the seed comments and the `APP-STORE-SUBMISSION.md` 1.5 table.
9. Privacy policy Games bullet and legal site republish (9.2.6).
10. `pnpm typecheck`, `pnpm lint`, `pnpm test` (mobile), device pass (8.3).

---

## Review notes (adversarial review, 2026-09-23)

**Verified, no change needed.** Riot's duo table in 1.3 matches the Support page row by row (re-read independently), and the Developer Policy's "Prohibited alternatives include MMR or ELO calculators" line is real. The 306 / 636 / 82 checksum, the symmetry, the 63 / 3 / 16 split of the nulls and the per-rank counts in the 1.4 table were recomputed from Riot's rows by a separate script and all agree. Every 8.1 A1 case gives the stated result. A read-only query on the hosted DB confirmed: live `get_deck` is byte-identical to 0060 (`md5(prosrc)` match), nothing depends on it or calls it, `profile_games` has no triggers, the three League ranks are "Iron 1", "Iron 3" and "Diamond II", and the League row carries `RANKED_SOLO_5x5`. The deck cannot empty: only ORDER BY changes, the client's exhaustion signal is order-independent, and the added code has no path that raises on stored data. No view, applied migration or seed file is rewritten; `lol_tier`/`lol_division` reach no other user; the only new client-visible output is a boolean derived from a rank already readable through `public_profile_games`.

**Changed in this spec:**

1. **Helper signatures take `integer` divisions, not `smallint`** (4.4, 8.1 item 18). With `smallint` parameters, every call with a bare literal (`lol_rank_label('gold', 2)`, the checksum's `values` list) fails to resolve, since `integer -> smallint` is not an implicit cast. The column stays `smallint`.
2. **Clearing a rank could not work** (6.3, 8.1 item 17, 8.2). A structured row loads with `rank_text = "Gold II"`; if the client re-sent that text after the user cleared the tier, the trigger would parse it straight back. The League row's `rank_text` rule is now exact: label when a tier is set, else only unparseable legacy text, else null. The legacy note gained a Remove button, since the League card no longer has a text field.
3. **Master helper copy was wrong** (6.3). Riot allows Master with Diamond I only when the Master player is under 200 LP; the line now says so.
4. **`lock_timeout` and a quiet-hour dry run** (4 preamble, 9.2). `add column` takes an ACCESS EXCLUSIVE lock on `profile_games`, and the dry run holds it for its whole transaction on the live DB.
5. **get_deck grants restore the exact live ACL**, service_role included, and the test compares `proacl` to it (4.7, 8.1 item 19). Also noted why the PostgREST reload has no failure window.
6. **Deck test made durable** (8.1 items 22-23). The set-equality check needs the pool under the 50-row limit (the review account also sees real users, so this will stop holding after launch); it now asserts that precondition and clears the reviewer's preference filters first.
7. **The `games` INSERT narrowing is proven by use** (8.1 item 20) with the live before-state recorded (4.2), the upsert no longer writes on hosted, and the hardening is marked separable (11.7).
8. **SQL test moved to `supabase/checks/`** so `supabase test db` (pgTAP under `supabase/tests/`) does not trip on it.
9. **Removal and history caveats** (4.8, 9.1): once the new build ships, dropping the columns breaks it; applying 0069 before 0067/0068 needs `--include-all` for a later `db push`.
10. **Touchpoints added** (2.1, 2.3, 2.4): live DB snapshot; `edit-details.tsx` save errors show the RAISE token instead of the hint (fix in 6.3); `enrichCandidates` feeds Standouts, Online now, the party deck and the profile route, so the rank shows there too (6.4); the privacy policy Games bullet and legal site republish (9.2.6); the `APP-STORE-SUBMISSION.md` 1.5 measurement table; the seed's shared-count note; the marketing footage notes that name Dae.
11. **Filming conflict surfaced** (9.3, 11.6). The review account is also the filming account; eligible-first would open every future filming run on Dae, the abstract card the edit avoids. Proposed a `--filming`-only branch that leaves the reviewer's League game out.
12. **Policy guard tightened** (6.1, 10.1). The TS `lolRankOrdinal` is module-private, so the shared package exports no "rank to number" helper for later UI code to sort by. Added the "Master players in contention for Grandmaster are solo-only" rule (1.3) and a season-reset line to "not in this pass".
