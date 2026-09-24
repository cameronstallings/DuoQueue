/**
 * A sheet row that opens another sheet (Report, Schedule, a party member's actions) cannot do
 * it in one step on iOS. Both are React Native Modals hosted by the same screen, so both are
 * presented from that screen's view controller, and UIKit refuses to present while that
 * controller is still sliding the first one out. The second modal never appears, yet its
 * `visible` is already true, so tapping the row again changes nothing: Report stays dead until
 * the screen is left.
 *
 * So the row hands off: it closes its sheet and parks the next step, and the sheet's
 * `onDismiss` (React Native fires it on iOS only, once the slide-out has finished) runs it.
 * Android stacks its dialogs and never fires `onDismiss`, so there the next step runs at once,
 * exactly as before.
 *
 * An Alert or a `router.push` needs none of this: React Native presents an Alert from a window
 * of its own, and react-native-screens waits out a foreign modal's dismissal before it presents
 * a modal route.
 *
 * Pure, with the platform passed in, so it is tested without React Native.
 */
export interface SheetHandoff {
  /** Closes the sheet, then runs `next` once another modal can safely be presented. */
  handOff: (close: () => void, next: () => void) => void;
  /** The sheet's `onDismiss`. Runs the parked step, if there is one, exactly once. */
  onDismissed: () => void;
}

export function createSheetHandoff(waitForDismiss: boolean): SheetHandoff {
  let parked: (() => void) | null = null;

  return {
    handOff: (close, next) => {
      if (!waitForDismiss) {
        close();
        next();
        return;
      }
      // Parked before the close, so even a dismissal reported at once cannot miss it. A second
      // row tapped during the slide-out replaces the first: only one modal can open.
      parked = next;
      close();
    },
    onDismissed: () => {
      const next = parked;
      parked = null;
      next?.();
    },
  };
}
