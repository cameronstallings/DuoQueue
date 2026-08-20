/**
 * The one composition. "One composition plus an array of hook objects renders the whole
 * queue" is the shape of this whole project, and this file is where the array meets the
 * renderer: the daily batch picks three hooks and renders this same composition three times
 * with different inputProps.
 *
 * There is nothing here but the switch, deliberately. Each format wraps itself in PostShell,
 * which owns the body clock and the end card, so adding a Sequence or a card here would put
 * two of each in every video.
 */
import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";
import { Demo } from "@/formats/Demo";
import { Pain } from "@/formats/Pain";
import { Reframe } from "@/formats/Reframe";
import { Spec } from "@/formats/Spec";
import type { Hook } from "@/types";

/** A type alias and not an interface: Remotion constrains a composition's props to
 * `Record<string, unknown>`, and an interface has no implicit index signature to satisfy it
 * with. */
export type PostProps = { hook: Hook; cta: Cta };

/** The picture. Kept as its own function so the switch below stays nothing but the switch,
 * which is what the header promises. */
const body = ({ hook, cta }: PostProps) => {
  switch (hook.format) {
    case "reframe":
      return <Reframe hook={hook} cta={cta} />;
    case "pain":
      return <Pain hook={hook} cta={cta} />;
    case "demo":
      return <Demo hook={hook} cta={cta} />;
    case "spec":
      return <Spec hook={hook} cta={cta} />;
    default: {
      // A fifth format added to types.ts is a compile error right here, rather than a blank
      // video found in the morning's batch. `never` is what makes the switch exhaustive.
      const unhandled: never = hook;
      throw new Error(`No format component for ${JSON.stringify(unhandled)}.`);
    }
  }
};

/**
 * The soundtrack sits beside the picture rather than inside a format, because it is one track
 * over the whole composition and the formats own their own body clock. It is already a
 * finished mix when it gets here: voice anchored, bed carved and ducked under it, the sum
 * normalised. There is nothing to tune at this end on purpose. A post with no mix built yet
 * renders silent, exactly as it did before there was an audio path at all.
 */
export const Post = (props: PostProps) => (
  <>
    <Soundtrack id={props.hook.id} />
    {body(props)}
  </>
);
