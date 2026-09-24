import type { DeckCandidate, Platform, SkillLevel, TiltHandling } from "@duoqueue/shared-types";

export interface DeckCardGame {
  name: string;
  skillLevel: SkillLevel;
  /** This is the League of Legends catalog row (found by its Riot queue marker, see
   * features/league/leagueGame.ts). */
  isLeague: boolean;
}

export interface DeckCardPrompt {
  question: string;
  answer: string;
}

export interface DeckCardVibe {
  intensity: number;
  commsStyle: number;
  coachingPref: number;
  tiltHandling: TiltHandling;
}

export interface DeckCard extends DeckCandidate {
  /** The approved square picture. Every small avatar reads this. */
  profilePhotoUrl: string | null;
  /** An approved old cover (build 11 and earlier). Only a fallback: cards and pagers read
   * cardPicture(card), which is profilePhotoUrl ?? headerPhotoUrl. Build 12 shows no gallery. */
  headerPhotoUrl: string | null;
  topGames: DeckCardGame[];
  topShows: string[];
  languages: string[];
  platforms: Platform[];
  playstyles: string[];
  prompts: DeckCardPrompt[];
  isRecentlyActive: boolean;
  vibe: DeckCardVibe | null;
  playWindowLabel: string | null;
  /** Their League of Legends Solo/Duo rank, only when it is one of the canonical labels the
   * server writes ("Gold II"). Free text is never shown to strangers. */
  lolRank: string | null;
}

export type SwipeDirection = "like" | "pass";
