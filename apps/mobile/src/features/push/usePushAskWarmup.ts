import { useEffect } from "react";

import { usePushAskStore } from "./pushAskStore";
import { usePushPermission } from "./usePushPermission";

/**
 * Warms both inputs every ask decides on (the persisted ask record and the OS permission), from
 * the tab layout, so they are already in memory by the time a DUO LOCKED opens. The DUO LOCKED
 * card decides once, in its first render, and shows nothing at all when either input is still
 * cold: a card that arrives late would shift a centred screen mid-celebration.
 */
export function usePushAskWarmup(): void {
  useEffect(() => {
    void usePushAskStore.getState().load();
  }, []);
  usePushPermission();
}
