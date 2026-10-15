import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPushBatches,
  buildPushLogRow,
  type ExpoPushMessage,
  pushOptionFields,
  readTickets,
  safeErrorText,
  sendExpoPush,
  summarizePush,
  transportFailure,
} from "./expo-push";

const TOKEN = "ExponentPushToken[abc]";
const DEAD = "ExponentPushToken[dead]";
const RECIPIENT = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

function messages(...tokens: string[]): ExpoPushMessage[] {
  return tokens.map((to) => ({ to, title: "t", body: "b" }));
}

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

  it("passes a bundled sound's file name through, with its extension (the Duo Pop, 1.0.2)", () => {
    const [batch] = buildPushBatches([TOKEN], "Duo Pop", "b", { category: "duo_pop", popId: "p" }, {
      sound: "duo-pop.wav",
      ttl: 600,
      priority: "high",
    });
    expect(batch[0]).toEqual({
      to: TOKEN,
      title: "Duo Pop",
      body: "b",
      data: { category: "duo_pop", popId: "p" },
      sound: "duo-pop.wav",
      ttl: 600,
      priority: "high",
    });
  });

  it("leaves ttl and priority out unless they are given, so every other push is unchanged", () => {
    const [batch] = buildPushBatches([TOKEN], "t", "b", undefined, { sound: true });
    expect(Object.keys(batch[0]).sort()).toEqual(["body", "data", "sound", "title", "to"]);
    expect("ttl" in batch[0]).toBe(false);
    expect("priority" in batch[0]).toBe(false);
  });
});

describe("pushOptionFields", () => {
  it("sound: true is the system sound, exactly as before 1.0.2", () => {
    expect(pushOptionFields({ sound: true })).toEqual({ sound: "default" });
  });

  it("no sound for false, absent, or an empty name", () => {
    expect(pushOptionFields({ sound: false })).toEqual({});
    expect(pushOptionFields({})).toEqual({});
    expect(pushOptionFields()).toEqual({});
    expect(pushOptionFields({ sound: "  " })).toEqual({});
  });

  it("a sound name passes through as given (trimmed)", () => {
    expect(pushOptionFields({ sound: "duo-pop.wav" })).toEqual({ sound: "duo-pop.wav" });
    expect(pushOptionFields({ sound: " duo-pop.wav " })).toEqual({ sound: "duo-pop.wav" });
  });

  it("ttl only as whole seconds of at least 1; priority only as one of Expo's three", () => {
    expect(pushOptionFields({ ttl: 600 })).toEqual({ ttl: 600 });
    expect(pushOptionFields({ ttl: 600.9 })).toEqual({ ttl: 600 });
    expect(pushOptionFields({ ttl: 0 })).toEqual({});
    expect(pushOptionFields({ ttl: Number.NaN })).toEqual({});
    expect(pushOptionFields({ priority: "high" })).toEqual({ priority: "high" });
    expect(pushOptionFields({ priority: "normal" })).toEqual({ priority: "normal" });
    expect(pushOptionFields({ priority: "default" })).toEqual({ priority: "default" });
    expect(pushOptionFields({ priority: "urgent" as never })).toEqual({});
  });
});

describe("readTickets", () => {
  it("pairs tickets with messages in order and flags DeviceNotRegistered", () => {
    const results = readTickets(messages(TOKEN, DEAD), 200, {
      data: [
        { status: "ok", id: "x" },
        {
          status: "error",
          message: `"${DEAD}" is not a registered push notification recipient`,
          details: { error: "DeviceNotRegistered" },
        },
      ],
    });
    expect(results).toEqual([
      { token: TOKEN, accepted: true, transport: false, deviceNotRegistered: false, error: null },
      { token: DEAD, accepted: false, transport: false, deviceNotRegistered: true, error: "DeviceNotRegistered" },
    ]);
  });

  it("falls back to the message with the token taken out when details has no error", () => {
    const [result] = readTickets(messages(DEAD), 200, {
      data: [{ status: "error", message: `"${DEAD}" is not valid` }],
    });
    expect(result.error).toBe('"<token>" is not valid');
    expect(result.error).not.toContain("dead");
    expect(result.deviceNotRegistered).toBe(false);
  });

  it("a request Expo refuses as a whole is a transport failure for every message", () => {
    const results = readTickets(messages(TOKEN, DEAD), 429, {
      errors: [{ code: "TOO_MANY_REQUESTS", message: "slow down" }],
    });
    expect(results.every((r) => r.transport && !r.accepted && r.error === "TOO_MANY_REQUESTS")).toBe(true);
  });

  it("a body that is not JSON names the HTTP status", () => {
    expect(readTickets(messages(TOKEN), 502, null)[0].error).toBe("http_502");
  });

  it("a missing ticket is not counted as accepted", () => {
    const results = readTickets(messages(TOKEN, DEAD), 200, { data: [{ status: "ok" }] });
    expect(results[1]).toMatchObject({ accepted: false, transport: true, error: "no_ticket" });
  });
});

describe("summarizePush", () => {
  const ok = { token: TOKEN, accepted: true, transport: false, deviceNotRegistered: false, error: null };
  const dead = { token: DEAD, accepted: false, transport: false, deviceNotRegistered: true, error: "DeviceNotRegistered" };

  it("no tokens is no_token, not an error", () => {
    expect(summarizePush([])).toEqual({ tokens: 0, accepted: 0, ticketStatus: "no_token", error: null, deadTokens: [] });
  });

  it("all accepted is ok", () => {
    expect(summarizePush([ok]).ticketStatus).toBe("ok");
  });

  it("some accepted is partial, with the first error and the dead token", () => {
    expect(summarizePush([ok, dead])).toEqual({
      tokens: 2,
      accepted: 1,
      ticketStatus: "partial",
      error: "DeviceNotRegistered",
      deadTokens: [DEAD],
    });
  });

  it("none accepted is error, or transport_error when no ticket came back at all", () => {
    expect(summarizePush([dead]).ticketStatus).toBe("error");
    expect(summarizePush(transportFailure(messages(TOKEN), new Error("network down")))).toMatchObject({
      ticketStatus: "transport_error",
      error: "network down",
      deadTokens: [],
    });
  });
});

describe("safeErrorText", () => {
  it("cuts to 200 characters and ignores non-strings", () => {
    expect(safeErrorText("x".repeat(500))).toHaveLength(200);
    expect(safeErrorText(42)).toBeNull();
    expect(safeErrorText("   ")).toBeNull();
  });
});

describe("buildPushLogRow", () => {
  it("records who, what kind and what Expo said, and nothing of the message", () => {
    const row = buildPushLogRow(RECIPIENT, "new_player", "new_like", {
      tokens: 2,
      accepted: 1,
      ticketStatus: "partial",
      error: "DeviceNotRegistered",
      deadTokens: [DEAD],
    });
    expect(row).toEqual({
      recipient_id: RECIPIENT,
      category: "new_player",
      event: "new_like",
      tokens: 2,
      accepted: 1,
      ticket_status: "partial",
      error: "DeviceNotRegistered",
    });
  });

  it("stays inside 0080's check constraints whatever it is handed", () => {
    const row = buildPushLogRow(RECIPIENT, "c".repeat(80), "", {
      tokens: 3,
      accepted: 9,
      ticketStatus: "ok",
      error: "e".repeat(400),
      deadTokens: [],
    });
    expect(row.category).toHaveLength(40);
    expect(row.event).toBeNull();
    expect(row.accepted).toBe(3);
    expect(row.error).toHaveLength(200);
  });
});

describe("sendExpoPush", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the batch and returns the outcome with the dead token", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await sendExpoPush([TOKEN, DEAD], "t", "b", { category: "new_match" }, { sound: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toHaveLength(2);
    expect(sent[0].sound).toBe("default");
    expect(outcome).toEqual({
      tokens: 2,
      accepted: 1,
      ticketStatus: "partial",
      error: "DeviceNotRegistered",
      deadTokens: [DEAD],
    });
  });

  it("never throws when the POST fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection reset");
      }),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await sendExpoPush([TOKEN], "t", "b");
    spy.mockRestore();
    expect(outcome).toMatchObject({ tokens: 1, accepted: 0, ticketStatus: "transport_error", error: "connection reset" });
  });

  it("makes no request when there is no valid token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await sendExpoPush(["junk"], "t", "b")).ticketStatus).toBe("no_token");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
