import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * The invite an install arrived with, held across everything that happens between tapping
 * a link and finishing onboarding.
 *
 * WHY IT IS PERSISTED. The gap between "the code arrives" and "the code can be redeemed"
 * is the longest gap in this app: a deep link can land on a signed-out first launch, and
 * redemption needs a session, which needs an email confirmation code that lives in another
 * app. In between, the user backgrounds DuoQueue, opens their mail, and comes back, often
 * after the process has been killed. A code held only in memory is a code lost exactly when
 * it matters, which is the same reason `pendingConfirmation.ts` exists.
 *
 * Plain AsyncStorage rather than SecureStore, on the same reasoning: a code is a shareable
 * string somebody posted into a group chat, not a credential. It grants nothing on its own.
 * Redeeming it requires a session, and all it can ever do is attribute the account doing
 * the redeeming to somebody else.
 */

const PENDING_KEY = "duoqueue.pending-invite-code";
const ARRIVAL_KEY = "duoqueue.invite-arrival";

/**
 * How far `redeem_invite_code` has got with the pending code.
 *
 * "failed" covers every way an invite can come to nothing: the 14 day window closed, this
 * account was already invited by somebody else, the code was revoked, or it had already
 * been accepted on a previous install. None of them are errors worth showing anybody, and
 * all of them mean the same thing to the router, which is "carry on into the app".
 */
export type RedemptionStatus = "idle" | "pending" | "done" | "failed";

export interface InviteArrival {
  inviterId: string;
  inviterName: string;
}

interface InviteState {
  /** A code captured from a link or typed in, not yet redeemed. */
  pendingCode: string | null;
  /** The inviter, once redemption has answered. Cleared when the arrival is acted on. */
  arrival: InviteArrival | null;
  redemption: RedemptionStatus;

  /** A new code to try. Resets the status, so the redemption effect picks it up. */
  setPendingCode: (code: string) => void;
  /** Redemption is in flight. Stops the effect from firing a second time. */
  markRedeeming: () => void;
  /**
   * Redemption answered. The pending code is dropped either way: keeping it would mean
   * re-running the RPC on every cold start for the rest of the install's life, since the
   * status does not survive a restart but the code would.
   */
  settleRedemption: (arrival: InviteArrival | null) => void;
  /** The invited person has seen the arrival screen and chosen. Do not show it again. */
  clearArrival: () => void;
}

function persist(key: string, value: string | null): void {
  void (value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value)).catch(
    () => {
      // Non-fatal. Losing this costs the arrival screen, not the account.
    },
  );
}

export const useInviteStore = create<InviteState>((set) => ({
  pendingCode: null,
  arrival: null,
  redemption: "idle",

  setPendingCode: (code) => {
    set({ pendingCode: code, redemption: "idle" });
    persist(PENDING_KEY, code);
  },

  markRedeeming: () => set({ redemption: "pending" }),

  settleRedemption: (arrival) => {
    set({ pendingCode: null, arrival, redemption: arrival ? "done" : "failed" });
    persist(PENDING_KEY, null);
    persist(ARRIVAL_KEY, arrival ? JSON.stringify(arrival) : null);
  },

  clearArrival: () => {
    set({ pendingCode: null, arrival: null, redemption: "idle" });
    persist(ARRIVAL_KEY, null);
    persist(PENDING_KEY, null);
  },
}));

/**
 * Reads both keys once at startup — call from the root layout, next to
 * `loadThemePreference()`.
 *
 * An arrival that survived a restart is by definition already redeemed, so the status is
 * restored as "done"; that is what stops a relaunched deep link parking on "wait" forever
 * while it waits for a redemption that already happened. A malformed arrival blob is
 * dropped rather than thrown: it can only come from an older build of this file, and the
 * cost of ignoring it is one screen.
 */
export async function loadInviteState(): Promise<void> {
  try {
    const [pendingCode, arrivalRaw] = await Promise.all([
      AsyncStorage.getItem(PENDING_KEY),
      AsyncStorage.getItem(ARRIVAL_KEY),
    ]);

    let arrival: InviteArrival | null = null;
    if (arrivalRaw) {
      try {
        const parsed = JSON.parse(arrivalRaw) as Partial<InviteArrival>;
        if (typeof parsed.inviterId === "string" && typeof parsed.inviterName === "string") {
          arrival = { inviterId: parsed.inviterId, inviterName: parsed.inviterName };
        }
      } catch {
        arrival = null;
      }
    }

    useInviteStore.setState({
      pendingCode,
      arrival,
      redemption: arrival ? "done" : "idle",
    });
  } catch {
    // Non-fatal.
  }
}
