# DuoQueue Launch Marketing — Design

Written 2026-08-18, the day after App Store approval. DuoQueue 1.0 is approved but **not
released**: manual release was chosen deliberately, so the store listing 404s until Cameron
clicks Release. That pause is what makes this plan possible, and spending it well is the point.

## The problem this solves

DuoQueue has 4 real users. It is a matching app, and a matching app with an empty deck is not
a worse product than a full one, it is a different and unusable one. Driving installs into an
empty deck produces churn, not growth: people open it once, see nothing, and never return.

So the goal is not downloads. It is **enough of the right people signing up close enough
together in time that the first ones find someone.** Everything below serves that.

## Constraints, taken as given

- **Solo developer, a few hours a week.** Not a launch-crunch budget. The plan front-loads one
  concentrated push and then runs at maintenance effort.
- **No face or voice on camera.** Content is app footage, gameplay B-roll, text and graphics.
- **No paid tooling.** Schedulers handling ~90 posts/month across three channels are all paid,
  so publishing stays manual and the automation goes into generation and reminders.
- **No analytics SDK, deliberately.** The privacy label is clean and stays clean.
- **US-only, English-only, iPhone-only.**
- **Genre/vibe positioning, not a single game.** Broader than one title, narrower than "all
  gamers", matching the app's existing playstyle vocabulary (chill, competitive, late night,
  solo queue, team player).

## Order of work

Deliberately not the order it was asked for. Product fixes come first, because marketing into a
product that punishes low density wastes the launch, and the launch is a one-time asset.

1. Low-density product fixes
2. Content pipeline (Remotion)
3. Daily reminder and measurement
4. Waitlist and launch sequence

---

## 1. Low-density product fixes

The highest-value part of this plan, and the part most easily mistaken for a detour.

Investigation found the intuitive culprits are not the problem. Free users already see up to
3 admirers (`limit 3`, migration 0059), so at this scale that gate gates nothing. The
25-swipes-per-day cap is irrelevant when there are three people to swipe.

**The real failure is the dry deck**, which for months will be every user's second session.
The current empty state reads "Check back later, or adjust your filters to see more people."
To someone who signed up an hour ago that reads as a broken app, and nothing brings them back.

### 1a. Honest empty state

Replace the copy with something true: DuoQueue is new, and we will tell you when someone who
plays your games joins. Honesty converts a dead end into a promise. The same user goes from
"this is empty" to "I am early", which is a materially different feeling about the same screen.

### 1b. Notify on new matching signups

**The single most valuable item in this plan.** When a new user completes onboarding, push the
existing users whose games overlap theirs.

This inverts the density problem. Instead of emptiness being a slow leak, every new signup
reactivates the people already waiting, and the app gets more alive with each one rather than
merely less empty. It also makes the marketing worth doing: acquisition compounds into
retention instead of running parallel to it.

The infrastructure exists and needs wiring, not building. `send-push-notification` and
`send-reengagement-nudges` are deployed, Expo push is configured, and per-type notification
toggles already exist in Settings. A new notification type joins that existing preference
system rather than bypassing it.

Rate limiting matters. At launch density this fires rarely; at scale it must not become a
firehose. Cap per-user frequency and respect the existing toggles.

### 1c. Filters must not return zero

Premium filters can empty an already-thin deck, which reads as the paid feature breaking the
app. Detect an empty filtered result, say so plainly, and offer to relax the filters rather
than falling through to the generic empty state.

---

## 2. Content pipeline (Remotion)

### Why Remotion rather than ffmpeg

Remotion renders video from React components. Chosen over raw ffmpeg overlays for reasons
specific to this project:

- Cameron already writes React and TypeScript. No new language, no timeline UI.
- **It can import the app's real code.** `Logo.tsx`, the Volt tokens, the actual Chip and Card
  components. The videos are not brand-consistent by imitation; they use the same components,
  so the chartreuse, the 1px seams and the IBM Plex Mono are the app's own.
- **Variants are props.** One composition plus an array of hook objects renders the whole
  queue. That is the exact shape of the problem: many distinct posts, one design.
- Real animation (springs, staggered reveals) rather than static text over video.
- Browser preview while iterating instead of render-and-check.
- Free for solo developers. Bundles ffmpeg, which is not otherwise installed on this machine.

Brand fonts are already on disk as `.ttf` under `node_modules/@expo-google-fonts/`
(IBM Plex Mono, Manrope, Unbounded), so typography matches exactly with no new assets.

### Volume

**3 distinct videos per day, each cross-posted to Instagram Reels, TikTok and YouTube Shorts.**
21 per week, roughly 42 across a two-week waitlist. Cross-posting one video to three platforms
is standard practice and not penalised. This is 3 videos/day total, not 3 per platform.

### The four formats

**1. The reframe.** Swipe-deck footage, overlay: "no this isn't a dating app" then "it's for
finding people to actually play with." The strongest hook, because the surprise is the
engagement driver: people stop because they think they know what they are seeing and they are
wrong. This format is what makes the positioning an asset rather than a liability.

**2. The pain.** Gameplay footage of solo queue going badly, overlay naming the feeling: "your
duo quit the game 3 months ago", "LFG posts get 0 replies", "randoms with no mic again."
Relatable with no product knowledge required.

**3. The demo.** 15 seconds of the real flow: deck, match, chat, "when are you on tonight."
Lowest reach, highest intent.

**4. The spec list.** Volt-styled text cards in IBM Plex Mono: "match on games, not looks",
"18+ only", "no gender filters." Cheap, infinitely variable, works as filler that does not feel
like filler.

All four end on the same card, whose call to action is phase-dependent.

### Phase awareness

The content does two different jobs and must not fight itself. During the waitlist the call to
action is the landing page; after release it is the App Store. Same videos, different ending
card. The pipeline takes the phase as an input rather than being rebuilt between phases.

### Input required from Cameron, once

One clean 60-second screen recording of the app, and 3 to 4 minutes of gameplay B-roll. The
generator handles hooks, cuts, ordering, opening frames and captions from there.

### Output

Finished MP4s plus per-platform captions, written into dated daily folders, three per day,
ready to upload.

---

## 3. Reminder and measurement

### Reminder

Publishing stays manual. Signing into Cameron's social accounts would mean handling his
credentials, which is out of scope on principle, and paid schedulers were ruled out. He has
time daily; the failure mode is forgetting. So a recurring daily task fires at a chosen time,
names what is queued, and points at the folder.

### Measurement without an SDK

An earlier claim that this project has no analytics was wrong in a way that matters. There is
no *SDK*, but:

- **App Store Connect** provides impressions, product page views, downloads and conversion rate.
- **Supabase** answers activation and retention directly by query: signups per day, share
  completing onboarding, share returning, share reaching a first match.

A script pulls both into one summary. Real numbers, no privacy-label cost.

---

## 4. Waitlist and launch sequence

1. Waitlist page on duoqueue.io. The site already builds from `scripts/build-site.mjs`.
2. Content runs 1 to 2 weeks, driving signups to that page. Not longer: a waitlist that outlives
   its momentum is worse than none.
3. Hit Release in App Store Connect.
4. Email the waitlist within a day or two so they arrive together. **Concentration in time is
   the entire point.** 300 signups in one week is a functioning app; the same 300 over six
   months is six months of people finding an empty deck.

---

## Success criteria

- A new user's second session shows either people or a credible reason to come back, never a
  bare empty deck.
- A new signup measurably reactivates existing matching users, with notification open rate as
  the proxy.
- Three distinct videos exist for every launch-window day without Cameron editing video.
- He knows daily what to post without having to remember to check.
- Signups concentrate into the release window rather than trickling.

## Explicitly out of scope

- Paid acquisition. Revisit once the deck is non-empty; paying to fill an empty app is paying
  for churn.
- Automated posting to social platforms. Requires credentials or paid tooling, both ruled out.
- Face or voice content, including the founder-story angle that would otherwise be the strongest
  organic format for a solo indie app. A deliberate trade, not an oversight.
- Android and non-US markets.
- Any analytics SDK.

## Open questions

- Which genre or vibe to lead with in the copy. The app's own playstyle vocabulary is the
  natural source, but the specific wedge is unchosen.
- Exact daily reminder time.
- Whether the waitlist runs 1 or 2 weeks, decided by how fast it fills.
