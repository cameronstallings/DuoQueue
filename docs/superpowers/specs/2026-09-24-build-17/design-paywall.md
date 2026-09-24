The three-page swipe paywall is designed and rendered, and I looked at every PNG. Pages 1 and 2 have no price and no buy button. Page 3 holds all four plans, the purchase button, the renewal terms, Restore purchases, Terms of Use and Privacy Policy, and the Power-Up. Nothing in the repo was touched.

**PNGs** (all in `C:\Users\stall\AppData\Local\Temp\claude\C--Users-stall-duoqueue\55be0b61-1cfc-4cfc-b553-0f4945ecc35c\scratchpad\b17-design\`, 1179x2556, 393x852 @3x unless noted):
- `paywall-p1.png`: the deck page, opened from Settings
- `paywall-p1-limit.png`: the deck page, opened by the 26th swipe
- `paywall-p2.png`: who wants to duo
- `paywall-p3.png`: the plans, Monthly selected
- `paywall-p3-6mo.png`: 6 Months selected; the button and renewal paragraph follow the selection
- `paywall-p3-full.png`: 1179x2790, the whole of page 3 including "Continue with Free"
- `paywall-strip.png`: 2614x1896 @2x, the three pages side by side
- Sources: `gen.mjs`, `render.sh`, `html\`. The mocks use Volt's dark tokens and the app's own TTFs (Unbounded, Manrope, IBM Plex Mono, Ionicons), with fallbacks set to obviously wrong faces so a missing font would show. The `tour-*` and `tips-*` files in that folder belong to the onboarding agent, not me.

## The design

**Frame and mechanics (all three pages)**
- **Presentation:** it stays `presentation: "modal"`, the iOS page sheet (drawn at the measured 59pt top and 39.25 corner radius). Swipe-down to dismiss is a third exit, and no inset changes are needed.
- **Top bar:** solid ground, no title. The X (existing 34pt round button, `goBack`) is on every page from the first frame. Pages 2 and 3 add a back chevron on the left that turns the pager back, not the screen. Each page's own label and title do the heading work.
- **Pager:** one horizontal pager, advanced by swipe only, with no Continue buttons.
  - `pagingEnabled`, `bounces={false}`, `disableIntervalMomentum`; all three pages stay mounted, each with its own vertical scroll.
  - Driven by a Reanimated `useAnimatedScrollHandler`.
- **Footer:** a solid band with a 1px seam (28pt plus the home-indicator inset) holds the dots, so page 3 can scroll under it.
- **Dots:**
  - 7pt each. Off is a hollow ring in `textMuted`; on is solid volt, so the two states differ in fill.
  - The fill follows the finger as you swipe.
  - The dot row is VoiceOver's pager: adjustable, "Page", "N of 3".
- **Peek:** once per open, 1400ms after page 1 has data, the pager slides 32pt and comes back after 450ms. It is skipped under Reduce Motion, with a screen reader on, or once the pager has been touched. This matters because users arrive from a deck where a horizontal swipe means pass or duo.
- **Reduce Motion:** turns made by the chevron or the dots become cuts. The user's own swipe always stays.
- **Illustrations:** the UI drawn on pages 1 and 2 is not interactive and is hidden from VoiceOver behind one summary label.

**How it opens: a `from` param at each entry point.** The rule: page 1 is the page about why you came, and the plans are always last.

| from | Page order | Opens on | Headline |
|---|---|---|---|
| `settings` (default, deep link, the App Review path) | Deck, People, Plans | 1 | "Keep swiping. / Choose who shows up." |
| `limit` (`(tabs)/index.tsx:80`, plus `StandoutCardModal.tsx:43`, which today only shows an alert) | Deck, People, Plans | 1 | "Out of swipes / for today." |
| `filters` (`filters.tsx:216`) | Deck, People, Plans | 1 | "Choose who / shows up." |
| `requests` (`admirers.tsx:165`) | People, Deck, Plans | 1 | the count headline |
| `superping` (`(tabs)/index.tsx:97`) | People, Deck, Plans | 1 | "Send a Super Ping / every day." |
| `powerup` (`(tabs)/index.tsx:116`) | Deck, People, Plans | 3, scrolled to the Power-Up | none |
| `chat` (`chat/[matchId].tsx:478, 511, 736`) | Deck, People, Plans | 1 | default; see decision 1 |

From the swipe limit, the paywall opens on page 1 and not on the plans. Page 1 is exactly about the limit, so the most motivated user swipes twice to reach the plans. Opening straight on page 3 would put the value pages behind a backwards swipe.

**Page 1: Deck** (`paywall-p1.png`)
- **Label:** YOUR DECK
- **Title:** "Keep swiping. / Choose who shows up."
- **Body:** "Free stops at 25 swipes a day. DuoQueue+ has no daily limit, and filters that fill your deck with players you'd actually queue with."
- **SWIPES TODAY:** the real Deck strip twice.
  - Under the tick FREE, it reads "18 LEFT" (the user's real quota).
  - Under WITH DUOQUEUE+, it reads "UNLIMITED" in volt, with a lit edge.
- **DUOQUEUE+ FILTERS** (right-hand tick: SET FROM YOUR PROFILE): NavRow-style rows that can't be tapped, prefilled from the user's own profile.
  - Game: League of Legends
  - Platform: PC
  - Skill level: Competitive
  - Playstyle: Mic required
  - Recently active only: On
  - A row with no profile data shows "Any" in muted text.
- **Limit variant** (`paywall-p1-limit.png`):
  - Label: 25 OF 25 SWIPES USED
  - Title: "Out of swipes / for today."
  - Body: "Free swipes come back tomorrow. DuoQueue+ has no daily limit, and filters that fill your deck with players you'd actually queue with."
  - The free strip reads "0 LEFT". "Tomorrow" is accurate: the counter resets on the profile's local day (`0055:167`).
- **Filters variant** (not rendered): body "Filter by game or show, platform, skill level, playstyle and recent activity, and swipe with no daily limit."

**Page 2: People** (`paywall-p2.png`)
- **Label:** WHO WANTS TO DUO
- **Title:** "{N} players want to duo with you." when the real count is above 3; otherwise "See everyone who wants to duo."
- **Body:** "Free shows you 3 a day. DuoQueue+ shows all of them now, and adds a daily Super Ping."
- **REQUESTS / TODAY panel:**
  - Today's 3 free rows, which free users can already see.
  - A volt line labelled WITH DUOQUEUE+.
  - Five locked blank rings, then "{N} more" / "want to duo with you".
  - Hidden people are shown as a count only: no names, pictures or initials.
- **Honest states:**
  - Nobody hidden: a dashed row, "Anyone past 3 a day shows here with DuoQueue+."
  - No requests at all: "No requests yet. When they come, Free shows 3 a day and DuoQueue+ shows all of them."
- **SUPER PING:** the real Ping button (green diamond) and "One every day" / "Duo someone and send them a notification that you want to play." This matches `send_super_ping`, which records a like and triggers a push.
- **Super Ping variant:**
  - Label: SUPER PING
  - Title: "Send a Super Ping / every day."
  - Body: "It duos their card and sends them a notification that you want to play. DuoQueue+ also shows everyone who wants to duo with you."

**Page 3: Plans** (`paywall-p3.png`)
- **Label:** DUOQUEUE+
- **Title:** "Choose your plan."
- **Caption:** "Unlimited swipes, every filter, everyone who wants to duo, and a Super Ping every day." This is the description of what you get that Guideline 3.1.2(c) asks for on the purchase screen.
- **Four radio rows**, shortest to longest. The billed price is the biggest price text (17pt ExtraBold); the per-week price and the amber Save chip are smaller.

| Plan | Chip | Sub-line | Price |
|---|---|---|---|
| Weekly | none | Billed every week | $4.99 |
| Monthly | SAVE 63% | $1.84/wk, billed every month | $7.99 |
| 3 Months | SAVE 72% | $1.38/wk, billed every 3 months | $17.99 |
| 6 Months | SAVE 77% | $1.15/wk, billed every 6 months | $29.99 |

- **One highlighted plan:**
  - Monthly is pre-selected, as today: amber 1.5px border, faint amber tint, filled amber radio.
  - There is no "Most popular" or "Best value" badge.
  - The pre-selection can't be a trick, because the button and the renewal paragraph both name the selected plan and its price.
- **Why all four stay visible:** Guideline 2.1(b) needs every product findable, there is no data on 4 plans versus 3, and the page has room.
- **Button** (amber, busy label "Confirming"): "Get DuoQueue+ · $7.99 a month". The period changes with the plan: "a week", "a month", "every 3 months", "every 6 months".
- **Renewal paragraph**, directly under the button, for the selected plan: "DuoQueue+ Monthly, $7.99 a month, charged to your Apple Account when you confirm. Renews automatically unless cancelled at least 24 hours before the period ends. Cancel anytime in App Store settings."
- **Links:** "Restore purchases · Terms of Use · Privacy Policy", with Terms and Privacy as underlined links.
- **Power-Up card:** "Power-Up · {n} left" / "30 minutes near the top of other players' decks. One-time purchase, not a subscription." with an amber outlined "$3.99" button.
- **Below the first screen:** "Continue with Free". The X is always visible above it.
- **Trial branch** (nothing is configured today): it appears only when the intro price is $0 and the eligibility check says eligible.
  - Row: "{n} days free, then {price} {period}"
  - Button: "Start {n} days free"
  - Renewal paragraph: "Free for {n} days, then {price} {period}, charged to your Apple Account. Renews automatically unless cancelled at least 24 hours before the trial or period ends. Cancel anytime in App Store settings."
  - Never a trial toggle.
- **Restore results:** "Restored" / "DuoQueue+ is active again." or "Nothing to restore" / "This Apple Account has no DuoQueue+ purchase to restore."
- **Subscribers:** the existing single "You're on DuoQueue+" page with the Power-Up and Done. No pager.

## What code it would reuse and add

**Reuse:**
- Components: `GraticuleBackground`, `GrainOverlay`, `Card`, `Chip` (amber tone), `Button` (premium and ghost), `SectionLabel`, `Skeleton`, `PresenceAvatar`, `NavRow`/`RowDivider` (a static variant).
- Hooks: `useSwipeQuota`, `useStandouts` (the strip faces), `useAdmirers`, `useAdmirersCount`, `usePremiumStatus`, `useOfferings`, `usePurchasePackage`, `useRestorePurchases`, `useConsumableCredits`, `useRequireSession`, `useEditableProfileDetails` (own games, skill, platforms, playstyles).
- Helpers: `stripQuotaLabel` and `highlightsCountLabel`, `savingsVsWeekly`, `LEGAL_URLS`, the `*_LABELS` maps.
- `ScreenContainer`'s `goBack`, exported so `filters.tsx` stops keeping its own copy.

**Add** (in `src/features/premium/paywall/`):
- `paywallCopy.ts`: a pure function from `from` to page order, first page and headline, plus the button label and renewal paragraph per plan. Unit-tested.
- `PaywallPager.tsx`, `PagerDots.tsx`, `PaywallBar.tsx`.
- `usePeek.ts` and `useScreenReader.ts`, ported from Previously.
- `DeckPage.tsx`, `PeoplePage.tsx`, `PlansPage.tsx`.
- `PlanRow` rewritten with a radio and `accessibilityState.checked`; its label reads price, period and saving.
- `PowerUpRow`.
- `DeckStrip` split into a presentational `StripRow` that both the Deck and the paywall draw.
- Billing helpers ported from Previously: trial days with the eligibility check, a period mapping that returns null instead of guessing, and purchase returning `active`.
- One new type token, `heroTitle` (Unbounded 24/30). No new colours.

**The rebuild fixes these bugs in today's paywall:**
- It closes when the Apple sheet is cancelled.
- Restore always says "Restored".
- "Free trial included" shows for any intro price.
- The 3-month and 6-month rows have no selection fallback.
- The raw `router.back()` calls do nothing on a cold deep-link start.
- It uses `selected` where a radio needs `checked`, and the links are bare text with no link role.
- One pending spinner covers both purchases.

## Compliance
- **Only page 3 needs the disclosures.** It carries the plan titles and lengths, the billed price as the most prominent price, the per-week prices and savings in smaller type, the renewal paragraph next to the button, working Terms and Privacy links, and Restore. Pages 1 and 2 show no price and no buy button, so the rules don't reach them.
- **Every product is findable:** all four subscriptions and the Power-Up are on page 3. The `powerup` entry opens there directly.
- **Exits:**
  - The X is on every page from the first frame, never delayed.
  - Swipe-down dismisses the sheet, and "Continue with Free" is at the bottom of page 3.
  - There is no second offer on dismissal (Guideline 5.6), no timer and no trial toggle.
- **Honest numbers:** savings come from store prices, and every count shown (swipes, requests) is real. The FTC rule on fake social proof doesn't come into play.
- **Review notes to add:** "DuoQueue+ opens on a three-page screen: swipe left, or use the dots, to reach page three, which lists all four plans and the Power-Up." The IAP review screenshot should be page 3.
- **Copy:** no em dashes (I checked the generated HTML), no dating cues, and League of Legends appears only as text.

## Decisions and flags for Cameron
1. **The 5-conversation cap** (`0004_chat.sql:71-118`) is still undecided. The paywall copy leaves it out. If the cap stays, this line can go on the People page: "Keep every conversation open. Free keeps your 5 most recent."
2. **Dating cue in the Super Ping notification.** The push reads "Super Ping!" / "{senderName} is very interested in you." (`supabase/functions/send-push-notification/index.ts:145`). The paywall now sells Super Ping, so this matters more. A suggested replacement: "{name} sent you a Super Ping. They want to duo."
3. **App Review will see the other page 2 state.** The review account has exactly 3 requests, so the reviewer sees "See everyone who wants to duo." and the dashed row, not the 12-player version in the mock.
4. **Mock data.** "18 left", "12 players", and Sana, Marcus and Kofi with the abstract demo avatars are placeholders; in the app those rows are the user's real daily three. The Save percentages assume RevenueCat's per-week price at 52/12 weeks a month; check the chips on a device.
5. **No analytics.** The app has no analytics library, so the page-by-page drop-off the research recommended tracking needs something new. It's optional for build 17.
6. **Title line breaks.** The two deck-page titles use explicit line breaks so a single word doesn't end up alone on the last line; larger Dynamic Type sizes will still wrap on their own.