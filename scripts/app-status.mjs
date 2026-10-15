// scripts/app-status.mjs — the site side of the app's minimum-version gate.
//
// Zero dependencies (global fetch only), matching the rest of scripts/.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS
//
// DuoQueue 1.0.2 and later read https://duoqueue.io/app-status.json when they open (and at most
// about once an hour after that) and show "Update DuoQueue" when the phone's BINARY version is
// older than `minVersion`. The file is committed at site/app-status.json, exactly one line:
//
//   {"minVersion":"1.0.1"}
//
// 1.0.0 and 1.0.1 have no gate at all, so "1.0.1" blocks nobody. The file exists so that a later
// edit can move 1.0.2+ phones forward (for example after the legacy Supabase key is switched off).
//
// HOW CAMERON CHANGES minVersion
//
//   1. Edit site/app-status.json (keep it one line, exactly {"minVersion":"x.y.z"}).
//   2. node scripts/deploy-site.mjs
//
// NEVER set it above the version that is live on the App Store: every phone, App Review's
// included, would see "Update DuoQueue" with no update to install. The deploy refuses to publish
// that (it reads the live store version with fetchLiveStoreVersion below). GitHub Pages caches the
// file for up to 10 minutes, so a change reaches phones within about that long.
//
// parseAppStatus and compareVersions here are twins of the TypeScript ones in
// apps/mobile/src/features/update/appStatus.ts, with exactly the same semantics;
// appStatusFiles.test.ts runs both over a shared table so they cannot drift.
// ---------------------------------------------------------------------------

export const APP_STORE_LOOKUP_URL = "https://itunes.apple.com/lookup?id=6798837181&country=us";

const VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,3}$/;

/** "1.0.2" to [1, 0, 2]; null for anything that is not one to four numeric segments. */
export function parseVersion(v) {
  if (typeof v !== "string" || !VERSION_PATTERN.test(v)) return null;
  return v.split(".").map((segment) => Number(segment));
}

/** -1, 0 or 1; missing trailing segments count as 0; null if either side is invalid. */
export function compareVersions(a, b) {
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

/** A plain object whose minVersion parses (extra fields ignored), as { minVersion }; else null. */
export function parseAppStatus(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const minVersion = raw.minVersion;
  if (parseVersion(minVersion) === null) return null;
  return { minVersion };
}

/** The version live on the US App Store, or null when it cannot be read within 5 s. */
export async function fetchLiveStoreVersion(fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetchImpl(APP_STORE_LOOKUP_URL, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = await res.json();
    const version = body?.results?.[0]?.version;
    return typeof version === "string" && parseVersion(version) ? version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
