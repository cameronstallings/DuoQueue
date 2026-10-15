import { describe, expect, it } from "vitest";

import { inviteUrl, parseInviteCode } from "../../lib/invite";

import { LFG_TAG_ALLOWLIST, lfgPost, lfgRankParts, lfgTags } from "./lfgPost";

const CODE = "K7Q2M9XA4P";
const URL = inviteUrl(CODE, "https://<project>.supabase.co");

/** The tested fixture: the plan's Copy section, exactly. */
const LEAGUE_POST = [
  "LF duo: League of Legends, NA East.",
  "Gold II. Can duo Silver to Platinum (by rank).",
  "Chill, mic required.",
  "On until 10:40 PM CDT.",
  "",
  "Answer on DuoQueue (18+, for teammates, not dates): https://<project>.supabase.co/functions/v1/invite/K7Q2M9XA4P",
  "Code: K7Q2M9XA4P",
].join("\n");

function league() {
  const rank = lfgRankParts({ rankText: "Gold II", lolTier: "gold", lolDivision: 2 });
  return {
    gameName: "League of Legends",
    regionLabel: "NA East",
    rankLabel: rank.rankLabel,
    duoRange: rank.duoRange,
    tags: lfgTags(["chill", "mic_required"]),
    untilLabel: "10:40 PM CDT",
    url: URL,
    code: CODE,
  };
}

describe("lfgPost", () => {
  it("writes the League post exactly", () => {
    expect(lfgPost(league())).toBe(LEAGUE_POST);
  });

  it("writes another game's rank text as it is", () => {
    const post = lfgPost({
      ...league(),
      gameName: "Valorant",
      ...lfgRankParts({ rankText: "  Diamond 2 ", lolTier: null, lolDivision: null }),
    });
    expect(post.split("\n").slice(0, 2)).toEqual(["LF duo: Valorant, NA East.", "Diamond 2."]);
  });

  it("leaves the rank line out when there is no rank", () => {
    const post = lfgPost({ ...league(), rankLabel: null, duoRange: null });
    expect(post.split("\n")[1]).toBe("Chill, mic required.");
  });

  it("leaves the tags line out when there are no tags", () => {
    const post = lfgPost({ ...league(), tags: null });
    expect(post.split("\n")[2]).toBe("On until 10:40 PM CDT.");
  });

  it("names a region outside NA as it is", () => {
    expect(lfgPost({ ...league(), regionLabel: "Europe" }).split("\n")[0]).toBe("LF duo: League of Legends, Europe.");
    expect(lfgPost({ ...league(), regionLabel: null }).split("\n")[0]).toBe("LF duo: League of Legends.");
  });

  it("leaves the time out when it could not be formatted", () => {
    expect(lfgPost({ ...league(), untilLabel: null })).not.toContain("On until");
  });

  it("puts the code last, where a reader and the app's code reader both find it", () => {
    const post = lfgPost(league());
    const lines = post.split("\n");
    expect(lines[lines.length - 1]).toBe(`Code: ${CODE}`);
    expect(parseInviteCode(post)).toBe(CODE);
  });

  it("says 18+ and not dates, and nothing that reads as dating", () => {
    const post = lfgPost(league());
    expect(post).toContain("18+");
    expect(post).toContain("not dates");
    expect(post.replace(/not dates/g, "")).not.toMatch(
      /\bdates?\b|dating|singles|hookup|nearby|meet people|match with singles/i,
    );
  });

  it("uses no dashes", () => {
    expect(lfgPost(league())).not.toMatch(/[–—]/);
  });
});

describe("lfgRankParts", () => {
  it("reads League from the structured rank, with Riot's range", () => {
    expect(lfgRankParts({ rankText: "Gold II", lolTier: "gold", lolDivision: 2 })).toEqual({
      rankLabel: "Gold II",
      duoRange: "Silver to Platinum",
    });
    expect(lfgRankParts({ rankText: "Master", lolTier: "master", lolDivision: null })).toEqual({
      rankLabel: "Master",
      duoRange: null,
    });
  });

  it("claims no range for an unplaced League player", () => {
    expect(lfgRankParts({ rankText: "Unranked", lolTier: "unranked", lolDivision: null })).toEqual({
      rankLabel: "Unranked",
      duoRange: null,
    });
  });

  it("drops empty or over-long rank text", () => {
    expect(lfgRankParts({ rankText: "   ", lolTier: null, lolDivision: null })).toEqual({
      rankLabel: null,
      duoRange: null,
    });
    expect(lfgRankParts({ rankText: "x".repeat(25), lolTier: null, lolDivision: null }).rankLabel).toBeNull();
    expect(lfgRankParts({ rankText: "x".repeat(24), lolTier: null, lolDivision: null }).rankLabel).toBe("x".repeat(24));
    expect(lfgRankParts({ rankText: null, lolTier: null, lolDivision: null }).rankLabel).toBeNull();
  });
});

describe("lfgTags", () => {
  it("keeps only the allowed tags, at most two, in profile order", () => {
    expect(lfgTags(["late_night", "team_player", "grinder", "no_mic", "chill"])).toBe("Team player, no mic.");
    expect(lfgTags(["competitive"])).toBe("Competitive.");
  });

  it("is null with no allowed tag", () => {
    expect(lfgTags([])).toBeNull();
    expect(lfgTags(["late_night", "grinder"])).toBeNull();
  });

  it("allows exactly the five tags that help a stranger decide", () => {
    expect([...LFG_TAG_ALLOWLIST]).toEqual(["chill", "competitive", "mic_required", "no_mic", "team_player"]);
  });
});
