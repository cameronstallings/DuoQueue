import * as Haptics from "expo-haptics";

/** Thin wrappers around expo-haptics — fire-and-forget, and swallow errors since haptics
 * are a nice-to-have (some devices/simulators don't support them) and should never crash
 * or block the interaction they're attached to. */

export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticMedium(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => {});
}

export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
