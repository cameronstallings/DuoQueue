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
  profilePhotoUrl: string | null;
  headerPhotoUrl: string | null;
  /** Approved gallery photos, ordered by position. The deck card and profile detail
   * pagers page over [headerPhotoUrl, ...galleryUrls] (header first, falling back to
   * plain single-photo display when this is empty). */
  galleryUrls: string[];
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
