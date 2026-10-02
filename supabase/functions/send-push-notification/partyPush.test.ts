import { describe, expect, it } from "vitest";

import {
  joinNames,
  lowercaseIds,
  partyInvitePush,
  partyJoinedPush,
  partyMessagePush,
  partyRecipients,
  partyStartedPush,
  pushData,
} from "./partyPush";

const PARTY = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

// The two dashes spelled by code, so this file carries neither character.
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

describe("party push copy", () => {
  it("invite: names the members joined with ' & ' and says where to accept", () => {
    expect(partyInvitePush(["Alex", "Sam"])).toEqual({
      title: "Party invite",
      body: "Alex & Sam want you in their party. Open Matches to accept.",
    });
  });

  it("invite: one name left reads 'wants', not 'want'", () => {
    expect(partyInvitePush(["Alex"]).body).toBe(
      "Alex wants you in their party. Open Matches to accept.",
    );
  });

  it("started: names the creator and says where the party is", () => {
    expect(partyStartedPush("Alex")).toEqual({
      title: "Alex started a party",
      body: "Swipe together to find a third. It's under Your parties on Matches.",
    });
  });

  it("joined: names who joined", () => {
    expect(partyJoinedPush("Jo")).toEqual({
      title: "Jo joined your party",
      body: "Say hi in the party chat.",
    });
  });

  it("message: the sender is the title and the words never appear", () => {
    expect(partyMessagePush("Sam")).toEqual({ title: "Sam", body: "Sent a message in your party chat" });
  });

  it("joinNames keeps the order given", () => {
    expect(joinNames(["A", "B", "C"])).toBe("A & B & C");
  });

  it("carries no em or en dash anywhere", () => {
    const all = [
      partyInvitePush(["Alex", "Sam"]),
      partyInvitePush(["Alex"]),
      partyStartedPush("Alex"),
      partyJoinedPush("Jo"),
      partyMessagePush("Sam"),
    ];
    for (const { title, body } of all) {
      expect(`${title} ${body}`).not.toContain(EN_DASH);
      expect(`${title} ${body}`).not.toContain(EM_DASH);
    }
  });
});

describe("partyRecipients", () => {
  it("is everyone but the person who acted, each once", () => {
    expect(partyRecipients(["a", "b", "c", "b"], "a")).toEqual(["b", "c"]);
  });

  it("is everyone when the actor is not a member", () => {
    expect(partyRecipients(["a", "b"], "z")).toEqual(["a", "b"]);
  });
});

describe("pushData", () => {
  it("a party push carries partyId and its category, and never matchId", () => {
    const data = pushData({ partyId: PARTY }, "party_message");
    expect(data).toEqual({ partyId: PARTY, category: "party_message" });
    expect(data).not.toHaveProperty("matchId");
  });

  it("category is spread last, so an extra field can never replace it", () => {
    const data = pushData({ category: "new_message", partyId: PARTY }, "party_invite");
    expect(data.category).toBe("party_invite");
  });

  it("the 1:1 pushes keep exactly the shape they had", () => {
    expect(pushData({ matchId: "m" }, "new_message")).toEqual({ matchId: "m", category: "new_message" });
    expect(pushData({}, "super_ping")).toEqual({ category: "super_ping" });
  });
});

describe("lowercaseIds", () => {
  it("lowercases every id and leaves the type alone", () => {
    const event = { type: "party_joined", partyId: PARTY.toUpperCase(), joinerId: "ABC" };
    expect(lowercaseIds(event)).toEqual({ type: "party_joined", partyId: PARTY, joinerId: "abc" });
  });
});
