import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  answerWithin,
  chatOpening,
  chatPush,
  duoLockedNotificationOf,
  duoPopNotificationOf,
  frontScreen,
  isOnMatches,
  matchesOpening,
  notificationTapAction,
  partyNotificationOf,
  partyOpening,
  partyPush,
  popOpening,
  shouldHandleTap,
  whenFront,
  type FrontScreen,
  type NavigationReader,
  type NavigationStateLike,
  type NotificationTapInput,
} from "./notificationRouting";

const MATCH_ID = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
const OTHER_MATCH_ID = "a1b2c3d4-e5f6-4a7b-9c8d-0e1f2a3b4c5d";
const PARTY_ID = "5c6d7e8f-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const OTHER_PARTY_ID = "9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b";

/** A tapped new-player push, arriving at a fully settled app. Each test overrides only the
 *  fact it is about. */
const ready: NotificationTapInput = {
  category: "new_player",
  matchId: undefined,
  partyId: undefined,
  navigatorReady: true,
  sessionStatus: "signed_in",
  profileStatus: "loaded",
  onboardingCompleted: true,
};

/** A tapped message push from the server that names its match, at the same settled app. */
const readyMessage: NotificationTapInput = { ...ready, category: "new_message", matchId: MATCH_ID };

const OPEN_CHAT = { kind: "open-chat", matchId: MATCH_ID } as const;

/** Every category that opens a chat when its payload names the match. */
const CHAT_CATEGORIES = ["new_message", "new_match", "nudge_unread"];

/** The four party pushes 0070 sends, each of which names its party. */
const PARTY_CATEGORIES = ["party_invite", "party_started", "party_joined", "party_message"];

/** A tapped party-message push that names its party, at the same settled app. */
const readyParty: NotificationTapInput = { ...ready, category: "party_message", partyId: PARTY_ID };

describe("notificationTapAction", () => {
  it("drops a tap held by a session that has no profile row", () => {
    // Not "wait". For a MISSING profile `onboardingCompleted` is undefined permanently, so a
    // hold here is a hold forever: the hook re-asks on every store change and nothing it can
    // observe will ever release it. There is no deck to open for somebody who has not passed
    // the age gate, so the honest answer is to drop the tap and let routing take them there.
    expect(notificationTapAction({ ...ready, profileStatus: "missing", onboardingCompleted: undefined })).toEqual({
      kind: "ignore",
    });
  });

  it("still holds while the profile read is merely in flight or failed", () => {
    for (const profileStatus of ["unknown", "error"] as const) {
      expect(notificationTapAction({ ...ready, profileStatus, onboardingCompleted: undefined })).toEqual({
        kind: "wait",
      });
    }
  });

  it("opens the deck for a tapped new-player push", () => {
    expect(notificationTapAction(ready)).toEqual({ kind: "open-deck" });
  });

  it("opens the deck for a new-player push whatever else its payload carries", () => {
    // new_player was routed before matchId existed; a stray id must not change where it goes.
    expect(notificationTapAction({ ...ready, matchId: MATCH_ID })).toEqual({ kind: "open-deck" });
  });

  it("leaves every unrouted category alone, even one carrying a valid match id", () => {
    // These all resume where the user left off. A match id on, say, a looking-now nudge would
    // still not make it a chat push: the category decides what a push is, the id only where.
    for (const category of ["super_ping", "nudge_online", "daily_swipes_refreshed"]) {
      expect(notificationTapAction({ ...ready, category })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...ready, category, matchId: MATCH_ID })).toEqual({ kind: "ignore" });
    }
  });

  it("ignores a payload with no category at all", () => {
    expect(notificationTapAction({ ...ready, category: undefined })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...ready, category: null })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...ready, category: undefined, matchId: MATCH_ID })).toEqual({ kind: "ignore" });
  });

  it("does not treat a lookalike category as ours", () => {
    // The payload crossed a network and an OS; an exact match is the only safe test.
    expect(notificationTapAction({ ...ready, category: "new_players" })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...ready, category: "New_Player" })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...ready, category: { category: "new_player" } })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...readyMessage, category: "new_messages" })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...readyMessage, category: "New_Match" })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...readyMessage, category: "nudge-unread" })).toEqual({ kind: "ignore" });
  });

  it("waits rather than navigating a root layout that has not rendered", () => {
    // RootLayout returns null until the fonts land, and a tap is one of the ways to arrive
    // inside that window — the tap is what started the app.
    expect(notificationTapAction({ ...ready, navigatorReady: false })).toEqual({ kind: "wait" });
  });

  it("waits while the session is still resolving, instead of dropping the tap", () => {
    // The whole cold-start case. "ignore" here would mean the deep link never works when the
    // app was not already running, which is most of the time.
    expect(notificationTapAction({ ...ready, sessionStatus: "loading" })).toEqual({ kind: "wait" });
  });

  it("waits while the profile row is still loading", () => {
    expect(notificationTapAction({ ...ready, onboardingCompleted: undefined })).toEqual({ kind: "wait" });
  });

  it("gives up when there is no session to route with", () => {
    expect(notificationTapAction({ ...ready, sessionStatus: "signed_out" })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...ready, sessionStatus: "signed_out", onboardingCompleted: undefined })).toEqual({
      kind: "ignore",
    });
  });

  it("does not fight the onboarding redirect", () => {
    // (tabs)/_layout.tsx sends an incomplete profile to the wizard. Finishing it lands on the
    // deck anyway, so there is nothing lost by standing down.
    expect(notificationTapAction({ ...ready, onboardingCompleted: false })).toEqual({ kind: "ignore" });
  });

  it("checks the payload before anything else, so a push that goes nowhere never waits", () => {
    // A held tap is re-evaluated on every session change. Holding one that was never ours, or
    // one that names nothing to open, would be a leak with no exit.
    const unsettled = {
      partyId: undefined,
      navigatorReady: false,
      sessionStatus: "loading",
      profileStatus: "unknown",
      onboardingCompleted: undefined,
    } as const;
    expect(notificationTapAction({ ...unsettled, category: "super_ping", matchId: MATCH_ID })).toEqual({
      kind: "ignore",
    });
    expect(notificationTapAction({ ...unsettled, category: "new_message", matchId: undefined })).toEqual({
      kind: "ignore",
    });
    expect(notificationTapAction({ ...unsettled, category: "new_match", matchId: "not-a-uuid" })).toEqual({
      kind: "ignore",
    });
    expect(notificationTapAction({ ...unsettled, category: "nudge_unread", matchId: undefined })).toEqual({
      kind: "ignore",
    });
    for (const category of PARTY_CATEGORIES) {
      expect(notificationTapAction({ ...unsettled, category, matchId: undefined })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...unsettled, category, matchId: undefined, partyId: "nope" })).toEqual({
        kind: "ignore",
      });
    }
  });
});

describe("notificationTapAction: message and match pushes", () => {
  it("opens the chat a new-message push names", () => {
    expect(notificationTapAction(readyMessage)).toEqual(OPEN_CHAT);
  });

  it("opens the chat a new-match push names", () => {
    expect(notificationTapAction({ ...readyMessage, category: "new_match" })).toEqual(OPEN_CHAT);
  });

  it("opens the chat an unread-message reminder names", () => {
    // "Your duo is waiting: <name> sent you a message." It is about one conversation, so it
    // opens that one, like the message push it follows up on.
    expect(notificationTapAction({ ...readyMessage, category: "nudge_unread" })).toEqual(OPEN_CHAT);
  });

  it("resumes where the user left off when the push names no match", () => {
    // Every push from the server before matchId was added, including ones still sitting in
    // Notification Center after the deploy. This is exactly what tapping them did before.
    for (const category of CHAT_CATEGORIES) {
      expect(notificationTapAction({ ...readyMessage, category, matchId: undefined })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...readyMessage, category, matchId: null })).toEqual({ kind: "ignore" });
    }
  });

  it("refuses a match id that is not a UUID", () => {
    // It becomes a route param and a list lookup. Anything that is not the shape of an id is
    // dropped here rather than opened as a chat for nothing.
    const malformed: unknown[] = [
      "",
      "not-a-uuid",
      "3f2b8c1e9a4d4e6f8b2a1c3d5e7f9a0b",
      `${MATCH_ID}x`,
      ` ${MATCH_ID}`,
      `${MATCH_ID}\n`,
      "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0g",
      "../(tabs)/settings",
      42,
      { matchId: MATCH_ID },
      [MATCH_ID],
    ];
    for (const category of CHAT_CATEGORIES) {
      for (const matchId of malformed) {
        expect(notificationTapAction({ ...readyMessage, category, matchId })).toEqual({ kind: "ignore" });
      }
    }
  });

  it("accepts any UUID version, so a server change of id generator cannot strand the shipped app", () => {
    const v7 = "01890a5d-ac96-774b-bcce-b302099a8057";
    expect(notificationTapAction({ ...readyMessage, matchId: v7 })).toEqual({ kind: "open-chat", matchId: v7 });
  });

  it("lowercases the id, the spelling the Matches list uses", () => {
    // The chat screen finds its matchInfo by exact comparison with get_matches_summary's
    // match_id, which Postgres prints lowercase.
    for (const category of CHAT_CATEGORIES) {
      expect(notificationTapAction({ ...readyMessage, category, matchId: MATCH_ID.toUpperCase() })).toEqual(
        OPEN_CHAT,
      );
    }
  });

  it("holds a chat tap through the same not-ready states as the deck", () => {
    for (const category of CHAT_CATEGORIES) {
      const tap = { ...readyMessage, category };
      expect(notificationTapAction({ ...tap, navigatorReady: false })).toEqual({ kind: "wait" });
      expect(notificationTapAction({ ...tap, sessionStatus: "loading" })).toEqual({ kind: "wait" });
      expect(notificationTapAction({ ...tap, onboardingCompleted: undefined })).toEqual({ kind: "wait" });
      for (const profileStatus of ["unknown", "error"] as const) {
        expect(notificationTapAction({ ...tap, profileStatus, onboardingCompleted: undefined })).toEqual({
          kind: "wait",
        });
      }
    }
  });

  it("drops a chat tap wherever the deck tap is dropped", () => {
    // A chat sits on top of (tabs), behind the same layout guard: no session, no profile row
    // and an unfinished wizard each have nowhere to put it.
    for (const category of CHAT_CATEGORIES) {
      const tap = { ...readyMessage, category };
      expect(notificationTapAction({ ...tap, sessionStatus: "signed_out" })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...tap, profileStatus: "missing", onboardingCompleted: undefined })).toEqual({
        kind: "ignore",
      });
      expect(notificationTapAction({ ...tap, onboardingCompleted: false })).toEqual({ kind: "ignore" });
    }
  });
});

describe("notificationTapAction: party pushes", () => {
  it("sends a party invite to the Matches tab, where its banner is answered", () => {
    expect(notificationTapAction({ ...readyParty, category: "party_invite" })).toEqual({ kind: "open-matches" });
  });

  it("opens the party's deck for a party that was started or joined", () => {
    for (const category of ["party_started", "party_joined"]) {
      expect(notificationTapAction({ ...readyParty, category })).toEqual({
        kind: "open-party",
        partyId: PARTY_ID,
        screen: "deck",
      });
    }
  });

  it("opens the party's chat for a party message", () => {
    expect(notificationTapAction(readyParty)).toEqual({ kind: "open-party", partyId: PARTY_ID, screen: "chat" });
  });

  it("ignores a party push that names no party", () => {
    for (const category of PARTY_CATEGORIES) {
      expect(notificationTapAction({ ...readyParty, category, partyId: undefined })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...readyParty, category, partyId: null })).toEqual({ kind: "ignore" });
    }
  });

  it("refuses a party id that is not a UUID", () => {
    const malformed: unknown[] = [
      "",
      "not-a-uuid",
      `${PARTY_ID}x`,
      ` ${PARTY_ID}`,
      "../(tabs)/settings",
      42,
      { partyId: PARTY_ID },
      [PARTY_ID],
    ];
    for (const category of PARTY_CATEGORIES) {
      for (const partyId of malformed) {
        expect(notificationTapAction({ ...readyParty, category, partyId })).toEqual({ kind: "ignore" });
      }
    }
  });

  it("lowercases the party id, the spelling get_my_parties uses", () => {
    expect(notificationTapAction({ ...readyParty, partyId: PARTY_ID.toUpperCase() })).toEqual({
      kind: "open-party",
      partyId: PARTY_ID,
      screen: "chat",
    });
  });

  it("never opens a 1:1 chat for a party push, whatever match id rides along", () => {
    for (const category of PARTY_CATEGORIES) {
      // No party id: nothing to route to, and the match id does not step in.
      expect(notificationTapAction({ ...readyParty, category, partyId: undefined, matchId: MATCH_ID })).toEqual({
        kind: "ignore",
      });
      const routed = notificationTapAction({ ...readyParty, category, matchId: MATCH_ID });
      expect(routed.kind).not.toBe("open-chat");
      expect(routed.kind).not.toBe("ignore");
    }
  });

  it("does not let a party id turn a chat push into a party", () => {
    expect(notificationTapAction({ ...readyMessage, partyId: PARTY_ID })).toEqual(OPEN_CHAT);
    expect(notificationTapAction({ ...readyMessage, matchId: undefined, partyId: PARTY_ID })).toEqual({
      kind: "ignore",
    });
  });

  it("does not treat a lookalike category as a party push", () => {
    for (const category of ["party-message", "Party_Message", "party_messages", "party", "party_"]) {
      expect(notificationTapAction({ ...readyParty, category })).toEqual({ kind: "ignore" });
    }
  });

  it("holds and drops a party tap exactly where it holds and drops a chat tap", () => {
    for (const category of PARTY_CATEGORIES) {
      const tap = { ...readyParty, category };
      expect(notificationTapAction({ ...tap, navigatorReady: false })).toEqual({ kind: "wait" });
      expect(notificationTapAction({ ...tap, sessionStatus: "loading" })).toEqual({ kind: "wait" });
      expect(notificationTapAction({ ...tap, onboardingCompleted: undefined })).toEqual({ kind: "wait" });
      for (const profileStatus of ["unknown", "error"] as const) {
        expect(notificationTapAction({ ...tap, profileStatus, onboardingCompleted: undefined })).toEqual({
          kind: "wait",
        });
      }
      expect(notificationTapAction({ ...tap, sessionStatus: "signed_out" })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...tap, profileStatus: "missing", onboardingCompleted: undefined })).toEqual({
        kind: "ignore",
      });
      expect(notificationTapAction({ ...tap, onboardingCompleted: false })).toEqual({ kind: "ignore" });
    }
  });
});

describe("partyNotificationOf", () => {
  it("reads each party push's category and lowercased party", () => {
    for (const category of PARTY_CATEGORIES) {
      expect(partyNotificationOf(category, PARTY_ID.toUpperCase())).toEqual({ category, partyId: PARTY_ID });
    }
  });

  it("is null for anything that is not a party push naming a party", () => {
    expect(partyNotificationOf("new_message", PARTY_ID)).toBeNull();
    expect(partyNotificationOf(undefined, PARTY_ID)).toBeNull();
    expect(partyNotificationOf("party_message", undefined)).toBeNull();
    expect(partyNotificationOf("party_message", "not-a-uuid")).toBeNull();
    expect(partyNotificationOf(["party_message"], PARTY_ID)).toBeNull();
  });
});

describe("shouldHandleTap", () => {
  it("handles a tap it has not seen", () => {
    expect(shouldHandleTap("abc", new Set())).toBe(true);
  });

  it("refuses a tap it already acted on", () => {
    // The killed-app case: getLastNotificationResponseAsync() and the live listener both
    // report the tap that relaunched the app.
    expect(shouldHandleTap("abc", new Set(["abc"]))).toBe(false);
  });

  it("does not confuse two different taps", () => {
    expect(shouldHandleTap("def", new Set(["abc"]))).toBe(true);
  });

  it("handles a tap with no identifier rather than dropping it", () => {
    // An unidentifiable tap is rarer than a dropped one, and dropping it breaks the only
    // thing the notification promised.
    expect(shouldHandleTap(undefined, new Set(["abc"]))).toBe(true);
    expect(shouldHandleTap("", new Set())).toBe(true);
  });
});

// The shape `getRootState()` returns in this app: expo-router's `__root` slot, with the app's
// Stack (app/_layout.tsx) inside it.
type Route = NavigationStateLike["routes"][number];
const TAB_ORDER = ["index", "matches", "profile", "settings"];

function app(...stack: Route[]): NavigationStateLike {
  return { index: 0, routes: [{ name: "__root", state: { index: stack.length - 1, routes: stack } }] };
}
function tabs(tab: string): Route {
  return { name: "(tabs)", state: { index: TAB_ORDER.indexOf(tab), routes: TAB_ORDER.map((name) => ({ name })) } };
}
function chat(matchId: string): Route {
  return { name: "chat/[matchId]", params: { matchId } };
}
function party(partyId: string, screen: "deck" | "chat"): Route {
  return { name: screen === "deck" ? "party/[partyId]/index" : "party/[partyId]/chat", params: { partyId } };
}

describe("frontScreen", () => {
  it("reads the tab bar and which tab it shows", () => {
    expect(frontScreen(app(tabs("index")))).toEqual({ kind: "tabs", tab: "index" });
    expect(frontScreen(app(tabs("matches")))).toEqual({ kind: "tabs", tab: "matches" });
  });

  it("reads a chat on top of the tabs, with its match", () => {
    expect(frontScreen(app(tabs("matches"), chat(MATCH_ID)))).toEqual({ kind: "chat", matchId: MATCH_ID });
  });

  it("reads only the screen in front, not one further down", () => {
    // A profile modal over a chat: the chat is not what they are looking at.
    expect(frontScreen(app(tabs("matches"), chat(MATCH_ID), { name: "profile/[profileId]" }))).toEqual({
      kind: "other",
    });
    expect(frontScreen(app(tabs("index"), { name: "filters" }))).toEqual({ kind: "other" });
  });

  it("calls anything else on the Stack other, including a nested group's screen", () => {
    expect(frontScreen(app({ name: "welcome" }))).toEqual({ kind: "other" });
    expect(frontScreen(app({ name: "settings/notifications" }))).toEqual({ kind: "other" });
    expect(frontScreen(app({ name: "(onboarding)", state: { index: 0, routes: [{ name: "games" }] } }))).toEqual({
      kind: "other",
    });
  });

  it("answers other when there is no state to read", () => {
    expect(frontScreen(undefined)).toEqual({ kind: "other" });
    expect(frontScreen({ index: 0, routes: [] })).toEqual({ kind: "other" });
    expect(frontScreen({ index: 0, routes: [{ name: "__root" }] })).toEqual({ kind: "other" });
  });

  it("does not invent a match id for a chat route without a usable one", () => {
    expect(frontScreen(app(tabs("matches"), { name: "chat/[matchId]" }))).toEqual({ kind: "chat", matchId: undefined });
    expect(frontScreen(app(tabs("matches"), { name: "chat/[matchId]", params: { matchId: 7 } }))).toEqual({
      kind: "chat",
      matchId: undefined,
    });
  });

  it("reads a party's deck or chat in front, with its party", () => {
    expect(frontScreen(app(tabs("matches"), party(PARTY_ID, "deck")))).toEqual({
      kind: "party",
      partyId: PARTY_ID,
      screen: "deck",
    });
    expect(frontScreen(app(tabs("matches"), party(PARTY_ID, "deck"), party(PARTY_ID, "chat")))).toEqual({
      kind: "party",
      partyId: PARTY_ID,
      screen: "chat",
    });
  });

  it("does not invent a party id for a party route without a usable one", () => {
    expect(frontScreen(app(tabs("matches"), { name: "party/[partyId]/index" }))).toEqual({
      kind: "party",
      partyId: undefined,
      screen: "deck",
    });
    expect(frontScreen(app(tabs("matches"), { name: "party/[partyId]/chat", params: { partyId: 7 } }))).toEqual({
      kind: "party",
      partyId: undefined,
      screen: "chat",
    });
  });

  it("reads a tab bar whose own state has not been built yet", () => {
    expect(frontScreen(app({ name: "(tabs)" }))).toEqual({ kind: "tabs", tab: undefined });
  });

  it("focuses the last route of a partial state with no index", () => {
    const partial: NavigationStateLike = {
      routes: [{ name: "__root", state: { routes: [tabs("matches"), chat(MATCH_ID)] } }],
    };
    expect(frontScreen(partial)).toEqual({ kind: "chat", matchId: MATCH_ID });
  });

  it("reads the auth gate in front, as on a cold start before its redirect lands", () => {
    // app/index.tsx is the Stack's first screen on every launch, and the only route that is in
    // front at the moment a cold-start tap is decided.
    expect(frontScreen(app({ name: "index" }))).toEqual({ kind: "gate" });
    const partial: NavigationStateLike = { routes: [{ name: "__root", state: { routes: [{ name: "index" }] } }] };
    expect(frontScreen(partial)).toEqual({ kind: "gate" });
    // The gate pushed back on top, as the (auth) layout's Redirect to "/" does after sign-in.
    expect(frontScreen(app(tabs("matches"), { name: "index" }))).toEqual({ kind: "gate" });
  });

  it("reads the gate in a Stack with no __root slot above it", () => {
    expect(frontScreen({ index: 0, routes: [{ name: "index" }] })).toEqual({ kind: "gate" });
  });

  it("does not take the deck tab, or an index deeper down, for the gate", () => {
    // The deck tab is also called "index"; the walk stops at the tab bar before reaching it.
    expect(frontScreen(app(tabs("index")))).toEqual({ kind: "tabs", tab: "index" });
    // An index screen inside some group's own navigator is that group's, not the gate.
    expect(frontScreen(app({ name: "(auth)", state: { index: 0, routes: [{ name: "index" }] } }))).toEqual({
      kind: "other",
    });
  });
});

describe("isOnMatches", () => {
  it("is true only for the tab bar showing Matches", () => {
    expect(isOnMatches({ kind: "tabs", tab: "matches" })).toBe(true);
    for (const front of [
      { kind: "tabs", tab: "index" },
      { kind: "tabs", tab: undefined },
      { kind: "chat", matchId: MATCH_ID },
      { kind: "party", partyId: PARTY_ID, screen: "deck" },
      { kind: "gate" },
      { kind: "other" },
    ] as const) {
      expect(isOnMatches(front)).toBe(false);
    }
  });
});

describe("partyOpening", () => {
  const deck: FrontScreen = { kind: "party", partyId: PARTY_ID, screen: "deck" };
  const partyChat: FrontScreen = { kind: "party", partyId: PARTY_ID, screen: "chat" };

  it("leaves the party alone when the screen the tap wants is already in front", () => {
    expect(partyOpening(deck, PARTY_ID, "deck")).toBe("already-open");
    expect(partyOpening(partyChat, PARTY_ID, "chat")).toBe("already-open");
  });

  it("leaves somebody in the party's chat there for a tap bound for its deck", () => {
    // Party started or joined: the chat is deeper into the same party than the deck, and a full
    // party's deck is only a button back into the chat.
    expect(partyOpening(partyChat, PARTY_ID, "deck")).toBe("already-open");
  });

  it("goes by way of Matches from the party's deck to its chat", () => {
    // Back from the chat then lands on Matches, as for a party chat opened from Your parties.
    expect(partyOpening(deck, PARTY_ID, "chat")).toBe("dismiss-to-matches");
  });

  it("dismisses another party's screen rather than pushing over it", () => {
    expect(partyOpening({ ...deck, partyId: OTHER_PARTY_ID }, PARTY_ID, "deck")).toBe("dismiss-to-matches");
    expect(partyOpening({ ...partyChat, partyId: OTHER_PARTY_ID }, PARTY_ID, "chat")).toBe("dismiss-to-matches");
    expect(partyOpening({ ...partyChat, partyId: undefined }, PARTY_ID, "chat")).toBe("dismiss-to-matches");
  });

  it("dismisses a 1:1 chat, even one whose id happens to equal the party's", () => {
    expect(partyOpening({ kind: "chat", matchId: PARTY_ID }, PARTY_ID, "chat")).toBe("dismiss-to-matches");
    expect(partyOpening({ kind: "other" }, PARTY_ID, "deck")).toBe("dismiss-to-matches");
  });

  it("switches tabs when the tab bar is in front, and waits out the gate", () => {
    for (const tab of [...TAB_ORDER, undefined]) {
      expect(partyOpening({ kind: "tabs", tab }, PARTY_ID, "chat")).toBe("switch-to-matches");
    }
    expect(partyOpening({ kind: "gate" }, PARTY_ID, "deck")).toBe("wait-for-gate");
  });
});

describe("matchesOpening", () => {
  it("moves nothing when Matches is already in front", () => {
    expect(matchesOpening({ kind: "tabs", tab: "matches" })).toBe("already-open");
  });

  it("switches from another tab and dismisses anything on top of the tabs", () => {
    for (const tab of ["index", "profile", "settings", undefined]) {
      expect(matchesOpening({ kind: "tabs", tab })).toBe("switch-to-matches");
    }
    for (const front of [
      { kind: "chat", matchId: MATCH_ID },
      { kind: "party", partyId: PARTY_ID, screen: "chat" },
      { kind: "other" },
    ] as const) {
      expect(matchesOpening(front)).toBe("dismiss-to-matches");
    }
  });

  it("waits out the auth gate like every other tap", () => {
    expect(matchesOpening({ kind: "gate" })).toBe("wait-for-gate");
  });
});

describe("chatOpening", () => {
  it("leaves the chat alone when it is already open", () => {
    // Pushing it again would stack a second copy, and the back button would land on the first.
    expect(chatOpening({ kind: "chat", matchId: MATCH_ID }, MATCH_ID)).toBe("already-open");
  });

  it("switches tabs when the tab bar is in front, whichever tab it shows", () => {
    for (const tab of [...TAB_ORDER, undefined]) {
      expect(chatOpening({ kind: "tabs", tab }, MATCH_ID)).toBe("switch-to-matches");
    }
  });

  it("dismisses another chat rather than pushing over it", () => {
    // Over it, the back button would lead into the OTHER chat; dismissing first keeps the
    // stack to Matches and one chat however many pushes get tapped.
    expect(chatOpening({ kind: "chat", matchId: OTHER_MATCH_ID }, MATCH_ID)).toBe("dismiss-to-matches");
    expect(chatOpening({ kind: "chat", matchId: undefined }, MATCH_ID)).toBe("dismiss-to-matches");
  });

  it("dismisses whatever else is on top of the tabs", () => {
    expect(chatOpening({ kind: "other" }, MATCH_ID)).toBe("dismiss-to-matches");
  });

  it("waits for the auth gate's own redirect instead of moving under it", () => {
    // The gate's Redirect issues its replace a render after the cold-start tap is decided, so it
    // is queued behind a dismissTo made now, runs second, and puts the user back on the Deck.
    expect(chatOpening({ kind: "gate" }, MATCH_ID)).toBe("wait-for-gate");
  });

  it("goes on as warm once the redirect has landed on the tabs", () => {
    expect(chatOpening(frontScreen(app(tabs("index"))), MATCH_ID)).toBe("switch-to-matches");
    expect(chatOpening(frontScreen(app({ name: "(tabs)" })), MATCH_ID)).toBe("switch-to-matches");
  });
});

describe("chatPush", () => {
  const onMatches: FrontScreen = { kind: "tabs", tab: "matches" };

  it("pushes the chat once the list confirms the match", () => {
    expect(chatPush({ superseded: false, matchListed: true, front: onMatches })).toBe("push");
  });

  it("stays on Matches when the match is gone since the push was sent", () => {
    // Unmatched, blocked, or a push for whoever was signed in before. The chat screen would
    // draw "Chat" and a composer that cannot send; Matches without them in it is the truth.
    expect(chatPush({ superseded: false, matchListed: false, front: onMatches })).toBe("gone");
  });

  it("still pushes when the list could not be read", () => {
    // Unknown is what the hook passes for a failed read, for a tap while offline (the read is
    // never sent, since TanStack would hold it until the network returned) and for a read that
    // missed the deadline. None of them says anything about the match, and the chat screen
    // behaves as it does when opened from the list on a bad network.
    expect(chatPush({ superseded: false, matchListed: undefined, front: onMatches })).toBe("push");
  });

  it("stands down when a later tap has been handled", () => {
    for (const matchListed of [true, false, undefined]) {
      expect(chatPush({ superseded: true, matchListed, front: onMatches })).toBe("stand-down");
    }
  });

  it("stands down when the user has moved on while the list loaded", () => {
    // Opened this very chat from the list themselves, opened another one, switched tabs, or
    // opened a modal. In every case pushing now would land on top of their choice.
    const movedOn: FrontScreen[] = [
      { kind: "chat", matchId: MATCH_ID },
      { kind: "chat", matchId: OTHER_MATCH_ID },
      { kind: "tabs", tab: "index" },
      { kind: "tabs", tab: undefined },
      { kind: "gate" },
      { kind: "other" },
    ];
    for (const front of movedOn) {
      expect(chatPush({ superseded: false, matchListed: true, front })).toBe("stand-down");
      expect(chatPush({ superseded: false, matchListed: false, front })).toBe("stand-down");
    }
  });
});

describe("partyPush", () => {
  const onMatches: FrontScreen = { kind: "tabs", tab: "matches" };

  it("pushes the party once the list confirms it, or cannot say", () => {
    expect(partyPush({ superseded: false, partyListed: true, front: onMatches })).toBe("push");
    expect(partyPush({ superseded: false, partyListed: undefined, front: onMatches })).toBe("push");
  });

  it("stays on Matches when the party is not this account's any more", () => {
    expect(partyPush({ superseded: false, partyListed: false, front: onMatches })).toBe("gone");
  });

  it("stands down when superseded or when the user has moved on", () => {
    for (const partyListed of [true, false, undefined]) {
      expect(partyPush({ superseded: true, partyListed, front: onMatches })).toBe("stand-down");
    }
    for (const front of [
      { kind: "party", partyId: PARTY_ID, screen: "chat" },
      { kind: "tabs", tab: "index" },
      { kind: "other" },
    ] as const) {
      expect(partyPush({ superseded: false, partyListed: true, front })).toBe("stand-down");
    }
  });
});

/** A navigation container the tests drive by hand: `go` replaces the state and reports a change. */
function fakeNavigation(initial: NavigationStateLike) {
  let state = initial;
  const listeners = new Set<() => void>();
  const nav: NavigationReader = {
    front: () => frontScreen(state),
    onChange: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  return {
    nav,
    go(next: NavigationStateLike) {
      state = next;
      for (const listener of [...listeners]) listener();
    },
    listening: () => listeners.size,
  };
}

const notGate = (front: FrontScreen) => front.kind !== "gate";

describe("whenFront", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("goes at once, without listening, when the screen is already there", () => {
    const { nav, listening } = fakeNavigation(app(tabs("index")));
    const then = vi.fn();
    whenFront(nav, notGate, then, 5000);
    expect(then).toHaveBeenCalledExactlyOnceWith({ kind: "tabs", tab: "index" });
    expect(listening()).toBe(0);
  });

  it("waits out the auth gate on a cold start, and goes once its redirect lands on the tabs", () => {
    // The whole cold-start fix: nothing moves while the gate is in front, because the gate's
    // own replace would be queued behind it and undo it.
    const { nav, go, listening } = fakeNavigation(app({ name: "index" }));
    const then = vi.fn();
    whenFront(nav, notGate, then, 5000);
    expect(then).not.toHaveBeenCalled();
    expect(listening()).toBe(1);

    // A change that leaves the gate in front (its own params settling, say) is not the one.
    go(app({ name: "index" }));
    expect(then).not.toHaveBeenCalled();

    go(app(tabs("index")));
    expect(then).toHaveBeenCalledExactlyOnceWith({ kind: "tabs", tab: "index" });
    expect(listening()).toBe(0);

    // Later navigation is none of its business.
    go(app(tabs("matches")));
    expect(then).toHaveBeenCalledOnce();
  });

  it("waits for a first move to land, reading the latest state on each change", () => {
    const { nav, go } = fakeNavigation(app(tabs("index")));
    const then = vi.fn();
    whenFront(nav, isOnMatches, then, 5000);
    expect(then).not.toHaveBeenCalled();
    go(app(tabs("matches")));
    expect(then).toHaveBeenCalledExactlyOnceWith({ kind: "tabs", tab: "matches" });
  });

  it("gives up after the bound, so a screen that never comes leaves no listener behind", () => {
    // The gate went to sign-in or onboarding instead, or the user went somewhere else.
    const { nav, go, listening } = fakeNavigation(app({ name: "index" }));
    const then = vi.fn();
    whenFront(nav, notGate, then, 5000);
    vi.advanceTimersByTime(4999);
    expect(listening()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(listening()).toBe(0);
    go(app(tabs("index")));
    expect(then).not.toHaveBeenCalled();
  });

  it("stops when told to, as when a later tap is decided", () => {
    const { nav, go, listening } = fakeNavigation(app({ name: "index" }));
    const then = vi.fn();
    const stop = whenFront(nav, notGate, then, 5000);
    stop();
    expect(listening()).toBe(0);
    go(app(tabs("index")));
    vi.advanceTimersByTime(5000);
    expect(then).not.toHaveBeenCalled();
  });
});

describe("answerWithin", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A read the test answers by hand. */
  function manualRead() {
    let resolve: (listed: boolean) => void = () => undefined;
    let reject: (error: Error) => void = () => undefined;
    const read = new Promise<boolean>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { read, resolve, reject };
  }

  it("passes on the list's answer when it comes in time", async () => {
    for (const listed of [true, false]) {
      const { read, resolve } = manualRead();
      const decide = vi.fn();
      answerWithin(read, 4000, decide);
      resolve(listed);
      await read;
      expect(decide).toHaveBeenCalledExactlyOnceWith(listed);
      vi.advanceTimersByTime(4000);
      expect(decide).toHaveBeenCalledOnce();
    }
  });

  it("answers unknown when the read fails", async () => {
    const { read, reject } = manualRead();
    const decide = vi.fn();
    answerWithin(read, 4000, decide);
    reject(new Error("network"));
    await read.catch(() => undefined);
    expect(decide).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("answers unknown at the deadline, and ignores an answer that comes after it", async () => {
    // A read TanStack paused, or one crawling through the list's own retries. Answering minutes
    // later would push the chat into whatever the user was doing by then.
    const { read, resolve } = manualRead();
    const decide = vi.fn();
    answerWithin(read, 4000, decide);
    vi.advanceTimersByTime(3999);
    expect(decide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(decide).toHaveBeenCalledExactlyOnceWith(undefined);
    resolve(false);
    await read;
    expect(decide).toHaveBeenCalledOnce();
  });

  it("decides nothing once stopped", async () => {
    const { read, resolve } = manualRead();
    const decide = vi.fn();
    const stop = answerWithin(read, 4000, decide);
    stop();
    resolve(true);
    await read;
    vi.advanceTimersByTime(4000);
    expect(decide).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
// Duo Pops (1.0.2): a duo_pop push opens the Pop card; a new_match push for a grabbed pop opens
// the sender's DUO LOCKED with its popped-in time.
// ---------------------------------------------------------------------------------------------

const POP_ID = "6a2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

/** A tapped Duo Pop push at a settled app. */
const readyPop: NotificationTapInput = { ...ready, category: "duo_pop", popId: POP_ID };

/** A tapped "Duo locked" push (the new_match enrichment for a grabbed pop), at a settled app. */
const readyLock: NotificationTapInput = {
  ...ready,
  category: "new_match",
  matchId: MATCH_ID,
  popId: POP_ID,
  poppedIn: "41",
  duo: "1",
};

describe("notificationTapAction: Duo Pop pushes", () => {
  it("opens the pop a duo_pop push names", () => {
    expect(notificationTapAction(readyPop)).toEqual({ kind: "open-pop", popId: POP_ID });
  });

  it("lowercases the pop id", () => {
    expect(notificationTapAction({ ...readyPop, popId: POP_ID.toUpperCase() })).toEqual({
      kind: "open-pop",
      popId: POP_ID,
    });
  });

  it("ignores a missing or malformed pop id", () => {
    for (const popId of [undefined, null, "", "not-a-uuid", `${POP_ID}x`, 42, { popId: POP_ID }, [POP_ID]]) {
      expect(notificationTapAction({ ...readyPop, popId })).toEqual({ kind: "ignore" });
    }
  });

  it("reads the category exactly: the settings column's name is not a push category", () => {
    for (const category of ["queue_pop", "DUO_POP", "duo-pop", "duo_pops"]) {
      expect(notificationTapAction({ ...readyPop, category })).toEqual({ kind: "ignore" });
    }
  });

  it("waits while loading and before the navigator, like every other tap", () => {
    for (const tap of [readyPop, readyLock]) {
      expect(notificationTapAction({ ...tap, navigatorReady: false })).toEqual({ kind: "wait" });
      expect(notificationTapAction({ ...tap, sessionStatus: "loading" })).toEqual({ kind: "wait" });
      expect(notificationTapAction({ ...tap, onboardingCompleted: undefined })).toEqual({ kind: "wait" });
    }
  });

  it("is dropped signed out, mid-onboarding and with no profile row", () => {
    for (const tap of [readyPop, readyLock]) {
      expect(notificationTapAction({ ...tap, sessionStatus: "signed_out" })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...tap, onboardingCompleted: false })).toEqual({ kind: "ignore" });
      expect(notificationTapAction({ ...tap, profileStatus: "missing", onboardingCompleted: undefined })).toEqual({
        kind: "ignore",
      });
    }
  });

  it("opens the sender's DUO LOCKED for a grabbed pop's new_match push", () => {
    expect(notificationTapAction(readyLock)).toEqual({
      kind: "open-duo-locked",
      matchId: MATCH_ID,
      popId: POP_ID,
      poppedInSeconds: 41,
      canDuo: true,
    });
    expect(notificationTapAction({ ...readyLock, duo: undefined })).toMatchObject({ canDuo: false });
    expect(notificationTapAction({ ...readyLock, duo: "0" })).toMatchObject({ canDuo: false });
    expect(
      notificationTapAction({ ...readyLock, matchId: MATCH_ID.toUpperCase(), popId: POP_ID.toUpperCase() }),
    ).toMatchObject({ matchId: MATCH_ID, popId: POP_ID });
  });

  it("falls back to the chat when the popped-in time or the pop id is not usable", () => {
    for (const poppedIn of ["0", "601", "x", "4.1", "", undefined, null]) {
      expect(notificationTapAction({ ...readyLock, poppedIn })).toEqual(OPEN_CHAT);
    }
    for (const popId of [undefined, "not-a-uuid"]) {
      expect(notificationTapAction({ ...readyLock, popId })).toEqual(OPEN_CHAT);
    }
  });

  it("only new_match carries a lock: a message push with pop fields is still a chat", () => {
    expect(notificationTapAction({ ...readyLock, category: "new_message" })).toEqual(OPEN_CHAT);
    expect(notificationTapAction({ ...readyLock, category: "nudge_unread" })).toEqual(OPEN_CHAT);
  });

  it("leaves every other case exactly as it was", () => {
    // The fields are optional, so every existing call (and every older push) reads the same.
    expect(notificationTapAction(ready)).toEqual({ kind: "open-deck" });
    expect(notificationTapAction(readyMessage)).toEqual(OPEN_CHAT);
    expect(notificationTapAction({ ...readyMessage, category: "new_match" })).toEqual(OPEN_CHAT);
    expect(notificationTapAction({ ...ready, category: "announcement" })).toEqual({ kind: "ignore" });
    expect(notificationTapAction({ ...ready, category: "nudge_online", popId: POP_ID })).toEqual({ kind: "ignore" });
  });
});

describe("duoPopNotificationOf and duoLockedNotificationOf", () => {
  it("read a push the way a tap does", () => {
    expect(duoPopNotificationOf("duo_pop", POP_ID.toUpperCase())).toEqual({ popId: POP_ID });
    expect(duoPopNotificationOf("duo_pop", "nope")).toBeNull();
    expect(duoPopNotificationOf("new_match", POP_ID)).toBeNull();

    expect(duoLockedNotificationOf("new_match", MATCH_ID, POP_ID, "41", "1")).toEqual({
      matchId: MATCH_ID,
      popId: POP_ID,
      poppedInSeconds: 41,
      canDuo: true,
    });
    expect(duoLockedNotificationOf("new_match", MATCH_ID, POP_ID, 41, undefined)).toMatchObject({
      poppedInSeconds: 41,
      canDuo: false,
    });
    expect(duoLockedNotificationOf("new_match", MATCH_ID, POP_ID, "601", "1")).toBeNull();
    expect(duoLockedNotificationOf("new_match", MATCH_ID, undefined, "41", "1")).toBeNull();
    expect(duoLockedNotificationOf("new_match", "nope", POP_ID, "41", "1")).toBeNull();
    expect(duoLockedNotificationOf("duo_pop", MATCH_ID, POP_ID, "41", "1")).toBeNull();
  });
});

describe("frontScreen and popOpening for the Pop card", () => {
  function pop(popId: unknown): Route {
    return { name: "pop/[popId]", params: { popId } };
  }

  it("reads the Pop card in front, with its pop", () => {
    expect(frontScreen(app(tabs("index"), pop(POP_ID)))).toEqual({ kind: "pop", popId: POP_ID });
    expect(frontScreen(app(tabs("index"), pop(7)))).toEqual({ kind: "pop", popId: undefined });
  });

  it("pushes the card over whatever is in front, without a detour", () => {
    expect(popOpening({ kind: "tabs", tab: "index" }, POP_ID)).toBe("push");
    expect(popOpening({ kind: "chat", matchId: MATCH_ID }, POP_ID)).toBe("push");
    expect(popOpening({ kind: "other" }, POP_ID)).toBe("push");
    expect(popOpening({ kind: "pop", popId: "a1b2c3d4-e5f6-4a7b-9c8d-0e1f2a3b4c5d" }, POP_ID)).toBe("push");
  });

  it("never stacks a second copy of the same pop", () => {
    expect(popOpening({ kind: "pop", popId: POP_ID }, POP_ID)).toBe("already-open");
    expect(popOpening({ kind: "pop", popId: POP_ID.toUpperCase() }, POP_ID)).toBe("already-open");
  });

  it("waits for the auth gate's redirect on a cold start", () => {
    expect(popOpening({ kind: "gate" }, POP_ID)).toBe("wait-for-gate");
  });

  it("is dismissed like any other modal when a chat tap comes in", () => {
    expect(chatOpening({ kind: "pop", popId: POP_ID }, MATCH_ID)).toBe("dismiss-to-matches");
  });
});
