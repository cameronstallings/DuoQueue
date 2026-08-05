import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LinkedAccountProvider, LinkedAccountRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

const FUNCTIONS_BASE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

export function usePublicLinkedAccounts(profileId: string | undefined) {
  return useQuery({
    queryKey: ["public-linked-accounts", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_linked_accounts")
        .select("provider, display_name, rank_tier")
        .eq("profile_id", profileId);
      if (error) throw error;
      return (data ?? []) as Pick<LinkedAccountRow, "provider" | "display_name" | "rank_tier">[];
    },
    enabled: !!profileId,
  });
}

export function useLinkedAccounts(profileId: string | undefined) {
  return useQuery({
    queryKey: ["linked-accounts", profileId],
    queryFn: async () => {
      // Named columns, not `*`: `raw_data` holds the provider's profile payload, which
      // nothing here reads — selecting it would ship that data to the device for no
      // reason. Collect and expose only what's actually used.
      const { data, error } = await supabase
        .from("linked_accounts")
        .select("profile_id, provider, external_id, display_name, rank_tier, avatar_url, linked_at")
        .eq("profile_id", profileId);
      if (error) throw error;
      return (data ?? []) as LinkedAccountRow[];
    },
    enabled: !!profileId,
  });
}

export function useLinkSteamAccount(profileId: string | undefined) {
  const queryClient = useQueryClient();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startLink() {
    setError(null);
    setLinking(true);
    try {
      const { data: state, error: stateError } = await supabase.rpc("start_steam_link");
      if (stateError || !state) throw stateError ?? new Error("Could not start Steam link.");

      const returnTo = `${FUNCTIONS_BASE_URL}/link-steam-callback?state=${encodeURIComponent(state as string)}`;
      const steamLoginUrl = new URL("https://steamcommunity.com/openid/login");
      steamLoginUrl.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
      steamLoginUrl.searchParams.set("openid.mode", "checkid_setup");
      steamLoginUrl.searchParams.set("openid.return_to", returnTo);
      steamLoginUrl.searchParams.set("openid.realm", FUNCTIONS_BASE_URL);
      steamLoginUrl.searchParams.set("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select");
      steamLoginUrl.searchParams.set("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select");

      const result = await WebBrowser.openAuthSessionAsync(steamLoginUrl.toString(), "duoqueue://link-steam-result");
      if (result.type === "success" && result.url.includes("result=error")) {
        const detail = new URL(result.url).searchParams.get("detail");
        setError(detail ?? "Steam linking failed. Please try again.");
      } else if (result.type === "success") {
        void queryClient.invalidateQueries({ queryKey: ["linked-accounts", profileId] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLinking(false);
    }
  }

  return { startLink, linking, error };
}

export function useUnlinkAccount(profileId: string | undefined) {
  const queryClient = useQueryClient();
  const [unlinking, setUnlinking] = useState(false);
  return {
    unlinking,
    unlink: async (provider: LinkedAccountProvider) => {
      if (!profileId) return;
      setUnlinking(true);
      try {
        await supabase.from("linked_accounts").delete().eq("profile_id", profileId).eq("provider", provider);
        void queryClient.invalidateQueries({ queryKey: ["linked-accounts", profileId] });
      } finally {
        setUnlinking(false);
      }
    },
  };
}
