import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one decision in customGames.ts that can go wrong quietly: a custom game picked signed out
 * whose name the catalog already has by Save. The insert answers 23505 and the existing row must
 * be used; anything else must fail the save rather than drop the game.
 */
const mocks = vi.hoisted(() => {
  const state = {
    insertError: null as { code: string; message: string } | null,
    lookupRows: [] as { id: string; name: string }[],
    lookupError: null as { message: string } | null,
    ilikePatterns: [] as string[],
    inserts: [] as Record<string, unknown>[],
  };

  const supabase = {
    from: (table: string) => {
      const builder = {
        insert: (row: Record<string, unknown>) => {
          state.inserts.push({ table, ...row });
          return {
            select: () => ({
              single: () =>
                Promise.resolve(
                  state.insertError
                    ? { data: null, error: state.insertError }
                    : { data: { id: "new-id", name: row.name }, error: null },
                ),
            }),
          };
        },
        select: () => builder,
        ilike: (_column: string, pattern: string) => {
          state.ilikePatterns.push(pattern);
          return builder;
        },
        limit: () => Promise.resolve({ data: state.lookupError ? null : state.lookupRows, error: state.lookupError }),
      };
      return builder;
    },
  };

  return { state, supabase };
});

vi.mock("@/lib/supabase", () => ({ supabase: mocks.supabase }));

const { state } = mocks;

beforeEach(() => {
  state.insertError = null;
  state.lookupRows = [];
  state.lookupError = null;
  state.ilikePatterns = [];
  state.inserts = [];
});

describe("resolveCustomGame", () => {
  it("creates the game, owned by the new account", async () => {
    const { resolveCustomGame } = await import("./customGames");
    await expect(resolveCustomGame("Deep Rock", "u1")).resolves.toEqual({ id: "new-id", name: "Deep Rock" });
    expect(state.inserts).toEqual([{ table: "games", name: "Deep Rock", is_custom: true, created_by: "u1" }]);
  });

  it("uses the existing row when the name is already taken (23505)", async () => {
    const { resolveCustomGame } = await import("./customGames");
    state.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    state.lookupRows = [{ id: "old-id", name: "Valorant" }];
    await expect(resolveCustomGame("valorant", "u1")).resolves.toEqual({ id: "old-id", name: "Valorant" });
  });

  it("escapes LIKE wildcards in the lookup", async () => {
    const { resolveCustomGame } = await import("./customGames");
    state.insertError = { code: "23505", message: "dup" };
    state.lookupRows = [{ id: "x", name: "100%_Orange" }];
    await resolveCustomGame("100%_Orange", "u1");
    expect(state.ilikePatterns).toEqual(["100\\%\\_Orange"]);
  });

  it("rethrows any other insert failure", async () => {
    const { resolveCustomGame } = await import("./customGames");
    state.insertError = { code: "42501", message: "permission denied" };
    await expect(resolveCustomGame("Deep Rock", "u1")).rejects.toMatchObject({ code: "42501" });
  });

  it("rethrows the 23505 when the lookup finds nothing", async () => {
    const { resolveCustomGame } = await import("./customGames");
    state.insertError = { code: "23505", message: "dup" };
    await expect(resolveCustomGame("Ghost", "u1")).rejects.toMatchObject({ code: "23505" });
  });
});
