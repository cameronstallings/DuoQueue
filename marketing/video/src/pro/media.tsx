/**
 * The footage, and the one table that says how big a piece of it is on the frame.
 *
 * Every entry is a REGION of an iPhone capture that ffmpeg already cut, so its `source` is its
 * own true pixel size and nothing here is ever letterboxed, stretched or cropped a second time.
 * `public/footage/README.md` carries the crop rectangle and the exact ffmpeg line for each.
 *
 * DARK ONLY. Cameron shot both themes to settle the question and the arithmetic settles it:
 * #CDFF3D is about 1.4:1 on white and about 13:1 on the app's own off-black, so a light-themed
 * app deletes the brand's only signature colour. The light halves of the table stay in
 * src/data/clips.ts for the rejected direction that used them.
 *
 * =====================================================================================
 * WHAT IS LEGIBLE UNDER EACH LINE, and why two crops the rejected direction used are absent
 * =====================================================================================
 *
 * The constraint that has bitten this film twice is that nothing on the frame may contradict the
 * voice, and both times the contradiction was a chip nobody had read. So, per beat:
 *
 *   1  "your best games were the ones you played with someone else"
 *      Daylight on Breeze: a doorway, the sea and a first person weapon. A real match, and the
 *      only footage in the film that is not the app.
 *   2  "duoqueue is where you find the next one"
 *      Kofi's card from its true top edge to just under the playstyle chip: the photograph, the
 *      chartreuse NO. 001, the avatar ring, "Kofi, 26 . Africa . EN", and ROCKET LEAGUE .
 *      Ranked Grinder. A person, with a face, which the copy never denies.
 *   3  "you match on the games you play and how you play them"
 *      ">> 3 GAMES IN COMMON", the app's own count of shared titles, then "ROCKET LEAGUE .
 *      Ranked Grinder", the app's own playstyle tag. The two halves of the sentence, in the
 *      app's own words, in order.
 *   4  "lock the duo, send a message, and go play"
 *      DUO LOCKED over the photograph; the Send a message button and the message it produced;
 *      then the game again, which is where the sentence ends.
 *
 * `prompt` and `card-lower` are deliberately not in the table. Both crops contain Kofi's prompt
 * answer, "Hit Grand Champion in Rocket League SOLO QUEUE. Took two years. Worth it.", and at the
 * size a fragment is drawn here those two words are among the most legible on the frame. A film
 * about finding a duo does not put SOLO QUEUE on screen at 44px, and the fix is a crop that stops
 * above the sentence rather than a smaller card.
 */
import {
  AbsoluteFill,
  Freeze,
  getStaticFiles,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

import { clips } from "@/data/clips";
import { FPS } from "@/lib/scale";
import type { ClipName } from "@/types";

export const FRAGMENTS = {
  /** Kofi's card, top edge to under the playstyle chip. The hero object of the whole film. */
  card: { clip: "frag-dark-card-top", source: [1032, 660] },
  games: { clip: "frag-dark-games", source: [490, 100] },
  role: { clip: "frag-dark-role", source: [670, 90] },
  /** The reticle closing round the photo and the DUO LOCKED banner, as one continuous take. */
  locked: { clip: "frag-dark-locked", source: [520, 640] },
  send: { clip: "frag-dark-send", source: [1070, 206] },
  bubble: { clip: "frag-dark-bubble", source: [460, 200] },
  actions: { clip: "frag-dark-actions", source: [720, 226] },
  /** The whole phone screen, for the direction that draws a device. */
  screen: { clip: "deck-dark-raw", source: [1180, 2556] },
  /** The only landscape piece, and the only one that is not the app. */
  play: { clip: "frag-play", source: [1660, 934] },
} as const satisfies Record<string, { clip: ClipName; source: readonly [number, number] }>;

export type FragName = keyof typeof FRAGMENTS;

/** The aspect of a fragment, which is what turns a stated width into a height. */
export const heightOf = (frag: FragName, width: number): number => {
  const [w, h] = FRAGMENTS[frag].source;
  return Math.round((width * h) / w);
};

/** public/footage is gitignored and filled by hand, so a component in the browser asks the
 * bundler's manifest whether a file is actually there. A missing file renders as the app's own
 * field rather than as a broken render. */
const isPresent = (path: string): boolean => getStaticFiles().some((asset) => asset.name === path);

/**
 * One fragment, drawn to fill exactly the element it is given.
 *
 * The element is always sized from the crop's own aspect by `heightOf`, so "cover" and "contain"
 * would produce the same picture and the fit is not a decision this component has to make. The
 * one exception is the phone screen inside a device body, where the body's aspect is the screen's
 * by construction.
 */
export const Fragment = ({
  frag,
  from = 0,
  startAt = 0,
}: {
  frag: FragName;
  from?: number;
  /**
   * THE COMPOSITION FRAME THIS FRAGMENT CAME ON SCREEN, and the most load-bearing prop here.
   *
   * An OffthreadVideo reads its position from the surrounding timeline, so without this every
   * clip plays from COMPOSITION frame zero no matter when it appears. These crops are two to
   * eight seconds long and the film is eighteen, so a clip mounted late is asked for a frame it
   * does not contain and Remotion draws nothing. That is not a theory: it put 151 frames of
   * pro-b, 5.0 of its 18.4 seconds, on a black screen, and every dead run lines up exactly with a
   * clip's own length. frag-dark-games and -role are 150 frames and went black from f240; the
   * 28-frame frag-dark-send went black at f412; the 57-frame frag-play went black at f449 and
   * again under the closing hold; and direction A's 486-frame deck-dark-raw went black at f485,
   * which is the frame its dead run starts on.
   *
   * So the clip is rebased to the frame it arrived on, and it is HELD rather than allowed to run
   * out: `send` is 28 frames inside a 34 frame clause and the closing `play` is 57 inside 66, so
   * two of them still end before their window does. A held last frame is a still; an exhausted
   * OffthreadVideo is a black hole.
   */
  startAt?: number;
}) => {
  const frame = useCurrentFrame();
  const entry = clips[FRAGMENTS[frag].clip];
  const path = `footage/${entry.file}`;
  if (!isPresent(path)) {
    return <AbsoluteFill style={{ backgroundColor: "#0A0B09" }} />;
  }

  const video = (
    <Sequence from={startAt} layout="none">
      <OffthreadVideo
        src={staticFile(path)}
        trimBefore={Math.round((entry.from + from) * FPS)}
        trimAfter={Math.round(entry.to * FPS)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </Sequence>
  );

  // Outside the clip's own span the picture is frozen on the nearest frame it does have, at both
  // ends. Before `startAt` a Sequence would render nothing at all, which is the same black frame
  // by a different route, and a caller that fades an element up over the frames just before it
  // formally begins is entitled to a picture.
  const runsOutAt = startAt + Math.round((entry.to - entry.from - from) * FPS);
  const held =
    frame < startAt ? startAt : frame >= runsOutAt ? Math.max(startAt, runsOutAt - 1) : null;

  return held === null ? video : <Freeze frame={held}>{video}</Freeze>;
};
