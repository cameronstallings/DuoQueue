import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";

import { reportApiKeyRejection } from "@/features/update/updateGateStore";
import { createKeyAwareFetch, supabaseKeyKind } from "@/lib/supabaseKey";

/**
 * Supabase session tokens routinely exceed SecureStore's ~2KB per-key limit, so we
 * follow Supabase's documented Expo pattern: the session blob lives in AsyncStorage
 * encrypted with a per-key AES key, and only that small AES key lives in SecureStore.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. The key variable keeps its " +
      "old name but holds the project's publishable key (sb_publishable_...). Copy .env.example " +
      "to .env and fill both in.",
  );
}

const keyKind = supabaseKeyKind(supabaseAnonKey);
if (keyKind === "secret") {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY holds a SECRET key (sb_secret_ or service_role). A secret key " +
      "must never ship inside the app. Put the publishable key (sb_publishable_...) in that " +
      "variable instead.",
  );
}

/** Which kind of key this build carries ("publishable" or "legacy"); stamped on the push token row. */
export const SUPABASE_KEY_KIND = keyKind;

// The publishable key needs no code change: supabase-js sends it exactly as it sent the anon key.
// The key-aware fetch only DETECTS a dead key (the legacy keys are switched off in December): a
// 401 "Invalid API key" on any request (supabase-js 2.110 passes `global.fetch` to auth, PostgREST,
// Storage and Functions) goes to the update gate, which tries an OTA and otherwise shows
// "Update DuoQueue". This file is the only reader of the key in the app.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: createKeyAwareFetch((input, init) => fetch(input, init), reportApiKeyRejection),
  },
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // supabase-js defaults to the implicit flow, which puts tokens in the redirect
    // URL where they can leak via logs/history. PKCE keeps the exchange server-side
    // against a one-time verifier instead.
    flowType: "pkce",
  },
});
