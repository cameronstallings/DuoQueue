import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DiscordShareRow, MessageRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

import type { ChatTimelineItem } from "./types";

export interface ChatData {
  messages: MessageRow[];
  shares: DiscordShareRow[];
}

/** Exported so useSendMessage can read/write the same cache entry for optimistic sends. */
export function chatQueryKey(matchId: string) {
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
          const incoming = payload.new as MessageRow;
          // Own sends already land instantly via the optimistic row in useSendMessage.
          // That mutation's onSuccess reconciles the temp row to this real id once the
          // HTTP response returns — but the Realtime echo for the same insert
          // (broadcast to every participant, sender included) can arrive first, while
          // the temp row is still in cache. Dedupe by real id (covers the common case:
          // onSuccess already ran) AND, for own sends, drop the matching temp- row
          // here too by content (covers the echo-arrives-first race) so the two paths
          // can never both leave a copy behind regardless of which wins.
          queryClient.setQueryData<ChatData>(chatQueryKey(matchId), (old) => {
            if (!old) return { messages: [incoming], shares: [] };
            if (old.messages.some((m) => m.id === incoming.id)) return old;

            let messages = old.messages;
            if (myId && incoming.sender_id === myId) {
              const contentIndex = messages.findIndex(
                (m) => m.id.startsWith("temp-") && m.content === incoming.content,
              );
              // send-message can rewrite `content` before storing it (profanity
              // masking), so an exact match misses the optimistic row it belongs to.
              // Fall back to the oldest pending temp- row instead: the composer
              // disables sending while a message is in flight, so there's normally at
              // most one to match, and onSuccess's own id-based cleanup (which still
              // runs) protects against picking a wrong one.
              const tempIndex =
                contentIndex !== -1 ? contentIndex : messages.findIndex((m) => m.id.startsWith("temp-"));
              if (tempIndex !== -1) {
                messages = [...messages.slice(0, tempIndex), ...messages.slice(tempIndex + 1)];
              }
            }

            return { ...old, messages: [...messages, incoming] };
          });
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
  }, [matchId, queryClient, myId]);

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

  const markAsRead = useCallback(async () => {
    if (!myId || !hasUnread) return;
    await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("match_id", matchId).neq(
      "sender_id",
      myId,
    ).is("read_at", null);
  }, [matchId, myId, hasUnread]);

  return {
    timeline,
    isLoading: query.isLoading,
    error: query.error,
    hasUnread,
    markAsRead,
    refetch: query.refetch,
  };
}
