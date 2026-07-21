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

export function useCatalogSearch(table: "games" | "shows", query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);

  return useQuery({
    queryKey: [table, "search", debounced],
    queryFn: async (): Promise<CatalogItem[]> => {
      let request = supabase.from(table).select("id, name").order("name").limit(25);
      if (debounced.length > 0) {
        request = request.ilike("name", `%${debounced}%`);
      }
      const { data, error } = await request;
      if (error) throw error;
      return data as CatalogItem[];
    },
    enabled: true,
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
