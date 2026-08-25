# DuoQueue video pipeline

A local Remotion project that renders the daily short-form marketing videos: three vertical
MP4s per day plus cover frames and per-platform captions, in the real Volt identity.

Plan and spec:

- `docs/superpowers/plans/2026-08-18-remotion-pipeline.md` (the implementation spec for this
  directory; it is the authority on every decision here)
- `docs/superpowers/specs/2026-08-18-launch-marketing-design.md` section 2

## This project is deliberately outside the pnpm workspace

`pnpm-workspace.yaml` globs only `apps/*` and `packages/*`, so nothing here is a workspace
member. That is on purpose:

- CI (`.github/workflows/security.yml`) runs `pnpm install --frozen-lockfile`,
  `pnpm audit --audit-level high`, `pnpm typecheck` and `pnpm lint` on every push. As a member,
  every push would install Remotion's platform binaries on Ubuntu in three jobs to typecheck a
  marketing tool, and a moderate advisory anywhere in Remotion's transitive tree would block
  work on a shipping iOS app.
- The repo root sets `node-linker=hoisted`, so workspace dependencies land in one flat
  `node_modules` that Metro resolves from. Remotion, webpack and a second React tree do not
  belong in the tree an approved Expo app builds against.

The cost is that root `pnpm typecheck` and `pnpm lint` do not cover this code. That is what
`pnpm video:verify` is for, and it must be green before any commit that touches this directory.

## Every install here needs `--ignore-workspace`

Without the flag, pnpm walks up, finds `pnpm-workspace.yaml`, and installs the ROOT workspace
instead: it mutates the root `node_modules` and installs nothing here. A local `.npmrc` with
`ignore-workspace=true` does not prevent this; only the CLI flag does.

```
pnpm video:install                                     # from the repo root, flag included
pnpm --dir marketing/video add --ignore-workspace <pkg>
```

After any manual `pnpm add` in this directory, check that `git diff --stat pnpm-lock.yaml` at
the repo root is empty. If it is not, the flag was dropped: `git checkout pnpm-lock.yaml`, run
`pnpm install` at the root, and redo the command with the flag.

`package.json` carries its own `"packageManager": "pnpm@10.33.0"` because `--ignore-workspace`
stops corepack from honoring the root pin.

## Commands (all from the repo root)

| Command | What it does |
| --- | --- |
| `pnpm video:install` | Installs this project's dependencies, workspace-safely |
| `pnpm video:studio` | Opens Remotion Studio to preview and scrub compositions |
| `pnpm video:audio` | Generates the voiceovers, mixes them over the bed, and rewrites the timings |
| `pnpm video:day` | Renders the day's three videos, covers, captions and manifest |
| `pnpm video:verify` | typecheck + lint + content validation. Required before committing |

The carousel is not a video and has no day, so it is run from this directory rather than from
the root: `pnpm carousel` writes six 1080x1350 PNGs and a captions file into `out/_carousel/`.
It touches neither the ledger nor a day folder, so it can be re-run any number of times.

Neither are the static sheets or the four angle reels, and both are run from this directory for
the same reason:

| Command | What it does |
| --- | --- |
| `pnpm static` | The four sheets and their captions, into `out/_static/` |
| `pnpm angles` | The four angle reels and the approved film, their covers and their captions into `out/_reels/`, and three more sheets into `out/_static/` |
| `pnpm measure` | Reads the finished files back: mean luma, runtime and loudness, with the approved direction printed beside them |

`pnpm angles` writes nothing an earlier deliverable owns. Its sheets are named
`feed-<angle>-light.png`, which `pnpm static` cannot produce, and its films go to `out/_reels/`,
which nothing else writes.

The three campaign ads are not on the day queue either, because they are one script rendered
three ways rather than a day's posts. They render by composition id from this directory:

```
npx remotion render Frag-Dark   out/_directions/frag-dark.mp4
npx remotion render Frag-Light  out/_directions/frag-light.mp4
npx remotion render Type-Clean  out/_directions/type-clean.mp4
```

`video:audio` needs two things on this machine that nothing else here does: `ffmpeg` (found on
PATH, then at the WinGet install, then at `$FFMPEG_DIR`) and `HYPERFRAMES_PYTHON` pointing at a
Python 3.12 for the voice model to run in.

```powershell
$env:HYPERFRAMES_PYTHON = "C:\Users\stall\AppData\Local\Programs\Python\Python312\python.exe"
pnpm video:audio
```

## Layout

```
public/            fonts/, footage/ and noise.png are synced or supplied, all gitignored
public/audio/      bed-01.mp3 is a licensed source asset and IS tracked; mix/ is generated
src/audio/         the voiceover: what is said, how it is mixed, and when each line lands
src/components/    DOM ports of the app's primitives, plus shared video furniture
src/formats/       one component per format: reframe, pain, demo, spec
src/data/          hooks.ts (the queue) and clips.ts (footage in and out points)
src/config/        phase (waitlist or launched) and caption templates
src/lib/           scale, fonts, selection, ledger, webpack override
src/frag/          the shipped ad: light ground, isolated app fragments, small type
src/carousel/      the same direction as a 4:5 swipeable post. Imports src/frag/ground.ts
src/type-clean/    the type ad: the same ground and shot plan under a hero/support headline
scripts/           render-day, render-carousel, sync-assets, validate-content
state/             rendered.json, the committed ledger of what has shipped
types/             the react-native TYPE stub, see types/react-native.d.ts
```

## Footage

`public/footage/` holds one MP4 per usable moment, named for what it shows, and
`src/data/clips.ts` trims each one. Both are gitignored: they are large, they change whenever
they are re-cut, and everything rendered from them is reproducible.

Twelve clips are cut from a single 2:08 screen recording of the app. The thirteenth,
`broll-gameplay.mp4`, is gameplay b-roll for the `pain` format and has not been recorded yet.
Until it lands, `pain` posts render a labelled missing-clip panel instead of black, and
`pnpm video:verify` prints a warning for each of the seven hooks that want it. That is the
designed state, not a failure.

`public/footage/README.md` is the manifest: every clip, its in and out points in the source
recording, what it shows, the exact ffmpeg line, and what to record next. Read it before
touching footage.

Re-recording the app is a two file job. Cut the new clips to the same names, then re-check the
timecodes in `src/data/clips.ts`. Nothing else in this project knows a file name or a
stopwatch reading.

One rule is worth knowing before writing a timecode: `OffthreadVideo` renders **nothing** past
its trimmed range. A clip shorter than the slot that plays it does not loop and does not
freeze on its last frame; it leaves an empty frame with the hook line floating on it. Every
clip must be at least as long as the longest slot that asks for it.

## Audio

Every post carries a voiceover with a music bed under it, and `pnpm video:audio` is the one
command that produces both. The finished mixes land in `public/audio/mix/<id>.wav` and
`render-day` bakes them into the MP4.

**The read is derived, never written.** `src/audio/vo.ts` turns a hook into its spoken lines
using the same fields the frame renders: a reframe speaks its two beats, a pain hook speaks its
lines, a spec speaks its title and items. Editing a hook changes what is heard and what is seen
at the same time, or neither. The only transform in between is `speakable`, which adds terminal
punctuation and spells out the few tokens a speech model reads as noise ("18+" is said
"eighteen plus"); it never changes a word. A `demo` is the exception and speaks its `caption`,
because its only on-screen words are step labels and "01 / DECK" read aloud is not a sentence.

**Audio is the clock.** The doctrine's rule is that scenes get re-timed to the voice's real
timestamps and a read is never rushed to fit a slot, so nothing here estimates a duration. Each
phrase is synthesised as its own WAV and measured with `ffprobe`, and the track is assembled
from those measurements; `src/audio/timings.generated.ts` is the committed result, holding the
start and end of every line in seconds and in frames. When a read and its video disagree by
more than a second, `video:audio` and `pnpm validate` both say so and both say the same thing:
the picture is what needs re-cutting.

**The mix**, and every number in it is in `src/audio/mix.ts` with the reason it is that number:

```
voice   highpass 80Hz -> gentle compressor -> static gain to -16 LUFS -> limiter at -3 dBFS
bed     3 peaking dips (400/1000/1600Hz) -> -15 dB -> duck keyed by the voice
sum     voice + carved bed -> measure -> static gain -> limiter -> -14.7 LUFS, under -1 dBTP
```

The bed is carved rather than simply turned down: the dips give the voice the bands it needs
and leave the music its low end and its top, and the sidechain takes about 9 dB more while a
word is actually being said. -14 LUFS is what Instagram, TikTok and YouTube all normalise to.

**Every mix is measured with `ebur128` after it has been written**, and the numbers are
recorded, so the committed table says what is in the file rather than what was asked for. It
used to be measured with `loudnorm`'s own analysis pass and that was a real defect rather than
a preference: on the same finished WAV the two disagree by up to 0.9 LU (`pain-006` reads
-15.2 by loudnorm and -14.3 by `ebur128`), `ebur128` is ffmpeg's implementation of BS.1770,
and BS.1770 is what every platform's normaliser runs. The corrective trim closes its loop on
this measurement too, so reading the wrong meter was pushing every mix about half a dB past
its target and then recording the miss as if it were the target. After the change, 23 of the
25 posts land inside the 0.15 LU tolerance where 18 of them used to sit outside it, and every
true peak is under -1 dBTP.

**The master is trimmed by 2048 samples at the head, and that is a delivery fix.** Remotion's
AAC encode delays the audio by exactly that much and the edit list it writes takes only 512
samples back, so every mp4 this pipeline has ever produced played its read 42.67ms, 1.28 video
frames, late. It is small and it is systematic, which is the worst combination for a build
whose one doctrinal rule is that audio is the clock. The figure was measured by null testing a
delivered mp4 against its own WAV one sample shift at a time: the residual sits at -15.2 dB at
lag 0 and collapses to -53.7 dB at lag 2048. What gets trimmed is 42.67ms of a 0.6s bed fade
in under 0.2s of lead in silence, so nothing audible is lost, and the committed line timings
then describe where the words land in the delivered video. Verified on the finished file by
cross correlating it against the voice stem: the read now lands 10.0ms after the clock says it
should, down from 52.7ms, and the 10ms that is left is the mix graph's own filter latency and
is in the WAV as well as in the mp4.

**A "too loud" note is answered by the gap, not by the master.** Cameron watched the first
mixed cut and said to turn the music down and the voice down. Turning the master down does
nothing that survives delivery, because every platform normalises back to about -14 LUFS and
hands you the same balance at the same volume. What normalisation cannot undo is the DISTANCE
between the voice and the bed, so the bed moved 4 dB (-11 to -15) and the duck went back to
ratio 4, and the master moved only the 0.7 dB the note's own "-14 to -15" window would pay
for. Measured on `kinetic-native-001`, mean volume over the bed-alone gaps and the spoken
windows: the bed fell 5.5 dB, the read fell 1.1, and the distance between them went from
8.4 dB to 12.8. The delivered mp4 lands at -14.7 LUFS, -1.5 dBTP.

The target aims the WAV at -14.7 rather than -15 because the WAV is an intermediate: the AAC
encode Remotion muxes it into costs about 0.2 LU, and targeting -15 put the rendered file at
-15.1, outside the window by exactly that. Target the file that gets watched.

One consequence worth knowing about. The four `demo` and most `spec` posts are two to four
times longer than their reads, so most of the file is bed alone, the integrated loudness comes
out low, and the master has to lift them 6 to 9 dB with the limiter taking the difference.
Dropping the bed made that lift larger, and those posts now keep about 11 dB of crest over
their reads where `kinetic-native` keeps 16. The real fix is not in the mix: it is the
`audio.fit` warning `pnpm validate` already prints, which is that the picture is too long for
the read on 24 of 24 posts. Audio is the clock.

**The master is a static gain, and that is the second design.** The first asked ffmpeg's
`loudnorm` to do it with `linear=true`, which is a request rather than an instruction: it
falls back to a dynamic normaliser whenever the static gain it would need would push the true
peak past the target, and that was every one of the twenty five posts. A dynamic normaliser
lifts quiet passages, the quiet passages in these mixes are the ducked gaps between phrases,
and lifting them undoes the duck. Measured on `reframe-001`, same loudness and same ceiling
either way:

| master | integrated | true peak | LRA |
| --- | --- | --- | --- |
| raw mix, before mastering | -18.6 LUFS | -2.6 dBTP | 4.6 LU |
| loudnorm, dynamic fallback | -14.0 LUFS | -1.5 dBTP | 2.4 LU |
| static gain + limiter | -14.1 LUFS | -1.5 dBTP | 4.2 LU |

Across all twenty five, 23 kept more range under the static master and the mean gain was
about 1.7 LU. The two that did not are `demo-001` and `spec-001`, and both are the underrun
in another form: a read of 1.97s under 17.5s of video leaves a file that is almost entirely
bed, so the master has to lift it 7.6 dB and the ceiling does the rest of the work. That is
the picture's problem, not the mix's.

**The cache** is per phrase, keyed on the text and the voice, and lives in `.audio-cache/`.
Editing one line of a hook re-synthesises that line. Re-rendering a day runs no TTS at all.

## Rules this project holds itself to

- One source of truth for the identity. Colors, radii, spacing, motion and the type scale are
  imported from `apps/mobile/src/theme/tokens.ts`; the brand mark comes from
  `apps/mobile/src/theme/logo-geometry.ts`. No hex color, font-family string, radius or spacing
  literal may appear under `src/`.
- Nothing under `src/` may import `react-native`, `react-native-svg`, `@expo/vector-icons`,
  `expo-*`, or anything from the app other than those two theme modules. eslint enforces it.
- No em dash in any string that reaches a frame, a caption file, a manifest or the console.
- No copy may imply dating. The app is a platonic gaming-partner app. The banned words are
  allowed only inside a denial, because "no, this is not a dating app" is the strongest hook
  there is.
- No gameplay audio ever reaches a mix. Every `OffthreadVideo` in this project sets `muted` on
  the element, which is where the b-roll's game music and in-game voice are stopped. That is
  the constraint the render's own `muted` flag used to stand in for; the flag is now off,
  because there is a voiceover to hear.

## Status

Renders, with sound. `Post` switches on a hook's format and produces a finished 1080x1920
video for any of the four, the app footage is cut and timed, and every post now carries a
voiceover read off its own copy with a licensed bed carved under it.

Outstanding, and the thing the audio path measured on its way past: **every read is far
shorter than the video it belongs to.** All 24 posts underrun, and `pnpm video:audio` prints
the gap per post:

```
demo-001      read  1.97s   video 17.50s   -15.53s
demo-003      read  3.78s   video 17.50s   -13.72s
demo-002      read  3.48s   video 16.50s   -13.02s
reframe-002   read  3.07s   video 10.50s    -7.43s
...
spec-004      read  9.20s   video 13.50s    -4.30s
```

That is Cameron's first note about the combined direction, in numbers, and it belongs to the
next task rather than to the audio path: the doctrine's rule is that audio is the clock, so
the cut moves to the read and not the other way round. It is also why the master has to lift
these mixes 6 to 9 dB, because a file that is two thirds bed measures quiet however loud the
voice in it is. Re-cutting the picture to the read fixes the mixes for free.

The combined direction is the one post that agrees with itself. `kinetic-native-001` reads
9.55s against 10.93s of composition, and the 1.38s is not slack: it is the 0.20s lead-in plus
the 1.00s end card plus the 0.18s the last beat spends leaving, all of which are bed alone by
design. Inside the body every phrase sits inside its own beat with the picture leading the
voice by about 0.17s, because the beats were cut from the measured read rather than the read
being laid over a cut. The check that proves it, and the one to re-run after any retime, is
the table at the top of `src/kinetic-native/script.ts`.

It is on its third cut. The first was 14.1s and Cameron gave it three notes; the second was
9.8s and answered them; the third is 10.9s and answers a frame by frame and sample by sample
review of the second. What it changed, and the measurement behind each, is the essay at the
top of `src/kinetic-native/script.ts`. The short version: the payoff photograph, a chat beat,
four accent fields that were cutting their own letterforms, an app camera that used to park
and stop dead at its own cut, the gameplay window and its clipped HUD, the end card's timing,
and the 42.67ms of encoder delay above. It renders to
`out/_directions/kinetic-native-v4.mp4`, 328 frames, 10.93s, -14.7 LUFS, -1.5 dBTP.

### The three ads

Cameron asked for three: a swipeable carousel, the dimensional one, and "the type that we
originally started". All three run the same script (`v6-001`), the same read, the same mix and
the same shot plan, on the same warm off-white ground with the same off-black app fragments and
the same end card. They differ in one thing each.

| | Where | What makes it itself |
| --- | --- | --- |
| The fragment ad | `out/_directions/frag-dark.mp4`, `frag-light.mp4` | 377 frames, 12.63s, -14.9 LUFS, -1.7 dBTP. Objects tilted 7 degrees inside one perspective, type at 76px. Rendered as a pair so the app's two themes can be judged on real footage |
| The carousel | `out/_carousel/01..06.png` | 1080x1350 stills, no timing and no read, so the whole budget goes into composition. A mono spine label names each stage of the loop and the last card is the waitlist |
| The type ad | `out/_directions/type-clean.mp4` | 377 frames, 12.63s, -14.7 LUFS, -1.7 dBTP. One 193px hero word a beat over a 61px volt label, three times smaller in the opposite tracking and case. No tilt: this is the one that is about its own words |

The type ad is a rebuild of `src/kinetic-native/` rather than a tune of it. That cut fitted
every line to the full frame width, which assigns size by spelling: on its opening frame APP, a
three letter function word, was at about 500px and THIS IS was at about 215. Cameron's verdict
was that the words were too big and it felt cheap, and both halves of that are answered in
`src/type-clean/type.ts`, which sets the whole film at ONE hero size and one support size and
records what each line measured.


### The four angles

The direction competition is over: `pro-a-light` won it out of eleven, so the next batch is not a
new look, it is new WORDS in the one that was chosen. Four reels, one per reason a stranger might
stop, all of them `ProALight` with the same ground, camera, type law, recede, audio chain and end
card. The only thing that differs between them is the script and WHICH APP FRAGMENTS that script
needs, which is `src/pro/shots.ts` and is thirty lines of data.

| reel | angle | frames | seconds | says |
| --- | --- | --- | --- | --- |
| `out/_reels/reel-pain.mp4` | the pain | 556 | 18.53 | solo queue hands you four strangers and a coin flip |
| `out/_reels/reel-hours.mp4` | the hours | 543 | 18.10 | you play at midnight and everyone you know plays at eight |
| `out/_reels/reel-objection.mp4` | the objection | 580 | 19.33 | it looks like a dating app until you read a card |
| `out/_reels/reel-mechanic.mp4` | the mechanic | 523 | 17.43 | every card you see was scored before it was dealt |
| `out/_reels/reel-nostalgia.mp4` | the approved film | 551 | 18.37 | your best games were the ones you played with someone else |

The fifth row is `pro-001` itself, rendered into this folder so all five films sit on one clock
and `pnpm measure` reads them through one filter. It is not a fifth post and it has no caption
block: the version that went out is `out/_directions/pro-a-light.mp4` and nothing writes that path.

Measured off the finished containers with `pnpm measure`, with the approved direction in the same
table so the comparison is against the file Cameron actually chose:

| file | mean luma | LUFS | dBTP | LRA |
| --- | --- | --- | --- | --- |
| `pro-a-light.mp4` (reference) | 228.3 | -15.1 | -1.9 | 6.9 |
| `reel-pain.mp4` | 229.5 | -15.1 | -1.8 | 6.0 |
| `reel-hours.mp4` | 230.3 | -15.2 | -1.9 | 8.0 |
| `reel-mechanic.mp4` | 231.1 | -15.0 | -1.8 | 6.6 |
| `reel-nostalgia.mp4` | 229.1 | -15.1 | -1.9 | 6.9 |
| `reel-objection.mp4` | 232.3 | -15.1 | -1.9 | 6.1 |

Every luma figure rose by 0.6 to 0.8 when the hook was retimed, and the cause is arithmetic rather
than a grade: the object now recedes toward the paper about 24 frames earlier in every film, so a
few more of the sampled frames are paper. Nothing about the ground, the grade or the object
changed. The loudness columns are identical to the pre-retime batch, because no audio was rebuilt.

Mean luma is `signalstats` YAVG averaged over every fifth frame. TWO THINGS ARE WORTH SAYING ABOUT
THAT NUMBER rather than letting a future reader rediscover them.

The first is that the whole LIGHT-APP family sits ABOVE the 194-223 band the campaign quotes, the
approved file included, and it is not a defect: 194 is Uber and 223 is ClickUp, both measured on
their own grounds, and this ground is a warm off-white with a light-themed app on it. Measured the
same way, `pro-a.mp4` is 221.1, `pro-b-light.mp4` 220.4 and `pro-b.mp4` 219.1 - the three that
carry the app's DARK theme, or its dark object, land inside the band and the one that does not is
the one that shipped. So the band is the wrong instrument for this cut and the reference row is
the right one. Every reel in this batch is within 3.4 units of it.

The second is that the number's real job is still done. The failure it exists to catch is a batch
that came back at 19, which is a film that rendered essentially black, and 228 against 19 is a
factor of twelve.

The loudness column is measured on the MP4 rather than on the WAV, and it reads about 0.4 LU
quieter for that reason: the committed mixes in `src/audio/timings.generated.ts` are -14.6 to
-14.7 LUFS, the containers are -15.0 to -15.2, and the approved reference makes the same trip
(-14.7 in the table, -15.1 in the file). Every file is under the -1 dBTP ceiling.

#### The three sheets

`pnpm angles` also writes three more 1080x1350 sheets into `out/_static/`, on the design
`feed-light.png` already uses, with the statement as the only variable:

| file | says | mean luma |
| --- | --- | --- |
| `feed-pain-light.png` | pick one of your four | 196.7 |
| `feed-hours-light.png` | find a duo who is awake when you are | 199.3 |
| `feed-mechanic-light.png` | your deck is sorted by shared games and shared hours | 196.7 |

The shipped `feed-light.png` measures 199.3 on the same filter, so the three are its siblings
rather than a new look. All four sheets already in that folder are untouched.

THERE IS NO OBJECTION SHEET, and `src/static/sheets.ts` carries the argument at length. The short
version: that angle's method is a resemblance named and then corrected, the correction is a second
beat, and a still has no second beat. The film may say the line because the film finishes the
sentence.

#### The hook retime

Measured on the first delivered batch, the first sentence of every film finished writing itself at
f81 to f86, 2.70s to 2.87s, while the voice started at 0.20s. A scroll decision on Reels and TikTok
is made in roughly the first 1 to 1.5 seconds, so the film spent the whole decision window on an
object and delivered its argument after the decision. The first reel got 116 views.

`HOOK` in `src/pro/film.ts` gives beat one, and only beat one, two things the other beats do not
have: a solo of ZERO instead of `SOLO.normal`'s 30, and a cadence solved forwards from a deadline
instead of backwards from the exit. The deadline is f34, 1.133s. `statementPlan` now takes the whole
`Statement` so the rule cannot be applied in one renderer and forgotten in the cover.

The per-word build survives on beat one and the file argues why at length; the short version is that
the whole build now happens inside the decision window, so it costs the read nothing, and a composed
block would break the type law of the three beats that follow it. Beats two onward were not touched.

MEASURED ON THE RENDERED FILES rather than derived from the plan. The metric is DEEP INK: the
count of pixels below luma 60 inside a 1080x400 crop of the type band. It ignores the footage by
construction, because the receded plate is washed 70 percent toward the paper and blurred 9px so
nothing in it is near black, while the statement is set in the film's near-black ink. A word still
building is at scale 0.35 under a 14px blur and its darkest pixel is grey; a word that has landed
contributes all of its ink. The curve steps once per word and is flat from the frame the last word
lands on. `objection` is measured on its last word alone instead, because that word is the ACCENT
and is set in olive, which never crosses the deep-ink threshold:

| file | hook | last word painted |
| --- | --- | --- |
| `reel-pain.mp4` | solo queue hands you four strangers and a coin flip | f34, 1.133s |
| `reel-mechanic.mp4` | every card you see was scored before it was dealt | f34, 1.133s |
| `reel-objection.mp4` | it looks like a dating app until you read a card | f34, 1.133s |
| `reel-hours.mp4` | you play at midnight and everyone you know plays at eight | f34, 1.133s |
| `reel-nostalgia.mp4` | your best games were the ones you played with someone else | f34, 1.133s |

Ten and eleven word hooks land on the same frame because the cadence is solved per hook: 3.111
frames a word at ten, 2.800 at eleven. The floor is 2.6 and is never reached.

#### What proves beats two onward did not move

The hook retime touches one statement, so the claim that everything after it is untouched has to be
measured rather than asserted. `psnr` of each retimed film against its own pre-retime render:

| file | bit-identical frames | every difference inside | after beat one |
| --- | --- | --- | --- |
| `reel-mechanic.mp4` | 395 of 523 | f2-f129 | 2 frames of 398, worst 53.70 dB |
| `reel-objection.mp4` | 444 of 580 | f2-f137 | 2 frames of 447, worst 53.58 dB |
| `reel-hours.mp4` | 304 of 543 | f2-f543 | 48 frames of 407, worst 44.72 dB |

The two films with no gameplay footage in them outside the last beat come back essentially
bit-identical after beat one. `hours` does not, and 44.72 dB is why: that is the `OffthreadVideo`
decode floor this project already measured on a control that rendered the SAME source twice and got
44.69 dB. The residual is decode, not timing.

#### What proves the posted file did not move

`out/_directions/pro-a-light.mp4` has md5 `14142370a9a97458011b733f8eaa6c4e` before and after. No
script in this directory writes that path: `pnpm angles` renders the approved film to
`out/_reels/reel-nostalgia.mp4` instead, which is the retimed cut and is deliberately not the same
film as the posted one.
