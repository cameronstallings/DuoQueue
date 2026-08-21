# Source footage

Not tracked in git (see the `.gitignore` rule): these are large binaries that change whenever
they are re-cut, and everything rendered from them is reproducible.

Every file here is named for what it shows, and `src/data/clips.ts` names the same things.
Nothing downstream knows a file name or a stopwatch reading.

## The app clips

Cut on 2026-08-19 from `ScreenRecording_08-18-2026 19-57-00_1.mp4`: a 2:07.9 iPhone screen
recording at 1180x2556, 60fps, HEVC, signed in as the review account with the filming photo
set applied. Cut to H.264 and stripped of audio, because the original audio is room noise and
HEVC decodes slowly for every downstream tool.

The recording switches from dark to light at 92s, which was deliberate: the Paper scheme reads
as different enough to double the visual variety from one session. No clip straddles that
boundary, since a theme change inside a 15-second cut looks like a glitch rather than variety.

The `in` and `out` columns are seconds into that source recording. `to` is what
`src/data/clips.ts` trims to, and it is always about 0.2s inside the file so a clip can be
nudged out a fraction without another ffmpeg pass.

| clip | in | out | to | what it shows |
|---|---|---|---|---|
| `deck-dark.mp4` | 0.0 | 9.6 | 9.4 | Deck browsing, dark: Devon, Wren, Kofi. The duo lands at 5.5s and the last third is DUO LOCKED |
| `match-kofi.mp4` | 6.1 | 11.8 | 5.2 | DUO LOCKED with Kofi, real photo, new-match banner |
| `chat-typing.mp4` | 24.0 | 32.2 | 8.0 | Typing a first message and sending it |
| `deck-cards.mp4` | 35.6 | 44.6 | 8.8 | Five full cards and two passes, dark. Card content only, no match screen |
| `duo-locked.mp4` | 44.8 | 53.2 | 8.2 | DUO LOCKED with Marcus, real photo. The best shot in the set |
| `own-profile.mp4` | 72.0 | 82.1 | 9.9 | Own profile, scrolling the bento. The avatar finishes loading at 3s in |
| `settings-sub.mp4` | 82.0 | 85.0 | 2.8 | Settings, Subscription section, DuoQueue+ Active |
| `paywall.mp4` | 84.9 | 88.1 | 3.0 | The DuoQueue+ sheet, premium state, Power-Up at a real $3.99 |
| `appearance.mp4` | 89.8 | 92.6 | 2.6 | Appearance picker, Dark to Light |
| `deck-light.mp4` | 94.0 | 101.6 | 7.4 | Deck in Paper: Doe, Sonny, Nadia, Tobi, Yuki |
| `matches-light.mp4` | 115.6 | 121.9 | 6.1 | Matches with a party and three threads, Paper. Opens the Priya thread at 2.9s |
| `chat-priya.mp4` | 119.2 | 125.5 | 6.1 | The full Priya conversation, Paper, readable |

### What the light half does not have

The Paper section of the recording ran out of deck before it ran out of time, so most of
106s to 115s is empty state: "No more profiles right now", an empty Online Now sheet, an empty
Who wants to duo sheet. None of it is usable, and it is why `deck-light` is 7.4s and
`matches-light` is 6.1s while their dark equivalents are 8s to 10s. `reframe-004`,
`reframe-006` and `reframe-007` are shorter than the other reframes for exactly this reason.

The cheapest fix is one more short recording in Paper with a full deck and a populated Matches
list. Ten seconds of each is enough.

## The fragment set

Cut on 2026-08-20 from four fresh recordings, all 1180x2556 at 60fps, made specifically to
compare the app's two themes on real footage. These back the light-ground / isolated-fragment
direction, and unlike every clip above **they are cropped**: each file is one region of the
screen at native resolution rather than a whole frame. The references that direction is built
from never show a phone, so neither do these.

Sources:

| source | length | what it holds |
|---|---|---|
| `deck-dark-raw.mp4` | 21.1s | Kofi's deck card, dead still 0.0-16.40. DUO LOCKED with Kofi 17.87-19.50 |
| `deck-light-raw.mp4` | 12.5s | Sana's deck card, dead still 0.0-11.65 |
| `raw-dark.mp4` | 60.7s | Sana DUO LOCKED 6.0-11.9, chat and send, Matches, the Priya thread, Settings, Power-Ups |
| `raw-light.mp4` | 52.2s | Kofi card 4.30-8.02, Kofi DUO LOCKED 9.60-13.20, chat and send, Matches, Priya, Settings, Power-Ups |

Kofi is the duo in **both** halves so the two deliverables tell the same story: dark from
`deck-dark-raw`, light from `raw-light`. `frag-dark-bubble` is the one exception, cut from
raw-dark's Sana thread because the dark recording has no Kofi chat; its crop excludes the
header and the "Say hi to Sana!" empty state, so no name is on screen and nothing contradicts.

`crop` is ffmpeg's `w:h:x:y` on the 1180x2556 source. The same rectangle is used for the dark
and the light cut of a fragment, because the two themes are pixel-identical in layout.

| clip | source | in | out | crop | what it shows |
|---|---|---|---|---|---|
| `frag-dark-card.mp4` | deck-dark-raw | 1.00 | 9.22 | 1032:980:76:928 | The whole deck card: photo, Kofi, ROCKET LEAGUE, the prompt, the games chip, the chartreuse `NO. 001` |
| `frag-dark-card-lower.mp4` | deck-dark-raw | 1.00 | 9.22 | 1032:640:76:1270 | The card minus the top half of the photo. Carries the prompt, so nothing uses it |
| `frag-dark-card-top.mp4` | deck-dark-raw | 1.00 | 9.22 | 1032:660:76:928 | The card from its real top edge to just under the playstyle chip. THE HERO |
| `frag-dark-prompt.mp4` | deck-dark-raw | 1.00 | 6.22 | 900:142:100:1632 | The prompt sentence alone, no "MY PROUDEST GAMING ACHIEVEMENT IS" label |
| `frag-dark-games.mp4` | deck-dark-raw | 1.00 | 6.22 | 490:100:345:1790 | `>> 3 GAMES IN COMMON`, amber on the card |
| `frag-dark-role.mp4` | deck-dark-raw | 1.00 | 6.22 | 670:90:120:1490 | `ROCKET LEAGUE - Ranked Grinder` |
| `frag-dark-actions.mp4` | deck-dark-raw | 1.00 | 6.22 | 720:226:235:2005 | Pass, Ping, Boost. The chartreuse bolt is the strongest brand object in the app |
| `frag-dark-highlights.mp4` | deck-dark-raw | 1.00 | 6.22 | 1120:416:60:425 | The HIGHLIGHTS row: Sana, Marcus, Kofi, Priya, real photographs, Priya clipped by the frame |
| `frag-dark-lock-in.mp4` | deck-dark-raw | 17.85 | 18.62 | 520:640:330:425 | The reticle closing around the photo. 0.25s of motion, then settle |
| `frag-dark-duo.mp4` | deck-dark-raw | 18.35 | 19.47 | 520:640:330:425 | DUO LOCKED settled. The app dismisses it at 19.50, so this is all there is |
| `frag-dark-send.mp4` | deck-dark-raw | 18.50 | 19.48 | 1070:206:55:1235 | The chartreuse "Send a message" button, fully lit |
| `frag-dark-bubble.mp4` | raw-dark | 21.50 | 23.82 | 460:200:700:1105 | "Hey you on tn?" sent, with the chartreuse SENT label |
| `frag-light-card.mp4` | raw-light | 4.35 | 7.97 | 1032:980:76:928 | As frag-dark-card, light theme |
| `frag-light-card-lower.mp4` | raw-light | 4.35 | 7.97 | 1032:640:76:1270 | As frag-dark-card-lower, light theme |
| `frag-light-card-top.mp4` | raw-light | 4.35 | 7.97 | 1032:660:76:928 | As frag-dark-card-top, light theme |
| `frag-light-prompt.mp4` | raw-light | 4.35 | 7.97 | 900:142:100:1632 | As frag-dark-prompt, light theme |
| `frag-light-games.mp4` | raw-light | 4.35 | 7.97 | 490:100:345:1790 | As frag-dark-games, light theme |
| `frag-light-role.mp4` | raw-light | 4.35 | 7.97 | 670:90:120:1490 | As frag-dark-role, light theme |
| `frag-light-actions.mp4` | raw-light | 4.75 | 8.02 | 720:226:235:2005 | Pass, Ping, Boost in Paper. Starts 0.4s later than its siblings, see below |
| `frag-light-highlights.mp4` | raw-light | 4.35 | 7.97 | 1120:416:60:425 | As frag-dark-highlights, light theme |
| `frag-light-lock-in.mp4` | raw-light | 8.83 | 9.60 | 520:640:330:425 | As frag-dark-lock-in, light theme. Same 0.25s shape |
| `frag-light-duo.mp4` | raw-light | 9.70 | 13.22 | 520:640:330:425 | DUO LOCKED settled, light theme |
| `frag-light-send.mp4` | raw-light | 9.70 | 13.22 | 1070:206:55:1235 | The dark-green "Send a message" button |
| `frag-light-bubble.mp4` | raw-light | 24.20 | 26.22 | 460:200:700:1105 | "Hey you on tn?" sent, pale green bubble, SENT |
| `frag-dark-locked.mp4` | deck-dark-raw | 17.91 | 19.62 | 520:640:330:425 | The ring closing AND the settled banner, continuous. See below |
| `frag-light-locked.mp4` | raw-light | 8.91 | 10.62 | 520:640:330:425 | As frag-dark-locked, light theme, cut to the same 1.71s |
| `frag-play.mp4` | broll-quiet | 2.05 | 4.00 | 1660:934:450:300 | Daylight on Breeze. Not the app, and the only clip both films share |

The line that cuts one, `-ss` before `-i` and CRF 16 because these get scaled up in frame:

    ffmpeg -ss <in> -t <out minus in> -i <source> -vf "crop=<crop>"       -an -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart <clip>.mp4

Crop height and width must both be even or libx264 will refuse yuv420p, which is why three of
the rectangles are 226, 416 and 206 rather than the 225, 415 and 205 they were measured at.

### Boundaries that are not where they look

Every window above was found frame by frame, and five of them are not where a one-frame-per-
second contact sheet suggests. Recorded so nobody re-derives them:

- The **light card leaves at 8.02**, not 8.9. The swipe starts a frame after a 2fps sample
  that still looks clean. The first cut of all seven light card fragments overran into empty
  ground plus the incoming DUO LOCKED.
- The **light action row is washed out until 4.70**. It is still fading back up from the press
  that dealt the card. This is the only fragment whose in point differs from its siblings.
- The **dark send button is not fully lit until 18.50**, a quarter second after the banner it
  sits on has settled.
- The **dark sent bubble reads SENDING... until 21.40**. Wait for SENT.
- The **light sent bubble reads SENDING... until 24.10**, and its Devon card arrives at 26.30.
- The **card's playstyle chip ends at y=1575** and the **"MY PROUDEST GAMING ACHIEVEMENT IS"
  label starts at y=1602**, measured at 1px on a 2x blow-up of both sources. `-card-top` cuts
  at 1588, the midpoint, which is the only horizontal line on the card that separates the
  identity block from the prompt sentence. Both sources put those edges in the same place.

### Why `-card-top` exists and `-card-lower` is now unused

Kofi's prompt answer is "Hit Grand Champion in Rocket League **solo queue**. Took two years.
Worth it." Every crop that reaches the lower half of the card contains those two words, and a
fragment drawn 844px wide renders them at about 38px, which is the most legible text on the
frame. The film's first line is "queue up with a duo". So the crop stops above the sentence.

This is not fixable by choosing a different card. Kofi is the only persona with a deck card in
**both** recordings, and the two deliverables exist to compare themes on the same story, so
they have to use the same person. Sana's card is a better read for the middle of this film
("Shows up for raid night and is happy to run the mechanic one more time.") but it was only
shot in Paper, so using it would mean a light-theme fragment inside the dark film.

### Why `-locked` exists when `-lock-in` and `-duo` already did

`frag-*-lock-in` and `frag-*-duo` are two windows on ONE event and in the dark recording they
OVERLAP: 17.85 to 18.62 and 18.35 to 19.47. Playing them end to end rewinds a quarter second of
the same rectangle, which reads as a stutter, and either one alone is shorter than the 49 frames
the read gives the "duo locked" beat. Dark lock-in is 18 frames and dark duo is 27.

`frag-dark-locked` is that rectangle run continuously across the whole event, and both of its
boundaries were found frame by frame because neither is where it looks:

- The DUO LOCKED sheet **slides up** into place rather than appearing. It starts at 17.85 in the
  dark recording and 8.85 in the light one, but until **17.91 / 8.91** the crop rectangle still
  contains a strip of the deck behind it, which on an isolated fragment on a pale ground reads as
  two pictures in one card. 17.91 is the first frame where the sheet fills the rectangle, and the
  ring is still closing at that point, so a cut landing there lands mid motion.
- The dark banner is **fully settled to 19.58 and dismissing by 19.66**. The file is cut to 19.62
  and `clips.ts` stops it at 1.66s, which is 19.57, so the beat's 49 frames end just clear of the
  dismissal.

The light banner holds until 13.22 and could have run three times as long. It is cut to the dark
one's 1.71s deliberately: a beat that is generous in one film and tight in the other is not the
comparison the two deliverables exist to make.

### `frag-play`, and why every edge of its rectangle is a redaction

`broll-quiet` is a SPECTATOR capture. Its full frame carries a minimap top left, a killfeed top
right that prints real gamertags, a scoreboard along the top and the round HUD along the bottom,
and in-world teammate nameplates appear at 1.05-1.60 and from 3.95. So the only publishable
picture is a centre crop taken inside 2.00-3.90, and `1660:934:450:300` is that: it starts below
the killfeed and right of the minimap, ends above the HUD, and holds a clean 16:9 for the 1.73s
the last beat needs. What is left in it is a doorway, daylight, the sea and a first person weapon.

It is the one clip in the fragment set with no `-dark` and no `-light` half, because it is not the
app and the app's theme is the only thing the two deliverables are comparing.

### Deliberately not cut

Measured and clean, but no beat in the current script needs them. Each is one ffmpeg line away
using the table's format:

- Matches list, dark: `raw-dark` 31.60-34.90. Light: `raw-light` 29.20-32.00. Note the dark
  list has no Kofi row in it and the light list does, so a whole-list shot breaks the Kofi
  continuity in the dark cut while a single-row crop does not.
- DuoQueue+ with the Power-Ups row, dark: `raw-dark` 47.40-49.20. Light: `raw-light` before
  44.20. Monetisation, and the film is about the first duo.
- The Priya conversation, dark: `raw-dark` 36.00-40.00. Light: `raw-light` 32.50-35.50.
- Sana's deck card, light theme: `deck-light-raw` 0.50-11.40, and Sana DUO LOCKED in dark:
  `raw-dark` 6.50-11.80. Both are alternates to the Kofi journey, not additions to it.

### Frames to stay away from

Deleted personas, which must never appear: `raw-dark` 24.0-29.5 and 56.0-59.0 (Chase, Bea),
`raw-light` 0.0-4.0, 8.05-9.60 and 26.3-29.0 (Bea, Devon). The abstract-art card Cameron asked
to ignore: `deck-dark-raw` 17.0-17.7 and 19.6-20.4 (Dae). iOS Control Center closes all four
recordings. And the top ~180px of every source carries the status bar, "TestFlight" and a red
recording pill, so no crop may start above y=180.

## Still needed

`broll-gameplay.mp4`. Three to four minutes of gameplay showing solo queue going badly: a lost
round, a teammate leaving, an empty comms moment. This is the raw material for the `pain`
format, which is the only one of the four that does not use app footage. Until it lands, all
seven `pain` hooks render the labelled missing-clip panel and `pnpm validate` warns about each
of them, which is the intended visible reminder rather than a failure.

Its three entries in `clips.ts` (`broll-loss`, `broll-quiet`, `broll-teamfight`) still carry
placeholder timecodes. Correct them the same way the table above was built: drop the file in,
open `Preview-Pain` in Studio, and read the in and out points off the timeline.

There is a candidate already on this machine that nobody has confirmed is the intended take:

    C:\Users\stall\Videos\NVIDIA\Valorant\Valorant 2026.08.18 - 20.50.37.02.DVR.mp4

Five minutes, 2560x1440, 60fps, H.264, recorded the same evening as the app session. It
contains a lost round at about 90s and a DEFEAT screen at about 230s. Two things to decide
before using it. It is landscape, so a vertical frame keeps roughly the middle third and
loses the rest of the HUD. And another player's gamertag is on screen throughout, which is
somebody else's name going into published marketing.

## Cutting and re-cutting

ffmpeg is installed via winget (Gyan.FFmpeg) but is not on the default PATH in every shell:

    export PATH="$PATH:/c/Users/stall/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin"

Every clip in the table was cut with this, `-ss` before `-i` for a fast seek:

    ffmpeg -ss <in> -i <source> -t <out minus in> -an -c:v libx264 -preset veryfast -crf 20 <clip>.mp4

Re-recording the app costs one pass over this file and one over `src/data/clips.ts`. Nothing
else downstream knows anything about footage.

### If a source will not decode

Symptom: black frames in Studio, or a decode error part way through a render. The suspect is
the container and codec, usually HEVC in a `.mov` straight off a phone. `Clip` uses
`OffthreadVideo`, so Remotion's own compositor decodes it rather than Chromium, and that
handles far more than the browser does. When it does not, transcode through the `Normalize`
composition, which needs no ffmpeg at all:

    npx remotion render src/index.ts Normalize \
      public/footage/broll-gameplay-normalized.mp4 \
      --props='{"file":"broll-gameplay.mov","seconds":240}'

Then point the clip at the normalized file. It writes 1080x1920 H.264 at 30fps, already
cropped the way the post will crop it. It is a fallback and not the intake path: it costs a
full encode and a second generation of lossy video.

## Checking a clip is long enough

`OffthreadVideo` renders nothing at all past its trimmed range. A clip that runs out under a
slot does not loop and does not freeze; it leaves bare graticule with the hook line floating
on it. So every clip has to be at least as long as the longest slot that asks for it:

- a `reframe` or `pain` hook needs `to - from >= hook.seconds`
- a `demo` step needs about a third of `hook.seconds`, a little less for the cuts between steps

The fastest check is `npx remotion compositions src/index.ts`, which prints every duration in
about 50 seconds without rendering a pixel. Compare those against the `to` column above.
