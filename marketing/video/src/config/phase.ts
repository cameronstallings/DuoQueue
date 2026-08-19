/**
 * Which call to action the end card carries. The content does two different jobs across the
 * launch and must not fight itself: during the waitlist the ask is the landing page, after
 * release it is the App Store. Same videos, one different card.
 *
 * There is no App Store URL in this repo, because DuoQueue 1.0 is approved and not released,
 * so the numeric id does not exist yet. It is therefore configuration, and rendering with it
 * unset is a hard error rather than a placeholder burned into three finished videos.
 */

export type Phase = "waitlist" | "launched";

const PHASES: readonly Phase[] = ["waitlist", "launched"];

/** The App Store link shape. Anything else (a marketing page, an appstore.com short link, a
 * half-pasted id) is a wrong CTA that would only be discovered after upload. */
const APP_STORE_PREFIX = "https://apps.apple.com/";

/**
 * This module is bundled into the browser as well as run under node, because Root.tsx uses
 * `CTA.waitlist` as a default prop. Remotion's setup-environment gives the browser a
 * `window.process.env` containing only REMOTION_ variables, so both reads below return
 * undefined there and the waitlist defaults apply. That is correct and never used: the
 * resolved CTA travels into the composition through inputProps, and no component reads env.
 */
const env = (key: string): string | undefined =>
  typeof process === "undefined" ? undefined : process.env[key];

// `.env` is read relative to cwd, which is marketing/video for every script in package.json.
// Guarded on the function rather than on the platform so the browser bundle skips it: node's
// loadEnvFile does not exist on window.process. A missing .env is the normal case.
if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env, or an unreadable one. The waitlist defaults below still apply, and
    // assertPhaseConfigured() is what refuses to render if that is not good enough.
  }
}

const rawPhase = env("PHASE");
if (rawPhase !== undefined && rawPhase !== "" && !PHASES.includes(rawPhase as Phase)) {
  // A typo here would silently render waitlist CTAs after release, which is the exact
  // failure Decision 6 exists to prevent, so an unknown value is fatal rather than ignored.
  throw new Error(
    `PHASE is "${rawPhase}", which is not one of ${PHASES.join(" | ")}. Fix it in marketing/video/.env.`,
  );
}

export const PHASE: Phase = (rawPhase as Phase) || "waitlist";

export const CTA = {
  waitlist: { line: "join the waitlist", url: "duoqueue.io" },
  launched: { line: "free on the App Store", url: env("APP_STORE_URL") ?? "" },
} as const;

/** What a format component receives. It is a value, not a lookup, precisely so no component
 * can reach for `process.env` at render time. */
export type Cta = (typeof CTA)[Phase];

/**
 * Called by render-day before bundling. Failing here costs a second; failing after the batch
 * costs three videos with a dead link on the end card.
 */
export const assertPhaseConfigured = (): void => {
  if (PHASE !== "launched") {
    return;
  }
  const url = CTA.launched.url;
  if (url === "") {
    throw new Error(
      "PHASE=launched but APP_STORE_URL is empty. Set it in marketing/video/.env (see .env.example).",
    );
  }
  if (!url.startsWith(APP_STORE_PREFIX)) {
    throw new Error(
      `APP_STORE_URL is "${url}", which does not start with ${APP_STORE_PREFIX}. That is not an App Store link.`,
    );
  }
};
