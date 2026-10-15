import {
  discordUsernameSchema,
  displayNameSchema,
  LANGUAGE_CODES,
  type LanguageCode,
  LOL_TIER_CHOICES,
  type LolDivision,
  type LolTierChoice,
  MIN_AGE,
  type Platform,
  PLATFORMS,
  PLAYSTYLE_TAGS,
  type PlaystyleTag,
  PROMPT_COUNT,
  type Region,
  REGIONS,
  SKILL_LEVELS,
  type SkillLevel,
} from "@duoqueue/shared-types";

import { checkDob } from "../auth/completeSignup";
import type { ProfileStatus } from "../auth/sessionRouting";
import { cardDetailsLine } from "../swipe/cardChips";
import { REGION_LABELS } from "./profile-labels";
import { type DraftStep, isDraftStep, type OnboardingStep } from "./steps";

/**
 * The rules of the signed-out draft: when it is complete, what Save does first, what survives a
 * relaunch, and what the card preview says. Pure, so every rule is pinned in commitDraft.test.ts;
 * the store (`onboarding-store.ts`) and the commit (`commit-store.ts`) only apply them.
 *
 * THE DRAFT, in one paragraph. 1.0.2 builds the card before the account exists (D1: a local
 * draft, not an anonymous Supabase session). Every answer lives in the onboarding store, persisted
 * to AsyncStorage, from the age gate to "Save your card". Save creates the account (email or
 * Apple), and the commit then writes the draft onto the new profile exactly as 1.0.1's last
 * wizard step did. The draft is never sent anywhere before that tap.
 */

export interface SelectedGame {
  gameId: string;
  name: string;
  skillLevel: SkillLevel;
  /** Free text for every game but League. For League it holds the picked rank's label, or the
   * unparseable legacy text the picker's note shows. See features/league/rankPickerState.ts. */
  rankText: string;
  /** League of Legends only; null on every other game when it is sent (toProfileGameRow). */
  lolTier: LolTierChoice | null;
  lolDivision: LolDivision | null;
}

export interface SelectedShow {
  showId: string;
  name: string;
}

export interface SelectedPrompt {
  promptId: string;
  question: string;
  answer: string;
}

/** Everything the onboarding store persists. Transient fields (submitting, errors, hydrated) never are. */
export interface DraftAnswers {
  /** The DOB from the age gate, YYYY-MM-DD. Its presence is what "the age is confirmed" means. */
  ageConfirmedDob: string | null;
  /** Epoch ms of the age gate (or the first step, for an Apple-first account). The 7-day clock. */
  draftStartedAt: number | null;
  lastStep: DraftStep | null;
  /** Set by Discord's Continue: Save may be shown. */
  readyToSave: boolean;
  /** Set just BEFORE an account call from Save or sign-in; see sessionRouting.ts. */
  commitPending: boolean;
  /** The region and languages were guessed from the phone once; never guess again. */
  devicePrefilled: boolean;
  displayName: string;
  displayNameSeeded: boolean;
  profilePhotoUri: string | null;
  region: Region | null;
  languages: LanguageCode[];
  platforms: Platform[];
  games: SelectedGame[];
  shows: SelectedShow[];
  playstyles: PlaystyleTag[];
  prompts: (SelectedPrompt | null)[];
  discordUsername: string;
}

type AnswerFields = Pick<
  DraftAnswers,
  "displayName" | "region" | "languages" | "platforms" | "games" | "prompts" | "discordUsername"
>;

/**
 * The first step whose answer is missing or invalid, in step order, or null when the card can be
 * saved. Mirrors each step's own Continue check, so a draft that reached Save by any route (a
 * relaunch, a stale persisted draft) is checked again before anything is written.
 */
export function firstIncompleteStep(d: AnswerFields): OnboardingStep | null {
  if (!displayNameSchema.safeParse(d.displayName).success) return "display-name";
  if (d.region === null) return "region";
  if (d.languages.length === 0) return "languages";
  if (d.platforms.length === 0) return "platforms";
  if (d.games.length === 0) return "games";
  const answered =
    d.prompts.length === PROMPT_COUNT && d.prompts.every((p) => p !== null && p.answer.trim().length > 0);
  if (!answered) return "prompts";
  if (!discordUsernameSchema.safeParse(d.discordUsername.trim()).success) return "discord";
  return null;
}

export function isDraftComplete(d: AnswerFields): boolean {
  return firstIncompleteStep(d) === null;
}

/**
 * What the commit does first, once the new session's profile read has answered.
 * - "returning": the account already has a finished card (somebody who signed in from Save or
 *   the front door). Their card is kept as it is and the draft is discarded.
 * - "submit": a profile row exists and is unfinished (the email path: `handle_new_user` made it).
 * - "create-profile": no row (a new Apple ID): `complete_signup` with the draft's DOB first.
 * - "read-failed": the read never answered. Never a guess; the screen offers Try again.
 */
export type CommitStart = "returning" | "submit" | "create-profile" | "read-failed";

export function commitStartDecision({
  profileStatus,
  onboardingCompleted,
}: {
  profileStatus: ProfileStatus;
  onboardingCompleted: boolean | undefined;
}): CommitStart {
  if (profileStatus === "missing") return "create-profile";
  if (profileStatus === "loaded") return onboardingCompleted === true ? "returning" : "submit";
  return "read-failed";
}

/**
 * At "app" (`onboarding_completed === true`) any draft left on the phone can only be stale: a
 * returning player who signed in from the front door or Save, or a kill between submit and the
 * discard. The toast says why their card did not change, and only when they had asked for a save.
 */
export function draftCleanupOnApp({ hasDraft, commitPending }: { hasDraft: boolean; commitPending: boolean }): {
  discard: boolean;
  toast: boolean;
} {
  return { discard: hasDraft, toast: hasDraft && commitPending };
}

export function commitDestination({ arrival }: { arrival: object | null }): "/invited" | "/welcome" {
  return arrival ? "/invited" : "/welcome";
}

/** "Welcome, Cameron." from "Cameron Stallings". */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

/**
 * Whole years on `now`, read in UTC, the same way `checkDob` and Postgres do: packed YYYYMMDD
 * dates differ by 10000 a year, so the floor of the difference is the age, Feb 29 included.
 */
export function ageOn(dobIso: string | null, now: Date): number | null {
  if (!dobIso || checkDob(dobIso, 0, now) === "invalid") return null;
  const birth = new Date(`${dobIso}T00:00:00.000Z`);
  const born = birth.getUTCFullYear() * 10000 + (birth.getUTCMonth() + 1) * 100 + birth.getUTCDate();
  const today = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  return Math.floor((today - born) / 10000);
}

export interface CardPreview {
  name: string;
  /** "26 · NA East · en". AGES STAY: the age is on every card, this one included. */
  details: string;
  /** Up to 3, "League of Legends · Gold II". */
  games: string[];
}

export function cardPreviewLines(d: DraftAnswers, now: Date): CardPreview {
  const age = ageOn(d.ageConfirmedDob, now);
  let details: string;
  if (d.region !== null && age !== null) {
    details = cardDetailsLine({ age, region: d.region, languages: d.languages }, REGION_LABELS);
  } else {
    const parts: string[] = [];
    if (age !== null) parts.push(String(age));
    if (d.region !== null) parts.push(REGION_LABELS[d.region]);
    if (d.languages.length > 0) parts.push(d.languages.join(" "));
    details = parts.join(" · ");
  }
  const games = d.games.slice(0, 3).map((g) => {
    const rank = g.rankText.trim();
    return rank ? `${g.name} · ${rank}` : g.name;
  });
  return { name: d.displayName.trim(), details, games };
}

/** How long a draft lives on the phone (Q4): a shared phone does not keep someone's answers for a month. */
export const DRAFT_TTL_DAYS = 7;
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function enumList<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is T => typeof v === "string" && (allowed as readonly string[]).includes(v));
}

function sanitizeGame(value: unknown): SelectedGame | null {
  if (!isRecord(value)) return null;
  const { gameId, name, skillLevel, rankText, lolTier, lolDivision } = value;
  if (typeof gameId !== "string" || typeof name !== "string") return null;
  if (typeof skillLevel !== "string" || !(SKILL_LEVELS as readonly string[]).includes(skillLevel)) return null;
  if (typeof rankText !== "string") return null;
  const tier =
    lolTier === null || lolTier === undefined
      ? null
      : typeof lolTier === "string" && (LOL_TIER_CHOICES as readonly string[]).includes(lolTier)
        ? (lolTier as LolTierChoice)
        : undefined;
  const division =
    lolDivision === null || lolDivision === undefined
      ? null
      : lolDivision === 1 || lolDivision === 2 || lolDivision === 3 || lolDivision === 4
        ? (lolDivision as LolDivision)
        : undefined;
  if (tier === undefined || division === undefined) return null;
  return { gameId, name, skillLevel: skillLevel as SkillLevel, rankText, lolTier: tier, lolDivision: division };
}

function sanitizePrompt(value: unknown): SelectedPrompt | null {
  if (!isRecord(value)) return null;
  const { promptId, question, answer } = value;
  if (typeof promptId !== "string" || typeof question !== "string" || typeof answer !== "string") return null;
  return { promptId, question, answer };
}

/**
 * What a persisted draft is allowed to put back into the store. Anything wrong is DROPPED, field
 * by field, so the store's own default stands in for it; nothing here can throw.
 *
 * Whole-draft wipes: not an object; no start time to measure; started more than 7 days ago.
 * Field drops: a last step that no longer exists (shows), a region not in REGIONS, a prompts
 * array of the wrong length, a DOB that is malformed or under 18 today, non-string or unknown
 * list entries, malformed games, shows and prompts, and any field of the wrong type.
 */
export function sanitizeDraft(persisted: unknown, nowMs: number): Partial<DraftAnswers> {
  if (!isRecord(persisted)) return {};
  const startedAt = persisted.draftStartedAt;
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return {};
  if (nowMs - startedAt > DRAFT_TTL_MS) return {};

  const out: Partial<DraftAnswers> = { draftStartedAt: startedAt };
  const p = persisted;

  if (typeof p.ageConfirmedDob === "string" && checkDob(p.ageConfirmedDob, MIN_AGE, new Date(nowMs)) === null) {
    out.ageConfirmedDob = p.ageConfirmedDob;
  }
  if (isDraftStep(p.lastStep)) out.lastStep = p.lastStep;
  for (const key of ["readyToSave", "commitPending", "devicePrefilled", "displayNameSeeded"] as const) {
    const value = p[key];
    if (typeof value === "boolean") out[key] = value;
  }
  if (typeof p.displayName === "string") out.displayName = p.displayName;
  if (typeof p.discordUsername === "string") out.discordUsername = p.discordUsername;
  if (p.profilePhotoUri === null || typeof p.profilePhotoUri === "string") out.profilePhotoUri = p.profilePhotoUri;
  if (typeof p.region === "string" && (REGIONS as readonly string[]).includes(p.region)) {
    out.region = p.region as Region;
  }

  const languages = enumList(p.languages, LANGUAGE_CODES);
  if (languages) out.languages = languages;
  const platforms = enumList(p.platforms, PLATFORMS);
  if (platforms) out.platforms = platforms;
  const playstyles = enumList(p.playstyles, PLAYSTYLE_TAGS);
  if (playstyles) out.playstyles = playstyles;

  if (Array.isArray(p.games)) {
    out.games = p.games.map(sanitizeGame).filter((g): g is SelectedGame => g !== null);
  }
  if (Array.isArray(p.shows)) {
    out.shows = p.shows.flatMap((s) =>
      isRecord(s) && typeof s.showId === "string" && typeof s.name === "string" ? [{ showId: s.showId, name: s.name }] : [],
    );
  }
  if (Array.isArray(p.prompts) && p.prompts.length === PROMPT_COUNT) {
    out.prompts = p.prompts.map(sanitizePrompt);
  }

  return out;
}

/**
 * Whether a screen may put the draft's DOB back on the wheel. Only for a draft started in THIS
 * launch: a resumed draft from an earlier launch (a shared phone, a lent phone) never shows the
 * date of birth it holds.
 */
export function canShowDraftDob({
  draftStartedAt,
  launchStartedAt,
}: {
  draftStartedAt: number | null;
  launchStartedAt: number;
}): boolean {
  return draftStartedAt !== null && draftStartedAt >= launchStartedAt;
}
