import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

/** Wires react-query's online/offline detection to the device's actual network state,
 * so queries pause retrying while offline and refetch automatically the moment
 * connectivity returns, instead of burning through retries against a dead network. */
export function configureNetworkAwareQueries(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
  });
}
