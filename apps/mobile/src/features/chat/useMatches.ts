import { useQuery } from "@tanstack/react-query";
import type { MatchSummary } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { signPhotoUrls } from "@/lib/storage";

export interface MatchListItem extends MatchSummary {
  otherPhotoUrl: string | null;
}

export const MATCHES_QUERY_KEY = ["matches-summary"] as const;

async function fetchMatches(): Promise<MatchListItem[]> {
  const { data, error } = await supabase.rpc("get_matches_summary");
  if (error) throw error;
  const rows = (data ?? []) as MatchSummary[];

  const photoPaths = rows.map((r) => r.other_photo_path).filter((p): p is string => !!p);
  const signedUrls = await signPhotoUrls(photoPaths);

  return rows.map((row) => ({
    ...row,
    otherPhotoUrl: row.other_photo_path ? (signedUrls.get(row.other_photo_path) ?? null) : null,
  }));
}

export function useMatches() {
  return useQuery({
    queryKey: MATCHES_QUERY_KEY,
    queryFn: fetchMatches,
    refetchInterval: 15_000,
  });
}
