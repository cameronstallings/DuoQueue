import { describe, expect, it, vi } from "vitest";

import { createKeyAwareFetch, isApiKeyRejection, supabaseKeyKind } from "./supabaseKey";

/**
 * The app's Supabase key: which kind it is (a secret key must never ship), and how a dead key is
 * told apart from an expired session. The live gateway answers a bad key with 401
 * {"message":"Invalid API key"}; an expired session says "JWT" and must never trigger the update
 * screen.
 */
function base64url(text: string): string {
  return Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jwt(payload: Record<string, unknown>): string {
  return `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(JSON.stringify(payload))}.c2lnbmF0dXJl`;
}

describe("supabaseKeyKind", () => {
  it("recognises the new key formats by prefix", () => {
    expect(supabaseKeyKind("sb_publishable_abc123")).toBe("publishable");
    expect(supabaseKeyKind("sb_secret_abc123")).toBe("secret");
  });

  it("reads a legacy JWT's role", () => {
    expect(supabaseKeyKind(jwt({ iss: "supabase", ref: "abcdefgh", role: "anon" }))).toBe("legacy");
    expect(supabaseKeyKind(jwt({ iss: "supabase", ref: "abcdefgh", role: "service_role" }))).toBe("secret");
  });

  it("decodes base64url payloads (the - and _ alphabet)", () => {
    // A payload whose standard base64 would contain + or /.
    const key = jwt({ role: "service_role", pad: "???>>>~~~" });
    expect(key.split(".")[1]).toMatch(/[-_]/);
    expect(supabaseKeyKind(key)).toBe("secret");
  });

  it("calls an undecodable eyJ string legacy, never secret", () => {
    expect(supabaseKeyKind("eyJhbGciOi.%%%not-base64%%%.sig")).toBe("legacy");
    expect(supabaseKeyKind("eyJonly-one-part")).toBe("legacy");
  });

  it("calls anything else unknown", () => {
    for (const key of ["", undefined, null, "hello", 42]) {
      expect(supabaseKeyKind(key)).toBe("unknown");
    }
  });
});

describe("isApiKeyRejection", () => {
  it("matches a 401 that names the API key", () => {
    expect(isApiKeyRejection(401, '{"message":"Invalid API key"}')).toBe(true);
    expect(isApiKeyRejection(401, '{"msg":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}')).toBe(true);
    expect(isApiKeyRejection(401, '{"message":"Legacy API keys are disabled"}')).toBe(true);
  });

  it("never matches an expired or bad session", () => {
    expect(isApiKeyRejection(401, '{"message":"JWT expired"}')).toBe(false);
    expect(isApiKeyRejection(401, '{"code":"PGRST301","message":"invalid JWT: unable to parse or verify signature"}')).toBe(false);
  });

  it("only looks at 401s", () => {
    expect(isApiKeyRejection(403, '{"message":"Invalid API key"}')).toBe(false);
    expect(isApiKeyRejection(500, '{"message":"Invalid API key"}')).toBe(false);
    expect(isApiKeyRejection(200, '{"message":"Invalid API key"}')).toBe(false);
  });

  it("does not match unrelated text", () => {
    expect(isApiKeyRejection(401, "")).toBe(false);
    expect(isApiKeyRejection(401, '{"message":"Invalid login credentials"}')).toBe(false);
    expect(isApiKeyRejection(401, '{"message":"apikeys_table missing"}')).toBe(false);
  });
});

describe("createKeyAwareFetch", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("hands back a 200 untouched and never calls back", async () => {
    const response = new Response("ok", { status: 200 });
    const onKeyRejected = vi.fn();
    const keyAware = createKeyAwareFetch(async () => response, onKeyRejected);
    const result = await keyAware("https://example.supabase.co/rest/v1/x");
    expect(result).toBe(response);
    await flush();
    expect(onKeyRejected).not.toHaveBeenCalled();
  });

  it("calls back once on a key rejection, and the caller can still read the body", async () => {
    const response = new Response('{"message":"Invalid API key"}', { status: 401 });
    const onKeyRejected = vi.fn();
    const keyAware = createKeyAwareFetch(async () => response, onKeyRejected);
    const result = await keyAware("https://example.supabase.co/rest/v1/x");
    expect(result).toBe(response);
    expect(await result.text()).toBe('{"message":"Invalid API key"}');
    await flush();
    expect(onKeyRejected).toHaveBeenCalledTimes(1);
  });

  it("never calls back on a JWT 401", async () => {
    const onKeyRejected = vi.fn();
    const keyAware = createKeyAwareFetch(async () => new Response('{"message":"JWT expired"}', { status: 401 }), onKeyRejected);
    await keyAware("https://example.supabase.co/auth/v1/user");
    await flush();
    expect(onKeyRejected).not.toHaveBeenCalled();
  });

  it("swallows a body read that throws", async () => {
    const broken = {
      status: 401,
      clone: () => ({
        text: () => Promise.reject(new Error("stream gone")),
      }),
    } as unknown as Response;
    const onKeyRejected = vi.fn();
    const keyAware = createKeyAwareFetch(async () => broken, onKeyRejected);
    await expect(keyAware("https://example.supabase.co/rest/v1/x")).resolves.toBe(broken);
    await flush();
    expect(onKeyRejected).not.toHaveBeenCalled();
  });

  it("swallows a callback that throws or rejects", async () => {
    const keyAware = createKeyAwareFetch(
      async () => new Response('{"message":"Invalid API key"}', { status: 401 }),
      () => Promise.reject(new Error("boom")),
    );
    await expect(keyAware("https://example.supabase.co/rest/v1/x")).resolves.toBeInstanceOf(Response);
    await flush();
  });

  it("lets a rejected base fetch propagate", async () => {
    const keyAware = createKeyAwareFetch(() => Promise.reject(new TypeError("Network request failed")), vi.fn());
    await expect(keyAware("https://example.supabase.co/rest/v1/x")).rejects.toThrow("Network request failed");
  });

  it("passes the input and init through", async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("ok"));
    const keyAware = createKeyAwareFetch(base, vi.fn());
    const init = { method: "POST", body: "{}" };
    await keyAware("https://example.supabase.co/rest/v1/rpc/x", init);
    expect(base).toHaveBeenCalledWith("https://example.supabase.co/rest/v1/rpc/x", init);
  });
});
