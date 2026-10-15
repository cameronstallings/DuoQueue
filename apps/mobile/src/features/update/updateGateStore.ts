import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { create } from "zustand";

import { gateDecision, parseAppStatus, statusCheckUrl } from "./appStatus";

/**
 * Whether the "Update DuoQueue" screen covers the app, and why.
 *
 * Two ways in:
 *
 * 1. "min-version": duoqueue.io/app-status.json says this binary is too old (`appStatus.ts`). It
 *    is checked at launch and on resume (`useUpdateGate`), at most once an hour while open and on
 *    every resume or "Try again" while blocked, so moving minVersion back down frees a blocked
 *    phone at once. Everything unexpected fails OPEN: a non-2xx, a body that is not JSON (Pages
 *    answers a missing file with a text/html 404), a timeout, a throw.
 *
 * 2. "key": Supabase rejected the app's API key (`supabaseKey.ts` sees the 401 "Invalid API key"
 *    on any request and calls `reportApiKeyRejection`). That is what happens to a phone still on
 *    the legacy anon key after December's switch-off. The first thing to try is an OTA: if the
 *    key-only update (or anything newer) is waiting, fetch it and reload into it, and the phone
 *    heals itself. Only when there is no NEW update does the screen show, and it stays for the
 *    rest of that launch (nothing works with a dead key anyway, so pretending otherwise just
 *    shows broken screens). A reload only follows a new update, so it cannot loop; and the whole
 *    thing runs at most once per JS runtime however many requests fail.
 *
 * No react-native and no supabase import: supabase.ts imports this file, and vitest runs it in
 * node with expo-updates and expo-application mocked.
 */

export type GateReason = "min-version" | "key";

interface UpdateGateState {
  blocked: boolean;
  reason: GateReason | null;
  lastCheckedAtMs: number | null;
}

export const STATUS_RECHECK_MS = 3_600_000;
export const STATUS_FETCH_TIMEOUT_MS = 5000;

const INITIAL: UpdateGateState = { blocked: false, reason: null, lastCheckedAtMs: null };

export const useUpdateGateStore = create<UpdateGateState>(() => ({ ...INITIAL }));

let inFlight: Promise<void> | null = null;
let keyRejectionHandled = false;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function keyBlocked(): boolean {
  return useUpdateGateStore.getState().reason === "key";
}

function failOpen(): void {
  // A dead key outranks anything the status file says; never clear it from here.
  if (keyBlocked()) return;
  useUpdateGateStore.setState({ blocked: false, reason: null });
}

/** Reads the status file within the time limit; any failure throws. */
async function readStatus(nowMs: number, fetchImpl: FetchLike): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The abort handles a fetch that honours its signal; the race handles one that does not, and a
  // body read that hangs after the headers arrived.
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("app-status check timed out"));
    }, STATUS_FETCH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const res = await fetchImpl(statusCheckUrl(nowMs), {
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`app-status answered ${res.status}`);
        return JSON.parse(await res.text()) as unknown;
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runCheck(nowMs: number, fetchImpl: FetchLike): Promise<void> {
  let body: unknown;
  try {
    body = await readStatus(nowMs, fetchImpl);
  } catch {
    failOpen();
    return;
  }
  if (keyBlocked()) return;
  const decision = gateDecision({ appVersion: Application.nativeApplicationVersion, status: parseAppStatus(body) });
  useUpdateGateStore.setState({
    blocked: decision === "update-required",
    reason: decision === "update-required" ? "min-version" : null,
    lastCheckedAtMs: nowMs,
  });
}

/**
 * Checks duoqueue.io/app-status.json. Never throws. Skips when the key block is up (sticky for the
 * launch), shares one in-flight check between callers, and, unless forced, skips while open and
 * checked within the hour. While blocked every call checks, so "Try again" and each resume can
 * free the phone.
 */
export function checkAppStatus(opts: { force?: boolean; nowMs?: number; fetchImpl?: FetchLike } = {}): Promise<void> {
  if (keyBlocked()) return Promise.resolve();
  if (inFlight) return inFlight;

  const nowMs = opts.nowMs ?? Date.now();
  const { blocked, lastCheckedAtMs } = useUpdateGateStore.getState();
  const checkedRecently =
    lastCheckedAtMs !== null && nowMs >= lastCheckedAtMs && nowMs - lastCheckedAtMs < STATUS_RECHECK_MS;
  if (!opts.force && !blocked && checkedRecently) return Promise.resolve();

  const fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  inFlight = runCheck(nowMs, fetchImpl).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Supabase said the app's API key is invalid. At most once per JS runtime: fetch an OTA and, only
 * when it is NEW (or a roll back to the embedded build), reload into it; otherwise, or on any
 * throw, cover the app with the update screen for the rest of the launch. Never throws.
 */
export async function reportApiKeyRejection(): Promise<void> {
  if (keyRejectionHandled) return;
  keyRejectionHandled = true;
  try {
    if (Updates.isEnabled) {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew || result.isRollBackToEmbedded) {
        await Updates.reloadAsync();
        return;
      }
    }
  } catch {
    // No update reachable: fall through to the screen.
  }
  useUpdateGateStore.setState({ blocked: true, reason: "key" });
}

export function resetUpdateGateForTests(): void {
  inFlight = null;
  keyRejectionHandled = false;
  useUpdateGateStore.setState({ ...INITIAL });
}
