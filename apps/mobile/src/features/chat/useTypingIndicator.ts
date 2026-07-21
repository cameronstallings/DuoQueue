import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

const TYPING_IDLE_TIMEOUT_MS = 3000;

interface TypingPayload {
  userId: string;
  isTyping: boolean;
}

/** Ephemeral typing indicator via Realtime Broadcast — nothing here touches Postgres. */
export function useTypingIndicator(matchId: string) {
  const myId = useSessionStore((s) => s.session?.user.id);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase.channel(`typing:${matchId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userId, isTyping } = payload as TypingPayload;
        if (userId === myId) return;
        setOtherIsTyping(isTyping);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [matchId, myId]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!myId) return;
      void channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: myId, isTyping } satisfies TypingPayload,
      });
    },
    [myId],
  );

  const notifyTyping = useCallback(() => {
    sendTyping(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => sendTyping(false), TYPING_IDLE_TIMEOUT_MS);
  }, [sendTyping]);

  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    [],
  );

  return { otherIsTyping, notifyTyping };
}
