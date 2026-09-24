import type { Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store is where `profileStatus` is PRODUCED, and `sessionRouting.test.ts` only proves what
 * routing does once it has been produced correctly. Everything below the "loaded / missing /
 * error" line is arithmetic; this file is about the line itself.
 *
 * The reading that has to be right is the empty one. `.maybeSingle()` answers a genuinely
 * profile-less Apple account and an expired-token read that silently went out as `anon` with the
 * exact same `{ data: null, error: null }`, and only the store can tell them apart, by asking
 * `auth.getSession()` on both sides of the select. Getting that wrong does not fail a routing
 * test: `sessionRoute` would be handed "missing", answer "complete-signup" quite correctly, and
 * a three-month-old account would be shown "Confirm your age" with no way back. So the tests
 * that matter most here are the ones where the read comes back empty for the WRONG reason.
 *
 * WHY IT IS SHAPED LIKE THIS. `renderHook` is unreliable in this repo (react-dom resolves to a
 * version these paths would fight), and none of this needs React anyway: a zustand store is a
 * plain callable object outside a component, so the tests drive `useSessionStore.getState()`
 * directly against a hand-written Supabase double.
 *
 * The `@/` alias is a Metro/tsc convenience that Vite does not resolve, so every aliased import
 * the store makes is mocked by its literal specifier — including `sessionRouting`, which is
 * mocked to its own real implementation via a relative path so the decision under test is the
 * real one and not a stub.
 */

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Read = { data: Row | null; error: { message: string } | null };
  type SessionLike = { user: { id: string } } | null;
  type AuthListener = (event: string, session: SessionLike) => void;

  const state = {
    /** What `auth.getSession()` answers. This is the device's session, not the store's. */
    deviceSession: null as SessionLike,
    /** When set, `auth.getSession()` throws it instead of answering. */
    sessionThrow: null as Error | null,
    getSessionCalls: 0,
    /** Queued `.maybeSingle()` answers, consumed in order; `defaultRead` once they run out. */
    reads: [] as Read[],
    defaultRead: { data: null, error: null } as Read,
    /** When true, `.maybeSingle()` never answers — a read still in flight, and staying there. */
    hangRead: false,
    selects: 0,
    /** Patches that reached `profiles.update(...)`, i.e. the `last_active_at` stamp. */
    updates: [] as Row[],
    /**
     * The single lever for "what happened while the read was in flight" — a token lapsing, a
     * second account signing in, `getSession` starting to throw. Runs inside `.maybeSingle()`,
     * which is after the store's before-check and before its after-check.
     */
    duringRead: null as null | (() => void),
    authListeners: [] as AuthListener[],
    rpcCalls: [] as { fn: string; args: Row }[],
    rpcError: null as { message: string } | null,
    signOutThrow: null as Error | null,
    signOutCalls: 0,
    pushRegistrations: [] as string[],
    purchasesConfigured: [] as string[],
    purchasesLoggedOut: 0,
    queryCacheClears: 0,
    onboardingResets: 0,
    /** Calls to `clearPendingDisplayName`, i.e. the saved Apple name being dropped. */
    pendingNameClears: 0,
  };

  function reset(): void {
    state.deviceSession = null;
    state.sessionThrow = null;
    state.getSessionCalls = 0;
    state.reads = [];
    state.defaultRead = { data: null, error: null };
    state.hangRead = false;
    state.selects = 0;
    state.updates = [];
    state.duringRead = null;
    state.authListeners = [];
    state.rpcCalls = [];
    state.rpcError = null;
    state.signOutThrow = null;
    state.signOutCalls = 0;
    state.pushRegistrations = [];
    state.purchasesConfigured = [];
    state.purchasesLoggedOut = 0;
    state.queryCacheClears = 0;
    state.onboardingResets = 0;
    state.pendingNameClears = 0;
  }

  /**
   * Just enough PostgREST builder for the two chains the store uses:
   * `.select().eq().maybeSingle()` and `.update().eq().then()`.
   */
  interface Builder {
    select: (columns: string) => Builder;
    update: (patch: Row) => Builder;
    eq: (column: string, value: string) => Builder;
    maybeSingle: () => Promise<Read>;
    then: (onOk: (result: { error: { message: string } | null }) => void) => Promise<void>;
  }

  function makeBuilder(): Builder {
    let patch: Row | null = null;
    const builder: Builder = {
      select: () => builder,
      update: (next) => {
        patch = next;
        return builder;
      },
      eq: () => builder,
      maybeSingle: () => {
        state.selects += 1;
        state.duringRead?.();
        if (state.hangRead) return new Promise<Read>(() => {});
        return Promise.resolve(state.reads.shift() ?? state.defaultRead);
      },
      then: (onOk) =>
        Promise.resolve().then(() => {
          if (patch) state.updates.push(patch);
          onOk({ error: null });
        }),
    };
    return builder;
  }

  const supabase = {
    auth: {
      getSession: () => {
        state.getSessionCalls += 1;
        if (state.sessionThrow) throw state.sessionThrow;
        return Promise.resolve({ data: { session: state.deviceSession }, error: null });
      },
      onAuthStateChange: (listener: AuthListener) => {
        state.authListeners.push(listener);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => {
        state.signOutCalls += 1;
        if (state.signOutThrow) return Promise.reject(state.signOutThrow);
        return Promise.resolve({ error: null });
      },
    },
    from: () => makeBuilder(),
    rpc: (fn: string, args: Row) => {
      state.rpcCalls.push({ fn, args });
      return Promise.resolve({ error: state.rpcError });
    },
  };

  return { state, reset, supabase };
});

vi.mock("@/lib/supabase", () => ({ supabase: mocks.supabase }));

// The real decision, reached by a path Vite can resolve. Mocking this to a stub would make every
// assertion below a test of the stub.
vi.mock("@/features/auth/sessionRouting", async () => await import("../features/auth/sessionRouting"));

vi.mock("@/lib/notifications", () => ({
  registerForPushNotifications: (profileId: string) => {
    mocks.state.pushRegistrations.push(profileId);
    return Promise.resolve();
  },
  ensurePushPermission: () => Promise.resolve({ granted: true, canAskAgain: true }),
}));

vi.mock("@/lib/query-client", () => ({
  queryClient: {
    clear: () => {
      mocks.state.queryCacheClears += 1;
    },
  },
}));

vi.mock("@/lib/revenuecat", () => ({
  configurePurchases: (userId: string) => {
    mocks.state.purchasesConfigured.push(userId);
  },
  logOutPurchases: () => {
    mocks.state.purchasesLoggedOut += 1;
    return Promise.resolve();
  },
  isPurchasesConfigured: () => true,
}));

vi.mock("@/features/auth/pendingDisplayName", () => ({
  clearPendingDisplayName: () => {
    mocks.state.pendingNameClears += 1;
    return Promise.resolve();
  },
}));

vi.mock("@/store/onboarding-store", () => ({
  useOnboardingStore: {
    getState: () => ({
      reset: () => {
        mocks.state.onboardingResets += 1;
      },
    }),
  },
}));

const { state } = mocks;

/** Matches `PROFILE_RETRY_MS` in the store. */
const RETRY_MS = 3000;

function sessionFor(userId: string, token = `token-${userId}`): Session {
  return {
    access_token: token,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: userId },
  } as unknown as Session;
}

function profileRow(userId: string, onboardingCompleted = true): Record<string, unknown> {
  return { id: userId, display_name: "Nova", onboarding_completed: onboardingCompleted };
}

/**
 * A fresh copy of the store per test. The module keeps two pieces of state outside the store
 * itself — the `profileReadyFor` latch and the retry timer handle — and a test that inherited
 * either from the test before it would be testing the wrong runtime.
 */
async function loadStore() {
  vi.resetModules();
  const { useSessionStore } = await import("./session-store");
  return useSessionStore;
}

/** Lets everything the store fired without awaiting (`void get().refreshProfile()`) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

beforeEach(() => {
  mocks.reset();
  // The store narrates every one of these paths to the console on purpose. Silencing it keeps a
  // passing run readable; the assertions below are what actually prove the branch was taken.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("what an empty profile read is allowed to mean", () => {
  it("calls a zero-row read missing only after confirming the session on both sides", async () => {
    state.deviceSession = sessionFor("u1");
    const store = await loadStore();

    await store.getState().initialize();

    expect(store.getState().status).toBe("signed_in");
    expect(store.getState().profileStatus).toBe("missing");
    expect(store.getState().profile).toBeNull();
    // initialize's own read, then the before-check, then the after-check that only the empty
    // path pays for.
    expect(state.getSessionCalls).toBe(3);
  });

  it("reads a row as loaded without paying for a second session check", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();

    await store.getState().initialize();

    expect(store.getState().profileStatus).toBe("loaded");
    expect(store.getState().profile?.id).toBe("u1");
    // A row is already an answer about this user, so there is no after-check.
    expect(state.getSessionCalls).toBe(2);
  });

  it("calls a failed read error rather than missing", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: null, error: { message: "Network request failed" } }];
    const store = await loadStore();

    await store.getState().initialize();

    expect(store.getState().profileStatus).toBe("error");
    expect(store.getState().profile).toBeNull();
    expect(state.getSessionCalls).toBe(2);
  });

  it("refuses to call an expired token's empty answer missing", async () => {
    // THE REGRESSION THE TRI-STATE EXISTS TO PREVENT. The token lapses while the select is in
    // flight, supabase-js falls back to the anon key, `profiles_select_own` matches nothing and
    // PostgREST answers a perfectly ordinary 200 with []. Byte for byte a profile-less account.
    state.deviceSession = sessionFor("u1");
    state.duringRead = () => {
      state.deviceSession = null;
    };
    const store = await loadStore();

    await store.getState().initialize();

    expect(store.getState().profileStatus).toBe("error");
    expect(store.getState().profileStatus).not.toBe("missing");
  });

  it("refuses to call another account's empty answer missing", async () => {
    // The same forgery with a different cause: a second account took over the device session
    // between the request going out and the answer coming back.
    state.deviceSession = sessionFor("u1");
    state.duringRead = () => {
      state.deviceSession = sessionFor("u2");
    };
    const store = await loadStore();

    await store.getState().initialize();

    expect(store.getState().profileStatus).toBe("error");
  });

  it("treats a thrown getSession as not knowing, not as a missing row", async () => {
    state.deviceSession = sessionFor("u1");
    state.duringRead = () => {
      state.sessionThrow = new Error("SecureStore unavailable");
    };
    const store = await loadStore();

    await store.getState().initialize();

    expect(store.getState().profileStatus).toBe("error");
  });

  it("never sends the select at all when there is no live session to send it as", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();
    expect(state.selects).toBe(1);

    // The token is gone before the next read, so the request would go out as anon and come back
    // empty. There is no point making it, and every point in not believing it.
    state.deviceSession = null;
    await store.getState().refreshProfile();

    expect(state.selects).toBe(1);
    expect(store.getState().profileStatus).toBe("error");
  });

  it("keeps a good profile through a failed read", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();

    state.reads = [{ data: null, error: { message: "Network request failed" } }];
    await store.getState().refreshProfile();

    expect(store.getState().profileStatus).toBe("error");
    expect(store.getState().profile?.id).toBe("u1");
  });

  it("clears a held profile only on an authoritative missing", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();

    // Deleted server-side: a confirmed session and a genuinely empty result.
    await store.getState().refreshProfile();

    expect(store.getState().profileStatus).toBe("missing");
    expect(store.getState().profile).toBeNull();
  });
});

describe("refreshProfile's stale-read guard", () => {
  it("drops an answer for an account that has already been replaced", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();

    // A second account signs in while u1's refresh is in flight.
    state.reads = [{ data: profileRow("u1", false), error: null }];
    state.duringRead = () => {
      store.setState({ session: sessionFor("u2"), profile: null, profileStatus: "unknown" });
    };
    await store.getState().refreshProfile();

    // u1's row must not become u2's routing input.
    expect(store.getState().session?.user.id).toBe("u2");
    expect(store.getState().profile).toBeNull();
    expect(store.getState().profileStatus).toBe("unknown");
  });

  it("drops an answer for an account that has signed out", async () => {
    state.deviceSession = sessionFor("u1");
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profileStatus).toBe("missing");

    state.reads = [{ data: profileRow("u1"), error: null }];
    state.duringRead = () => {
      store.setState({ session: null, profile: null, profileStatus: "unknown", status: "signed_out" });
    };
    await store.getState().refreshProfile();

    expect(store.getState().status).toBe("signed_out");
    expect(store.getState().profile).toBeNull();
    expect(store.getState().profileStatus).toBe("unknown");
    // And the once-per-user side effects must not fire for a user who is no longer here.
    await flush();
    expect(state.pushRegistrations).toEqual([]);
  });

  it("does not put a stale failure on the retry timer", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();
    expect(vi.getTimerCount()).toBe(0);

    state.reads = [{ data: null, error: { message: "Network request failed" } }];
    state.duringRead = () => {
      store.setState({ session: null, profile: null, profileStatus: "unknown", status: "signed_out" });
    };
    await store.getState().refreshProfile();

    // The guard returns before the error branch, so a signed-out app is left with no timer
    // ticking against a session that no longer exists.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("applies an answer that is still for the account holding the session", async () => {
    state.deviceSession = sessionFor("u1");
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profileStatus).toBe("missing");

    state.reads = [{ data: profileRow("u1"), error: null }];
    await store.getState().refreshProfile();

    expect(store.getState().profileStatus).toBe("loaded");
    expect(store.getState().profile?.id).toBe("u1");
  });
});

describe("the account switch inside onAuthStateChange", () => {
  it("clears the previous account's profile in the same tick the new one arrives", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profile?.id).toBe("u1");

    // Synchronous on purpose: the listener's own `set` has to have landed before the refresh it
    // fires resolves, or routing runs for u2 holding u1's profile for a frame.
    state.authListeners[0]?.("SIGNED_IN", sessionFor("u2"));

    expect(store.getState().session?.user.id).toBe("u2");
    expect(store.getState().profile).toBeNull();
    expect(store.getState().profileStatus).toBe("unknown");
    await flush();
  });

  it("survives the INITIAL_SESSION event supabase-js fires the moment it subscribes", async () => {
    // The listener is registered at the end of `initialize`, and auth-js immediately replays the
    // session it already has. That is the very first thing that happens in production, and it
    // arrives for the SAME user, so it must cost a redundant read and nothing else.
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: profileRow("u1"), error: null };
    const store = await loadStore();
    await store.getState().initialize();

    state.authListeners[0]?.("INITIAL_SESSION", sessionFor("u1"));

    expect(store.getState().profileStatus).toBe("loaded");
    expect(store.getState().profile?.id).toBe("u1");
    await flush();
    expect(store.getState().profileStatus).toBe("loaded");
    // Once per user per runtime, even though the profile has now been read twice.
    expect(state.pushRegistrations).toEqual(["u1"]);
  });

  it("does not blank the profile when the same account refreshes its token", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();

    state.authListeners[0]?.("TOKEN_REFRESHED", sessionFor("u1", "token-u1-rotated"));

    expect(store.getState().profile?.id).toBe("u1");
    expect(store.getState().profileStatus).toBe("loaded");
    expect(store.getState().session?.access_token).toBe("token-u1-rotated");
    await flush();
  });

  it("clears everything when the session goes away", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();

    state.authListeners[0]?.("SIGNED_OUT", null);

    expect(store.getState().status).toBe("signed_out");
    expect(store.getState().session).toBeNull();
    expect(store.getState().profile).toBeNull();
    expect(store.getState().profileStatus).toBe("unknown");
  });

  it("cancels the old account's pending retry when a different one signs in", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: null, error: { message: "Network request failed" } }];
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profileStatus).toBe("error");
    expect(vi.getTimerCount()).toBe(1);

    // u2's own read is left in flight, so the ONLY thing that can clear u1's timer is the switch
    // itself. A successful refresh would cancel it too and hide the branch under test.
    state.deviceSession = sessionFor("u2");
    state.hangRead = true;
    state.authListeners[0]?.("SIGNED_IN", sessionFor("u2"));
    await flush();

    expect(vi.getTimerCount()).toBe(0);
    // And nothing fires later either: a u1 retry running under u2's session reads the wrong row.
    const selectsAfterSwitch = state.selects;
    await vi.advanceTimersByTimeAsync(RETRY_MS * 2);
    expect(state.selects).toBe(selectsAfterSwitch);
  });

  it("resets the once-per-user latch so the new account registers for push", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();
    await flush();
    expect(state.pushRegistrations).toEqual(["u1"]);

    state.deviceSession = sessionFor("u2");
    state.reads = [{ data: profileRow("u2"), error: null }];
    state.authListeners[0]?.("SIGNED_IN", sessionFor("u2"));
    await flush();

    expect(state.pushRegistrations).toEqual(["u1", "u2"]);
    expect(state.purchasesConfigured).toEqual(["u1", "u2"]);
  });
});

describe("the retry timer", () => {
  it("heals a failed read without the app being force-quit", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: null, error: { message: "Network request failed" } }];
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profileStatus).toBe("error");

    // Out of the tunnel.
    state.reads = [{ data: profileRow("u1"), error: null }];
    await vi.advanceTimersByTimeAsync(RETRY_MS);

    expect(store.getState().profileStatus).toBe("loaded");
    expect(store.getState().profile?.id).toBe("u1");
  });

  it("stops once the read succeeds", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: null, error: { message: "Network request failed" } }];
    const store = await loadStore();
    await store.getState().initialize();

    state.reads = [{ data: profileRow("u1"), error: null }];
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    const selectsAfterHeal = state.selects;

    await vi.advanceTimersByTimeAsync(RETRY_MS * 3);

    expect(state.selects).toBe(selectsAfterHeal);
  });

  it("keeps retrying while the read keeps failing", async () => {
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: null, error: { message: "Network request failed" } };
    const store = await loadStore();
    await store.getState().initialize();
    expect(state.selects).toBe(1);

    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(state.selects).toBe(2);
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(state.selects).toBe(3);
    expect(store.getState().profileStatus).toBe("error");
  });

  it("does not stack a second timer while one is already pending", async () => {
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: null, error: { message: "Network request failed" } };
    const store = await loadStore();
    await store.getState().initialize();

    // Three more failures from screens that refresh on focus, all while the first retry waits.
    await store.getState().refreshProfile();
    await store.getState().refreshProfile();
    await store.getState().refreshProfile();
    const selectsBefore = state.selects;

    await vi.advanceTimersByTimeAsync(RETRY_MS);

    // Exactly one retry, not four.
    expect(state.selects).toBe(selectsBefore + 1);
  });

  it("stops once the read authoritatively says there is no row", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: null, error: { message: "Network request failed" } }];
    const store = await loadStore();
    await store.getState().initialize();

    // The retry lands on a confirmed empty result: this account really has no profile yet, which
    // is an answer, not a failure, and the age gate is where it belongs.
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(store.getState().profileStatus).toBe("missing");
    const selectsAfterAnswer = state.selects;

    await vi.advanceTimersByTimeAsync(RETRY_MS * 3);

    expect(state.selects).toBe(selectsAfterAnswer);
  });

  it("cancels the retry on sign out", async () => {
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: null, error: { message: "Network request failed" } };
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profileStatus).toBe("error");

    await store.getState().signOut();
    const selectsAtSignOut = state.selects;

    await vi.advanceTimersByTimeAsync(RETRY_MS * 3);

    expect(state.selects).toBe(selectsAtSignOut);
    expect(store.getState().status).toBe("signed_out");
    expect(store.getState().profileStatus).toBe("unknown");
  });
});

describe("the once-per-user onProfileReady latch", () => {
  it("registers push and stamps last_active_at once, not once per read", async () => {
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: profileRow("u1"), error: null };
    const store = await loadStore();
    await store.getState().initialize();
    await flush();

    await store.getState().refreshProfile();
    await store.getState().refreshProfile();
    await flush();

    expect(state.pushRegistrations).toEqual(["u1"]);
    expect(state.updates).toHaveLength(1);
    expect(Object.keys(state.updates[0] ?? {})).toEqual(["last_active_at"]);
  });

  it("does not spend the one-shot iOS permission prompt before there is a profile", async () => {
    // `push_tokens.profile_id` references `profiles(id)`, so on an Apple session this used to be
    // a foreign-key violation swallowed as a warning, and the user finished signup with no push
    // token at all.
    state.deviceSession = sessionFor("u1");
    const store = await loadStore();

    await store.getState().initialize();
    await flush();

    expect(store.getState().profileStatus).toBe("missing");
    expect(state.pushRegistrations).toEqual([]);
    expect(state.updates).toEqual([]);
    // The session itself is enough for RevenueCat, which must not touch `profiles`.
    expect(state.purchasesConfigured).toEqual(["u1"]);
  });

  it("does not fire on a failed read", async () => {
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: null, error: { message: "Network request failed" } };
    const store = await loadStore();

    await store.getState().initialize();
    await flush();

    expect(state.pushRegistrations).toEqual([]);
  });

  it("drops the saved Apple name once a profile is confirmed", async () => {
    // The path the age gate never sees: an Apple sign-in into an account that already has a
    // profile. signInWithApple saved the name before the token exchange, as it does on every
    // Apple sign-in, and nothing on this path used to clear it.
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: profileRow("u1"), error: null };
    const store = await loadStore();

    await store.getState().initialize();
    await flush();
    expect(state.pendingNameClears).toBe(1);

    // Once per user per runtime, like the rest of the latch.
    await store.getState().refreshProfile();
    await flush();
    expect(state.pendingNameClears).toBe(1);
  });

  it("keeps the saved Apple name while the account has no profile, since the age gate needs it", async () => {
    state.deviceSession = sessionFor("u1");
    const store = await loadStore();

    await store.getState().initialize();
    await flush();

    expect(store.getState().profileStatus).toBe("missing");
    expect(state.pendingNameClears).toBe(0);
  });

  it("keeps it through a failed read too, which says nothing about whether a profile exists", async () => {
    state.deviceSession = sessionFor("u1");
    state.defaultRead = { data: null, error: { message: "Network request failed" } };
    const store = await loadStore();

    await store.getState().initialize();
    await flush();

    expect(state.pendingNameClears).toBe(0);
  });

  it("fires the moment the age gate produces the profile", async () => {
    state.deviceSession = sessionFor("u1");
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profileStatus).toBe("missing");

    state.reads = [{ data: profileRow("u1", false), error: null }];
    await store.getState().completeSignup({ dob: "1994-03-03", timezone: "America/Chicago" });
    await flush();

    expect(state.rpcCalls).toEqual([
      {
        fn: "complete_signup",
        args: { p_dob: "1994-03-03", p_timezone: "America/Chicago", p_display_name: null },
      },
    ]);
    // Not optional: this is what lets routing leave the age gate.
    expect(store.getState().profileStatus).toBe("loaded");
    expect(state.pushRegistrations).toEqual(["u1"]);
  });
});

describe("completeSignup", () => {
  it("refuses to run without a session", async () => {
    const store = await loadStore();
    await store.getState().initialize();

    await expect(store.getState().completeSignup({ dob: "1994-03-03", timezone: "UTC" })).rejects.toThrow(
      "Not signed in.",
    );
    expect(state.rpcCalls).toEqual([]);
  });

  it("raises what Postgres raised and leaves the age gate where it is", async () => {
    state.deviceSession = sessionFor("u1");
    state.rpcError = { message: "You must be 18 or older to use DuoQueue." };
    const store = await loadStore();
    await store.getState().initialize();
    expect(store.getState().profileStatus).toBe("missing");

    await expect(
      store.getState().completeSignup({ dob: "2015-03-03", timezone: "UTC" }),
    ).rejects.toMatchObject({ message: "You must be 18 or older to use DuoQueue." });

    // A rejected date of birth must not move the user off the gate, and must not have written
    // anything the store now believes.
    expect(store.getState().profileStatus).toBe("missing");
    expect(store.getState().profile).toBeNull();
  });

  it("passes a display name through when the caller has one", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1", false), error: null }];
    const store = await loadStore();
    await store.getState().initialize();

    await store.getState().completeSignup({ dob: "1994-03-03", timezone: "UTC", displayName: "Nova" });

    expect(state.rpcCalls[0]?.args.p_display_name).toBe("Nova");
  });
});

describe("signOut", () => {
  it("clears local state even when the server-side calls fail", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    state.signOutThrow = new Error("User from sub claim in JWT does not exist");
    const store = await loadStore();
    await store.getState().initialize();

    await store.getState().signOut();

    expect(store.getState().status).toBe("signed_out");
    expect(store.getState().session).toBeNull();
    expect(store.getState().profile).toBeNull();
    expect(store.getState().profileStatus).toBe("unknown");
    expect(state.queryCacheClears).toBe(1);
    expect(state.onboardingResets).toBe(1);
  });

  it("resets the latch so the next account on this runtime registers for itself", async () => {
    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    const store = await loadStore();
    await store.getState().initialize();
    await flush();
    expect(state.pushRegistrations).toEqual(["u1"]);

    await store.getState().signOut();

    state.deviceSession = sessionFor("u1");
    state.reads = [{ data: profileRow("u1"), error: null }];
    store.setState({ session: sessionFor("u1"), status: "signed_in" });
    await store.getState().refreshProfile();
    await flush();

    expect(state.pushRegistrations).toEqual(["u1", "u1"]);
  });
});

describe("a signed-out cold start", () => {
  it("answers signed_out with nothing pretended about a profile", async () => {
    const store = await loadStore();

    await store.getState().initialize();

    expect(store.getState().status).toBe("signed_out");
    expect(store.getState().profileStatus).toBe("unknown");
    expect(state.selects).toBe(0);
    expect(state.purchasesConfigured).toEqual([]);
  });
});
