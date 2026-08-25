/**
 * ONE COMPOSITION FOR ALL TEN SETS, DRIVEN BY TWO PROPS.
 *
 * `renderStill` resolves `inputProps` the same way `renderMedia` does, so
 * scripts/render-carousels.ts selects this composition forty-nine times with a different set
 * name and index and gets forty-nine files. Registering one entry per card would put forty-nine
 * near-identical rows in the Studio sidebar and would mean adding a card is an edit in two files.
 *
 * `durationInFrames` is 1 because there is no second frame. The fps is the project's 30 and is
 * never used for anything except satisfying Remotion, which requires a rate even for a
 * composition nobody will ever play.
 *
 * IT CANNOT DISTURB THE SHIPPED SET. `render-carousel.ts` selects the composition called
 * `Carousel` by id and this one is called `Carousels`; `render-day` selects `Post`. Registering
 * here changes what `pnpm carousel` and `pnpm video:day` render by nothing at all.
 */
import { Composition } from "remotion";

import { CTA } from "@/config/phase";
import { FPS } from "@/lib/scale";

import { CARD_H, CARD_W } from "./ground";
import { Plate } from "./Plate";
import { SETS } from "./sets";

export const CarouselsCompositions = () => (
  <Composition
    id="Carousels"
    component={Plate}
    width={CARD_W}
    height={CARD_H}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ set: SETS[0]?.name ?? "four", index: 0, cta: CTA.waitlist }}
  />
);
