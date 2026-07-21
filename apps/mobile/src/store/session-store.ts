import type { Session } from "@supabase/supabase-js";
import type { ProfileRow } from "@duoqueue/shared-types";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";

export type SessionStatus = "loading" | "signed_out" | "signed_in";

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  profile: ProfileRow | null;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) {
    console.warn("Failed to load profile:", error.message);
    return null;
  }
  return data as ProfileRow;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "loading",
  session: null,
  profile: null,

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const profile = await loadProfile(session.user.id);
      set({ session, profile, status: "signed_in" });
    } else {
      set({ session: null, profile: null, status: "signed_out" });
    }

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        set({ session: nextSession, status: "signed_in" });
        void get().refreshProfile();
      } else {
        set({ session: null, profile: null, status: "signed_out" });
      }
    });
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session) return;
    const profile = await loadProfile(session.user.id);
    set({ profile });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: "signed_out" });
  },
}));
