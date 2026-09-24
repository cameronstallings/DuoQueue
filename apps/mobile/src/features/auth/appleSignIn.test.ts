import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two things in appleSignIn.ts are easy to get backwards and fail silently when they are:
 *
 *   - The nonce. Apple must be handed the SHA-256 HASH and Supabase the RAW value. Swapped, every
 *     sign-in fails with "Nonces mismatch"; omitted from either side, the token is replayable. No
 *     unit of this file can be seen working on a simulator, so the wiring is asserted here.
 *   - The deletion code. Every failure has to come back as null (the deletion still happens), and
 *     it must never throw, since the user has already confirmed twice.
 *
 * Every native and aliased import is mocked by its literal specifier, the same arrangement
 * session-store.test.ts uses; appleDisplayName and socialSignIn are pure and run for real.
 */
const mocks = vi.hoisted(() => {
  type Credential = {
    identityToken: string | null;
    authorizationCode: string | null;
    fullName: Record<string, string | null> | null;
  };

  const state = {
    os: "ios",
    available: true,
    availableThrows: false,
    signInResult: null as Credential | null,
    signInThrow: null as Error | null,
    signInCalls: [] as Record<string, unknown>[],
    idTokenCalls: [] as Record<string, unknown>[],
    idTokenError: null as { message: string } | null,
    invokeCalls: [] as { fn: string; body: unknown }[],
    pendingWrites: [] as (string | null)[],
    pendingClears: 0,
  };

  function reset(): void {
    state.os = "ios";
    state.available = true;
    state.availableThrows = false;
    state.signInResult = {
      identityToken: "apple-id-token",
      authorizationCode: "apple-auth-code",
      fullName: { givenName: "Ada", familyName: "Lovelace" },
    };
    state.signInThrow = null;
    state.signInCalls = [];
    state.idTokenCalls = [];
    state.idTokenError = null;
    state.invokeCalls = [];
    state.pendingWrites = [];
    state.pendingClears = 0;
  }

  return { state, reset };
});

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mocks.state.os;
    },
  },
}));

vi.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  isAvailableAsync: () => {
    if (mocks.state.availableThrows) return Promise.reject(new Error("native module missing"));
    return Promise.resolve(mocks.state.available);
  },
  signInAsync: (options: Record<string, unknown>) => {
    mocks.state.signInCalls.push(options);
    if (mocks.state.signInThrow) return Promise.reject(mocks.state.signInThrow);
    return Promise.resolve(mocks.state.signInResult);
  },
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { HEX: "hex" },
  // Deterministic bytes: the test is about where each value goes, not about randomness.
  getRandomBytes: (count: number) => Uint8Array.from({ length: count }, (_, i) => (i * 37 + 11) % 256),
  // The real algorithm, via WebCrypto, so "hashed" below is provably SHA-256 of "raw".
  digestStringAsync: async (_algorithm: string, data: string) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithIdToken: (args: Record<string, unknown>) => {
        mocks.state.idTokenCalls.push(args);
        return Promise.resolve({ error: mocks.state.idTokenError });
      },
    },
    functions: {
      invoke: (fn: string, options: { body: unknown }) => {
        mocks.state.invokeCalls.push({ fn, body: options.body });
        return Promise.resolve({ data: { ok: true }, error: null });
      },
    },
  },
}));

vi.mock("./pendingDisplayName", () => ({
  setPendingDisplayName: (value: string | null) => {
    mocks.state.pendingWrites.push(value);
    return Promise.resolve();
  },
  clearPendingDisplayName: () => {
    mocks.state.pendingClears += 1;
    return Promise.resolve();
  },
}));

const { state } = mocks;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

class NativeError extends Error {
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.code = code;
  }
}

beforeEach(() => {
  mocks.reset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signInWithApple's nonce", () => {
  it("gives Apple the hash and Supabase the raw value", async () => {
    const { signInWithApple } = await import("./appleSignIn");

    await signInWithApple();

    const hashed = state.signInCalls[0]?.nonce;
    const raw = state.idTokenCalls[0]?.nonce;
    expect(typeof hashed).toBe("string");
    expect(typeof raw).toBe("string");
    // The direction is the whole contract: GoTrue hashes what it is given and compares it with
    // the claim Apple wrote, which is whatever Apple was given.
    expect(hashed).toBe(await sha256Hex(raw as string));
    expect(hashed).not.toBe(raw);
  });

  it("sends a lowercase hex SHA-256, which is the form GoTrue compares against", async () => {
    const { signInWithApple } = await import("./appleSignIn");

    await signInWithApple();

    expect(state.signInCalls[0]?.nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses a raw nonce with 256 bits in it", async () => {
    const { signInWithApple } = await import("./appleSignIn");

    await signInWithApple();

    expect(state.idTokenCalls[0]?.nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("still asks for the name and email, and signs in with the identity token", async () => {
    const { signInWithApple } = await import("./appleSignIn");

    await signInWithApple();

    expect(state.signInCalls[0]?.requestedScopes).toEqual([0, 1]);
    expect(state.idTokenCalls[0]).toMatchObject({ provider: "apple", token: "apple-id-token" });
  });

  it("prefills the given name only, and registers the authorization code after the session exists", async () => {
    const { signInWithApple } = await import("./appleSignIn");

    await signInWithApple();

    expect(state.pendingWrites).toEqual(["Ada"]);
    expect(state.invokeCalls).toEqual([{ fn: "apple-authorization", body: { authorizationCode: "apple-auth-code" } }]);
  });

  it("drops the pending name and registers nothing when Supabase refuses the token", async () => {
    state.idTokenError = { message: "Nonces mismatch" };
    const { signInWithApple } = await import("./appleSignIn");

    await expect(signInWithApple()).rejects.toMatchObject({ message: "Nonces mismatch" });

    expect(state.pendingClears).toBe(1);
    expect(state.invokeCalls).toEqual([]);
  });
});

describe("appleAuthorizationCodeForDeletion", () => {
  it("returns a fresh code from Apple, asking for no scopes and no name", async () => {
    state.signInResult = { identityToken: "t", authorizationCode: "fresh-code", fullName: null };
    const { appleAuthorizationCodeForDeletion } = await import("./appleSignIn");

    await expect(appleAuthorizationCodeForDeletion()).resolves.toBe("fresh-code");

    expect(state.signInCalls).toEqual([{ requestedScopes: [] }]);
    // Nothing about a deletion may sign anybody in, or re-register anything.
    expect(state.idTokenCalls).toEqual([]);
    expect(state.invokeCalls).toEqual([]);
    expect(state.pendingWrites).toEqual([]);
  });

  it("answers null, without throwing, when the user dismisses Apple's sheet", async () => {
    state.signInThrow = new NativeError("The user canceled the authorization attempt", "ERR_REQUEST_CANCELED");
    const { appleAuthorizationCodeForDeletion } = await import("./appleSignIn");

    await expect(appleAuthorizationCodeForDeletion()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("answers null when Apple fails for any other reason", async () => {
    state.signInThrow = new NativeError("The operation couldn't be completed.", "ERR_INVALID_RESPONSE");
    const { appleAuthorizationCodeForDeletion } = await import("./appleSignIn");

    await expect(appleAuthorizationCodeForDeletion()).resolves.toBeNull();
  });

  it("answers null when Apple returns no code", async () => {
    state.signInResult = { identityToken: "t", authorizationCode: null, fullName: null };
    const { appleAuthorizationCodeForDeletion } = await import("./appleSignIn");

    await expect(appleAuthorizationCodeForDeletion()).resolves.toBeNull();
  });

  it("never shows the sheet where Sign in with Apple is unavailable", async () => {
    state.available = false;
    const { appleAuthorizationCodeForDeletion } = await import("./appleSignIn");

    await expect(appleAuthorizationCodeForDeletion()).resolves.toBeNull();
    expect(state.signInCalls).toEqual([]);
  });

  it("answers null when even the availability check throws", async () => {
    state.availableThrows = true;
    const { appleAuthorizationCodeForDeletion } = await import("./appleSignIn");

    await expect(appleAuthorizationCodeForDeletion()).resolves.toBeNull();
    expect(state.signInCalls).toEqual([]);
  });

  it("does not try at all off iOS", async () => {
    state.os = "android";
    const { appleAuthorizationCodeForDeletion } = await import("./appleSignIn");

    await expect(appleAuthorizationCodeForDeletion()).resolves.toBeNull();
    expect(state.signInCalls).toEqual([]);
  });
});
