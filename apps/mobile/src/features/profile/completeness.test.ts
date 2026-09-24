import { describe, expect, it } from "vitest";

import { cardNudge, completenessItems, nudgeText, type CompletenessFacts } from "./completeness";

const FULL: CompletenessFacts = { hasPicture: true, games: 2, shows: 1, platforms: 1, playstyles: 3, prompts: 3 };

describe("completenessItems", () => {
  it("has one picture item and no cover item", () => {
    const labels = completenessItems(FULL).map((i) => i.label);
    expect(labels).toEqual(["a picture", "a game", "a show", "a platform", "a playstyle", "your prompts"]);
    expect(labels).not.toContain("a cover photo");
    expect(labels).not.toContain("a profile picture");
  });

  it("is all done for a full card", () => {
    expect(completenessItems(FULL).every((i) => i.done)).toBe(true);
  });

  it("marks the picture missing when there is none", () => {
    expect(completenessItems({ ...FULL, hasPicture: false }).find((i) => i.key === "picture")?.done).toBe(false);
  });

  it("needs all three prompts", () => {
    expect(completenessItems({ ...FULL, prompts: 2 }).find((i) => i.key === "prompts")?.done).toBe(false);
  });

  it("sends prompts to the prompt editor and everything else to Edit", () => {
    const routes = Object.fromEntries(completenessItems(FULL).map((i) => [i.key, i.route]));
    expect(routes).toEqual({
      picture: "/edit-details",
      game: "/edit-details",
      show: "/edit-details",
      platform: "/edit-details",
      playstyle: "/edit-details",
      prompts: "/edit-prompts",
    });
  });
});

describe("cardNudge", () => {
  it("is null for a full card", () => {
    expect(cardNudge(completenessItems(FULL))).toBeNull();
  });

  it("never nudges for the picture, because the card's own tag already says it", () => {
    expect(cardNudge(completenessItems({ ...FULL, hasPicture: false }))).toBeNull();
  });

  it("asks for a game first, then prompts, then a show", () => {
    expect(cardNudge(completenessItems({ ...FULL, games: 0, prompts: 0, shows: 0 }))?.key).toBe("game");
    expect(cardNudge(completenessItems({ ...FULL, prompts: 1, shows: 0 }))?.key).toBe("prompts");
    expect(cardNudge(completenessItems({ ...FULL, shows: 0 }))?.key).toBe("show");
  });

  it("words the nudge without an em dash", () => {
    const item = cardNudge(completenessItems({ ...FULL, shows: 0 }));
    expect(item && nudgeText(item)).toBe("Finish your card: add a show");
    expect(item && nudgeText(item)).not.toContain("\u2014");
  });
});
