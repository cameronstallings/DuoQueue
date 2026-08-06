# DuoQueue — App Store Submission Checklist

Working document for Cameron's first iOS submission. Written 2026-08-05 after verifying the
compliance fixes in commit `e1fb288` (branch `claude/duoqueue-gaming-app-fhga1z`) against the
actual code, and re-running every quality gate. Work through part 2 in order — it's ordered by
dependency (you can't fill in App Store Connect fields before things exist to point at).

---

## 0. What was just verified (2026-08-05)

All eight claims in the compliance-fixes pass were checked against the real files, not just
trusted:

| Claim | Verified |
|---|---|
| `src/lib/legal.ts` created, single source for legal URLs | Yes — real `duoqueue.io` domain, but nothing is hosted there yet — marked `TODO(Cameron)` |
| Legal links added to Settings, sign-up, paywall | Yes — all three render and call `WebBrowser.openBrowserAsync` / `mailto:` correctly |
| Remaining "admirers"/"liked you" strings fixed | Yes — zero user-facing matches left; `admirers`/`Admirer` only survive as internal query keys, RPC names, and code comments |
| Gender dating-filter removed from Filters screen | Yes — `FilterSection`, state, save payload, and the `GENDERS`/`Gender`/`GENDER_LABELS` imports are gone from `app/filters.tsx` |
| Dating-style heart icon removed | Yes — `matches.tsx` empty state uses `icon="game-controller"` |
| Report/Block added to party chat | Yes — functional two-level sheet (member → action), reuses `useBlockUser`/`useReportUser`, which really do accept a bare profile id |
| Dead microphone permission + voice-intro feature removed | Yes — all 4 source files deleted, zero references anywhere, `NSMicrophoneUsageDescription` and the `expo-audio` plugin block gone from `app.json`, dependency gone from `package.json`, lockfile synced |
| "Standouts" renamed to "Highlights" (last mismatch) | Yes — `StandoutsRow.tsx`'s `SectionLabel` now matches the two screens already using that wording |
| Push-consent copy before the permission prompt | Yes — confirmed `onSignedIn()` in `session-store.ts:31-33` fires `registerForPushNotifications` on every auth success, and `sign-up.tsx` is the only screen guaranteed to render before that on both the immediate-session and email-confirmation paths |

**Placeholder sweep** (re-run across all of `apps/mobile`): no "coming soon", "TBD", "under
construction", or similar. The one comment mentioning "Coming soon" (`settings/connections.tsx`)
is documentation of copy that was already removed, not live UI. No feature is visible-but-dead.

**Gates**, all green:
- `pnpm typecheck` — both workspace packages, 0 errors
- `pnpm lint` — both workspace packages, 0 errors
- `pnpm audit:contrast` — 56/56 WCAG pair-checks pass, both color schemes

**Deliberately-not-fixed items, confirmed still accurate:**
- Party chat has Report/Block but no profanity-filter parity with 1:1 chat (`send_party_message`
  needs the same masking `profanity.ts` applies) — a Postgres change, out of this pass's scope.
- No "Leave party" — confirmed `party_members` has only a `grant select` (migration
  `0026_parties.sql:106`), no delete grant or RPC exists at all. Needs a migration.
- Onboarding still collects gender (`app/(onboarding)/gender.tsx`, untouched) even though nothing
  reads it as a match filter anymore — a genuine keep-or-drop call, see §2 below.

**New observation from this pass** (not in the original fix list — see risk #3 in §4): the paywall
has no explicit "renews automatically, cancel anytime" disclosure text near the purchase button.
Price and billing period are shown per plan, but Guideline 3.1.2 wants the auto-renewal statement
spelled out, not implied.

---

## 1. Already handled — you do not need to worry about these

- **Legal links** wired everywhere Apple checks for them (Settings → Legal, sign-up screen, and
  directly above "Restore purchases" on the paywall) — all reading from one file, so fixing the
  URLs in one place fixes every screen.
- **Push notification consent copy** appears before the permission prompt ever fires.
- **Dating-pattern language purged**: "who liked you" → "who wants to duo", "Like back" → "Duo
  Up", heart iconography → game-controller, "Standouts" → "Highlights" everywhere.
- **Gender-based dating filter removed** from Filters — DuoQueue no longer lets you filter matches
  by gender.
- **Party chat has Report/Block**, matching the 1:1 chat's safety affordances.
- **Dead microphone permission removed** — the app now only requests permissions it actually uses
  (photo library, camera, notifications).
- **18+ age gate**, **in-app account deletion** (Settings → Sign out or delete account), **photo
  moderation** (Sightengine, live with real credentials), **admin moderation queue**
  (`admin/index.html`), **report/block/hidden-words/profanity filter** on 1:1 chat — all pre-date
  this pass and were independently confirmed still live.
- **No analytics SDK, no ad SDK, no tracking** — confirmed via `package.json`, nothing to disclose
  as tracking in the privacy label.
- **Auth is email-only** — the social sign-in code paths are flag-disabled, so Guideline 4.8
  (Sign in with Apple parity) does not apply. Leave it disabled; don't ship a Google/Facebook
  button without also shipping Apple Sign-In.
- All quality gates (typecheck / lint / contrast) pass clean.

---

## 1.5 Demo / App Review account (seeded, live now)

The empty-deck problem from risk #2 in §4 is fixed: `scripts/seed-review-demo.mjs` creates a
real, pre-confirmed review account and a small pool of demo gaming-partner profiles that exist
**only** for that account to see. Every row it creates is flagged `is_demo = true`, and
`supabase/migrations/0059_review_demo_visibility.sql` gates every discovery surface (`get_deck`,
`get_online_now`, `get_party_deck`, `get_standouts`, `get_admirers`, `get_admirers_count`,
`get_matches_summary`, and all fourteen `public_profile*`-family views) so a demo row is only ever
visible to a viewer who is themselves flagged `is_demo = true`. KittyKat and every other real user
never see any of it — verified live: a freshly created, ordinary (non-demo) authenticated user's
`get_deck`/`get_standouts`/`get_admirers`/`get_online_now` calls returned zero of the 14 demo
profiles, while the review account's own `get_deck` returned all of them (13, since the 14th is
already matched and excluded from the deck the same way any swiped profile is).

**Credentials** (paste into App Store Connect → App Review Information — also used in the §4 draft
notes below):

```
Email:    review@duoqueue.io
Password: ipTH0uV9uRfA9O2xsg7eb6WH
```

**What the reviewer will see** on signing in: a populated deck of 15 candidates (13 fresh demo
profiles plus the two real accounts), one existing match — with Priya — showing an 8-message
conversation about arranging a Valorant session, with the last message unread so the Matches tab
shows its unread badge immediately, and three demo profiles (Marcus, Kofi, Bea) already showing up
on the "Who wants to duo" screen. Every demo profile is fully onboarded: display name, 18+ dob,
gender, region, bio, three prompt answers, several games with skill levels and (for a few) a rank,
two shows, platforms, playstyle tags, a vibe row, a usual play window, and an approved profile +
header photo. Photos are abstract generated art in the app's own Volt palette (geometric
patterns — circuit traces, hex fields, radar sweeps, and so on), never a real or AI-generated
face, produced by `scripts/generate-demo-avatars.mjs`.

**Re-running the script** (`node scripts/seed-review-demo.mjs`) is safe at any time — it's
idempotent, keyed off deterministic ids derived from fixed slugs, and re-running it does not
duplicate profiles, matches, messages, swipes, or storage objects. It also does not touch the
review account's password on a rerun (so credentials already handed to Apple keep working) unless
you explicitly pass `--reset-password`.

**Removal after launch** — once App Review is done and this account is no longer needed, run:

```
node scripts/seed-review-demo.mjs --remove
```

This deletes the review account, the 14 demo profiles, and everything that hangs off them (games,
shows, prompts, platforms, playstyles, vibe rows, the seeded match and its messages, swipes) via
the `auth.users` → `profiles` cascade, plus the uploaded storage objects (which don't cascade and
are removed explicitly). Verified live: after `--remove`, `profiles`/`matches`/`messages` counts
return to exactly their pre-seed baseline (2 real profiles, 0 matches, 0 messages) and the storage
bucket has no leftover demo folders. **Run this after launch, once the build is live and Apple's
review is complete** — there's no reason to keep 14 fake-but-gated profiles in production longer
than needed, even though real users can never see them.

---

## 2. What you still have to do

### 2A. On your machine (terminal / code)

Do these first — App Store Connect fields in §2B depend on some of them existing.

1. **Fill in the legal docs' own TODOs before publishing them.** `docs/legal/privacy-policy.md`
   and `terms-of-service.md` still have `TODO(Cameron)` markers for: effective date, your legal
   entity name (or your own name if you're operating as an individual — you said no company
   entity exists yet, so this is probably just "Cameron Stallings"), a monitored contact email,
   and business address. These are lawyer-review drafts, not final text — get an actual lawyer to
   check them if you can before publishing, especially given you're collecting DOB and running a
   platonic-but-swipe-mechanic UGC app for adults.

2. **Publish the two legal docs as real, public web pages.** You already own `duoqueue.io`
   (verified live for email) — the code now points at duoqueue.io; the pages still need publishing. Simplest
   options: GitHub Pages (Settings → Pages → deploy `/docs` from `main`, add a Jekyll front-matter
   line `---\n---` to the top of each `.md` so it renders instead of downloading as raw text), or
   drop them as static HTML on Cloudflare Pages / Netlify pointed at `duoqueue.io`. Either way you
   need two stable URLs, e.g. `https://duoqueue.io/privacy-policy` and
   `https://duoqueue.io/terms-of-service`.

3. **Update `apps/mobile/src/lib/legal.ts`** with the three real values: the two hosted URLs from
   step 2, and a real monitored support email (support@duoqueue.io, once the inbox exists). This is the only file
   that needs editing — every screen reads from it.

4. **Seed reviewer-visible content — done, automated.** The live deck used to be empty (only your
   account + KittyKat existed). That's now handled by `scripts/seed-review-demo.mjs` (see §1.5
   below), which seeds 14 demo profiles plus one pre-built match with a conversation. Nothing left
   to do here manually — it's already been run once; safe to re-run anytime, it won't duplicate
   anything.

5. **Create a demo account for App Review and pre-confirm it — done, automated.** Sign-up in this
   app requires solving a Cloudflare Turnstile CAPTCHA (if `EXPO_PUBLIC_TURNSTILE_SITE_KEY` is set
   in production) and then a 6-digit email OTP. Reviewers won't have access to that inbox. The same
   seed script creates `review@duoqueue.io` with the email pre-confirmed via the admin API, so the
   credentials in §1.5 go straight to a logged-in, already-onboarded profile — Apple's reviewer
   never has to touch sign-up, the CAPTCHA, or an OTP.

6. **`eas login` then `eas init`** from `apps/mobile`. This writes `extra.eas.projectId` into
   `app.json`, which also unblocks the push-notification token code (it silently no-ops without a
   real EAS project id).

7. **Set real RevenueCat keys** in `apps/mobile/.env`: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and
   `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. You're currently on Test Store keys — swap once the
   App Store Connect subscription products exist (see §2B item 6).

8. **Build**: `eas build --profile production --platform ios` once your Apple Developer account is
   approved (see §2B item 1) and the above are done. Test the resulting build on a real device on
   an IPv6-only or IPv6-mostly network (e.g. most US cellular networks) before submitting — Apple
   requires this and it's an easy last-minute rejection if something silently assumes IPv4.

9. **Decide on onboarding gender collection.** Nothing reads `gender` as a match filter anymore
   (that was this pass's fix). You can leave it collected for future safety/reporting use, or drop
   the onboarding step entirely. Either is defensible; it's not a rejection risk either way since
   it's never surfaced as a dating-style filter — just make the call and, if you drop it, that's a
   follow-up code task, not something blocking submission.

### 2B. In a browser (App Store Connect, GitHub, RevenueCat)

10. **Apple Developer Program enrollment** ($99/year) if not already done — approval can take
    24-48 hours, so start this first if you haven't.

11. **Create the App Store Connect app record** for bundle id `com.duoqueue.app`.

12. **App Information tab**: paste your hosted Privacy Policy URL (from §2A step 2). Set a Support
    URL — either a `mailto:` link to your support email or a simple hosted contact page; a bare
    mailto works and is commonly accepted.

13. **App Privacy (nutrition label)**: use the table in §3 below directly — it maps to Apple's
    exact category names.

14. **App Review Information**: enter the demo account credentials from §1.5, and paste the
    App Review notes draft in §4 below (edit the remaining bracketed parts first — subscriptions
    pricing and the support email).

15. **Age Rating questionnaire**: answer honestly — this app has user-generated content
    (unmoderated-until-reviewed chat), infrequent/mild profanity (filtered, not blocked entirely),
    and no gambling/alcohol/drug content. Expect a 17+ rating given the UGC chat surface; that's
    normal for this app category and not a rejection risk by itself.

16. **RevenueCat**: create the real project, add your iOS app, then in App Store Connect create the
    4 subscription products (weekly/monthly/3-month/6-month DuoQueue+) and the 2 consumables
    (Power-Up boost, Legendary Like/rose pack) with product IDs matching what's already in the code
    (`duoqueue_boost_1`, `duoqueue_roses_3`, plus your subscription group's product IDs). Wire them
    into RevenueCat as packages, generate the App Store Connect API key RevenueCat needs, and copy
    the public SDK key back into `.env` (§2A step 7). Subscriptions must be submitted for review
    alongside your first binary — do this before you hit Submit for Review, not after.

17. **Submit for Review.**

---

## 3. App Privacy (nutrition label) answers

Enter these under App Store Connect → App Privacy. "Linked to identity" means Apple's definition
(tied to a user account, not necessarily displayed publicly). Nothing here is used for tracking
(no cross-app/cross-site tracking exists in this codebase — no ad SDK, no analytics SDK).

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
Diagnostics (no crash reporting SDK is integrated — if you add Sentry or similar later, revisit
this table).

---

## 4. Draft App Review notes (paste into App Review Information → Notes, edit bracketed parts)

```
DuoQueue is an 18+ app for finding platonic gaming partners ("duos") — people to play games,
watch shows, or co-op with. It intentionally uses a swipe-card interface to browse profiles, but
it is not a dating or hookup app: there is no gender-based matching, no dating-oriented filtering,
and the app's own copy, onboarding, and Trust & Safety documentation frame it exclusively around
shared games/shows/playstyle compatibility.

Demo account (already confirmed, no email/CAPTCHA steps needed):
  Email: review@duoqueue.io
  Password: ipTH0uV9uRfA9O2xsg7eb6WH

This account already has a populated deck (13+ profiles), one existing match with an 8-message
conversation (including an unread message waiting in Matches), and a few pending "Who wants to
duo" admirers, so core flows (swipe, match, chat) are immediately visible without needing a second
live account.

Age verification: new sign-ups must enter a date of birth and are blocked from proceeding if under
18. Account creation additionally requires solving a CAPTCHA and confirming a 6-digit code sent to
the registered email — the demo account above already has both steps completed.

Moderation: profile photos are automatically screened (nudity/minor/gore detection) before they
become visible to other users; undetermined results are held for manual review rather than shown.
Users can report or block anyone from both 1:1 and party contexts; blocking is enforced
server-side (a blocked user cannot view the blocker's profile at all, not just hide them from a
list).

Subscriptions (DuoQueue+): [Weekly $X.XX / Monthly $X.XX / 3-Month $X.XX / 6-Month $X.XX] — the
paywall always offers "Continue with Free" and never traps the user. Restore Purchases is
available on the paywall screen. Consumable purchases (Power-Ups, Legendary Likes) are also
available and clearly separated from the subscription tiers.

Contact: [support email] for anything App Review needs during evaluation.
```

---

## 5. Top 5 rejection risks for this app, and the mitigation for each

1. **Missing or placeholder Privacy Policy URL in App Store Connect (Guideline 1.2 / 5.1.1 /
   3.1.2(c)).** This is the single most common instant rejection for any app with accounts or
   UGC, and this app points at `duoqueue.io` but has nothing published there (not the
   `duoqueue.io`) sitting in `legal.ts` until you host the real pages and update it.
   *Mitigation*: §2A steps 1-3, done before you touch App Store Connect at all.

2. **Reviewer hits a wall before ever seeing the app work.** Two independent ways this could
   happen: (a) sign-up requires a CAPTCHA + email OTP the reviewer can't complete, and (b) a
   successful login landing on an empty deck (only 2 real accounts exist) — both read to Apple as
   "app doesn't work" (Guideline 2.1), the most common reason first-time submissions bounce. Both
   are now fixed — see §1.5.
   *Mitigation*: §2A steps 4-5 / §1.5 — pre-confirmed demo account, pre-populated deck and match, handed
   to Apple directly in App Review notes.

3. **Subscription purchase screen is missing the explicit auto-renewal disclosure (Guideline
   3.1.2).** The paywall shows price and billing period per plan and has working Restore
   Purchases + a free-tier escape hatch, but there's no explicit "renews automatically at
   [price]/[period] until cancelled — manage or cancel in your App Store account settings" text
   near the purchase button, which Apple checks for specifically on custom (non-StoreKit-UI)
   paywalls.
   *Mitigation*: add a caption line to `apps/mobile/app/paywall.tsx` near the "Start subscription"
   button stating the auto-renewal terms plainly. This is a small, contained code change — flag it
   for your next coding session before submission if it isn't already done.

4. **Swipe-card UI still pattern-matches to a dating app despite the copy fixes (Guideline
   4.3(b) / 1.1.4).** Apple is notably strict about new dating-adjacent apps needing "meaningful
   differentiation," and reviewers sometimes react to the interaction pattern itself regardless of
   wording.
   *Mitigation*: the App Review notes draft in §4 states the platonic framing explicitly up front
   — don't let the reviewer discover it by inference. If this app gets bounced on 4.3(b) anyway,
   the appeal path is pointing to the gender-filter removal and the platonic-only Trust & Safety
   doc as evidence of differentiation.

5. **Party chat has weaker moderation than 1:1 chat (Guideline 1.2).** Report/Block now exist in
   both places (fixed this pass), but party chat still lacks the profanity-masking filter 1:1 chat
   has — a real but lower-severity gap given the safety mechanism (report/block) is present.
   *Mitigation*: low urgency for this submission given Report/Block coverage, but worth a follow-up
   migration adding the same masking to `send_party_message` before you scale up party usage.
