import type { Session } from "@supabase/supabase-js";
import type { ProfileRow } from "@duoqueue/shared-types";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { registerForPushNotifications } from "@/lib/notifications";
import { configurePurchases, logOutPurchases } from "@/lib/revenuecat";

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

function onSignedIn(userId: string): void {
  configurePurchases(userId);
  void registerForPushNotifications(userId);
  void supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId)
    .then(({ error }) => {
      if (error) console.warn("Failed to update last_active_at:", error.message);
    });
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
      onSignedIn(session.user.id);
    } else {
      set({ session: null, profile: null, status: "signed_out" });
    }

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        set({ session: nextSession, status: "signed_in" });
        onSignedIn(nextSession.user.id);
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
    // Reset local state even if the server-side calls fail (e.g. after account
    // deletion, the user no longer exists server-side to sign out).
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("supabase.auth.signOut failed:", err);
    }
    try {
      await logOutPurchases();
    } catch (err) {
      console.warn("logOutPurchases failed:", err);
    }
    set({ session: null, profile: null, status: "signed_out" });
  },
}));
