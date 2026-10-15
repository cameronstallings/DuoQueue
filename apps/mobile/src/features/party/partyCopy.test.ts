import { describe, expect, it } from "vitest";

import {
  INVITE_CLOSED_MESSAGE,
  INVITE_EXPIRED_MESSAGE,
  INVITE_FALLBACK_MESSAGE,
  PARTY_ARRIVAL_COPY,
  PARTY_CODE_FIELD_COPY,
  PARTY_DECK_COPY,
  PARTY_FULL_MESSAGE,
  PARTY_INVITE_FIELD_LINES,
  PARTY_JOIN_RESULT_COPY,
  PARTY_LFG_COPY,
  TOO_MANY_TRIES_MESSAGE,
  joinNames,
  partyConsent,
  partyInviteErrorMessage,
  partyJoinErrorOutcome,
  partyLfgErrorMessage,
  partyLfgStartFailure,
  partyLiveLine,
  partyMemberLine,
} from "./partyCopy";

describe("joinNames", () => {
  it("reads like a sentence at every length", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Sam"])).toBe("Sam");
    expect(joinNames(["Sam", "Alex"])).toBe("Sam & Alex");
    expect(joinNames(["Sam", "Alex", "Jo"])).toBe("Sam, Alex & Jo");
    expect(joinNames(["Sam", "Alex", "Jo", "Kai"])).toBe("Sam, Alex, Jo & Kai");
  });
});

/** The plain object PostgREST hands back for a RAISE. */
function raise(message: string, hint: string | null = null, details: string | null = null) {
  return { code: "P0001", message, details, hint };
}

describe("partyInviteErrorMessage", () => {
  it("shows the server's own sentence when a RAISE carries one in its hint", () => {
    expect(partyInviteErrorMessage(raise("invite_expired", "This invite ran out after a week."))).toBe(
      "This invite ran out after a week.",
    );
  });

  it("recognises 0070's two refusals exactly as respond_party_invite raises them", () => {
    expect(
      partyInviteErrorMessage(raise("This party invite expired. Invites last 7 days.", null, "party_invite_expired")),
    ).toBe(INVITE_EXPIRED_MESSAGE);
    expect(
      partyInviteErrorMessage(raise("This party is already full. Parties hold 3 players.", null, "party_full")),
    ).toBe(PARTY_FULL_MESSAGE);
  });

  it("recognises them by their detail token alone, so a reworded message still reads right", () => {
    expect(partyInviteErrorMessage(raise("Cannot accept", null, "party_invite_expired"))).toBe(INVITE_EXPIRED_MESSAGE);
    expect(partyInviteErrorMessage(raise("Cannot accept", null, "party_full"))).toBe(PARTY_FULL_MESSAGE);
  });

  it("recognises an expired invite or a full party by what the message says", () => {
    expect(partyInviteErrorMessage(raise("This invite has expired"))).toBe(INVITE_EXPIRED_MESSAGE);
    expect(partyInviteErrorMessage(raise("party_full"))).toBe(PARTY_FULL_MESSAGE);
  });

  it("does not read 'full' inside another word", () => {
    expect(partyInviteErrorMessage(raise("Something failed successfully"))).toBe(INVITE_FALLBACK_MESSAGE);
  });

  it("says an answered or swept invite is closed", () => {
    expect(partyInviteErrorMessage(raise("No pending invite"))).toBe(INVITE_CLOSED_MESSAGE);
  });

  it("never shows the rate limit's machine token", () => {
    expect(partyInviteErrorMessage(raise("rate_limit_exceeded:respond_party_invite"))).toBe(TOO_MANY_TRIES_MESSAGE);
  });

  it("falls back for anything else, an Error or nothing at all", () => {
    expect(partyInviteErrorMessage(raise("account_banned"))).toBe(INVITE_FALLBACK_MESSAGE);
    expect(partyInviteErrorMessage(new TypeError("Network request failed"))).toBe(INVITE_FALLBACK_MESSAGE);
    expect(partyInviteErrorMessage(undefined)).toBe(INVITE_FALLBACK_MESSAGE);
    expect(partyInviteErrorMessage("boom")).toBe(INVITE_FALLBACK_MESSAGE);
    // A hint only counts on a RAISE; anything else might be Postgres internals.
    expect(partyInviteErrorMessage({ code: "42501", message: "permission denied", hint: "grant it" })).toBe(
      INVITE_FALLBACK_MESSAGE,
    );
  });

  it("writes every sentence without an em dash", () => {
    for (const sentence of [
      INVITE_EXPIRED_MESSAGE,
      PARTY_FULL_MESSAGE,
      INVITE_CLOSED_MESSAGE,
      TOO_MANY_TRIES_MESSAGE,
      INVITE_FALLBACK_MESSAGE,
    ]) {
      expect(sentence).not.toContain("—");
    }
  });
});

describe("the party LFG post's words", () => {
  it("names the buttons and the toast", () => {
    expect(PARTY_LFG_COPY.share).toBe("Share LFG post");
    expect(PARTY_LFG_COPY.shareAgain).toBe("Share again");
    expect(PARTY_LFG_COPY.sharePost).toBe("Share post");
    expect(PARTY_LFG_COPY.copy).toBe("Copy post");
    expect(PARTY_LFG_COPY.copied).toBe("Post copied");
    expect(PARTY_LFG_COPY.stop).toBe("Stop post");
    expect(PARTY_LFG_COPY.stopped).toBe("Post stopped. Its code no longer works.");
  });

  it("says whose post is live and until when", () => {
    expect(partyLiveLine({ mine: true, sharerName: "Sam", time: "11:40 PM" })).toBe(
      "Your LFG post works until 11:40 PM.",
    );
    expect(partyLiveLine({ mine: false, sharerName: "Sam", time: "11:40 PM" })).toBe(
      "Sam's LFG post works until 11:40 PM.",
    );
    expect(partyLiveLine({ mine: false, sharerName: null, time: "11:40 PM" })).toBe(
      "Your party's LFG post works until 11:40 PM.",
    );
    expect(partyLiveLine({ mine: true, sharerName: null, time: null })).toBe("Your LFG post is live.");
    expect(partyLiveLine({ mine: false, sharerName: "Sam", time: null })).toBe("Sam's LFG post is live.");
  });

  it("asks before the first post, and says the other member will see a note", () => {
    const first = partyConsent({ time: "11:40 PM", otherName: "Alex", firstPost: true });
    expect(first.title).toBe("Share a post to find a third?");
    expect(first.body).toBe(
      "Anyone who joins DuoQueue with your code can take the last seat in this party. Players with the code can see both your names and ages. The code works until 11:40 PM, plus 15 minutes for anyone already signing up. Alex will see a note in your party chat. Only share it where adults look for teammates.",
    );
    expect(first.confirm).toBe("Share post");
    expect(first.cancel).toBe("Not now");
  });

  it("asks the member who did not start the post too, since it carries their own rank", () => {
    const second = partyConsent({ time: "11:40 PM", otherName: "Sam", firstPost: false });
    expect(second.body).toBe(
      "Anyone who joins DuoQueue with your party's code can take the last seat in this party. Players with the code can see both your names and ages. The code works until 11:40 PM, plus 15 minutes for anyone already signing up. Your post shows your own rank. Only share it where adults look for teammates.",
    );
    expect(second.body).not.toContain("note in your party chat");
  });

  it("still reads when the time or the other name is unknown", () => {
    expect(partyConsent({ time: null, otherName: null, firstPost: true }).body).toBe(
      "Anyone who joins DuoQueue with your code can take the last seat in this party. Players with the code can see both your names and ages. The code works for 2 hours, plus 15 minutes for anyone already signing up. Your partner will see a note in your party chat. Only share it where adults look for teammates.",
    );
  });

  it("changes the deck caption only while a code can bring someone in", () => {
    expect(PARTY_DECK_COPY.caption).toBe("Everyone in the party has to like someone before they get invited.");
    expect(PARTY_DECK_COPY.captionWithPost).toBe(
      "From the deck, everyone in the party has to like someone before they get invited.",
    );
    expect(PARTY_DECK_COPY.emptySubtitleWithPost).toBe(
      "Share an LFG post to find your third anywhere, or check back later for more people to consider together.",
    );
  });
});

describe("partyLfgErrorMessage", () => {
  const fallback = PARTY_LFG_COPY.startFailed;

  it("never shows the rate limit's machine token", () => {
    expect(partyLfgErrorMessage(raise("rate_limit_exceeded:party_call"), fallback)).toBe(PARTY_LFG_COPY.rateLimited);
    expect(PARTY_LFG_COPY.rateLimited).toBe("You've made a lot of posts in the last hour. Try again a little later.");
  });

  it("says a full party is full, in the words the party screens already use", () => {
    expect(
      partyLfgErrorMessage(raise("This party is already full. Parties hold 3 players.", null, "party_full"), fallback),
    ).toBe(PARTY_FULL_MESSAGE);
  });

  it("says who can post in its own words, never 0089's hint, which is false for an unmatched pair of two", () => {
    expect(PARTY_LFG_COPY.notReady).toBe("Only two matched players with active accounts can post for a third.");
    expect(
      partyLfgErrorMessage(
        raise("party_not_ready", "A party needs two players before it can look for a third.", "party_not_ready"),
        fallback,
      ),
    ).toBe(PARTY_LFG_COPY.notReady);
    expect(partyLfgErrorMessage(raise("party_not_ready"), fallback)).toBe(PARTY_LFG_COPY.notReady);
  });

  it("shows partner_not_ready's hint, which names who to ask, as a step and not an error", () => {
    const hint = "Ask Alex to open this party on the latest DuoQueue first. Then they can see your post and stop it.";
    const err = raise("party_not_ready", hint, "partner_not_ready");
    expect(partyLfgErrorMessage(err, fallback)).toBe(hint);
    expect(partyLfgStartFailure(err)).toEqual({ kind: "step", title: "One more step", message: hint });
    // Without its hint it still says the step, never "only two matched players".
    expect(partyLfgStartFailure(raise("party_not_ready", null, "partner_not_ready"))).toEqual({
      kind: "step",
      title: "One more step",
      message: PARTY_LFG_COPY.partnerFirst,
    });
  });

  it("makes every other Share failure an error toast", () => {
    expect(partyLfgStartFailure(raise("party_not_ready", null, "party_not_ready"))).toEqual({
      kind: "error",
      message: PARTY_LFG_COPY.notReady,
    });
    expect(partyLfgStartFailure(new TypeError("Network request failed"))).toEqual({
      kind: "error",
      message: PARTY_LFG_COPY.startFailed,
    });
  });

  it("shows any other server sentence written as a hint", () => {
    expect(
      partyLfgErrorMessage(raise("profile_not_ready", "Finish setting up your profile first."), fallback),
    ).toBe("Finish setting up your profile first.");
  });

  it("says a banned account cannot, and falls back for anything else", () => {
    expect(partyLfgErrorMessage(raise("account_banned"), fallback)).toBe("This account cannot do that right now.");
    expect(partyLfgErrorMessage(raise("Not a party member"), fallback)).toBe(fallback);
    expect(partyLfgErrorMessage({ code: "42501", message: "permission denied", hint: "grant it" }, fallback)).toBe(
      fallback,
    );
    expect(partyLfgErrorMessage(new TypeError("Network request failed"), PARTY_LFG_COPY.stopFailed)).toBe(
      "Couldn't stop the post. Please try again.",
    );
    expect(partyLfgErrorMessage(undefined, fallback)).toBe("Couldn't make your post. Please try again.");
  });
});

describe("joining with a code", () => {
  it("titles the arrival and lists members with their ages (AGES STAY)", () => {
    expect(PARTY_ARRIVAL_COPY.title("Sam")).toBe("Join Sam's party");
    expect(PARTY_ARRIVAL_COPY.body).toBe("They're looking for a third. Join and you're in their party chat.");
    expect(PARTY_ARRIVAL_COPY.join).toBe("Join the party");
    expect(PARTY_ARRIVAL_COPY.notNow).toBe("Not right now");
    expect(PARTY_ARRIVAL_COPY.joinFailedTitle).toBe("Couldn't join the party");
    expect(PARTY_ARRIVAL_COPY.alreadyIn).toBe("You're already in this party.");
    expect(PARTY_ARRIVAL_COPY.openChat).toBe("Open party chat");
    expect(partyMemberLine("Sam", 24)).toBe("Sam, 24");
    expect(partyMemberLine("Sam", null)).toBe("Sam");
  });

  it("leaves the arrival on a Join refusal that will not change, and stays when a second tap can help", () => {
    // 0089's kill switch revokes execute (42501), and a function that is gone is PGRST202: the
    // party is not available, as every other read of this feature says.
    expect(partyJoinErrorOutcome({ code: "42501", message: "permission denied for function join_party_by_code" })).toEqual(
      { message: PARTY_JOIN_RESULT_COPY.unavailable, leave: true },
    );
    expect(partyJoinErrorOutcome({ code: "PGRST202", message: "Could not find the function" })).toEqual({
      message: PARTY_JOIN_RESULT_COPY.unavailable,
      leave: true,
    });
    expect(partyJoinErrorOutcome(raise("account_banned"))).toEqual({ message: PARTY_LFG_COPY.banned, leave: true });
    expect(partyJoinErrorOutcome(raise("profile_not_ready", "Finish setting up your profile first."))).toEqual({
      message: "Finish setting up your profile first.",
      leave: true,
    });
    expect(partyJoinErrorOutcome(raise("rate_limit_exceeded:join_party_by_code"))).toEqual({
      message: TOO_MANY_TRIES_MESSAGE,
      leave: false,
    });
    expect(partyJoinErrorOutcome(new TypeError("Network request failed"))).toEqual({
      message: INVITE_FALLBACK_MESSAGE,
      leave: false,
    });
  });

  it("says why there was no seat", () => {
    expect(PARTY_JOIN_RESULT_COPY.full).toBe(
      "That party's last seat was taken before you got there. You can still find players here.",
    );
    expect(PARTY_JOIN_RESULT_COPY.ended).toBe(
      "That party post ended before you got there. You can still find players here.",
    );
    expect(PARTY_JOIN_RESULT_COPY.unavailable).toBe("That party isn't available. You can still find players here.");
  });

  it("says a party code's state in the invite field and in the Matches field", () => {
    expect(PARTY_INVITE_FIELD_LINES.full).toBe(
      "That party's last seat is spoken for. You can still set up your card and find players here.",
    );
    expect(PARTY_INVITE_FIELD_LINES.ended).toBe(
      "That party post has ended. You can still set up your card and find players here.",
    );
    expect(PARTY_CODE_FIELD_COPY.open).toBe("Have a party code?");
    expect(PARTY_CODE_FIELD_COPY.full).toBe("That party's last seat is spoken for.");
    // Offline or a timeout: nothing is said about the code itself.
    expect(PARTY_CODE_FIELD_COPY.checkFailed).toBe("Couldn't check that code. Tap to try again.");
    expect(PARTY_CODE_FIELD_COPY.checkFailed).not.toMatch(/did not work/);
  });
});

/** Every string the party copy can produce: the constants, and each function on sample input. */
function everyPartyString(): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "function") {
      const result = (value as (a: unknown, b: unknown) => unknown)("Sam", 24);
      if (typeof result === "string") out.push(result);
    } else if (value && typeof value === "object") {
      for (const v of Object.values(value)) walk(v);
    }
  };
  walk([
    PARTY_LFG_COPY,
    PARTY_DECK_COPY,
    PARTY_ARRIVAL_COPY,
    PARTY_JOIN_RESULT_COPY,
    PARTY_INVITE_FIELD_LINES,
    PARTY_CODE_FIELD_COPY,
  ]);
  for (const mine of [true, false]) {
    for (const time of ["11:40 PM", null]) out.push(partyLiveLine({ mine, sharerName: "Sam", time }));
  }
  for (const firstPost of [true, false]) {
    for (const time of ["11:40 PM", null]) {
      const c = partyConsent({ time, otherName: "Alex", firstPost });
      out.push(c.title, c.body, c.confirm, c.cancel);
    }
  }
  out.push(partyMemberLine("Sam", 24));
  return out;
}

describe("the party copy sweep", () => {
  const strings = everyPartyString();

  it("found the strings it sweeps", () => {
    expect(strings.length).toBeGreaterThan(30);
  });

  it("has no em or en dashes", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    for (const s of strings) expect(s, s).not.toMatch(dashes);
  });

  it("never says beats", () => {
    for (const s of strings) expect(s, s).not.toMatch(/\bbeats?\b/i);
  });

  it("never reads as dating", () => {
    for (const s of strings) {
      expect(s.replace(/not dates/g, ""), s).not.toMatch(
        /\bdates?\b|dating|singles|hookup|nearby|meet people|match with singles/i,
      );
    }
  });

  it("stays sentence case (uppercase only comes from the type styles)", () => {
    for (const s of strings) expect(s, s).not.toMatch(/\b[A-Z]{4,}\b/);
  });
});
