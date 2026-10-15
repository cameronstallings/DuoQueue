import { describe, expect, it } from "vitest";

import { buildPushBatches } from "./expo-push";

const TOKEN = "ExponentPushToken[abc]";

describe("buildPushBatches", () => {
  it("is silent unless asked, so the scheduled pushes stay quiet", () => {
    const [batch] = buildPushBatches([TOKEN], "t", "b", { category: "new_player" });
    expect(batch[0]).toEqual({ to: TOKEN, title: "t", body: "b", data: { category: "new_player" } });
    expect("sound" in batch[0]).toBe(false);
  });

  it("asks for the default sound when a person is reaching you", () => {
    const [batch] = buildPushBatches([TOKEN], "New match!", "You matched with Sam.", { category: "new_match" }, {
      sound: true,
    });
    expect(batch[0].sound).toBe("default");
    expect(batch[0].data).toEqual({ category: "new_match" });
  });

  it("drops tokens that are not Expo tokens and batches by 100", () => {
    const tokens = [...Array.from({ length: 150 }, (_, i) => `ExpoPushToken[${i}]`), "not-a-token"];
    const batches = buildPushBatches(tokens, "t", "b", undefined, { sound: true });
    expect(batches.map((b) => b.length)).toEqual([100, 50]);
    expect(batches.flat().every((m) => m.sound === "default")).toBe(true);
  });

  it("sends nothing when no token is valid", () => {
    expect(buildPushBatches(["junk"], "t", "b")).toEqual([]);
  });
});
