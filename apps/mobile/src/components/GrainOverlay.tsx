import { Image, StyleSheet, View } from "react-native";

/** Aurora's film grain — a tiled noise PNG at ~5%. Sits over the aurora washes,
 * under content. The single cheapest thing keeping flat gradients from reading flat. */
export function GrainOverlay() {
  // Image's TS props don't include `pointerEvents` (unlike View), so the "none"
  // hit-testing behavior lives on this wrapping View instead.
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={require("../../assets/noise.png")}
        resizeMode="repeat"
        accessibilityElementsHidden
        style={{ flex: 1, opacity: 0.05 }}
      />
    </View>
  );
}
