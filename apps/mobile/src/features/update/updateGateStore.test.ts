import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STATUS_FETCH_TIMEOUT_MS,
  STATUS_RECHECK_MS,
  checkAppStatus,
  reportApiKeyRejection,
  resetUpdateGateForTests,
  useUpdateGateStore,
} from "./updateGateStore";

/**
 * The gate store: fail open on every unexpected answer, block only on a clean "older than
 * minVersion", re-check hourly while open and on every call while blocked, and on a dead API key
 * try exactly one OTA fetch (and one reload, only for a NEW update) per JS runtime before showing
 * the update screen for the rest of the launch.
 *
 * expo-updates and expo-application are mocked by their literal specifiers; the fetch is injected.
 */
const mocks = vi.hoisted(() => {
  const state = {
    appVersion: "1.0.2" as string | null,
    updatesEnabled: true,
    fetchResult: { isNew: false, isRollBackToEmbedded: false } as { isNew: boolean; isRollBackToEmbedded: boolean },
    fetchThrows: false,
    updateFetches: 0,
    reloads: 0,
  };
  return { state };
});

vi.mock("expo-application", () => ({
  get nativeApplicationVersion() {
    return mocks.state.appVersion;
  },
}));

vi.mock("expo-updates", () => ({
  get isEnabled() {
    return mocks.state.updatesEnabled;
  },
  fetchUpdateAsync: async () => {
    mocks.state.updateFetches += 1;
    if (mocks.state.fetchThrows) throw new Error("no network");
    return mocks.state.fetchResult;
  },
  reloadAsync: async () => {
    mocks.state.reloads += 1;
  },
}));

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fetchReturning(make: () => Response | Promise<Response>) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => make());
}

function gate() {
  return useUpdateGateStore.getState();
}

beforeEach(() => {
  resetUpdateGateForTests();
  mocks.state.appVersion = "1.0.2";
  mocks.state.updatesEnabled = true;
  mocks.state.fetchResult = { isNew: false, isRollBackToEmbedded: false };
  mocks.state.fetchThrows = false;
  mocks.state.updateFetches = 0;
  mocks.state.reloads = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkAppStatus fails open", () => {
  const cases: [string, () => Response | Promise<Response>][] = [
    ["a rejected fetch", () => Promise.reject(new Error("offline"))],
    ["a 404 HTML page", () => new Response("<html>404</html>", { status: 404, headers: { "Content-Type": "text/html" } })],
    ["a body that is not JSON", () => new Response("not json", { status: 200 })],
    ["an empty object", () => jsonResponse({})],
    ["a 500 with a blocking body", () => jsonResponse({ minVersion: "9.9.9" }, 500)],
  ];

  for (const [name, make] of cases) {
    it(`stays open on ${name}`, async () => {
      await checkAppStatus({ nowMs: T0, fetchImpl: fetchReturning(make) });
      expect(gate().blocked).toBe(false);
      expect(gate().reason).toBeNull();
    });
  }

  it("leaves lastCheckedAtMs alone when the answer could not be read", async () => {
    await checkAppStatus({ nowMs: T0, fetchImpl: fetchReturning(() => Promise.reject(new Error("offline"))) });
    expect(gate().lastCheckedAtMs).toBeNull();
  });

  it("stays open when the binary version cannot be read", async () => {
    mocks.state.appVersion = null;
    await checkAppStatus({ nowMs: T0, fetchImpl: fetchReturning(() => jsonResponse({ minVersion: "1.0.3" })) });
    expect(gate().blocked).toBe(false);
  });

  it("aborts a hung fetch at 5 s and stays open", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    );
    const done = checkAppStatus({ nowMs: T0, fetchImpl });
    await vi.advanceTimersByTimeAsync(STATUS_FETCH_TIMEOUT_MS - 1);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(aborted).toBe(true);
    expect(gate().blocked).toBe(false);
  });

  it("gives up at 5 s even when the fetch ignores the abort signal", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const done = checkAppStatus({ nowMs: T0, fetchImpl });
    await vi.advanceTimersByTimeAsync(STATUS_FETCH_TIMEOUT_MS);
    await done;
    expect(gate().blocked).toBe(false);
  });
});

describe("checkAppStatus blocks only an older binary", () => {
  it("blocks with min-version when the binary is older", async () => {
    await checkAppStatus({ nowMs: T0, fetchImpl: fetchReturning(() => jsonResponse({ minVersion: "1.0.3" })) });
    expect(gate()).toMatchObject({ blocked: true, reason: "min-version", lastCheckedAtMs: T0 });
  });

  it("asks for the status file with a cache key and no-cache headers", async () => {
    const fetchImpl = fetchReturning(() => jsonResponse({ minVersion: "1.0.1" }));
    await checkAppStatus({ nowMs: T0, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`https://duoqueue.io/app-status.json?v=${Math.floor(T0 / 60000)}`);
    expect(init?.headers).toMatchObject({ Accept: "application/json", "Cache-Control": "no-cache" });
  });

  it("clears the block on a forced re-check after minVersion comes back down", async () => {
    await checkAppStatus({ nowMs: T0, fetchImpl: fetchReturning(() => jsonResponse({ minVersion: "1.0.3" })) });
    expect(gate().blocked).toBe(true);
    await checkAppStatus({ force: true, nowMs: T0 + 1000, fetchImpl: fetchReturning(() => jsonResponse({ minVersion: "1.0.1" })) });
    expect(gate()).toMatchObject({ blocked: false, reason: null, lastCheckedAtMs: T0 + 1000 });
  });
});

describe("checkAppStatus throttling", () => {
  it("fetches at most once an hour while open", async () => {
    const fetchImpl = fetchReturning(() => jsonResponse({ minVersion: "1.0.1" }));
    await checkAppStatus({ nowMs: T0, fetchImpl });
    await checkAppStatus({ nowMs: T0 + STATUS_RECHECK_MS - 1, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await checkAppStatus({ nowMs: T0 + STATUS_RECHECK_MS, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a forced check always fetches", async () => {
    const fetchImpl = fetchReturning(() => jsonResponse({ minVersion: "1.0.1" }));
    await checkAppStatus({ nowMs: T0, fetchImpl });
    await checkAppStatus({ force: true, nowMs: T0 + 1, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("a failed re-check that lifts a block does not stop the next resume from checking", async () => {
    // Blocked, then "Try again" in airplane mode fails open. The phone is free for now, but the
    // check that blocked it must not count as "checked within the hour", or the next resumes skip
    // and a single failed check frees a blocked phone for up to an hour.
    await checkAppStatus({ nowMs: T0, fetchImpl: fetchReturning(() => jsonResponse({ minVersion: "1.0.3" })) });
    expect(gate().blocked).toBe(true);
    await checkAppStatus({ force: true, nowMs: T0 + 1000, fetchImpl: fetchReturning(() => Promise.reject(new Error("offline"))) });
    expect(gate()).toMatchObject({ blocked: false, reason: null, lastCheckedAtMs: null });
    const resume = fetchReturning(() => jsonResponse({ minVersion: "1.0.3" }));
    await checkAppStatus({ nowMs: T0 + 10 * 60_000, fetchImpl: resume });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(gate()).toMatchObject({ blocked: true, reason: "min-version", lastCheckedAtMs: T0 + 10 * 60_000 });
  });

  it("a failed check while open keeps the last good check time", async () => {
    const fetchImpl = fetchReturning(() => jsonResponse({ minVersion: "1.0.1" }));
    await checkAppStatus({ nowMs: T0, fetchImpl });
    await checkAppStatus({ force: true, nowMs: T0 + 1000, fetchImpl: fetchReturning(() => Promise.reject(new Error("offline"))) });
    expect(gate()).toMatchObject({ blocked: false, lastCheckedAtMs: T0 });
  });

  it("fetches on every call while blocked", async () => {
    const fetchImpl = fetchReturning(() => jsonResponse({ minVersion: "1.0.3" }));
    await checkAppStatus({ nowMs: T0, fetchImpl });
    await checkAppStatus({ nowMs: T0 + 1000, fetchImpl });
    await checkAppStatus({ nowMs: T0 + 2000, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("shares one fetch between two concurrent calls", async () => {
    const fetchImpl = fetchReturning(() => jsonResponse({ minVersion: "1.0.1" }));
    const a = checkAppStatus({ nowMs: T0, fetchImpl });
    const b = checkAppStatus({ nowMs: T0, fetchImpl });
    await Promise.all([a, b]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("reportApiKeyRejection", () => {
  it("fetches a new update once and reloads into it", async () => {
    mocks.state.fetchResult = { isNew: true, isRollBackToEmbedded: false };
    await reportApiKeyRejection();
    expect(mocks.state.updateFetches).toBe(1);
    expect(mocks.state.reloads).toBe(1);
  });

  it("reloads for a roll back to the embedded build too", async () => {
    mocks.state.fetchResult = { isNew: false, isRollBackToEmbedded: true };
    await reportApiKeyRejection();
    expect(mocks.state.reloads).toBe(1);
  });

  it("acts once per runtime, however many requests are rejected", async () => {
    mocks.state.fetchResult = { isNew: true, isRollBackToEmbedded: false };
    await Promise.all(Array.from({ length: 10 }, () => reportApiKeyRejection()));
    expect(mocks.state.updateFetches).toBe(1);
    expect(mocks.state.reloads).toBe(1);
  });

  it("shows the update screen when there is no new update", async () => {
    await reportApiKeyRejection();
    expect(mocks.state.reloads).toBe(0);
    expect(gate()).toMatchObject({ blocked: true, reason: "key" });
  });

  it("shows the update screen when updates are off", async () => {
    mocks.state.updatesEnabled = false;
    await reportApiKeyRejection();
    expect(mocks.state.updateFetches).toBe(0);
    expect(gate()).toMatchObject({ blocked: true, reason: "key" });
  });

  it("shows the update screen when the update fetch throws", async () => {
    mocks.state.fetchThrows = true;
    await reportApiKeyRejection();
    expect(gate()).toMatchObject({ blocked: true, reason: "key" });
  });

  it("keeps the key block for the launch: the status check neither fetches nor unblocks", async () => {
    await reportApiKeyRejection();
    const fetchImpl = fetchReturning(() => jsonResponse({ minVersion: "1.0.1" }));
    await checkAppStatus({ force: true, nowMs: T0, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(gate()).toMatchObject({ blocked: true, reason: "key" });
  });

  it("wins over a status check that was already in flight", async () => {
    let release: (response: Response) => void = () => {};
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
    const check = checkAppStatus({ nowMs: T0, fetchImpl });
    await reportApiKeyRejection();
    release(jsonResponse({ minVersion: "1.0.1" }));
    await check;
    expect(gate()).toMatchObject({ blocked: true, reason: "key" });
  });
});
