/**
 * DIRECTIONAL BLUR, which is the difference between a fast move and an abrupt one.
 *
 * CSS `filter: blur()` is isotropic: it smears a moving object as much across its travel as
 * along it, so a card crossing the frame comes out looking out of focus rather than looking
 * fast. Every smear the reference reels show is directional. Uber's arrival at f103 is a
 * horizontal streak with the vertical detail intact; the type exit at f209-f213 smears purely
 * along x while the letterforms keep their height; ClickUp's rising window at f316 smears along
 * its own diagonal of travel.
 *
 * feGaussianBlur takes a two-axis stdDeviation, so an SVG filter is the only way to say
 * "24 across, 5 down" in a browser. The filter element is generated per frame with the frame's
 * own numbers and referenced by id, which is cheap: it is four attributes of markup.
 *
 * TWO THINGS THAT WILL BREAK IT IF THEY ARE FORGOTTEN.
 *
 *   THE FILTER REGION. The default is a 10% margin around the object's bounding box, which
 *   clips a 24px smear into a hard edge. `x/y/width/height` widen it to 200%.
 *
 *   THE COLOUR SPACE. SVG filters default to linearRGB, which lightens a blur of a dark object
 *   on a dark ground into a grey halo. `sRGB` makes the smear the same colour the object is.
 *
 * The filter is applied on the SAME element as the 3D transform rather than on a wrapper,
 * because `perspective` only reaches an element's DIRECT children: a wrapper between the stage
 * and the plane would silently flatten every rotation in the film.
 */

/** Below this the filter is not worth the compositing pass, and a stdDeviation of 0 on some
 * builds still forces the element onto its own layer. */
const FLOOR = 0.15;

export const smearId = (name: string): string => `pro-smear-${name}`;

/**
 * The filter element for one smear. Render it as a SIBLING of the element that references it,
 * never as a child, which would be a recursive filter.
 */
export const SmearDef = ({ name, x, y }: { name: string; x: number; y: number }) => {
  if (x < FLOOR && y < FLOOR) {
    return null;
  }
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter
          id={smearId(name)}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={`${Math.max(0, x).toFixed(2)} ${Math.max(0, y).toFixed(2)}`} />
        </filter>
      </defs>
    </svg>
  );
};

/** The value for the referencing element's `filter`, or undefined when there is nothing to
 * smear. Returning undefined rather than "none" matters: `filter: none` still counts as a
 * filter for containing-block purposes on some builds. */
export const smearFilter = (name: string, x: number, y: number): string | undefined =>
  x < FLOOR && y < FLOOR ? undefined : `url(#${smearId(name)})`;
