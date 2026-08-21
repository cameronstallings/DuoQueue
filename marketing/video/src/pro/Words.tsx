/**
 * THE STATEMENT: laid out centred as a finished string, revealed in place word by word, and left
 * on an acceleration.
 *
 * The two curves are in ./motion.ts with the frames they were measured on. What lives here is the
 * layout, and the layout is the half of the note that says "the text is in weird spots".
 *
 *   ONE HORIZONTAL CENTRE. 540, every line, no exceptions. The reference's three body lines
 *   measure their centres at 371, 365 and 360 against a frame centre of 360.
 *   ONE VERTICAL ANCHOR. The block's optical centre sits at exactly 50% of the height, which is
 *   where the reference's two body lines sit within 5px. The rejected direction put type at
 *   42-52% and objects at 59%, so the film had two vertical anchors and an empty bottom third.
 *   NO REFLOW. The line is laid out as a finished string and the words are revealed in their
 *   final slots. Measured: "You" occupies x 111-198 at f189 and 114-198 at f200.
 *
 * THE ACCENT IS ON THE PAYLOAD WORD, WHEREVER IT FALLS. The reference puts the brand colour on
 * "options" at the end of one line and on "your" in the middle of the next, so the accent is
 * named in the script rather than derived from a position.
 *
 * IT IS SET IN INK.accent AND NOT IN INK.brand, and that is the light ground's one real cost.
 * Raw #CDFF3D is about 1.4:1 on this paper, so a chartreuse word here would be a smudge rather
 * than an accent. INK.accent is the app's own `lightColors.volt`, an olive, which is what the
 * brand itself resolves chartreuse to when it is printed rather than lit. The raw chartreuse is
 * not lost from the film: it burns inside every app fragment on screen, where it has its 13:1.
 *
 * WHY EACH WORD CARRIES ITS OWN `perspective()` RATHER THAN SHARING THE STAGE'S. A word coming
 * forward under a shared camera also drifts toward that camera's vanishing point, so a line
 * building at scale 0.35 would visibly converge on the frame's centre and then spread: the reflow
 * the measurement rules out. A per-element perspective puts the vanishing point at the word's own
 * centre, so the word grows out of the page exactly where it will finish.
 */
import { AbsoluteFill } from "remotion";

import { INK, TYPE, TYPE_Y } from "./ground";
import { BUILD, buildWord, exitWord } from "./motion";
import { SmearDef, smearFilter } from "./Smear";
import { DISPLAY, wordsOf } from "./type";

/** Word gap as a fraction of the size. Measured 21/18/14px on a ~54px line, so about 0.3em,
 * tightening as the size grows. */
const GAP = 0.28;

export const Words = ({
  lines,
  keyWord,
  size,
  frame,
  /** Frame the exit begins on. Past the end of the group's window means it never leaves. */
  exitAt = Number.POSITIVE_INFINITY,
  lead = 0,
  /** The gap between one word starting and the next. `statementPlan` derives it from the room the
   * beat actually has; the measured default is 4.5 and it never goes below 3. */
  cadence,
  /** Names this group's smear filters. Unique per group within a frame. */
  name,
  /** Where the block's optical centre sits. 50% of the height unless a direction has a reason. */
  cy = TYPE_Y,
  colour = INK.type,
}: {
  lines: readonly string[];
  keyWord: string | undefined;
  size: number;
  frame: number;
  exitAt?: number;
  lead?: number;
  cadence?: number;
  name: string;
  cy?: number;
  colour?: string;
}) => {
  const rows = wordsOf(lines, keyWord);
  const leading = Math.round(size * TYPE.leading);
  const height = leading * rows.length;

  return (
    <AbsoluteFill
      style={{
        // The block is positioned by its own centre so that a one line group and a three line
        // group share a vertical anchor rather than a top edge.
        top: Math.round(cy - height / 2),
        height,
        left: 0,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {rows.map((words, row) => (
        <div
          key={words.map((word) => word.text).join(" ") + String(row)}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            gap: Math.round(size * GAP),
            height: leading,
            width: "100%",
          }}
        >
          {words.map((word) => {
            const build = buildWord(frame, word.index, lead, cadence);
            const out = exitWord(frame - exitAt, word.index);
            const filterName = `${name}-${String(word.index)}`;
            return (
              <span key={`${word.text}-${String(word.index)}`} style={{ display: "inline-block" }}>
                <SmearDef name={filterName} x={out.smear} y={0} />
                <span
                  style={{
                    display: "inline-block",
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontSize: `${String(size)}px`,
                    lineHeight: `${String(leading)}px`,
                    letterSpacing: TYPE.tracking,
                    color: word.key ? INK.accent : colour,
                    whiteSpace: "pre",
                    opacity: build.opacity * out.opacity,
                    // The word's own camera. See the header for why it is not the stage's.
                    transform: [
                      `perspective(${String(BUILD.perspective)}px)`,
                      `translate3d(${out.x.toFixed(2)}px, ${build.y.toFixed(2)}px, ${build.z.toFixed(1)}px)`,
                      `rotateX(${build.rotX.toFixed(2)}deg)`,
                      `scale(${build.scale.toFixed(4)})`,
                    ].join(" "),
                    filter: [
                      build.blur > 0.2 ? `blur(${build.blur.toFixed(1)}px)` : "",
                      smearFilter(filterName, out.smear, 0) ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined,
                  }}
                >
                  {word.text}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/**
 * The small register: the app's own mono, uppercase, tracked wide, at about a fifth of the
 * statement's size. It exists so that a direction can label a fragment with the app's own noun
 * without the label competing with the statement, and it is used sparingly.
 */
export const Tag = ({
  text,
  cy,
  frame,
  size = 26,
  colour = INK.accent,
}: {
  text: string;
  cy: number;
  frame: number;
  size?: number;
  colour?: string;
}) => {
  const t = Math.min(1, Math.max(0, frame / 6));
  return (
    <AbsoluteFill
      style={{
        top: Math.round(cy - size),
        height: size * 2,
        alignItems: "center",
        justifyContent: "center",
        opacity: t,
      }}
    >
      <div
        style={{
          fontFamily: "IBMPlexMono_600SemiBold",
          fontSize: `${String(size)}px`,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: colour,
          transform: `translateY(${((1 - t) * 10).toFixed(1)}px)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
