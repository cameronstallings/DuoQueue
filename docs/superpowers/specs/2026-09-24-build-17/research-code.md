# Build 17 design brief: Previously's multi-page paywall, welcome and tour, and what DuoQueue can reuse

This was read-only. No repo edits, no database, no browser, and nothing written to the scratchpad.

## Before designing: three findings

1. **Free users are capped at 5 active conversations, but the docs and the store copy say they are not.** The code enforces the cap in four places:
   - `supabase/migrations/0004_chat.sql:71-118`: `is_conversation_unlocked` gives free users 5 active conversation slots, ranked by latest activity. No later migration redefines it.
   - `supabase/functions/send-message/index.ts:100-116`: returns `conversation_locked` with "Upgrade to DuoQueue+ for unlimited active conversations".
   - `0059_review_demo_visibility.sql:819-836`: `get_matches_summary` flags `is_locked`.
   - `app/(tabs)/matches.tsx:134`: shows a "Locked" chip.

   Three places say the opposite: `docs/APP-STORE-SUBMISSION.md:353-357` ("there is no conversation limit"), the store description ("Everything else (matching, chatting, party mode) is free and unlimited"), and the memory note in duoqueue-project-state.md. The paywall copy (`paywall.tsx:237-240`) and the Settings hint (`settings.tsx` about line 52) leave the benefit out. The deployed function could not be checked here (no database). Cameron has to decide which is true: keep the cap and list it as a benefit, or remove the cap and the chat upsells.
2. **Previously's paywall calls its research this:** "across tens of millions of paywall views, flows that give each screen one job convert about a third better" (`previously/app/paywall.tsx:36-41`). The pattern to reuse is one job per page, not three of anything.
3. **Reviewers need to be told to swipe.** The review notes send App Review to Settings > DuoQueue+ (`APP-STORE-SUBMISSION.md:403`, and `Documents/DuoQueue-review-notes-build-11.txt`). On a paged paywall the plans sit on the last page, so the notes need a "swipe left to the plans" line, and the IAP review screenshot has to be of the last page.

## A. Previously's paywall (`C:\Users\stall\previously\app\paywall.tsx`)

**Route:** `presentation: 'fullScreenModal'` (`app/_layout.tsx:244`). Every entry point passes context (`{campaign: id}`: account.tsx:507, campaign/[id]/index.tsx:839, story.tsx:362/567 and others) so page 1 can show the reader's own table. The `from` param is declared but never used (line 239).

**Pager mechanics (566-586)**
- Horizontal `Animated.ScrollView`, `pagingEnabled`, `bounces={false}`, no Continue plates anywhere.
- Each page is its own vertical `Animated.ScrollView`. All three stay mounted, so each keeps its scroll offset.
- `onScrollBeginDrag` marks the pager as touched. `onMomentumScrollEnd` settles `page = round(x/width)`. Leaving page 1 pauses the audio (365-369).
- There is no `disableIntervalMomentum`, unlike welcome and tour, so a hard fling can skip page 2. DuoQueue should add it.
- `go(i)` clamps the index, scrolls with `animated: !reduce`, and marks the pager touched (370-380).

**Dots (864-910, styles 1267-1271)**
- 6pt, 6 gap, absolute at `insets.bottom + 8`.
- Off is a hollow 1px ring in the `edge` colour, which passes contrast (6.24:1). On is a solid accent fill. The two states differ in fill, not just lightness.
- The fill's opacity is driven by `scrollX` on the native driver, so it follows the finger (389-403).
- The dot row is VoiceOver's pager: `accessibilityRole="adjustable"`, label "Page", value "N of 3", with increment and decrement actions calling `go()`.

**Peek (405-442)**
- Once, 1400ms after page 1 has content, the pager slides 32pt and returns after 450ms.
- It is skipped under Reduce Motion, when a screen reader is on (`useScreenReader`, 1174-1183), or once the user has touched the pager.
- It is marked as done only when it actually runs (Strict Mode safe), and cleanup resets the offset to 0.

**Reduce Motion (1162-1171)**
- Uses a live `AccessibilityInfo` listener.
- Programmatic page turns become cuts and the peek is skipped. The user's own swipe is never disabled.

**One bar over the pager (545-560, 848-862)**
- The bar sits outside the page scrolls, and its title follows the settled page.
- A back chevron on pages 2 and 3 turns the pager back; it does not close the screen. It exists for VoiceOver and hesitant thumbs.
- **"Not now" is in the bar on every page**, calling `router.back()`, and is visible from the first frame.

**Page 1, VALUE (587-649)**
- 440pt scene lit by the mood of the recap's first cue, with the table's figures standing in it.
- Running head "PREVIOUSLY ON <TABLE>", or "A SAMPLE RECAP".
- Title is the recap title, or "Session N" with the numeral in the accent.
- Meta line: "Session N · 8 min".
- A 56pt play disc and a 1pt progress track, then the recap's first paragraph (up to 6 lines).
- If there is no table, a bundled sample plays: "The Causeway", 31s (181-192).
- Nothing to buy on this page.

**Page 2, BUILD (651-683, NightByNight 1027-1120)**
- 300pt scene with the table's arms. Head "THE ARCHIVE", title is the table name.
- One raised panel lists up to 6 of the table's own nights, newest first. Free nights are bright with a play mark. An accent hairline labelled "KEPT WITH PLUS" separates the older nights, which are dimmed with a star. Anything beyond 6 shows as "and N more".
- One caption states the bargain once.
- Three states, chosen by the data and never by what sells better:
  - No table: the example list, labelled "AN EXAMPLE TABLE".
  - A table that has lost nothing yet: all its nights bright, plus a dashed "Every night after these is kept with Plus." row.
  - Real history: split exactly where the server splits it.
- Loading uses bones the same shape as the content (`BuildBones`), then fades in once.

**Page 3, ASK (685-820)**
- Title changes with state: "You have Plus" / "Your GM unlocks it." / "Try it free." / "Keep the story."
- Two plans (Plan component, 942-977). The selected plan is a material change (a printed parchment plate), not a radio dot. `accessibilityRole="radio"`, `checked`, and the label reads price, period and badge.
- The badge is either "N DAYS FREE" or "SAVE X%", with the saving computed from the store's own numbers (447-450).
- Then a flex spacer and a fine line ("Unlocks every table you run as GM.").
- The purchase button names price and period: "Start Plus · $X a year" or "Start N days free", with busy label "Confirming".
- The legal paragraph is specific to the selected plan, with separate trial and non-trial wording (796-800).
- Then Restore purchases, and Terms of use · Privacy as underlined links.
- A player-only branch offers "Send this to your GM" (a share sheet). An entitled user sees Done.

**Billing (`lib/billing.ts`)**
- `Offer` = {id, title, price, amount, currency, period, trialDays, raw} (101-118).
- `periodOf` maps `packageType` ANNUAL/WEEKLY, falls back to the product id, and otherwise returns null rather than guessing (137-147).
- Trial days come from `introPrice` only when the intro price is 0, and only when `checkTrialOrIntroductoryPriceEligibility` reports status 2 (eligible). Unknown counts as not eligible (121-128, 156-170).
- `purchase` returns `active` from `customerInfo.entitlements.active[ENT]` (187-198). A cancel stays on the page silently.
- `restore` tells "Restored" apart from "Nothing to restore" (470-480).
- The database is the authority for access; RevenueCat only decides what to show.

**Welcome (`app/welcome.tsx`): 3 pages before an account exists, once per install**
- Flag `welcome.seen.v1` in SecureStore. The read fails open to "seen", so nobody gets trapped (`lib/welcome.ts`).
- Each page is a scene (`clamp(360, 520, h-300)`), a running head, a title and one meta line. Pages: "AT THE TABLE / Tap the seal. / A line, a name, a moment.", "WHEN THE NIGHT ENDS / One recap. / ...", "NEXT TIME / Previously on… / ...".
- `disableIntervalMomentum`, so one page per swipe.
- Art and dots hand over at the halfway crossing (a JS listener with same-index bail-out, 141-154). Only the current page renders figures.
- Foot: dots (adjustable) and the Begin slot. The slot is held on every page. Begin's opacity is interpolated from `lastX - width/2` to `lastX`, and `pointerEvents` and accessibility are enabled only on the last page (273-280).
- "I already have an account" and "I have an invite" are on every page.
- It redirects home if a session already exists.

**Tour (`app/tour.tsx`): 4 pages after sign-in, once per install**
- Flag `tour.seen.v1`. Home decides at focus (`index.tsx:211-235`), not with a `<Redirect>`, so an invitee's stale state cannot drop them into the tour. Joining by invite marks the tour seen, so players are not sold a GM's plan.
- Pages: "Record it all.", "The cast.", "Your figure." (the account's own dealt figure), "Run one, or join one." (the free and Plus rule in one meta line).
- Two pages that repeated the welcome word for word were removed, because repeated copy "read as an app that does not remember the person".
- Push permission is asked on the first turn away from page 1 (214-222).
- Foot: dots, then the offer plate "See Previously Plus" fading in on the last page. `finish()` marks the tour seen, runs `replace('/')`, then `push('/paywall')`.
- "Skip" becomes "Not now" on the last page and goes home.

## B. DuoQueue today

**`apps/mobile/app/paywall.tsx` (366 lines, one page)**
- `useRequireSession()` (134).
- Layout: `ScreenContainer title="DuoQueue+" showClose`. The title row is fixed and does not scroll, with a guarded X.
- Plans come from `offering.weekly/monthly/threeMonth/sixMonth`, RevenueCat's standard package slots (144-150). The default selection is monthly.
- Each `PlanRow` (28-84) shows title, an amber "Save X%" chip (computed from the store's `pricePerWeek`, 125-131), a "$x/wk" sub-caption and the store's `priceString`. The selected row gets an amber border.
- Power-Up: the `duoqueue_boost_1` package, found by product id (154), shown with its "N left" count (186-206).
- Button `variant="premium"` "Start subscription" (319-325).
- A generic 3.1.2 auto-renew paragraph (336-342), Terms · Privacy (344-358), Restore (360), "Continue with Free" (363).
- Premium users see "You're on DuoQueue+" with Power-Ups and Done (221-232). Loading shows skeletons; an error shows "Plans aren't available right now".
- Route: `app/_layout.tsx:142`, `presentation: "modal"` (iOS page sheet). `ScreenContainer` sets `topInset = 0` when `showClose` is on, so a switch to fullScreenModal would put the header under the status bar.
- Hooks: `useOfferings.ts:18-29`. The purchase hook returns **null on cancel** (48) and refreshes the subscription, consumables and swipe-quota caches (52-58). `usePremiumStatus` reads the database for active/trialing/grace_period.
- Products: `duoqueue_plus_weekly/_monthly/_3mo/_6mo` at $4.99/$7.99/$17.99/$29.99, entitlement `premium`, consumable $3.99.

**Bugs to fix during the rebuild**
1. `handleSubscribe` (166-174) calls `router.back()` even when the Apple sheet was cancelled, so the paywall closes on cancel.
2. `handleRestore` (176-184) always says "Restored" and closes, even when nothing was restored.
3. "Free trial included" (53-55) shows for any `introPrice`, with no eligibility check and no check that the intro price is free.
4. The 3-month and 6-month rows use `selectedId === id` (295, 313) without the default fallback, so if monthly and weekly are both missing, nothing shows as selected.
5. "Continue with Free" and the purchase and restore paths use raw `router.back()`. On a cold start from the `duoqueue://paywall` deep link that does nothing. `ScreenContainer.goBack` handles it.
6. `PlanRow` uses `accessibilityState.selected` where a radio needs `checked`. The legal links are bare Text with no link role.
7. One `purchase.isPending` drives both the subscription and Power-Up spinners.

**Paywall entry points**

| file:line | trigger | notes |
|---|---|---|
| `app/(tabs)/settings.tsx:55` | Settings > Subscription > DuoQueue+ | Always shown. The review path. Premium users land here too. |
| `app/(tabs)/index.tsx:80` | 26th swipe (`SwipeLimitReachedError`, server limit 25 at `0055_moderation_integrity.sql:178`) | Pushes straight to the paywall with no alert. The comment at 70-79 relies on the paywall being one gesture to dismiss. |
| `app/(tabs)/index.tsx:97` | Super Ping as a free user | Alert > Upgrade |
| `app/(tabs)/index.tsx:116` | Power-Up with no credits | Alert > "Get Power-Ups". The intent is the consumable, not a subscription. |
| `app/filters.tsx:216` | DuoQueue+ filters card, "Unlock DuoQueue+" | |
| `app/admirers.tsx:165` | `hiddenCount > 0` | Free users see 3 per day, rotated (`0059:730-731`) |
| `app/chat/[matchId].tsx:478` | Sending in a locked conversation | Alert > Upgrade |
| `app/chat/[matchId].tsx:511` | "Play now" ping, locked | Alert > Upgrade |
| `app/chat/[matchId].tsx:736` | Locked-conversation banner, "Get DuoQueue+" | |
| `src/features/swipe/StandoutCardModal.tsx:43-44` | Swipe limit inside Highlights | Only an Alert, no route to the paywall. Inconsistent. |

None of these pass context to the paywall.

**Onboarding today**
- `steps.ts`: 9 steps.
- `WizardStep.tsx`: 9-segment volt progress bar, "STEP N OF 9", screenTitle, a Continue button, and the "Sign out or delete" exit (73-79).
- First step, `display-name.tsx`: "Let's set up your card" / "Pick the name other players will see. A picture is optional." It prefills the name Apple shared. The optional 160pt square `PicturePicker` has "Skip for now".
- Last step, `discord.tsx`: "Last step: Discord" / "Kept private. You choose per-match whether to share it in chat." Finish calls `submit()` then `reset()`, shows a toast if the picture upload failed, then `router.replace(invited ? "/invited" : "/welcome")` (45-46).
- `welcome.tsx` (55 lines): logo lockup zooms in, "You're all set, {name}!", "Your profile is live...", "Start swiping". That button has to call `refreshProfile()` before `replace('/(tabs)')` (23-26). The onboarding layout redirects the moment `onboarding_completed` flips, and the tabs layout would bounce back to onboarding on a stale profile.
- Nothing explains:
  - The deck: right is duo, left is pass, 25 a day free.
  - The card's pages: picture first, then prompts. Pages turn by **tapping** the right third, not by swiping (`CardFace.tsx:126`).
  - The Can duo cell: the only chartreuse on a card. Its caveat is required (`DUO_DETAIL_CAPTION`, cardChips.ts:24).
  - DUO LOCKED, Highlights and Requests.
- There is no pre-account welcome; sign-in is the front door. The push permission prompt fires cold in `session-store.ts:172` as soon as a profile exists.

## C. Reusable in DuoQueue (the patterns, not Previously's look)

1. **One job per page.** VALUE uses the user's own evidence, HOW is the free/Plus split, ASK is the plans. The price appears only on the last page.
2. **Swipe only, no Continue plates.** One horizontal pager, `pagingEnabled`, `bounces={false}`, plus `disableIntervalMomentum`. Pages stay mounted. Wizard form steps with validation keep their Continue button; the swipe rule is for content pagers only.
3. **Exit on every page from the first frame.** `ScreenContainer`'s fixed title row with the guarded X already does this job. Its title can follow the settled page. Optionally add a chevron that turns the pager back on pages 2 and 3. Never delay or hide the close; Apple rejects that.
4. **Position indicator.** It follows the finger through the scroll offset. On and off differ in fill, and the off rim has to pass 3:1: `colors.textMuted`, because `border` #232720 fails. The same element is the VoiceOver adjustable control ("Page, N of 3", increment and decrement). Volt allows round dots. Alternatively, drive the card's own `PageTrack` (`CardPlate.tsx:47-77`) from the offset.
5. **The peek.** Same rules: once, skipped under Reduce Motion, screen reader, or a touched pager; offset reset on cleanup. It matters more in DuoQueue, where users arrive from a deck where a horizontal swipe means pass or like.
6. **Reduce Motion.** Programmatic page turns become cuts. Use DuoQueue's own `useReducedMotion()` (Reanimated), with fades set to `ReduceMotion.Never` as the match screen and CardPlate do. That hook does not update live, while Previously's `AccessibilityInfo` listener does. Port `useScreenReader` for the peek.
7. **Reanimated scroll offset.** Use `useAnimatedScrollHandler` and a shared value in place of RN `Animated` with the native driver; there are no pagers in DuoQueue yet.
8. **The value page shows the user's own data, never invented data.** Pass `from=` and context from every entry point in the table above. Examples: "25 of 25 today" on a swipe-limit arrival, and the admirer count from `get_admirers_count`. Show the count only; showing the names of hidden admirers would leak premium data.
9. **Honest states in the HOW page.** A dividing line marks what free keeps and what DuoQueue+ adds, like "KEPT WITH PLUS" (for example, swipes 1 to 25 above the line, the rest below). Example data is labelled as an example. Which state is drawn is decided by the data.
10. **ASK page.**
    - Selection is a material change, which PlanRow's amber border already does. Use `accessibilityRole="radio"` with `checked`, and a label that reads price, period and badge.
    - Savings come from the store, which `savingsVsWeekly` already does.
    - The button names price and period.
    - The legal paragraph is specific to the selected plan, placed right under the button.
    - Then Restore, then the Terms · Privacy links.
11. **Billing correctness to port.** `trialDaysOf` plus the eligibility check. `purchase` returns `active` from `customerInfo`. Cancel leaves the paywall open. Restore distinguishes "Nothing to restore". Nullable period mapping that never guesses.
12. **Bones, then one fade-in.** Skeletons per page in the loaded layout's shape, so nothing moves when data lands.
13. **Tour structure.**
    - Replace `app/welcome.tsx` with a 3 or 4 page swipe tour. It is reached only by `discord.tsx:46`, so it runs once per account with no flag. A one-time AsyncStorage flag is needed only if existing users should see it.
    - The last-page plate ("Start swiping") uses a held slot that fades in with the swipe, and its `pointerEvents` and accessibility are gated to the last page. "Skip" is on every page.
    - It must still call `refreshProfile()` before `replace('/(tabs)')`.
    - Pages that show a card should show the user's own card (CardFace in own mode, like "Your figure."). The Can duo page needs a clearly labelled example card, because the cell never lights on your own card.
    - Art stays non-interactive, so no swipeable card inside the pager.
    - Never reuse real people's photos in example cards; use the PlayerMark blank page.
    - Do not repeat the wizard's own words.
14. **Push permission** could move to the tour's first page turn, as in Previously, in place of the cold ask at `session-store.ts:172`. Optional.

## D. What DuoQueue's paywall must keep

1. `useRequireSession()`.
2. The modal route at `_layout.tsx:142`, or matching inset changes if it moves to fullScreenModal.
3. All four live plans from the offering's standard slots, with store prices, $/wk and computed savings. Monthly stays the default.
4. The Power-Up with its "N left" count and its "one-time purchase, not a subscription" line. Legendary Likes stay absent (Guideline 3.1.1). The Power-Up entry (`index.tsx:116`) needs a direct route to it, either `from=powerup` opening on the page that holds it or its own section, so it is never buried behind subscription pages.
5. The auto-renew disclosure next to the button (Guideline 3.1.2 and Schedule 2), Terms and Privacy links (the 2026-08-08 rejection history), Restore purchases, and a way to the free tier on every page.
6. The premium state as a single page with no selling pager: "You're on DuoQueue+", Power-Ups, Done.
7. Loading skeletons, and the "Plans aren't available" fallback.
8. The cache refreshes in `usePurchasePackage` and `useRestorePurchases`.
9. Amber for money only (`variant="premium"`, the amber Save chip), a volt accent, Unbounded, Manrope and Plex Mono.
10. Copy that matches the real benefits:
    - unlimited swipes (free: 25 a day)
    - advanced filters: game or show, platform, skill, playstyle, recent activity
    - everyone who wants to duo at once (free: 3 a day)
    - a daily Super Ping
    - plus the conversation-cap decision from the first finding.

    The rules are no em dashes, no dating cues, and League of Legends as plain text only.

## E. Decisions for Cameron

- Does the new tour end at the paywall, as Previously's does?
- Do invitees, who go to `/invited`, skip the tour as Previously's invitees do?
- Should the Highlights swipe limit route to the paywall?
- Keep or remove the 5-conversation cap (first finding above).