import type { LanguageCode } from "@duoqueue/shared-types";

// Not Intl.DisplayNames: Hermes doesn't implement it on every platform/SDK combo, and it's
// crashed here before (SDK 54's Hermes build has no Intl.DisplayNames constructor at all).
export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
  pl: "Polish",
  nl: "Dutch",
  sv: "Swedish",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
  tl: "Tagalog",
};
