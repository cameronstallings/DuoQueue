# duoqueue.io: the film gets its own page, the boxes become three cards that move

Approved by Cameron on 23 Sept 2026: website option 2 ("Wildcard"). Prototype and renders:
session scratchpad `site/proto-wildcard/`; research and judge notes in `site-research/`. This spec is
that prototype plus the judges' fixes. It ships independently of App Review.

## Why

- The dark 21 s film sits as a black block in the light page and breaks its flow, and every visit
  downloads 2.9 MB for it. Most visitors arrive from a video already.
- "What you are joining" is three cut-out app fragments of different widths with heavy shadows: the
  "chopped" look. The first one claims "3 GAMES IN COMMON" but lists two.
- The closing lockup (big logo, a second button, "duoqueue.io") repeats the header and the hero.

## Pages

### `/` (and `/waitlist/`, `/tt/`, `/ig/`, `/yt/`, all from one function)

- Header: logo, then "▶ WATCH · PRIVACY · TERMS · SUPPORT". The Watch link is emitted only when the
  film is on (a module-level flag), so it can never point at a missing page.
- Hero copy unchanged. "duo" is set in ink over a chartreuse highlighter stroke, as prototyped
  (15.11:1). If the stroke reads as a smudge on a real phone, go back to today's olive "duo" with no
  stroke.
- The form, the 18+ checkbox, the promise line and the fine print are byte-identical to live.
- **Trailer button** under the fine print on phones and under the copy column on desktop: a light pill
  with an olive play disc, "Watch the trailer" and a "0:21" chip. It links to that channel's own watch
  page.
- **What you are joining:** three cards of identical size, corners, shadow and inner screen height,
  with the moment on top and "01 / 02 / 03" plus a sentence-case line below:
  1. Three game rows (League of Legends · Gold II, Rocket League · Ranked Grinder, Valorant ·
     Competitive) and a badge that counts up NO, 1, 2, 3 GAMES IN COMMON as the rows land.
     "You match on what you play, and how you play it."
  2. The logo's two rings slide together and interlock, the brackets snap shut, DUO LOCKED stamps in.
     "And when it is mutual, you are a duo."
  3. "you on tonight?" arrives, "yep, queue at 9" types into the box, send presses, the bubble
     appears. "Then you talk, and queue up."
- **The plain version:** unchanged text; each divider draws across.
- **Join again:** a small outlined "join the waitlist ↑" link after the plain version, plus the slim
  top bar (logo and "join the waitlist ↑") that slides in only after the form has fully left the
  screen. Where the bar is unsupported it is simply absent; the link still works.
- Support card restyled to match the cards (full width on desktop, heading left, text right). Text
  unchanged. Footer unchanged.
- The lockup section is removed from all five landing pages. Its CSS stays while `/waitlist/thanks/`
  uses it.

### `/watch/` (plus `/tt/watch/`, `/ig/watch/`, `/yt/watch/`)

- Dark, on the app's own colours. The film at up to 400px wide with native controls; it autoplays
  muted and does NOT loop, so it rests on its last frame, "Duo queue tonight."
- "THE TRAILER · 0:21", headline "from the first swipe to queueing up", the 18+ / not dating line.
- A chartreuse "join the waitlist" button to that channel's form (`/tt/#waitlist-form` and so on), so
  channel attribution survives a visit to the film. The promise line and a dark footer with every
  legal link. Page title "Watch the trailer | DuoQueue".

## Motion (CSS only; the site promises no JavaScript)

- Every animation ends on the finished page, so an unsupported browser shows the complete page.
  Nothing loops or moves by itself after it settles.
- Hero pieces rise in on load (267ms each, 60ms apart); the highlighter swipes in.
- **Phones:** each card plays its moment as it scrolls into view (`animation-timeline: view()`), with
  ranges short enough that the moment finishes before the card's middle reaches mid-screen.
- **Desktop (860px and wider):** the three moments play once on load as a timed sequence, done by
  about 3 s, so the first screen is never half-built.
- `/` to `/watch/`: cross-document view transition (240ms cross-fade; the play disc grows into the
  film frame).
- **Reduce Motion means zero animation**, including the top bar, the highlighter and `/watch/`.
  Verified with `--force-prefers-reduced-motion`.

## Build and deploy changes

- `scripts/build-site.mjs`: `waitlistBody` loses the film section and the lockup, gains the trailer
  block and a `momentsHtml()` that replaces `FRAGMENTS` / `beatsHtml`; `pageShell` gains `theme`,
  `film` and `qbar`; `FILM_CSS` becomes the watch page CSS and `filmSection()` becomes
  `buildWatchPage({ channel })`; `main` writes the four watch pages. Old box CSS is deleted.
- Strip CSS comments at build time (about 50 KB less per page, and it removes the em dashes from page
  source).
- Contrast audit: add every new pair (ink on chartreuse, the badge colours on white, the chat
  colours, the top bar at its worst case, the dark watch page) and retire the pairs whose elements are
  gone. Drop the 0.8 opacity on game detail text (3.91:1 fails AA). Section labels capped at 14px.
- `scripts/deploy-site.mjs`: `REQUIRED` gains the four watch pages; the film live check moves to
  `/watch/`; add a check that `/` links to `/watch/`, and an `absent` check that `/` no longer
  contains the film.
- Privacy policy 1.3: the film is on the trailer pages (duoqueue.io/watch/), not the home page; and
  line 70's false claim that gender is "shown on your profile to other users" is corrected (it is
  collected in the current build and not shown to anyone). "There is no JavaScript on the site at all"
  stays true.

## Testing

- Build passes its contrast audit; zero `<script>` tags, `on…=` handlers or `javascript:` links on
  every page; no em dashes in visible text or page source.
- Renders at 390 (phone) and 1440 (desktop): at rest, mid-scroll per card, desktop first screen after
  the load sequence, Reduce Motion, and both watch pages.
- Deploy dry run, then the real deploy with its live checks, then a check by hand that the policy page
  shows 1.3.
- Cameron opens duoqueue.io/tt/ inside TikTok on his phone to confirm the scroll moments run in the
  in-app browser.
