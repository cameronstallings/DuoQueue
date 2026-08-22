/**
 * The empty-deck decisions, extracted from the hook and the screen so they can be tested
 * without React, without a Supabase session and without the OS permission dialog.
 *
 * Same shape `deckQueue.ts` established, for the same reason: everything here is a decision
 * that can be WRONG in a way a user would notice, and none of it needs a component to be
 * wrong. What is left in `useEmptyDeckReason` and `EmptyDeck` after this is wiring — three
 * queries and some JSX.
 *
 * The thing being decided is worth stating plainly, because the old empty state got it wrong
 * for the entire life of the app: an empty deck has several causes, and they want opposite
 * screens. "No more profiles right now / Check back later, or adjust your filters to see more
 * people" was shown whether the pool was genuinely empty, or the viewer had swiped everybody,
 * or the viewer's own region filter was hiding a deck full of people. At least one of those
 * three sentences is a lie every time it renders.
 */

/**
 * Why the deck is empty, resolved to exactly one answer.
 *
 * A discriminated union rather than a bag of booleans so the screen cannot render a
 * combination that does not exist — "filtered" with nobody in the pool, say, or an offer to
 * turn on a ping the user has already turned on.
 */
export type EmptyDeckReason =
  /** The pool count or the permission state has not come back yet. Keep the skeleton up
   *  rather than flash the wrong sentence for a frame and then correct it. */
  | { kind: "resolving" }
  /** There are people, and this viewer's own filters are removing all of them. */
  | { kind: "filtered"; poolSize: number }
  /** There is genuinely nobody left: either nobody has joined yet, or this viewer has swiped
   *  everyone who has. Both want the same screen — an honest "you are early" plus the offer
   *  of a ping when somebody who shares their games signs up. */
  | { kind: "new"; canPing: boolean; permissionGranted: boolean };

export interface EmptyDeckInputs {
  /** `get_deck_pool_size`, or undefined while it has not answered. */
  poolSize: number | undefined;
  /** The pool query has failed and will not answer. */
  poolFailed: boolean;
  /** OS-level push permission, or undefined while it has not been read. */
  permissionGranted: boolean | undefined;
  /** Reading the permission failed and will not be retried. */
  permissionFailed: boolean;
  /** The in-app "new players in your games" toggle. */
  newPlayerAlertsEnabled: boolean;
}

/**
 * Turns the three inputs into the one sentence the screen is allowed to say.
 *
 * A FAILED LOOKUP IS NOT "RESOLVING". If the pool RPC errors — most likely its 20-per-minute
 * rate limit, since this screen is the only caller — treating that as "still loading" would
 * leave a skeleton spinning forever, which is a worse screen than any of the wrong sentences
 * it was written to prevent. It falls through to "new" instead: at this density that is the
 * likelier truth, the copy promises nothing the app cannot deliver, and Refresh is on the
 * screen either way. The same rule applies to the permission read, where failure resolves to
 * "not granted" and therefore to the more conservative copy of the two.
 */
export function emptyDeckReason(input: EmptyDeckInputs): EmptyDeckReason {
  const poolPending = input.poolSize === undefined && !input.poolFailed;
  const permissionPending = input.permissionGranted === undefined && !input.permissionFailed;
  if (poolPending || permissionPending) return { kind: "resolving" };

  const poolSize = input.poolSize ?? 0;
  const permissionGranted = input.permissionGranted ?? false;

  if (poolSize > 0) return { kind: "filtered", poolSize };

  return {
    kind: "new",
    // Both halves are load-bearing. Permission without the toggle means a push that is
    // silently dropped by the sweep's own SQL; the toggle without permission means a push
    // that never leaves the server. Promising a ping in either state would be a lie.
    canPing: permissionGranted && input.newPlayerAlertsEnabled,
    permissionGranted,
  };
}

/**
 * The "your filters are hiding everyone" sentence, pluralised.
 *
 * A pure function and not a template inline in the JSX because "There is 1 players" is
 * exactly the sort of thing that ships, and because the count comes from the server so it
 * cannot be assumed to be greater than one.
 */
export function filteredSubtitle(poolSize: number): string {
  const noun = poolSize === 1 ? "player" : "players";
  const verb = poolSize === 1 ? "is" : "are";
  return (
    `There ${verb} ${poolSize} ${noun} you could see right now, ` +
    "but your current filters rule them out."
  );
}

/**
 * What the "Turn on the ping" button should do BEFORE it touches the OS.
 *
 * There are two reasons the ping can be off and they need opposite handling. If the OS
 * permission is already granted then the in-app toggle is the only thing left that can have
 * made `canPing` false — those two booleans are the whole of it — so an OS prompt would be a
 * no-op and the user would be left tapping a button that does nothing. The fix is one screen
 * away in the app's own settings. Otherwise the OS is the thing standing in the way, so ask
 * it.
 *
 * Takes the `new` variant's own two fields rather than a separate copy of the toggle, so the
 * button cannot disagree with the sentence printed above it.
 */
export type PingStep = "open-notification-settings" | "request-permission" | "nothing";

export function firstPingStep(reason: { canPing: boolean; permissionGranted: boolean }): PingStep {
  // Defensive: the button is not rendered when the ping already works, and if that ever
  // changes, doing nothing is the right failure.
  if (reason.canPing) return "nothing";
  if (reason.permissionGranted) return "open-notification-settings";
  return "request-permission";
}

/**
 * What to do with what the OS said.
 *
 * `register-token` because permission is not a token: `push_tokens` is what the sweep query
 * joins against, so a user who grants permission and is never registered is a user who has
 * agreed to a notification that cannot be addressed to them.
 *
 * `open-os-settings` only when the OS has taken the question away. `granted: false` with
 * `canAskAgain: true` is the user having just tapped "Don't Allow" on the prompt this very
 * button raised, and marching them into Settings one second later is not respecting that
 * answer — it is asking again with extra steps.
 */
export type PingOutcome = "register-token" | "open-os-settings" | "nothing";

export function pingOutcome(result: { granted: boolean; canAskAgain: boolean }): PingOutcome {
  if (result.granted) return "register-token";
  if (!result.canAskAgain) return "open-os-settings";
  return "nothing";
}
