import { describe, expect, it } from "vitest";

import {
  CALL_ENDED_COPY,
  DUO_POPS_OPT_IN_COPY,
  EMPTY_DECK_COPY,
  lockedLine,
  ONLINE_NOW_COPY,
  outcomeLine,
  POP_COPY,
  POP_RESULT_COPY,
  popEndedTitle,
  popLockedTitle,
  popSentence,
  QUEUE_COPY,
  queueErrorMessage,
  ringClock,
  untilLine,
} from "./queueCopy";
import type { PopOutcome } from "./queueState";

const facts = { notified: 4, gameName: "League of Legends", minutesLeft: 42 };

/** A PostgREST error as supabase-js hands it over: a plain object, not an Error. */
function pgError(code: string, message: string, hint: string | null = null) {
  return { code, message, details: null, hint };
}

describe("outcomeLine", () => {
  it("counts the players told, singular and plural", () => {
    expect(outcomeLine("popping", { ...facts, notified: 1 })).toBe("We let 1 player know.");
    expect(outcomeLine("popping", facts)).toBe("We let 4 players know.");
  });

  it("says nobody grabbed it, and how long they stay queued", () => {
    expect(outcomeLine("no_answer", facts)).toBe("Nobody grabbed it this time. You're still queued for 42 min.");
  });

  it("gives every server reason its own honest line", () => {
    expect(outcomeLine("ping_off", facts)).toBe("You're queued quietly. Your matches can see you're free.");
    expect(outcomeLine("outside_na", facts)).toBe(
      "Duo Pops reach players in North America for now. Your matches can see you're free.",
    );
    expect(outcomeLine("daily_limit", facts)).toBe(
      "You've sent 3 Duo Pops today. Your matches can still see you're free.",
    );
    expect(outcomeLine("no_players", facts)).toBe(
      "No one in League of Legends could get a Duo Pop right now. Share your post so someone can find you.",
    );
    expect(outcomeLine("too_new", facts)).toBe(
      "Duo Pops start working a day after you join. Your matches can see you're free.",
    );
    expect(outcomeLine("unavailable", facts)).toBe(
      "Duo Pops aren't available on this account right now. Your matches can see you're free.",
    );
  });

  it("never claims players were told when none were", () => {
    expect(outcomeLine("popping", { ...facts, notified: 0 })).toBe(outcomeLine("no_players", facts));
    expect(outcomeLine("no_players", { ...facts, gameName: null })).toContain("No one in your game");
  });
});

describe("the small lines", () => {
  it("reads the sheet's times and names", () => {
    expect(untilLine("10:40 PM")).toBe("On until 10:40 PM.");
    expect(lockedLine("Kai")).toBe("Kai grabbed your Duo Pop.");
    expect(popSentence("Kai", "League of Legends")).toBe(
      "Kai is queueing League of Legends now. The first player to tap I'm in gets the duo.",
    );
    expect(popSentence("Kai", null)).toBe("Kai is queueing now. The first player to tap I'm in gets the duo.");
    expect(popEndedTitle("Kai")).toBe("Kai stopped queueing");
    expect(popLockedTitle("Kai")).toBe("You're duo locked with Kai");
  });

  it("draws the ring's clock as m:ss", () => {
    expect(ringClock(581)).toBe("9:41");
    expect(ringClock(600)).toBe("10:00");
    expect(ringClock(5)).toBe("0:05");
    expect(ringClock(-3)).toBe("0:00");
  });

  it("titles the queued Online Now card by its game", () => {
    expect(ONLINE_NOW_COPY.queuedTitle("Valorant")).toBe("Queued for Valorant");
    expect(ONLINE_NOW_COPY.queuedTitle(null)).toBe("You're queued");
  });

  it("adds the ping sentence to the empty deck only when the ping can reach them", () => {
    const base =
      "There is nobody new in your deck right now. Queue up to let players in your game know you're on, or bring somebody you already play with.";
    expect(EMPTY_DECK_COPY.subtitle(false)).toBe(base);
    expect(EMPTY_DECK_COPY.subtitle(true)).toBe(
      `${base} We will ping you when a player who shares your games joins.`,
    );
  });
});

describe("queueErrorMessage", () => {
  const fallback = QUEUE_COPY.startFailed;

  it("never shows the rate limit's machine token", () => {
    expect(queueErrorMessage(pgError("P0001", "rate_limit_exceeded:queue_up"), fallback)).toBe(QUEUE_COPY.rateLimited);
  });

  it("says a banned account cannot do this", () => {
    expect(queueErrorMessage(pgError("P0001", "account_banned"), fallback)).toBe(QUEUE_COPY.banned);
  });

  it("shows the server's own sentence for a raise with a hint", () => {
    expect(
      queueErrorMessage(pgError("P0001", "not_your_game", "Pick one of the games on your profile."), fallback),
    ).toBe("Pick one of the games on your profile.");
    expect(
      queueErrorMessage(pgError("P0001", "profile_not_ready", "Finish setting up your profile first."), fallback),
    ).toBe("Finish setting up your profile first.");
  });

  it("says Queue Up is not ready while the server has no such function", () => {
    expect(queueErrorMessage(pgError("PGRST202", "Could not find the function public.start_queue_up"), fallback)).toBe(
      QUEUE_COPY.notReady,
    );
  });

  it("falls back for anything else", () => {
    expect(queueErrorMessage(pgError("42501", "permission denied for function start_queue_up"), fallback)).toBe(
      fallback,
    );
    expect(queueErrorMessage(new TypeError("Network request failed"), fallback)).toBe(fallback);
    expect(queueErrorMessage(undefined, fallback)).toBe(fallback);
    expect(queueErrorMessage("boom", fallback)).toBe(fallback);
  });
});

/** Every string this module can produce: the constants, and each function on sample input. */
function everyString(): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "function") {
      // The copy functions take a name, a game, a flag or a count; sample each shape.
      for (const arg of ["Kai", true, false, null, 3]) {
        const result = (value as (a: unknown) => unknown)(arg);
        if (typeof result === "string") out.push(result);
      }
    } else if (value && typeof value === "object") {
      for (const v of Object.values(value)) walk(v);
    }
  };
  walk([QUEUE_COPY, POP_COPY, POP_RESULT_COPY, DUO_POPS_OPT_IN_COPY, EMPTY_DECK_COPY, ONLINE_NOW_COPY, CALL_ENDED_COPY]);
  const outcomes: PopOutcome[] = [
    "popping",
    "no_answer",
    "ping_off",
    "outside_na",
    "daily_limit",
    "no_players",
    "too_new",
    "unavailable",
  ];
  for (const o of outcomes) out.push(outcomeLine(o, facts), outcomeLine(o, { ...facts, notified: 1 }));
  out.push(
    untilLine("10:40 PM"),
    lockedLine("Kai"),
    popSentence("Kai", "League of Legends"),
    popEndedTitle("Kai"),
    popLockedTitle("Kai"),
    ringClock(581),
  );
  return out;
}

describe("the copy sweep", () => {
  const strings = everyString();

  it("found the strings it sweeps", () => {
    expect(strings.length).toBeGreaterThan(60);
  });

  it("has no em or en dashes", () => {
    for (const s of strings) expect(s, s).not.toMatch(/[–—]/);
  });

  it("never says beats", () => {
    for (const s of strings) expect(s, s).not.toMatch(/\bbeats?\b/i);
  });

  it("never reads as dating, once the 18+ disclaimer's own 'not dates' is taken out", () => {
    for (const s of strings) {
      expect(s.replace(/not dates/g, ""), s).not.toMatch(
        /\bdates?\b|dating|singles|hookup|nearby|meet people|match with singles/i,
      );
    }
  });

  it("never says Accept or Lock In (the Duo Pop words are I'm in and Not now)", () => {
    for (const s of strings) expect(s, s).not.toMatch(/\baccept|lock in\b/i);
  });

  it("says I'm in on every Duo Pop surface", () => {
    expect(POP_COPY.imIn).toBe("I'm in");
    expect(POP_COPY.notNow).toBe("Not now");
    expect(popSentence("Kai", "Valorant")).toContain("I'm in");
    expect(DUO_POPS_OPT_IN_COPY.body).toContain("I'm in");
    expect(QUEUE_COPY.pingHint).toContain("I'm in");
  });

  it("says 18+ and not dates where the post is shared", () => {
    expect(QUEUE_COPY.adultsOnly).toContain("18+");
    expect(QUEUE_COPY.adultsOnly).toContain("not dates");
  });
});
