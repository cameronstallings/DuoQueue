/**
 * WHICH FRAGMENT SITS UNDER EACH BEAT, HOW BIG IT IS DRAWN, AND HOW IT ARRIVES.
 *
 * One plan, both deliverables. `frag-dark.mp4` and `frag-light.mp4` read this same file and
 * differ only in which column of `FRAGMENTS` they resolve, so a difference between the two
 * rendered files is a difference of app theme and of nothing else. Cameron shot both recordings
 * deliberately to compare them on real footage rather than in theory, and a comparison where
 * one side also got a different layout is not one.
 *
 * =====================================================================================
 * SIZE IS A DECISION, AND IT IS MADE TWICE
 * =====================================================================================
 *
 * The three WIDE objects, the card, the prompt sentence and the send button, are all drawn at
 * MEASURE exactly. That is a grid decision, not an absence of one: they are the beats where the
 * fragment IS the frame's subject, and giving them a shared right edge is what makes the film
 * read as one column rather than as six differently cropped pictures.
 *
 * Everything else is a stated fraction of MEASURE, and the fraction is chosen so the app's own
 * type inside the fragment lands somewhere between 34 and 44px on the finished frame. That is
 * the number this whole direction exists to fix, so it is worth writing the arithmetic down:
 * a fragment drawn at width W renders its own contents at W / sourceWidth of their recorded
 * size, and the recorded sizes here are a 1180px-wide iPhone capture.
 *
 *   card-top    844 / 1032 = 0.82   Kofi at 62px, the playstyle chip at 29px
 *   games       844 / 490  = 1.72   >> 3 GAMES IN COMMON at 51px
 *   role        844 / 670  = 1.26   ROCKET LEAGUE . Ranked Grinder at 45px
 *   locked      523 / 520  = 1.01   DUO LOCKED at 40px, the ring 460px across
 *   send        844 / 1070 = 0.79   Send a message at 43px
 *   bubble      473 / 460  = 1.03   Hey you on tn? at 45px
 *   play        844 / 1660 = 0.51   no type in it at all, so nothing to hold it to
 *
 * Compare the cut before this one, where the same card sat inside a whole 1180x2556 phone drawn
 * 748px wide: the prompt rendered at 12px and the games chip at 9. The fragment is not a
 * stylistic preference over the phone, it is a 3x on the thing that was unreadable.
 *
 * =====================================================================================
 * WHAT IS ON THE FRAME WHILE EACH LINE IS SPOKEN
 * =====================================================================================
 *
 * The constraint that has bitten this film twice is that nothing on screen may contradict what
 * the voice says, and both times it bit, the contradiction was a chip nobody had read. So, per
 * beat, the legible pixels, checked on extracted frames of the clips themselves:
 *
 *   1  "queue up with a duo"      Kofi's card from its top edge to under the playstyle chip:
 *                                 the photograph, NO. 001, Kofi, 26 . Africa . EN, and
 *                                 ROCKET LEAGUE . Ranked Grinder. A person you could queue
 *                                 with, and no sentence on it.
 *   2  "you match on the game"    >> 3 GAMES IN COMMON, alone. A count of shared titles, which
 *                                 is the claim rendered by the app in the affirmative.
 *   3  "and how they play"        ROCKET LEAGUE . Ranked Grinder, alone. `Ranked Grinder` is
 *                                 the app's own playstyle tag.
 *
 *                                 The beat that used to be here isolated the prompt sentence,
 *                                 and that was the film's one real contradiction: the largest,
 *                                 highest-contrast text on the frame under "and how they play"
 *                                 read "Hit Grand Champion in Rocket League SOLO QUEUE", in a
 *                                 film that opens "queue up with a duo". Two words of somebody
 *                                 else's bio, at 44px across 845px, saying the opposite of the
 *                                 product. It is also an achievement rather than a playstyle,
 *                                 so it did not support the line it was under. Both crops that
 *                                 carried it are gone from the plan.
 *   4  "duo locked"               DUO LOCKED, in the app's own two words, over the photograph.
 *   5  "send a message"           The app's own Send a message button, then the message that
 *                                 resulted, "Hey you on tn?", marked SENT.
 *   6  "then go play"             Daylight on Breeze: a doorway, the sea, and a first person
 *                                 weapon. The only fragment that is not the app, the only
 *                                 landscape one, and the last picture before the wordmark.
 *
 * =====================================================================================
 * BEAT SIX WAS EMPTY FIRST, AND RENDERING IT IS WHAT SETTLED IT
 * =====================================================================================
 *
 * The first cut of this plan gave the last beat no object. The argument was good on paper: six
 * beats of software, and the one that says "then go play" has no software on it, because a duo
 * finder is supposed to end outside itself. All three reference reels do empty the frame before
 * their wordmark.
 *
 * Rendered, it was a blank frame for 1.73 seconds. Not spare, not restful: in a feed it reads as
 * a video that has ended or failed, and it is an eighth of the runtime. That is the entire value
 * of rendering an argument rather than writing it down, and it is the second time on this film
 * that a decision which was correct in prose was wrong in pixels.
 *
 * So the beat gets the thing the line is about. It is the same card, at the same measure, on the
 * same stage, under the same shadow and the same tilt as the five app fragments before it, which
 * is what keeps it from reading as a different film: the treatment is identical and only the
 * contents changed. It also gives the cut the one tonal arc six near-black rectangles cannot,
 * which is five quiet dark objects and then daylight.
 *
 * What it cost is one careful crop, because the source is a spectator capture and its full frame
 * carries other people's gamertags. See `frag-play` in src/data/clips.ts for which rectangle and
 * why every edge of it is a redaction.
 */
import type { ClipName } from "@/types";

import { MEASURE } from "./ground";

/**
 * THE FRAGMENT TABLE. One row per region of the phone screen this film uses, with the clip that
 * carries it in each theme and the crop's own pixel size, which is what the card is drawn at so
 * nothing is ever stretched or letterboxed.
 *
 * The two themes share every crop rectangle, verified by the cutter against both sources, which
 * is why one table can carry both. `satisfies` keeps the clip names checked against
 * src/data/clips.ts, so renaming a clip there breaks this file rather than silently rendering
 * the missing-footage panel.
 */
export const FRAGMENTS = {
  "card-top": {
    dark: "frag-dark-card-top",
    light: "frag-light-card-top",
    source: [1032, 660],
  },
  role: { dark: "frag-dark-role", light: "frag-light-role", source: [670, 90] },
  games: { dark: "frag-dark-games", light: "frag-light-games", source: [490, 100] },
  actions: { dark: "frag-dark-actions", light: "frag-light-actions", source: [720, 226] },
  locked: { dark: "frag-dark-locked", light: "frag-light-locked", source: [520, 640] },
  send: { dark: "frag-dark-send", light: "frag-light-send", source: [1070, 206] },
  bubble: { dark: "frag-dark-bubble", light: "frag-light-bubble", source: [460, 200] },
  // The one row whose two columns are the same file, because this fragment is not the app and
  // the thing the two deliverables are comparing is the app's theme. Both films close on the
  // same daylight.
  play: { dark: "frag-play", light: "frag-play", source: [1660, 934] },
} as const satisfies Record<
  string,
  { dark: ClipName; light: ClipName; source: readonly [number, number] }
>;

export type FragName = keyof typeof FRAGMENTS;
export type Theme = "dark" | "light";

/** One fragment, placed. `radius` rounds the card's own corners, which is what turns a
 * rectangular region of a screen recording into an object; it is smaller on the two chips
 * because their crops sit closer to the content inside them. */
export interface Placed {
  frag: FragName;
  width: number;
  radius: number;
  /**
   * Where the piece sits across the measure, and it exists for exactly one pair.
   *
   * Everything in this film hangs off X0, one left edge, which is the grid. The action row is
   * the one fragment whose own screen position argues otherwise: in the app it is CENTRED under
   * the card, and left-aligning it under a card it is narrower than reads as a mistake rather
   * than as a ragged right. So it centres inside the measure, under the card, where the app
   * puts it. Default is left and nothing else overrides it.
   */
  align?: "left" | "center";
}

/**
 * One picture inside a beat. Most beats are one shot; beat five is two, because the button and
 * the message it produced are two moments and showing them as one would be a claim about a
 * static screen.
 */
export interface FragShot {
  pieces: Placed[];
  /** Frames this shot holds inside its beat. The last shot of a beat leaves this out and takes
   * whatever is left, so a beat's total can never disagree with the read. */
  frames?: number;
}

/**
 * How a beat's picture enters and leaves.
 *
 *   "curve"  is technique 3, cut the curve: the film's default and its current. Out to the left
 *            accelerating, in from the right decelerating, mirrored power4, partial travel.
 *   "recede" and "arrive" are the two halves of technique 2, the INVERSE zoom through, which
 *            the doctrine reserves for ARRIVAL and this film spends exactly once. Beat three's
 *            prompt recedes and blurs; beat four's DUO LOCKED arrives oversized and retracts
 *            into the plane. It is spent on the payoff, and it is the one seam in the film where
 *            the app's own motion reinforces ours rather than competing with it: the ring closes
 *            inward while the card retracts inward, one vector, two causes.
 *   "hold"   is no gesture at all, and it is used on both inner edges of a beat that has two
 *            shots. The object simply exists, already travelling on the cruise, and the cut is a
 *            straight one. That is not an absence of a seam, it is the purest form of the
 *            doctrine's velocity match: both objects are moving left at exactly 1.25px a frame
 *            on the frames either side, so the eye reads one continuous move with the contents
 *            swapped.
 *
 *            It is also what the footage needs. Given a curve on both edges, the bubble's 26
 *            frame window spent 13 arriving and 10 leaving and was fully opaque for three, and
 *            the message a viewer is supposed to READ was legible for a tenth of a second. A
 *            seam is not worth spending on a cut that is already velocity matched.
 */
export type Vector = "curve" | "recede" | "arrive" | "hold";

export interface FragBeat {
  shots: FragShot[];
  enter: Vector;
  exit: Vector;
}

/** A fraction of the measure, rounded, so the sizes in the table read as the decisions they
 * are rather than as seven unrelated pixel counts. */
const part = (fraction: number): number => Math.round(MEASURE * fraction);

export const PLAN: FragBeat[] = [
  // "queue up with a duo". The hero: the deck card from its real top edge down to just under
  // the playstyle chip, at the full measure. It has the card's own rounded top corners, the
  // overflow button, the chartreuse NO. 001, the avatar ring, the name and the chip, and it
  // stops above the prompt sentence. See `frag-dark-card-top` in src/data/clips.ts for the
  // string that decided that boundary.
  //
  // THE ACTION ROW UNDER IT IS THE ONE PLACE THIS FILM SHOWS TWO PIECES BECAUSE THE PRODUCT
  // DOES, and it earns the exception three times over.
  //
  //   The card alone is 1032 by 660, which draws as a 1.56:1 letterbox on the frame, and about
  //   60% of it is the blank wall behind Kofi. Rendered, the opening object read as a wide
  //   photograph with a name on it rather than as a deck card, which is the exact criticism the
  //   whole direction exists to answer. The pair is 844 by 745, portrait, and reads as a screen.
  //
  //   It is the strongest brand object the app has. The boost button is a solid #CDFF3D disc in
  //   Dark, and the first frame of the film is what a feed grabs for a thumbnail. Before this,
  //   the dark cut carried no chartreuse at all until 6.5s and the light cut carried none until
  //   the end card. The light row's boost is dark olive, not chartreuse, but on this ground it
  //   is about 5:1 and it is the highest-contrast object the light cut owns.
  //
  //   It is opaque UI with its own fill in both themes, which the card is not.
  //
  // It is not a second claim. A card and the three things you can do to it are one screen, and
  // in the app they are 97px apart with the row centred under the card, which is what `align`
  // and PIECE_GAP reproduce.
  {
    shots: [
      {
        pieces: [
          { frag: "card-top", width: MEASURE, radius: 24 },
          { frag: "actions", width: part(0.6), radius: 20, align: "center" },
        ],
      },
    ],
    enter: "curve",
    exit: "curve",
  },
  // "you match on the game". The overlap chip alone, at the full measure.
  //
  // It is the one fragment on the card that is genuinely an OPAQUE UI OBJECT rather than a
  // translucent strip over a photograph: near-black fill and an amber border in Dark, a white
  // fill and an amber border in Paper, its own edge in both. That is the reference class, and
  // it is why it now owns a whole beat instead of sharing one at 80% of the measure with the
  // role chip. Its own type lands at about 51px.
  //
  // ITS COLOUR IS AMBER AND THAT IS THE APP, NOT A CHOICE. tokens.ts sets OVERLAP_DARK.many to
  // #FFB627 and SwipeCard buckets any count of three or more as `many`, so Kofi's three shared
  // titles and Sana's four both land on amber. A two-title overlap would have rendered the
  // chartreuse #B7DD3F. Nothing here recolours app footage.
  {
    shots: [{ pieces: [{ frag: "games", width: MEASURE, radius: 18 }] }],
    enter: "curve",
    exit: "curve",
  },
  // "and how they play". The playstyle chip alone, at the full measure.
  //
  // "Ranked Grinder" is the app's own playstyle tag, PLAYSTYLE.ranked_grinder, so this is the
  // product answering the line rather than a picture chosen to sit under it. The beat that used
  // to be here isolated Kofi's prompt sentence, whose most legible words are "solo queue" in a
  // film that opens "queue up with a duo", and which is an achievement rather than a playstyle
  // so it did not answer the line either.
  //
  // THE HONEST WEAKNESS, stated where it will be read. This chip is translucent over the
  // photograph in both themes. In Dark the scrim is dark enough that the text reads cleanly. In
  // Paper the scrim is pale and the text is pale, and over the bright wall in Kofi's photo it
  // is close to unreadable. That is a property of the app's light theme on this card, it is
  // visible in the source frames before any of this code runs, and it is one of the things the
  // two deliverables exist to show.
  {
    shots: [{ pieces: [{ frag: "role", width: MEASURE, radius: 18 }] }],
    enter: "curve",
    // The film's one reserved gesture starts here.
    exit: "recede",
  },
  // "duo locked". The tallest object in the film at 644px, and the only portrait one, which is
  // what makes the payoff feel like a different kind of frame without changing a single rule.
  {
    shots: [{ pieces: [{ frag: "locked", width: part(0.62), radius: 26 }] }],
    enter: "arrive",
    exit: "curve",
  },
  // "send a message". The button for 26 frames, then the bubble for 26. Both cuts inside this
  // beat are the film's default seam, so the mid-beat cut is the same event as a beat boundary
  // and does not read as a third kind of thing.
  //
  // 26 and 26 is the read's 52 frames split evenly and it is also the tightest the dark
  // footage goes: `frag-dark-send` is 0.98s of fully lit button and `frag-dark-bubble` is 2.3s
  // of a bubble already marked SENT, so 0.87s each is inside both with room.
  {
    shots: [
      { pieces: [{ frag: "send", width: MEASURE, radius: 22 }], frames: 26 },
      { pieces: [{ frag: "bubble", width: part(0.56), radius: 22 }] },
    ],
    enter: "curve",
    exit: "curve",
  },
  // "then go play". Daylight, at the measure, and the only landscape card in the film. See the
  // header for why this beat is not empty and what the crop is protecting.
  {
    shots: [{ pieces: [{ frag: "play", width: MEASURE, radius: 22 }] }],
    enter: "curve",
    exit: "curve",
  },
];
