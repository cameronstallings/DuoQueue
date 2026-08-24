/**
 * The three directions register themselves, so Root.tsx carries one import and one element for
 * all three and dropping the set is deleting a directory.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering here
 * cannot change what `pnpm video:day` renders.
 *
 * ONE ARGUMENT PER PAIR. Every composition here takes the same script, resolves the same beat
 * table out of the same measured WAV, plays the same mix and ends on the same card. Between the
 * three directions the only variable is the direction; between a direction and its `-Light` half
 * the only variable is which theme of the app was recorded. That is what makes any two of the
 * rendered files comparable: a difference between them is a difference of exactly one thing.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS, VIDEO_H, VIDEO_W } from "@/lib/scale";

import { ProA, ProALight } from "./a/DirectionA";
import { ANGLES, compositionFor } from "./angles";
import { ProB, ProBLight } from "./b/DirectionB";
import { ProC } from "./c/DirectionC";
import { PRO } from "./script";
import { proDuration } from "./timing";

const FRAME = { width: VIDEO_W, height: VIDEO_H, fps: FPS } as const;

/**
 * FIVE COMPOSITIONS, THREE DIRECTIONS, TWO THEMES.
 *
 * The two `-Light` entries are the same components under ./theme.tsx's context. They are listed
 * beside their dark halves rather than in a table of their own, because they take the same props
 * from the same script and resolve the same duration from the same measured WAV, and the moment
 * that stops being true the comparison they exist for has already been lost.
 *
 * Direction C has no light half on purpose. It is the rejected one; it stays registered and
 * untouched, and building on it is the one thing Cameron asked for by name not to happen.
 */
const DIRECTIONS = [
  { id: "Pro-A", component: ProA },
  { id: "Pro-A-Light", component: ProALight },
  { id: "Pro-B", component: ProB },
  { id: "Pro-B-Light", component: ProBLight },
  { id: "Pro-C", component: ProC },
] as const;

/**
 * THE FOUR NEW ANGLES, ALL IN THE ONE APPROVED DIRECTION.
 *
 * The direction competition is over. `pro-a-light` won it, so a second angle does not get a second
 * direction, it gets the winner and different words. Every entry below is `ProALight`, which is
 * why there is no `-Dark` half and no B: those exist to be COMPARED, and there is nothing left to
 * compare. Adding one here would only produce a file nobody has a reason to look at.
 *
 * Registered so the four are scrubbable in Studio beside the direction they came from. Nothing
 * renders from this list: `scripts/render-angles.ts` selects each id by name and writes it into
 * out/_reels/, exactly as render-static.ts does for the sheets, and neither script reads or writes
 * state/ledger.json.
 */
export const ProCompositions = () => (
  <>
    {DIRECTIONS.map(({ id, component }) => (
      <Composition
        key={id}
        id={id}
        component={component}
        {...FRAME}
        durationInFrames={proDuration(PRO)}
        defaultProps={{ script: PRO, cta: CTA.waitlist }}
        calculateMetadata={({ props }) => ({ durationInFrames: proDuration(props.script) })}
      />
    ))}
    {ANGLES.map((script) => (
      <Composition
        key={script.id}
        id={compositionFor(script.id)}
        component={ProALight}
        {...FRAME}
        durationInFrames={proDuration(script)}
        defaultProps={{ script, cta: CTA.waitlist }}
        calculateMetadata={({ props }) => ({ durationInFrames: proDuration(props.script) })}
      />
    ))}
  </>
);
