import type { ProfileStatus } from "@/features/auth/sessionRouting";

/**
 * What tapping a push should do, decided without React, expo-notifications or a router.
 *
 * The one import is type-only and erased at build, so this module still needs nothing at
 * runtime. `ProfileStatus` is shared with the session store rather than restated here,
 * because a second copy of that union is a copy that drifts.
 *
 * Same shape `deckQueue.ts` and `emptyDeckDecisions.ts` established: the part that can be
 * wrong is pure and tested, and the hook around it (`useNotificationTapRouting`) is a
 * listener, a ref and a few router calls.
 *
 * WHAT IS ROUTED. Two kinds of push now go somewhere instead of resuming wherever the user left
 * off, which is what every push did before this hook existed:
 *
 *  - `new_player` opens the deck. The whole promise of that notification is "open your deck
 *    and they are in it".
 *  - `new_message`, `new_match` and `nudge_unread` ("Your duo is waiting", the reminder about a
 *    message left unread for an hour) open that chat, IF the payload names the match.
 *    `send-push-notification` and `send-reengagement-nudges` started sending `data.matchId` for
 *    exactly this. A push from a server version before that carries only its category, and
 *    there is nothing to route to, so it still resumes where the user left off. That case is
 *    not hypothetical: a push sitting in Notification Center can be tapped hours after it was
 *    sent.
 *
 * The rest (super_ping, nudge_online, daily_swipes_refreshed) still resume where the user left
 * off. None of them is about a conversation.
 *
 * WHY THIS IS NOT JUST `if (category === ...) navigate()`. A tap can arrive at a moment when
 * navigating is the wrong move, and there are four of them:
 *
 *  1. NO NAVIGATOR YET. `RootLayout` renders no Stack until the fonts resolve and, on a cold
 *     start, until the launch intro's rings have locked, so for the first half second or so
 *     there is no root navigator to navigate, and expo-router says so loudly. A tap is one of
 *     the ways to reach that window, because the tap is what started the app.
 *  2. COLD START. The tap is delivered before `session-store.initialize()` has resolved a
 *     session. Navigating then races the auth redirect in `app/index.tsx`; ignoring it drops
 *     the deep link entirely. Neither is acceptable, so this returns "wait" and the hook
 *     re-asks once the session settles.
 *  3. SIGNED OUT. There is nothing to route to, and `(tabs)` would bounce straight back out.
 *  4. MID-ONBOARDING. `(tabs)/_layout.tsx` redirects an incomplete profile into the wizard;
 *     a router call fired in the same frame is just fighting it. Finishing onboarding lands
 *     on the deck anyway.
 *
 * The chat and the deck share all four. A chat sits on top of `(tabs)`, behind the same
 * layout guard, so every reason not to open the deck is a reason not to open a chat. A chat has
 * a fifth, below: on a cold start the session settling is not the end of the race, because the
 * gate's own redirect lands a render AFTER that, so the chat's first move waits for it too
 * (`wait-for-gate` on `chatOpening`).
 */

/** The subset of the notification payload this decision reads. */
export interface NotificationTapInput {
  /** `data.category` from the push payload. Unknown shape by the time it reaches here — it
   *  crossed a network and an OS. */
  category: unknown;
  /** `data.matchId` from the push payload, sent on new_message, new_match and nudge_unread.
   *  Absent on every push from a server that predates it, and just as untrusted as `category`. */
  matchId: unknown;
  /** Whether `RootLayout` is past its font and launch-intro gates and actually rendering the
   *  `Stack`. */
  navigatorReady: boolean;
  sessionStatus: "loading" | "signed_out" | "signed_in";
  /**
   * What the store knows about the profile row, which `onboardingCompleted` cannot say on its
   * own: `undefined` covers both "the read has not landed" and "there is no row", and only one
   * of those is worth holding a tap for.
   */
  profileStatus: ProfileStatus;
  /** `profile.onboarding_completed`, or undefined while the profile row is still loading. */
  onboardingCompleted: boolean | undefined;
}

/** Where a tap goes once the app can take it there. */
export type NotificationDestination =
  /** Go to the deck, and refresh it on the way. */
  | { kind: "open-deck" }
  /** Open this match's chat, on top of the Matches tab. */
  | { kind: "open-chat"; matchId: string };

export type NotificationTapAction =
  | NotificationDestination
  /** This tap is for us but the app is not ready to be navigated yet. Hold it. */
  | { kind: "wait" }
  /** Nothing to do. Not a routed category, no id to route with, or nowhere to send anyone. */
  | { kind: "ignore" };

/**
 * A match id, by shape. Any version, because this only has to prove the value is safe to put
 * in a route and compare against `get_matches_summary`'s `match_id`; the server already
 * validated it as a UUID before sending it. Pinning a version here would be a client that
 * cannot be patched refusing ids from a server that can.
 */
const MATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tapped push's destination, judged on its payload alone. Null for anything not routed.
 *
 * Lowercased because Postgres prints UUIDs lowercase, so that is how `match_id` arrives from
 * `get_matches_summary` and how the Matches list routes. A chat opened on an uppercase spelling
 * of the same id would find no `matchInfo` and draw itself as "Chat".
 */
function destinationOf(category: unknown, matchId: unknown): NotificationDestination | null {
  if (category === "new_player") return { kind: "open-deck" };
  if (category === "new_message" || category === "new_match" || category === "nudge_unread") {
    if (typeof matchId !== "string" || !MATCH_ID_PATTERN.test(matchId)) return null;
    return { kind: "open-chat", matchId: matchId.toLowerCase() };
  }
  return null;
}

export function notificationTapAction(input: NotificationTapInput): NotificationTapAction {
  // The payload first, so a push that is not ours (or names nothing) never waits. A held tap is
  // re-asked on every store change, and holding one that can never go anywhere is a leak.
  const destination = destinationOf(input.category, input.matchId);
  if (!destination) return { kind: "ignore" };

  if (!input.navigatorReady) return { kind: "wait" };
  if (input.sessionStatus === "loading") return { kind: "wait" };
  if (input.sessionStatus === "signed_out") return { kind: "ignore" };

  // Authenticated with no profile row: an Apple signup still sitting on the age gate. There is
  // no deck or chat to open, and the age gate is where they belong, so this is a DROP and not a
  // hold. It has to come before the line below, which would otherwise return "wait" forever: for
  // a missing profile `onboardingCompleted` is undefined permanently, so the tap would be held by
  // a hook that re-asks on every store change and never released by any of them.
  //
  // Unreachable today only by accident — such a session has no push_tokens row, so it cannot be
  // sent a notification to tap — and an accident is not a guarantee. A tap held from BEFORE the
  // account changed hands, or from a build where registration happened earlier, arrives here.
  if (input.profileStatus === "missing") return { kind: "ignore" };

  // Signed in, but the profile row has not arrived yet — we cannot tell whether onboarding is
  // done, and guessing either way is a wrong screen. Hold it; `refreshProfile` is already in
  // flight.
  if (input.onboardingCompleted === undefined) return { kind: "wait" };
  if (!input.onboardingCompleted) return { kind: "ignore" };

  return destination;
}

/**
 * Whether a tap that has already been handled should be handled again: no.
 *
 * Expo delivers the same response twice in one real situation — the app was killed, the tap
 * relaunched it, and both `getLastNotificationResponseAsync()` (cold start) and the live
 * listener see it. It can also re-deliver the launching response on a later mount. Keying on
 * the request identifier makes "handle each tap once" a property of the code rather than of
 * how many times React happens to run an effect.
 *
 * A missing identifier resolves to "handle it": an unidentifiable tap is rarer than a dropped
 * one, and dropping the tap breaks the only thing the notification promised.
 */
export function shouldHandleTap(identifier: string | undefined, handled: ReadonlySet<string>): boolean {
  if (!identifier) return true;
  return !handled.has(identifier);
}

// ---------------------------------------------------------------------------------------------
// Opening a chat. The deck is one tab switch; a chat has a place in the stack, so it needs to
// know where the app is before it moves anything.
// ---------------------------------------------------------------------------------------------

/** expo-router's route names: file paths under app/, without the extension. */
const TABS_ROUTE = "(tabs)";
const CHAT_ROUTE = "chat/[matchId]";
const MATCHES_TAB = "matches";
/** app/index.tsx, the auth gate. The tab bar has an "index" too (the deck), told apart by depth. */
const GATE_ROUTE = "index";
/** expo-router's own slot at the top of the container, with the app's Stack inside it. */
const ROOT_SLOT = "__root";

/**
 * The parts of a React Navigation state this reads. `getRootState()` returns more; declaring
 * only these keeps the module free of a runtime dependency and lets the tests build states by
 * hand.
 */
export interface NavigationStateLike {
  index?: number;
  routes: readonly { name: string; params?: object; state?: NavigationStateLike }[];
}

/** The screen in front of the user, as far as opening a chat cares. */
export type FrontScreen =
  /** The tab bar, showing this tab ("index" is the deck, "matches" the Matches list). */
  | { kind: "tabs"; tab: string | undefined }
  /** A one-to-one chat. */
  | { kind: "chat"; matchId: string | undefined }
  /**
   * The auth gate (app/index.tsx): the root Stack's first screen on every launch, which is
   * about to replace itself with the tab bar (or sign-in, or onboarding) through its own
   * `<Redirect>`. In front on a cold start, and briefly whenever a layout sends the app back
   * through it (signing in, an invite link).
   */
  | { kind: "gate" }
  /** Anything else on the root Stack: a modal, a party, a settings page, the welcome screen. */
  | { kind: "other" };

/**
 * Follows the focused route down from the container's root state.
 *
 * The container's root is expo-router's own `__root` slot, and the app's Stack is inside it,
 * so this keeps descending until it meets one of the routes it knows, rather than assuming how
 * deep the Stack sits. A partial stack state with no `index` focuses its last route, the
 * convention expo-router's own store reads states with; a tab bar's focuses its first tab, which
 * is the tab a tab navigator opens on.
 *
 * The gate is an "index" route in the app's Stack itself: directly inside `__root`, or at the
 * top when there is no slot. The deck tab is also named "index", but it is never reached here,
 * because the walk stops at the tab bar.
 */
export function frontScreen(state: NavigationStateLike | undefined): FrontScreen {
  let level = state;
  // The route whose state `level` is. Undefined at the container's top.
  let parent: string | undefined;
  while (level) {
    const route = level.routes[level.index ?? level.routes.length - 1];
    if (!route) break;
    if (route.name === TABS_ROUTE) {
      const tabs = route.state;
      return { kind: "tabs", tab: tabs?.routes[tabs.index ?? 0]?.name };
    }
    if (route.name === CHAT_ROUTE) {
      const matchId = route.params && "matchId" in route.params ? route.params.matchId : undefined;
      return { kind: "chat", matchId: typeof matchId === "string" ? matchId : undefined };
    }
    if (route.name === GATE_ROUTE && (parent === undefined || parent === ROOT_SLOT)) return { kind: "gate" };
    parent = route.name;
    level = route.state;
  }
  return { kind: "other" };
}

/** Whether the tab bar is in front and showing the Matches list: where a tapped chat goes first. */
export function isOnMatches(front: FrontScreen): boolean {
  return front.kind === "tabs" && front.tab === MATCHES_TAB;
}

export type ChatOpening =
  /** That chat is already in front of them. Refresh it; pushing it again would stack a copy. */
  | "already-open"
  /** The tab bar is in front. Switch it to Matches; nothing needs dismissing. */
  | "switch-to-matches"
  /**
   * Something sits on top of the tab bar: another chat, a modal, a settings page. Dismiss down
   * to the tabs (or replace the screen with them, when they are not in the stack at all, as on
   * the welcome screen), landing on Matches.
   */
  | "dismiss-to-matches"
  /**
   * The auth gate is in front, with its own redirect still to land. Move nothing until it has,
   * then ask again. Moving now LOSES to it: `<Redirect>` calls `router.replace` from
   * expo-router's `useFocusEffect`, which skips its first run because `useOptionalNavigation`
   * only sets its navigation object from an effect. So the gate's replace is issued a render
   * after the Stack mounts, which queues it BEHIND a dismissTo decided in the commit that
   * mounted the Stack (the cold-start tap's commit). The routing queue runs both in order: the
   * dismissTo lands on Matches, and the replace then swaps that tab bar for a fresh one on the
   * Deck.
   */
  | "wait-for-gate";

/**
 * The first move toward a chat. The aim is always the same stack, the tab bar on Matches with
 * the chat on top, so the chat's back button lands on Matches: never on nothing, and never on
 * another copy of a chat.
 *
 * Two routes there, not one, because neither expo-router call works from everywhere (read in
 * expo-router 6.0.24's routing.js and StackClient.js): `router.dismissTo` aimed at the Matches
 * tab while the tab bar is already in front targets the TAB navigator, which has no POP_TO, so
 * the action goes unhandled and nothing moves; and `router.navigate` while a chat or a page is
 * in front pushes a SECOND tab bar on top of it, because since v4 navigate only reuses the root
 * route that is already focused. Each is right exactly where the other is wrong.
 */
export function chatOpening(front: FrontScreen, matchId: string): ChatOpening {
  if (front.kind === "gate") return "wait-for-gate";
  if (front.kind === "chat" && front.matchId === matchId) return "already-open";
  if (front.kind === "tabs") return "switch-to-matches";
  return "dismiss-to-matches";
}

export interface ChatPushInput {
  /** Whether a later tap has been handled since this one. The later tap owns navigation now. */
  superseded: boolean;
  /**
   * Whether a fresh `get_matches_summary` lists the match: true or false, or undefined when we
   * do not know. Unknown covers three cases the hook folds together: the read failed, the
   * phone is offline (so the read was never sent, since TanStack would hold it until the
   * network came back), and the read had not answered by the hook's deadline.
   */
  matchListed: boolean | undefined;
  /** Where the app is now, after the read came back. */
  front: FrontScreen;
}

export type ChatPush =
  /** Push the chat on top of Matches. */
  | "push"
  /** The match is gone (unmatched, blocked, or never this account's): stay on Matches, and say so. */
  | "gone"
  /** Do nothing. Someone else moved the app while we were reading. */
  | "stand-down";

/**
 * The second move, once the match list has answered: push the chat, or don't.
 *
 * WHY THE LIST IS ASKED FIRST. A push can be tapped long after it was sent, and between the two
 * the match can have been unmatched or blocked, or the tap can come from Notification Center
 * after somebody else signed in on this phone. The chat screen takes its name, its Block and its
 * Report from `get_matches_summary` (`matchInfo`), and with no row there it draws "Chat", "Say hi
 * to your match!" and a composer whose every send fails. Asking the same list the screen will
 * ask means that screen is never opened for a match that is not in it. The Matches tab is the
 * honest answer instead: the conversation is visibly not there, and a toast says why.
 *
 * An unknown answer is NOT evidence the match is gone, so it pushes: the chat then behaves
 * exactly as it does when opened from the list on a bad network, under the offline banner and
 * with its own "Couldn't load this conversation" state. That is also why the hook never waits on
 * the network without a bound: a read TanStack paused while offline could otherwise answer
 * minutes later and push the chat into whatever the user was doing by then.
 *
 * And the app must still be where the first move left it, on the Matches tab. The read takes a
 * round trip or two (a few seconds at most, the hook's deadline), and in that time the user may
 * have opened a chat themselves (perhaps this very one), switched tabs or opened a modal.
 * Pushing on top of whatever they chose would be the app grabbing the wheel back; they have
 * already moved on, so this stands down.
 */
export function chatPush(input: ChatPushInput): ChatPush {
  if (input.superseded) return "stand-down";
  if (!isOnMatches(input.front)) return "stand-down";
  if (input.matchListed === false) return "gone";
  return "push";
}

// ---------------------------------------------------------------------------------------------
// Waiting. Both moves toward a chat wait on something that answers later: the navigator, and
// the match list. Each wait has a bound and settles once, and both live here, with tests,
// because getting either wrong is a chat that never opens or one that opens out of nowhere.
// ---------------------------------------------------------------------------------------------

/** The two things a chat tap needs from the navigation container. */
export interface NavigationReader {
  /** The screen in front of the user right now. */
  front: () => FrontScreen;
  /** Calls back after every navigation state change, until the returned function is called. */
  onChange: (callback: () => void) => () => void;
}

/**
 * Calls `then` once the screen in front passes `ready`: at once if it already does, otherwise
 * on the first navigation state change after which it does. Gives up silently after `ms`, or
 * when the returned stop is called, so a screen that never comes cannot leave a listener behind.
 *
 * It asks `nav.front()` on each change rather than reading the event's payload: by the time the
 * container reports a change, the navigators nested in it have flushed their own state, and
 * that latest state is what the next router call will be computed against.
 */
export function whenFront(
  nav: NavigationReader,
  ready: (front: FrontScreen) => boolean,
  then: (front: FrontScreen) => void,
  ms: number,
): () => void {
  const now = nav.front();
  if (ready(now)) {
    then(now);
    return () => undefined;
  }
  let done = false;
  let unsubscribe: () => void = () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    done = true;
    unsubscribe();
    clearTimeout(timer);
  };
  unsubscribe = nav.onChange(() => {
    if (done) return;
    const front = nav.front();
    if (!ready(front)) return;
    stop();
    then(front);
  });
  timer = setTimeout(stop, ms);
  return stop;
}

/**
 * Calls `decide` exactly once with the match list's answer: true or false when `read` resolves,
 * undefined when it rejects, or undefined at `ms` if it has done neither. Whatever comes after
 * that is ignored, so a read that answers late (TanStack holds a read while offline, and a read
 * it joins keeps the list's own retries) can never push a chat nobody is waiting for any more.
 * The returned stop cancels without deciding.
 */
export function answerWithin(
  read: Promise<boolean>,
  ms: number,
  decide: (matchListed: boolean | undefined) => void,
): () => void {
  let settled = false;
  const settle = (matchListed: boolean | undefined) => {
    if (settled) return;
    settled = true;
    clearTimeout(deadline);
    decide(matchListed);
  };
  const deadline = setTimeout(() => settle(undefined), ms);
  void read.then(
    (listed) => settle(listed),
    () => settle(undefined),
  );
  return () => {
    settled = true;
    clearTimeout(deadline);
  };
}
