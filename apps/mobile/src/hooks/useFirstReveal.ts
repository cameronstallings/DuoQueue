import { useEffect, useRef } from "react";

/**
 * True only for the first reveal of a screen's content: in the renders where `ready` is true and
 * no earlier COMMITTED render was ready. After that it latches false for the life of the
 * component, so a background refetch (which flips loading and back, or hands over new data) never
 * replays a list's entrance cascade. Lifted from the Profile tab's latch, which this generalises.
 *
 * The latch is written in an effect, after the commit, rather than during render, so a render
 * that React throws away or repeats (Strict Mode, an interrupted render) cannot use up the reveal
 * before the frame that actually shows it.
 *
 * Pair it with `entranceKind` (theme/motion.ts) and `entranceFor` / `listItemEntering`
 * (theme/entering.ts): rows mounted during the first reveal cascade in, rows that arrive later
 * fade in on their own, rows already seen get nothing.
 */
export function useFirstReveal(ready: boolean): boolean {
  const revealedRef = useRef(false);
  const firstReveal = ready && !revealedRef.current;
  useEffect(() => {
    if (ready) revealedRef.current = true;
  }, [ready]);
  return firstReveal;
}
