import type { DeckCandidate, Platform, SkillLevel } from "@duoqueue/shared-types";

export interface DeckCardGame {
  name: string;
  skillLevel: SkillLevel;
}

export interface DeckCard extends DeckCandidate {
  photoUrls: string[];
  topGames: DeckCardGame[];
  topShows: string[];
  languages: string[];
  platforms: Platform[];
  playstyles: string[];
}

export type SwipeDirection = "like" | "pass";
