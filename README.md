# DuoQueue

A swipe-based matching app for finding gaming friends — match on shared games, shows,
and playstyle, then chat and optionally share Discord usernames.

Built as a monorepo: Expo (React Native, TypeScript, managed workflow) + Supabase
(Postgres, Auth, Realtime, Storage, Edge Functions) + RevenueCat (Apple/Google
subscriptions).

## Status

This repo implements the **full build plan, Phases 1-6**:

- Phase 1: project scaffolding, the full Postgres schema (all tables/RLS, ahead of the
  phases that consume them), Supabase Auth (email + Apple/Google) with an 18+ age gate,
  and the profile setup wizard.
- Phase 2: the swipe deck (gesture-driven card stack + like/pass buttons), the matching
  algorithm (`get_deck` RPC — ranks by shared games, shared shows, region, shared
  languages, compatible skill level), server-enforced swipe quota and mutual-like match
  creation (`perform_swipe` RPC), and the filters screen (basic filters for everyone;
  advanced filters gated server-side behind premium status, with a paywall prompt when a
  free user taps one).
- Phase 3: real-time 1:1 chat (Supabase Realtime, typing indicators, read receipts,
  text-only), the `send-message` Edge Function (profanity/abuse filter applied before
  delivery, server-enforced free-tier 5-active-conversation cap), consent-gated Discord
  sharing (`get_shared_discord_username` — the *only* way to read someone else's Discord
  username, and only after they've explicitly shared it in that match), and
  unmatch/block/report.
- Phase 4: RevenueCat subscriptions end to end — a real paywall (Monthly + Annual side
  by side, trial badge, computed savings, "Continue with Free" always visible, restore
  purchases), the `revenuecat-webhook` Edge Function keeping `subscriptions` in sync with
  purchase/renewal/cancellation/refund/billing-issue events, "who swiped right on you"
  (`get_admirers`, premium-gated, with a free teaser count via `get_admirers_count`), and
  a daily Super Ping (`send_super_ping`, premium + 1/day, reuses the swipe/match logic).
- Phase 5: push notifications (new match, new message, Super Ping, daily swipes
  refreshed) driven by Postgres triggers + `pg_net` calling `send-push-notification`, a
  per-category notification settings screen, photo moderation (`moderate-photo` — a
  pluggable NSFW-check interface with an always-approve stub; wire in a real provider
  before production) with `moderation_status` now unwritable by clients, account
  deletion (`delete-account` — wipes Storage then cascades through every table via FKs),
  and a standalone admin moderation web page (`admin/index.html`) for triaging reports.
- Phase 6: polish — pulsing loading-skeleton placeholders (deck, matches, chat,
  admirers, paywall) in place of bare spinners, visible error states with retry on every
  major data-fetching screen, an offline banner backed by real network detection
  (`@react-native-community/netinfo`, wired into react-query's online manager so queries
  pause/resume with connectivity), a theme-aware status bar, entrance animations on the
  match celebration screen, and empty/no-results states for the chat thread and the
  onboarding game/show search.

## Repo layout

```
apps/mobile/         Expo app (TypeScript, expo-router)
  app/                file-based routes: (auth), (onboarding), (tabs), chat, filters,
                       admirers, match/[matchId], paywall
  src/
    components/       shared UI (Button, TextField, ChipSelect, ScreenContainer,
                       Skeleton, OfflineBanner)
    features/         feature-sliced logic (auth, onboarding, matching, swipe, chat,
                       premium, settings)
    lib/               supabase client, revenuecat config, push notifications,
                       react-query client, storage helper
    store/             zustand stores (session, onboarding wizard)
    theme/             color tokens, light/dark
packages/shared-types/ DB row types, enums, and zod schemas shared by app + scripts
admin/index.html      standalone moderation queue web page (vanilla JS, no build step)
supabase/
  migrations/          SQL migrations (schema + RLS, storage, matching/chat/premium/
                       moderation RPCs and notification triggers)
  functions/            Edge Functions — send-message, revenuecat-webhook,
                        send-push-notification, moderate-photo, delete-account,
                        daily-swipes-refreshed
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
   - Paste the contents of each file in `supabase/migrations/`, in filename order
     (0001, 0002, ...), into the SQL Editor.
3. Seed the game/show catalogs: run `supabase/seed/seed.sql` the same way (or it runs
   automatically on `supabase db reset` for local dev, per `supabase/config.toml`).
4. Deploy the Edge Functions: `supabase functions deploy <name>` for each of
   `send-message`, `revenuecat-webhook`, `moderate-photo`, `delete-account`,
   `send-push-notification`, and `daily-swipes-refreshed`. All of them get
   `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` injected automatically.
   `revenuecat-webhook` additionally needs `REVENUECAT_WEBHOOK_AUTH_TOKEN` (step 3
   below), and `send-push-notification`/`daily-swipes-refreshed` need
   `INTERNAL_TRIGGER_AUTH_TOKEN` — set both with `supabase secrets set KEY=value`.
   Those three refuse to start without their secret rather than running unauthenticated.

   `moderate-photo` takes `MODERATION_PROVIDER` (`sightengine` or `manual-review`) plus
   `SIGHTENGINE_API_USER`/`SIGHTENGINE_API_SECRET` when set to `sightengine`. Left unset
   it behaves as `manual-review`: photos are never auto-approved, they queue for a human.
5. Enable push + swipe-refresh notifications: insert your project's own values into
   `app_config` (no client can read this table — service-role/trigger-only, see
   0006_moderation_and_notifications.sql) via the SQL Editor:
   ```sql
   insert into public.app_config (key, value) values
     ('edge_function_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
     ('internal_trigger_token', '<same value as INTERNAL_TRIGGER_AUTH_TOKEN>');
   ```
   Then set up something to call `daily-swipes-refreshed` hourly with
   `Authorization: Bearer <INTERNAL_TRIGGER_AUTH_TOKEN>` — a Supabase Cron Trigger
   (Dashboard → Edge Functions → your function → Cron) or any external scheduler works.
   New-match/new-message/Super-Ping pushes need no scheduler; they fire immediately via
   DB triggers.
6. Make yourself an admin (for the moderation page at `admin/index.html`):
   `update public.profiles set is_admin = true where id = '<your-user-id>';`
7. In **Authentication → Providers**, enable **Apple** and **Google**, and add their
   client IDs/secrets. Email/password is enabled by default.

   **Email confirmation is a hosted-project setting that `supabase/config.toml` cannot
   express** — that file only configures `supabase start`. There is no `config push` in
   any script or workflow here, so the Dashboard is edited by hand. To turn confirmation
   on for a real deployment, all of the following, in order:

   - **Authentication → Emails → SMTP Settings**: custom SMTP is mandatory. The built-in
     mailer is capped around 2 emails/hour and only delivers to team addresses, so
     sign-ups fail with `over_email_send_rate_limit` without it. For Resend: host
     `smtp.resend.com`, port `465`, username the literal `resend`, password a Resend API
     key, sender an address on a domain **verified in Resend** (unverified accounts can
     only mail the account owner).
   - **Authentication → Rate Limits**: raise emails/hour. Supabase only allows this once
     custom SMTP is live.
   - **Authentication → Email Templates → Confirm signup**: paste
     `supabase/templates/confirmation.html`. It must keep `{{ .Token }}` and must not
     gain a `{{ .ConfirmationURL }}` — the app confirms with a typed 6-digit code, and a
     mail scanner pre-fetching a link would silently consume the single-use token.
   - **Authentication → Providers → Email → Confirm email = ON**. Do this last, and only
     against an app build that includes `app/(auth)/confirm-email.tsx` — otherwise users
     receive a code with nowhere to enter it.

   Verify with a fresh address on a domain you don't control (not a team address, and not
   `pnpm seed:profiles`, whose users are created with `email_confirm: true` and so prove
   nothing about the real signup path).
8. Copy your project's URL and anon key (Project Settings → API) into `.env` (step 4
   below), and into the placeholders at the top of `admin/index.html` if you'll use the
   moderation page.

### Regenerating the game/show seed data

`supabase/seed/games.json` and `supabase/seed/shows.json` are the source of truth
(~550 games, ~140 shows/movies/anime). If you edit them, regenerate the SQL Supabase
actually loads:

```bash
pnpm seed:build-sql
```

## 3. RevenueCat setup

1. Create a RevenueCat project, add your iOS and Android apps.
2. In App Store Connect / Google Play Console, create the subscription products and an
   entitlement (named `premium`) attached to all four:
   - Weekly: `duoqueue_plus_weekly` — $4.99/week
   - Monthly: `duoqueue_plus_monthly` — $7.99/month, 7-day free trial
   - 3 Months: `duoqueue_plus_3mo` — $17.99/3 months
   - 6 Months: `duoqueue_plus_6mo` — $29.99/6 months
   In RevenueCat, add all four as packages (`$rc_weekly` / `$rc_monthly` / `$rc_three_month`
   / `$rc_six_month`) in your default Offering — the app reads `offering.weekly` /
   `.monthly` / `.threeMonth` / `.sixMonth`, shows whatever price/trial RevenueCat returns
   rather than hardcoding them, and computes each tier's "Save X%" badge from
   `pricePerWeek` relative to the weekly plan.
3. Also create two non-subscription (consumable) products, in the same `default`
   Offering as custom packages so `offering.availablePackages` includes them:
   - `duoqueue_boost_1` — one Power-Up (30 minutes near the top of other people's decks)
   - `duoqueue_roses_3` — three Legendary Likes (an extra-visible like sent to someone specific)
   These do **not** get the `premium` entitlement — the webhook (see step 5) detects
   their product ids via `CONSUMABLE_GRANTS` in
   `supabase/functions/revenuecat-webhook/mapping.ts` and grants credits instead of
   touching `subscriptions`. Update that map if you rename or add consumable products.
4. Copy the RevenueCat public SDK keys into `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` /
   `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. The app calls `Purchases.configure` with the
   signed-in Supabase user's id as the RevenueCat `app_user_id` (see
   `src/lib/revenuecat.ts`), so the webhook can write straight to
   `subscriptions.profile_id` with no separate id-mapping step.
5. In RevenueCat, add a Webhook (Project Settings → Integrations → Webhooks) pointing at
   your deployed `revenuecat-webhook` function URL
   (`https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`). Set an
   `Authorization: Bearer <token>` header there, and set that same token as
   `REVENUECAT_WEBHOOK_AUTH_TOKEN` via `supabase secrets set
   REVENUECAT_WEBHOOK_AUTH_TOKEN=<token>` before deploying the function.
6. Testing purchases requires a sandbox tester (iOS) or license tester (Android) account
   — this can't be exercised in a simulator/emulator without one.

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
real OAuth client IDs; push notifications, which also need a real EAS project via
`eas init` before a token can be issued at all) require a
[development build](https://docs.expo.dev/develop/development-builds/introduction/)
— `npx expo prebuild` + `eas build --profile development` — once you're testing those
end-to-end. Push notifications also require a physical device (no simulator/emulator
support).

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
- Messages have no client INSERT grant at all (`supabase/migrations/0004_chat.sql`) —
  every send goes through the `send-message` Edge Function, which re-validates match
  participation, applies the profanity/abuse filter, and checks
  `is_conversation_unlocked()` (the free-tier 5-concurrent-conversation cap, ranked by
  most recent activity) before writing with the service role. Read receipts use a
  column-level grant (`grant update (read_at) on messages`) so a client can mark
  messages read without ever being able to touch `content` or `sender_id`.
- A Discord username is never exposed in bulk or via any view — the *only* read path is
  `get_shared_discord_username(match_id, shared_by)`, which re-checks a non-revoked
  share exists for that exact match before returning anything, every call.
- `subscriptions` is written only by the `revenuecat-webhook` Edge Function (service
  role) — the client SDK's local purchase state is used for immediate UI feedback after
  a purchase, but every server-side premium check (`is_premium()`, used by `get_deck`,
  `perform_swipe`, `send-message`, `send_super_ping`, `get_admirers`) reads the
  `subscriptions` table, never anything the client asserts about itself. There's a brief
  eventual-consistency window right after a purchase (until the webhook lands) where
  server-enforced limits may not yet reflect a just-completed purchase; this is a known,
  accepted RevenueCat+Postgres integration tradeoff, not a bug.
- `get_admirers` (who swiped right on you) returns real profile rows only for premium
  callers — a free caller gets zero rows back, not an error, so the same query safely
  powers both the paywall teaser and the real feature. `get_admirers_count()` is a
  separate, ungated function that only ever returns a number, never profile data, so the
  free-tier teaser count can't be used to leak who liked you.
- `profile_media.moderation_status` has no client write path at all (a blanket UPDATE
  grant in 0001_init.sql was narrowed to `(storage_path, "position")` in
  0006_moderation_and_notifications.sql once photo moderation existed) — only the
  `moderate-photo` Edge Function, using the service role, can flip a photo from
  `pending` to `approved`/`rejected`. Its actual NSFW check
  (`supabase/functions/moderate-photo/provider.ts`) is a stub that always approves —
  wire in a real provider before a production launch; the admin moderation queue is the
  manual-review backstop either way.
- `app_config` and `swipe_refresh_notifications` have no grants to `authenticated`/`anon`
  at all (not even RLS — there's no privilege to query them via the API); they're
  read/written only by `SECURITY DEFINER` functions running as the table owner, same
  pattern as `daily_swipe_counters`.
- The admin moderation page (`admin/index.html`) is a plain static file — no auth beyond
  a normal Supabase sign-in gated by `profiles.is_admin`, checked via the same RLS the
  database itself enforces (`reports_select_admin`, `profiles_select_admin`,
  `messages_select_admin` in 0006). There's no self-service way to become an admin; it's
  a manual `update profiles set is_admin = true` by an operator.

## Before a production launch

Things this repo deliberately leaves as clearly-marked stubs or manual setup steps,
rather than faking:

- **Photo moderation needs a Sightengine account to run automatically.** The provider is
  implemented (`supabase/functions/moderate-photo/provider.ts`); it just needs
  credentials. Until `MODERATION_PROVIDER=sightengine` plus `SIGHTENGINE_API_USER` and
  `SIGHTENGINE_API_SECRET` are set, every uploaded photo is routed to the admin review
  queue instead of being checked. That is a deliberate fail-safe: there is no
  approve-everything mode, so a missing key can never silently publish unreviewed photos
  — it can only create a manual-review backlog, which is visible.
- **Push notifications** need `eas init` for a real EAS project id, a physical device to
  test on, and someone to actually schedule `daily-swipes-refreshed` (a Supabase Cron
  Trigger or any external scheduler) — see README setup step 5.
- **RevenueCat / in-app purchases** need real App Store Connect / Play Console products,
  a RevenueCat project wired to them, and a sandbox/license tester account — purchases
  can't be exercised in a simulator.
- **Apple / Google sign-in** need real provider credentials configured in Supabase Auth
  and (for Apple) a real Apple Developer account; neither works in Expo Go.
- **Email confirmation is built but not switched on in the hosted project.** The app
  side is done — `signUp()` handles a null session, `app/(auth)/confirm-email.tsx` takes
  a 6-digit code, and `0028_require_verified_email.sql` is the in-database backstop — and
  local dev exercises it via `config.toml` + Inbucket. What remains is operational: a
  sending domain verified with an email provider, custom SMTP configured in the
  Dashboard, the raised rate limit, the template pasted in, and then the toggle. Until
  that's done, anyone can register under someone else's address and `0028`'s gate is
  vacuous, because Supabase stamps `email_confirmed_at` at signup when confirmation is
  off. See setup step 7 for the ordered checklist.
- **Account deletion cascades reports filed against the deleted user, not just their own
  data.** That's the literal reading of "fully removes personal data," but a production
  trust & safety process might prefer retaining anonymized report records to prevent a
  report-then-delete evasion pattern — worth a deliberate product decision, not an
  oversight.
