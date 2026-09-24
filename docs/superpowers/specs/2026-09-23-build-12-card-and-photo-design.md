# Build 12: one optional picture, a card you can read, the rings lock, and a Profile tab that is not a list

Approved by Cameron on 23 Sept 2026: direction A ("Your card") with the lit Can duo cell, one optional
photo, no gender step, build 12 for the 3 Oct launch. Research, mockups and judge scores are in the
session scratchpad (`app-research/`, `own-profile/angle-a/`, `compare/DuoQueue-options.html`).

Revised the same night on Cameron's word: ONE photo and no gallery at all ("like only one photo...
it's not a dating app... it could be a picture of the character they play"), so a card is the photo
then the three prompts; and the DUO LOCKED rings interlock ships in build 12, before launch.

## Why

- **The card cannot be read.** Every line of text is drawn on the photo over a weak gradient. Measured
  on Dae, card 1 of the review account: meta 1.02:1, rank line 1.12 to 1.24:1 (WCAG needs 4.5:1).
  Paper mode chips top out around 3.3:1 on any photo.
- **Two photos with no reason left.** Commit 271f1d0 (28 Jul) copied Twitter's avatar plus banner;
  850e995 (2 Aug) removed the banner from Profile, but `SwipeCard.tsx:80` still builds the card from
  `[headerPhotoUrl, ...galleryUrls]`, so the same face shows twice on every card. Step 1 of onboarding
  (`display-name.tsx:34`) refuses to continue without both.
- **A required photo proves nothing** (no selfie check; abstract art passes moderation), a face is the
  strongest dating cue on a swipe card, and League duo finders use no uploaded photo at all.
- **The gender step** is collected on screen 2 and used nowhere (no component reads it, no filter is
  set; the column is nullable). It is a dating cue, and `privacy-policy.md:70` wrongly says it is shown.
- **The Profile tab** is six same-width, same-fill boxes stacked vertically: no hero, no density change,
  one surface. That is the "list" feeling.

## Scope of build 12

### 1. Photo model (no migration, no function deploy)

- One square picture in the existing `profile` role. Optional. Any image.
- The cover (`header`) is no longer asked for or uploaded. Readers fall back to it:
  every card and pager reads `profileUrl ?? headerUrl`.
- **No gallery.** The app stops showing and offering gallery photos everywhere: no gallery slots in
  Edit, no gallery pages on the card or the full profile, no gallery item in completeness. Existing
  gallery rows stay in the database untouched and unused (no migration).
- Onboarding step 1 keeps its place for build 12 (moving it after Prompts is 1.0.1):
  - Title "Let's set up your card". Subtitle "Pick the name other players will see. A picture is optional."
  - One slot "Your picture", sublabel "Optional. It shows on your card and next to your name in
    matches. You, your setup, your cat: anything that feels like you." A "Skip for now" path.
  - The `profilePhotoUri && headerPhotoUri` gate is removed; only the name is required.
- Edit: the Photos area becomes "Your picture", one square slot. The COVER tile and the gallery go.
- No-picture states, designed rather than blank:
  - Card: opens on the first prompt page (below). With no prompt, a recessed page with the player's
    initial large (decoration only).
  - `PresenceAvatar` (Online now, Requests, Matches, invites): the initial instead of a blank circle.
  - DUO LOCKED (`app/match/[matchId].tsx:113`, today `photo ? ... : null`): the initial inside the
    brackets, so the moment never disappears.
- Owner status: `useOwnProfilePhotos` reads `moderation_status`. Your own card shows a solid tag:
  "ADD A PICTURE", "PICTURE IN REVIEW" or "PICTURE NOT APPROVED". Copy under the card: "Your picture
  is in review. Until it's approved, players see your initial." / "That picture wasn't approved. Pick
  another one."
- Completeness item "a profile picture" and "a cover photo" become one item, "a picture".
- **Compatibility rule:** build 11 draws the card only from `header`. Build 11 is submitted as a
  manual-release backup and is never released. If it ever is, build 12 must also write the picture to
  `header` until build 11 dies out.

### 2. Gender step removed

- Remove `gender` from `ONBOARDING_STEPS`, delete the screen, stop sending it from the onboarding store.
  The column stays (nullable); existing values are untouched and still never shown.
- Tests that walk the wizard are updated.

### 3. The swipe card: no text ever sits on the photo

Card-scoped tokens only. `surface` and `border` do not change app-wide before launch (that is 1.0.1,
gated by `pnpm audit:contrast`). New tokens, dark / Paper:

| Token | Dark | Contrast | Used for |
|---|---|---|---|
| `cardHero` | #1E2218 | 1.22 vs ground #0A0B09 | card body and plate |
| `cardRecessed` | #0F110C | 1.17 vs hero | empty picture area, prompt pages |
| `cardEdge` | #30362A | 1.30 vs hero, 1.58 vs ground | card border and cell rules |
| `cardPanel` | #171A11 | 1.12 vs ground | top strip, Profile tiles, games panel |

Paper equivalents are derived the same way and must pass the contrast audit.

Deck at iPhone 15 (393x852), top to bottom:
- Title row as today ("Deck", Online, Requests, Filters).
- **Top strip** (345x32, `cardPanel`): three 19pt Highlights faces, "HIGHLIGHTS", "4 PICKED TODAY ›",
  "UNLIMITED SWIPES" / "18 SWIPES LEFT". Tapping opens the Highlights sheet ("Highlights", "Picked
  for you today."). This replaces the ~145pt Highlights row, so the card grows from ~38% to ~57%.
- **Card** 345x483, radius 8, 1pt `cardEdge`, `cardHero`:
  - **Picture area** ~335x340, radius 6. Nothing is drawn on it except the drag stamps (DUO / PASS,
    already solid). No gradient, no avatar, no NO.00X, no menu.
  - **Pages:** `[picture?, prompt 1, prompt 2, prompt 3]`, at most four. Tap the right
    third to go forward, the left third to go back. A profile with no picture opens on prompt 1.
    Prompt page: `cardRecessed`, label 10pt mono, answer Manrope SemiBold 22/30, up to 6 lines.
  - **Page track** under the picture: 2pt segments, current one in text colour (not volt).
  - **Name row:** Unbounded SemiBold 22/28; a green (#3FD68C) dot when recently active; "•••" menu
    (Report, Block) with a 44pt target.
  - **Details line:** Plex Mono 11/16 uppercase, muted: age · region · languages.
  - **Three fact cells** (label 9pt mono muted, value Manrope Bold 15/21), from a new pure
    `cardCells()` in `cardChips.ts` with unit tests:
    1. League rank when showable ("LEAGUE RANK / Gold II"), else the top game and its skill
       ("ROCKET LEAGUE / Ranked Grinder").
    2. When `showsDuoLabel()` is true: **the lit cell**, "SOLO/DUO" over "Can duo", a 2pt volt edge
       bar and a solid volt "CAN DUO" tag with onVolt ink. Otherwise "PLAYS ON / PC · Xbox", else
       "STYLE / Chill". Never a negative label.
    3. "IN COMMON / 3 games" where pair data exists (neutral ink, not amber, not volt).
  - **"SEE FULL PROFILE ›"** as a labelled row at the foot of the plate; the whole plate also opens
    the full profile.
- Removed: the LinearGradient scrim, the 44pt duplicate avatar, the NO.00X mark (it always read 001
  because `SwipeDeck` passes `indexFromTop`), and the amber ">> N GAMES IN COMMON" pill (amber is
  reserved for money, and its full-width container covered "See full profile").
- **The lit rule:** on a card, chartreuse means only "you two fit here". Nothing else on the card uses it.
- Contrast, independent of the image: dark at least 8.30:1 (name and values 14.13, Can duo tag
  16.88); Paper at least 6.10:1.

### 4. Profile tab

- Fixed header: "Profile", Edit.
- "HOW OTHERS SEE YOU", then **your own card**, the same component as the deck. Your card never
  lights. Cells: game, PLAYS ON, "GAMES / 14". Status tag when needed (section 1).
- Caption: "Players who can queue with you also see Can duo and games in common." and, for a League
  player with a rank, the existing `lolDuoRuleSummary` line ("In Solo/Duo you can duo with Silver to
  Platinum").
- Nudge row when incomplete: "Finish your card: add a show" (links to the missing item).
- **HOW I PLAY:** a 2x2 tile grid on `cardPanel`: STYLE, WHEN, COMMS, AFTER A LOSS. The vibe sliders
  are shown as words ("Balanced", "Mic sometimes", "Open to tips"); a tile with no data disappears.
- **Featured prompt:** no box, a 2pt volt bar on the left, answer in large type.
- **GAMES:** one panel with 44pt rows (name left, rank or skill right), "SHOW ALL 14 ›".
- **MORE FROM ME:** remaining prompts as cards that scroll sideways.
- **SHOWS & MOVIES:** outlined chips.
- Photos and the completeness meter move into Edit.
- **Cut line:** if the full tab is not solid on the device by Sun 27 Sept night, ship your card plus
  caption plus status tag on top of today's tiles, and move the rest to 1.0.1.

### 5. Stranger profile (minimal for build 12)

- The pager shows only `profileUrl ?? headerUrl`; gallery pages and the duplicate avatar go.
- The full rebuild (same card on top, a YOU TWO strip) is 1.0.1.

### 6. DUO LOCKED: the rings lock (build 12, Cameron asked for it before launch)

- The match moment (`app/match/[matchId].tsx`) becomes the logo made real. The O+Q monogram's two
  rings (the vector geometry in `src/components/Logo.tsx`, the true weave) start apart, one from each
  side, then slide together and interlock; the existing brackets snap shut around them with a slight
  overshoot, the existing flash and one success haptic; "DUO LOCKED" stamps in (scale 1.25 to 1).
- Under the lock: the two players, each as a small picture or their initial, with names ("You" and
  "Dae").
- A solid reason strip fades in after the lock, stating facts only, never a score: "You can queue
  Ranked Solo/Duo" when the pair is eligible, else "3 games in common", else nothing.
- Then "You and Dae both queued up.", "Send a message", "Keep swiping", as today.
- Works with and without pictures (no more `photo ? ... : null` vanishing). Reduce Motion: the rings
  appear already locked and everything fades in.
- It matches card 02 on duoqueue.io, so the site and the app tell the same moment.

### 7. Motion

- New top card: plate cells appear one after another (fade plus 4pt lift, 140ms, 40ms apart).
- Page turn: 140ms cross-fade; the page track slides over 200ms.
- Pressing the plate dips it to 98% with a spring before the profile opens.
- Reduce Motion: every movement becomes a plain fade.

### 8. Outside the app

- Privacy policy 1.4, published when build 12 goes live: "an optional picture" (line 73), gender no
  longer collected (line 70). Version 1.3 (the website change, separate spec) fixes line 70's false
  "shown to other users" claim now.
- App Review notes: photos optional, the card layout, and the review account unchanged (the seed needs
  no change; its one square image already serves both roles).
- Re-record and re-render store screenshots 01-deck (dark and light), 02-profile and 03-duo-locked,
  and re-cut the App Preview from new recordings. The deleted-persona guard in `marketing/video` still
  applies.

## Not in build 12 (1.0.1)

The "BOTH ON 7 TO 10 PM" cell (one additive
`get_deck` column from the existing `play_window_overlap_hours`), the stranger profile rebuild, moving
the picture step after Prompts, the app-wide surface ladder, lanes, tap-to-edit on your own card, and
a share image.

## Testing

- Unit: `cardCells()` and `cardPages()` (every branch: League ranked and eligible, League ranked not
  eligible, non-League, no games, no picture, no prompts, own card), onboarding steps without gender,
  completeness with one picture item.
- Existing gates: typecheck, lint, vitest, `pnpm audit:contrast` with the new tokens in both schemes.
- Device (Cameron, TestFlight): the review account deck (Dae, Devon lit; Ophelia not), a real photo, a
  profile with no picture, Paper mode, an iPhone SE-sized screen, the Profile tab, DUO LOCKED with and
  without a picture, new signup with and without a picture, Sign in with Apple signup.

## Schedule

Build 12 on TestFlight by Sun 27 Sept night; Cameron's device pass Mon 28; screenshots and preview
Tue 29; submit Wed 30 (developer-reject build 11 first). If build 12 is not clean by Thu 1 Oct night,
release build 11 on 3 Oct and ship build 12 as 1.0.1, writing the picture to `header` as well.
