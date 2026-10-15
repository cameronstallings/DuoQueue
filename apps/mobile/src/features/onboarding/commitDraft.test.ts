import { describe, expect, it } from "vitest";

import {
  ageOn,
  canShowDraftDob,
  cardPreviewLines,
  commitDestination,
  commitStartDecision,
  type DraftAnswers,
  DRAFT_TTL_DAYS,
  draftCleanupOnApp,
  firstIncompleteStep,
  firstName,
  isDraftComplete,
  sanitizeDraft,
} from "./commitDraft";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

function complete(overrides: Partial<DraftAnswers> = {}): DraftAnswers {
  return {
    ageConfirmedDob: "2000-05-01",
    draftStartedAt: NOW - DAY,
    lastStep: "save",
    readyToSave: true,
    commitPending: false,
    devicePrefilled: true,
    displayName: "Cameron",
    displayNameSeeded: false,
    profilePhotoUri: null,
    region: "na_east",
    languages: ["en"],
    platforms: ["pc"],
    games: [
      {
        gameId: "g1",
        name: "League of Legends",
        skillLevel: "casual",
        rankText: "Gold II",
        lolTier: "gold",
        lolDivision: 2,
      },
    ],
    shows: [],
    playstyles: [],
    prompts: [
      { promptId: "p1", question: "Q1", answer: "A1" },
      { promptId: "p2", question: "Q2", answer: "A2" },
      { promptId: "p3", question: "Q3", answer: "A3" },
    ],
    discordUsername: "",
    ...overrides,
  };
}

describe("firstIncompleteStep", () => {
  it("is null for a complete draft", () => {
    expect(firstIncompleteStep(complete())).toBeNull();
    expect(isDraftComplete(complete())).toBe(true);
  });

  it("names each missing answer, in step order", () => {
    expect(firstIncompleteStep(complete({ displayName: " a " }))).toBe("display-name");
    expect(firstIncompleteStep(complete({ region: null }))).toBe("region");
    expect(firstIncompleteStep(complete({ languages: [] }))).toBe("languages");
    expect(firstIncompleteStep(complete({ platforms: [] }))).toBe("platforms");
    expect(firstIncompleteStep(complete({ games: [] }))).toBe("games");
    expect(
      firstIncompleteStep(
        complete({ prompts: [{ promptId: "p1", question: "Q1", answer: "A1" }, null, null] }),
      ),
    ).toBe("prompts");
    expect(
      firstIncompleteStep(
        complete({
          prompts: [
            { promptId: "p1", question: "Q1", answer: "A1" },
            { promptId: "p2", question: "Q2", answer: "   " },
            { promptId: "p3", question: "Q3", answer: "A3" },
          ],
        }),
      ),
    ).toBe("prompts");
    expect(firstIncompleteStep(complete({ discordUsername: "a b!" }))).toBe("discord");
    expect(isDraftComplete(complete({ region: null }))).toBe(false);
  });

  it("reports the earliest gap when several are missing", () => {
    expect(firstIncompleteStep(complete({ region: null, games: [], displayName: "" }))).toBe("display-name");
    expect(firstIncompleteStep(complete({ platforms: [], discordUsername: "!" }))).toBe("platforms");
  });

  it("accepts an empty Discord and a valid one with spaces around it", () => {
    expect(firstIncompleteStep(complete({ discordUsername: "" }))).toBeNull();
    expect(firstIncompleteStep(complete({ discordUsername: "  name.x  " }))).toBeNull();
    expect(firstIncompleteStep(complete({ discordUsername: "   " }))).toBeNull();
  });

  it("does not require playstyles (optional)", () => {
    expect(firstIncompleteStep(complete({ playstyles: [] }))).toBeNull();
  });
});

describe("commitStartDecision", () => {
  it("returns a finished account untouched", () => {
    expect(commitStartDecision({ profileStatus: "loaded", onboardingCompleted: true })).toBe("returning");
  });

  it("submits the card onto a profile that exists but is unfinished", () => {
    expect(commitStartDecision({ profileStatus: "loaded", onboardingCompleted: false })).toBe("submit");
  });

  it("creates the profile for a new Apple account", () => {
    expect(commitStartDecision({ profileStatus: "missing", onboardingCompleted: undefined })).toBe("create-profile");
  });

  it("treats a read that never answered as a failure, never a guess", () => {
    expect(commitStartDecision({ profileStatus: "error", onboardingCompleted: undefined })).toBe("read-failed");
    expect(commitStartDecision({ profileStatus: "unknown", onboardingCompleted: undefined })).toBe("read-failed");
  });
});

describe("draftCleanupOnApp", () => {
  it("discards a draft, and toasts only when it was on its way to Save", () => {
    expect(draftCleanupOnApp({ hasDraft: true, commitPending: true })).toEqual({ discard: true, toast: true });
    expect(draftCleanupOnApp({ hasDraft: true, commitPending: false })).toEqual({ discard: true, toast: false });
    expect(draftCleanupOnApp({ hasDraft: false, commitPending: false })).toEqual({ discard: false, toast: false });
  });
});

describe("commitDestination", () => {
  it("goes to the invited screen when an invite arrived, else the welcome tour", () => {
    expect(commitDestination({ arrival: { inviterId: "a", inviterName: "Kai" } })).toBe("/invited");
    expect(commitDestination({ arrival: null })).toBe("/welcome");
  });
});

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("Cameron Stallings")).toBe("Cameron");
    expect(firstName("  Kai  ")).toBe("Kai");
    expect(firstName("xX_Slayer_Xx")).toBe("xX_Slayer_Xx");
    expect(firstName("")).toBe("");
  });
});

describe("ageOn", () => {
  it("counts whole years in UTC around a birthday", () => {
    expect(ageOn("2000-10-15", new Date(Date.UTC(2026, 9, 14)))).toBe(25);
    expect(ageOn("2000-10-15", new Date(Date.UTC(2026, 9, 15)))).toBe(26);
  });

  it("treats Feb 29 the way the gate does", () => {
    expect(ageOn("2008-02-29", new Date(Date.UTC(2026, 1, 28)))).toBe(17);
    expect(ageOn("2008-02-29", new Date(Date.UTC(2026, 2, 1)))).toBe(18);
  });

  it("is null for something that is not a date", () => {
    expect(ageOn("2008-02-30", new Date(NOW))).toBeNull();
    expect(ageOn("nope", new Date(NOW))).toBeNull();
    expect(ageOn(null, new Date(NOW))).toBeNull();
  });
});

describe("cardPreviewLines", () => {
  it("keeps the age (AGES STAY) and lists games with their rank", () => {
    const lines = cardPreviewLines(complete({ languages: ["en", "es"] }), new Date(NOW));
    expect(lines.name).toBe("Cameron");
    expect(lines.details).toBe("26 · NA East · en es");
    expect(lines.games).toEqual(["League of Legends · Gold II"]);
  });

  it("shows at most 3 games and leaves the rank off when there is none", () => {
    const game = (name: string, rankText = "") => ({
      gameId: name,
      name,
      skillLevel: "casual" as const,
      rankText,
      lolTier: null,
      lolDivision: null,
    });
    const lines = cardPreviewLines(
      complete({ games: [game("A"), game("B", " Diamond "), game("C"), game("D")] }),
      new Date(NOW),
    );
    expect(lines.games).toEqual(["A", "B · Diamond", "C"]);
  });

  it("still draws a line when an answer is missing", () => {
    expect(cardPreviewLines(complete({ region: null, ageConfirmedDob: null }), new Date(NOW)).details).toBe("en");
  });
});

describe("sanitizeDraft", () => {
  it("is empty for anything that is not an object", () => {
    expect(sanitizeDraft(null, NOW)).toEqual({});
    expect(sanitizeDraft("x", NOW)).toEqual({});
    expect(sanitizeDraft([1], NOW)).toEqual({});
  });

  it(`wipes a draft started more than ${DRAFT_TTL_DAYS} days ago`, () => {
    expect(sanitizeDraft(complete({ draftStartedAt: NOW - 8 * DAY }), NOW)).toEqual({});
  });

  it("wipes a draft with no start time to measure", () => {
    expect(sanitizeDraft({ ...complete(), draftStartedAt: null }, NOW)).toEqual({});
    expect(sanitizeDraft({ ...complete(), draftStartedAt: "yesterday" }, NOW)).toEqual({});
  });

  it("keeps a 6-day-old draft whole", () => {
    const draft = complete({ draftStartedAt: NOW - 6 * DAY });
    expect(sanitizeDraft(draft, NOW)).toEqual(draft);
  });

  it("drops a bad last step, region and prompts array", () => {
    const out = sanitizeDraft(
      { ...complete(), lastStep: "shows", region: "mars", prompts: [null, null] },
      NOW,
    );
    expect(out).not.toHaveProperty("lastStep");
    expect(out).not.toHaveProperty("region");
    expect(out).not.toHaveProperty("prompts");
    expect(out.displayName).toBe("Cameron");
  });

  it("drops an under-18 or malformed DOB", () => {
    expect(sanitizeDraft(complete({ ageConfirmedDob: "2015-01-01" }), NOW)).not.toHaveProperty("ageConfirmedDob");
    expect(sanitizeDraft(complete({ ageConfirmedDob: "2000-02-31" }), NOW)).not.toHaveProperty("ageConfirmedDob");
  });

  it("drops non-string entries and unknown values from the lists", () => {
    const out = sanitizeDraft(
      { ...complete(), languages: ["en", 3, "xx"], platforms: ["pc", null], playstyles: ["chill", {}, "nope"] },
      NOW,
    );
    expect(out.languages).toEqual(["en"]);
    expect(out.platforms).toEqual(["pc"]);
    expect(out.playstyles).toEqual(["chill"]);
  });

  it("drops malformed games, shows and prompt entries", () => {
    const out = sanitizeDraft(
      {
        ...complete(),
        games: [complete().games[0], { gameId: 4 }, "x"],
        shows: [{ showId: "s", name: "Arcane" }, { showId: 1 }],
        prompts: [{ promptId: "p", question: "q", answer: "a" }, null, { promptId: 1 }],
      },
      NOW,
    );
    expect(out.games).toEqual([complete().games[0]]);
    expect(out.shows).toEqual([{ showId: "s", name: "Arcane" }]);
    expect(out.prompts).toEqual([{ promptId: "p", question: "q", answer: "a" }, null, null]);
  });

  it("drops fields of the wrong type", () => {
    const out = sanitizeDraft(
      { ...complete(), displayName: 5, readyToSave: "yes", profilePhotoUri: 7, commitPending: 1 },
      NOW,
    );
    expect(out).not.toHaveProperty("displayName");
    expect(out).not.toHaveProperty("readyToSave");
    expect(out).not.toHaveProperty("profilePhotoUri");
    expect(out).not.toHaveProperty("commitPending");
  });
});

describe("canShowDraftDob", () => {
  it("is true only for a draft started in this launch", () => {
    expect(canShowDraftDob({ draftStartedAt: 1000, launchStartedAt: 1000 })).toBe(true);
    expect(canShowDraftDob({ draftStartedAt: 2000, launchStartedAt: 1000 })).toBe(true);
    expect(canShowDraftDob({ draftStartedAt: 999, launchStartedAt: 1000 })).toBe(false);
    expect(canShowDraftDob({ draftStartedAt: null, launchStartedAt: 1000 })).toBe(false);
  });
});
