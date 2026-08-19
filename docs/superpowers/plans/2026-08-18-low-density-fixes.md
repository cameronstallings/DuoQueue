# Low-density product fixes — implementation plan

Workstream 1 of the 2026-08-18 launch marketing design
(`docs/superpowers/specs/2026-08-18-launch-marketing-design.md`, section 1).

Covers:

- **1a** an honest empty state on the deck
- **1b** push existing users when a new user finishes onboarding and their games overlap
- **1c** premium filters must never silently return an empty deck

Live DB is at migration `0060`. This plan adds `0061`, `0062`, `0063`, one new Edge Function,
one new notification preference, and a handful of client files. It does **not** modify
`get_deck`, `get_online_now`, or any other existing discovery function.

Quality gates that must be green at every checkpoint, run from the repo root:

```
pnpm typecheck
pnpm lint
pnpm audit:contrast
```

`audit:contrast` only matters if a colour token changes. Nothing here changes tokens, so it
should stay green trivially; run it anyway, it is cheap.

---

## 0. What the investigation found, before the plan

Everything below was read, not assumed. The findings that change the shape of the work:

**F1. The deck does not paginate.** `useDeck.ts` calls `get_deck` with `p_limit: 20` once,
and pops cards off a local queue as the user swipes. When the queue empties, nothing
refetches — the user gets "No more profiles right now" and has to press Refresh. At 4 users
this is invisible. At 25 it makes *every* empty state a lie, including both of the new ones
this plan adds. Fixed in Step 1.5.

**F2. The 1a promise is conditional and the spec's copy does not know it.** "We will tell you
when someone who plays your games joins" is only true if (a) iOS push permission is granted
and (b) the new preference toggle is on. `registerForPushNotifications` is fired once at
sign-in from `session-store.ts` and silently no-ops on denial. An empty state that promises a
ping to a user who denied notifications is a worse lie than "Check back later". The empty
state branches on this.

**F3. Onboarding writes games *before* it flips `onboarding_completed`.**
`onboarding-store.ts` `submit()` does the delete-then-insert of `profile_games` (and
platforms, languages, playstyles, shows, prompts) in separate committed requests, and only
then issues the `profiles` UPDATE that sets `onboarding_completed: true`. So anything keyed
off that transition can see the new user's games. This is the load-bearing fact for 1b; if it
were the other way round the whole feature would notify nobody.

**F4. Games are mandatory in onboarding.** `(onboarding)/games.tsx` refuses to continue with
zero games. So "players who share your games" is always a meaningful set for a completed
profile, and copy referring to "your games" is never vacuous.

**F5. `send-push-notification` is event-shaped, not fan-out-shaped.** It accepts four typed
events, each addressed to one or two known profile ids, and `notifyProfile()` does a
per-profile settings check and token lookup. There is no batching, no ledger, no cooldown, no
quiet hours. `send-reengagement-nudges` is the sweep-shaped precedent, and it is the one this
plan follows.

**F6. Preference gating pattern, to be copied exactly.** Two variants exist and 0038
documents why:
- *Event-driven categories* (`new_match`, `new_message`, `super_ping`) are filtered inside
  the Edge Function by `notifyProfile()`, which reads `notification_settings` and treats a
  missing row as opt-in.
- *Swept categories* (`nudge_unread`, `nudge_online`) are filtered **inside the SQL candidate
  query** (`coalesce(ns.nudge_unread, true) = true`) so an opted-out recipient never becomes
  an Edge Function call at all.

1b is a swept category, so it uses the second form. The toggle is a plain boolean column on
`notification_settings` with `default true` — no enum, no separate table, exactly as 0038 did.

**F7. Grants.** Supabase default privileges grant `EXECUTE` to `anon`, `authenticated` **and**
`service_role` at function creation, and revoking from `PUBLIC` does not remove those. Every
new function below therefore does
`revoke execute on function ... from public, anon, authenticated;` and then grants back
exactly one role. This is the rule that was violated in 0013 and cost this repo a real
security hole (see 0041).

**F8. `profiles` UPDATE is a column allow-list, not table-wide.** 0031 replaced the table-wide
grant with an allow-list (`display_name, bio, gender, region, hide_last_active, is_active,
onboarding_completed, usual_play_start_hour, usual_play_end_hour, discord_username`). A new
column inherits no write access. 0059 still restated the revoke explicitly for `is_demo`;
0062 does the same for `onboarding_completed_at`.

**F9. Existing BEFORE UPDATE triggers on `profiles`** are
`enforce_verified_email_before_visible_trigger` (0028) and `set_profiles_updated_at` (0001).
Postgres fires BEFORE triggers in alphabetical name order, so a trigger named
`stamp_onboarding_completed_at_trigger` fires last. That is the order we want: the email
guard raises before anything gets stamped.

**F10. `dob` is `NOT NULL` and 18+-constrained** (0053/0056 + the `profile_must_be_18` CHECK),
so `is_minor()` is false for every account that can exist today. `get_deck`'s minor branch is
vestigial but live, so the new gates mirror it rather than dropping it.

**F11. Demo profiles exist** (`profiles.is_demo`, 0059) and are invisible to non-demo viewers
everywhere. Any new visibility or notification path must honour that or it re-opens exactly
the "fake profiles shown to real users" exposure 0059 was written to close.

### Where the spec is wrong or incomplete

1. **"The infrastructure exists and needs wiring, not building" (§1b) is optimistic.** Every
   *primitive* exists (Expo push client, bearer-auth helper, `app_config`-driven pg_cron
   pattern, per-category toggles, the `send-reengagement-nudges` sweep shape). None of the
   *mechanism* does: there is no fan-out query, no per-recipient ledger, no cooldown, no
   quiet hours, and nothing records when a profile finished onboarding. This is three
   migrations, one new Edge Function and one cron job. It is a day of work, not an hour.

2. **"notification open rate as the proxy" (§Success criteria) is not measurable.** There is
   no analytics SDK by design; Expo push receipts confirm handoff to APNs, not delivery and
   certainly not opens; iOS reports nothing back. §5 of this plan substitutes a measure that
   *is* available from Supabase, and states its limitation honestly rather than pretending it
   is an open rate.

3. **1c says "premium filters" but the free filters are the bigger hole.** Region, language
   and age range are set by anyone, are on the same screen, and empty a thin deck exactly the
   same way. The plan handles both, and the copy blames "your filters", not "your premium
   filters".

4. **1a's copy as specified makes a promise the app may not be able to keep** (F2). The
   implementation branches on whether the ping can actually be delivered.

5. **1b will not fire for the 4 existing users about each other.** `onboarding_completed_at`
   backfills as NULL by design, so nobody already on the platform is retro-announced. If
   Cameron wants a live end-to-end test before a real signup arrives, he has to create a test
   account or hand-stamp a row (§6).

6. **Spec §1's cited facts check out.** `get_admirers()` really does `limit 3` in 0059, and
   the free-tier swipe cap really is irrelevant at this density. No correction needed there.

---

## 1. Decisions this plan makes, and why

### D1. Where the new-signup trigger fires: a DB trigger stamps, cron delivers

A trigger records `profiles.onboarding_completed_at` on the `false -> true` transition. That
is all it does. Delivery is an hourly pg_cron sweep hitting a new Edge Function
(`send-new-player-alerts`), which asks Postgres for a recipient-centric batch.

Rejected: **fan out from the trigger** (the shape `notify_looking_now` uses). Reasons:

- `notify_looking_now`'s loop is bounded by the toggler's match count. This one is bounded by
  "everyone who plays Valorant". Putting an unbounded loop of `pg_net` posts inside the
  onboarding-completion UPDATE puts unbounded work on the single most important write in the
  funnel. `notify_via_edge_function` swallows errors, but it does not swallow time.
- No batching. Three signups in an hour means three separate pushes to the same recipient.
  A recipient-centric sweep collapses that into "3 new players joined".
- No quiet hours. A trigger fires when the new user finishes, which is when *they* are awake,
  not the recipient. Suppressing 3am pushes from a trigger requires a queue, and once you
  have a queue you have written the sweep.
- No retry. `pg_net` from a trigger is fire-and-forget. A failed sweep simply runs again next
  hour, and the ledger stops it double-sending.

Rejected: **impersonating the recipient** by `set_config('request.jwt.claims', ...)` inside a
service-role transaction so the sweep could literally call `get_deck` per recipient and get
zero predicate duplication. It works, and it is a footgun: a SECURITY DEFINER function that
sets JWT claims is one refactor away from being an authorization bypass. Not in this repo.

Rejected: **"your deck refilled" instead of "a new player joined"** — sweep every recipient
whose pool size went from 0 to non-zero. Strictly safer (it can never lead to an empty deck)
and needs no per-pair predicate. Dropped because it loses the shared game, which is both the
hook in the copy and what the spec actually asked for, and because it requires storing a
per-recipient previous pool size, which is not obviously cheaper.

Cadence: **hourly at minute :20** (`20 * * * *`). Existing jobs sit at :00 (swipe refresh),
:00/:30 (re-engagement nudges), :15 (rate-limit prune) and :40 (verified stats), so :20 is
free. Hourly rather than half-hourly because a 24h per-recipient cooldown makes sub-hour
resolution meaningless, and because "someone joined, come back sometime" tolerates an hour
of latency in a way "your duo is waiting" does not.

### D2. "Overlapping games" means at least one shared `game_id`

```sql
exists (
  select 1
  from public.profile_games mine
  join public.profile_games theirs on theirs.game_id = mine.game_id
  where mine.profile_id = <recipient> and theirs.profile_id = <new player>
)
```

This is the same join `get_deck`'s `shared_games` CTE uses for scoring, so "overlap" in the
notification means the same thing it means in the deck. Shows are deliberately excluded: the
spec says games, and a shared anime is a weaker signal than a shared game for a co-op
matching app.

Known limitation, accepted: `games.is_custom` means two users can type the same game as two
different rows and fail to overlap. That is a pre-existing catalog problem affecting the deck
score too, and deduping the catalog is a separate piece of work.

The headline game named in the push is the recipient's **highest-priority** shared game
(`order by mine.priority asc`), so the copy leads with the game they cared about most when
they onboarded.

### D3. Overlap is necessary but not sufficient — the new player must actually be visible

A push that leads to an empty deck is the exact failure this workstream exists to remove, so
the sweep only announces a new player to a recipient if that new player would actually appear
in that recipient's deck. That means mirroring `get_deck`'s predicates. Rather than paste them
into the sweep, they go into two small helper functions (`0061`) that both 1b and 1c use:

- `deck_gate_hard(viewer, candidate)` — the non-negotiable half: not self, active, not
  admin-suspended, onboarding complete, not banned, demo-gated, not already swiped, not
  blocked, same age band.
- `deck_gate_preferences(viewer, candidate)` — the viewer's own filters: age range, region,
  language, plus the premium set (game / platform / skill / playstyle / show / recently
  active) which, exactly as `get_deck` does, is inert unless `is_premium(viewer)`.

**This is a duplication of `get_deck`'s predicate and that is a real cost.** It is taken
deliberately, because the alternative is rewriting `get_deck` to call the helpers, and 0060's
header is an explicit, hard-won warning against touching that function body for anything but
a required change. The mitigations:

- The duplication lives in exactly two functions with a header comment naming `get_deck` as
  the source of truth and stating the obligation to change both together.
- Drift degrades *messaging and targeting*, never access. Nothing in this plan grants
  visibility; the gates only decide whether to count someone or whether to mention them.
- The one safety-critical predicate, the age band, is delegated to the existing
  `same_age_band()` helper rather than re-derived, so it cannot drift.

### D4. Rate limiting: four independent limits

1. **Per-recipient cooldown, 24 hours.** `not exists (... new_player_alerts where recipient_id
   = r.id and sent_at > now() - interval '24 hours')`. One new-player push per user per day,
   maximum, forever.
2. **Per-pair dedupe, permanent.** `new_player_alerts` has primary key
   `(recipient_id, new_profile_id)`. A given new player is announced to a given recipient at
   most once, ever, regardless of retries, replays or a scheduler double-fire. This is the
   `match_nudges` pattern keyed by pair instead of match.
3. **Announcement window, 48 hours.** Only profiles that completed onboarding in the last 48h
   are announceable. Comfortably longer than the cooldown so a signup that lands during a
   recipient's cooldown still gets announced on the next eligible sweep, and short enough that
   the sweep never degenerates into "everyone you have not been told about", which is just the
   deck.
4. **Per-run recipient cap, 200.** `p_max_recipients`, clamped 1..1000 in SQL. One run can
   never fan out unboundedly; overflow is picked up next hour. Ordered by new-player count
   descending so the most-affected recipients are served first.

Plus **quiet hours**: the sweep only selects recipients whose *local* hour is 10..20
inclusive (a 10:00 to 21:00 window), computed as
`extract(hour from (now() at time zone coalesce(r.timezone, 'America/New_York')))`.
`profiles.timezone` is a validated IANA name (`profiles_timezone_valid` CHECK, 0031). The
fallback is `America/New_York` because the app is US-only and Eastern is the *latest* US zone,
so a user with a null timezone can never be pushed after 21:00 local no matter where they
actually are. Because the sweep is hourly and the window is 11 hours wide, deferring costs at
most a few hours, never a lost notification.

### D5. Yes, it needs a new preference toggle

`notification_settings.new_player boolean not null default true`, surfaced in
`settings/notifications.tsx` as the seventh row.

- Default `true`, like every other category. It is the only way the feature reaches the 4
  existing users without asking them, and the OS-level permission is the real consent gate.
- A boolean column, not an enum or a new table: 0038 set that precedent for exactly this
  situation and gave the reason (no enum involved, so nothing needs its own migration).
- No new grants: `notification_settings` still carries the table-wide
  `grant select, insert, update, delete ... to authenticated` from 0001 (verified: no later
  migration narrows it), scoped to own-row by `notification_settings_all_own`.
- Filtered in SQL, not in the Edge Function, per F6.

Name: `new_player`, not `new_signup` or `new_match_available`. "Player" is the app's own
vocabulary, carries no dating connotation, and reads correctly in the settings row label.

### D6. 1c detects the cause rather than guessing it

A new RPC `get_deck_pool_size()` returns how many candidates the caller would have with **all
preference filters removed** (hard gates only). The deck screen calls it only when the deck
comes back empty. Three outcomes:

| deck | pool | screen |
| --- | --- | --- |
| empty | > 0 | 1c: "Your filters are hiding everyone", offer to clear |
| empty | 0 | 1a: "You are early", offer the ping |
| empty | in flight | keep showing the skeleton |

The alternative — infer from the client that filters are set and blame them — was rejected
because at current density the honest answer is almost always "there is nobody", and an app
that blames the user's filters for its own emptiness has replaced one lie with a different
one. One extra RPC on an already-empty screen is worth telling the truth.

Note that "you have swiped everyone" and "nobody exists" both produce `pool = 0` and both get
the 1a screen. That is correct: for a user who has seen everyone, "we will ping you when
someone new joins" is precisely the right promise.

---

## 2. Files

### New

```
supabase/migrations/0061_deck_visibility_gates.sql
supabase/migrations/0062_new_player_alerts.sql
supabase/migrations/0063_schedule_new_player_alerts.sql
supabase/functions/send-new-player-alerts/index.ts
apps/mobile/src/features/swipe/useDeckPoolSize.ts
apps/mobile/src/features/swipe/useEmptyDeckReason.ts
apps/mobile/src/features/swipe/EmptyDeck.tsx
```

### Changed

```
supabase/config.toml
packages/shared-types/src/database.ts
apps/mobile/src/components/EmptyState.tsx
apps/mobile/src/lib/notifications.ts
apps/mobile/src/features/swipe/useDeck.ts
apps/mobile/app/(tabs)/index.tsx
apps/mobile/app/settings/notifications.tsx
apps/mobile/app/_layout.tsx          (Step 4.1, optional)
```

---

## 3. Phase 1 — 1a and 1c (client + one RPC)

Ships first. Lower risk, immediately visible, and `0061` is a prerequisite for Phase 2 anyway.

### Step 1.1 — Migration `0061_deck_visibility_gates.sql`

Header comment must state: these two functions **mirror `public.get_deck`'s candidate
predicate and must be changed whenever it is**; `get_deck` is deliberately not refactored to
call them, per 0060's warning about touching the live matching path; and drift here degrades
messaging and targeting only, never access, because nothing in this file grants visibility.

**`public.deck_gate_hard(p_viewer uuid, p_candidate uuid) returns boolean`**

`language sql`, `stable`, `security definer`, `set search_path = public`. Returns true when
`p_candidate` clears every non-preference gate `get_deck` applies for `p_viewer`:

```sql
select exists (
  select 1
  from public.profiles c
  join public.profiles v on v.id = p_viewer
  where c.id = p_candidate
    and c.id <> v.id
    and c.is_active = true
    and c.is_admin_suspended = false
    and c.onboarding_completed = true
    and c.is_banned = false
    and (c.is_demo = false or v.is_demo = true)
    and public.same_age_band(v.id, c.id)
    and not public.is_blocked_pair(v.id, c.id)
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = v.id and s.target_id = c.id
    )
);
```

Two notes for the comment: the demo predicate is 0059's rule with the viewer passed
explicitly instead of read from `auth.uid()`, and `same_age_band()` is used in place of
`get_deck`'s inline `v_effective_min_age/v_effective_max_age` arithmetic because the
*mandatory* part of that arithmetic (adults see adults, minors see minors) is exactly what
`same_age_band` already encodes — the relaxable part belongs in `deck_gate_preferences`.
`same_age_band` and `is_blocked_pair` are revoked from `authenticated` (0031) but this
function is SECURITY DEFINER, so it calls them as the owner, the same way `get_deck` does.

```sql
revoke execute on function public.deck_gate_hard(uuid, uuid) from public, anon, authenticated;
```

No grant back. Only other SECURITY DEFINER functions call it.

**`public.deck_gate_preferences(p_viewer uuid, p_candidate uuid) returns boolean`**

`language sql`, `stable`, `security definer`, `set search_path = public`. The viewer's own
filters. `left join public.preferences` (not an inner join, and not a lateral) so a viewer
with no preferences row degrades to "no filters", matching `get_deck`'s `select ... into`
leaving all locals NULL.

```sql
select exists (
  select 1
  from public.profiles c
  left join public.preferences pr on pr.profile_id = p_viewer
  cross join lateral (
    select public.is_premium(p_viewer) as prem, public.is_minor(p_viewer) as minor
  ) v
  where c.id = p_candidate
    -- age range: free filter, floored at 18. The band itself is deck_gate_hard's job.
    and (
      v.minor
      or extract(year from age(current_date, c.dob))::int
           between greatest(coalesce(pr.min_age, 18), 18) and coalesce(pr.max_age, 99)
    )
    and (
      pr.preferred_regions is null or array_length(pr.preferred_regions, 1) is null
      or c.region = any (pr.preferred_regions)
    )
    and (
      pr.required_language is null or exists (
        select 1 from public.profile_languages pl
        where pl.profile_id = c.id and pl.language_code = pr.required_language
      )
    )
    -- Premium-only filters. get_deck nulls every one of these when the viewer is not
    -- premium, so `not v.prem or ...` reproduces that without a second code path.
    and (not v.prem or pr.filter_platform is null or exists (
      select 1 from public.profile_platforms pp
      where pp.profile_id = c.id and pp.platform = pr.filter_platform))
    and (not v.prem or pr.filter_game_id is null or exists (
      select 1 from public.profile_games pg
      where pg.profile_id = c.id and pg.game_id = pr.filter_game_id))
    and (not v.prem or pr.filter_skill_level is null or exists (
      select 1 from public.profile_games pg
      where pg.profile_id = c.id and pg.skill_level = pr.filter_skill_level))
    and (not v.prem or pr.filter_playstyle is null or exists (
      select 1 from public.profile_playstyles pps
      where pps.profile_id = c.id and pps.tag = pr.filter_playstyle))
    and (not v.prem or pr.filter_show_id is null or exists (
      select 1 from public.profile_shows psh
      where psh.profile_id = c.id and psh.show_id = pr.filter_show_id))
    and (not v.prem or not coalesce(pr.filter_recently_active, false)
      or (c.last_active_at is not null and c.last_active_at > now() - interval '24 hours'))
);
```

```sql
revoke execute on function public.deck_gate_preferences(uuid, uuid) from public, anon, authenticated;
```

**`public.get_deck_pool_size() returns integer`**

`language plpgsql`, **volatile** (not `stable` — it calls `check_rate_limit`, which writes),
`security definer`, `set search_path = public`.

```sql
declare
  v_me uuid := auth.uid();
  v_count integer;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if public.is_banned_user(v_me) then raise exception 'account_banned'; end if;
  perform public.check_rate_limit('get_deck_pool_size', 20, interval '1 minute');

  select count(*) into v_count
  from public.profiles c
  where c.id <> v_me
    and c.is_active = true
    and c.is_admin_suspended = false
    and c.onboarding_completed = true
    and c.is_banned = false
    and public.deck_gate_hard(v_me, c.id);

  return v_count;
end;
```

The four cheap column predicates are repeated inline before the gate call so the per-row
SECURITY DEFINER call only runs on rows that already look plausible; `deck_gate_hard` is not
inlinable by the planner precisely because it is SECURITY DEFINER.

The auth and ban checks are copied from `get_deck`'s preamble so an unauthenticated or banned
caller gets the same errors from the same shape of function. Limit 20/minute vs `get_deck`'s
40: this is only reached on an empty deck, and it returns a bare count, so it leaks nothing,
but it does scan `profiles` and should not be a free scrape loop.

```sql
revoke execute on function public.get_deck_pool_size() from public, anon, authenticated;
grant execute on function public.get_deck_pool_size() to authenticated;
```

**Verify before moving on.** Apply with the `db` skill, then:

```sql
-- 1. ACLs are what we think they are, for all three functions.
select p.proname,
       has_function_privilege('anon',          p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authed,
       has_function_privilege('service_role',  p.oid, 'execute') as svc
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('deck_gate_hard','deck_gate_preferences','get_deck_pool_size');
-- expect: get_deck_pool_size -> anon f, authed t
--         both gates          -> anon f, authed f

-- 2. The gate agrees with the deck. Run as a real user (set the JWT claim in a
--    ROLLED BACK transaction, or just run it from the app while signed in).
--    get_deck's result set must be a subset of the hard-gate pool.
select (select count(*) from public.get_deck(50)) as deck,
       public.get_deck_pool_size()                as pool;
-- expect deck <= pool, always. If deck > pool the gates are wrong.
```

Run check 2 twice for the same account: once with no filters, once with a region filter that
excludes everyone. `pool` must not move; `deck` must drop to 0.

### Step 1.2 — `EmptyState` gains an optional secondary action

`apps/mobile/src/components/EmptyState.tsx`. Add two optional props alongside the existing
pair:

```ts
secondaryActionLabel?: string;
onSecondaryAction?: () => void;
```

Render below the primary button, `variant="ghost"`, same conditional-render style as the
existing action. Both props optional, so the eight existing call sites are untouched.

**Verify:** `pnpm typecheck` and `pnpm lint` clean; the eight existing usages
(`(tabs)/index.tsx`, `(tabs)/matches.tsx`, `admirers.tsx`, `chat/[matchId].tsx`,
`hidden-words.tsx`, `online-now.tsx`, `party/[partyId]/index.tsx`, `profile/[profileId].tsx`,
`settings/notifications.tsx`) still compile with no changes.

### Step 1.3 — `useDeckPoolSize`

New file `apps/mobile/src/features/swipe/useDeckPoolSize.ts`:

```ts
export function useDeckPoolSize(enabled: boolean) {
  return useQuery({
    queryKey: ["deck-pool-size"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_deck_pool_size");
      if (error) throw error;
      return (data ?? 0) as number;
    },
    enabled,
    staleTime: 30_000,
  });
}
```

The `enabled` flag is what keeps this off the hot path: it is only ever true when the deck has
settled at zero cards.

`usePreferences.save`'s `onSuccess` already invalidates `["deck"]`; add `["deck-pool-size"]`
to that invalidation so clearing filters re-evaluates both.

### Step 1.4 — The empty-deck decision, and the screen

New file `apps/mobile/src/features/swipe/useEmptyDeckReason.ts`. One hook, one discriminated
union, so the screen has no branching logic of its own:

```ts
export type EmptyDeckReason =
  | { kind: "resolving" }
  | { kind: "filtered"; poolSize: number }
  | { kind: "new"; canPing: boolean; permissionGranted: boolean };
```

It composes:
- `useDeckPoolSize(enabled)` where `enabled` is passed in by the caller,
- `useNotificationSettings()` for `settings?.new_player !== false`,
- a small `useQuery(["notification-permission"], () => (await
  Notifications.getPermissionsAsync()).granted, { staleTime: 60_000 })`.

`kind: "resolving"` while the pool query has no data yet — the screen keeps showing the
skeleton rather than flashing the wrong copy for a frame.

New file `apps/mobile/src/features/swipe/EmptyDeck.tsx` renders it. Copy, verbatim, no em
dashes anywhere, nothing that reads as dating:

**`filtered`:**
```
tick      FILTERED
title     Your filters are hiding everyone
subtitle  There {is|are} {n} {player|players} you could see right now, but your current
          filters rule {them|it} out.
primary   Clear filters          -> clears preferences, then refetch
secondary Adjust filters         -> router.push("/filters")
```

"Clear filters" writes, via `usePreferences().save`:
```ts
{
  min_age: MIN_AGE, max_age: 99,
  preferred_regions: null, required_language: null,
  filter_game_id: null, filter_platform: null, filter_skill_level: null,
  filter_playstyle: null, filter_show_id: null, filter_recently_active: false,
}
```
It clears the premium filters too even for a non-premium user. That is safe (for a lapsed
subscriber `get_deck` already nulls them server-side, so they are inert) and it stops a stale
filter re-applying the day they resubscribe.

**`new`, `canPing: true`:**
```
tick      YOU ARE EARLY
title     You are early
subtitle  DuoQueue is brand new, so there is nobody left in your deck right now. We will
          send you a ping the moment a player who shares your games signs up.
primary   Refresh                -> refetch()
```

**`new`, `canPing: false`:**
```
tick      YOU ARE EARLY
title     You are early
subtitle  DuoQueue is brand new, so there is nobody left in your deck right now. Turn on
          notifications and we will ping you the moment a player who shares your games
          signs up.
primary   Turn on the ping
secondary Refresh                -> refetch()
```

"Turn on the ping" branches on the reason it cannot ping:
- permission not granted and the OS still allows a prompt: call `ensurePushPermission()`
  (Step 1.4a); if it returns `granted`, call `registerForPushNotifications(profileId)` so the
  token actually lands in `push_tokens` (permission alone is not a token, and the batch query
  requires a token row), then invalidate `["notification-permission"]`.
- permission not granted and `canAskAgain` is false: `Linking.openSettings()`.
- permission granted but the toggle is off: `router.push("/settings/notifications")`.

`(tabs)/index.tsx` changes only in the `cards.length === 0` branch: replace the inline
`<EmptyState .../>` with `<EmptyDeck onRefresh={() => void refetch()} />`, and when the reason
is `resolving` render the same `<Skeleton style={{ flex: 1, borderRadius: radius.card }} />`
the loading branch uses. The error branch is untouched.

### Step 1.4a — `ensurePushPermission`

`apps/mobile/src/lib/notifications.ts`. Extract the existing permission block into:

```ts
/** Requests push permission when the OS still allows a prompt. Returns the resulting
 *  state so the caller can decide between prompting and sending the user to Settings. */
export async function ensurePushPermission(): Promise<{ granted: boolean; canAskAgain: boolean }>
```

It wraps the existing `getPermissionsAsync` / `requestPermissionsAsync` pair and additionally
returns `canAskAgain`, which the current code discards.
`registerForPushNotifications(profileId)` calls it and keeps its existing early-return
behaviour, so this is a pure refactor of code that already runs at sign-in
(`session-store.ts` `onSignedIn`). Nothing about the sign-in path changes. The token upsert
stays in `registerForPushNotifications`, so the empty state must call that too after a
successful grant.

**Verify Steps 1.2 to 1.4a together.** `pnpm typecheck`, `pnpm lint`, `pnpm audit:contrast`.
Then on a device or simulator with a real account:
1. Deck empty, no filters set: expect "You are early". On a simulator, push permission cannot
   be granted, so expect the `canPing: false` variant — that is the correct rendering, not a
   bug.
2. Set a region filter that matches nobody (with at least one other visible profile in the
   pool, seed one if needed): expect "Your filters are hiding everyone" with the right count.
3. Press "Clear filters": the deck repopulates without leaving the screen.
4. Press "Adjust filters": the Filters modal opens.

### Step 1.5 — Refetch when the local queue empties (F1)

`apps/mobile/src/features/swipe/useDeck.ts`. Today the queue drains to zero and stays there.
Add a one-shot refetch, guarded on the synced page identity so it can fire at most once per
page and cannot loop:

- Track the last synced page (`syncedData` already exists for this purpose).
- When `syncedData !== null`, `queue.length === 0`, `syncedData.length >= DECK_PAGE_SIZE`
  (the last page came back full, so the server may have more), and `!query.isFetching`, and
  we have not already auto-refetched for this exact `syncedData` reference, then record the
  reference and invalidate `["deck"]`.
- The loop terminates because a refetch either returns a new full page (queue non-empty, guard
  irrelevant) or a shorter/empty page (`length >= DECK_PAGE_SIZE` false, guard closed).

**This cannot fire below 20 visible profiles**, so it is inert at today's density and is safe
to defer if Phase 2 is more urgent. It is in Phase 1 because it is the difference between the
two new empty states being true and being confidently wrong the moment the launch works.

**Verify:** with fewer than 20 profiles, behaviour is byte-identical (no extra `get_deck`
call — confirm in the network log). With 20+ (seed temporarily if needed), swiping the 20th
card loads the next page instead of showing an empty state.

### Phase 1 checkpoint

All three gates green, migration `0061` applied and both verification queries above passing,
manual device pass done. Commit. This half is shippable on its own and does not require a new
build to be useful to the 4 existing users beyond the next OTA/EAS build.

---

## 4. Phase 2 — 1b, the new-player ping

### Step 2.1 — Migration `0062_new_player_alerts.sql`

Header comment covers: why a swept delivery rather than a trigger fan-out (D1), what
"overlapping games" means (D2), all four rate limits and the quiet-hours window (D4), why the
new column backfills NULL, and the note that `0063` must not be applied until the Edge
Function is deployed.

**1. When onboarding finished.**

```sql
alter table public.profiles add column onboarding_completed_at timestamptz;

-- 0031 replaced profiles' table-wide UPDATE grant with a column allow-list that this
-- column is not part of, so it inherits no write access. Restated explicitly, same
-- belt-and-suspenders 0059 used for is_demo: a user who could set this could farm
-- notifications by re-stamping themselves.
revoke update (onboarding_completed_at) on public.profiles from authenticated;

create index profiles_onboarding_completed_at_idx
  on public.profiles (onboarding_completed_at)
  where onboarding_completed_at is not null;
```

**Deliberately not backfilled.** Every existing profile keeps NULL, and the sweep requires
non-null, so nobody already on the platform is retro-announced to anyone. Announcing the 4
current users to each other would be false ("just joined") and pointless (they have already
seen each other's decks).

```sql
create or replace function public.stamp_onboarding_completed_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.onboarding_completed = true
     and coalesce(old.onboarding_completed, false) = false then
    new.onboarding_completed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_onboarding_completed_at() from public, anon, authenticated;

create trigger stamp_onboarding_completed_at_trigger
  before update of onboarding_completed on public.profiles
  for each row execute function public.stamp_onboarding_completed_at();
```

`of onboarding_completed` restricts firing to statements that assign that column, the same
narrowing 0038 used for `is_looking_now`. The `false -> true` guard means a later profile
edit cannot re-stamp. Name chosen so it sorts after
`enforce_verified_email_before_visible_trigger` (F9): the email guard raises first, so an
unverified account never gets stamped and therefore never gets announced. Revoking EXECUTE
does not stop the trigger firing — Postgres checks EXECUTE at `CREATE TRIGGER` time, not at
fire time, which `notify_looking_now` already proves in this schema.

**2. The preference.**

```sql
alter table public.notification_settings add column new_player boolean not null default true;
```

No grants needed: `notification_settings` still carries 0001's table-wide grant to
`authenticated`, scoped by `notification_settings_all_own` (verified: no migration between
0001 and 0060 narrows it).

**3. The ledger.**

```sql
create table public.new_player_alerts (
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  new_profile_id uuid not null references public.profiles (id) on delete cascade,
  sent_at        timestamptz not null default now(),
  primary key (recipient_id, new_profile_id)
);

create index new_player_alerts_recipient_sent_at_idx
  on public.new_player_alerts (recipient_id, sent_at desc);

alter table public.new_player_alerts enable row level security;
```

RLS on, no policies, no grants — service-role only, the same posture as `match_nudges` (0038)
and `swipe_refresh_notifications` (0031). The composite primary key *is* rate limit 2; it
cannot be bypassed by a retry.

**4. The batch query.**

`public.get_new_player_alert_batch(p_max_recipients integer default 200)` returns
`(recipient_id uuid, new_profile_ids uuid[], new_player_count integer, headline_game text)`.
`language sql`, `stable`, `security definer`, `set search_path = public`.

```sql
with recent_players as (
  select n.id
  from public.profiles n
  where n.onboarding_completed_at is not null
    and n.onboarding_completed_at > now() - interval '48 hours'
    and n.onboarding_completed = true
    and n.is_active = true
    and n.is_banned = false
    and n.is_admin_suspended = false
    and n.is_demo = false
),
eligible_recipients as (
  select r.id
  from public.profiles r
  join public.notification_settings ns on ns.profile_id = r.id
  where r.onboarding_completed = true
    and r.is_active = true
    and r.is_banned = false
    and r.is_admin_suspended = false
    and r.is_demo = false
    and ns.new_player = true
    and exists (select 1 from public.push_tokens t where t.profile_id = r.id)
    and not exists (
      select 1 from public.new_player_alerts a
      where a.recipient_id = r.id and a.sent_at > now() - interval '24 hours'
    )
    and extract(hour from (now() at time zone coalesce(r.timezone, 'America/New_York')))
          between 10 and 20
),
pairs as (
  select
    er.id as recipient_id,
    rp.id as new_profile_id,
    (select g.name
       from public.profile_games mine
       join public.profile_games theirs on theirs.game_id = mine.game_id
       join public.games g on g.id = mine.game_id
      where mine.profile_id = er.id and theirs.profile_id = rp.id
      order by mine.priority asc
      limit 1) as shared_game_name
  from eligible_recipients er
  join recent_players rp on rp.id <> er.id
  where exists (
      select 1 from public.profile_games mine
      join public.profile_games theirs on theirs.game_id = mine.game_id
      where mine.profile_id = er.id and theirs.profile_id = rp.id
    )
    and not exists (
      select 1 from public.new_player_alerts a
      where a.recipient_id = er.id and a.new_profile_id = rp.id
    )
    and public.deck_gate_hard(er.id, rp.id)
    and public.deck_gate_preferences(er.id, rp.id)
)
select
  p.recipient_id,
  array_agg(p.new_profile_id order by p.new_profile_id),
  count(*)::int,
  (array_agg(p.shared_game_name order by p.new_profile_id))[1]
from pairs p
group by p.recipient_id
order by count(*) desc, p.recipient_id
limit greatest(least(coalesce(p_max_recipients, 200), 1000), 1);
```

Both sides are required to be non-demo. A demo profile announced to a real user is exactly
the deception 0059 exists to prevent, and pushing to a review account has no purpose.
Requiring a `push_tokens` row keeps recipients who have never granted permission out of the
ledger, so their 24h cooldown is not burned on a notification that was never going to arrive.

The game-overlap `EXISTS` is the selective predicate and is written before the gate calls so
the planner has an indexed join to lead with; the two SECURITY DEFINER gates cannot be
inlined and should run last. **Scale ceiling, stated honestly:** this is
`eligible_recipients x recent_players` function calls per run. Fine into the low thousands of
recipients. Past roughly 10k the fix is to inline the gate predicates as joins in this
function; revisit then, not now.

```sql
revoke execute on function public.get_new_player_alert_batch(integer) from public, anon, authenticated;
grant execute on function public.get_new_player_alert_batch(integer) to service_role;
```

The explicit `service_role` grant is redundant against Supabase's current default privileges
but is stated so the intent survives a default-privileges change, matching
`check_rate_limit_service` (0048).

**Verify before moving on.**

```sql
-- ACL
select p.proname,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authed,
       has_function_privilege('service_role', p.oid, 'execute')  as svc
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_new_player_alert_batch';
-- expect anon f, authed f, svc t

-- Table is unreachable from the client roles
select has_table_privilege('anon','public.new_player_alerts','select')          as anon_sel,
       has_table_privilege('authenticated','public.new_player_alerts','select') as authed_sel,
       (select count(*) from pg_policies
         where schemaname='public' and tablename='new_player_alerts')           as policies;
-- expect f, f, 0

-- Trigger fires, and only on the false -> true transition. Run inside a transaction
-- you ROLL BACK.
begin;
  update public.profiles set onboarding_completed = false where id = '<a test profile>';
  update public.profiles set onboarding_completed = true  where id = '<a test profile>';
  select onboarding_completed_at from public.profiles where id = '<a test profile>';
  update public.profiles set bio = 'x' where id = '<a test profile>';
  select onboarding_completed_at from public.profiles where id = '<a test profile>';
rollback;
-- expect: stamped on the second statement, unchanged by the bio edit

-- Batch returns nothing yet (nobody has a non-null onboarding_completed_at)
select * from public.get_new_player_alert_batch(200);
-- expect 0 rows
```

### Step 2.2 — Edge Function `send-new-player-alerts`

`supabase/functions/send-new-player-alerts/index.ts`. Modelled directly on
`send-reengagement-nudges/index.ts`, including its header-comment style.

Structure:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendExpoPush } from "../_shared/expo-push.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");
```

- `POST` only, 405 otherwise (same reason as the nudge sweep: a crawler GET or a scheduler
  double-fire should not be able to start a fan-out).
- `checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN)`.
- `supabase.rpc("get_new_player_alert_batch", { p_max_recipients: 200 })`; on error return
  500 with the message, matching the nudge sweep.
- For each row, in order:
  1. **Insert the ledger rows first**, then send. `upsert` on
     `new_player_alerts` with `onConflict: "recipient_id,new_profile_id"` and
     `ignoreDuplicates: true`, one row per id in `new_profile_ids`.
     Deliberate: `sendExpoPush` returns `void` and swallows transport errors, so the function
     cannot know whether a send succeeded. Recording first means a crash between the two
     produces a *missed* notification rather than a duplicate one, and it means the 24h
     cooldown is honoured even when Expo is down. A missed new-player ping is superseded by
     the next new player; a duplicate is a bug the user can see.
  2. Fetch `push_tokens` for the recipient, `sendExpoPush(tokens, title, body,
     { category: "new_player" })`.
- Return `{ recipients: n, notified: m }`, 200.

Copy (no em dashes, nothing dating-adjacent, and every clause is true of every recipient it
is sent to):

```ts
const title = count === 1
  ? `Someone new plays ${game}`
  : `${count} new players joined`;
const body = count === 1
  ? "A new player just joined DuoQueue and they are in your deck now."
  : `They play games from your list, ${game} among them. Open your deck to see who.`;
```

No display name and no profile id in the payload. The deck is where identity belongs; the
push is an invitation to open it.

`supabase/config.toml`, in the block with the other secret-authenticated functions:

```toml
[functions.send-new-player-alerts]
verify_jwt = false
```

**Deploy and verify before scheduling.**

```
npx supabase functions deploy send-new-player-alerts --use-api
```

(`--use-api` is required on this machine: no Docker.) Then, with the token from the root
`.env`:

```
curl -i -X POST "$EDGE_BASE/send-new-player-alerts"          # expect 401
curl -i -X GET  "$EDGE_BASE/send-new-player-alerts" -H "Authorization: Bearer $TOK"  # expect 405
curl -i -X POST "$EDGE_BASE/send-new-player-alerts" -H "Authorization: Bearer $TOK"  # expect 200 {"recipients":0,"notified":0}
```

The third call returning zeroes is the expected state before any real signup, and it proves
the RPC grant works end to end.

### Step 2.3 — Migration `0063_schedule_new_player_alerts.sql`

Its own migration, applied **only after Step 2.2's deploy is verified**. Scheduling a job that
posts to a route that does not exist yet means an hour of 404s in `net._http_response` and a
confusing first debugging session. This is the same reason 0058 was its own file.

```sql
select cron.schedule(
  'new-player-alerts-hourly',
  '20 * * * *',
  $$
  select net.http_post(
    url := (select value from public.app_config where key = 'edge_function_base_url')
           || '/send-new-player-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.app_config where key = 'internal_trigger_token')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Header comment: minute :20 avoids the four existing jobs (:00 swipe refresh, :00/:30
re-engagement nudges, :15 rate-limit prune, :40 verified stats); hourly rather than
half-hourly because the per-recipient cooldown is 24 hours and the announcement window is 48,
so finer resolution buys nothing; the URL and token come from `app_config` rather than being
baked into the job definition, matching 0048 and 0058.

**Verify:**

```sql
select jobid, jobname, schedule, active from cron.job order by jobname;
-- expect five jobs, including new-player-alerts-hourly, active = true

-- after the next :20
select status, (regexp_match(content, '^.{0,120}'))[1] as head, created
from net._http_response order by created desc limit 5;
-- expect 200 and {"recipients":0,...}
```

### Step 2.4 — Client: type, toggle, deep link

**`packages/shared-types/src/database.ts`**
- `NotificationSettingsRow`: add `new_player: boolean;`.
- `ProfileRow`: add `onboarding_completed_at: string | null;`. (`session-store.ts` does
  `select("*")` into this type. Note the interface is already incomplete — it omits
  `is_banned`, `is_admin_suspended` and `is_demo` — so this is a small accuracy improvement,
  not a correctness fix.)

**`apps/mobile/app/settings/notifications.tsx`**
- Add `"new_player"` to the `NotificationCategory` union.
- Add to `CATEGORIES`, positioned after `super_ping` and before `daily_swipes_refreshed` so
  the person-driven categories stay grouped:

```ts
{
  value: "new_player",
  label: "New players in your games",
  hint: "When someone who plays your games joins DuoQueue.",
},
```

No layout change needed; the `Card` maps over `CATEGORIES` and draws its own seams. The
loading skeleton renders a fixed four rows and can stay as is.

**`apps/mobile/app/_layout.tsx` — notification tap routing. Optional but recommended.**

There is currently *no* `addNotificationResponseReceivedListener` anywhere in the app, so
tapping any push just resumes wherever the user left off. For this category that is wrong:
the whole point is to land on the deck.

Add a small hook in `src/lib/notifications.ts`, called from `RootLayout`:

- `Notifications.addNotificationResponseReceivedListener` for warm taps, and
  `Notifications.getLastNotificationResponseAsync()` once on mount for cold starts.
- Act only when `data?.category === "new_player"`, and only when
  `useSessionStore` status is `signed_in` and the loaded profile has
  `onboarding_completed` — otherwise the auth and onboarding redirects in `app/index.tsx` and
  `(tabs)/_layout.tsx` are fighting a `router.navigate` for the same frame.
- `router.navigate("/(tabs)")`, and invalidate `["deck"]` so the deck is fresh on arrival.
- Return the subscription's `remove()` from the effect.

Leave every other category alone. They carry no ids in their payloads, so there is nothing to
route to without a payload change, and changing those payloads means redeploying
`send-push-notification` for no benefit in this workstream.

**Verify Step 2.4:** `pnpm typecheck`, `pnpm lint`. The new row appears in
Settings > Notifications, toggles, and the value round-trips (confirm with
`select new_player from public.notification_settings where profile_id = '<id>';`).

### Phase 2 checkpoint: the end-to-end test

This cannot be done in Expo Go or the iOS Simulator. `registerForPushNotifications` needs a
real device and an EAS project id, and Expo push tokens are only issued to a dev-client,
TestFlight or App Store build. Plan for a device build.

1. On a device build, sign in as an existing account. Confirm a `push_tokens` row exists and
   `notification_settings.new_player` is `true`.
2. Confirm the recipient's local hour is inside 10..20, or temporarily widen the window in a
   rolled-back transaction to test outside it.
3. Create a fresh test account and complete onboarding, choosing **at least one game the
   existing account also has**.
4. Check the stamp: `select id, onboarding_completed_at from public.profiles
   order by onboarding_completed_at desc nulls last limit 3;`
5. Dry run before waiting on cron:
   `select * from public.get_new_player_alert_batch(200);`
   Expect one row: the existing account, `new_player_count = 1`, `headline_game` set to the
   shared game.
6. Fire the function by hand with the bearer token. Expect the push within seconds and
   `{"recipients":1,"notified":1}`.
7. **Re-fire immediately.** Expect `{"recipients":0,"notified":0}` — the ledger row now
   blocks both the pair dedupe and the 24h cooldown. This is the single most important
   assertion in the whole workstream; a firehose bug here is a mass-notification incident.
8. Tap the push. Expect to land on the deck, with the new player in it.
9. Set an impossible filter on the recipient (region nobody is in), create a second test
   signup with an overlapping game, and re-run the batch. Expect **zero rows**: the push must
   not be sent to someone whose filters would give them an empty deck.
10. Turn the "New players in your games" toggle off, create a third signup, re-run the batch.
    Expect zero rows.

---

## 5. Measurement

The spec's "notification open rate as the proxy" is not obtainable (§0, spec problem 2). What
Supabase can answer, using only data this plan already stores:

```sql
select
  date_trunc('day', a.sent_at)                       as day,
  count(*)                                           as players_announced,
  count(distinct a.recipient_id)                     as recipients,
  count(distinct a.recipient_id) filter (
    where exists (
      select 1 from public.profiles p
      where p.id = a.recipient_id
        and p.last_active_at > a.sent_at
        and p.last_active_at < a.sent_at + interval '24 hours'
    )
  )                                                  as returned_within_24h
from public.new_player_alerts a
where a.sent_at > now() - interval '14 days'
group by 1
order by 1 desc;
```

**Read it honestly:** `profiles.last_active_at` is overwritten, not appended, so this is only
accurate for a recipient's *most recent* alert. Anything older than about 48 hours will
undercount. Use the last two days' rows as the signal and treat older rows as a volume count
only. A true return-rate would need an events table, which is new tracking and is out of
scope here (and would be a privacy-label decision, not just an engineering one).

This query belongs in workstream 3's summary script; it is written here because this is where
the table it reads is defined.

---

## 6. What Cameron has to do

- **Apply `0061`, `0062`, `0063` in order**, with `0063` held back until
  `send-new-player-alerts` is deployed and hand-fired successfully.
- **Deploy the Edge Function:**
  `npx supabase functions deploy send-new-player-alerts --use-api`. No new secrets;
  `INTERNAL_TRIGGER_AUTH_TOKEN` is already set on the project.
- **Cut a new build.** Every client change here (the empty states, the settings row, the tap
  handler) ships in the binary. The approved 1.0 build does not contain them. Decide whether
  1a/1c go out in 1.0 or 1.0.1 — see the risk note below.
- **Run the Phase 2 device test on a real device.** It cannot be done in the Simulator.
- **Decide whether to hand-stamp `onboarding_completed_at`** for a test account if he wants a
  live demonstration before organic signups arrive. The honest default is to leave it and let
  the first real signup be the first test.
- **Consider 0059's REMOVAL section.** Now that review is over, the demo profiles have served
  their purpose. They are gated everywhere including in this plan's new paths, so leaving them
  is not a defect, but deleting them removes a whole class of "did we gate it everywhere"
  question. His call, out of scope here.

---

## 7. Risks

**R1. This changes the binary after approval.** The build Apple approved does not contain any
of the client work. Shipping 1a/1c means either releasing 1.0 as approved and following with
1.0.1, or pulling the approved build and resubmitting. Resubmitting restarts review and puts
the launch window at risk for copy changes on one screen. **Recommendation: release 1.0 as
approved, ship this as 1.0.1.** The server half (1b) is not in the binary at all and can go
live immediately; existing users get the ping regardless of which build they are on, as long
as they have a push token. That ordering also means 1b starts earning its keep during the
waitlist rather than after it.

**R2. A firehose bug is a mass-notification incident**, and unlike a bad screen it cannot be
recalled. The four independent limits (D4) are all enforced in SQL, not in the Edge Function,
so a bug in the TypeScript cannot widen them. The kill switch is
`select cron.unschedule('new-player-alerts-hourly');` — write it down somewhere Cameron can
find it at 2am.

**R3. Gate drift.** `deck_gate_hard` and `deck_gate_preferences` mirror `get_deck` and nothing
enforces that they stay in sync. Accepted deliberately (D3). Mitigation is the header comment
plus the "deck <= pool" assertion in Step 1.1's verification, which is a cheap invariant to
re-run after any future change to `get_deck`. Add it to whatever passes for a release
checklist.

**R4. Recipients with no `push_tokens` row.** They are excluded from the batch, so their deck
stays quiet and their 1a empty state correctly shows the `canPing: false` variant. But it also
means the feature's reach is bounded by push permission grant rate, which nothing currently
measures. Worth watching once there are enough users for the number to mean anything.

**R5. Quiet hours drop a notification for a user whose `timezone` is null.** The
`America/New_York` fallback bounds the damage (never after 21:00 local anywhere in the US) but
a Pacific user with a null timezone gets a narrower effective window, 07:00 to 18:00. Timezone
comes from `Intl` at sign-up and is almost always present; the fallback is for the rare
malformed case.

**R6. The 48h announcement window is a hard cutoff.** A user who is outside the quiet-hours
window every time the sweep runs for two days straight would miss a signup entirely. Not
reachable in practice with an 11-hour window and an hourly sweep, but it is the failure mode
if the window is ever narrowed.

**R7. Custom-game fragmentation** (D2) means some genuine overlaps are missed. Under-notifying
is the safe direction, and it affects deck scoring identically today.

---

## 8. Explicitly out of scope

- Any change to `get_deck`, `get_online_now`, `get_party_deck`, `get_standouts`,
  `get_admirers`. 0060's header is a direct warning against casual edits to that path and
  nothing in this workstream requires one.
- Deep-link payloads for the existing notification categories.
- An events table, an analytics SDK, or anything that would change the privacy label.
- Catalog dedupe for custom games.
- Raising the free-tier admirers limit or the swipe cap. The spec's own investigation found
  neither is the constraint at this density, and that finding checks out.
