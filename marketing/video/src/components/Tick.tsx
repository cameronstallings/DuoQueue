/** DOM port of the bracket tick idiom in apps/mobile/src/components/EmptyState.tsx. Keep
 * in sync. Values come from tokens; no literals. */
import { darkColors, type as typeScale } from "@app/theme/tokens";

import { textStyle } from "@/lib/text-style";

/**
 * The machine voice: a short mono status wrapped in brackets, `[ EMPTY ]`. In the app it
 * tags an empty screen; on video it is how a frame states a fact about itself without
 * sounding like advertising copy. Callers pass the inside only, so the brackets and the
 * spacing inside them cannot drift between one caller and the next.
 */
export const Tick = ({ children }: { children: string }) => (
  <div style={{ ...textStyle(typeScale.tick), color: darkColors.voltDim }}>{`[ ${children} ]`}</div>
);
