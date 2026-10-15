import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The onboarding store: the display-name prefill (Guideline 4.0), and since 1.0.2 the persisted
 * signup draft (the card is built before the account exists, D1).
 *
 * displayNameSeed.test.ts and commitDraft.test.ts prove the decisions. This proves what only the
 * store can get wrong: that the decisions are applied to its state, that nothing written before
 * the read-back can overwrite the stored draft, and that `submit` writes what the draft holds.
 *
 * Every aliased import is mocked by its literal specifier (Vite does not resolve `@/`), with
 * displayNameSeed mocked to its own real implementation so the decision is not a stub. The pure
 * draft modules (commitDraft, catalogSearch, steps) are imported relatively by the store and run
 * as themselves. AsyncStorage is an in-memory map whose reads can be held back, which is how the
 * "before hydration" cases are reached.
 */
const KEY = "duoqueue.onboarding-draft";

const mocks = vi.hoisted(() => {
  const state = {
    storage: new Map<string, string>(),
    storageWrites: [] as string[],
    heldReads: [] as (() => void)[],
    holdReads: false,
    profileUpdates: [] as Record<string, unknown>[],
    uploads: [] as string[],
    failUpload: false,
    photoExists: true,
    photoClears: 0,
    alreadyOnboarded: false,
    /** In order: "resolve:<name>", "insert:<table>". */
    events: [] as string[],
    inserts: {} as Record<string, Record<string, unknown>[]>,
    /** What resolveCustomGame answers for a name (an existing catalog id after a 23505, say). */
    resolveIds: {} as Record<string, string>,
  };

  function reset(): void {
    state.storage = new Map();
    state.storageWrites = [];
    state.heldReads = [];
    state.holdReads = false;
    state.profileUpdates = [];
    state.uploads = [];
    state.failUpload = false;
    state.photoExists = true;
    state.photoClears = 0;
    state.alreadyOnboarded = false;
    state.events = [];
    state.inserts = {};
    state.resolveIds = {};
  }

  const asyncStorage = {
    getItem: (key: string) => {
      const read = () => state.storage.get(key) ?? null;
      if (!state.holdReads) return Promise.resolve(read());
      return new Promise<string | null>((resolve) => state.heldReads.push(() => resolve(read())));
    },
    setItem: (key: string, value: string) => {
      state.storageWrites.push(key);
      state.storage.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      state.storage.delete(key);
      return Promise.resolve();
    },
  };

  /** Just enough PostgREST builder for the chains `submit` uses. Every chain resolves cleanly. */
  function makeBuilder(table: string) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      delete: () => builder,
      insert: (rows: Record<string, unknown>[]) => {
        state.events.push(`insert:${table}`);
        state.inserts[table] = rows;
        return builder;
      },
      update: (patch: Record<string, unknown>) => {
        if (table === "profiles") state.profileUpdates.push(patch);
        return builder;
      },
      single: () => Promise.resolve({ data: { onboarding_completed: state.alreadyOnboarded }, error: null }),
      then: (onOk: (value: { error: null }) => unknown, onErr?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(onOk, onErr),
    };
    return builder;
  }

  const supabase = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: (table: string) => makeBuilder(table),
  };

  return { state, reset, supabase, asyncStorage };
});

vi.mock("@react-native-async-storage/async-storage", () => ({ default: mocks.asyncStorage }));

vi.mock("@/lib/supabase", () => ({ supabase: mocks.supabase }));

vi.mock("@/features/profile/usePhotoUpload", () => ({
  uploadPicture: (_profileId: string, uri: string) => {
    if (mocks.state.failUpload) return Promise.reject(new Error("That photo is too large. Please choose one under 5MB."));
    mocks.state.uploads.push(uri);
    return Promise.resolve();
  },
}));

vi.mock("@/features/onboarding/customGames", () => ({
  resolveCustomGame: (name: string) => {
    mocks.state.events.push(`resolve:${name}`);
    return Promise.resolve({ id: mocks.state.resolveIds[name] ?? `created-${name}`, name });
  },
}));

vi.mock("@/features/onboarding/draftPhoto", () => ({
  draftPhotoExists: () => Promise.resolve(mocks.state.photoExists),
  clearDraftPhotos: () => {
    mocks.state.photoClears += 1;
    return Promise.resolve();
  },
  keepDraftPhoto: (uri: string) => Promise.resolve(uri),
}));

vi.mock("@/features/onboarding/displayNameSeed", async () => await import("../features/onboarding/displayNameSeed"));

// The League rank additions (0069). The row builder and the error mapping are pure and run as
// themselves; the League game lookup answers "unknown", so every game is written as free text,
// which is what these tests were written against.
vi.mock("@/features/league/leagueGame", () => ({ getLeagueGameId: () => Promise.resolve(null) }));
vi.mock("@/features/league/rankPickerState", async () => await import("../features/league/rankPickerState"));
vi.mock("@/lib/userMessage", async () => await import("../lib/userMessage"));

const { state } = mocks;

type Store = Awaited<ReturnType<typeof importStore>>["useOnboardingStore"];

async function importStore() {
  vi.resetModules();
  return await import("./onboarding-store");
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForHydration(store: Store): Promise<void> {
  if (!store.persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsubscribe = store.persist.onFinishHydration(() => {
        unsubscribe();
        resolve();
      });
    });
  }
  await settle();
}

/** A fresh store, read back from whatever `state.storage` holds. */
async function loadStore(): Promise<Store> {
  const { useOnboardingStore } = await importStore();
  await waitForHydration(useOnboardingStore);
  return useOnboardingStore;
}

function stored(): Record<string, unknown> {
  const raw = state.storage.get(KEY);
  if (!raw) throw new Error("nothing stored");
  return (JSON.parse(raw) as { state: Record<string, unknown> }).state;
}

function seedStorage(draft: Record<string, unknown>): void {
  state.storage.set(KEY, JSON.stringify({ state: { draftStartedAt: Date.now(), ...draft }, version: 1 }));
}

function releaseReads(): void {
  for (const release of state.heldReads.splice(0)) release();
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

describe("the persisted draft", () => {
  it("writes only the draft to the phone, never the transient fields", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");
    store.setState({ submitting: true, submitError: "x" });
    await settle();

    const keys = Object.keys(stored());
    expect(keys).toContain("displayName");
    expect(keys).toContain("ageConfirmedDob");
    expect(keys).not.toContain("hydrated");
    expect(keys).not.toContain("submitting");
    expect(keys).not.toContain("submitError");
    expect(stored().displayName).toBe("Ada");
  });

  it("never lets a write made before the read-back reach storage", async () => {
    seedStorage({ displayName: "Stored", ageConfirmedDob: "2000-01-01" });
    state.holdReads = true;
    const { useOnboardingStore: store } = await importStore();

    store.getState().setDisplayName("Early");
    store.setState({ hydrated: true });
    await settle();
    expect(state.storageWrites).toEqual([]);

    releaseReads();
    await waitForHydration(store);

    expect(store.getState().displayName).toBe("Stored");
    expect(stored().displayName).toBe("Stored");
    expect(store.getState().hydrated).toBe(true);
  });

  it("holds routing until the read-back, then reports hydrated", async () => {
    state.holdReads = true;
    const { useOnboardingStore: store } = await importStore();
    expect(store.getState().hydrated).toBe(false);

    releaseReads();
    await waitForHydration(store);
    expect(store.getState().hydrated).toBe(true);
  });

  it("resumes a draft on relaunch with every answer", async () => {
    const first = await loadStore();
    first.getState().setAgeConfirmedDob("2000-01-01");
    first.getState().setDisplayName("Ada");
    first.getState().setRegion("eu");
    first.getState().toggleLanguage("fr");
    first.getState().setLastStep("platforms");
    await settle();

    const second = await loadStore();
    expect(second.getState()).toMatchObject({
      ageConfirmedDob: "2000-01-01",
      displayName: "Ada",
      region: "eu",
      languages: ["fr"],
      lastStep: "platforms",
    });
  });

  it("drops a draft older than 7 days on relaunch", async () => {
    seedStorage({ displayName: "Old", draftStartedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });
    const store = await loadStore();
    expect(store.getState().displayName).toBe("");
  });

  it("starts the 7-day clock at the age gate, and only once", async () => {
    const store = await loadStore();
    store.getState().setAgeConfirmedDob("2000-01-01");
    const startedAt = store.getState().draftStartedAt;
    expect(startedAt).not.toBeNull();
    store.getState().setAgeConfirmedDob("2001-01-01");
    expect(store.getState().draftStartedAt).toBe(startedAt);
  });

  it("discards the draft and the kept picture, and stays hydrated", async () => {
    const store = await loadStore();
    store.getState().setAgeConfirmedDob("2000-01-01");
    store.getState().setDisplayName("Ada");
    store.getState().setCommitPending(true);
    store.getState().setReadyToSave(true);

    store.getState().discardDraft();

    expect(store.getState()).toMatchObject({
      hydrated: true,
      ageConfirmedDob: null,
      draftStartedAt: null,
      displayName: "",
      commitPending: false,
      readyToSave: false,
      lastStep: null,
    });
    expect(state.photoClears).toBe(1);
  });

  it("makes reset the same as discardDraft", async () => {
    const store = await loadStore();
    store.getState().setAgeConfirmedDob("2000-01-01");
    store.getState().reset();
    expect(store.getState().ageConfirmedDob).toBeNull();
    expect(store.getState().hydrated).toBe(true);
    expect(state.photoClears).toBe(1);
  });
});

describe("setLastStep and prefillFromDevice", () => {
  it("do nothing before the read-back", async () => {
    state.holdReads = true;
    const { useOnboardingStore: store } = await importStore();

    store.getState().setLastStep("games");
    store.getState().prefillFromDevice({ region: "eu", languages: ["fr"] });
    expect(store.getState().lastStep).toBeNull();
    expect(store.getState().region).toBeNull();
    expect(store.getState().devicePrefilled).toBe(false);

    releaseReads();
    await waitForHydration(store);

    store.getState().setLastStep("games");
    expect(store.getState().lastStep).toBe("games");
  });

  it("prefills once, and never over a region the player chose", async () => {
    const store = await loadStore();
    store.getState().setRegion("na_west");

    store.getState().prefillFromDevice({ region: "eu", languages: ["fr"] });
    expect(store.getState()).toMatchObject({ region: "na_west", languages: ["fr"], devicePrefilled: true });

    store.getState().toggleLanguage("fr");
    store.getState().prefillFromDevice({ region: "sa", languages: ["es"] });
    expect(store.getState()).toMatchObject({ region: "na_west", languages: [] });
  });

  it("fills an empty region and empty languages", async () => {
    const store = await loadStore();
    store.getState().prefillFromDevice({ region: "na_east", languages: ["en", "es"] });
    expect(store.getState()).toMatchObject({ region: "na_east", languages: ["en", "es"] });
  });

  it("keeps languages the player already picked", async () => {
    const store = await loadStore();
    store.getState().toggleLanguage("de");
    store.getState().prefillFromDevice({ region: null, languages: ["en"] });
    expect(store.getState()).toMatchObject({ region: null, languages: ["de"] });
  });
});

describe("addCustomGame", () => {
  it("adds a pending game once, under its normalized name", async () => {
    const store = await loadStore();
    store.getState().addCustomGame("  Deep   Rock ");
    store.getState().addCustomGame("Deep Rock");

    expect(store.getState().games).toEqual([
      {
        gameId: "pending:Deep Rock",
        name: "Deep Rock",
        skillLevel: "casual",
        rankText: "",
        lolTier: null,
        lolDivision: null,
      },
    ]);
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

  it("trims the name and the Discord it writes", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("  Ada  ");
    store.getState().setDiscordUsername("  name ");

    await store.getState().submit();

    expect(state.profileUpdates.at(-1)).toMatchObject({ display_name: "Ada", discord_username: "name" });
  });

  it("writes a blank Discord as none", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");
    store.getState().setDiscordUsername("   ");

    await store.getState().submit();

    expect(state.profileUpdates.at(-1)?.discord_username).toBeNull();
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

  it("skips the upload when the kept picture is gone, and says so", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");
    store.getState().setProfilePhotoUri("file:///gone.jpg");
    state.photoExists = false;

    const result = await store.getState().submit();

    expect(state.uploads).toEqual([]);
    expect(result).toEqual({ pictureUploadFailed: true });
    expect(state.profileUpdates.at(-1)?.onboarding_completed).toBe(true);
  });

  it("creates pending custom games before the profile_games insert names them", async () => {
    const store = await loadStore();
    store.getState().setDisplayName("Ada");
    store.getState().addGame({ gameId: "lol-id", name: "League of Legends" });
    store.getState().addCustomGame("Deep Rock");

    await store.getState().submit();

    const resolveAt = state.events.indexOf("resolve:Deep Rock");
    const insertAt = state.events.indexOf("insert:profile_games");
    expect(resolveAt).toBeGreaterThanOrEqual(0);
    expect(resolveAt).toBeLessThan(insertAt);
    expect(state.inserts.profile_games?.map((r) => r.game_id)).toEqual(["lol-id", "created-Deep Rock"]);
  });

  it("uses the existing catalog row a taken name resolves to, once", async () => {
    // resolveCustomGame answers a 23505 with the existing row (customGames.test.ts); here that
    // row is a game the player also picked from the catalog, so it is written once.
    const store = await loadStore();
    store.getState().setDisplayName("Ada");
    store.getState().addGame({ gameId: "val-id", name: "Valorant" });
    store.getState().addCustomGame("valorant");
    state.resolveIds = { valorant: "val-id" };

    await store.getState().submit();

    expect(state.inserts.profile_games?.map((r) => r.game_id)).toEqual(["val-id"]);
    expect(state.inserts.profile_games?.map((r) => r.priority)).toEqual([0]);
  });

  it("refuses a finished profile with ProfileAlreadySetUpError", async () => {
    const { useOnboardingStore: store, ProfileAlreadySetUpError } = await importStore();
    await waitForHydration(store);
    state.alreadyOnboarded = true;

    await expect(store.getState().submit()).rejects.toBeInstanceOf(ProfileAlreadySetUpError);
    expect(state.profileUpdates).toEqual([]);
    expect(store.getState().submitting).toBe(false);
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
