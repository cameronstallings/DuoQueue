import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  EMPTY_REVIEW_LEDGER,
  MAX_REMEMBERED_LOCKS,
  REVIEW_COOLDOWN_MS,
  REVIEW_DELAY_MS,
  type ReviewLedger,
  isLiveReplyToMe,
  markReviewAsked,
  parseReviewLedger,
  recordDuoLocked,
  shouldAskForReview,
} from "./reviewPrompt";

/**
 * When the App Store rating sheet may be asked for: after the 2nd distinct DUO LOCKED (or later),
 * or after a live reply to the player's own message; once per app version, 120 days apart, never
 * after a report, block or unmatch this session. Apple then decides whether it shows at all.
 */
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 15, 20, 0, 0);

function ledger(patch: Partial<ReviewLedger> = {}): ReviewLedger {
  return { ...EMPTY_REVIEW_LEDGER, ...patch };
}

describe("constants", () => {
  it("are the agreed numbers", () => {
    expect(REVIEW_COOLDOWN_MS).toBe(120 * DAY);
    expect(REVIEW_DELAY_MS).toBe(2000);
    expect(MAX_REMEMBERED_LOCKS).toBe(20);
    expect(EMPTY_REVIEW_LEDGER).toEqual({ lastAskedAtMs: null, lastAskedVersion: null, lockedMatchIds: [] });
  });
});

describe("shouldAskForReview", () => {
  const ask = (patch: Partial<Parameters<typeof shouldAskForReview>[0]>) =>
    shouldAskForReview({ ledger: ledger(), appVersion: "1.0.2", nowMs: NOW, safetyActionThisSession: false, ...patch });

  it("asks on an empty ledger", () => {
    expect(ask({})).toBe(true);
  });

  it("never asks after a report, block or unmatch this session", () => {
    expect(ask({ safetyActionThisSession: true })).toBe(false);
  });

  it("never asks without a version", () => {
    expect(ask({ appVersion: null })).toBe(false);
    expect(ask({ appVersion: "" })).toBe(false);
  });

  it("asks once per version", () => {
    expect(ask({ ledger: ledger({ lastAskedAtMs: NOW - 200 * DAY, lastAskedVersion: "1.0.2" }) })).toBe(false);
  });

  it("waits 120 days between asks, even across versions", () => {
    expect(ask({ ledger: ledger({ lastAskedAtMs: NOW - 119 * DAY, lastAskedVersion: "1.0.1" }) })).toBe(false);
    expect(ask({ ledger: ledger({ lastAskedAtMs: NOW - 121 * DAY, lastAskedVersion: "1.0.1" }) })).toBe(true);
  });

  it("does not trust an ask stamped in the future", () => {
    expect(ask({ ledger: ledger({ lastAskedAtMs: NOW + DAY, lastAskedVersion: "1.0.1" }) })).toBe(false);
  });
});

describe("recordDuoLocked", () => {
  it("does not trigger on the first lock", () => {
    const { ledger: next, isTrigger } = recordDuoLocked(ledger(), "m1");
    expect(isTrigger).toBe(false);
    expect(next.lockedMatchIds).toEqual(["m1"]);
  });

  it("triggers on the second distinct lock", () => {
    const first = recordDuoLocked(ledger(), "m1").ledger;
    expect(recordDuoLocked(first, "m2").isTrigger).toBe(true);
  });

  it("does not count the same match twice, whatever its case or spaces", () => {
    const first = recordDuoLocked(ledger(), "ABC").ledger;
    const again = recordDuoLocked(first, " abc ");
    expect(again.isTrigger).toBe(false);
    expect(again.ledger).toBe(first);
  });

  it("leaves the 3rd eligible when the 2nd was cut short", () => {
    const one = recordDuoLocked(ledger(), "m1").ledger;
    const two = recordDuoLocked(one, "m2").ledger;
    expect(recordDuoLocked(two, "m3").isTrigger).toBe(true);
  });

  it("keeps only the newest 20 ids", () => {
    let current = ledger();
    for (let i = 0; i < 25; i++) current = recordDuoLocked(current, `m${i}`).ledger;
    expect(current.lockedMatchIds).toHaveLength(20);
    expect(current.lockedMatchIds[0]).toBe("m5");
    expect(current.lockedMatchIds[19]).toBe("m24");
  });

  it("ignores an empty id", () => {
    const start = ledger({ lockedMatchIds: ["m1"] });
    for (const id of ["", "   "]) {
      const result = recordDuoLocked(start, id);
      expect(result.isTrigger).toBe(false);
      expect(result.ledger).toBe(start);
    }
  });
});

describe("markReviewAsked", () => {
  it("stamps the time and version and keeps the locks", () => {
    const start = ledger({ lockedMatchIds: ["m1", "m2"] });
    expect(markReviewAsked(start, "1.0.2", NOW)).toEqual({
      lastAskedAtMs: NOW,
      lastAskedVersion: "1.0.2",
      lockedMatchIds: ["m1", "m2"],
    });
  });
});

describe("parseReviewLedger", () => {
  it("reads back what was saved", () => {
    const saved = { lastAskedAtMs: NOW, lastAskedVersion: "1.0.2", lockedMatchIds: ["m1", "m2"] };
    expect(parseReviewLedger(JSON.stringify(saved))).toEqual(saved);
    expect(parseReviewLedger(saved)).toEqual(saved);
  });

  it("is empty for anything unreadable", () => {
    for (const raw of [null, undefined, "", "{", "[]", "42", "null"]) {
      expect(parseReviewLedger(raw)).toEqual(EMPTY_REVIEW_LEDGER);
    }
  });

  it("keeps the good fields of a damaged ledger", () => {
    expect(parseReviewLedger(JSON.stringify({ lastAskedAtMs: "soon", lastAskedVersion: 102, lockedMatchIds: "m1" }))).toEqual(
      EMPTY_REVIEW_LEDGER,
    );
    expect(parseReviewLedger(JSON.stringify({ lastAskedAtMs: NOW, lockedMatchIds: ["M1", 7, null, "", "m1", "m2"] }))).toEqual({
      lastAskedAtMs: NOW,
      lastAskedVersion: null,
      lockedMatchIds: ["m1", "m2"],
    });
  });
});

describe("isLiveReplyToMe", () => {
  const ME = "me";
  const THEM = "them";
  const MOUNT = NOW;

  it("is true for their message, after mount, answering mine", () => {
    expect(isLiveReplyToMe([{ senderId: ME, atMs: MOUNT - 60_000 }, { senderId: THEM, atMs: MOUNT + 5000 }], ME, MOUNT)).toBe(true);
    expect(isLiveReplyToMe([{ senderId: ME, atMs: MOUNT + 1000 }, { senderId: THEM, atMs: MOUNT + 5000 }], ME, MOUNT)).toBe(true);
  });

  it("is false for a reply that was already there before the chat opened", () => {
    expect(isLiveReplyToMe([{ senderId: ME, atMs: MOUNT - 60_000 }, { senderId: THEM, atMs: MOUNT - 1000 }], ME, MOUNT)).toBe(false);
  });

  it("is false when the newest message is mine", () => {
    expect(isLiveReplyToMe([{ senderId: THEM, atMs: MOUNT - 1000 }, { senderId: ME, atMs: MOUNT + 1000 }], ME, MOUNT)).toBe(false);
  });

  it("is false for theirs after theirs", () => {
    expect(isLiveReplyToMe([{ senderId: THEM, atMs: MOUNT + 1000 }, { senderId: THEM, atMs: MOUNT + 2000 }], ME, MOUNT)).toBe(false);
  });

  it("is false for a single message or none", () => {
    expect(isLiveReplyToMe([{ senderId: THEM, atMs: MOUNT + 1000 }], ME, MOUNT)).toBe(false);
    expect(isLiveReplyToMe([], ME, MOUNT)).toBe(false);
  });

  it("is false for a timestamp that is not a number", () => {
    expect(isLiveReplyToMe([{ senderId: ME, atMs: MOUNT }, { senderId: THEM, atMs: Number.NaN }], ME, MOUNT)).toBe(false);
  });

  it("is false without a signed-in id", () => {
    expect(isLiveReplyToMe([{ senderId: ME, atMs: MOUNT }, { senderId: THEM, atMs: MOUNT + 1 }], undefined, MOUNT)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source scans: the ask happens only from the rating module, the native module has one importer,
// and nothing wires the ask to a button (Apple 5.6.1: no prompt on a tap, no "Do you like us?").
// ---------------------------------------------------------------------------

const MOBILE_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = [...sourceFiles(join(MOBILE_ROOT, "app")), ...sourceFiles(join(MOBILE_ROOT, "src"))].map((full) => ({
  rel: full.slice(MOBILE_ROOT.length).replace(/\\/g, "/"),
  text: readFileSync(full, "utf8"),
}));

describe("source scans", () => {
  it("finds the app's sources", () => {
    expect(FILES.some((f) => f.rel === "src/features/rating/requestReview.ts")).toBe(true);
    expect(FILES.some((f) => f.rel === "app/_layout.tsx")).toBe(true);
  });

  it("calls maybeAskForReview only inside src/features/rating/", () => {
    const callers = FILES.filter((f) => f.text.includes("maybeAskForReview(")).map((f) => f.rel);
    expect(callers.length).toBeGreaterThan(0);
    for (const rel of callers) expect(rel.startsWith("src/features/rating/")).toBe(true);
  });

  it("imports expo-store-review only in requestReview.ts", () => {
    const importers = FILES.filter((f) => /from\s+["']expo-store-review["']|require\(["']expo-store-review["']\)/.test(f.text)).map(
      (f) => f.rel,
    );
    expect(importers).toEqual(["src/features/rating/requestReview.ts"]);
  });

  it("never asks from a button", () => {
    for (const f of FILES) {
      expect(f.text, f.rel).not.toMatch(/onPress=\{\s*\(\)\s*=>\s*(void\s+)?maybeAskForReview/);
    }
  });

  // The chat stays mounted under its own sheets (menu, Report, Rate, Schedule, Discord), so a
  // reply landing while one is open would put Apple's sheet over it, the worst case being over
  // "Report this user". Every sheet the chat screen owns must close the gate, including any a
  // later change adds. (Screens pushed over the chat are covered by the hook's own focus check.)
  it("gates the chat's first-reply ask on every sheet the chat screen opens", () => {
    const chat = FILES.find((f) => f.rel === "app/chat/[matchId].tsx");
    expect(chat).toBeDefined();
    const text = chat!.text;
    const sheets = [...text.matchAll(/const \[(\w+Visible), set\w+\] = useState\(/g)]
      .map((m) => m[1])
      .filter((name) => name !== "keyboardVisible");
    expect(sheets).toEqual(
      expect.arrayContaining(["menuVisible", "reportVisible", "feedbackVisible", "scheduleVisible", "discordEditorVisible"]),
    );
    const call = /useFirstReplyReviewPrompt\(([^;]*)\);/.exec(text);
    expect(call, "the chat calls useFirstReplyReviewPrompt").not.toBeNull();
    for (const name of sheets) expect(call![1], name).toMatch(new RegExp(`!${name}\\b`));
  });

  it("asks after a reply only while the chat is the focused screen", () => {
    const hook = FILES.find((f) => f.rel === "src/features/rating/useReviewTriggers.ts");
    expect(hook).toBeDefined();
    expect(hook!.text).toMatch(/useFocusEffect\(/);
    expect(hook!.text).toMatch(/enabled: boolean/);
  });
});
