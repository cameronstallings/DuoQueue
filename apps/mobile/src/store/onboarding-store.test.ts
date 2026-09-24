import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store end of the display-name prefill (Guideline 4.0).
 *
 * displayNameSeed.test.ts proves the decision. This proves the two things only the store can get
 * wrong: that the decision is actually applied to its state, and that the name it seeds is the
 * one the wizard's final write puts on the profile. That final write is where the Apple name used
 * to be lost: `submit` always sends `display_name: state.displayName`, and the store used to
 * start every pass with "".
 *
 * Every aliased import is mocked by its literal specifier (Vite does not resolve `@/`), with
 * displayNameSeed mocked to its own real implementation so the decision is not a stub.
 */
const mocks = vi.hoisted(() => {
  const state = {
    profileUpdates: [] as Record<string, unknown>[],
    uploads: [] as string[],
    failUpload: false,
  };

  function reset(): void {
    state.profileUpdates = [];
    state.uploads = [];
    state.failUpload = false;
  }

  /** Just enough PostgREST builder for the chains `submit` uses. Every chain resolves cleanly. */
  function makeBuilder(table: string) {
    let isUpdate = false;
    const builder = {
      select: () => builder,
      eq: () => builder,
      delete: () => builder,
      insert: () => builder,
      update: (patch: Record<string, unknown>) => {
        isUpdate = true;
        if (table === "profiles") state.profileUpdates.push(patch);
        return builder;
      },
      single: () => Promise.resolve({ data: { onboarding_completed: false }, error: null }),
      then: (onOk: (value: { error: null }) => unknown, onErr?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null, isUpdate }).then(onOk, onErr),
    };
    return builder;
  }

  const supabase = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: (table: string) => makeBuilder(table),
  };

  return { state, reset, supabase };
});

vi.mock("@/lib/supabase", () => ({ supabase: mocks.supabase }));

vi.mock("@/features/profile/usePhotoUpload", () => ({
  uploadPicture: (_profileId: string, uri: string) => {
    if (mocks.state.failUpload) return Promise.reject(new Error("That photo is too large. Please choose one under 5MB."));
    mocks.state.uploads.push(uri);
    return Promise.resolve();
  },
}));

vi.mock("@/features/onboarding/displayNameSeed", async () => await import("../features/onboarding/displayNameSeed"));

// The League rank additions (0069). The row builder and the error mapping are pure and run as
// themselves; the League game lookup answers "unknown", so every game is written as free text,
// which is what these tests were written against.
vi.mock("@/features/league/leagueGame", () => ({ getLeagueGameId: () => Promise.resolve(null) }));
vi.mock("@/features/league/rankPickerState", async () => await import("../features/league/rankPickerState"));
vi.mock("@/lib/userMessage", async () => await import("../lib/userMessage"));

const { state } = mocks;

async function loadStore() {
  vi.resetModules();
  const { useOnboardingStore } = await import("./onboarding-store");
  return useOnboardingStore;
}

beforeEach(() => {
  mocks.reset();
});

describe("seedDisplayName", () => {
  it("prefills an empty field with the name on the profile", async () => {
    const store = await loadStore();

    store.getState().seedDisplayName("Ada");

    expect(store.getState().displayName).toBe("Ada");
  });

  it("does not overwrite a name the user already typed", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Nova");

    store.getState().seedDisplayName("Ada");

    expect(store.getState().displayName).toBe("Nova");
  });

  it("does not put the name back after the user cleared it", async () => {
    const store = await loadStore();
    store.getState().seedDisplayName("Ada");
    store.getState().setDisplayName("");

    // The step re-renders and runs its effect again.
    store.getState().seedDisplayName("Ada");

    expect(store.getState().displayName).toBe("");
  });

  it("starts over after reset, which is what sign-out calls", async () => {
    const store = await loadStore();
    store.getState().seedDisplayName("Ada");
    store.getState().reset();

    expect(store.getState().displayName).toBe("");
    expect(store.getState().displayNameSeeded).toBe(false);

    store.getState().seedDisplayName("Grace");
    expect(store.getState().displayName).toBe("Grace");
  });

  it("waits for a name rather than spending its chance on none", async () => {
    const store = await loadStore();

    store.getState().seedDisplayName(null);
    store.getState().seedDisplayName("Ada");

    expect(store.getState().displayName).toBe("Ada");
  });
});

describe("submit", () => {
  it("writes the seeded name back to the profile rather than replacing it", async () => {
    const store = await loadStore();
    store.getState().seedDisplayName("Ada");

    await store.getState().submit();

    const finalWrite = state.profileUpdates.at(-1);
    expect(finalWrite?.display_name).toBe("Ada");
    expect(finalWrite?.onboarding_completed).toBe(true);
  });

  it("writes the user's own name when they changed the prefill", async () => {
    const store = await loadStore();
    store.getState().seedDisplayName("Ada");
    store.getState().setDisplayName("Countess");

    await store.getState().submit();

    expect(state.profileUpdates.at(-1)?.display_name).toBe("Countess");
  });

  it("sends no gender with the finished profile", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");

    await store.getState().submit();

    expect(state.profileUpdates.at(-1)).not.toHaveProperty("gender");
  });

  it("finishes without a picture and uploads nothing", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");

    const result = await store.getState().submit();

    expect(state.uploads).toEqual([]);
    expect(result).toEqual({ pictureUploadFailed: false });
    expect(state.profileUpdates.at(-1)?.onboarding_completed).toBe(true);
  });

  it("uploads the one picture once", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");
    store.getState().setProfilePhotoUri("file:///picture.jpg");

    await store.getState().submit();

    expect(state.uploads).toEqual(["file:///picture.jpg"]);
  });

  it("still finishes onboarding when the picture fails to upload, and says so", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");
    store.getState().setProfilePhotoUri("file:///huge.jpg");
    state.failUpload = true;

    const result = await store.getState().submit();

    expect(result).toEqual({ pictureUploadFailed: true });
    expect(state.profileUpdates.at(-1)?.onboarding_completed).toBe(true);
  });
});

describe("state", () => {
  it("holds no cover photo and no gender", async () => {
    const store = await loadStore();

    expect(store.getState()).not.toHaveProperty("headerPhotoUri");
    expect(store.getState()).not.toHaveProperty("gender");
    expect(store.getState()).not.toHaveProperty("setGender");
  });
});
