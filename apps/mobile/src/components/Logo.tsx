import { Image } from "react-native";

// Native aspect ratio of the source mark (720x540) — used so callers only need to
// pass a width and get a correctly proportioned height for free.
const ASPECT_RATIO = 720 / 540;

export function Logo({ width = 64 }: { width?: number }) {
  return (
    <Image
      source={require("../../assets/logo-mark.png")}
      style={{ width, height: width / ASPECT_RATIO }}
      resizeMode="contain"
      accessibilityLabel="DuoQueue"
    />
  );
}
