/**
 * The cut list. One entry per usable moment of footage, named for what it shows, so a hook
 * asks for `"duo-locked"` and never for a file and a stopwatch reading.
 *
 * This is the only place timecodes live. Re-recording the app therefore costs one pass over
 * this file, not a re-edit of anything downstream.
 *
 * The app clips arrive already cut into one file each (see public/footage/README.md, which
 * carries the source offset and the exact ffmpeg line for every one of them). They keep
 * `from`/`to` anyway, because `Clip.tsx` reads the same three fields for every entry and
 * because tightening a clip is then the same edit whether or not it has its own file. Every
 * file is cut about 0.2s longer than its `to`, so a clip can be nudged out a fraction here
 * without going back to ffmpeg; going out further than that needs a re-cut.
 *
 * `to` sits just inside the real duration, and that gap is load bearing rather than tidy:
 * `OffthreadVideo` renders NOTHING past its trimmed range, so a clip that runs out under a
 * slot leaves bare graticule with the hook line floating on it. Every number below is at
 * least as long as the longest slot that asks for it. The check is:
 *
 *   reframe / pain:  to - from  >=  hook.seconds
 *   demo:            to - from  >=  (hook.seconds * 30 - 8) / 3 / 30, about a third of it
 *
 * The recording switches from dark to light at 92s. A `demo` should not straddle that: a
 * theme change between steps reads as a glitch, not as variety. `deck-light`,
 * `matches-light` and `chat-priya` are the light set; everything else is dark.
 *
 * The broll clips are cut from a real match; see the note on their entries below. Every clip
 * a hook references now exists, so validation should be clean and no post should render the
 * missing-clip panel.
 */
export const clips = {
  // Deck browsing into a match. The last third is DUO LOCKED, which is why this is the clip
  // reframe-001 plays under: "it's for finding people to actually play with" lands exactly as
  // the duo does.
  "deck-dark":     { file: "deck-dark.mp4",     from: 0, to: 9.4 },
  // Five full cards and two passes, no match screen. The one to use when the copy is about
  // what is on a card rather than about matching.
  "deck-cards":    { file: "deck-cards.mp4",    from: 0, to: 8.8 },
  "deck-light":    { file: "deck-light.mp4",    from: 0, to: 7.4 },
  "match-kofi":    { file: "match-kofi.mp4",    from: 0, to: 5.2 },
  "duo-locked":    { file: "duo-locked.mp4",    from: 0, to: 8.2 },
  // The list for 2.5s, then it opens the Priya thread. It has to reach 6s to cover a reframe,
  // and the list alone is only on screen for half that.
  "matches-light": { file: "matches-light.mp4", from: 0, to: 6.1 },
  "chat-typing":   { file: "chat-typing.mp4",   from: 0, to: 8.0 },
  // Starts 2.7s after matches-light opens the same thread, so demo-003 steps 2 and 3 overlap
  // by about a second. The conversation is static, so the cut reads as the label changing
  // rather than as a repeat.
  "chat-priya":    { file: "chat-priya.mp4",    from: 0, to: 6.1 },
  "own-profile":   { file: "own-profile.mp4",   from: 0, to: 9.9 },
  // No hook uses these three yet. They are cut and kept because the moments exist in the
  // recording and finding them again costs another pass over two minutes of video.
  "settings-sub":  { file: "settings-sub.mp4",  from: 0, to: 2.8 },
  "paywall":       { file: "paywall.mp4",       from: 0, to: 3.0 },
  "appearance":    { file: "appearance.mp4",    from: 0, to: 2.6 },
  // Cut from a 15:15 ranked Valorant match on Breeze that Cameron played well and lost, which
  // is the better beat for this format: not "you are bad at this", but "none of that was the
  // problem". Each is its own file rather than an offset into the source, because the source
  // is 3.2GB at 29Mbps and OffthreadVideo would re-read it on every frame of every pass. Each
  // file is 10s long and each `to` is 9.5s, keeping the same half-second of slack the app
  // clips carry.
  //
  // Offsets into the original recording, if these ever need re-cutting:
  //   broll-quiet 296s (walking an empty Breeze alone), broll-teamfight 445s (a firefight),
  //   broll-loss 906s (the round lost, then DEFEAT).
  "broll-loss":      { file: "broll-loss.mp4",      from: 0, to: 9.5 },
  "broll-quiet":     { file: "broll-quiet.mp4",     from: 0, to: 9.5 },
  "broll-teamfight": { file: "broll-teamfight.mp4", from: 0, to: 9.5 },
} as const;
