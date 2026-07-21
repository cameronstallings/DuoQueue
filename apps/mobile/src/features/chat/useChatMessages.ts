import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DiscordShareRow, MessageRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

import type { ChatTimelineItem } from "./types";

interface ChatData {
  messages: MessageRow[];
  shares: DiscordShareRow[];
}

function chatQueryKey(matchId: string) {
  return ["chat-messages", matchId] as const;
}

async function fetchChatData(matchId: string): Promise<ChatData> {
  const [messagesRes, sharesRes] = await Promise.all([
    supabase.from("messages").select("*").eq("match_id", matchId).order("created_at"),
    supabase.from("discord_shares").select("*").eq("match_id", matchId),
  ]);
  if (messagesRes.error) throw messagesRes.error;
  if (sharesRes.error) throw sharesRes.error;
  return {
    messages: (messagesRes.data ?? []) as MessageRow[],
    shares: (sharesRes.data ?? []) as DiscordShareRow[],
  };
}

export function useChatMessages(matchId: string) {
  const queryClient = useQueryClient();
  const myId = useSessionStore((s) => s.session?.user.id);
  const queryKey = chatQueryKey(matchId);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchChatData(matchId),
    enabled: !!matchId,
  });

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          queryClient.setQueryData<ChatData>(chatQueryKey(matchId), (old) =>
            old
              ? { ...old, messages: [...old.messages, payload.new as MessageRow] }
              : { messages: [payload.new as MessageRow], shares: [] },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const updated = payload.new as MessageRow;
          queryClient.setQueryData<ChatData>(chatQueryKey(matchId), (old) =>
            old ? { ...old, messages: old.messages.map((m) => (m.id === updated.id ? updated : m)) } : old,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "discord_shares", filter: `match_id=eq.${matchId}` },
        (payload) => {
          queryClient.setQueryData<ChatData>(chatQueryKey(matchId), (old) =>
            old
              ? { ...old, shares: [...old.shares, payload.new as DiscordShareRow] }
              : { messages: [], shares: [payload.new as DiscordShareRow] },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "discord_shares", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const updated = payload.new as DiscordShareRow;
          queryClient.setQueryData<ChatData>(chatQueryKey(matchId), (old) =>
            old ? { ...old, shares: old.shares.map((s) => (s.id === updated.id ? updated : s)) } : old,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  const timeline = useMemo<ChatTimelineItem[]>(() => {
    if (!query.data) return [];
    const messageItems: ChatTimelineItem[] = query.data.messages.map((message) => ({
      kind: "message",
      at: message.created_at,
      message,
    }));
    const shareItems: ChatTimelineItem[] = query.data.shares.map((share) => ({
      kind: "discord_share",
      at: share.shared_at,
      share,
    }));
    return [...messageItems, ...shareItems].sort((a, b) => a.at.localeCompare(b.at));
  }, [query.data]);

  const hasUnread = query.data?.messages.some((m) => m.sender_id !== myId && !m.read_at) ?? false;

  async function markAsRead() {
    if (!myId || !hasUnread) return;
    await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("match_id", matchId).neq(
      "sender_id",
      myId,
    ).is("read_at", null);
  }

  return {
    timeline,
    isLoading: query.isLoading,
    error: query.error,
    hasUnread,
    markAsRead,
    refetch: query.refetch,
  };
}
