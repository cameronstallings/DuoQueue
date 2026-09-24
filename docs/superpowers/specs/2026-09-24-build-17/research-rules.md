**DuoQueue build 17: research on the multi-page paywall and onboarding (2026-09-24)**

Bottom line:
- **Apple's rules allow a three-page swipe paywall.** Prices, the renewal terms, Terms and Privacy links, Restore and the buy button all have to be on the page where the purchase happens. The pages before it have no disclosure requirement as long as they show no prices and no buy button. I found no 2025-2026 rejection of a multi-page paywall as such.
- **The evidence that multi-page paywalls convert better is real but narrow.** It comes from paywalls shown during onboarding. Most DuoQueue paywalls open at in-app moments (out of swipes, filters, admirers, chat, Settings), and nobody has tested multi-page paywalls there.
- **For onboarding, a front-loaded tutorial does not help.** Explain only what is unique to DuoQueue, in a short skippable pager after profile setup, then show one tip at a time in the deck. Tinder, Hinge and Bumble all end onboarding with tips laid over the first deck view.

## A. Apple rules (3.1.1, 3.1.2, Schedule 2, 2.1(b), 5.6)

**A1. What must be on the screen where the purchase happens**
- **Guideline 3.1.2(c):** "Before asking a customer to subscribe, you should clearly describe what the user will get for the price", and meet Schedule 2.
- **Schedule 2, 3.8(b)** must be disclosed "clearly and conspicuously":
  - the subscription title
  - the length
  - the price, and the price per unit if appropriate
  - links to the Privacy Policy and Terms of Use inside the app
- **Where it must appear (RevenueCat's reading):** in the purchase flow without the user having to open anything. Putting the details in a separate view linked from the paywall has been rejected. Putting them below the fold was accepted.
- **Apple's subscriptions page** lists these as required on the sign-up screen:
  - the subscription name, duration and what it provides
  - the full renewal price, "clearly and prominently"
  - a way to sign in or restore purchases
  - "the amount that will be billed must be the most prominent pricing element"; per-week prices and savings must be "in a subordinate position and size"
  - for a free trial: how long it lasts and the price billed afterwards
  - "Keep your offerings simple"
- **Guideline 3.1.1:** a restore mechanism is required for restorable purchases, and purchased credits may not expire.

**A2. Every page or only the purchase page?**
Only the purchase page. Neither Apple's text nor any rejection I found asks for disclosures on pages that have no price and no buy button. RevenueCat's own multi-page paywall product works this way: packages and purchase buttons are allowed "only on the final page", and that page also carries the legal links. RevenueCat counts a paywall impression only when the final page is shown.

The condition: if any earlier page mentions a price or has a Subscribe or Start trial button, the disclosure rules apply to that page too. Previously already follows this pattern, with "Not now" on every page.

**A3. Misleading trials, pre-selected plans, toggles, second offers**
- **Pre-selecting a plan is not banned.** What is banned is misleading prominence (see the billed-amount rule above) and anything that tricks people into subscribing (3.1.2(a): "bait-and-switch" apps are removed).
- **Free-trial toggles:** Apple has been rejecting them under 3.1.2 since mid-January 2026. The rejection text: "The purchase screen includes a toggle to add or remove a free trial ... This design is confusing and may prevent users from understanding that they are committing to an auto-renewing subscription."
- **A second offer shown after the paywall is dismissed** was rejected under 5.6: "attempts to manipulate customers into making unwanted in-app purchases". Adapty also reports rejections of second offers in 2026.
- **Latent DuoQueue issue:** `apps/mobile/app/paywall.tsx` lines 53-55 print only "Free trial included" when a plan has an intro price. That would fail the trial rule if a trial is ever set up. It needs to say the length and the price afterwards (for example "7 days free, then $7.99 per month"). No intro offers are configured today, so nothing is broken yet.

**A4. Must every in-app purchase be reachable?**
Yes. Guideline 2.1(b): in-app purchases must be "complete, up-to-date, visible to the reviewer and functional. If any configured in-app purchase items cannot be found or reviewed in your app, explain the reason in your review notes." All four subscriptions and the `duoqueue_boost_1` Power-Up must stay findable.

A separate known trap: a reviewer's sandbox account that is already subscribed gets stuck on the paywall. That happened to a RevenueCat user in June 2025, and the fix was a fresh sandbox account or a note to review.

**A5. 2025-2026 rejections tied to multi-step paywalls**
None found for the multi-page structure itself. The related enforcement is:
- toggles, under 3.1.2 (January to February 2026)
- second or back-to-back offers, under 5.6
- price and billing period not prominent enough, under 3.1.2 (the most common)
- Terms and Privacy links missing inside the app, under 3.1.2, including repeat rejections where the links were present (Apple forum thread 809635)

## B. Evidence on paywall format, plan count and social proof

- **Multi-page vs single-page.** Superwall looked at more than 40M onboarding paywall opens (February to May 2026). Multi-page converted 12.41% vs 9.07% for single-page, 37% better. Limits:
  - onboarding placement only
  - observational, so the gap may partly reflect which apps chose multi-page
  - multi-page was 24% of opens
  - no category breakdown
  - they suggest starting with 2 to 3 screens
- **Counter-example.** In Stompers' A/B test on Superwall, the single-page paywall won by more than 16% overall and drew more annual trials. Superwall calls both formats worth testing.
- **Secondary claims.** Superwall's "3-4 steps" pattern (value, trial reminder, purchase) and a third-party "20 to 40% uplift" are secondary sources and assume a trial exists, which DuoQueue does not have.
- **Placement.**
  - At Mojo, onboarding produced about 50% of trial starts (RevenueCat).
  - Adapty (March 2026): onboarding paywalls convert 1.35% vs 0.89% for in-app placements, both with trials.
  - A RocketShip HQ summary says paywalls "after a value moment" convert 2.1x better. That figure is unverified and conflicts with Adapty's own numbers, so I did not rely on it.
- **Tailoring to the entry point.** Tinder's paywall research found that a title written for where the user came from improves conversion. Showing every tier at once overloaded users, and a "View more plans" button was a win. Tinder shows 2 plans at a time.
- **Plan count.** Superwall (2022, 32M opens, observational, conversion rate only): 2 products beat 1 by 61%, and 3 beat 2 by 44%. There is no data for 4 or more. Hinge+ shows 3 plans (1, 3 and 6 months). Weekly plans were 55.5% of subscription-app revenue in 2025 (RevenueCat), but churn 30 to 50% at the first renewal.
- **Highlighted or default plan.** RevenueCat says to test the default plan and labels like "Most Popular". Mojo got a 15 to 20% lift in yearly uptake by showing yearly first and hiding monthly behind "View all plans". A claim that "pre-selecting annual gives 69% vs 28%" traced only to secondary blogs, so treat it as unverified.
- **Social proof.** Reviews and "X users" callouts are commonly tested, with the caveat "don't manufacture fake social proof". The FTC rule banning fake reviews and testimonials has been in force since 21 October 2024. DuoQueue has no reviews or users yet, so the only honest proof is inside the product, such as a real count of people who want to duo with you.

## C. Evidence on onboarding

- **Tutorials barely help simple mechanics (Andersen et al., CHI 2012, 45,000 players).**
  - In the complex game, in-context tutorials meant 75% more levels and 29% longer play; tutorials shown out of context gave +25% and +12%.
  - In the two simpler games there was no significant effect, and return rate was even 3.5% lower in one.
  - The authors conclude tutorials "may not be justified for games with mechanics that can be discovered through experimentation."
- **NN/g (Laubheimer 2023; Kendrick 2020; Harley 2014).**
  - Up-front tutorials "interrupt users", are not remembered and "don't result in better task performance."
  - Onboarding is justified when you need user information, or when features are "fairly unique to the app".
  - Prefer contextual help triggered when it is needed, which is easy to dismiss and to find again.
  - Coach marks: one at a time, at the right moment, only for non-standard interactions.
  - If you build a card-by-card tutorial, give it a highly visible Skip.
- **Vevo (Apptimize, 28 days, more than 160,000 users).** Removing the tutorial raised completed logins about 10% and signups about 6%. Most users swiped through without reading.
- **Chameleon (2025, 550M+ interactions, web SaaS rather than mobile).**
  - 3-step tours: 72% completion. 4-step: 74%. 7 or more: 16%.
  - User-triggered tours do 2 to 3x better than timed ones: 67% vs 31% for click-triggered vs delay-triggered.
  - Progress indicators add 12%.
  - Appcues' benchmark page returned 404, so I have no Appcues numbers.
- **What comparable apps do (Page Flows recordings).**
  - Tinder (July 2021): tutorial start, then guide overlays on the deck, then "Get started", then a final overlay.
  - Hinge (February 2023): profile setup, then an upgrade prompt at the end of onboarding, then "Get started", then a guide overlay and guide modal on the home screen.
  - Bumble (October 2022): guide slides plus overlays and tooltips, then a "Liked you" introduction.
  - Discord (May 2024): no tour; you create your first server, so you learn by acting.
  - Duolingo (August 2023): the first lesson comes before signup, and upgrade prompts come during the first lesson cycle. A "20% next-day engagement" figure circulating for Duolingo is unsourced.

## D. Recommendations for DuoQueue

**Paywall**
1. **Build the three-page swipe pager** exactly as Previously does:
   - dots, "Not now" on every page, the one-time peek
   - dots that VoiceOver can page with, a chevron, and a cut instead of a slide under Reduce Motion
2. **Page 1, value, headline tailored to the entry point.** There are 8 routes today, all found in the code:
   - out of swipes: `(tabs)/index.tsx:80`
   - Super Ping: `(tabs)/index.tsx:97`
   - out of Power-Ups: `(tabs)/index.tsx:116`
   - filters: `filters.tsx:216`
   - admirers: `admirers.tsx:165`
   - chat: `chat/[matchId].tsx:478`, `:511` and `:736`
   - Settings: `settings.tsx:55`

   Pass a source parameter. Page 1 has no price.
3. **Page 2, show.** The four features drawn as the real interface (unlimited swipes, advanced filters, everyone who wants to duo, the daily Super Ping). Use the real admirers count only when it is above zero. No price.
4. **Page 3, ask.** Everything the current single page has:
   - the plans, with the billed price as the largest price text and per-week plus computed "Save X%" smaller
   - the "Start subscription" plate
   - the renewal paragraph
   - the Terms of Use and Privacy links
   - Restore purchases and "Continue with Free"
   - the Power-Up row

   The "out of Power-Ups" route should open straight on page 3; otherwise the consumable sits two swipes away.
5. **Keep all four plans visible on page 3, with Monthly pre-selected** (as today). Page 3 has room, 2.1(b) needs them findable, and there is no data on 4 vs 3. Hiding Weekly behind "More plans" is the Tinder-style alternative to test once there is traffic. Never write "Most popular" or any number that is not real.
6. **Never add a second offer when the paywall is dismissed** (5.6), and never a trial toggle (3.1.2).
7. **Add to the review notes:** "DuoQueue+ is three pages; swipe left or use the dots to reach the four plans and the Power-Up on page three." Also ask App Review to use a fresh sandbox account.
8. **Log page views 1, 2 and 3 with the entry point**, so drop-off between pages is visible.

**Onboarding**
1. **No promotional carousel before signup.**
2. **A three-page "How DuoQueue works" pager after the 9-step profile setup,** replacing or extending `welcome.tsx`. It swipes with dots like the Previously tour, has a visible Skip, and its last page holds one plate. Each page draws the real card:
   - **Page 1, the deck:** swipe right to queue up, swipe left to pass, tap the right side of a card for the prompts after the picture.
   - **Page 2, Can duo:** the cell lights when your League ranks can queue Ranked Solo/Duo together, using the existing "League's published duo rules; the League client has the final say" wording.
   - **Page 3, DUO LOCKED:** what happens next. Also state the 25 free swipes a day, so the out-of-swipes paywall is not a surprise.
3. **Contextual first-run tips, one at a time, each shown once:**
   - the first card: the tap zones
   - the first "Can duo" cell
   - the first DUO LOCKED
   - a "5 swipes left today" note near the limit
   - the first time the Super Ping or Legendary Like buttons appear

   Each tip closes on any interaction. The pager can be reopened from Settings.
4. **Sequencing, for Cameron to decide.**
   - **(A) The Previously and Hinge pattern:** the tour ends in a one-time onboarding paywall. This is where the multi-page and onboarding-placement data is strongest.
   - **(B) No onboarding paywall at launch; paywalls only at in-app moments.**
   - **I recommend (B) for build 17.** DuoQueue's value depends on how many players are in the deck. At launch the NA Gold/Plat deck may be thin, and selling "unlimited swipes" before the user has seen anyone risks refunds and bad reviews. Revisit (A) once the deck is reliably deep.
   - If (A) is chosen: show it once, with "Not now" on every page, and do not label the tour's last plate "Start swiping" if it opens a paywall.

**Copy:** no em dashes, no dating cues, and League of Legends as plain text only.

Nothing was written to the repo. The b17-design folder exists and is empty; the temporary PDF helper I used was deleted.

## Sources
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/app-store/subscriptions/
- https://www.revenuecat.com/blog/engineering/schedule-2-section-3-8-b
- https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls
- https://www.revenuecat.com/changelog/release/build-multipage-paywalls-2026-07-31
- https://www.revenuecat.com/blog/growth/rip-toggle-paywall
- https://adapty.io/blog/your-toggle-paywall-is-about-to-get-rejected/
- https://revenueflo.com/blog/common-ios-paywall-rejections-and-the-fixes-that-work
- https://developer.apple.com/forums/thread/768912
- https://developer.apple.com/forums/thread/809635
- https://community.revenuecat.com/general-questions-7/ios-app-store-rejection-reviewers-unable-to-pass-paywall-6486
- https://www.revenuecat.com/blog/growth/the-ultimate-guide-to-app-store-rejections
- https://superwall.com/blog/new-postmulti-page-onboarding-paywalls-convert-37-better-than-single-page-heres-why
- https://superwall.com/case-studies/stompers
- https://superwall.com/blog/two-paywall-trends-driving-arpu-gains
- https://superwall.com/blog/how-many-products-should-you-offer-on-your-paywall
- https://www.revenuecat.com/blog/growth/guide-to-mobile-paywalls-subscription-apps
- https://www.revenuecat.com/blog/growth/paywall-tests-grow-app-revenue
- https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026
- https://www.revenuecat.com/blog/growth/contextual-paywall-targeting/
- https://adapty.io/blog/high-performing-paywall-2026/
- https://www.rocketshiphq.com/adapty-subscription-app-benchmark-2025-summary/ (low confidence)
- https://www.retention.blog/p/tinder-dynamic-paywalls
- https://www.lowermysubs.com/blog/hinge-vs-bumble-vs-tinder
- https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials
- https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf
- https://www.nngroup.com/articles/mobile-app-onboarding/
- https://www.nngroup.com/articles/onboarding-tutorials/
- https://www.nngroup.com/articles/mobile-instructional-overlay/
- https://www.mobileworldlive.com/apptimize-onboarding-tutorials-value-ab-testing (Vevo; figures from the search summary, page returned 403)
- https://www.chameleon.io/blog/mastering-product-tours
- https://www.chameleon.io/benchmark-report
- https://pageflows.com/post/ios/onboarding/tinder/
- https://pageflows.com/post/ios/onboarding/hinge/
- https://pageflows.com/post/ios/onboarding/bumble/
- https://pageflows.com/post/ios/onboarding/discord/
- https://pageflows.com/post/ios/onboarding/duolingo/
- https://goodux.appcues.com/blog/duolingo-user-onboarding

Local files read: `C:\Users\stall\duoqueue\apps\mobile\app\paywall.tsx`, `C:\Users\stall\duoqueue\apps\mobile\app\(tabs)\index.tsx`, `C:\Users\stall\duoqueue\apps\mobile\app\welcome.tsx`, `C:\Users\stall\duoqueue\apps\mobile\src\features\swipe\cardChips.ts`, `C:\Users\stall\duoqueue\apps\mobile\src\features\swipe\CardFace.tsx`, `C:\Users\stall\previously\app\paywall.tsx`, `C:\Users\stall\previously\app\tour.tsx`