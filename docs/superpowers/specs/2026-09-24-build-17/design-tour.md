Option A is a four-page swipe tour. It replaces `app/welcome.tsx`, runs once after the profile setup finishes, and hands straight to the first Deck. I rendered all four pages, five variants, a mid-swipe frame and a strip, and checked each PNG by eye.

## Where it goes: after profile setup, not before sign-up

- **The last page needs a profile.** "This is your card" shows the player's own card, which exists only after the 9-step setup.
- **The research argues against a tour before sign-up.** Tutorials shown up front are not remembered (NN/g), and Vevo got about 6% more signups by removing its tutorial. Sign-in stays the front door.
- **It sits in the right place.** The tour lands one tap before the real Deck, so it is as close to the moment of use as a tour can be.
- **No new route or flag.** `welcome.tsx` is reached only from `discord.tsx:46`, so the tour runs once per account. Invitees still go to `/invited`, and existing build-16 users never see it.
- **A Settings row can replay it** ("How DuoQueue works"). In that mode the button reads "Done". This is optional.

## Layout on every page (393 x 852)

- **Background:** the Graticule grid and grain, as on every other screen.
- **Picture area** from 71 pt, 458 pt tall.
- **Text block** at 549 pt, 154 pt tall, top-aligned so the heading never jumps between pages:
  - a small heading in Plex Mono 10/14, muted colour
  - the title in Unbounded 22/28, at most two lines
  - one sentence or two in Manrope 15/22, muted colour, at most three lines
- **Bottom row:** dots, then one 57 pt button slot.
  - Dots are 6 pt and 8 apart. The current dot is a solid chartreuse fill; the others are 1 pt `textMuted` rings, well above 3:1 contrast.
  - The slot shows "Skip" on pages 1 to 3 and the "Start swiping" button on the last page. Both go to the Deck.
- **Moving between pages:** swipe only, no Continue buttons.
  - Uses `pagingEnabled`, `disableIntervalMomentum` and `bounces={false}`, and every page stays mounted.
  - The dots are VoiceOver's page control ("Tour page, N of 4", swipe up or down to turn).
  - Under Reduce Motion, turns made through VoiceOver cut instead of sliding. The player's own swipe always works.
  - One 32 pt peek at 1400 ms, skipped under Reduce Motion, when a screen reader is on, or once the pager has been touched.
- **Found by rendering the mid-swipe frame:** if Skip and the button fade on the same curve, "Skip" shows through the half-faded button. They have to fade on separate halves of the swipe:
  - Skip goes from 1 to 0 over `[lastX-w, lastX-w/2]`.
  - The button goes from 0 to 1 over `[lastX-w/2, lastX]`.
  - Taps and VoiceOver focus follow the page the pager has settled on.
- **Start swiping:** keep `hapticSuccess()` on mount, then `refreshProfile()` before `replace('/(tabs)')`, exactly as `welcome.tsx` does now.

## The pages

**1. The card.** The picture is the real `CardFace` for Kai, an example player. It has an EXAMPLE tag in the card's existing tag slot and abstract art in place of a photo. Taps work, so the player can turn Kai's pages themselves (the tour has no drag gesture).
- A dashed chartreuse outline marks the right third, with a tap ring and a "NEXT PAGE ›" tag. The left third has a "‹ BACK" tag.
- The hint fades once the player taps. The ring pulses twice, and not at all under Reduce Motion.

**2. Can duo.** Shown only when the player listed League of Legends, is in NA East or NA West, and is not Master or above (the cell never lights for those). Otherwise the tour is 3 pages; the 3-page page 1 is `tour-1-noleague.png`.
- The picture is Kai's card at 345 x 304. Everything is dimmed to 35% except the League rank cell and the lit Can duo cell.
- Below it is a "YOU · GOLD II" panel with the player's own `leagueRuleLine`, the required caveat, and the unranked sentence when there is no rank.
- Kai's rank is in the player's own tier, so the lit cell is true for them. For an unranked player it stays Gold I as a labelled example.

**3. Duo locked.** The picture is two panels:
- the real mark at its end state (`RingsLock` and `LockBrackets` at 1), "DUO LOCKED", and "You and Kai both queued up."
- a chat with three bubbles taken from the store thread copy that was already checked

**4. Your card.** The player's own card through the Profile tab's code, drawn at 345 x 483 and scaled to fit (0.948 here), and tappable. The sentence under the title changes with the picture state (`tour-4-review.png`, `tour-4-nopicture.png`).

## Exact copy

| Page | Heading | Title | Sentence under it |
|---|---|---|---|
| 1 | THE CARD | Tap for their prompts. | Pictures first, then prompts. Tap the right side of a card for the next page and the left side to go back. Try it here. |
| 2 | CAN DUO | Lit up means you can queue. | Can duo lights up when the ranks you both listed can queue Ranked Solo/Duo together. |
| 3 | DUO LOCKED | Both queue up. Duo locked. | Swipe right or tap the bolt to queue up. When they queue up with you too, chat opens. Free accounts get 25 swipes a day. |
| 4 | YOUR CARD | This is your card. | It's what players see in their deck. Tap through it, and change anything later from Profile. |

- Page 2 and 3 titles use a no-break space ("can queue.", "Duo locked.") so they break well.
- **Page 2 panel:** "YOU · GOLD II" / "In Solo/Duo you can duo with Silver to Platinum." / "Based on League's published duo rules. The League client has the final say."
- **Page 3 chat:**
  - Kai: "Perfect, I'll take ADC. When are you usually on?"
  - You: "Most days from 6. How about Thursday at 7?"
  - Kai: "Locked in for Thursday at 7."
- **Page 4 alternatives:**
  - Picture in review: "It's what players see in their deck. Until your picture is approved, they see your initial."
  - No picture: "It's what players see in their deck. Add a picture any time from Profile."
- **Kai's prompts:**
  - "The role I always end up playing is" / "Support. I ward, I peel, and I type gg even when we lose."
  - "My most underrated pick is" / "Bard. Nobody follows the chimes, and that is on them."
  - "My comfort game is" / "Stardew Valley between ranked games."
- **Buttons:** "Skip" and "Start swiping". Optional push-prompt rule below.

## Code

**Reuse:**
- `CardFace`, with `cardCells`, `cardPages` and `cardDetailsLine` on a DeckCard-shaped Kai with `lol_duo_eligible: true`
- the Profile tab's card code (`OwnCardSection`), `leagueRuleLine` and `lolDuoRuleSummary`
- `RingsLock` and `LockBrackets` with their animation values fixed at 1
- `GraticuleBackground`, `GrainOverlay`, `Button`, the type tokens, `hapticSuccess`, `useReducedMotion` and `refreshProfile`
- Previously's `tour.tsx` pager pattern, ported to a Reanimated scroll handler

**Add:**
- `app/welcome.tsx` rewritten as the pager, same route
- `src/features/tour/pages.ts`: a pure function deciding which pages apply, with a unit test
- `src/features/tour/exampleCard.ts` (Kai), `TapHint.tsx`, and dots shared with the paywall pager
- `OwnCard` pulled out of `OwnCardSection`
- a small bubble view with the chat's styles. Bubbles are inline in `app/chat/[matchId].tsx` today.
- `CardFace` gets an optional `onPageChange` so the hint can fade after the first tap
- one bundled picture: `assets/demo/avatar-09-triangle-mesh.png` (936 KB, downscale it)
- There is no analytics library, so page views are not logged.
- **Short phones:** page 2's picture strip shrinks and page 3 keeps its last two bubbles. This needs an SE render to confirm.

## Compliance

- **No prices and nothing to buy in the tour,** so Apple's subscription disclosure rules (3.1.2 and Schedule 2) do not apply. "25 swipes a day" is a plain fact, not an offer.
- **Kai is invented,** uses abstract art and carries an EXAMPLE tag. No real person and no social-proof claim.
- **League of Legends appears as plain text only,** with no Riot art. The required Can duo caveat is included.
- **No em dashes.** I searched the mockup source for them.
- **Two possible dating cues:**
  - "Swipe right" is the literal gesture but is a dating-app phrase. The alternative is "Swipe the card right, or tap the bolt, to queue up."
  - The example card shows an age (24) because the shipped card layout always does.
- **App Review never sees the tour on the demo account,** because that account already has a profile. To see it, a reviewer has to create a new account. One line in the review notes covers it.

## Decisions for Cameron

1. **Ending:** the tour ends on "Start swiping" into the Deck, with no paywall, as the research recommended. If the tour should end at the paywall instead, the button must not say "Start swiping".
2. **Push prompt (optional):** the permission prompt currently fires cold as soon as the profile loads (`session-store.ts:172`). It could move to the turn off page 3, or to Skip or Start swiping if not asked yet, with the cold ask kept for accounts that never take the tour.
3. **"Swipe right":** keep it, or use the alternative wording above.

Files are in `C:\Users\stall\AppData\Local\Temp\claude\C--Users-stall-duoqueue\55be0b61-1cfc-4cfc-b553-0f4945ecc35c\scratchpad\b17-design\`. Every PNG is 1179 x 2556 except the strip (3460 x 2080). The mockup source is in `tour-src\` (`build.mjs`, `shoot.mjs`, the HTML pages).
- tour-1.png
- tour-2.png
- tour-3.png
- tour-4.png
- tour-strip.png
- tour-1-tapped.png
- tour-1-noleague.png
- tour-2-unranked.png
- tour-4-review.png
- tour-4-nopicture.png
- tour-3to4-mid.png