import { PROMPT_COUNT } from "@duoqueue/shared-types";

/**
 * What a finished card has, in one place: the Edit screen's meter lists every item, and your
 * card's nudge row names the first missing one. "A picture" is one item (build 12 has no cover
 * and no gallery). Pure, relative imports only (completeness.test.ts).
 */

export type CompletenessKey = "picture" | "game" | "show" | "platform" | "playstyle" | "prompts";
export type CompletenessRoute = "/edit-details" | "/edit-prompts";

export interface CompletenessItem {
  key: CompletenessKey;
  label: string;
  done: boolean;
  route: CompletenessRoute;
}

export interface CompletenessFacts {
  /** ownPictureState(...).hasPicture: a picture that is approved or in review. */
  hasPicture: boolean;
  games: number;
  shows: number;
  platforms: number;
  playstyles: number;
  prompts: number;
}

export function completenessItems(f: CompletenessFacts): CompletenessItem[] {
  return [
    { key: "picture", label: "a picture", done: f.hasPicture, route: "/edit-details" },
    { key: "game", label: "a game", done: f.games > 0, route: "/edit-details" },
    { key: "show", label: "a show", done: f.shows > 0, route: "/edit-details" },
    { key: "platform", label: "a platform", done: f.platforms > 0, route: "/edit-details" },
    { key: "playstyle", label: "a playstyle", done: f.playstyles > 0, route: "/edit-details" },
    { key: "prompts", label: "your prompts", done: f.prompts >= PROMPT_COUNT, route: "/edit-prompts" },
  ];
}

/** The nudge under your card asks for what most changes the card first. The picture is left
 * out: the card's own ADD A PICTURE tag already asks for it. */
const NUDGE_ORDER: CompletenessKey[] = ["game", "prompts", "show", "platform", "playstyle"];

export function cardNudge(items: CompletenessItem[]): CompletenessItem | null {
  for (const key of NUDGE_ORDER) {
    const item = items.find((i) => i.key === key);
    if (item && !item.done) return item;
  }
  return null;
}

export function nudgeText(item: CompletenessItem): string {
  return `Finish your card: add ${item.label}`;
}
