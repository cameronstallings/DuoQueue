import { describe, expect, it } from "vitest";
import { displayNameSchema } from "@duoqueue/shared-types";

import { composeAppleDisplayName } from "./appleDisplayName";

/**
 * The value under test has exactly one chance to exist — Apple returns `fullName` on the first
 * authorization for an Apple ID and never again — and exactly one destination,
 * `complete_signup`'s `p_display_name`, from where it is prefilled as a handle every other player
 * sees. So there are three ways to be wrong here: send something the schema will bounce, which
 * fails an age gate over a name; answer null when a perfectly good first name was available,
 * which loses it permanently; or put somebody's full legal name forward as a public handle.
 */
describe("composeAppleDisplayName", () => {
  it("uses the given name alone", () => {
    expect(composeAppleDisplayName({ givenName: "Ada", familyName: "Lovelace" })).toBe("Ada");
  });

  it("never puts the family name forward, in any combination", () => {
    // The prefill becomes a public handle. First and last name together is the default this
    // function used to pick, and it is exactly what a stranger should not be handed.
    const samples = [
      { givenName: "Ada", familyName: "Lovelace" },
      { givenName: "Ada", middleName: "Augusta", familyName: "Lovelace" },
      { givenName: "A", familyName: "Lovelace" },
      { givenName: null, familyName: "Lovelace" },
      { familyName: "Lovelace", nickname: "Countess" },
      { namePrefix: "Dr.", givenName: "Ada", familyName: "Lovelace", nameSuffix: "Jr." },
    ];
    for (const sample of samples) {
      expect(composeAppleDisplayName(sample) ?? "").not.toContain("Lovelace");
    }
  });

  it("returns null when only the family name was shared", () => {
    expect(composeAppleDisplayName({ givenName: null, familyName: "Lovelace" })).toBeNull();
    expect(composeAppleDisplayName({ familyName: "Lovelace" })).toBeNull();
  });

  it("returns null when Apple sent no name at all", () => {
    // The single most common case in production: every sign-in after the first one.
    expect(composeAppleDisplayName(null)).toBeNull();
    expect(composeAppleDisplayName(undefined)).toBeNull();
    expect(composeAppleDisplayName({})).toBeNull();
  });

  it("returns null when every component is null or blank", () => {
    // What a user who cleared the fields on Apple's consent sheet looks like.
    expect(
      composeAppleDisplayName({
        namePrefix: null,
        givenName: null,
        middleName: null,
        familyName: null,
        nameSuffix: null,
        nickname: null,
      }),
    ).toBeNull();
    expect(composeAppleDisplayName({ givenName: "   ", familyName: "\n" })).toBeNull();
  });

  it("normalizes the whitespace it was handed", () => {
    expect(composeAppleDisplayName({ givenName: "  Ada  ", familyName: "  Lovelace " })).toBe("Ada");
    expect(composeAppleDisplayName({ givenName: "Ada\nMarie", familyName: "Lovelace" })).toBe("Ada Marie");
  });

  it("drops the prefix, the suffix and the middle name", () => {
    expect(
      composeAppleDisplayName({
        namePrefix: "Dr.",
        givenName: "Ada",
        middleName: "Augusta",
        familyName: "Lovelace",
        nameSuffix: "Jr.",
      }),
    ).toBe("Ada");
  });

  it("keeps a given name that is long, as long as it fits the schema on its own", () => {
    const composed = composeAppleDisplayName({
      givenName: "Bartholomew",
      familyName: "Featherstonehaugh-Winchester",
    });
    expect(composed).toBe("Bartholomew");
    expect(displayNameSchema.safeParse(composed).success).toBe(true);
  });

  it("falls back to the nickname when the given name does not survive", () => {
    expect(composeAppleDisplayName({ givenName: "A", nickname: "Countess" })).toBe("Countess");
    expect(composeAppleDisplayName({ givenName: null, familyName: "Lovelace", nickname: "Countess" })).toBe(
      "Countess",
    );
  });

  it("returns null rather than a name the schema would reject", () => {
    // The requirement that matters most: an invalid candidate must become "no name", never a
    // value sent to complete_signup for the server to bounce. A rejected p_display_name would
    // fail the whole age gate, so a long name would mean no account at all.
    const tooLong = "Wolfeschlegelsteinhausenbergerdorff";
    expect(tooLong.length).toBeGreaterThan(30);
    expect(composeAppleDisplayName({ givenName: tooLong, familyName: "Smith" })).toBeNull();
    // Under the floor of 2, with no second candidate to fall back to.
    expect(composeAppleDisplayName({ givenName: "A" })).toBeNull();
  });

  it("only ever answers with something displayNameSchema accepts", () => {
    const samples = [
      { givenName: "Ada", familyName: "Lovelace" },
      { givenName: "  Jo  " },
      { nickname: "Countess" },
      { givenName: "Bartholomew", familyName: "Featherstonehaugh-Winchester" },
      { givenName: "李", familyName: "明" },
      { givenName: "明美" },
    ];

    for (const sample of samples) {
      const composed = composeAppleDisplayName(sample);
      if (composed === null) continue;
      expect(displayNameSchema.safeParse(composed).success).toBe(true);
    }
  });
});
