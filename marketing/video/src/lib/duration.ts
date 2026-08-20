/**
 * THE ONLY DURATION RULE IN THE PIPELINE.
 *
 * It used to live in Root.tsx, with the number it depends on in EndCard.tsx, which was fine
 * while a composition was the only thing that needed to know how long a post is. The audio
 * path needs the same answer: a bed has to be laid under the end card as well as under the
 * body, and a script cannot import EndCard.tsx to ask, because that file's import of
 * `@/lib/fonts` opens a `delayRender` handle at module scope and there is no render to hold
 * back. Copying 75 into the script would mean the bed and the card could drift apart without
 * anything failing.
 *
 * So both numbers live here, in a module with no React in it and nothing but the frame rate
 * behind it. PostShell derives the body by subtracting the card from whatever `postDuration`
 * returns, so a composition registered with any other number silently moves every beat in the
 * video: where a demo cuts, where the reframe swaps, how much footage plays at all.
 */
import type { Hook } from "@/types";

import { FPS } from "./scale";

/** 2.5 seconds at 30fps. Long enough to read a line and a URL, short enough that it is not
 * the reason someone scrolls. */
export const END_CARD_FRAMES = 75;

/** A hook's `seconds` is its BODY. The card is added on top, so `seconds: 8` is eight seconds
 * of video plus the ending, and never eight seconds with the ending eating into it. */
export const postDuration = (hook: Hook): number =>
  Math.round(hook.seconds * FPS) + END_CARD_FRAMES;
