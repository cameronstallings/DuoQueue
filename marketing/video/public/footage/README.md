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
