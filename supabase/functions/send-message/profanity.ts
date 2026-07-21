/**
 * Basic word-list profanity/abuse filter. This intentionally stays simple — real
 * moderation systems should layer in a maintained service (e.g. an LLM moderation
 * endpoint or a dedicated provider) to catch obfuscation (leetspeak, spacing tricks)
 * and context-dependent abuse this word-list approach can't. This is the "before
 * delivery" gate the product spec calls for at MVP scope: mask matches, flag the
 * message for the admin moderation queue, still let it through (false positives on a
 * word list are common enough that outright blocking would be too heavy-handed).
 */

const BLOCKLIST = [
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "piss",
  "slut",
  "whore",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "spic",
  "chink",
  "tranny",
  "kys",
  "kill yourself",
];

const WORD_REGEX = new RegExp(
  `\\b(${BLOCKLIST.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

export function filterProfanity(input: string): { content: string; isFlagged: boolean } {
  let isFlagged = false;
  const content = input.replace(WORD_REGEX, (match) => {
    isFlagged = true;
    return "*".repeat(match.length);
  });
  return { content, isFlagged };
}
