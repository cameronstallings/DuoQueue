import * as Haptics from "expo-haptics";

import { useHapticsStore } from "@/store/haptics-store";

/**
 * THE one haptics module. Nothing else in the app imports expo-haptics (the final verification
 * greps for it), so the Settings > Appearance > Haptics switch can be honoured in exactly one
 * place: every wrapper below starts by reading it, with `getState()`, so flipping the switch
 * applies to the very next tap without anything re-rendering.
 *
 * Fire-and-forget: each wrapper returns nothing and swallows the promise's rejection, because a
 * haptic is a nice-to-have (simulators and some devices have no engine) and must never crash,
 * delay or block the interaction it is attached to. They are plain JS functions, so a worklet
 * calls them through `runOnJS(hapticSelection)()`.
 *
 * THE HAPTIC MAP. Every group follows it; it is the single source of which moment gets which
 * haptic. If a moment is not listed, it gets nothing (silence is the default, not light).
 *
 *   selection  the swipe threshold tick; toggles (ToggleRow); chips (ChipSelect, the chat chips);
 *              a catalog row pick; the Popped-in digits landing
 *   light      Like, Pass and Ping buttons; a pass by gesture; message send; the Queue up pill
 *              press; Not now; `<Button haptic="light">` (the wizard's Continue)
 *   medium     a like by gesture; Queue up submit (`<Button haptic="medium">`)
 *   heavy      a Duo Pop arrives (the Pop card opening, a foreground `duo_pop` push)
 *   rigid      I'm in
 *   success    the DUO LOCKED lock (exactly one, fired by DuoLockedScreen); the launch lock; an
 *              invite or party accepted; copied or shared; password updated; card saved
 *   warning    the daily-limit bounce; a Duo Pop that was taken or expired
 *   error      error toasts (central: `showToast(message, "error")` fires it, so never call
 *              hapticError() right before one); failure Alerts; inline form errors
 *
 * Two rules that keep it from turning into noise:
 * - A Button that should buzz takes the `haptic` prop; never call a haptic in its onPress as well.
 * - Moments in a sequence (heavy, rigid, success, selection on a Duo Pop) stay at least 400ms
 *   apart, or the phone blurs them into one buzz.
 */

function enabled(): boolean {
  return useHapticsStore.getState().enabled;
}

const ignore = () => {};

export function hapticLight(): void {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
}

export function hapticMedium(): void {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
}

export function hapticHeavy(): void {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
}

export function hapticRigid(): void {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(ignore);
}

export function hapticSelection(): void {
  if (!enabled()) return;
  Haptics.selectionAsync().catch(ignore);
}

export function hapticSuccess(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
}

export function hapticWarning(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
}

export function hapticError(): void {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
}
