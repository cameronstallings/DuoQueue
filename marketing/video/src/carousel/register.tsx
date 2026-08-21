/**
 * The carousel registers itself, so Root.tsx carries one import and one element and dropping
 * the format is deleting a directory.
 *
 * ONE COMPOSITION, DRIVEN BY A PROP, rather than six registered cards. `renderStill` resolves
 * `inputProps` the same way `renderMedia` does, so scripts/render-carousel.ts selects this
 * composition six times with a different index and gets six files. Registering six would put
 * six near identical entries in the Studio sidebar and would mean adding a card is an edit in
 * two files instead of one.
 *
 * `durationInFrames` is 1 because there is no second frame. The fps is the project's 30 and
 * is never used for anything except satisfying Remotion, which requires a rate even for a
 * composition nobody will ever play.
 *
 * `render-day` selects the composition called `Post` by id and nothing else, so registering
 * here cannot change what `pnpm video:day` renders.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS } from "@/lib/scale";

import { Card } from "./Card";
import { CARD_H, CARD_W } from "./ground";
import { CARD_COUNT } from "./plan";

export const CarouselCompositions = () => (
  <Composition
    id="Carousel"
    component={Card}
    width={CARD_W}
    height={CARD_H}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ index: 0, cta: CTA.waitlist }}
  />
);

export { CARD_COUNT };
