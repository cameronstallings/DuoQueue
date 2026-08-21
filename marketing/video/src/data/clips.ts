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
  // THE WHOLE SCREEN, UNCUT, and the only entry here that is not a cropped region.
  //
  // src/pro/a/ draws a phone as a real object in studio light, so it needs the recording the
  // fragment crops were cut FROM rather than any of the crops. Kofi's card is held perfectly
  // still from 0 to 16.4s in this take; `to` stops at 16.2 so no beat can run into the swipe
  // that ends it. 1180x2556, the iPhone capture's own pixels, same as every app source here.
  "deck-dark-raw": { file: "deck-dark-raw.mp4", from: 0, to: 16.2 },
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
  // ---------------------------------------------------------------------------------------
  // The fragment set. Cut 2026-08-20 from four fresh recordings for the light-ground /
  // isolated-fragment direction, and unlike every clip above these are CROPPED: each file is
  // one region of the phone screen at its native resolution, not a whole 1180x2556 frame.
  //
  // That is the direction's whole premise. The references it is built from (ClickUp, a food
  // delivery promo, Uber) never show a phone; they pull ONE element out and let it own half
  // the frame on empty ground. Isolating the region in ffmpeg rather than at render time
  // keeps Clip.tsx and framing.ts untouched, decodes a 460x200 file instead of a 3MP one, and
  // records the crop rectangle in public/footage/README.md beside the line that produced it.
  //
  // The `-dark` and `-light` halves are the same fragments of the same screens with the same
  // crop rectangles, so the two deliverables differ only in the app's theme. Kofi is the duo
  // in BOTH halves: dark from deck-dark-raw, light from raw-light. `frag-dark-bubble` is the
  // one exception, cut from raw-dark's Sana thread, and its crop excludes the header and the
  // "Say hi to Sana!" empty state so that no name is on screen.
  //
  // Every window is a measured still hold with both ends verified frame by frame. Several are
  // SHORT because the moment is short, not because the cut is lazy: the dark DUO LOCKED banner
  // holds for 1.1s before the app dismisses it, and the button is fully lit for 1.0s of that.
  // Nothing may ask these for more time than they have.
  "frag-dark-card":        { file: "frag-dark-card.mp4",        from: 0, to: 8.0 },
  // The card minus the top half of the photo. Everything from the chin of the photo down,
  // which means it also carries the prompt sentence. See `-card-top` for why nothing uses it.
  "frag-dark-card-lower":  { file: "frag-dark-card-lower.mp4",  from: 0, to: 8.0 },
  // THE HERO, and it exists because of one string in the footage.
  //
  // Kofi's prompt answer reads "Hit Grand Champion in Rocket League SOLO QUEUE. Took two
  // years. Worth it." Every crop that contains the lower card contains those two words, and
  // at the size this direction draws a fragment they are the most legible text on the frame.
  // A film whose first line is "queue up with a duo" cannot have "solo queue" as its largest
  // on-screen words, and the answer is not a smaller card, it is a crop that stops above the
  // sentence: the card from its true top edge down to just under the playstyle chip, 13px
  // below the chip's border and 14px above the "MY PROUDEST GAMING ACHIEVEMENT IS" label.
  //
  // What survives is the whole photograph, the card's real rounded top corners, the overflow
  // button, the chartreuse NO. 001, the avatar ring with its online dot, Kofi, 26 . Africa .
  // EN, and ROCKET LEAGUE . Ranked Grinder. What is gone is the prompt and the games chip,
  // and both of those get their own beat later anyway.
  "frag-dark-card-top":    { file: "frag-dark-card-top.mp4",    from: 0, to: 8.0 },
  // The prompt sentence WITHOUT its "MY PROUDEST GAMING ACHIEVEMENT IS" label, so a line can
  // talk about how someone plays without the pixels calling it an achievement.
  "frag-dark-prompt":      { file: "frag-dark-prompt.mp4",      from: 0, to: 5.0 },
  "frag-dark-games":       { file: "frag-dark-games.mp4",       from: 0, to: 5.0 },
  "frag-dark-role":        { file: "frag-dark-role.mp4",        from: 0, to: 5.0 },
  "frag-dark-actions":     { file: "frag-dark-actions.mp4",     from: 0, to: 5.0 },
  "frag-dark-highlights":  { file: "frag-dark-highlights.mp4",  from: 0, to: 5.0 },
  // The reticle closing around the photo, in app. 0.25s of real motion; the rest is settle.
  "frag-dark-lock-in":     { file: "frag-dark-lock-in.mp4",     from: 0, to: 0.6 },
  "frag-dark-duo":         { file: "frag-dark-duo.mp4",         from: 0, to: 0.9 },
  // THE ONE CLIP THE BEAT TABLE FORCED, and the two above are why it exists rather than being
  // a preference. `lock-in` and `duo` are two windows on ONE event and they OVERLAP in the
  // source, 17.85 to 18.62 and 18.35 to 19.47, so playing them end to end rewinds a quarter of
  // a second of the same crop, which reads as a stutter. Either one alone is shorter than the
  // 49 frames the read gives the "duo locked" beat: 18 and 27.
  //
  // This is the same rectangle run CONTINUOUSLY from 17.91, the first frame where the arriving
  // sheet has filled the crop and the deck behind it is no longer inside it, to 19.62, one
  // frame before the app dismisses the banner. `to` stops at 1.66 so the beat's 49 frames end
  // 0.05s clear of that dismissal. The beat therefore opens on the app's own ring closing,
  // which is real product motion, and holds settled for the rest of the phrase.
  "frag-dark-locked":      { file: "frag-dark-locked.mp4",      from: 0, to: 1.66 },
  // 0.92 rather than the 0.8 this was cut at. The file is 0.98s and every frame of it is the
  // fully lit button, so the extra 0.12s costs nothing and buys the "send a message" beat an
  // even 26/26 split against the bubble instead of 24/28.
  "frag-dark-send":        { file: "frag-dark-send.mp4",        from: 0, to: 0.92 },
  "frag-dark-bubble":      { file: "frag-dark-bubble.mp4",      from: 0, to: 2.1 },
  "frag-light-card":       { file: "frag-light-card.mp4",       from: 0, to: 3.4 },
  "frag-light-card-lower": { file: "frag-light-card-lower.mp4", from: 0, to: 3.4 },
  // The same rectangle in the light recording. 3.4 rather than the dark clip's 8.0 because the
  // light card is only on screen for 3.62s before the swipe; beat one asks for 2.33s, so the
  // slack is half a second on both.
  "frag-light-card-top":   { file: "frag-light-card-top.mp4",   from: 0, to: 3.4 },
  "frag-light-prompt":     { file: "frag-light-prompt.mp4",     from: 0, to: 3.4 },
  "frag-light-games":      { file: "frag-light-games.mp4",      from: 0, to: 3.4 },
  "frag-light-role":       { file: "frag-light-role.mp4",       from: 0, to: 3.4 },
  // Starts 0.4s after its siblings: the boost button is still fading back up from the press
  // that dealt this card, and the first 0.35s of the row is washed out.
  "frag-light-actions":    { file: "frag-light-actions.mp4",    from: 0, to: 3.05 },
  "frag-light-highlights": { file: "frag-light-highlights.mp4", from: 0, to: 3.4 },
  "frag-light-lock-in":    { file: "frag-light-lock-in.mp4",    from: 0, to: 0.6 },
  "frag-light-duo":        { file: "frag-light-duo.mp4",        from: 0, to: 3.3 },
  // The same span in the light recording, 8.91 to 10.62, cut to the same 1.71s so the two
  // deliverables differ by app theme and by nothing else. The light banner holds to 13.22 and
  // could have run three times as long; it is cut to the dark one's length on purpose, because
  // a beat that is generous in one film and tight in the other is not a comparison.
  "frag-light-locked":     { file: "frag-light-locked.mp4",     from: 0, to: 1.66 },
  "frag-light-send":       { file: "frag-light-send.mp4",       from: 0, to: 3.3 },
  "frag-light-bubble":     { file: "frag-light-bubble.mp4",     from: 0, to: 1.8 },
  // The one fragment in the set that is not the app, and the only one both films share, because
  // the thing being compared is the app's theme and this is not the app.
  //
  // A 16:9 centre crop of `broll-quiet`, 1660x934 at 450,300 of the 2560x1440 capture, cut from
  // 2.05 to 4.00. Every number in that rectangle is a redaction. The source is a SPECTATOR
  // capture: its full frame carries a minimap at the top left, a killfeed at the top right, a
  // scoreboard along the top and the round HUD along the bottom, and the killfeed prints real
  // gamertags. The crop starts below all of it and ends above the HUD, and the window is inside
  // the 2.00 to 3.90 seconds where no teammate nameplate is on screen either. What is left is a
  // doorway, daylight, the sea, and a first person weapon.
  "frag-play":             { file: "frag-play.mp4",             from: 0, to: 1.9 },
} as const;
