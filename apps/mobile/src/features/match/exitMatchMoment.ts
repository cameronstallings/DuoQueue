import { router } from "expo-router";

import { type MatchExit, matchExitSteps } from "./matchMoment";

/**
 * Leaves DUO LOCKED by one of its two buttons: "Keep swiping" closes the moment, "Send a message"
 * swaps it for the chat. matchExitSteps (matchMoment.ts) decides the steps from whether there is
 * anything underneath to go back to; this only runs them. Shared by the match route and the Duo
 * Pop card, which both end on DuoLockedScreen.
 */
export function exitMatchMoment(exit: MatchExit, matchId: string) {
  const chat = { pathname: "/chat/[matchId]", params: { matchId } } as const;
  for (const step of matchExitSteps(exit, router.canGoBack())) {
    if (step === "back") router.back();
    else if (step === "replace-with-tabs") router.replace("/(tabs)");
    else if (step === "replace-with-chat") router.replace(chat);
    else router.push(chat);
  }
}
