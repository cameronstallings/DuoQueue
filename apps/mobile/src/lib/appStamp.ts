import type { PushTokenDeviceInfo } from "@duoqueue/shared-types";

/**
 * The app's version, two ways.
 *
 * `buildDeviceStamp` is what 1.0.2+ saves in `push_tokens.device_info` beside the push token:
 * which version, build and OTA update the phone runs, its OS and OS version, and which kind of
 * Supabase key the build carries. That answers two questions nothing else can: which builds and
 * updates are still in use (so an old one can be retired with the minimum-version gate without
 * guessing), and whether the publishable key reached every phone before the legacy key is
 * switched off in December. Technical facts only: no device name, no identifier, no location
 * (privacy policy 1.6, "Push notification token and app version"). Every string is trimmed and
 * cut to 64 characters, so the row stays small whatever a native module returns.
 *
 * `versionLabel` is the line under Settings > Legal ("DuoQueue 1.0.2 (19)", plus the update when
 * an OTA is running), for support and as proof that an OTA landed.
 *
 * Pure (only `import type`), so vitest runs it in node.
 */

const MAX_FIELD = 64;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_FIELD);
  return trimmed === "" ? null : trimmed;
}

export interface DeviceStampInput {
  appVersion?: unknown;
  build?: unknown;
  runtimeVersion?: unknown;
  updateId?: unknown;
  channel?: unknown;
  embedded?: unknown;
  os?: unknown;
  osVersion?: unknown;
  keyKind?: unknown;
}

export function buildDeviceStamp(input: DeviceStampInput, now: Date): PushTokenDeviceInfo {
  const keyKind = input.keyKind === "publishable" || input.keyKind === "legacy" ? input.keyKind : "unknown";
  return {
    app_version: text(input.appVersion),
    build: text(input.build),
    runtime_version: text(input.runtimeVersion),
    update_id: text(input.updateId),
    channel: text(input.channel),
    embedded: typeof input.embedded === "boolean" ? input.embedded : null,
    os: text(input.os) ?? "unknown",
    os_version: text(input.osVersion),
    key_kind: keyKind,
    stamped_at: now.toISOString(),
  };
}

/**
 * "DuoQueue 1.0.2 (19)", plus " · update d5ebe82f" only when an OTA (not the embedded bundle) is
 * running, or just "DuoQueue" when the version cannot be read.
 */
export function versionLabel({
  version,
  build,
  updateId,
  embedded,
}: {
  version: string | null;
  build: string | null;
  updateId: string | null;
  embedded: boolean | null;
}): string {
  if (!version) return "DuoQueue";
  let label = `DuoQueue ${version}`;
  if (build) label += ` (${build})`;
  if (embedded === false && updateId) label += ` · update ${updateId.slice(0, 8)}`;
  return label;
}
