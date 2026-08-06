# DuoQueue — App Store Submission Guide

Your working document for the first iOS submission. Work through it top to bottom — it's
ordered so nothing blocks on something later in the file. Rewritten 2026-08-06 against the
live code, the live site, and the live Supabase project (not from memory of an earlier draft).

**How to use this**: skip Part 0 only if you've read it before. Do Part 1 in order — every
numbered step says where it happens and about how long it takes. Part 2 is paste-ready copy
for App Store Connect fields. Part 3 is the privacy label table. Part 4 is App Review notes.
Part 5 is the pre-submit checklist. Do that checklist last, right before you tap Submit.

---

## Part 0 — What's already done (you do not need to redo any of this)

- **Legal pages are live.** `https://duoqueue.io/privacy` and `https://duoqueue.io/terms`
  are real, published pages (built by `scripts/build-site.mjs` from `docs/legal/*.md`,
  served from GitHub Pages, DNS pointed at `duoqueue.io`). `apps/mobile/src/lib/legal.ts`
  already points at both URLs and is read by every screen that links to them (Settings,
  sign-up, paywall) — nothing to edit there.
- **Email works both directions.** `support@duoqueue.io` is a real paid mailbox (NEO), and
  outbound signup/confirmation email goes through Resend (SMTP configured on the hosted
  Supabase project, DKIM/SPF/DMARC verified). Nothing to configure.
- **The security + legal audit is closed.** Every finding from the 2026-08-04 audit (2
  Critical, 3 High, 6 Medium, 4 Low) is fixed and verified live, including the two most
  App-Review-relevant ones: blocking is enforced server-side everywhere (chat, profile
  views, storage), and photo moderation runs on real Sightengine credentials, not a stub.
- **The demo/App Review account exists and is seeded.** See Part 1.5 below — credentials,
  what the reviewer sees, and the post-launch removal command all live there.
- **The app is built.** `eas login` / `eas init` are already done — `apps/mobile/app.json`
  has a real `extra.eas.projectId` (`a5069e29-0e9b-4c9c-87a3-e4f1f6ae0837`), so push-token
  registration is unblocked and you can run `eas build` directly (see Part 1A step 4).
- **The paywall's auto-renewal disclosure is already written.** An earlier pass flagged this
  as missing; it isn't anymore. `apps/mobile/app/paywall.tsx` (right above the Terms/Privacy
  links, citing Guideline 3.1.2 in a code comment) states plainly that DuoQueue+ auto-renews,
  what it charges, the 24-hour cancellation window, and where to cancel. No code change needed.
- **Dating-pattern language is purged and quality gates are green.** "Who liked you" → "who
  wants to duo," heart iconography → game-controller icons, gender-based match filtering
  removed entirely, mic permission removed (app only requests photo library/camera/
  notifications). `pnpm typecheck`, `pnpm lint`, and `pnpm audit:contrast` (56/56 WCAG pairs,
  both color schemes) all pass clean.
- **No analytics SDK, no ad SDK, no crash-reporting SDK.** Confirmed via `package.json` in
  both the root and `apps/mobile` — nothing to disclose as tracking, and the privacy table in
  Part 3 doesn't need a Diagnostics row.
- **Auth is email-only**, so Guideline 4.8 (Sign in with Apple parity) doesn't apply — the
  social-login code paths are flag-disabled. Leave them off.

---

## Part 1 — What you still have to do

### 1.5 — The demo / App Review account (read this before Part 1A)

Every "make sure the reviewer sees a working app" step below already happened. Live on the
hosted project right now:

```
Email:    review@duoqueue.io
Password: ipTH0uV9uRfA9O2xsg7eb6WH
```

This account is pre-confirmed (no CAPTCHA, no email OTP) and fully onboarded. Signing in
shows: a populated deck of 13 fresh demo profiles, one existing match (Priya) with an
8-message conversation and an unread badge, and 3 inbound "who wants to duo" requests
(Marcus, Kofi, Bea). Every demo row is flagged `is_demo = true` and gated server-side across
8 RPCs and 14 views — real users (verified live, adversarially, across every discovery
surface) see zero of it, and the reviewer's account is invisible to them too. Photos are
abstract generated art (`scripts/generate-demo-avatars.mjs`), never a real or AI-generated
face.

Re-running the seed script is safe any time — it's idempotent and won't duplicate anything:

```
node scripts/seed-review-demo.mjs
```

**Once App Review is done and the app is live, remove it:**

```
node scripts/seed-review-demo.mjs --remove
```

This deletes the review account and all 14 demo profiles (games, shows, prompts, matches,
messages, storage objects) via cascade, verified to return counts to exactly the pre-seed
baseline. Do this after launch, not before — there's no reason to keep it running once
review is over, even though real users can never see it.

### 1A — On your machine (terminal / code)

1. **Fill in the legal docs' own remaining TODOs.** `docs/legal/privacy-policy.md` and
   `terms-of-service.md` are lawyer-review drafts — most blanks are already filled (entity:
   Cameron Shaw Stallings, sole proprietor; effective date 2026-08-05; contact
   `support@duoqueue.io`; address 201 N Becket St, Cary, NC 27513), but get an actual lawyer
   to check them before you're taking real payments, especially the arbitration clause and
   the DOB-collection language. *~30 min to re-read, longer if you loop in counsel.*

2. **Decide on onboarding gender collection.** Nothing reads `gender` as a match filter
   anymore. You can leave it collected (future safety/reporting use) or drop the onboarding
   step — either is fine, neither is a rejection risk. Not blocking; make the call whenever.
   *5 min decision, follow-up code task if you drop it.*

3. **Set real RevenueCat keys** in `apps/mobile/.env`. You're currently on Test Store keys
   for both platforms:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_USellzJPMsFdonmYETFPHqsvWOu
   EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=test_USellzJPMsFdonmYETFPHqsvWOu
   ```
   Swap the iOS key for the real one once the RevenueCat/App Store Connect product wiring in
   Part 1B is done — this depends on that work, not the other way around. *2 min once the key
   exists.*

4. **Build**: `eas build --profile production --platform ios`. Requires your Apple Developer
   account to be approved (Part 1B step 1) first. Test the resulting build on a real device
   on an IPv6-mostly network (most US cellular networks qualify) before submitting — Apple
   requires this, and it's an easy last-minute rejection if anything silently assumes IPv4.
   *Build itself: 15-30 min on EAS's servers. Device test: 15 min.*

### 1B — In a browser (App Store Connect, RevenueCat, App Store Connect banking)

Do step 5 and step 6 *first* — both are slow-moving approvals that block everything after
them, so start them even before you've finished 1A.

5. **Apple Developer Program enrollment** ($99/year), if not already done. Approval can take
   24-48 hours. *10 min to start, 1-2 days to clear.*

6. **Accept the Paid Applications Agreement** — App Store Connect → Business → Agreements,
   Tax, and Banking. This is separate from the free Developer Program License Agreement you
   accept to enroll, and it requires its own acceptance plus completed banking and tax forms
   (yes, even as a US sole proprietor with no company entity). **No subscription or
   consumable can be created, tested in sandbox, or submitted until this is signed and
   complete** — it's the single most common reason a first submission's IAPs get stuck,
   usually with no error message pointing at the real cause. *15 min to fill out, 1-2 days to
   process — start this alongside step 5, not after it.*

7. **Create the App Store Connect app record** for bundle id `com.duoqueue.app`. *5 min.*

8. **App Information tab**: paste `https://duoqueue.io/privacy` as the Privacy Policy URL.
   Set a Support URL — a bare `mailto:support@duoqueue.io` is commonly accepted, or use a
   simple hosted contact page if you'd rather. *5 min.*

9. **Paste the store listing copy** from Part 2 below (name, subtitle, keywords, promotional
   text, description, what's new). *10 min.*

10. **App Privacy (nutrition label)**: enter the table in Part 3 directly — it maps to
    Apple's exact category names. *10 min.*

11. **Age Rating questionnaire**: answer per the guidance in Part 3.5. Expect the top band
    (17+ on the old scale / 18+ on the new one) — that's correct for this app, not a defect.
    *5 min.*

12. **Export compliance**: answer "No" (the app uses only exempt encryption — HTTPS/TLS plus
    a local AES wrapper around the cached auth token, both squarely inside the standard
    exemption). `ITSAppUsesNonExemptEncryption: false` is already set in `app.json`, so this
    should just confirm what the build already declares. *2 min.*

13. **RevenueCat + App Store Connect product setup** — the full walkthrough is Part 2.5
    below (products, subscription group, entitlement, offering wiring). This has to be done
    before Part 1A step 3 (real key) and before submitting, since subscriptions go out with
    your first binary, not after. *45-60 min total, spread across ASC and RevenueCat.*

14. **App Review Information**: paste the demo credentials from Part 1.5 and the review
    notes from Part 4. *5 min.*

15. **Attach screenshots.** See Part 2.6 for the shot list and sizing — capture these with
    Expo Go any time before this step, no build required (skip the paywall shot until you
    have a real build with real products, per step 13). *Capture: 20-30 min. Upload: 10 min.*

16. **Submit for Review.**

---

## Part 2 — Paste-ready store listing copy

Every line below matches real, shipping UI copy — checked against the actual screens, not
the feature brief. Where a draft offered several options, one is picked as the default;
alternates are kept underneath, clearly marked, in case you'd rather use them.

### 2.1 App Name (30 char max) — use this:

```
DuoQueue: Gaming Partners
```
25 characters. Reads as unambiguously platonic to any reader, no risk of misreading.

**Alternates**, if you want to lean harder into the anti-dating framing:
- `DuoQueue: Platonic Gaming` (25 chars) — says it outright, no inference needed.
- `DuoQueue - Not for Dating` (25 chars) — the boldest option; pre-empts a reviewer's
  pattern-match by naming and denying it in five words. Matches the app's dry tone well, but
  is the one most likely to make a human reviewer stop and read closely — arguably a feature
  given the swipe mechanic, but your call.

### 2.2 Subtitle (30 char max) — use this:

```
Find your next co-op duo
```
24 characters. Paired with the Name above, this covers distinct indexed vocabulary ("Gaming
Partners" + "co-op duo") rather than repeating the same words across both fields.

**Alternates**: `Not dating. Just gaming.` (24 chars) · `Teammates, not dates` (20 chars)

### 2.3 Keywords (100 char max) — use this:

```
coop,squad,lfg,esports,streaming,anime,playstyle,ranked,crossplay,steam,voice chat,safe,verified
```
96/100 characters. Deliberately has zero overlap with the Name/Subtitle above (Apple indexes
those separately, so repeating "gaming," "duo," or "partners" here wastes budget). "Steam" is
included because DuoQueue genuinely links Steam accounts for verified stats — legitimate
feature keyword, not trademark-stuffing.

### 2.4 Promotional Text (170 char max) — use this:

```
DuoQueue finds you a duo, not a date. Match on games, shows, and playstyle, then chat and play. Party mode lets a friend join the swiping. Now live.
```
148/170 characters. This field is editable without a new build — it's meant to be your
literal launch-day line.

### 2.5 Description (4000 char max) — use this:

1,792 characters.

```
DuoQueue is not a dating app. It's how you find people to actually play with — a duo for co-op, a fourth for the raid, someone equally deep into the same show. No looks-first swiping, no gender filters. Just shared games, shows, and playstyle.

Your deck shows people matched on what you're both into: favorite games (skill level, rank if you've got one), shows you watch, playstyle — casual, competitive, ranked grinder — and when you're usually online. Swipe to say you'd duo. Mutual swipe, you match, chat opens up.

Want a third? Party mode lets you and a match invite someone else in. Everyone swipes on the same profile, and it takes a unanimous yes before that person's invited to join.

From there it's yours to run: chat in-app, share a Discord username, add each other on Steam. DuoQueue gets you to "let's play" — it doesn't run the session for you.

Safety, for real: everyone's 18+, verified at signup. Every profile photo is automatically screened before anyone else sees it. Report or block from a profile or a chat — blocking is immediate and complete, a blocked user can't see your profile again. A hidden-word filter mutes messages containing words you pick. A Safety Center covers meetup safety, scam patterns, and community guidelines.

DuoQueue+ is optional. It removes the daily swipe and conversation limits, adds filters for a specific game, platform, skill level, and playstyle, shows everyone who wants to duo at once instead of a daily trio, and gives you a Super Ping a day to jump the queue. Weekly, monthly, 3-month, and 6-month plans, all auto-renewing until you cancel in your App Store account settings. Power-Ups and Legendary Likes are separate one-time purchases for extra visibility. Free users get full use of DuoQueue; DuoQueue+ just removes the limits.
```

The description's Steam-linking claim was double-checked against the live project on
2026-08-06 and it holds: `STEAM_WEB_API_KEY` **is** set as a Supabase function secret, both
functions that use it (`link-steam-callback`, `sync-verified-stats`) are deployed and ACTIVE,
and the six-hourly resync cron from migration 0058 is scheduled. Invoking the deployed
function returns `{"steam":{"linked":0,...},"riot":"skipped"}` — Steam ran, Riot correctly
skipped (no Riot key, deliberate). One honest caveat: `linked: 0` means no Steam account has
been linked yet, so the key's *presence* is proven but a real round-trip to Steam's API has
never been exercised. If you want certainty before review, link your own Steam account once
from Settings → Connections and confirm the badge appears.

### 2.6 What's New (1.0 release text) — use this:

353 characters.

```
First release. Match on shared games, shows, and playstyle, then chat and figure out when to play. Party mode lets you and a match invite a third — everyone has to swipe yes before that person joins. Link Steam for a verified stats badge. DuoQueue+ is available for unlimited swipes, unlimited conversations, and a daily Super Ping. Tell us what breaks.
```

### 2.7 Screenshots — shot list

Sizing: Apple's mandatory bucket is **1320 × 2868 px** (6.9″ display, portrait) — upload one
set at this size and App Store Connect auto-generates every smaller iPhone size from it, no
separate capture needed. If your phone isn't a 16 Pro Max, shoot at native resolution and
uniformly resize up (no cropping) — any Face-ID iPhone shares close to the same aspect ratio,
so there's no visible distortion. An iPhone SE is a genuinely different aspect ratio; don't
stretch a shot from one.

**Capture now, no build needed**: sign in to Expo Go as `review@duoqueue.io` (Part 1.5) and
screenshot the normal iOS way. Skip the paywall screen in this pass — `react-native-purchases`
no-ops inside Expo Go, so it'll show a fallback "Plans aren't available" state instead of real
pricing. Grab that one shot later from a real build once Part 1B step 13 is done.

Six shots, in this order (order matters — the first is what search results show):

1. **Deck** (`app/(tabs)/index.tsx`) — the front swipe card, games/show chips visible.
   *"Matched on shared games, shows, and playstyle — swipe to duo up."*
2. **Own profile** (`app/(tabs)/profile.tsx`) — the bento grid: games, schedule, vibe, prompts.
   *"Your profile is your gamer card — games, playstyle, and vibe."*
3. **Requests** (`app/admirers.tsx`) — the three seeded rows with the "Duo Up" button.
   *"People who want to duo with you. Say Duo Up if you're in."*
4. **Match moment** (`app/match/[matchId].tsx`) — "DUO LOCKED" headline.
   *"Duo locked. Time to plan a session."*
5. **Chat** (`app/chat/[matchId].tsx`, open Priya) — the seeded 8-message conversation.
   *"Chat to lock in a time — no small talk required."*
6. **Matches list** (`app/(tabs)/matches.tsx`) — sectioned list with Priya's unread badge.
   *"Every duo in one place, sorted by whose turn it is to reply."*

All six are already 4+-safe (Guideline 2.3.8 applies to screenshots regardless of the app's
own age rating) — demo photos are abstract generated art, no faces, and all seeded chat/bio
content is PG. If you swap in different content later, keep that constraint in mind.

---

## Part 2.5 — RevenueCat + App Store Connect product setup

Do this after Part 1B step 6 (Paid Applications Agreement) clears — nothing here works until
it does.

**Products to create in App Store Connect** (product IDs are fixed in code for the two
consumables; subscription IDs below match what's already documented in `README.md`):

| Type | Reference name | Product ID | Suggested price |
|---|---|---|---|
| Auto-renewable subscription | DuoQueue+ Weekly | `duoqueue_plus_weekly` | $4.99 / week |
| Auto-renewable subscription | DuoQueue+ Monthly | `duoqueue_plus_monthly` | $7.99 / month |
| Auto-renewable subscription | DuoQueue+ 3-Month | `duoqueue_plus_3mo` | $17.99 / 3 months |
| Auto-renewable subscription | DuoQueue+ 6-Month | `duoqueue_plus_6mo` | $29.99 / 6 months |
| Consumable | Power-Up (1) | `duoqueue_boost_1` | $3.99 |
| Consumable | Legendary Likes (3-Pack) | `duoqueue_roses_3` | $5.99 |

Display Name / Description (Display Name ≤30 chars, Description ≤45 chars — same benefit
copy across all four subscription durations):

| Product | Display Name | Description |
|---|---|---|
| `duoqueue_plus_weekly` | DuoQueue+ Weekly | Unlimited swipes, duo requests, Super Ping |
| `duoqueue_plus_monthly` | DuoQueue+ Monthly | Unlimited swipes, duo requests, Super Ping |
| `duoqueue_plus_3mo` | DuoQueue+ 3-Month | Unlimited swipes, duo requests, Super Ping |
| `duoqueue_plus_6mo` | DuoQueue+ 6-Month | Unlimited swipes, duo requests, Super Ping |
| `duoqueue_boost_1` | Power-Up | Jump near the top of the deck for 30 minutes |
| `duoqueue_roses_3` | Legendary Likes (3) | 3 extra Legendary Likes to send right away |

**Put all four subscriptions in one Subscription Group** (name it "DuoQueue+"). This isn't
optional — it's what lets a user switch durations from their device Settings instead of
stacking two active subscriptions and double-billing, and Guideline 3.1.2(b) specifically
checks for this. Do **not** put the two consumables in the group.

- **Subscription Group Display Name**: "DuoQueue+" (what the user sees in their own device's
  subscription management screen).
- **Localization**: `en-US` only — the app is English-only.
- **Review screenshot**: ASC requires one attached before you can submit any IAP for the
  first time on a new app. Reuse the paywall screenshot from Part 2.7 once you have it from a
  real build (attach it to all six products to keep things simple).

**In RevenueCat:**

1. Add your real iOS app, connect it to App Store Connect (generate an App Store Connect API
   Key in ASC → Users and Access → Integrations, role "App Manager"; upload it under
   RevenueCat → Project Settings → Apple App Store).
2. **Products** tab — create all six products by pasting each App Store Connect product ID;
   RevenueCat pulls metadata automatically once the key is connected.
3. **Entitlements** — create one entitlement named exactly `premium` (the webhook already
   defaults new subscription rows to this name), attach all four subscription products to it.
   Do **not** attach the two consumables to any entitlement — the webhook handles those by
   product ID directly.
4. **Offerings** → your default Offering → add six packages: the four subscriptions attached
   via RevenueCat's **standard package type** picker (Weekly / Monthly / 3 Month / 6 Month —
   this is what makes `offering.weekly` etc. resolve in the app; attach to the wrong slot and
   that tier silently vanishes from the paywall, no error), and the two consumables as custom
   packages (matched by product ID in code, so the package identifier itself can be anything).
5. **Swap the key** — copy the real public SDK key from RevenueCat → Project Settings → API
   Keys → Apple App Store into `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (Part 1A step 3). Leave
   Android on the Test Store key until you launch there.

The RevenueCat webhook itself is already deployed and configured against the live Supabase
project — nothing to do there.

---

## Part 3 — App Privacy (nutrition label) answers

Enter these under App Store Connect → App Privacy. "Linked to identity" is Apple's
definition (tied to a user account, not necessarily shown publicly). Nothing here is used
for tracking — confirmed against `package.json`: no ad SDK, no analytics SDK, no
cross-app/cross-site tracking of any kind exists in this codebase. Verified against the
actual schema (`supabase/migrations/0001_init.sql` and `0025_linked_accounts.sql`), not just
carried over from an earlier draft.

| Data type | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|
| Email Address | Yes | No | App Functionality (account creation, login, email confirmation) |
| Display Name | Yes | No | App Functionality (profile identity shown to other users) |
| Photos | Yes | No | App Functionality (profile photos, moderated before display) |
| Other User Content — bio, prompts, game/show/playstyle preferences | Yes | No | App Functionality (profile content, matching) |
| Other User Content — chat messages (1:1 and party) | Yes | No | App Functionality (core messaging feature) |
| Date of Birth | Yes | No | App Functionality (18+ age gate, legally required) |
| Gender (onboarding only, no longer used for filtering) | Yes | No | App Functionality (profile display / future safety use) |
| Discord Username | Yes | No | App Functionality (optional, user-shared contact handle for outside-app contact) |
| Linked Account Identifiers — Steam ID, display name, rank, playtime | Yes | No | App Functionality (optional verified-stats badge) |
| Push Notification Token | Yes | No | App Functionality (match/message alerts, re-engagement nudges — user-controlled per-type toggles) |
| User ID (internal account identifier) | Yes | No | App Functionality (account system, RevenueCat purchase linkage) |
| Purchase History | Yes | No | App Functionality (subscription/consumable entitlement) |
| Reports & Blocks (who reported/blocked whom, and why) | Yes | No | App Functionality (Trust & Safety, abuse prevention) |

**Not collected** — do not add these: Precise Location, Coarse Location, Contacts, Browsing
History, Search History, Health & Fitness, Financial Info, Advertising Data, Crash/Performance
Diagnostics (no crash reporting SDK is integrated — if you add Sentry or similar later,
revisit this table).

### 3.5 Age Rating questionnaire — answers

Apple computes the numeric rating from these; you don't pick it directly. The single biggest
driver here isn't any content toggle — it's that this app has unmoderated-in-the-moment
user-to-user messaging (1:1 and party chat). Answer honestly and expect the top band (17+ old
scale / 18+ new scale); that's correct for this app category, not a defect, and understating
it is itself a risk if Apple's own review disagrees.

| Question | Answer |
|---|---|
| Cartoon/Realistic/Prolonged Graphic Violence | None |
| Sexual Content or Nudity | None (photos are auto-screened for nudity pre-publish; chat is text-only) |
| Profanity or Crude Humor | Infrequent/Mild (free-text chat between real users — hence the hidden-word filter and masking) |
| Alcohol, Tobacco, or Drug Use/References | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes, Medical/Treatment Info, Contests | None |
| Gambling (Simulated) | None (Power-Ups/Legendary Likes are fixed-price, fixed-content — no loot-box mechanic) |
| Unrestricted Web Access | No (only fixed known URLs — your own Privacy/Terms pages — via `expo-web-browser`) |
| User-Generated Content | Yes (bios, prompts, chat) |
| User-to-user communication with people you don't already know | Yes, frequent (this is the core feature and the field most likely to drive the rating to the top band — expected, correct) |
| Made for Kids / Kids Category | No — do not opt into this under any circumstance |

The app enforces the matching gate in code: `(auth)/age-gate.tsx` requires a DOB at least
`MIN_AGE` (18, `packages/shared-types/src/profile.ts:16`) years in the past before sign-up
can proceed, and the date picker's maximum selectable date is computed from that same
constant, so there's no way to even enter a disqualifying DOB.

### 3.6 Export compliance

Answer **No** (app uses only exempt encryption) — `ITSAppUsesNonExemptEncryption: false` is
already set in `app.json` and is correct. The app's only two crypto uses are both inside the
standard Category 5 Part 2 exemption: all network traffic is HTTPS/TLS (OS-provided, exempt
by definition), and `aes-js` is used exactly once, client-side, to wrap the cached Supabase
auth session token before it's written to `AsyncStorage` (`apps/mobile/src/lib/supabase.ts`,
`LargeSecureStore`) — a standard unmodified algorithm, used only to protect locally-stored
data, never networked. This means you don't owe a self-classification report for this build.
Revisit this answer if a future release adds any cryptography beyond HTTPS + this local wrapper.

---

## Part 4 — Draft App Review notes (paste into App Review Information → Notes)

Edit the one bracketed placeholder (subscription prices) once Part 2.5 is done; everything
else is ready to paste as-is.

```
WHAT THIS APP IS
DuoQueue helps people find platonic gaming partners ("duos") — teammates to play games, watch
shows, or co-op with — matched on shared games, shows, and playstyle, not romantic interest. It
uses a swipe-card interface to browse candidate profiles quickly, the same interaction pattern
dating apps use, but here it drives a non-romantic, activity-based match: there is no
gender-based filtering anywhere in the app, no romantic language on any screen, and every piece
of in-app vocabulary was written to describe teammates, not dates ("duo," "Power-Up," "Legendary
Like," "Who wants to duo," "Requests," "Highlights").

DEMO ACCOUNT FOR REVIEW
  Email:    review@duoqueue.io
  Password: ipTH0uV9uRfA9O2xsg7eb6WH

This account is pre-confirmed and fully onboarded — sign in directly, no CAPTCHA or email code.
On sign-in you will immediately see:
  - A populated Deck of 13 candidate profiles, each with a display name, age, bio, prompt
    answers, games with skill levels, shows, platforms, playstyle tags, and an approved photo.
  - One existing match (with "Priya") already containing an 8-message conversation about
    scheduling a Valorant session, with the newest message left unread so the Matches tab shows
    a badge the moment you sign in.
  - Three profiles waiting under "Requests" (the "Who wants to duo" screen).

Why this data exists: these profiles are synthetic accounts created specifically for App Review,
flagged internally so they're visible ONLY to this review account. Real users never see them,
and this account never appears to real users either — enforced server-side (Postgres row-level
security), not just hidden in the client. We chose this over seeding fake profiles into the
general pool because that would mean real users occasionally matching with an account nobody is
behind, which we consider a worse outcome. All profile photos shown are abstract generated
artwork (geometric patterns, no faces, real or AI-generated).

HOW TO EXERCISE EACH FEATURE
1. Swipe the Deck: from the first tab ("Deck"), swipe or use the on-screen buttons to pass or
   duo with any of the 13 candidate profiles.
2. Open the existing conversation: Matches tab → tap "Priya" to open the 8-message conversation.
   Sending a new message works normally.
3. View a full profile: tap any card in the Deck (or a name in Matches) to open full profile
   detail — photos, prompts, games, schedule, vibe tags.
4. Try the paywall: tap the DuoQueue+ banner/icon (or attempt an action gated behind it, such as
   a swipe past the free daily limit). It lists four auto-renewing plans (Weekly / Monthly /
   3-Month / 6-Month) plus two one-time consumables (Power-Up, Legendary Like), and always
   offers "Continue with Free" so it never traps you.
5. Blocking and reporting: open the "Priya" conversation, tap the ••• menu, choose "Report" or
   "Block." The same two actions are available from any party chat's member list.
6. Account deletion (Guideline 5.1.1(v)): Settings tab → "Sign out or delete account" → red
   "Delete account" card. Requires two confirmations before permanently deleting the account,
   profile, photos, matches, and messages — please use a fresh test account of your own to
   exercise this, since it will remove the review account.

IN-APP PURCHASES
DuoQueue+ is a subscription (Weekly [$4.99/wk] / Monthly [$7.99/mo] / 3-Month [$17.99] /
6-Month [$29.99]) that unlocks unlimited swipes, unlimited conversations, advanced filters,
seeing everyone who has sent a request at once, and one daily "Super Ping." All four tiers are
auto-renewing; the paywall states this explicitly next to the purchase button ("DuoQueue+ is an
auto-renewing subscription... renews automatically for the same price and period unless you
cancel at least 24 hours before the current period ends... Manage or cancel anytime in your
device's Account Settings"), and Restore Purchases is present on the same screen. Two consumable
purchases are also offered, visually separated from the subscription tiers: a "Power-Up"
(temporary visibility boost) and "Legendary Likes" (extra highly-visible requests).

MODERATION AND SAFETY
- Profile photos are automatically screened before anyone else can see them (nudity, gore,
  apparent-minor detection); anything the automated check can't confidently clear is held for
  manual review rather than shown.
- Users can report anyone (1:1 or party chat) with one of five categories: Harassment, Spam,
  Inappropriate content, Underage, or Other, plus optional free-text detail.
- Users can block anyone; blocking is enforced server-side — a blocked user cannot re-fetch the
  blocker's profile, photos, or any other data through the API.
- Users can add "hidden words" that mask any inbound message containing them until revealed.
- Published, monitored safety/contact address: support@duoqueue.io.

AGE RATING
We expect the top age band (17+ legacy scale / 18+ new scale) and believe that's correct, not
something we're trying to talk down. The main driver is unmoderated-in-the-moment user-to-user
messaging (1:1 and party chat) — free text between people who don't already know each other.
Separately, DuoQueue is adults-only by design: sign-up requires a date of birth, the app computes
whether that date is at least 18 years in the past, and the date picker's own maximum selectable
date is capped at 18 years ago. There is no account-creation path that skips this.

Contact: support@duoqueue.io for anything App Review needs during evaluation — we'll respond quickly.
```

---

## Part 5 — Pre-submit checklist

The things first-time submitters most often forget. Go through this right before you tap
Submit, not before.

- [ ] Paid Applications Agreement (Part 1B step 6) shows **Active**, not just "submitted" —
      check Agreements, Tax, and Banking directly; a pending banking/tax section silently
      blocks IAP attachment with no clear error.
- [ ] All four subscriptions and both consumables show as **Ready to Submit** (not "Missing
      Metadata") in App Store Connect, and are attached to your build before you submit —
      subscriptions go out with the first binary, not as a follow-up.
- [ ] The review screenshot is attached to at least one IAP product (Part 2.5).
- [ ] Real RevenueCat iOS key is in `apps/mobile/.env` (not the `test_` key) — Test Store
      keys will not process real payments and can cause the paywall to misbehave under review.
- [ ] Optional: link your own Steam account once from Settings → Connections, so the
      Steam-linking claim in the description has been exercised end-to-end at least once by a
      human before a reviewer tries it (the key and functions are already live — see Part 2.5).
- [ ] You tested the production build on a real device on an IPv6-mostly network, not just
      your home Wi-Fi.
- [ ] Privacy Policy URL field in App Store Connect is filled in (`https://duoqueue.io/privacy`)
      — a blank or 404ing URL is one of the most common instant rejections.
- [ ] Demo credentials (Part 1.5) are pasted into App Review Information, not just described
      in the notes.
- [ ] You did **not** opt into "Made for Kids" or the Kids Category anywhere in the Age Rating
      flow.
- [ ] Export compliance answered "No" (uses only exempt encryption) — Part 3.6.
- [ ] App icon and launch screen are both present and match what's actually in the build (no
      leftover placeholder asset).
- [ ] Support URL and marketing URL (if any) actually resolve — click them yourself, don't
      trust that they do.
- [ ] Age rating questionnaire answers match what the app review notes claim (Part 3.5) — a
      mismatch between your self-reported rating and reviewer observation is its own risk.

---

## Genuinely open / unknown

- Whether a real Steam link round-trip works. The key, both functions, and the resync cron
  are all confirmed live (Part 2.5), but zero accounts have been linked so far, so Steam's
  API has never actually answered us. Low risk, trivially checked by linking your own.
- Whether you've had a lawyer actually review `docs/legal/privacy-policy.md` and
  `terms-of-service.md` — they're solid drafts but were explicitly flagged as pre-counsel.
- Real subscription/consumable pricing may end up different from the suggested prices in
  Part 2.5 once you actually pick ASC price tiers for your territory — update Part 4's
  bracketed price line to match whatever you actually set.
