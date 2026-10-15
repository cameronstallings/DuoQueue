import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import type { CatalogItem } from "./customGames";

// Moved to customGames.ts in 1.0.2 (the onboarding store needs it without this hook module);
// re-exported so every existing import keeps working.
export { type CatalogItem, createCustomCatalogEntry } from "./customGames";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Below this, searching is meaningless — one letter matches half the catalog. */
export const CATALOG_MIN_QUERY = 2;

const SEARCH_LIMIT = 25;

/**
 * Always filtered. An unfiltered fetch used to run whenever the box was empty, returning the
 * first 25 rows by name, so the screen opened on an A-to-Z slab of whatever happens to sort
 * first, under a caption asking the user to type. The catalog is far too big for a browsable list
 * to be useful; search is the feature.
 */
async function searchByName(table: "games" | "shows", text: string): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .ilike("name", `%${text}%`)
    .order("name")
    .limit(SEARCH_LIMIT);
  if (error) throw error;
  return data as CatalogItem[];
}

/**
 * Games search through `search_games` (0078): names AND aliases, best match first, so "lol" finds
 * League of Legends and "r6" finds Rainbow Six Siege, which a name ILIKE never could.
 *
 * FALLS BACK TO THE NAME SEARCH ON ANY RPC FAILURE. The function is not live on every environment
 * (a local or older database), and before 0084 it refused signed-out callers, who are exactly the
 * players on the wizard's games step in 1.0.2. The fallback still finds games by name, so search
 * degrades to 1.0.1's instead of breaking.
 */
async function searchGames(text: string): Promise<CatalogItem[]> {
  try {
    const { data, error } = await supabase.rpc("search_games", { p_query: text, p_limit: SEARCH_LIMIT });
    if (!error && Array.isArray(data)) {
      return (data as { id: string; name: string }[]).map(({ id, name }) => ({ id, name }));
    }
  } catch {
    // Same as an error answer: the name search below.
  }
  return searchByName("games", text);
}

/**
 * The catalog search behind CatalogPicker. Returns the query plus `debounced`, the text the
 * results are for, so the picker can tell a SETTLED empty search from one still catching up with
 * the keyboard (catalogSearch.ts, `showNoMatches` and `showAddCustom`).
 *
 * `keepPreviousData`: while a new query runs, the last results stay on screen instead of the list
 * collapsing to a skeleton on every keystroke and growing back a moment later.
 */
export function useCatalogSearch(table: "games" | "shows", query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);
  const enabled = debounced.length >= CATALOG_MIN_QUERY;

  const result = useQuery({
    queryKey: [table, "search", debounced],
    queryFn: (): Promise<CatalogItem[]> => (table === "games" ? searchGames(debounced) : searchByName(table, debounced)),
    enabled,
    placeholderData: keepPreviousData,
  });

  return { ...result, debounced };
}
