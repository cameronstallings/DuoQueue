import { describe, expect, it } from "vitest";

import {
  addCustomLabel,
  AGE_GATE_COPY,
  COMMIT_COPY,
  commitWelcome,
  CONFIRM_EMAIL_COPY,
  DISCORD_COPY,
  FRONT_DOOR_COPY,
  GAMES_COPY,
  INTRO_COPY,
  LANGUAGES_COPY,
  NAME_COPY,
  REGION_COPY,
  regionTitle,
  RESET_COPY,
  resendLabel,
  resetSentBody,
  REVIEW_NOTES_SENTENCE,
  SAVE_COPY,
  SIGN_IN_COPY,
  SIGN_UP_COPY,
  START_OVER_SHEET,
  stepLabel,
  welcomeTitle,
  WIZARD_COPY,
} from "./frontDoorCopy";

function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsOf);
  return [];
}

const ALL: string[] = [
  ...stringsOf([
    FRONT_DOOR_COPY,
    START_OVER_SHEET,
    AGE_GATE_COPY,
    INTRO_COPY,
    WIZARD_COPY,
    NAME_COPY,
    REGION_COPY,
    LANGUAGES_COPY,
    GAMES_COPY,
    DISCORD_COPY,
    SAVE_COPY,
    SIGN_UP_COPY,
    SIGN_IN_COPY,
    RESET_COPY,
    COMMIT_COPY,
    CONFIRM_EMAIL_COPY,
  ]),
  REVIEW_NOTES_SENTENCE,
  regionTitle("Cameron"),
  regionTitle(""),
  welcomeTitle("Cameron"),
  commitWelcome("Cameron"),
  commitWelcome(""),
  resetSentBody("cam@example.com"),
  resendLabel(42),
  resendLabel(0),
  stepLabel(3, 8),
  addCustomLabel("Deep Rock Galactic"),
];

describe("the copy says what the plan says", () => {
  it("front door", () => {
    expect(FRONT_DOOR_COPY.title).toBe("Find a duo who actually shows up.");
    expect(FRONT_DOOR_COPY.body).toBe(
      "Someone who plays your game, can queue at your rank, and talks. Teammates, not dates.",
    );
    expect(FRONT_DOOR_COPY.getStarted).toBe("Get started");
    expect(FRONT_DOOR_COPY.haveAccount).toBe("I already have an account");
    expect(FRONT_DOOR_COPY.caption).toBe("For players 18 and older.");
  });

  it("keeps the age gate's line that ages are shown (AGES STAY)", () => {
    expect(AGE_GATE_COPY.blurb).toBe(
      "DuoQueue is for players 18 and older. Your date of birth is kept private. Only your age is ever shown on your profile.",
    );
  });

  it("intro and Save", () => {
    expect(INTRO_COPY.title).toBe("Pick each other. Then play.");
    expect(SAVE_COPY.title).toBe("Save your card");
    expect(SAVE_COPY.email).toBe("Create an account with email");
  });

  it("the templates", () => {
    expect(regionTitle("Cameron")).toBe("Nice to meet you, Cameron. Where do you play from?");
    expect(regionTitle("")).toBe("Where do you play from?");
    expect(welcomeTitle("Cameron")).toBe("Welcome, Cameron");
    expect(commitWelcome("Cameron")).toBe("Welcome, Cameron.");
    expect(resetSentBody("a@b.co")).toBe("If an account uses a@b.co, we sent it a 6-digit code. It works for one hour.");
    expect(resendLabel(42)).toBe("Send a new code in 42s");
    expect(resendLabel(0)).toBe("Send a new code");
    expect(stepLabel(3, 8)).toBe("Step 3 of 8");
    expect(addCustomLabel("Deep Rock")).toBe('Not listed? Add "Deep Rock"');
  });

  it("gives Group R the review-notes sentence", () => {
    expect(REVIEW_NOTES_SENTENCE).toBe(
      'The demo account signs in from the first screen: tap "I already have an account", then enter the email and password below.',
    );
  });
});

describe("the copy sweep", () => {
  it("found every string", () => {
    expect(ALL.length).toBeGreaterThan(80);
  });

  it.each(ALL)("%s has no em or en dash", (s) => {
    // By code point (U+2014, U+2013), so this file holds neither character itself.
    expect(s).not.toContain(String.fromCharCode(0x2014));
    expect(s).not.toContain(String.fromCharCode(0x2013));
  });

  it.each(ALL)("%s avoids the banned word (say moments)", (s) => {
    // Built from two halves so this file never contains the word itself.
    expect(s).not.toMatch(new RegExp("\\bbea" + "ts?\\b", "i"));
  });

  it.each(ALL)("%s never reads as a dating app", (s) => {
    // The one allowed "dates" is the disclaimer itself, as in invite.test.ts.
    expect(s.replace(/not dates/g, "")).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
  });

  it.each(ALL)("%s never mentions a confirmation code (the button is gone)", (s) => {
    expect(s).not.toMatch(/confirmation code/i);
  });
});
