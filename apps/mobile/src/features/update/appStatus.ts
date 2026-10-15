/**
 * The minimum-version gate's decisions, pure so vitest can pin every one of them.
 *
 * The app reads a tiny static file, https://duoqueue.io/app-status.json (`{"minVersion":"1.0.1"}`),
 * and shows "Update DuoQueue" only when the BINARY's version is older than `minVersion`.
 *
 * Fail open on everything unexpected. A wrong block locks out every player and App Review at
 * once, with no way to reach them except a new build; a wrong pass costs nothing, because an old
 * build that still works is fine and one that does not work fails in the same ways it always has.
 * So a missing file, a malformed file, a version this code cannot read, a timeout: all "open".
 * Only a clean "this binary is older than minVersion" blocks.
 *
 * The file lives on GitHub Pages, not in Supabase, on purpose: the first time this gate matters is
 * when the legacy Supabase key is switched off (December), and a check that needs that key would
 * fail with it. Pages still answers when the Supabase key is what broke.
 *
 * `scripts/app-status.mjs` holds a twin of `parseAppStatus` and `compareVersions` for the site
 * deploy guard; `appStatusFiles.test.ts` proves the two agree.
 */

export const APP_STATUS_URL = "https://duoqueue.io/app-status.json";

/** The words on the "Update DuoQueue" screen (UpdateRequiredOverlay), swept by the copy test. */
export const UPDATE_SCREEN_COPY = {
  title: "Update DuoQueue to keep playing",
  body: "This version of DuoQueue is too old to keep working. The update is free, and your profile, matches and chats will all still be here.",
  openStore: "Open the App Store",
  tryAgain: "Try again",
} as const;

export interface AppStatus {
  minVersion: string;
}

export type GateDecision = "open" | "update-required";

const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,3}$/;

/** "1.0.2" to [1, 0, 2]; null for anything that is not one to four numeric segments. */
export function parseVersion(v: unknown): number[] | null {
  if (typeof v !== "string" || !VERSION_PATTERN.test(v)) return null;
  return v.split(".").map((segment) => Number(segment));
}

/** -1, 0 or 1 like a comparator; missing trailing segments count as 0; null if either is invalid. */
export function compareVersions(a: unknown, b: unknown): -1 | 0 | 1 | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** A plain object whose `minVersion` parses; extra fields ignored; null for anything else. */
export function parseAppStatus(raw: unknown): AppStatus | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const minVersion = (raw as { minVersion?: unknown }).minVersion;
  if (parseVersion(minVersion) === null) return null;
  return { minVersion: minVersion as string };
}

/** "update-required" ONLY when both versions parse and the app is older; everything else "open". */
export function gateDecision({
  appVersion,
  status,
}: {
  appVersion: string | null | undefined;
  status: AppStatus | null;
}): GateDecision {
  if (!status) return "open";
  return compareVersions(appVersion, status.minVersion) === -1 ? "update-required" : "open";
}

/**
 * The URL with a cache key that changes once a minute, so neither a CDN nor the phone's URL cache
 * can hand back a stale answer for longer than that (GitHub Pages itself caches up to 10 minutes,
 * which the deploy script's header warns about).
 */
export function statusCheckUrl(nowMs: number): string {
  return `${APP_STATUS_URL}?v=${Math.floor(nowMs / 60000)}`;
}
