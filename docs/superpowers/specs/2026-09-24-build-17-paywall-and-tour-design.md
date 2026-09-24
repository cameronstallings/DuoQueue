# Build 17: a three-page swipe paywall, a four-page tour, and an honest chat limit

Decided by Cameron on 24 Sept 2026, after build 16 was ready to submit: hold the submission and
add a multi-page paywall ("multi-step paywalls tend to convert better") and onboarding ("so that
people can understand how the app works"). He picked onboarding option A (the tour) and chose to
keep the free chat limit and sell it. Mockups: session scratchpad `b17-design/` (compare.png).
Detailed designs, research and the compliance review are in `2026-09-24-build-17/`:
`design-paywall.md`, `design-tour.md`, `research-code.md` (Previously's shipped patterns and
DuoQueue's entry points, with file:line), `research-rules.md` (Apple 3.1.1/3.1.2, conversion and
onboarding evidence), `check.md` (the review of the mockups). Those files are part of this spec;
where this file and they differ, this file wins.

## 1. The paywall: three pages, swiped (`apps/mobile/app/paywall.tsx`)

The Previously pattern, in DuoQueue's look: one job per page; a horizontal pager with
`pagingEnabled` and `disableIntervalMomentum`; NO Continue buttons (Cameron: "my natural instinct
is a swipe"); dots as position (the dot row is VoiceOver's adjustable pager, "Page N of 3"); a
one-time 32pt peek on page 1 that is skipped under Reduce Motion, a screen reader, or once the user
has touched the pager; one bar above the pager with a back chevron on pages 2 and 3 (turns the
pager back) and the close X on every page. Nothing on pages 1 and 2 asks for money.

- **Page 1, YOUR DECK:** "Keep swiping. / Choose who shows up." The day's swipes (free 25 a day vs
  unlimited) and the DuoQueue+ filters (game, platform, skill, playstyle, recently active) drawn
  in DuoQueue's UI with a clear locked / preview look, never looking tappable. When entered from
  the daily limit, the copy and the counter reflect that the player is out of swipes.
- **Page 2, WHO WANTS TO DUO:** the count of players who want to duo, the first few rows showing
  rank or main game (NO ages, no names paired with ages), the rest locked; the daily Super Ping;
  and **unlimited active conversations** (free accounts can message in their 5 most recently
  active matches; older ones lock until unmatched or upgraded).
- **Page 3, PLANS:** all four DuoQueue+ plans (Weekly, Monthly, 3-Month, 6-Month; every submitted
  product stays reachable), Monthly selected by default with no misleading badge; per-week price
  and savings computed from the store's own prices; the billed price is the largest number on each
  row; the purchase button names the plan and price; the FULL renewal text (charged to the Apple
  Account at confirmation; renews at the same price unless cancelled at least 24 hours before the
  period ends; the renewal is charged within the 24 hours before the period ends; manage or cancel
  in Apple Account settings; trial wording only when RevenueCat reports the intro offer eligible,
  including that unused free days end when a plan is bought); Restore purchases (telling "Restored"
  apart from "Nothing to restore"); Terms of Use and Privacy Policy as links; "Continue with Free";
  and the Power-Up as a separate one-time purchase, marked "not a subscription".
- **Bugs in today's paywall to fix:** cancelling the Apple sheet must not close the paywall;
  Restore must not always say "Restored"; "Free trial included" must only show for an eligible
  free intro offer.
- **Entry points** (listed in `research-code.md`) pass a `from` param (limit, filters, requests,
  settings, chat) so page 1's copy fits why the player came. The paywall always opens on page 1.

## 2. The tour: four pages, once per account, after profile setup

Replaces the jump from the last setup step straight into the Deck. Same pager, dots, peek rules
and Reduce Motion behaviour as the paywall (share one Pager component, no duplicated logic). Skip
on every page; the last page's button is "Start swiping". Shown once per account (a local flag
keyed by the user id; no migration), never to the App Review demo account (already onboarded).

1. **THE CARD:** an example card (abstract art) that really turns to its prompt page when its
   picture is tapped: "Tap for their prompts."
2. **CAN DUO:** only for players who listed League of Legends with a rank; otherwise this page is
   skipped. "Lit up means you can queue." with the player's own rank line ("In Solo/Duo you can duo
   with Silver to Platinum", from `lolDuoRuleSummary`).
3. **DUO LOCKED:** the rings lock with the brackets (reuse RingsLock and LockBrackets), then a short
   neutral chat. Copy says "Swipe the card or tap the bolt", never "swipe right". No ages.
4. **THIS IS YOUR CARD:** the player's own card as others see it, then "Start swiping".

## 3. Copy and server fixes that ship with build 17

- **Super Ping push** (`supabase/functions/send-push-notification/index.ts`, around line 145):
  "{senderName} is very interested in you" is a dating line. It becomes "{senderName} wants to duo
  with you" (and the title drops the exclamation). This is a function deploy; the text change is
  safe for every shipped client.
- **The store description and review notes** say chatting is free and unlimited; it is not.
  Description: "Everything else (matching, chatting in your 5 most recent matches, party mode) is
  free." and DuoQueue+ gains "unlimited active conversations". Review notes: the paywall is three
  pages, swipe left to reach the plans on page 3; the tour is shown once after setup (the demo
  account is already past it); DuoQueue+ includes unlimited active conversations.
  `docs/APP-STORE-SUBMISSION.md` lines about "there is no conversation limit" are corrected.
- **Settings** DuoQueue+ hint lists the conversations benefit.

## Not in build 17

Contextual tips on the Deck (option B), any change to prices or products, removing the chat limit.

## Testing

- Unit tests for every pure helper (per-week price and savings from store prices, which page 1
  variant each `from` shows, whether the Can duo tour page shows, the once-per-account flag).
- Gates: typecheck, lint, all unit tests, `pnpm audit:contrast` (new colour pairs added).
- Renders of every paywall and tour page with the real-code renderer, looked at before merging.
- Device (Cameron, TestFlight): open the paywall from Settings and from the 25-swipe limit; swipe
  through; buy nothing; Restore; close from every page; a new account sees the tour once.
