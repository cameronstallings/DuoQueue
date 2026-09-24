**Build 17 design review: the three designs and the comparison sheet**

render-dq has no shot of today's paywall, so the fourth panel in row 1 describes what `app/paywall.tsx` draws today rather than showing a render. I looked at all 25 PNGs and at compare.png. None of the 20 mock HTML files or compare.html contains an em dash or en dash. League of Legends appears only as text, with no Riot art, and every picture is abstract art.

**PAYWALL: App Review (3.1.1 / 3.1.2 / 2.1)**
1. **Must fix (3.1.2 and Schedule 2):** the renewal paragraph on page 3 leaves out two things today's paywall says (`paywall.tsx:337-341`). It never says the renewal is charged within 24 hours before the period ends, and it never says it renews at the same price. Suggested wording: "DuoQueue+ Monthly, $7.99 a month, charged to your Apple Account when you confirm. It renews at $7.99 a month unless cancelled at least 24 hours before the period ends; the renewal is charged within the 24 hours before it ends. Cancel anytime in your Apple Account settings." The trial version should also say that unused free days end when a plan is bought.
2. **Must fix before the paywall sells Super Ping:** the push notification reads "Super Ping!" / "{senderName} is very interested in you." That is a dating cue (`supabase/functions/send-push-notification/index.ts:145`). I agree with the designer's replacement.
3. **Risk (2.1, finding the purchases):** Settings is the path App Review takes, and it opens on page 1, which has no plans and no buy button. The only hints are the dots and a one-time peek, and the peek is skipped under VoiceOver and Reduce Motion. So the review-notes line and a page-3 IAP screenshot are required, not optional.
4. **Check in App Store Connect:** `README.md:200` says Monthly has a 7-day free trial, but `docs/APP-STORE-SUBMISSION.md:465` lists no trial. If Monthly does have an intro offer, the pre-selected plan shows the trial version, and the mock is not what users will see.
5. **Checked and fine:**
   - The per-week prices ($1.84, $1.38, $1.15) and the savings (63%, 72%, 77%) match the list prices.
   - The billed price is the largest price on each row.
   - Monthly is pre-selected with no badge, and the button and renewal text name the chosen plan, so the emphasis isn't misleading.
   - All four subscriptions and the Power-Up are on page 3, and the Power-Up says it is not a subscription.
   - The X shows on every page. "Continue with Free" sits below the fold on page 3, which is acceptable because the X is always there.

**PAYWALL: design and copy**
6. **Dating cue on page 2:** "Sana, 24 / Marcus, 29 / Kofi, 26", then "12 players want to duo with you" and five padlocked rings, is Tinder's "see who likes you" layout. The ages match what the Requests list already shows (`admirers.tsx:48`), but on a sales page I'd show rank or main game instead.
7. **Page 1 filter rows:** they look like tappable rows with chartreuse values but do nothing when tapped, and "Recently active only: On" reads like a current setting. They need a lock icon or a muted "preview" look.
8. **Page 1 strips:** the "HIGHLIGHTS 4 PICKED TODAY ›" strip appears twice with a chevron. The only real difference between the two is "18 LEFT" against "UNLIMITED".
9. **Dots differ between the two pagers:** the paywall uses 7pt dots whose fill follows the finger. The tour uses 6pt dots, 8 apart, that snap: the mid-swipe frame shows dot 4 fully lit about 70% of the way through the turn. Both designs say the dots are shared, so one spec needs picking.
10. **Ping:** the Deck button says "Ping" while the paywall says "Super Ping", and neither onboarding option explains it.

**OPTION A: TOUR**
11. **Gesture conflict:** the tour turns pages by swiping sideways, while page 3 teaches "Swipe right… to queue up". Swiping Kai's card turns the tour page instead.
12. **Dating cues:**
    - "Swipe right".
    - The chat "How about Thursday at 7?" / "Locked in for Thursday at 7." reads like setting up a date out of context, even though it is existing store copy.
    - Kai's age, 24.
13. **Unranked players (`tour-2-unranked.png`):** "YOU · UNRANKED" sits under a lit CAN DUO cell, which can never light for that player. Either grey the cell or skip page 2 for unranked players, as Option B does.
14. **Length and review:** it adds four screens after a 9-step setup, and App Review never sees it on the demo account.

**OPTION B: CARD, THEN TIPS**
15. **Tip 1 can't be tried:** it says "Tap the picture for their prompts", but a tap anywhere just moves to the next tip. Taps inside the cutout should turn the card as well as advance.
16. **Tip 3 needs a rule:** it rings the X and the bolt, so the spec has to say taps there are swallowed. Otherwise someone passes on or duos Dae by accident.
17. **Dating phrase:** "Swipe right to duo, left to pass".
18. **App Review:** the reviewer hits the full-screen overlay on the first Deck, so the review-notes line is needed.
19. **Trivial:** "This is your card" has no full stop here, while the tour's titles do.

**Files** (compare.png rows: paywall pages 1-3 plus today's described paywall, Option A pages 1-4, Option B card plus tips 1-3; each row has 3 pros, 3 cons and a "Fix first" line):
- C:\Users\stall\AppData\Local\Temp\claude\C--Users-stall-duoqueue\55be0b61-1cfc-4cfc-b553-0f4945ecc35c\scratchpad\b17-design\compare.html (self-contained: JPEGs and TTFs inlined, about 2.1 MB)
- C:\Users\stall\AppData\Local\Temp\claude\C--Users-stall-duoqueue\55be0b61-1cfc-4cfc-b553-0f4945ecc35c\scratchpad\b17-design\compare.png (3360x4546)
- C:\Users\stall\AppData\Local\Temp\claude\C--Users-stall-duoqueue\55be0b61-1cfc-4cfc-b553-0f4945ecc35c\scratchpad\b17-design\build_compare.py
- C:\Users\stall\AppData\Local\Temp\claude\C--Users-stall-duoqueue\55be0b61-1cfc-4cfc-b553-0f4945ecc35c\scratchpad\b17-design\shoot_compare.sh