import { describe, expect, it } from "vitest";

import { notificationTapAction, shouldHandleTap, type NotificationTapInput } from "./notificationRouting";

/** A tapped new-player push, arriving at a fully settled app. Each test overrides only the
 *  fact it is about. */
const ready: NotificationTapInput = {
  category: "new_player",
  navigatorReady: true,
  sessionStatus: "signed_in",
  onboardingCompleted: true,
};

describe("notificationTapAction", () => {
  it("opens the deck for a tapped new-player push", () => {
    expect(notificationTapAction(ready)).toBe("open-deck");
  });

  it("leaves every other category alone", () => {
    // These all resume where the user left off today, and none of them carry an id to route
    // to. Changing that means changing send-push-notification's payloads.
    for (const category of ["new_match", "new_message", "super_ping", "nudge_unread", "nudge_online", "daily_swipes_refreshed"]) {
      expect(notificationTapAction({ ...ready, category })).toBe("ignore");
    }
  });

  it("ignores a payload with no category at all", () => {
    expect(notificationTapAction({ ...ready, category: undefined })).toBe("ignore");
    expect(notificationTapAction({ ...ready, category: null })).toBe("ignore");
  });

  it("does not treat a lookalike category as ours", () => {
    // The payload crossed a network and an OS; an exact match is the only safe test.
    expect(notificationTapAction({ ...ready, category: "new_players" })).toBe("ignore");
    expect(notificationTapAction({ ...ready, category: "New_Player" })).toBe("ignore");
    expect(notificationTapAction({ ...ready, category: { category: "new_player" } })).toBe("ignore");
  });

  it("waits rather than navigating a root layout that has not rendered", () => {
    // RootLayout returns null until the fonts land, and a tap is one of the ways to arrive
    // inside that window — the tap is what started the app.
    expect(notificationTapAction({ ...ready, navigatorReady: false })).toBe("wait");
  });

  it("waits while the session is still resolving, instead of dropping the tap", () => {
    // The whole cold-start case. "ignore" here would mean the deep link never works when the
    // app was not already running, which is most of the time.
    expect(notificationTapAction({ ...ready, sessionStatus: "loading" })).toBe("wait");
  });

  it("waits while the profile row is still loading", () => {
    expect(notificationTapAction({ ...ready, onboardingCompleted: undefined })).toBe("wait");
  });

  it("gives up when there is no session to route with", () => {
    expect(notificationTapAction({ ...ready, sessionStatus: "signed_out" })).toBe("ignore");
    expect(notificationTapAction({ ...ready, sessionStatus: "signed_out", onboardingCompleted: undefined })).toBe(
      "ignore",
    );
  });

  it("does not fight the onboarding redirect", () => {
    // (tabs)/_layout.tsx sends an incomplete profile to the wizard. Finishing it lands on the
    // deck anyway, so there is nothing lost by standing down.
    expect(notificationTapAction({ ...ready, onboardingCompleted: false })).toBe("ignore");
  });

  it("checks the category before anything else, so a foreign push never waits", () => {
    // A held tap is re-evaluated on every session change. Holding one that was never ours
    // would be a leak with no exit.
    expect(
      notificationTapAction({
        category: "new_message",
        navigatorReady: false,
        sessionStatus: "loading",
        onboardingCompleted: undefined,
      }),
    ).toBe("ignore");
  });
});

describe("shouldHandleTap", () => {
  it("handles a tap it has not seen", () => {
    expect(shouldHandleTap("abc", new Set())).toBe(true);
  });

  it("refuses a tap it already acted on", () => {
    // The killed-app case: getLastNotificationResponseAsync() and the live listener both
    // report the tap that relaunched the app.
    expect(shouldHandleTap("abc", new Set(["abc"]))).toBe(false);
  });

  it("does not confuse two different taps", () => {
    expect(shouldHandleTap("def", new Set(["abc"]))).toBe(true);
  });

  it("handles a tap with no identifier rather than dropping it", () => {
    // An unidentifiable tap is rarer than a dropped one, and dropping it breaks the only
    // thing the notification promised.
    expect(shouldHandleTap(undefined, new Set(["abc"]))).toBe(true);
    expect(shouldHandleTap("", new Set())).toBe(true);
  });
});
