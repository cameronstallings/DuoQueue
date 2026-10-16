# DuoQueue — App Store Submission Guide

Your working document for the first iOS submission. Rewritten 2026-08-06 against the live
code, the live site, and the live Supabase project — then corrected against Apple's current
published rules after an adversarial pass found 24 errors in the first draft.

**How to use this**: work top to bottom, with one exception — **start Part 1B steps 5 and 6
(Developer Program enrollment and the Paid Applications Agreement) before anything else.**
Each takes 1–2 days to clear, and Part 1A steps 3 and 4 can't finish until they do. Skip
Part 0 only if you've read it before. Every numbered step says where it happens and roughly
how long it takes. Part 2 is paste-ready copy
for App Store Connect fields. Part 3 is the privacy label table. Part 4 is App Review notes.
Part 5 is the pre-submit checklist. Do that checklist last, right before you tap Submit.

---

## Part 0 — What's already done (you do not need to redo any of this)

- **Legal pages are live and current**, including the post-0060 correction that gender is
  never used to filter or rank (verified serving 2026-08-06).
  `https://duoqueue.io/privacy` and `https://duoqueue.io/terms`
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
- **The paywall's auto-renewal disclosure is on its purchase page.** Since build 17 the paywall
  is three swiped pages (`apps/mobile/app/paywall.tsx`). Page 3
  (`src/features/premium/paywall/PlansView.tsx`) holds the plans and, directly under the
  purchase button, a renewal paragraph written for the selected plan (`planCopy` in
  `pricing.ts`): charged to the Apple Account at confirmation, renews at the same price unless
  cancelled at least 24 hours before the period ends, the renewal charged within those 24
  hours, managed or cancelled in Apple Account settings. Restore purchases, Terms of Use and
  Privacy Policy sit beside it. Pages 1 and 2 show no price and no buy button.
- **Dating-pattern language is purged and quality gates are green.** "Who liked you" → "who
  wants to duo," heart iconography → game-controller icons, gender-based match filtering
  removed (no screen reads or writes `preferences.preferred_genders`; migration 0060 removes
  the dormant server-side clause and the column, and also drops `gender` from the
  `public_profiles` view so `?gender=eq.…` is no longer a valid REST predicate — the claim
  holds against a raw API client, not just against the UI), mic permission removed (app only
  requests photo library/camera/
  notifications). `pnpm typecheck`, `pnpm lint`, and `pnpm audit:contrast` (76/76 WCAG pair-checks,
  both color schemes) all pass clean.
- **No analytics SDK, no ad SDK, no crash-reporting SDK.** Confirmed via `package.json` in
  both the root and `apps/mobile` — nothing to disclose as tracking, and the privacy table in
  Part 3 doesn't need a Diagnostics row.
- **Auth is email and Sign in with Apple (from build 11).** Google stays off
  (`GOOGLE_SIGN_IN_ENABLED = false` in `apps/mobile/src/features/auth/socialSignIn.ts`, and the
  Google provider is off on the hosted project), so Guideline 4.8 is satisfied: the only
  third-party login offered is Apple's own. Builds up to 10 are email-only. Three things about
  the Apple path that a reviewer will run into, all covered in the Part 4 notes:
  - **Apple sends no birthdate**, so an Apple signup authenticates first and is then asked for
    a date of birth on a "Confirm your age" screen before any profile exists
    (`complete_signup`, migration 0067). Under 18 is refused there exactly as on the email path.
  - **Deletion revokes the Apple grant** (Guideline 5.1.1(v)): `delete-account` calls Apple's
    `/auth/revoke` with the refresh token stored at sign-in, and the app also asks Apple for a
    fresh code at deletion time as a backstop, so DuoQueue disappears from iOS Settings >
    Apple ID > Sign in with Apple. An account can be deleted before it has a profile ("Delete
    this sign-in" on the age screen and in the setup wizard's exit sheet).
  - **An Apple-created account never sees the demo profiles**, which are visible only to the
    demo account, so its deck holds only real onboarded users: empty or nearly so before launch.
    The full demo stays on the email review account (Part 1.5).
  - **Go-live order is not optional**: migrations 0067 then 0068 applied, the four `APPLE_*`
    function secrets set, `apple-authorization` and `delete-account` deployed, and only then the
    Apple provider turned on in Supabase Auth (client ID `com.duoqueue.app`), all before the
    build goes to review. Turning the provider on before 0067 makes every Apple signup fail with
    "Database error saving new user".

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
8-message conversation left unread (an indicator on that row in the Matches list; from 1.0.2
the Matches tab also shows a badge, `useMatchesBadge`, which Priya's unread chat lights), and 3
inbound "who wants to duo" requests
(Sana, Marcus, Cameron). The review account plays League of Legends at Gold II, so the first
three cards (Cameron, Platinum IV, Dae, Platinum I, and Devon, Silver I) carry the lit
"CAN DUO" cell from the rank picker; Ophelia (Emerald IV) is further down without it.
Cameron is the owner's own card (his name; under `--filming`, his own photograph), North
American and League first; it replaced the Rocket League persona on the same seed slug on
2026-10-15. The four pre-launch tester accounts (KittyKat, Stallings, the 15 Aug Cameron,
John) are `is_demo` too since 15 Oct, so the seed records a pass on each from this account:
none of them is in its deck, Highlights or Requests. Every demo row is flagged `is_demo = true` and gated server-side across
9 RPCs and 14 views — real users (verified live, adversarially, across every discovery
surface) see zero of it, and the reviewer's account is invisible to them too. That holds for
`is_demo = false` accounts only: `is_demo_viewer()` (0059) is true for every `is_demo` caller,
so since 15 Oct the four pre-launch accounts in the WARNING below see every persona and the
review account. Photos are abstract generated art (`scripts/generate-demo-avatars.mjs`), never
a real or AI-generated face.

Every number in that paragraph was measured against the hosted database on 2026-08-22, not
inferred from the seed file, and re-measured after a full `--filming` → plain round trip:

| claim | how it was measured | result |
|---|---|---|
| deck of 13 | `get_deck(50)` as this account, under `set local role authenticated` | 13 |
| 3 requests, by name | `get_admirers()` as this account (a free account: all 3, in an order that changes by day, not newest first) | Sana, Marcus, Cameron (on 2026-10-15: Marcus, Cameron, Sana) |
| 14 demo profiles | `count(*) from profiles where is_demo` minus the review row | 14 |
| Priya, 8 messages, newest unread | `messages` joined to the one row in `matches` | 8, newest from Priya, `read_at is null` |
| photos are abstract | md5 of every stored object vs. md5 of every file in `assets/demo` and `assets/demo-filming` | 30/30 in `assets/demo`, 0 in `assets/demo-filming`, 0 unmatched |
| 9 RPCs / 14 views | functions and views whose definition references `is_demo_viewer` / `is_demo` | 9 and 14 |
| League "CAN DUO" order (2026-10-15, after 0071 and a plain re-seed) | `get_deck(20)` as this account, read-only, rolled back | 13 cards, all seed personas, none of the four tester accounts: 1 Cameron (true), 2 Dae (true), 3 Devon (true), 4 Chase, 5 Wren, 6 Ophelia (false), 7 Sana, 8 Tobin, 9 Marcus, 10 Bea, 11 Remy, 12 Yuki, 13 Nadia (null = no League rank). North America comes first since 0071, and Cameron leads because he is the one North American request |

The 14 abstract PNGs were also opened and looked at, not just hashed: circuit traces,
isometric blocks, hex field, waveform, target rings, dot matrix, radar sweep, scanline
glitch, triangle mesh, pixel cluster, orbit rings, radial spectrum, crosshair, node graph.
No faces, and nothing photographic — `generate-demo-avatars.mjs` draws every one of them
from seeded geometry with `sharp`, so there is no source image for a face to come from.

Re-running the seed script is safe any time — it's idempotent and won't duplicate anything:

```
node scripts/seed-review-demo.mjs
```

**1.0.2 WARNING, read 15 Oct 2026 (read-only SQL), and what the reseed (697657c, the same day)
changed.** The first three bullets are why the old plain seed was NOT safe to run; the seed now
handles all three, and the table above is its re-measure after a plain run. What is still left
before submitting is the last bullet.
- Before the reseed, the review account had passed Dae and liked Devon on 10 Oct 2026, so only
  11 personas passed `deck_gate_hard` and `deck_gate_preferences` for it (Bea, Chase, the
  persona that is Cameron's card since the reseed, Marcus, Nadia, Ophelia, Remy, Sana, Tobin, Wren,
  Yuki), and neither CAN DUO card was among them. Every seed run deletes every swipe the review account made
  (`resetReviewAccountState`), so a plain run clears that; Priya (8 messages) and the three
  requests (now Sana, Marcus, Cameron) are rebuilt by it.
- On 15 Oct the four pre-launch accounts KittyKat, Stallings, Cameron (the 15 Aug email one)
  and John were flagged `is_demo = true`, so there are now 19 demo profiles, not 15. All four
  have user-uploaded photos (JPGs in their own storage folders, not the generated PNGs; Cameron's
  and John's are approved). Before the reseed they stayed out of the review deck only because
  the review account had passed them on 17 Sept.
- The old `excludeRealAccountsFromDemoPool` re-passed only `is_demo = false` profiles, so a plain
  re-seed would have put those four into the review deck with their own photos, breaking the
  "never a real or AI-generated face" sentence above, and its prune ("is_demo and not a
  persona") would have deleted all four accounts. Since 697657c,
  `excludeNonPersonaAccountsFromDemoPool` passes every profile that is not one of the seed's
  personas, and `pruneRemovedDemoAccounts` deletes only accounts whose email the seed created.
- The same passes carry the 1.0.2 Duo Pop lines. A pop goes only between two accounts with the
  same `is_demo` and no pass in either direction (`duo_pop_pair_ok`, 0085), and those four
  accounts belong to real people who can queue up and turn Duo Pops on (read 15 Oct: the review
  account has 2 push tokens; the four and every persona have 0, but any of the four gets one the
  first time it allows notifications on a phone). Without the passes, the notes' "this account
  cannot receive one" and its Queue up's "No one in League of Legends could get a Duo Pop right
  now" can both be false. What holds
  without them, read 15 Oct: the review account is NA East, League is its priority-0 game, its
  null `onboarding_completed_at` makes the one-day check use `created_at` (6 Aug), and it has 0
  reports, so `start_queue_up` does not stop it as too new or reported.
- Those four are also why the 1.0.2 notes say the demo profiles are seen by "this account and four
  pre-launch tester accounts" (any `is_demo` account sees them). Unflag or delete the four and
  that sentence changes.
- Before submitting 1.0.2 (a database write, Cameron's OK): the script edit is done (697657c),
  but the seed was left in `--screenshots` on 15 Oct (342d409, below), so run the plain seed and
  then re-measure the table above. The 1.0.2 review notes (Part 4) say "a Deck of 13 profiles"
  with Cameron, Dae and Devon lit and that the account cannot receive a Duo Pop, which are true
  only after that (re-measure: 13 cards, Cameron, Dae and Devon lit, no `profile_media` outside
  `assets/demo`, a pass from the review account on each of the four).

**Never submit after a `--filming` or `--screenshots` run.** That flag swaps the abstract art for real
photographs so Cameron can record marketing footage, and it leaves them in the live
database. It has already made the "never a real or AI-generated face" sentence above false
once, on an app that was rejected under a content guideline. A plain
`node scripts/seed-review-demo.mjs` puts the approved abstract set back; run it, and confirm
before submitting that no `profile_media` row for a demo profile resolves to a file in
`assets/demo-filming/`.

Since 2026-10-15 the filming set is two personas: Cameron (the owner, his own photograph,
with his consent) and Priya (a cat). The photographs of other people that Sana and Marcus
used were dropped; they stay abstract in both modes. **The seed was left in `--screenshots` on
2026-10-15** (342d409) for the 1.0.2 store screenshots: `--screenshots` is `--filming`'s photos
plus the review account's League row, which `--filming` alone leaves off, so Cameron's card leads
with his own photograph and Cameron, Dae and Devon all show CAN DUO (measured in a rolled-back
run). Run the plain seed before submitting.

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

2. **Onboarding gender collection: decided (build 12).** The gender step is removed and nothing
   sends gender. The column stays nullable; older answers are kept and never shown in the app. When build 12
   ships, update the Gender row in App Privacy (Part 3) and publish privacy policy 1.4.

3. **Push your env vars to EAS — this is not optional and it is easy to miss.**
   `apps/mobile/.env` is matched by `.gitignore` (`*.env`), so **EAS Build never receives
   it.** The `production` profile in `eas.json` reads EAS's *server-side* `production`
   environment instead, which starts out empty. A build made without these throws at module
   load in [`src/lib/supabase.ts:56`](../apps/mobile/src/lib/supabase.ts:56) and crashes on
   launch — no error screen, just a dead app. This bit the first build.

   Put the real RevenueCat iOS key into `.env` first if you have it, then from `apps/mobile/`:
   ```
   npx eas-cli env:push production --path .env
   npx eas-cli env:list --environment production
   ```
   The second command must list `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
   and both RevenueCat keys before you build. *3 min.*

   RevenueCat degrades gracefully when its key is missing (it warns and skips), so the
   Supabase pair is what's launch-critical — but a `test_` RevenueCat key means no real
   products, so the final build still has to come after Part 2.5.

4. **Build**: `npx eas-cli build --platform ios --profile production`. Requires your Apple
   Developer account to be approved (Part 1B step 5) first. Test the resulting build on a
   real device on an IPv6-mostly network (most US cellular networks qualify) before
   submitting — Apple requires this, and it's an easy last-minute rejection if anything
   silently assumes IPv4. *Build: 6-30 min on EAS's servers. Device test: 15 min.*

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
   (`eas submit` will do this for you on its first run if you'd rather.)

7b. **Pricing and Availability** — its own item in the App Store Connect sidebar, easy to
   miss because it isn't part of App Information. Set the app **Price** to **Free** (DuoQueue
   itself is free; DuoQueue+ is charged through IAP). Under **App Availability**, leave all
   countries selected unless you have a reason not to. **Submit for Review will not accept
   the app until this is set.** *5 min.*

8. **App Information tab** (app-level, left sidebar): paste `https://duoqueue.io/privacy` as
   the **Privacy Policy URL**. Set **Primary Category** to *Social Networking*, leave
   Secondary empty — DuoQueue is a people-matching app, not a game, and picking Games puts
   you in the wrong charts with the wrong reviewer expectations. Answer **Content Rights**:
   *"No, it does not contain, show, or access third-party content"* — user-posted bios and
   photos are covered by your Terms and you ship no licensed media. Both are required to
   submit. *5 min.*

9. **Paste the store listing copy** from Part 2 below (name, subtitle, keywords, promotional
   text, description). Not "what's new" — that field doesn't exist for a first release. *10 min.*

9b. **Support URL** — this lives on the **1.0 version page** under General Information, next
   to Description, *not* on App Information. It must be an `https://` page: Apple defines the
   field as "the URL of the support website," and a bare `mailto:` is not a website. Use
   `https://duoqueue.io/` for now, or add a one-screen `/support` page. Marketing URL is
   optional — leave it blank. *5 min.*

10. **App Privacy (nutrition label)**: enter the table in Part 3 directly — it maps to
    Apple's exact category names. *10 min.*

11. **Age Rating questionnaire**: answer per Part 3.5, then **set the Override to Higher Age
    Rating to 18+**. The computed rating will come back far lower than you expect — that's
    normal, and Part 3.5 explains why. *10 min.*

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

15. **Attach screenshots.** See Part 2.7 for the shot list and sizing — capture these with
    Expo Go any time before this step, no build required (skip the paywall shot until you
    have a real build with real products, per step 13). *Capture: 20-30 min. Upload: 10 min.*

15b. **Upload the build to App Store Connect.** `eas build` leaves the `.ipa` on Expo's
    servers — App Store Connect has no idea it exists until you push it. From `apps/mobile/`:
    ```
    npx eas-cli submit --platform ios --latest
    ```
    It prompts for your Apple ID and 2FA. Then Apple processes the binary (5–30 min, you get
    an email). Once it appears, open the 1.0 version page → **Build** → **+** and select it.
    *5 min to run, then waiting.*

16. **Submit for Review.**

---

## Part 2 — Paste-ready store listing copy

Every line below matches real, shipping UI copy — checked against the actual screens, not
the feature brief. Where a draft offered several options, one is picked as the default;
alternates are kept underneath, clearly marked, in case you'd rather use them.

**1.0.2 (build 20, which carries build 19's work plus the party LFG post and one duo per Queue
up), updated 15 Oct 2026.** Every field for this version, with its count, is in
`C:\Users\stall\Documents\DuoQueue-listing-1.0.2.txt` (the review notes are in
`DuoQueue-review-notes-1.0.2.txt`, Part 4). Name and subtitle stay as 1.0.1 shipped them; the
keywords, description and What's New change. Counts were measured by script: characters as
pasted (a line break counts 1), plus the CRLF count for multi-line fields. Every field was also
checked for U+2013/U+2014, the word "beats" and the dating words in `invite.test.ts`.

### 2.1 App Name (30 char max) — use this:

```
DuoQueue: Find a Gaming Duo
```
27 characters. Live since 1.0.1 (3 Oct 2026); unchanged for 1.0.2.

The 1.0 name was `DuoQueue: Gaming Partners` (25). **Its alternates**, kept for the record:
- `DuoQueue: Platonic Gaming` (25 chars) — says it outright, no inference needed.
- `DuoQueue - Not for Dating` (25 chars) — the boldest option; pre-empts a reviewer's
  pattern-match by naming and denying it in five words. Matches the app's dry tone well, but
  is the one most likely to make a human reviewer stop and read closely — arguably a feature
  given the swipe mechanic, but your call.

### 2.2 Subtitle (30 char max) — use this:

```
Teammates to duo queue with
```
27 characters. Live since 1.0.1; unchanged for 1.0.2. It puts "queue" in an indexed field,
which the one-word name "DuoQueue" does not.

The 1.0 subtitle was `Find your next co-op duo` (24). Its alternates: `Not dating. Just gaming.`
(24 chars) · `Teammates, not dates` (20 chars)

### 2.3 Keywords (100 byte max, comma-separated, no spaces) — use this:

```
lol,league,ranked,solo,lfg,squad,finder,partner,buddy,gamer,friends,party,coop,team,player,moba,mic
```
99/100 bytes, 17 terms, no duplicates (plan R2; "lol" and "league" approved by Cameron on 15 Oct).
Against 1.0.1's list it adds `lol` and `league` and drops `matchmaking`. Still nothing that
repeats the name or subtitle ("duo", "queue", "gaming", "teammates").

**Open for Cameron (plan Q22):** confirm your Riot developer registration covers using "lol" and
"league" as keywords, and whether "partner" and "buddy" (both live since 1.0.1) read as
dating-adjacent for an 18+ app. Swapping either out before you submit 1.0.2 is only a change to
this field (keywords change only with a version, so after submitting it waits for the next one).

The 1.0 list, for the record (90/100): `coop,squad,lfg,esports,streaming,anime,playstyle,ranked,crossplay,teammate,voice chat,safe`.

**Do not put `steam`, `discord`, `valorant`, or any other company or app name in this field.**
Apple's keyword rules say flatly that "names of other apps or companies aren't allowed," with
no exception for genuine integrations — an earlier draft of this doc had `steam` in here on
exactly that reasoning, and it was wrong. Describing the Steam integration in the Description
is fine and stays as written. (`lol` and `league` are game words rather than company names, and
Cameron approved them on 15 Oct; whether his Riot registration covers them is Q22 above.)

### 2.4 Promotional Text (170 char max) — use this:

```
Done with solo queue? Find a duo, not a date. League players in NA see Can duo on anyone whose rank can queue Ranked Solo/Duo with theirs. Match, chat, invite a third.
```
167/170 characters. Live since 1.0.1 and still true in 1.0.2, so the 1.0.2 paste file keeps it.
This field is editable without a new build.

**Optional, Cameron's call (not in the paste file):** a line that leads with Queue Up, 162/170:
`Done with solo queue? Tap Queue up: in NA, up to 6 players in your game who turned on Duo Pops get pinged, and the first one in is your duo. Teammates, not dates.`
Use it only after 1.0.2 is live, since 1.0.1 has no Queue up. It said "the first to tap I'm in is
your duo" (169) until the build 20 merge: since 0088 the first one in by a Duo Pop OR by the
post's code takes the one duo, so a Pop's I'm in can lose to the code.

The build 16 line, for the record (154/170): `DuoQueue finds you a duo, not a date. See who you can duo with in League of Legends Ranked Solo/Duo, match on games and playstyle, then chat and queue up.`

### 2.5 Description (4000 char max) — use this:

**1.0.2 (build 20):** 3,962 characters, 3,988 counting CRLF line ends, measured by script on
15 Oct 2026 after the build 20 merge (build 19's text was 3,939 and 3,965); the same text is in
`C:\Users\stall\Documents\DuoQueue-listing-1.0.2.txt`. All ASCII, so bytes equal characters.

**Build 20 changes** (the client merged from `b19-party`; 0088 and 0089 live since 15 Oct):
- **QUEUE UP** says one duo per Queue up (0088): "the first to answer, by a Duo Pop or your code,
  is your duo" (`answer_duo_pop` and the Duo Call branch of `accept_invite` both lock the
  queue-up, `locked_via` 'pop' or 'call'); "For the next hour, or until you find a duo, you show
  up in Online Now" (a lock turns the sender's `is_looking_now` off; the app's own
  `QUEUE_COPY.matchesSeeYou` says the same); and "Your code stops working once you find a duo or
  stop queueing, or 15 minutes after your hour ends" (a locked call code no longer resolves; the
  app's `QUEUE_COPY.adultsOnly` lists the same three). The old "the first to tap I'm in is your
  duo" is gone, because the post's code can get there first.
- **PARTY MODE** adds the party LFG post (0089, `PartyLfgRow` on the party screen): "Or share an
  LFG post whose code works for 2 hours: the first to join with it takes the last seat, and
  either of you can stop it." Only a party of two posts (`partyLfgView`, `start_party_call`),
  which in this paragraph is you and your match; `PARTY_CALL_TTL` is 2 hours (the extra 15
  minutes is only for someone already signing up, which the in-app ask says);
  `join_party_by_code` fills the seat once, under the party lock; Stop post is on both members'
  screens (`end_party_call`). Players who already have an account join from Matches > "Have a
  party code?", new ones at sign-up, so "join with it" covers both.
- To fit: the picture's parenthetical in YOUR DECK, "Tap in for the full profile: games, shows,
  and playstyle.", "which you can add right there or in Settings" after the Discord username,
  "and complete" after "Blocking is immediate", "the" before "buttons above the message box",
  "and" before "at the same skill level", and "If your game isn't in the list, add it." became
  "Missing your game? Add it.".

The build 19 text was built from the 1.0.1 description (which went live from
`DuoQueue-listing-1.0.1.txt`, not from the block that used to be here). What changed then, and
why each claim is true in build 19 (its QUEUE UP wording is quoted below; build 20's is above):
- **QUEUE UP** is new: the header button and sheet (`src/features/queue/`), Online Now for the hour
  and the push to matches (`start_queue_up` writes what `set_looking_now(true)` writes, 0085),
  Duo Pops (up to 6, opted-in, NA, at most 3 a day, never 01:00 to 09:59 on the recipient's clock:
  `duo_pop_recipients` and `duo_pop_clock_ok` in 0085; off by default: `queue_pop` defaults
  false), and the LFG post with a call code (minted for every queue-up, 0085).
  - "Your matches may get a heads-up that you're free", not "your matches can see you're free":
    nothing in the app shows a match that you are free. `get_online_now` leaves out anyone the
    viewer has swiped on (0060), so a match never finds you in Online Now. What a match gets is
    the "{name} is free to duo right now" push (`notify_looking_now`, 0074), and only at most
    once per 6 hours per match, never 01:00 to 09:59 on their clock, never into a locked chat,
    and only with their "A match queues up" setting (`nudge_online`) and notifications on. The
    app's own `QUEUE_COPY.matchesSeeYou` and `outcomeLine` used to make the same overclaim;
    build 19's 8d6dbf4 fixed both (no "see you're free" is left in `apps/mobile`, checked again
    after the build 20 merge).
  - "The code expires when you stop queueing, or 15 minutes after your hour is up" (build 19):
    Stop ends it at once (`ended_at`), and an hour that simply runs out leaves it working for 15
    more minutes (`looking_until + interval '15 minutes'` in `resolve_invite_code`). Since 0088
    the first duo also ends it, which build 20's text says.
  - "ready to share where you look for teammates", not "to share anywhere": the app's own 18+
    card says "Only share your post where adults look for teammates" (`QUEUE_COPY.adultsOnly`).
- **YOUR DECK** now says the deck puts players in your region first and favors recent players
  (0071's order: a live Power-Up, then same server group, then likers who share a game and your
  group, then seen in 14 days, then Can duo, then the score, then last seen), instead of "puts
  the players you have the most in common with near the top". "Region", not "server": 0071 says
  region "is self-reported location, not a Riot server" (NA East and NA West are one group).
- **PLAY NOW OR PLAN IT** describes the chat buttons (`PlayTogetherChips`) and the Discord editor
  in Settings > Connections; the "I'm free to duo right now" switch it used to name is gone.
- The cap line says **10** most recently active matches (0084, applied 15 Oct).
- "It's not a dating app." became "Teammates, not dates." (the front door's own words), and the
  "PARTIES OF THREE" heading became "PARTY MODE" (no numbers about people in headings). "MORE
  THAN ONE GAME" folded into the deck paragraph to make room.
- The Riot paragraph is `RIOT_NOTICE` from `apps/mobile/src/lib/legal.ts` character for
  character, with the comma after "Riot Games" that the 1.0.1 listing was missing.

```
DuoQueue is how you find people to duo queue with: a teammate for ranked, a third for your party, someone who plays the same games at the same hours. Teammates, not dates. One optional picture, no gender filters. Games come first.

YOUR DECK
Your deck puts players in your region first and favors people who have been on lately and what you have in common: games you both play (at the same skill level), shows and anime you both watch, a language you share, and the hours you usually play. Every card shows one picture if they added one, their League rank or main game, and how many games you share, then their prompts. Swipe to say you'd duo. When you both swipe, you match and the chat opens. Missing your game? Add it.

QUEUE UP
Ready to play? Tap Queue up and pick a game. For the next hour, or until you find a duo, you show up in Online Now, and your matches may get a heads-up that you're free. In North America, up to 6 players in that game who turned on Duo Pops get one. Duo Pops are off until you turn them on, come at most 3 a day, and never arrive between 1 am and 10 am. Each Queue up also gives you an LFG post with your own code, ready to share where you look for teammates. One duo per Queue up: the first to answer, by a Duo Pop or your code, is your duo. Your code stops working once you find a duo or stop queueing, or 15 minutes after your hour ends.

LEAGUE OF LEGENDS: CAN DUO
Play League of Legends in North America? Add your rank, and players whose rank can queue Ranked Solo/Duo with yours light up with Can duo and sit nearer the top of your deck. It's based on the ranks you both listed and League's published duo rules, and the League client has the final say.

PARTY MODE
Want a third? Tap Invite a third in a chat. You and your match swipe on the same players, and when you both say yes, that player gets an invite. Or share an LFG post whose code works for 2 hours: the first to join with it takes the last seat, and either of you can stop it. Parties hold three, invites stay open for 7 days, and your party gets its own group chat.

PLAY NOW OR PLAN IT
In a chat, buttons above the message box say you're free now, pick a time to play, or share your Discord username. Rate the session afterwards: good comms, chill after losses, and showed up on time appear on a player's profile once enough players say so. Link your Steam account in Settings and your profile shows Verified: Steam.

SAFETY, FOR REAL
DuoQueue is 18+ only. Every account confirms a date of birth of 18 or older to sign up. Every profile photo is automatically screened before anyone else sees it. Report or block from a card in your deck, from a Duo Pop, or from a chat. Blocking is immediate: a blocked user can't see your profile again. A hidden-word filter hides messages containing words you pick. A Safety Center covers meeting up safely, scams, and crisis support.

DUOQUEUE+
DuoQueue+ is optional. It lifts the 25-swipes-a-day cap, adds filters for a specific game or show, platform, skill level, playstyle, and recent activity, shows everyone who wants to duo with you at once instead of 3 a day, adds unlimited active conversations, and gives you a Super Ping a day that tells someone directly you want to duo. Weekly, monthly, 3-month, and 6-month plans, all auto-renewing until you cancel in your App Store account settings. Power-Ups are a separate one-time purchase that puts you near the top of other people's decks for 30 minutes. Everything else (matching, Queue up and Duo Pops, Online Now, Highlights, party mode, and chatting in your 10 most recently active matches) is free.

DuoQueue isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

Terms of Use (EULA): https://duoqueue.io/terms
Privacy Policy: https://duoqueue.io/privacy
```

The build 17 description this section used to hold (2,350 characters, "chatting in your 5 most
recently active matches") was superseded by the 1.0.1 listing on 2 Oct and is in git history
before this change; do not paste it.

**The last two lines are not optional and are not decoration.** The 1.0 submission was rejected
under Guideline 3.1.2 on 2026-08-08 for exactly their absence: *"The submission offers
auto-renewable subscriptions but does not include a functional link to the Terms of Use (EULA)
in the app's metadata."* Links inside the app are not enough. Apple wants a Terms of Use link in
the **App Description** field itself, and separately wants a custom EULA registered under
**App Information → License Agreement** when you use your own terms rather than Apple's standard
one. Do both. This is metadata-only, so the fix needs no new build and resubmission is fast.

**Two things in this paragraph changed because the old version described features the app
doesn't have.** Both are worth understanding, because they affect what you sell, not just
what you write:

- **The conversation limit is real, and build 17 sells it (corrected 24 Sept 2026).** An
  earlier pass said "there is no conversation limit" because it grepped only for `raise
  exception`. The cap is enforced without one: `is_conversation_unlocked`
  ([0004_chat.sql:71-118](../supabase/migrations/0004_chat.sql:71)) keeps a free account's 10
  most recently active matches open (5 until migration 0084 raised it on 15 Oct 2026, Cameron's
  decision 3 for 1.0.2; 0084 changed the literal in `is_conversation_unlocked`,
  `get_matches_summary` and `is_conversation_unlocked_for`), `send-message` answers
  `conversation_locked`
  ([index.ts:100-116](../supabase/functions/send-message/index.ts:100)), and Matches shows a
  "Locked" chip. Cameron chose to keep it, so the description says chatting is free in your 10
  most recently active matches and DuoQueue+ adds unlimited active conversations, and the
  paywall (`FREE_ACTIVE_CONVERSATIONS = 10` in `paywallCopy.ts` on build-19) and the review
  notes say the same. 1.0.1 phones still say 5 in their paywall until they update, which
  understates the free tier rather than overstating it. "Most recently active", never
  "most recent": the server ranks by the latest of the match time and the last message, so a
  free account that chats in its two oldest matches keeps those open and locks a newer one.
- **"Legendary Likes ... for extra visibility"** — they have no effect at all. `send_rose`
  ([0048:965](../supabase/migrations/0048_rate_limiting.sql:965)) spends a credit and then calls
  `perform_swipe(target, 'like')` — the identical code path as a free swipe. Nothing records
  that it was a Legendary Like and nothing surfaces it to the recipient. Power-Ups are real
  (`activate_boost` adds +1000 to deck ranking for 30 minutes); Super Pings are real (they
  fire a notification to the recipient). Legendary Likes are not. See the decision at the end
  of this doc before creating `duoqueue_roses_3` in App Store Connect.

The description's Steam-linking claim was double-checked against the live project on
2026-08-06 and it holds: `STEAM_WEB_API_KEY` **is** set as a Supabase function secret, both
functions that use it (`link-steam-callback`, `sync-verified-stats`) are deployed and ACTIVE,
and the six-hourly resync cron from migration 0058 is scheduled. Invoking the deployed
function returns `{"steam":{"linked":0,...},"riot":"skipped"}` — Steam ran, Riot correctly
skipped (no Riot key, deliberate). One honest caveat: `linked: 0` means no Steam account has
been linked yet, so the key's *presence* is proven but a real round-trip to Steam's API has
never been exercised. If you want certainty before review, link your own Steam account once
from Settings → Connections and confirm the badge appears.

### 2.6 What's New in This Version (4000 char max) — 1.0.2, use this:

908 characters, one paragraph, measured by script on 15 Oct 2026 for build 22 (also
in `DuoQueue-listing-1.0.2.txt`; build 19's was 693, build 20's 861). Build 22 adds "The welcome tour
now shows how Queue up works." (the Queue up page in `tourPages.ts`). Build 20 added two sentences, true in the
merged client and live server: "One duo per Queue up: the first to answer, by a Duo Pop or your
code, is your duo." (0088; it replaces build 19's "and the first to tap I'm in is your duo", which
the post's code can now get to first) and "A party of two can share an LFG post too: the first to join
with its code takes the last seat, and either of you can stop it." (0089, `PartyLfgRow`; see the
PARTY MODE note in 2.5).

```
Queue up when you're ready to play: you show up in Online Now, and your matches may get a heads-up that you're free. In North America, Queue up can also send a Duo Pop to up to 6 players in your game who turned them on. Every Queue up comes with an LFG post and your own code, ready to share where you look for teammates. One duo per Queue up: the first to answer, by a Duo Pop or your code, is your duo. A party of two can share an LFG post too: the first to join with its code takes the last seat, and either of you can stop it. Build your card before you make an account. The welcome tour now shows how Queue up works. Share your Discord, say you're free now or pick a time right from a chat. A badge on the Matches tab shows what's new. Forgot your password? Reset it with a code from your email. 10 free active chats instead of 5. Smoother motion throughout, with haptics you can switch off in Settings.
```

It is the plan's R2 draft with these honesty fixes:
- Duo Pops go to up to 6 players (`duo_pop_recipients`' `limit 6`), only ones who turned them
  on, and only in North America, and "can" leaves room for the per-player caps (the draft said
  "players in your game get a Duo Pop").
- Online Now and "your matches may get a heads-up that you're free", not "your matches see
  you're free" (see the QUEUE UP note in 2.5: matches only ever get a capped push).
- "ready to share where you look for teammates", matching the app's 18+ card ("Only share your
  post where adults look for teammates"), where the draft said "to share anywhere".
- "right from a chat" (the draft's words), not "with one tap": Pick a time opens a scheduling
  sheet, and Add your Discord opens an editor when no username is saved.
- The Settings path for haptics (Settings > Appearance > Haptics, `HAPTICS_COPY`).

Added: the Matches badge (`useMatchesBadge`) and password reset by code (the recovery template
is live: read 15 Oct 2026, subject "Your DuoQueue password reset code", a `{{ .Token }}` code,
no link, 6 digits). "10 free active chats instead of 5" is the plan's own draft wording and true
since 0084 was applied on 15 Oct; the 5 stays because it is what 1.0.1 players were told, and the
line tells them it went up.

The 1.0.1 What's New (parties of three, notification taps open the chat) is in
`DuoQueue-listing-1.0.1.txt`. The 1.0 "First release" text that used to be here is in git history.

### 2.7 Screenshots — shot list

Sizing: Apple's mandatory bucket is the 6.9″ portrait one, and it accepts **1320 × 2868**,
**1290 × 2796**, or **1260 × 2736**. Upload one set at whichever you pick and App Store
Connect generates the smaller iPhone sizes from it. **Hit your chosen dimensions exactly** —
ASC rejects an image off by a single pixel.

If your phone isn't a 6.9″ model, resize to the exact target rather than preserving aspect
ratio: no iPhone resolution scales uniformly onto an accepted size (a 1179 × 2556 iPhone 15
Pro shot scaled to 1320 wide lands at 1320 × 2862, six pixels short, and gets rejected). The
required stretch is under 0.3% and invisible. **1290 × 2796 is the closest target for a
1179 × 2556 capture.** Don't crop. An iPhone SE is a genuinely different aspect ratio; don't
stretch a shot from one.

**Reach the paywall from Settings → "DuoQueue+".** That row is unconditional. So is
Deck → "Filters" → "Unlock DuoQueue+" (gated only on not being premium). Every *other* route
is conditional on data the demo account doesn't produce: the Requests upsell ("See them all
with DuoQueue+") renders only when there are *more* requests than the free tier shows, and
the account has exactly 3, all visible free; the swipe-limit prompt needs 25 swipes against
a 13-card deck. Use the Settings path in the review notes and for the IAP review screenshot.
Since build 17 the paywall opens on page 1 of 3, which has no plans on it: swipe left twice (or
use the dots with VoiceOver) to reach page 3. The IAP review screenshot is page 3.

**Capture now, no build needed**: sign in to Expo Go as `review@duoqueue.io` (Part 1.5) and
screenshot the normal iOS way. Skip the paywall screen in this pass — `react-native-purchases`
no-ops inside Expo Go, so it'll show a fallback "Plans aren't available" state instead of real
pricing. Grab that one shot later from a real build once Part 1B step 13 is done.

Six shots, in this order (order matters — the first is what search results show):

1. **Deck** (`app/(tabs)/index.tsx`) — Dae's card (build 12): the picture, the page track, the
   name row, and the three cells with the lit Solo/Duo "CAN DUO" cell. Capture dark and Paper.
   For 1.0.2 (2026-10-15) the first card is Cameron's, in both seed modes. Under `--filming` it
   shows his own photograph but no "CAN DUO" cell, because the review account has no League
   row in that mode; plain mode lights it, on abstract art; `--screenshots` (342d409) gives both,
   his photograph with the lit cell, and is the mode for this shot.
   *"Ranked by the games you both play. Swipe to duo up."*
2. **Own profile** (`app/(tabs)/profile.tsx`) — your card under HOW OTHERS SEE YOU, then the
   HOW I PLAY tiles.
   *"Your profile is your gamer card: games, playstyle, and vibe."*
3. **Requests** (`app/admirers.tsx`) — the three seeded rows with the "Duo Up" button.
   *"People who want to duo with you. Say Duo Up if you're in."*
4. **Match moment** (`app/match/[matchId].tsx`) — the rings locked inside the brackets, "DUO
   LOCKED", both players and the reason strip. Match with Dae from the Deck so the strip reads
   "You can queue Ranked Solo/Duo".
   *"Duo locked. Time to plan a session."*
5. **Chat** (`app/chat/[matchId].tsx`, open Priya) — the seeded 8-message conversation.
   *"Chat to lock in a time. No small talk required."*
6. **Matches list** (`app/(tabs)/matches.tsx`) — sectioned list, Priya's row showing unread.
   *"Every duo in one place, sorted by whose turn it is to reply."*

**Build 12 re-shoot.** Re-record and re-render these five in `marketing/store/out/` (and their
copies in each set's size folders): `set-dark/01-deck`, `set-light/01-deck`,
`set-dark/02-profile`, `set-dark/03-duo-locked` and `set-light/02-duo-locked`. The light set
has no profile shot, and its DUO LOCKED shot is 02, not 03. Then re-cut the App Preview from
new recordings. The deleted-persona (Chase, Bea) and Valorant guards in
`marketing/video/scripts/validate-content.ts` still apply.

One thing to know before you frame shots 2 and 5: there are 14 abstract avatars and 15 demo
rows, so the review account and Priya both carry `avatar-01-circuit-traces.png`. Your own
profile (shot 2) and Priya's chat header (shot 5) therefore show the same artwork. Nothing
in the review notes claims otherwise and a reviewer will never see the two side by side, but
if you want them distinct, the fix is a 15th composition in `generate-demo-avatars.mjs`, not
a change to any persona.

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

**Five products, not six** — `duoqueue_roses_3` (Legendary Likes) is deliberately not in 1.0.
Don't create it in App Store Connect and don't add it to the RevenueCat offering; the paywall
tile is already gone. See "Decisions already made" below.

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
checks for this. Do **not** put the Power-Up consumable in the group.

- **Subscription Group Display Name**: "DuoQueue+" (what the user sees in their own device's
  subscription management screen).
- **Localization**: `en-US` only — the app is English-only.
- **Review screenshot**: ASC requires one on every IAP. **It must be 640 × 920 px** — this
  field is not the store-listing screenshot field and does not take the sizes on Apple's
  screenshot-specifications page. A real device capture (1320×2868, 1179×2556, …) is
  rejected with "The dimensions of one or more screenshots are wrong," and so is 1024×1024,
  which is the *promotional image* spec (a different, optional field) and the obvious wrong
  guess. Convert a paywall capture with:
  ```
  node scripts/iap-review-screenshot.mjs <input.png>
  ```
  which pads to 640×920 rather than stretching, strips the alpha channel iPhone captures
  carry, and verifies its own output. Attach it to all five products.

**In RevenueCat:**

1. Add your real iOS app, connect it to App Store Connect (generate an App Store Connect API
   Key in ASC → Users and Access → Integrations, role "App Manager"; upload it under
   RevenueCat → Project Settings → Apple App Store).
2. **Products** tab — create all five products by pasting each App Store Connect product ID;
   RevenueCat pulls metadata automatically once the key is connected.
3. **Entitlements** — create one entitlement named exactly `premium` (the webhook already
   defaults new subscription rows to this name), attach all four subscription products to it.
   Do **not** attach the Power-Up consumable to any entitlement — the webhook handles it by
   product ID directly.
4. **Offerings** → your default Offering → add five packages: the four subscriptions attached
   via RevenueCat's **standard package type** picker (Weekly / Monthly / 3 Month / 6 Month —
   this is what makes `offering.weekly` etc. resolve in the app; attach to the wrong slot and
   that tier silently vanishes from the paywall, no error), and the Power-Up as a custom
   package (matched by product ID in code, so the package identifier itself can be anything).
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
| Photos | Yes | No | App Functionality (one optional profile picture, moderated before display) |
| Other User Content — bio, prompts, game/show/playstyle preferences | Yes | No | App Functionality (profile content, matching) |
| Other User Content — chat messages (1:1 and party) | Yes | No | App Functionality (core messaging feature) |
| Date of Birth | Yes | No | App Functionality (18+ age gate, legally required) |
| Gender (asked by builds up to 11 only; build 12 removes the step, older answers kept and never shown in the app) | Yes | No | Cameron: remove this row from Apple's label when build 12 ships, or keep it for the stored older answers. If build 11 was ever released (build 12 then ships as 1.0.1), keep this row until build 11 is gone: it still asks for gender at setup |
| Discord Username | Yes | No | App Functionality (optional, user-shared contact handle for outside-app contact) |
| Linked Account Identifiers — Steam ID, display name, rank, playtime | Yes | No | App Functionality (optional verified-stats badge) |
| Push Notification Token | Yes | No | App Functionality (match/message alerts, re-engagement nudges — user-controlled per-type toggles) |
| User ID (internal account identifier) | Yes | No | App Functionality (account system, RevenueCat purchase linkage) |
| Purchase History | Yes | No | App Functionality (subscription/consumable entitlement) |
| Reports & Blocks (who reported/blocked whom, and why) | Yes | No | App Functionality (Trust & Safety, abuse prevention) |

**1.0.2 App Privacy: PROPOSAL FOR CAMERON, NOT A DECISION (plan Q23 and R2).** The table above
is still the 1.0.1 label and nothing in it changes until you say yes. It does not cover four
things that 1.0.2 and the 15 Oct server changes collect. Privacy policy 1.6 (the draft in
`docs/legal/privacy-policy.md` on build-19, not published) already describes all four (the
party LFG posts since the build 20 merge). The
proposed answers, in Apple's own category names:

| Proposed row | Covers | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Diagnostics: **Other Diagnostic Data** | `push_tokens.device_info` (1.0.2 only, `src/lib/appStamp.ts`): app version, build, runtime, update id and channel, embedded or not, OS and OS version, which kind of Supabase key, when it stamped. No device name, identifier or location. | Yes (the token row belongs to the account) | No | App Functionality (which versions are still in use, so problems get fixed and players can be told when an update is needed, the policy's words) |
| (same row) | The notification delivery log (`push_log`, migration 0080, written for every push since 15 Oct, so it applies to 1.0.1 phones today): recipient, kind of push, time, tokens tried and accepted, Expo's status and error code. No title, text or names. 90 days. | Yes (`recipient_id`) | No | App Functionality (checking delivery, dropping pushes that do not arrive) |
| Usage Data: **Product Interaction** | Duo Pop records (`queue_ups`, migration 0085): who was sent a pop, who opened it, who tapped Not now, who tapped I'm in, the call code, and since 0088 who became the duo by the post's code (`locked_via`). 30 days, and a deleted account's id is removed at once. | Yes | No | App Functionality (who may get a pop, the 3-a-day and 3-hour caps, the 7-day Not now memory, one duo per Queue up) |
| (same row) | Party LFG posts (`party_calls`, migration 0089, build 20): the code, the game, who shared it, when it was made, ended and filled, and who joined with it; plus `party_members.joined_by_code` and `lfg_seen_at` on the membership. 30 days for posts; a deleted sharer's posts go with the account and a deleted joiner is removed from the post; the membership columns go with the membership. | Yes | No | App Functionality (who takes the third seat, the 3-a-day join cap, what a code joiner may read of the chat, and that both members can see and stop a post) |

Why these, and what is left to your judgement:
- **Other Diagnostic Data** fits both technical records; neither is crash or performance data,
  so the "Not collected" line below keeps Crash Data and Performance Data. If you accept, that
  line and the Part 0 sentence "the privacy table in Part 3 doesn't need a Diagnostics row" both
  change.
- **Analytics as a second purpose** for the version stamp is the judgement call: the policy says
  it is used "to see which app versions are still in use". The proposal says App Functionality
  only, because what it drives is fixes and update prompts (the minimum version in
  `site/app-status.json`), not product decisions. Add Analytics if you read it the other way.
- **Product Interaction** is new to the label. The swipes (likes and passes) the app has always
  recorded are the same kind of data and were never listed; this row would honestly cover them
  too.
- `push_log` is live for 1.0.1 today, so that part of the label is already behind, not only from
  1.0.2.
- When: in App Store Connect at plan R4 step 7. Then update this table and the "Not collected"
  line to match what you entered, in the same commit that publishes privacy policy 1.6 (when
  1.0.2 is released, not before).

**Sign in with Apple adds no new row.** What Apple shares maps onto rows already in the table:
the email address (or its private relay address, if the user picks Hide My Email) is Email
Address, the name the user chooses to share is used only to prefill Display Name, and Apple's
stable user identifier is part of the User ID row. The Apple refresh token kept for revocation
(`apple_refresh_tokens`, migration 0068) is a credential kept only to revoke the Sign in with
Apple grant when the account is deleted, it is deleted with the account, and it is used for
nothing else, so it does not add a data type to the label.

**Not collected** — do not add these: Precise Location, Coarse Location, Contacts, Browsing
History, Search History, Health & Fitness, Financial Info, Advertising Data, Crash/Performance
Diagnostics (no crash reporting SDK is integrated — if you add Sentry or similar later,
revisit this table).

### 3.5 Age Rating questionnaire — answers

**Read this before you start the questionnaire, because the result will surprise you.**

Apple replaced the age-rating system in July 2025 (mandatory since 31 January 2026). Under
the current one, **user-generated content and messaging/chat are 4+ capabilities** — they are
the *least* restrictive descriptors in the system and they do not raise your rating at all.
18+ is reached only by frequent drugs/alcohol, frequent sexual content, frequent realistic
violence, or gambling. Every one of those you answer "None."

So answering honestly computes to roughly **9+** (from Infrequent profanity), or **13+** if
you tick Social Media. That is nowhere near where this app belongs, and it is not a bug.

**You raise it yourself: Step 7: Additional Information → Age Category and Override →
"Override to Higher Age Rating" → 18+.**

This isn't optional for you. Apple's rule: *"If your app has a EULA with minimum age
requirements that exceed the rating that Apple calculated, you must override to a rating that
adheres to the requirements."* Your [Terms](../docs/legal/terms-of-service.md:37) say 18+ and
`MIN_AGE = 18` enforces it, so 18+ is the required answer, not a preference. The App Store
will show 18+ while the content descriptors still reflect your honest answers below.

**Answer "None" to both In-App Controls.** The 1.0 submission was rejected under Guideline
2.3.6 on 2026-08-12 for answering Yes to Age Assurance on the strength of the DOB gate. That
was wrong: Apple defines Age Assurance as a *"mechanism to confirm an individual's age... declared
age range API; age estimation capabilities; age verification via government-issued passport,
drivers license, national ID."* A date picker the user types into is self-declaration, which is
explicitly weaker and does not qualify. The reviewer looked for the feature, could not find it,
and rejected the metadata as inaccurate. Answering None does **not** affect the 18+ rating, which
comes from the Step 7 override.

If you ever want to answer Yes honestly, the route is Apple's
[Declared Age Range API](https://developer.apple.com/documentation/declaredagerange) — worth
considering for a later version, since several US states now legislate age assurance for
social apps.

Answers, by the current questionnaire's own section names:

| Section → Question | Answer |
|---|---|
| **In-App Controls** — Parental Controls | **None** |
| **In-App Controls** — Age Assurance | **None** (see below, this is not optional) |
| **Capabilities** — Unrestricted Web Access | No (only fixed known URLs: your Privacy/Terms pages and Steam's OpenID login during account linking, both via `expo-web-browser` — no address bar, no arbitrary browsing) |
| **Capabilities** — User-Generated Content | Yes (bios, prompts, chat) |
| **Capabilities** — Social Media | Yes (profile discovery deck) |
| **Capabilities** — Messaging and Chat | Yes (1:1 and party chat) |
| **Capabilities** — Advertising | No |
| **Mature Themes** — Profanity or Crude Humor | Infrequent (free-text chat between real users — hence the hidden-word filter) |
| **Mature Themes** — Horror/Fear Themes | None |
| **Mature Themes** — Alcohol, Tobacco, or Drug Use or References | None |
| **Medical or Wellness** — both questions | None |
| **Sexuality or Nudity** — all three questions | None (photos auto-screened for nudity pre-publish; chat is text-only) |
| **Violence** — all four, including Guns or Other Weapons | None |
| **Chance-Based Activities** — Gambling, Simulated Gambling, Loot Boxes, Contests | None (Power-Ups and Legendary Likes are fixed-price, fixed-content — no loot-box mechanic) |
| **Additional Information** — Override to Higher Age Rating | **18+** |
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
data, never networked.

Two follow-ons an earlier draft got backwards, so don't skip them:

- **Answering "No" does not discharge the U.S. reporting obligation — it's the reverse.**
  Apple: *"If your app uses exempt forms of encryption, you might alternatively be required to
  submit a year-end self-classification report to the U.S. government."* The report is waived
  for apps using *non*-exempt encryption that file documentation with Apple. Check whether you
  owe an annual BIS self-classification report (bis.doc.gov, filed by 1 February).
- **`aes-js` is a third-party library, not OS crypto.** Apple classifies an "industry standard
  algorithm not provided within the Apple operating system" as requiring a **French encryption
  declaration**. Either file that or deselect France in your distribution territories.

Revisit this answer if a future release adds any cryptography beyond HTTPS + this local wrapper.

---

## Part 4 — Draft App Review notes (paste into App Review Information → Notes)

**1.0.2 paste (build 20), written 15 Oct 2026: the block at the end of this Part.** The same text,
with the checks to do before pasting, is in
`C:\Users\stall\Documents\DuoQueue-review-notes-1.0.2.txt`. Measured by script after the build 20
edits: 3,985 characters counting CRLF line ends, without a line end after the last line (3,951
counting a line break as 1, 3,997 counting UTF-8 bytes with CRLF, since each dot of "•••" is 3
bytes); the limit is 4,000, so count again after any edit.

**Build 20 edits** (the client merged from `b19-party`; 0088 and 0089 live since 15 Oct):
- NEW item 3, the party LFG post, with the reviewer's path read from the client: Priya's chat,
  the ••• menu ("Chat options", `ChatHeader`) > "Invite a third" (`create_party`, which returns
  the existing party of exactly these two if there is one) opens `/party/[partyId]`, where
  `PartyLfgRow` shows "Share LFG post" under the deck caption (and the empty party deck leads
  with it). The demo account reaches it: the row shows for a party of exactly two once 0089
  answers (`partyLfgView`), both members are in `public_profiles` for this viewer (a demo viewer
  sees demo rows, itself included) and Priya is a live match (`partyPairCanPost`), and
  `start_party_call` lets the post through because the seed makes both accounts onboarded and
  active, they share a live match, and a demo persona counts as having seen the post
  (`lfg_seen_at` is skipped for `is_demo`). Share asks first (`partyConsent`), then opens the iOS
  share sheet, and writes a note in the party chat. The line 0089 asks for: "A demo party's code
  never resolves, so a reviewer cannot join a party with one" (`party_call_status` is null when
  the sharer or any member is a demo account, so `resolve_party_code` and `preview_party_code`
  return no row and Matches > "Have a party code?" reads "That code did not work. Check it
  against the post.").
- Item 2 says one duo per Queue up (0088): the first in, by "I'm in" on a Duo Pop or by the post's
  code, is matched with the sender and ends it (the code stops resolving, open pops read taken,
  the sender leaves Online Now).
- Item 1 no longer says how long the call code lasts (until Stop, or 15 minutes after the hour,
  and since 0088 also until the first duo): the demo account's code never works, so no reviewer
  can see it, and the room was needed. It says "This demo account's code never works".
- To fit, also cut or shortened without losing a reviewer instruction: "Copy post", "Ophelia does
  not", "(under 18 refused)" in SIGN IN WITH APPLE (item 4 still says it), "with "Not now"",
  "deliberately", "Server-side blocking" (block is still exercised in HOW TO EXERCISE 2),
  "server-side" before row-level security, "the buttons" after the Terms line, "You will see",
  and "artwork" became "art". The NEW IN 1.0.2 items are renumbered 1 to 8.

The build 19 version (3,976 characters counting CRLF, 3,985 once the reseed put Cameron in the
deck line) was built from the 1.0.1 paste (in `DuoQueue-listing-1.0.1.txt`), with:
- the sign-in path first, in Group A's words: "The demo account signs in from the first screen:
  tap "I already have an account", then enter the email and password below." (1.0.2's front door
  has no email fields; `FRONT_DOOR_COPY.haveAccount` in `frontDoorCopy.ts`);
- NEW IN 1.0.2: Queue up and the LFG post (shared only through the iOS share sheet or Copy post;
  the app never posts by itself). For the hour the player is in Online Now and matches MAY get
  the capped "free to duo right now" push (0074); nothing shows a match that someone is free, so
  the notes no longer say "shows as free to matches" (see the QUEUE UP note in 2.5). The call
  code works until Stop, or for 15 minutes after an hour that runs out. The demo account's own
  code never works: both branches of `resolve_invite_code` (0085) require the sender's
  `is_demo = false`, so a reviewer redeeming it sees "That code did not work. Check it against the
  message you were sent." (`InviteBanner.tsx`), and the notes now say so instead of implying it
  works until the queue ends;
- Duo Pops: opt-in, North America only, at most 3 a day, never between 1 am and 10 am local, and
  the review account cannot receive one, so its Queue up shows the honest "No one in League of
  Legends could get a Duo Pop right now" line (`no_players` in `outcomeLine`). Why that holds:
  0085 pops only between accounts with the same `is_demo`; no synthetic persona ever queues up or
  has a push token; and the four pre-launch `is_demo` accounts (real people who could) are kept
  out only by the review account's passes on them, which `duo_pop_pair_ok` checks. So it holds
  only while those passes exist, which the Part 1.5 seed fix must keep. Also read 15 Oct: the
  review account is NA East with League first, its one-day check uses `created_at` (6 Aug), and it
  has no reports against it, so `start_queue_up` reaches the recipient search;
- the visibility sentence: the demo profiles are seen by "this account and four pre-launch tester
  accounts", not "ONLY this account" (`is_demo_viewer()` is true for every `is_demo` caller, and
  the four pre-launch accounts have been `is_demo` since 15 Oct);
- sign-up with the date of birth first and the account created at "Save your card"; "Forgot
  password?" sends a 6-digit code, and the reviewer is told to try it with their own email (the
  demo account's code goes to review@duoqueue.io); the chat buttons; no notification prompt at
  sign-up; the free chat cap of 10;
- SIGN IN WITH APPLE rewritten for 1.0.2 (Apple is on "Save your card" and "I already have an
  account", not the front door);
- the deck line no longer claims Dae and Devon are the first two cards (0071 changed the order;
  they still carry the lit cell, and since the reseed, 697657c, so does Cameron's card, first in
  the deck), and the paywall item and IN-APP PURCHASES are folded into one
  HOW TO EXERCISE line to stay under 4,000. To fit the additions above, the vocabulary list, the
  separate League rank line (folded into the deck line), the plan names, "(was 5)" and two
  repeated "no email code" mentions were cut.

**Before pasting, two things must be true**, or the notes describe something the reviewer
will not see: the plain seed is re-run and re-measured as the 1.0.2 WARNING in Part 1.5 says
(the seed fix is in, 697657c, but the seed was left in `--screenshots`, with Cameron's own
photograph, and the Duo Pop lines rest on the review account's passes on the four pre-launch
accounts, which every run of the fixed seed records); and Queue Up's server pieces are live
(0085 and the new `send-push-notification`, plan S2 and S3), or the sheet falls back to the
queued-by-profile phase and shows no Duo Pop line. Item 3 (the party LFG post) also needs 0089,
and item 2's one duo per Queue up needs 0088: both were applied on 15 Oct 2026 after
`send-push-notification` was deployed (dae7da2), so they are already true; their kill switches
(0089's header) would make item 3 false. The recovery template (plan S4) is already
live: read 15 Oct 2026, subject "Your DuoQueue password reset code", a `{{ .Token }}` code, no
link, 6 digits.

**Length.** App Store Connect caps Notes at 4,000 characters, counting CRLF line ends.

**Build 11 paste (done, 23 Sept 2026).** The cut version that went in for build 11 is kept
outside the repo at `C:\Users\stall\Documents\DuoQueue-review-notes-build-11.txt`: 3,775
characters counting CRLF line ends, with the League rank paragraph, the demo deck's "Can duo
with you" order, and the line saying store media shows real people while the review account
shows abstract art. It drops the 2.1 questionnaire answers, which Apple already accepted when
it approved build 10.

**Build 12 paste.** Kept at `C:\Users\stall\Documents\DuoQueue-review-notes-build-12.txt`: the
build 11 paste plus the optional picture, the card (picture then three prompts, text on a solid
panel), no gender step, and the lit "CAN DUO" cell in place of "Can duo with you". Keep it
under 4,000 characters.

**Build 17 paste.** Kept at `C:\Users\stall\Documents\DuoQueue-review-notes-build-16.txt` (the
build 16 file, updated in place because build 16 was never submitted): NEW IN THIS BUILD gains
the three-page paywall ("Swipe left twice to reach page 3", twice because the pager turns one
page per swipe, and never "use the dots": they are not buttons, only VoiceOver's adjustable)
and the once-only tour after setup (the demo account is already past it), and HOW TO EXERCISE
item 4 says "swipe left twice to page 3" and that DuoQueue+ keeps every conversation open.
Measured 3,954 characters counting CRLF line ends (3,952 without the final line end). Count
again after any edit (App Store Connect's limit is 4,000, counting CRLF line ends).

The long pre-1.0.1 source block that used to sit here (over 4,000 characters, "free accounts can
message in their 5 most recently active matches") is in git history before this change. The
1.0.2 paste:

```
WHAT THIS APP IS
DuoQueue helps adults find platonic gaming partners ("duos"), matched on shared games, playstyle and schedule, not romantic interest. No gender filtering, no romantic language.
"League of Legends" is plain text only: no Riot art, logos, sounds or footage in the app or its store media. Riot's legal notice is at the bottom of Settings.

DEMO ACCOUNT
The demo account signs in from the first screen: tap "I already have an account", then enter the email and password below.
  Email:    review@duoqueue.io
  Password: ipTH0uV9uRfA9O2xsg7eb6WH
Pre-confirmed and onboarded: a Deck of 13 profiles (League Gold II, so Cameron, Dae and Devon show the lit "CAN DUO" cell: ranks that can queue Ranked Solo/Duo together by Riot's rules), a match with "Priya" (8 messages, newest unread), and three profiles under "Requests". Real users never see these synthetic profiles or this account (row-level security); only this account and four pre-launch tester accounts can see them. Their pictures are abstract art. Store screenshots show real people, with consent.

NEW IN 1.0.2
1. Queue up (top right of the Deck): pick a game, tap Queue up. For an hour the player is in Online Now and matches may get a "free to duo" push. "Share my LFG post" sends a plain-text post with a code to the iOS share sheet; the app never posts by itself. A new player who enters the code at sign-up lands on the sender's card. This demo account's code never works ("That code did not work.").
2. Duo Pops: with "Ping players" on, Queue up pings up to 6 players in the same game. One duo per Queue up: the first in, by "I'm in" or the post's code, is matched with the sender and ends it. Opt-in (Settings > Notifications), North America only, at most 3 a day, never 1 am to 10 am local time. Pops never cross between demo and real accounts, and this account cannot receive one; its Queue up says "No one in League of Legends could get a Duo Pop right now."
3. Party LFG post: Priya chat, ••• menu > Invite a third > "Share LFG post" (asks first, then the share sheet). The first to join with its code takes the third seat. A demo party's code never resolves, so a reviewer cannot join a party with one.
4. Sign-up: "Get started" asks for a date of birth first (under 18 refused), then builds the card; the account is created at "Save your card" (Apple or email; Terms line above).
5. "Forgot password?" emails a 6-digit code. Try it with your own email: this account's goes to review@duoqueue.io.
6. Chat: Discord, I'm free now and Pick a time buttons above the message box (Discord also in Settings > Connections).
7. No notification prompt at sign-up; an in-app card asks first, after a Duo or a match.
8. Free accounts can message in their 10 most recently active matches.

SIGN IN WITH APPLE
On "Save your card" and "I already have an account". A new Apple ID with no card is asked for a date of birth on "Confirm your age" before any profile exists. Apple-created accounts do not see the demo profiles. Deleting an Apple account revokes Sign in with Apple through Apple's REST API; an unfinished one can be deleted from any setup screen.

HOW TO EXERCISE
1. Paywall: Settings > DuoQueue+ (or Deck > Filters), swipe left twice to page 3: four auto-renewing plans and a one-time Power-Up, renewal terms under the purchase button, Restore purchases, Terms, Privacy Policy and "Continue with Free".
2. Block and report: Priya chat, ••• menu > Report or Block.
3. Account deletion (5.1.1(v)): Settings > "Sign out or delete account" > "Delete account", two confirmations. Please use a fresh account.

SAFETY
Photos are auto-screened (nudity, gore, apparent minors) before anyone sees them; uncertain ones go to manual review. Five report categories, including Underage. A hidden-word filter.

AGE RATING
18+ via the Override to Higher Age Rating; our Terms require 18+. The server creates no profile without a date of birth of 18 or older.

Contact: support@duoqueue.io
```

---

## Part 5 — Pre-submit checklist

The things first-time submitters most often forget. Go through this right before you tap
Submit, not before.

- [ ] Paid Applications Agreement (Part 1B step 6) shows **Active**, not just "submitted" —
      check Agreements, Tax, and Banking directly; a pending banking/tax section silently
      blocks IAP attachment with no clear error.
- [ ] All four subscriptions and the Power-Up show as **Ready to Submit** (not "Missing
      Metadata") in App Store Connect, and are attached to your build before you submit —
      subscriptions go out with the first binary, not as a follow-up.
- [ ] The review screenshot is attached to at least one IAP product (Part 2.5).
- [ ] `npx eas-cli env:list --environment production` shows `EXPO_PUBLIC_SUPABASE_URL`,
      `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and a **non-`test_`** `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
      — **and the build you are submitting was produced after those were pushed.** Editing
      `apps/mobile/.env` alone changes nothing about the binary; it's gitignored and never
      reaches EAS. A build missing the Supabase pair crashes on launch.
- [ ] **Check the RevenueCat key by eye, because nothing will tell you anymore.** A `test_`
      key used to announce itself loudly — RevenueCat's SDK popped a "Wrong API Key" alert in
      a release build and then threw, which crashed TestFlight build 2 immediately after
      sign-in. `src/lib/revenuecat.ts` now refuses a `test_` key in a release build and logs
      instead, so the app stays up — but the paywall silently shows no plans, which under
      review reads as a broken purchase flow. This is now a quiet failure, so verify it.
- [ ] **Pricing and Availability** is set — price Free, at least one territory. It's its own
      sidebar section, not part of App Information, and Submit for Review refuses without it.
- [ ] The **Age Rating override is set to 18+** (Step 7: Additional Information). The computed
      rating will be 9+ or 13+; if you left it there, the store shows a child-appropriate
      rating for an adults-only app.
- [ ] The build is **attached to the 1.0 version** (Build → + → select). Uploading via
      `eas submit` puts it in App Store Connect but does not attach it to the version.
- [ ] **Build 12:** build 11 is developer-rejected from the 1.0 version first, and build 12 is
      the one attached. The build 12 review notes paste is in.
- [ ] **Privacy policy 1.4** (draft at `C:\Users\stall\Documents\DuoQueue-privacy-1.4-draft.txt`)
      is published the day build 12 goes live.
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
- [ ] **Sign in with Apple is live end to end, in this order, before the build goes to review**
      (build 11 onward): migrations 0067 then 0068 applied (`scripts/db/apply-migration.ps1`,
      dry run first); `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` and
      `APPLE_BUNDLE_ID=com.duoqueue.app` set as function secrets; `apple-authorization` and
      `delete-account` deployed; then the Apple provider turned on in Supabase Auth with client
      ID `com.duoqueue.app`. On a real iPhone: a new Apple ID gets "Confirm your age", an
      `apple_refresh_tokens` row appears for it, and deleting it removes DuoQueue from Settings >
      Apple ID > Sign in with Apple.
- [ ] The SIGN IN WITH APPLE paragraph is in the Notes field (Part 4), and the published privacy
      policy includes the Sign in with Apple additions (`docs/legal/privacy-policy.md`,
      republished to duoqueue.io).

**1.0.2 (build 19) additions** (the order of the work itself is plan R4 in
`docs/superpowers/plans/2026-10-15-build-19.md`):
- [ ] The demo account is repaired: the seed passes every `is_demo` profile that is not one of
      its own personas (done, 697657c), the plain seed was re-run with Cameron's OK after the
      15 Oct `--screenshots` run, and a re-measure shows 13 cards with Cameron, Dae and Devon
      lit, no `profile_media` outside `assets/demo`, and a pass from the review account on each
      of KittyKat, Stallings, Cameron and John (those passes are what make
      the notes' "this account cannot receive one" and its "No one in League of Legends could get
      a Duo Pop right now" true; Part 1.5 WARNING).
- [ ] The four pre-launch accounts are still the only `is_demo` accounts outside the seed's
      personas and the review account, or the notes' "four pre-launch tester accounts" is
      changed to match.
- [ ] 0084 (free chat cap 10) is live before release: the description, What's New, review notes
      and the 1.0.2 paywall all say 10. (Applied 15 Oct 2026.)
- [ ] 0085 and the new `send-push-notification` are live before App Review, function first
      (plan S6), and S6's read-only check returns the six Queue Up functions.
- [x] The recovery template (6-digit code) is live before release (plan S4). Read 15 Oct 2026
      from the hosted auth settings: subject "Your DuoQueue password reset code", a
      `{{ .Token }}` code, no link, 6 digits.
- [ ] Listing pasted from `DuoQueue-listing-1.0.2.txt`: keywords (99 bytes), description,
      What's New; name, subtitle and promotional text unchanged. Q22 answered first.
- [ ] Notes pasted from `DuoQueue-review-notes-1.0.2.txt` (3,985 counting CRLF line ends, build 20).
- [ ] App Privacy answered per the Part 3 PROPOSAL or your changes to it, and privacy policy 1.6
      published when 1.0.2 is released (its effective date set that day). Since the build 20
      merge 1.6 also has the "Party LFG posts" bullet (0089) and says who joined with a Duo
      Call code (0088).

---

## Decisions already made (both are done in code — recorded here so you know why)

**1. Legendary Likes are not sold in 1.0.** `send_rose`
([0048:965](../supabase/migrations/0048_rate_limiting.sql:965)) spends a credit and then runs
`perform_swipe(target, 'like')` — byte-for-byte the same outcome as a free swipe. No flag is
written, nothing is shown to the recipient, no notification fires. Compare `activate_boost`
(+1000 deck ranking for 30 min) and `send_super_ping` (inserts a `super_pings` row that
triggers a notification) — those are real. Selling a consumable with no effect is a
Guideline 3.1.1 problem and a refund magnet, so **the storefront tile is removed for 1.0.**

  **The whole affordance is gone, not just the purchase.** The first pass removed only the
  paywall tile, which left the star button on the Deck still there — and its out-of-credits
  alert offered to "Get more" from a paywall that no longer sold any, a dead end. Both the
  Deck button and the tile are now removed.

  What stayed, untouched: the `send_rose` RPC, the `roses` credits column, the free-daily
  cooldown logic, and the RevenueCat product mapping. Nothing calls `useSendRose` anymore.
  Bringing it back in 1.1 is re-adding two buttons — once the like actually surfaces
  differently to whoever receives it (e.g. a `swipes.is_legendary` flag that pins the sender
  to the top of the recipient's Requests list).

  **Action for you: create five IAP products, not six. Skip `duoqueue_roses_3`.**

**2. Unlimited active conversations are a real DuoQueue+ benefit (corrected for build 17).**
This note used to say free accounts had no conversation cap. They do: `is_conversation_unlocked`
(0004_chat.sql:71-118) keeps a free account's 10 most recently active matches open (5 until
migration 0084, applied 15 Oct 2026 for 1.0.2) and locks older ones until the player unmatches
one or upgrades, and `send-message` refuses a locked conversation. Build 17 kept the cap and
listed it; 1.0.2 raises it to 10, and page 2 of the paywall (`FREE_ACTIVE_CONVERSATIONS`), the
description and the review notes all say 10 and that DuoQueue+ keeps every conversation open.

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
