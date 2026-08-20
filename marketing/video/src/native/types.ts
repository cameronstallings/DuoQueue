import type { ClipName } from "@/types";

/** Where the footage sits inside the frame, after `object-fit: cover` has already done the
 * centre crop. `scale` is on top of that crop and `x`/`y` are composition pixels applied after
 * it, which is the order CSS applies `translate(...) scale(...)` in. */
export interface Framing {
  scale: number;
  x: number;
  y: number;
}

/** One cut. Shots run back to back with no gap and no dissolve: `frames` is both how long this
 * one is on screen and where the next one starts. */
export interface Shot {
  clip: ClipName;
  /** Seconds into the trimmed clip (so 0 is the clip's own `from`, not the file's start). */
  start: number;
  /** How long the cut holds. 33 to 48 is the range this direction lives in. */
  frames: number;
  /** Framing at the first frame of the cut and at the last. They are never equal: a still
   * frame inside a moving feed reads as a stalled video. */
  from: Framing;
  to: Framing;
  /** Source seconds consumed per composition second. Above 1 on app footage, because a real
   * thumb moves faster than a screen recording of a demo does. */
  rate?: number;
  /** A scale kick on the cut itself, on top of the drift. Reserved for the beat that matters. */
  punch?: number;
  /** Cuts into this shot on two frames of white. One video gets one of these, at the turn from
   * the problem to the product; a second would be a transition pack rather than an edit. */
  flash?: boolean;
}

/** One caption. Lines are authored rather than wrapped, because where a phrase breaks is a
 * reading decision and a container width is not. */
export interface Cue {
  lines: string[];
  /** How long it holds. Cues run back to back like shots. */
  frames: number;
  /** The word that carries the beat, matched case-insensitively against the lines. */
  accent?: string;
  /** How that word is marked. `box` is the highlighter: reserved for the line that reverses
   * the viewer's assumption, because it is the loudest thing this direction can do. */
  accentStyle?: "color" | "box";
  /** Skips the cascade and puts the whole line up already settled. The opening cue uses it so
   * that frame 0 carries the hook instead of the first frame of a fade. */
  instant?: boolean;
  /** Ceiling for the fitted type, in composition pixels. Left off, a cue takes the loudest
   * size that fits. Set it on the cues that play over app footage: at full size a caption
   * covers the card it is talking about. */
  max?: number;
}

/** One video. Shots and cues are two independent tracks over the same clock: a cue may hold
 * across a cut, and a cut may land inside a cue. */
export interface NativeScript {
  id: string;
  shots: Shot[];
  cues: Cue[];
  /** The post caption, doing the same job as `Hook.caption` in src/data/hooks.ts. */
  caption: string;
}
