import { useState } from "react";
import { Platform } from "react-native";

import { createSheetHandoff, type SheetHandoff } from "@/lib/sheetHandoff";

/**
 * One per sheet that opens another modal: call `handOff(close, next)` from the row and pass
 * `onDismissed` to that sheet's `onDismiss`. See `@/lib/sheetHandoff` for why iOS has to wait.
 */
export function useSheetHandoff(): SheetHandoff {
  const [handoff] = useState(() => createSheetHandoff(Platform.OS === "ios"));
  return handoff;
}
