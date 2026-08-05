# Secrets inventory

Every credential the system uses, where it actually lives, who needs it, and what to do
if it leaks. Written from a full scan of the working tree (see the audit summary at the
bottom for method and scope).

The one rule that sorts everything below: **if a value is read via `Deno.env.get(...)`
in a Supabase Edge Function, or via `process.env.X` in a script that only ever runs on a
developer's machine, it is server-only and must never gain an `EXPO_PUBLIC_` prefix.** If
a value is read via `process.env.EXPO_PUBLIC_*` in `apps/mobile/src`, it ships inside the
compiled app binary and must be safe for anyone to extract with a decompiler — treat it
as public the day it's created, not just the day someone leaks it.

## Server-only secrets

These never appear in `apps/mobile`, never get an `EXPO_PUBLIC_` prefix, and must stay
that way. Verified by grepping `apps/mobile` for every name below and confirming no
import path reaches them — only comments referencing the names (e.g.
`useVerifiedStats.ts`) exist client-side, never the values.

| Secret | Lives in | Used by | Who needs it |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected into every Edge Function by Supabase; local `.env` for one-off scripts | `delete-account`, `link-steam-callback`, `daily-swipes-refreshed`, `revenuecat-webhook`, `sync-verified-stats`, `send-reengagement-nudges`, `send-message`, `send-push-notification`, `moderate-photo`; `scripts/generate-fake-profiles.ts` (local dev only) | Project owner deploying functions; nobody should ever need to type it in by hand for a deployed function |
| `REVENUECAT_WEBHOOK_AUTH_TOKEN` | Supabase function secret (`supabase secrets set`) + the `Authorization: Bearer` header configured in the RevenueCat dashboard webhook | `revenuecat-webhook` (checked via `checkBearerAuth`, fails closed if unset — see `_shared/require-secret-auth.ts`) | RevenueCat dashboard admin + whoever deploys the function |
| `INTERNAL_TRIGGER_AUTH_TOKEN` | Supabase function secret **and** duplicated as the `internal_trigger_token` row in `public.app_config` (service-role/trigger-only table, no client SELECT grant — see `0006_moderation_and_notifications.sql`) | `send-push-notification`, `daily-swipes-refreshed`, `send-reengagement-nudges`, `sync-verified-stats`; the external scheduler (Supabase Cron Trigger or equivalent) that calls the two hourly/30-min functions | Whoever deploys functions + whoever configures the scheduler. **Three places must agree**, see rotation below. |
| `STEAM_WEB_API_KEY` | Supabase function secret | `link-steam-callback`, `sync-verified-stats` | Whoever deploys those functions |
| `RIOT_API_KEY` | Supabase function secret | `sync-verified-stats` | Whoever deploys that function (Riot linking flow itself isn't wired up yet, but the stats sync already reads this) |
| `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` | Supabase function secret | `moderate-photo` (via `provider.ts`) | Whoever deploys `moderate-photo`. Left unset, the function degrades to `manual-review` — photos queue for a human, never auto-approve — so this is safe to defer, not safe to fake. |
| `SUPABASE_DB_PASSWORD` | `.env.example` placeholder only | Not currently read by any script (no direct psql access exists in this project — see `scripts/db/run-sql.ps1`, which uses the Management API + CLI-stored token instead) | Reserved for future direct-DB tooling; not live |
| Supabase CLI personal access token | Windows Credential Manager only (`Supabase CLI:supabase` target) — never touches disk in this repo | `scripts/db/get-token.ps1`, and transitively `run-sql.ps1` / `apply-migration.ps1` | Whoever runs the DB scripts locally |
| Apple Sign in private key (`.p8`) | Uploaded directly to the Supabase Dashboard (Authentication → Providers → Apple) | Supabase Auth (GoTrue), managed service | Project owner; not present anywhere in this tree (confirmed — no `*.p8` file exists, and the pattern is gitignored as a backstop) |
| Google OAuth **web** client secret | Entered directly into the Supabase Dashboard (Authentication → Providers → Google) — README step 2.7 | Supabase Auth (GoTrue), managed service | Project owner; never enters this codebase. Only the three OAuth **client IDs** (not secrets — see below) live client-side, for the native/PKCE id-token flow via `expo-auth-session`. |
| Cloudflare Turnstile **secret** key | Entered directly into the Supabase Dashboard (Authentication → Settings → Bot and Abuse Protection) | Supabase Auth (GoTrue) validates the token server-side | Project owner; never enters this codebase — only the paired **site** key (public by design) ships client-side |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | `.env.example` placeholder only | Not currently referenced by any script in `scripts/` — reserved for a future offline seed-generation script | Not live; nothing to rotate today |

## Public-by-design (ship in the client — not a finding)

These are `EXPO_PUBLIC_*` and get inlined into the JS bundle at build time by Expo. That
is correct, not a leak: each one is either a public identifier that RLS/entitlement logic
backs up, or a key type its vendor explicitly designed to be embedded in a shipped app.

| Variable | Why it's safe to ship |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Just the project's REST endpoint — meaningless without valid credentials to call it |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Designed to ship in every Supabase client. Grants nothing by itself — every table/RPC is gated by RLS. Also present, correctly gitignored, in the local-only `admin/config.js` (moderation page) alongside the same anon key. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `_ANDROID_CLIENT_ID` / `_WEB_CLIENT_ID` | OAuth client IDs for public/native clients are identifiers, not secrets — Google doesn't issue a confidential secret for this flow type. The actual confidential Google secret (used server-side by Supabase for the OAuth code exchange) lives only in the Supabase Dashboard, per above. |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare's site keys are meant to be embedded in the page/app that renders the widget; the paired secret key (which validates the solve) stays server-side in Supabase's config, never here. |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `_ANDROID_API_KEY` | RevenueCat's public SDK keys, documented by RevenueCat as safe for client bundles. Server-side writes to `subscriptions` are gated by the `REVENUECAT_WEBHOOK_AUTH_TOKEN` bearer check, not by hiding this key. |
| `EXPO_PUBLIC_APP_ENV` | Just `"development"` / `"production"` — a build flag, not a credential |

## Rotation procedures

- **`SUPABASE_SERVICE_ROLE_KEY`**: Dashboard → Project Settings → API → "Reset" on the
  `service_role` secret. This invalidates the old key immediately. Every Edge Function
  gets the new value auto-injected on next invocation — no redeploy needed. Update any
  local `.env` used for one-off scripts.
- **`REVENUECAT_WEBHOOK_AUTH_TOKEN`**: generate a new token, `supabase secrets set
  REVENUECAT_WEBHOOK_AUTH_TOKEN=<new>`, then update the `Authorization` header on the
  webhook in the RevenueCat dashboard. RevenueCat retries failed deliveries, so a brief
  mismatch window during the swap self-heals rather than silently dropping events.
- **`INTERNAL_TRIGGER_AUTH_TOKEN`**: this one is duplicated by design (function secret +
  `app_config` row + external scheduler's header), so a rotation is three writes, not
  one: `supabase secrets set INTERNAL_TRIGGER_AUTH_TOKEN=<new>`, `update
  public.app_config set value = '<new>' where key = 'internal_trigger_token'`, and update
  the scheduler's `Authorization: Bearer` header. Until all three agree, the four
  internal-only functions will 401 their caller — treat this as a short maintenance
  window, not a rolling change.
- **`STEAM_WEB_API_KEY`** / **`RIOT_API_KEY`**: regenerate at the respective developer
  portal, then `supabase secrets set <NAME>=<new>`. No client-side coordination needed.
- **`SIGHTENGINE_API_USER`/`SIGHTENGINE_API_SECRET`**: regenerate in the Sightengine
  dashboard, then `supabase secrets set`. Until updated, `moderate-photo` degrades to
  `manual-review` (fails safe, never auto-approves) rather than erroring out.
- **Supabase CLI personal access token**: revoke at
  supabase.com/dashboard/account/tokens, then run `supabase login` again on any machine
  that runs `scripts/db/*.ps1` to re-populate Windows Credential Manager.
- **Apple `.p8` / Google OAuth web secret / Turnstile secret key**: all three are
  rotated entirely inside their respective dashboards (Apple Developer, Google Cloud
  Console, Cloudflare) and then re-pasted into the Supabase Dashboard's Auth Provider
  settings. None of this repo's files need to change.
- **`EXPO_PUBLIC_*` public keys** (RevenueCat SDK keys, Supabase anon key, Turnstile site
  key, Google client IDs): these aren't secrets, so "leaking" them is a non-event. If one
  needs to change (e.g. swapping a RevenueCat project), update `apps/mobile/.env` and the
  EAS per-environment variable, then rebuild — no incident-response steps required.

## Where each secret is configured, by environment

- **Local development**: root `.env` (server-side: `SUPABASE_SERVICE_ROLE_KEY`, the two
  auth tokens, provider keys — read by scripts and, for `supabase functions serve`, by
  the CLI) and `apps/mobile/.env` (client-side `EXPO_PUBLIC_*` only). Both are gitignored
  and confirmed untracked (`git check-ignore` clean, `git ls-files` has neither).
- **Supabase (hosted)**: Edge Function secrets via `supabase secrets set` — this is the
  only place `SUPABASE_SERVICE_ROLE_KEY`, `REVENUECAT_WEBHOOK_AUTH_TOKEN`,
  `INTERNAL_TRIGGER_AUTH_TOKEN`, `STEAM_WEB_API_KEY`, `RIOT_API_KEY`, and the Sightengine
  pair should exist for a deployed project. Plus the Auth Provider settings in the
  Dashboard for the Apple `.p8`, Google web client secret, and Turnstile secret key.
- **EAS (build time)**: `EXPO_PUBLIC_*` variables per build profile (development /
  preview / production, per `apps/mobile/eas.json`), configured as EAS Environment
  Variables — not hardcoded anywhere in this repo.
- **RevenueCat dashboard**: the webhook's bearer-token header (paired with
  `REVENUECAT_WEBHOOK_AUTH_TOKEN` above).
- **Local-only, gitignored**: `admin/config.js` (Supabase URL + anon key for the
  moderation page — both public-safe values; the page's real access control is
  `profiles.is_admin`, checked server-side by every RLS policy the page's queries hit).

## Audit summary (2026-08-05)

Scanned the full working tree (excluding `node_modules/` and the two parallel-track git
worktrees under `.claude/worktrees/`, which are separate checkouts, not this tree) for:
JWT-shaped strings (`eyJ...`), `sk_`/`sb_secret_` prefixes, PEM private-key blocks,
`Bearer`/`Basic` auth headers, and credentials embedded in URLs
(`scheme://user:pass@host`). Two independent passes (ripgrep via the Grep tool, scoped
per top-level directory, and a whole-tree `grep -r` as a cross-check) agree: the **only**
match anywhere in the tree is the Supabase anon key in the gitignored, untracked
`admin/config.js` — which is the public-by-design key documented above, not a finding.

Also verified:
- Every `SUPABASE_SERVICE_ROLE_KEY`, `STEAM_WEB_API_KEY`, `RIOT_API_KEY`, Sightengine, and
  webhook-token reference in `supabase/functions/` goes through `Deno.env.get(...)` — no
  literal value anywhere.
- `apps/mobile` contains zero reads of any server-only secret name — the single hit was a
  comment (`useVerifiedStats.ts:21`) naming env vars for context, not touching a value.
- No fallback pattern like `Deno.env.get("X") ?? "some-default"` exists for any actual
  secret; the three `??` fallbacks in the codebase (`APP_DEEP_LINK_SCHEME`,
  `MODERATION_PROVIDER`, `RIOT_PLATFORM`) are non-secret config, not credentials.
- `.gitignore` covers `.env`/`.env.local`/`*.env`, `admin/config.js`, and the native
  signing artifact types (`*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`). Added
  in this pass, since they'll appear once EAS build credentials are configured and
  weren't covered yet: `*.keystore`, `credentials.json`, `google-services.json`,
  `GoogleService-Info.plist`.
- Confirmed independently (not just trusting the controller's report) that git history
  contains no service-role key, webhook secret, or provider API key — same JWT/`sk_`/PEM
  patterns run across `git log -p`, zero hits beyond the documentation prose already
  identified.
