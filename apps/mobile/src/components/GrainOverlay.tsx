import { Image, StyleSheet, View } from "react-native";

/** Volt's film grain — a tiled noise PNG at ~3.5%. Sits over the graticule,
 * under content. The single cheapest thing keeping flat surfaces from reading flat. */
export function GrainOverlay() {
  // Image's TS props don't include `pointerEvents` (unlike View), so the "none"
  // hit-testing behavior lives on this wrapping View instead.
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={require("../../assets/noise.png")}
        resizeMode="repeat"
        accessibilityElementsHidden
        style={{ flex: 1, opacity: 0.035 }}
      />
    </View>
  );
}
