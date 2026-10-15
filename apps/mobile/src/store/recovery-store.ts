import { create } from "zustand";

/**
 * A password reset by code is in flight. Read by (auth)/_layout.tsx, and nothing else.
 *
 * `verifyOtp({ type: "recovery" })` signs the player in and emits PASSWORD_RECOVERY BEFORE it
 * resolves, and (auth)/_layout redirects every signed-in session to "/". Without this hold the
 * layout would unmount the reset screen in the gap between the code being accepted and
 * `updateUser({ password })` being called, and the new password would never be set: the player
 * would land in the app with the old one still on the account. `end()` (success, a failed code,
 * or "Keep my old password") lets the layout redirect as usual.
 */
interface RecoveryState {
  inFlight: boolean;
  begin: () => void;
  end: () => void;
}

export const useRecoveryStore = create<RecoveryState>((set) => ({
  inFlight: false,
  begin: () => set({ inFlight: true }),
  end: () => set({ inFlight: false }),
}));
