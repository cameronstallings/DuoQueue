import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";

/**
 * Ask for photo library access, and if it is refused, say so and offer the only route
 * that can actually fix it.
 *
 * iOS shows its permission sheet exactly once. After a denial,
 * `requestMediaLibraryPermissionsAsync()` resolves `granted: false` immediately without
 * presenting anything, so a bare `if (!granted) return` turns every subsequent tap into a
 * button that visibly does nothing. That was a hard lock, not a papercut: onboarding
 * requires a profile photo and a cover photo before it will continue
 * (`app/(onboarding)/display-name.tsx`), so a denied user was told to add photos and given
 * no way to add them, with no path forward and no explanation. Found while screen
 * recording a fresh signup for App Review.
 *
 * Returns true only when the picker may be opened.
 */
export async function ensurePhotoLibraryAccess(): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted) return true;

  // canAskAgain distinguishes "they just tapped Don't Allow on our sheet" from "iOS will
  // never show that sheet again" — the second needs Settings, and saying so is the whole
  // point of this function.
  const canRetryInApp = permission.canAskAgain;

  Alert.alert(
    "Photo access needed",
    canRetryInApp
      ? "DuoQueue needs access to your photos so you can add a profile picture. Tap Allow when the prompt appears."
      : "DuoQueue needs access to your photos so you can add a profile picture. Turn on Photos for DuoQueue in Settings, then come back.",
    canRetryInApp
      ? [{ text: "OK" }]
      : [{ text: "Not now", style: "cancel" }, { text: "Open Settings", onPress: () => void Linking.openSettings() }],
  );
  return false;
}
