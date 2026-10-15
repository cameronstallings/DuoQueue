import { supabase } from "@/lib/supabase";

/** A catalog row as the pickers use it. */
export interface CatalogItem {
  id: string;
  name: string;
}

/**
 * Inserts a player-made catalog entry (`games_insert_custom` / `shows_insert_custom` allow it for
 * the caller's own `created_by`). Moved here unchanged from useCatalogSearch.ts in 1.0.2, which
 * re-exports it, so the onboarding store can reach it without importing a React hook module.
 */
export async function createCustomCatalogEntry(
  table: "games" | "shows",
  name: string,
  createdBy: string,
): Promise<CatalogItem> {
  const { data, error } = await supabase
    .from(table)
    .insert({ name, is_custom: true, created_by: createdBy })
    .select("id, name")
    .single();
  if (error) throw error;
  return data as CatalogItem;
}

/** `%`, `_` and the escape character itself are wildcards in LIKE; a game name is not a pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * The catalog row for a custom game picked while signed out (held in the draft under a pending
 * id, see catalogSearch.ts), created inside `submit()` once there is an account to own it.
 *
 * WHY THE FALLBACK. The name may already exist by the time Save is tapped: someone else added it
 * in the meantime, or the catalog had it under different capitals (the player typed "valorant"
 * and never searched). `games_name_lower_idx` is unique on lower(name), so the insert answers
 * 23505 and the existing row is the right one to use. Any other failure is a real one and is
 * rethrown, so the card is never saved without a game the player chose.
 */
export async function resolveCustomGame(name: string, profileId: string): Promise<CatalogItem> {
  try {
    return await createCustomCatalogEntry("games", name, profileId);
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code !== "23505") throw err;
    const { data, error } = await supabase.from("games").select("id, name").ilike("name", escapeLike(name)).limit(1);
    if (error) throw error;
    const row = (data as CatalogItem[] | null)?.[0];
    if (!row) throw err;
    return row;
  }
}
