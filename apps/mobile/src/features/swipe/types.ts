import type { DeckCandidate, Platform, SkillLevel, TiltHandling } from "@duoqueue/shared-types";

export interface DeckCardGame {
  name: string;
  skillLevel: SkillLevel;
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
  topGames: DeckCardGame[];
  topShows: string[];
  languages: string[];
  platforms: Platform[];
  playstyles: string[];
  prompts: DeckCardPrompt[];
  isRecentlyActive: boolean;
  vibe: DeckCardVibe | null;
  playWindowLabel: string | null;
}

export type SwipeDirection = "like" | "pass";
