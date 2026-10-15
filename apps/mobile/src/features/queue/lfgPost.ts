import {
  formatLolRank,
  lolDuoRangeLabel,
  type LolDivision,
  type LolTierChoice,
  type PlaystyleTag,
} from "@duoqueue/shared-types";

import { PLAYSTYLE_LABELS } from "../onboarding/profile-labels";

/**
 * The Duo Call post: the text a queued player shares anywhere (a Discord server, a group chat, a
 * subreddit) to find someone right now, with their call code on the last line. Pure and tested
 * (lfgPost.test.ts); the sheet only formats the time and hands it the sharer's own facts.
 *
 * WHAT IT CARRIES, AND WHAT IT NEVER DOES. Only the sharer's own data: their game, region, rank,
 * at most two playstyle tags and when they are on until. The input type has no age and no other
 * player's anything, so a post can never put someone else in a stranger's group chat, and AGES
 * STAY in the app (where the 18+ check stands behind them), not in a post that leaves it.
 *
 * THE RULES, because the post is the most public string the app produces:
 *  - "18+" and "not dates" are stated outright (2.3.6 rejected this app once), as the invite
 *    share message does.
 *  - The code is the LAST line, on its own. It is the part that has to survive a paste, a retype
 *    or being read out over voice, and the only part that still works after a trip through the
 *    App Store (iOS has no install referrer; see src/lib/invite.ts). parseInviteCode finds it
 *    from the link line too.
 *  - Riot's duo range only as Riot's own row ("Can duo Silver to Platinum (by rank)"), never a
 *    number of our own (lol-rank.ts has why).
 *  - No dashes.
 */

/** The tags that help a stranger decide in a line. The rest ("late night", "grinder") say more
 * about a profile than about this game tonight. */
export const LFG_TAG_ALLOWLIST = ["chill", "competitive", "mic_required", "no_mic", "team_player"] as const;

/** A rank text longer than this is somebody's sentence, not a rank, and stays off the post. */
const MAX_RANK_TEXT = 24;

/** The first two allowed tags, in the order the profile lists them: "Chill, mic required." */
export function lfgTags(tags: readonly PlaystyleTag[]): string | null {
  const allowed = tags.filter((t) => (LFG_TAG_ALLOWLIST as readonly string[]).includes(t)).slice(0, 2);
  if (allowed.length === 0) return null;
  const labels = allowed.map((t, i) => {
    const label = PLAYSTYLE_LABELS[t];
    return i === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1);
  });
  return `${labels.join(", ")}.`;
}

export interface LfgRankParts {
  rankLabel: string | null;
  /** Riot's row, League only ("Silver to Platinum"). */
  duoRange: string | null;
}

/**
 * The rank line's two parts. League reads the structured rank (formatLolRank, the label the
 * server writes) and Riot's range; every other game uses its rank text as typed, trimmed, and
 * drops it when empty or longer than a rank could be.
 */
export function lfgRankParts(input: {
  rankText: string | null | undefined;
  lolTier: LolTierChoice | null;
  lolDivision: LolDivision | null;
}): LfgRankParts {
  if (input.lolTier !== null) {
    const rank = { tier: input.lolTier, division: input.lolDivision };
    return { rankLabel: formatLolRank(rank), duoRange: lolDuoRangeLabel(rank) };
  }
  const text = (input.rankText ?? "").trim();
  if (text === "" || text.length > MAX_RANK_TEXT) return { rankLabel: null, duoRange: null };
  return { rankLabel: text, duoRange: null };
}

export interface LfgPostInput {
  gameName: string;
  /** REGION_LABELS[profile.region] ("NA East"), or null. */
  regionLabel: string | null;
  rankLabel: string | null;
  duoRange: string | null;
  /** lfgTags(...), or null. */
  tags: string | null;
  /** When they are on until, with the time zone ("10:40 PM CDT"), or null when it could not be
   * formatted. */
  untilLabel: string | null;
  /** inviteUrl(call_code, ...). */
  url: string;
  code: string;
}

/** The Duo Call post's promise about its code: the first player in takes it. */
const FIRST_ONE_IN = "First one in is my duo.";

export function lfgPost(input: LfgPostInput): string {
  const lines: string[] = [];
  lines.push(input.regionLabel ? `LF duo: ${input.gameName}, ${input.regionLabel}.` : `LF duo: ${input.gameName}.`);
  if (input.rankLabel) {
    lines.push(
      input.duoRange ? `${input.rankLabel}. Can duo ${input.duoRange} (by rank).` : `${input.rankLabel}.`,
    );
  }
  if (input.tags) lines.push(input.tags);
  // ONE DUO PER QUEUE UP (0088): the code dies at the first duo, by a Duo Pop or by this post, so
  // the post says so. A stranger reading "On until 11:40" alone would expect it to work all hour.
  lines.push(input.untilLabel ? `On until ${input.untilLabel}. ${FIRST_ONE_IN}` : FIRST_ONE_IN);
  lines.push("");
  lines.push(`Answer on DuoQueue (18+, for teammates, not dates): ${input.url}`);
  lines.push(`Code: ${input.code}`);
  return lines.join("\n");
}
