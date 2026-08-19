/**
 * The shape of one post. Everything else in this project is a function of it: `Post` switches
 * on `format`, `calculateMetadata` reads `seconds`, the batch selector reads `format` and `id`,
 * and the caption templates read `caption`.
 *
 * The union is the whole authoring ergonomic. Typing `format: "pain"` makes the editor demand
 * `lines` and `clip` and refuse `items`, so adding a video is filling in a shape the compiler
 * describes rather than remembering four field lists.
 */

export type Format = "reframe" | "pain" | "demo" | "spec";

/** Every name in src/data/clips.ts, derived rather than restated so a clip renamed there
 * becomes a type error at every hook that referenced it. */
export type ClipName = keyof typeof import("./data/clips").clips;

interface HookBase {
  /** kebab, `<format>-<3 digits>`, permanent: the ledger keys off it. */
  id: string;
  /** Seconds. calculateMetadata turns this into durationInFrames. */
  seconds: number;
  /** One line. The per-platform captions are expanded from it. */
  caption: string;
  /** Rare per-platform override. */
  captionOverrides?: Partial<Record<"instagram" | "tiktok" | "youtube", string>>;
}

export interface ReframeHook extends HookBase { format: "reframe"; clip: ClipName; beatOne: string; beatTwo: string }
export interface PainHook    extends HookBase { format: "pain";    clip: ClipName; lines: string[] }
export interface DemoHook    extends HookBase { format: "demo";    steps: { clip: ClipName; label: string }[] }
export interface SpecHook    extends HookBase { format: "spec";    title: string; items: string[] }
export type Hook = ReframeHook | PainHook | DemoHook | SpecHook;
