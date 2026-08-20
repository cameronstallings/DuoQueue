/**
 * DIRECTION B, "kinetic type". Its own palette, deliberately.
 *
 * The four shipping formats take every colour from `@app/theme/tokens`, because a post that
 * is not the app's colours is a post that does not look like the app. This direction is the
 * experiment where that constraint was lifted on purpose: off-black and chartreuse read as a
 * brand system, and a brand system is exactly what short-form feeds bury. So the palette here
 * is picked for one job, which is surviving a thumb moving at speed, and the app's identity
 * is spent where it earns its keep instead: the end card.
 *
 * Vermillion over bone on near-black. Three colours, no tints, no gradients between them.
 * Two of the three appear in any given frame, never all three at full strength, which is what
 * stops "high contrast" turning into "loud mess".
 */
export const K = {
  /** The field. Warmer and darker than the app's off-black, so vermillion sits on it without
   * the muddy edge a green-black gives an orange. */
  ink: "#08070A",
  /** Type. Bone, not #FFF: pure white on near-black blooms under H.264 at this size, and the
   * bloom is what makes big type look cheap. */
  bone: "#F6F2E9",
  /** The accent. Hot enough to read as a signal at 1/12th of the screen on a feed preview. */
  hot: "#FF3B14",
  /** Type on the accent, when the frame floods. */
  onHot: "#12060A",
  /** The second signal, used twice in the whole cut so that the vermillion never stops
   * meaning anything. */
  cool: "#2E5BFF",
} as const;

/** The safe box this direction works inside, wider than the shipping `SAFE` because the type
 * is the subject rather than a caption under footage. Bottom is the deepest: TikTok stacks a
 * caption, a handle and a sound title over roughly the last 350px of a 1920 frame. */
export const KSAFE = { top: 210, bottom: 380, side: 72 } as const;

/** Tracking for display type. Negative, because at 200px+ the default spacing of a grotesque
 * reads as gappy, and tight tracking is most of what separates "kinetic caption" from
 * "PowerPoint". */
export const TRACKING = "-0.035em";

/** Leading for a stacked line block, as a multiple of font size. Under 1 on purpose: the
 * lines of an all-caps stack have no descenders to clear, and touching lines are the whole
 * look. */
export const LEADING = 0.9;
