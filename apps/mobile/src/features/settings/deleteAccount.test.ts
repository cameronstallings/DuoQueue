import { FunctionsHttpError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the delete-account request sends, for the two kinds of account, and what it does with the
 * answer.
 *
 * The promise being kept: an email account's deletion is byte for byte what it was (`{}`), and
 * an Apple account's deletion ALWAYS happens, with a fresh Apple code when one can be had and
 * without one when it cannot. A dismissed Apple sheet must never turn into "you cannot delete
 * your account".
 */
const mocks = vi.hoisted(() => {
  const state = {
    sessionUser: null as Record<string, unknown> | null,
    sessionThrows: false,
    appleCode: null as string | null,
    appleCodeCalls: 0,
    invokeCalls: [] as { fn: string; body: unknown }[],
    invokeResult: { data: { ok: true }, error: null } as { data: unknown; error: unknown },
  };

  function reset(): void {
    state.sessionUser = null;
    state.sessionThrows = false;
    state.appleCode = null;
    state.appleCodeCalls = 0;
    state.invokeCalls = [];
    state.invokeResult = { data: { ok: true }, error: null };
  }

  return { state, reset };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => {
        if (mocks.state.sessionThrows) return Promise.reject(new Error("SecureStore unavailable"));
        return Promise.resolve({
          data: { session: mocks.state.sessionUser ? { user: mocks.state.sessionUser } : null },
          error: null,
        });
      },
    },
    functions: {
      invoke: (fn: string, options: { body: unknown }) => {
        mocks.state.invokeCalls.push({ fn, body: options.body });
        return Promise.resolve(mocks.state.invokeResult);
      },
    },
  },
}));

vi.mock("@/features/auth/appleSignIn", () => ({
  appleAuthorizationCodeForDeletion: () => {
    mocks.state.appleCodeCalls += 1;
    return Promise.resolve(mocks.state.appleCode);
  },
}));

// The real decision, reached by a path Vite can resolve.
vi.mock("@/features/auth/appleIdentity", async () => await import("../auth/appleIdentity"));

const { state } = mocks;

const emailUser = { app_metadata: { provider: "email", providers: ["email"] } };
const appleUser = { app_metadata: { provider: "apple", providers: ["apple"] } };

beforeEach(() => {
  mocks.reset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deleteAccountRequest for an email account", () => {
  it("sends the same empty body it always has, and never asks Apple for anything", async () => {
    state.sessionUser = emailUser;
    const { deleteAccountRequest } = await import("./deleteAccount");

    await deleteAccountRequest();

    expect(state.invokeCalls).toEqual([{ fn: "delete-account", body: {} }]);
    expect(state.appleCodeCalls).toBe(0);
  });

  it("still deletes when the session cannot be read", async () => {
    state.sessionThrows = true;
    const { deleteAccountRequest } = await import("./deleteAccount");

    await deleteAccountRequest();

    expect(state.invokeCalls).toEqual([{ fn: "delete-account", body: {} }]);
    expect(state.appleCodeCalls).toBe(0);
  });
});

describe("deleteAccountRequest for an Apple account", () => {
  it("asks Apple for a fresh code and sends it along", async () => {
    state.sessionUser = appleUser;
    state.appleCode = "fresh-code";
    const { deleteAccountRequest } = await import("./deleteAccount");

    await deleteAccountRequest();

    expect(state.appleCodeCalls).toBe(1);
    expect(state.invokeCalls).toEqual([{ fn: "delete-account", body: { appleAuthorizationCode: "fresh-code" } }]);
  });

  it("covers an email account that was later linked to Apple", async () => {
    state.sessionUser = { app_metadata: { provider: "email", providers: ["email", "apple"] } };
    state.appleCode = "fresh-code";
    const { deleteAccountRequest } = await import("./deleteAccount");

    await deleteAccountRequest();

    expect(state.invokeCalls[0]?.body).toEqual({ appleAuthorizationCode: "fresh-code" });
  });

  it("still deletes the account when the Apple sheet is dismissed", async () => {
    // appleAuthorizationCodeForDeletion answers null for a cancel; the deletion goes ahead and
    // the server falls back to any token stored at sign-in.
    state.sessionUser = appleUser;
    state.appleCode = null;
    const { deleteAccountRequest } = await import("./deleteAccount");

    await deleteAccountRequest();

    expect(state.appleCodeCalls).toBe(1);
    expect(state.invokeCalls).toEqual([{ fn: "delete-account", body: {} }]);
  });
});

describe("deleteAccountRequest's error handling", () => {
  it("surfaces delete-account's own sentence from a non-2xx answer", async () => {
    // A 403 arrives as a FunctionsHttpError whose message is the generic "non-2xx" line; the
    // sentence meant for the user is in the body and used to be thrown away.
    state.sessionUser = emailUser;
    const refusal = "This account has been banned and cannot be deleted. Contact support if you believe this is a mistake.";
    state.invokeResult = {
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ error: refusal }), { status: 403 })),
    };
    const { deleteAccountRequest } = await import("./deleteAccount");

    await expect(deleteAccountRequest()).rejects.toThrow(refusal);
  });

  it("rethrows the original error when the body has nothing to say", async () => {
    state.sessionUser = emailUser;
    const httpError = new FunctionsHttpError(new Response("not json", { status: 502 }));
    state.invokeResult = { data: null, error: httpError };
    const { deleteAccountRequest } = await import("./deleteAccount");

    await expect(deleteAccountRequest()).rejects.toBe(httpError);
  });

  it("throws an error carried in a 2xx body", async () => {
    state.sessionUser = emailUser;
    state.invokeResult = { data: { error: "Failed to delete stored files" }, error: null };
    const { deleteAccountRequest } = await import("./deleteAccount");

    await expect(deleteAccountRequest()).rejects.toThrow("Failed to delete stored files");
  });
});
