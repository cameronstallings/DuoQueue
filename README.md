# DuoQueue

A swipe-based matching app for finding gaming friends — match on shared games, shows,
and playstyle, then chat and optionally share Discord usernames.

Built as a monorepo: Expo (React Native, TypeScript, managed workflow) + Supabase
(Postgres, Auth, Realtime, Storage, Edge Functions) + RevenueCat (Apple/Google
subscriptions).

## Status

This repo currently implements **Phase 1 + Phase 2**:

- Phase 1: project scaffolding, the full Postgres schema (all tables/RLS, ahead of the
  phases that consume them), Supabase Auth (email + Apple/Google) with an 18+ age gate,
  and the profile setup wizard.
- Phase 2: the swipe deck (gesture-driven card stack + like/pass buttons), the matching
  algorithm (`get_deck` RPC — ranks by shared games, shared shows, region, shared
  languages, compatible skill level), server-enforced swipe quota and mutual-like match
  creation (`perform_swipe` RPC), and the filters screen (basic filters for everyone;
  advanced filters gated server-side behind premium status, with a paywall prompt when a
  free user taps one).

Chat, Discord sharing, unmatch/block/report, RevenueCat billing, and moderation land in
later phases — see `app/chat/[matchId].tsx` and `app/paywall.tsx` for the placeholder
screens they'll replace.

## Repo layout

```
apps/mobile/         Expo app (TypeScript, expo-router)
  app/                file-based routes: (auth), (onboarding), (tabs), chat, filters,
                       match/[matchId], paywall
  src/
    components/       shared UI (Button, TextField, ChipSelect, ScreenContainer)
    features/         feature-sliced logic (auth, onboarding, matching, swipe)
    lib/               supabase client, react-query client
    store/             zustand stores (session, onboarding wizard)
    theme/             color tokens, light/dark
packages/shared-types/ DB row types, enums, and zod schemas shared by app + scripts
supabase/
  migrations/          SQL migrations (schema + RLS, storage, matching RPCs)
  functions/            Edge Functions (Phase 3+)
  seed/                games.json / shows.json catalogs + generated seed.sql
scripts/
  generate-fake-profiles.ts   seeds ~50 fake profiles for local testing
  build-seed-sql.ts           regenerates supabase/seed/seed.sql from the JSON catalogs
```

## Prerequisites

- Node.js 20+, [pnpm](https://pnpm.io) (`corepack enable` or `npm i -g pnpm`)
- A [Supabase](https://supabase.com) project (free tier is fine for dev)
- Optionally the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
  if you want to run Supabase locally via Docker instead of against a hosted project
- Xcode (iOS) and/or Android Studio if you want to run on simulators; otherwise use the
  Expo Go app on a physical device

## 1. Install dependencies

```bash
pnpm install
```

## 2. Supabase project setup

1. Create a project at [supabase.com](https://supabase.com) (or run `supabase start`
   locally if you have the CLI + Docker).
2. Apply the schema. Against a hosted project, either:
   - Link and push with the CLI: `supabase link --project-ref <ref>` then
     `supabase db push`, or
   - Paste the contents of `supabase/migrations/0001_init.sql` and
     `supabase/migrations/0002_storage.sql`, in order, into the SQL Editor.
3. Seed the game/show catalogs: run `supabase/seed/seed.sql` the same way (or it runs
   automatically on `supabase db reset` for local dev, per `supabase/config.toml`).
4. In **Authentication → Providers**, enable **Apple** and **Google**, and add their
   client IDs/secrets. Email/password is enabled by default; this project intentionally
   ships with **email confirmations off** for Phase 1 so sign-up returns an active
   session immediately (needed for the age-gate DOB write and onboarding wizard) — see
   the note in `supabase/config.toml`. Revisit before a production launch.
5. Copy your project's URL and anon key (Project Settings → API) into `.env` (step 4
   below).

### Regenerating the game/show seed data

`supabase/seed/games.json` and `supabase/seed/shows.json` are the source of truth
(~550 games, ~140 shows/movies/anime). If you edit them, regenerate the SQL Supabase
actually loads:

```bash
pnpm seed:build-sql
```

## 3. RevenueCat setup (Phase 4)

Not wired up yet (lands with the premium/paywall phase), but to get ahead of it:

1. Create a RevenueCat project, add your iOS and Android apps.
2. In App Store Connect / Google Play Console, create the subscription products:
   - Monthly: `duoqueue_plus_monthly` — $7.99/month, 7-day free trial
   - Annual: `duoqueue_plus_annual` — $47.99/year
3. Copy the RevenueCat public SDK keys into `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` /
   `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
4. Point a RevenueCat webhook at the (future) `revenuecat-webhook` Edge Function once
   it's deployed, using `REVENUECAT_WEBHOOK_AUTH_TOKEN` to authenticate it.

## 4. Environment variables

```bash
cp .env.example .env
```

Then create `apps/mobile/.env` with at least:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Add the Google/Apple/RevenueCat keys from `.env.example` as you wire those up. Expo only
exposes variables prefixed `EXPO_PUBLIC_` to client code — never put the Supabase
service role key there; it belongs in the root `.env` for scripts only.

See `.env.example` for the full list and what each variable is for.

## 5. Run the app

```bash
pnpm mobile          # expo start, from the repo root
# or
cd apps/mobile && pnpm start
```

Scan the QR code with Expo Go, or press `i` / `a` for a simulator. Native-module
features that don't work in Expo Go (Apple Sign-In, in production; Google Sign-In needs
real OAuth client IDs) require a [development build](https://docs.expo.dev/develop/development-builds/introduction/)
— `npx expo prebuild` + `eas build --profile development` — once you're testing those
end-to-end.

## 6. Seed ~50 fake profiles

Requires the schema + catalog seed already applied, and a service role key:

```bash
# in the repo root .env:
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...   (Project Settings → API — keep this secret)
pnpm seed:profiles
```

This creates 50 confirmed auth users with fully filled-out profiles (photos are
placeholder storage paths, not real uploaded images) so the deck/matching phases have
data to work against.

## Development commands

```bash
pnpm typecheck   # tsc --noEmit across all workspace packages
pnpm lint        # eslint across all workspace packages
```

## Schema & security notes

- Every table has RLS enabled with no default-permissive policy — access is opt-in per
  table. See the comments in `supabase/migrations/0001_init.sql` for the reasoning
  table-by-table.
- Other users' profile data (for the deck, match cards, chat headers) is read through
  `public_profiles` / `public_profile_*` views, never the base tables directly — these
  views intentionally re-filter to active/onboarded/approved rows rather than relying on
  "the view owner bypasses RLS" alone.
- Quota- and premium-gated writes (`swipes`, `daily_swipe_counters`, `subscriptions`,
  message sends) have no client-facing INSERT/UPDATE grant at all; they're written only
  by `SECURITY DEFINER` RPCs or Edge Functions using the service role, added in later
  phases as those features are built.
- Blocking someone automatically unmatches you (trigger on `blocks`), which in turn
  revokes any shared Discord card (trigger on `matches.unmatched_at`) — enforced in the
  database, not just the client.
- `perform_swipe` and `get_deck` (`supabase/migrations/0003_matching.sql`) are the only
  way to swipe or fetch candidates — the daily free-tier quota (25/day, reset at the
  user's local midnight via their stored `timezone`) and the premium-only advanced
  filters (specific game / platform / skill level / playstyle) are both checked inside
  the RPC via an `is_premium()` helper, not left to the client to self-report. A free
  user who sends the advanced filter params anyway has them silently ignored server-side.
