import type { DeckCandidate, Platform, SkillLevel } from "@duoqueue/shared-types";

export interface DeckCardGame {
  name: string;
  skillLevel: SkillLevel;
}

export interface DeckCardPrompt {
  question: string;
  answer: string;
}

export interface DeckCard extends DeckCandidate {
  photoUrls: string[];
  topGames: DeckCardGame[];
  topShows: string[];
  languages: string[];
  platforms: Platform[];
  playstyles: string[];
  prompts: DeckCardPrompt[];
}

export type SwipeDirection = "like" | "pass";
