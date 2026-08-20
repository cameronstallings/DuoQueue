/**
 * DIRECTION B, assembled. A list of beats, each in its own Sequence, then the end card.
 *
 * This sits beside `Post` rather than replacing it. Nothing in the shipping pipeline imports
 * anything under src/kinetic/: `render-day` still selects the composition called `Post`, the
 * four formats still render, and `pnpm video:day` is untouched. The only shared code is the
 * clip table, the frame scale, the font loader and the brand mark, all of which this direction
 * uses exactly as they are.
 *
 * Each beat is a Sequence for two reasons beyond tidiness. The clock restarts at zero inside
 * one, so a beat times its word stagger and its camera push against its own length and never
 * has to know where it sits in the cut. And the footage unmounts on the cut, so OffthreadVideo
 * decodes one source frame per frame that is actually seen: nine beats over five clips costs
 * about what one clip used to.
 */
import { AbsoluteFill, Sequence } from "remotion";

import type { Cta } from "@/config/phase";

import { bodyFrames, type KineticPostData } from "./beats";
import { KineticBeat } from "./KineticBeat";
import { KINETIC_END_FRAMES, KineticEnd } from "./KineticEnd";
import { K } from "./palette";

export const kineticDuration = (post: KineticPostData): number =>
  bodyFrames(post) + KINETIC_END_FRAMES;

export const KineticPost = ({ post, cta }: { post: KineticPostData; cta: Cta }) => {
  let at = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: K.ink }}>
      {post.beats.map((beat, index) => {
        const from = at;
        at += beat.frames;
        return (
          <Sequence
            key={`${post.id}-${String(index)}`}
            from={from}
            durationInFrames={beat.frames}
            name={`beat ${String(index + 1)}: ${beat.lines.join(" ")}`}
          >
            <KineticBeat beat={beat} index={index} />
          </Sequence>
        );
      })}
      <Sequence from={at} durationInFrames={KINETIC_END_FRAMES} name="end card">
        <KineticEnd cta={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
