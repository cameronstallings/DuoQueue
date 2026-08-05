import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export interface CatalogItem {
  id: string;
  name: string;
}

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

export function useCatalogSearch(table: "games" | "shows", query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);
  const enabled = debounced.length >= CATALOG_MIN_QUERY;

  return useQuery({
    queryKey: [table, "search", debounced],
    queryFn: async (): Promise<CatalogItem[]> => {
      // Always filtered. An unfiltered fetch used to run whenever the box was empty,
      // returning the first 25 rows by name — so the screen opened on an A-to-Z slab of
      // whatever happens to sort first, under a caption asking the user to type. The
      // catalog is far too big for a browsable list to be useful; search is the feature.
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .ilike("name", `%${debounced}%`)
        .order("name")
        .limit(25);
      if (error) throw error;
      return data as CatalogItem[];
    },
    enabled,
  });
}

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
