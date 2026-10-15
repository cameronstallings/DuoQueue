import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as StoreReview from "expo-store-review";
import { AppState } from "react-native";

import {
  markReviewAsked,
  parseReviewLedger,
  recordDuoLocked,
  type ReviewLedger,
  type ReviewTrigger,
  shouldAskForReview,
} from "./reviewPrompt";
import { hadSafetyActionThisSession } from "./reviewSession";

/**
 * The ONLY importer of expo-store-review (a source scan in reviewPrompt.test.ts holds that).
 *
 * `maybeAskForReview` asks iOS for the system rating sheet when the rules in reviewPrompt.ts allow
 * it. Apple decides whether the sheet actually shows (at most 3 times in 365 days per person, and
 * never in TestFlight), so a call is a request, not a promise. There is no "Do you like DuoQueue?"
 * screen in front of it and it is never wired to a button (App Store 5.6.1).
 *
 * The ledger is SAVED as asked BEFORE the native request, so a crash during the sheet or a second
 * trigger a moment later can never ask twice for the same version.
 */

export const REVIEW_LEDGER_KEY = "duoqueue.review-prompt.v1";

/** The version asked in this runtime, in case the ledger write itself failed. */
let askedThisRuntime: string | null = null;
let asking = false;

async function loadLedger(): Promise<ReviewLedger> {
  try {
    return parseReviewLedger(await AsyncStorage.getItem(REVIEW_LEDGER_KEY));
  } catch {
    return parseReviewLedger(null);
  }
}

async function saveLedger(ledger: ReviewLedger): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Not remembered past this launch; askedThisRuntime still holds for this one.
  }
}

/** Counts a DUO LOCKED for this match. True when it is the 2nd distinct one or later. */
export async function noteDuoLockedForReview(matchId: string): Promise<boolean> {
  try {
    const ledger = await loadLedger();
    const { ledger: next, isTrigger } = recordDuoLocked(ledger, matchId);
    if (next !== ledger) await saveLedger(next);
    return isTrigger;
  } catch {
    return false;
  }
}

/** Asks for the rating sheet if every rule allows it right now. Never throws. */
export async function maybeAskForReview(trigger: ReviewTrigger): Promise<void> {
  if (asking) return;
  asking = true;
  try {
    // Only into a foreground app: a sheet requested while backgrounded is wasted or worse.
    if (AppState.currentState !== "active") return;

    const appVersion = Application.nativeApplicationVersion;
    if (!appVersion || askedThisRuntime === appVersion) return;
    const ledger = await loadLedger();
    const nowMs = Date.now();
    if (!shouldAskForReview({ ledger, appVersion, nowMs, safetyActionThisSession: hadSafetyActionThisSession() })) return;
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    askedThisRuntime = appVersion;
    await saveLedger(markReviewAsked(ledger, appVersion, nowMs));
    await StoreReview.requestReview();
  } catch (err) {
    console.warn(`Rating prompt (${trigger}) failed:`, err);
  } finally {
    asking = false;
  }
}
