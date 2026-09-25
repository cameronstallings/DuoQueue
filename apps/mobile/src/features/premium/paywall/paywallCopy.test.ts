import { describe, expect, it } from "vitest";

import { PLATFORM_LABELS, PLAYSTYLE_LABELS, SKILL_LABELS } from "../../onboarding/profile-labels";
import {
  CONTINUE_FREE,
  DECK_COPY,
  FILTER_ANY,
  FREE_ACTIVE_CONVERSATIONS,
  FREE_REQUESTS_PER_DAY,
  LEGAL_LINKS,
  PAYWALL_FROM,
  PEOPLE_EXTRAS,
  PLANS_HEADING,
  PLANS_UNAVAILABLE,
  POWER_UP_BOUGHT,
  POWER_UP_COPY,
  REQUESTS_COPY,
  SUBSCRIBER_BODY,
  deckIllustrationLabel,
  deckPageHeading,
  filterPreviewRows,
  hiddenCountLabel,
  parsePaywallFrom,
  paywallHref,
  paywallPageOrder,
  peoplePageHeading,
  peoplePanelOrder,
  powerUpButtonLabel,
  powerUpTitle,
  purchaseAlert,
  requestLine,
  requestsIllustrationLabel,
  requestsState,
  restoreAlert,
  type RequestGameRow,
} from "./paywallCopy";

const LABELS = { skill: SKILL_LABELS, platform: PLATFORM_LABELS, playstyle: PLAYSTYLE_LABELS };

describe("from", () => {
  it("parses every entry point and defaults to Settings", () => {
    expect(parsePaywallFrom("limit")).toBe("limit");
    expect(parsePaywallFrom(["chat", "x"])).toBe("chat");
    expect(parsePaywallFrom(undefined)).toBe("settings");
    expect(parsePaywallFrom("nonsense")).toBe("settings");
  });

  it("builds the route every entry point pushes", () => {
    expect(paywallHref("limit")).toEqual({ pathname: "/paywall", params: { from: "limit" } });
  });
});

describe("paywallPageOrder", () => {
  it("always ends on the plans", () => {
    for (const from of PAYWALL_FROM) expect(paywallPageOrder(from).at(-1)).toBe("plans");
  });

  it("puts People first for requests, Super Ping and chat, and the Deck first otherwise", () => {
    expect(paywallPageOrder("requests")).toEqual(["people", "deck", "plans"]);
    expect(paywallPageOrder("superping")).toEqual(["people", "deck", "plans"]);
    expect(paywallPageOrder("chat")).toEqual(["people", "deck", "plans"]);
    for (const from of ["settings", "limit", "filters", "powerup"] as const) {
      expect(paywallPageOrder(from)).toEqual(["deck", "people", "plans"]);
    }
  });
});

describe("deckPageHeading", () => {
  it("is the default from Settings, and for entries whose page one is People", () => {
    const settings = {
      label: "Your deck",
      title: "Keep swiping.\nChoose who shows up.",
      body: "Free stops at 25 swipes a day. DuoQueue+ has no daily limit, and filters that fill your deck with players you'd actually queue with.",
    };
    expect(deckPageHeading("settings", 25)).toEqual(settings);
    expect(deckPageHeading("chat", 25)).toEqual(settings);
  });

  it("says the player is out of swipes, from the real limit", () => {
    expect(deckPageHeading("limit", 25)).toEqual({
      label: "25 of 25 swipes used",
      title: "Out of swipes\nfor today.",
      body: "Free swipes come back tomorrow. DuoQueue+ has no daily limit, and filters that fill your deck with players you'd actually queue with.",
    });
  });

  it("leads with filters from Filters and with the Power-Up from the Power-Up button", () => {
    expect(deckPageHeading("filters", 25).title).toBe("Choose who\nshows up.");
    expect(deckPageHeading("filters", 25).body).toBe(
      "Filter by game or show, platform, skill level, playstyle and recent activity, and swipe with no daily limit.",
    );
    expect(deckPageHeading("powerup", 25).title).toBe("Out of\nPower-Ups.");
  });
});

describe("peoplePageHeading", () => {
  it("counts the real requests only when there are more than Free shows", () => {
    expect(peoplePageHeading("settings", 12).title).toBe("12 players want to duo with you.");
    expect(peoplePageHeading("requests", 3).title).toBe("See everyone who wants to duo.");
    expect(peoplePageHeading("requests", 0).title).toBe("See everyone who wants to duo.");
  });

  it("sells the conversations benefit in the default body", () => {
    expect(peoplePageHeading("settings", 0).body).toBe(
      "Free shows you 3 a day. DuoQueue+ shows all of them now, adds a daily Super Ping, and keeps every conversation open.",
    );
  });

  it("leads with Super Ping or conversations when that is why the player came", () => {
    expect(peoplePageHeading("superping", 5).title).toBe("Send a Super Ping\nevery day.");
    const chat = peoplePageHeading("chat", 5);
    expect(chat.title).toBe("Keep every\nconversation open.");
    expect(chat.body).toContain("The conversation you opened is locked.");
    // The rule is the Conversations panel's, directly below: never the same sentence twice.
    expect(chat.body).not.toContain("most recently active");
    expect(PEOPLE_EXTRAS.conversationsBody).toContain(`your ${FREE_ACTIVE_CONVERSATIONS} most recently active matches`);
  });

  it("orders the People panels by the same reason", () => {
    expect(peoplePanelOrder("chat")).toEqual(["conversations", "requests", "superPing"]);
    expect(peoplePanelOrder("superping")).toEqual(["superPing", "requests", "conversations"]);
    expect(peoplePanelOrder("settings")).toEqual(["requests", "superPing", "conversations"]);
  });
});

describe("requestsState", () => {
  it("draws the state the data is in, never the one that sells better", () => {
    expect(requestsState(0, 0)).toEqual({ kind: "none" });
    expect(requestsState(3, 3)).toEqual({ kind: "allShown" });
    expect(requestsState(2, 3)).toEqual({ kind: "allShown" });
    expect(requestsState(12, 3)).toEqual({ kind: "hidden", hidden: 9 });
    expect(hiddenCountLabel(9)).toBe("9 more");
  });

  it("summarises the panel for VoiceOver", () => {
    expect(requestsIllustrationLabel({ kind: "hidden", hidden: 9 }, 3)).toBe(
      "3 requests you can see today, and 9 more with DuoQueue+.",
    );
    expect(requestsIllustrationLabel({ kind: "allShown" }, 1)).toBe(
      "1 request today, all shown. Anyone past 3 a day shows here with DuoQueue+.",
    );
    expect(requestsIllustrationLabel({ kind: "none" }, 0)).toBe(REQUESTS_COPY.none);
  });
});

describe("filterPreviewRows", () => {
  it("prefills the DuoQueue+ filters from the player's own profile", () => {
    const rows = filterPreviewRows(
      { games: [{ name: "League of Legends", skillLevel: "competitive" }], platforms: ["pc"], playstyles: ["mic_required"] },
      LABELS,
    );
    expect(rows.map((r) => [r.key, r.label, r.value])).toEqual([
      ["game", "Game", "League of Legends"],
      ["platform", "Platform", "PC"],
      ["skill", "Skill level", "Competitive"],
      ["playstyle", "Playstyle", "Mic required"],
      ["active", "Recently active only", "On"],
    ]);
  });

  it("leaves a row empty (drawn as Any) when the profile has nothing for it", () => {
    expect(filterPreviewRows(undefined, LABELS).map((r) => r.value)).toEqual([null, null, null, null, "On"]);
  });
});

describe("requestLine", () => {
  const rows: RequestGameRow[] = [
    { profile_id: "p1", game_id: "valorant", game_name: "Valorant", rank_text: "Gold 2", priority: 0 },
    { profile_id: "p1", game_id: "lol", game_name: "League of Legends", rank_text: "Gold II", priority: 1 },
    { profile_id: "p2", game_id: "valorant", game_name: "Valorant", rank_text: null, priority: 0 },
    { profile_id: "p3", game_id: "lol", game_name: "League of Legends", rank_text: "hardstuck plat", priority: 0 },
  ];

  it("says a showable League rank first", () => {
    expect(requestLine("p1", rows, "lol", "NA East")).toBe("League of Legends · Gold II");
  });

  it("otherwise says the main game, never a free-text rank", () => {
    expect(requestLine("p2", rows, "lol", "NA East")).toBe("Valorant");
    expect(requestLine("p3", rows, "lol", "NA East")).toBe("League of Legends");
    expect(requestLine("p1", rows, null, "NA East")).toBe("Valorant");
  });

  it("falls back to the region, never an age", () => {
    expect(requestLine("p4", rows, "lol", "NA East")).toBe("NA East");
  });
});

describe("alerts and small copy", () => {
  it("tells Restored apart from Nothing to restore", () => {
    expect(restoreAlert(true)).toEqual({ title: "Restored", message: "DuoQueue+ is active again." });
    expect(restoreAlert(false)).toEqual({
      title: "Nothing to restore",
      message: "This Apple Account has no DuoQueue+ purchase to restore.",
    });
  });

  it("says whether the purchase is already active", () => {
    expect(purchaseAlert(true).title).toBe("You're on DuoQueue+");
    expect(purchaseAlert(false).title).toBe("Purchase complete");
  });

  it("marks the Power-Up as a one-time purchase", () => {
    expect(powerUpTitle(0)).toBe("Power-Up · 0 left");
    expect(POWER_UP_COPY.description).toBe(
      "30 minutes near the top of other players' decks. One-time purchase, not a subscription.",
    );
    expect(powerUpButtonLabel("$3.99")).toBe("Buy a Power-Up for $3.99, a one-time purchase");
    expect(powerUpButtonLabel(null)).toBe("Power-Up not available");
  });

  it("summarises the Deck page for VoiceOver", () => {
    expect(deckIllustrationLabel(18, 25)).toBe(
      "Free: 18 of 25 swipes left today. DuoQueue+: unlimited swipes, and filters for game, platform, skill level, playstyle and recent activity.",
    );
    expect(DECK_COPY.left(0)).toBe("0 left");
  });
});

describe("the copy rules", () => {
  const pageOneAndTwo: string[] = [];
  for (const from of PAYWALL_FROM) {
    pageOneAndTwo.push(...Object.values(deckPageHeading(from, 25)), ...Object.values(peoplePageHeading(from, 12)));
  }
  pageOneAndTwo.push(
    ...Object.values(REQUESTS_COPY),
    ...Object.values(PEOPLE_EXTRAS),
    deckIllustrationLabel(18, 25),
    requestsIllustrationLabel({ kind: "hidden", hidden: 9 }, 3),
    DECK_COPY.swipesToday,
    DECK_COPY.filters,
    DECK_COPY.preview,
    DECK_COPY.free,
    DECK_COPY.withPlus,
    DECK_COPY.unlimited,
    DECK_COPY.left(18),
    hiddenCountLabel(9),
    FILTER_ANY,
  );
  const everything = [
    ...pageOneAndTwo,
    ...Object.values(PLANS_HEADING),
    ...Object.values(POWER_UP_BOUGHT),
    ...Object.values(LEGAL_LINKS),
    POWER_UP_COPY.description,
    PLANS_UNAVAILABLE,
    SUBSCRIBER_BODY,
    CONTINUE_FREE,
    ...[true, false].flatMap((active) => [
      ...Object.values(restoreAlert(active)),
      ...Object.values(purchaseAlert(active)),
    ]),
    powerUpTitle(2),
    powerUpButtonLabel("$3.99"),
    powerUpButtonLabel(null),
  ];

  it("names no price on pages 1 and 2", () => {
    for (const text of pageOneAndTwo) expect(text).not.toMatch(/\$\d/);
  });

  it("has no em or en dash and no dating cue", () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    for (const text of everything) {
      expect(text).not.toMatch(dashes);
      expect(text).not.toMatch(/swipe right/i);
      expect(text).not.toMatch(/interested in you/i);
    }
  });

  it("uses the free limits the server enforces", () => {
    expect([FREE_REQUESTS_PER_DAY, FREE_ACTIVE_CONVERSATIONS]).toEqual([3, 5]);
  });
});
