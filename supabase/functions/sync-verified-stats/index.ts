// Pulls verified rank/playtime from the Steam and Riot APIs for every profile with a
// matching linked account (0025_linked_accounts.sql), and upserts them into
// verified_stats (0039_verified_stats.sql) — the table the client reads (via
// public_verified_stats) to show "✓ Gold II" instead of a self-typed rank_text.
//
// Scheduled the same way as daily-swipes-refreshed / send-reengagement-nudges: invoke
// via a Supabase Cron Trigger or any external scheduler, POSTing with
// `Authorization: Bearer <INTERNAL_TRIGGER_AUTH_TOKEN>`.
//
// Dormant by design: STEAM_WEB_API_KEY and RIOT_API_KEY are each optional. Whichever is
// unset gets skipped — one log line, no error, no partial/fake data written — so this
// function is safe to deploy and even schedule before Cameron has obtained either key.
// The INTERNAL_TRIGGER_AUTH_TOKEN check is a *different* kind of "missing config":
// that one fails closed (requireSecret throws at module load) because it's the only
// thing standing between this endpoint and the public internet, not a per-provider
// feature toggle.
//
//   STEAM_WEB_API_KEY — free, instant self-serve key: https://steamcommunity.com/dev/apikey
//   RIOT_API_KEY      — https://developer.riotgames.com — a personal dev key works for
//                        testing but expires every 24h; a production key needs Riot's
//                        manual app-approval process.
//   RIOT_PLATFORM     — optional, defaults to "na1". league-v4 is platform-routed
//                        (na1/euw1/kr/...), not the coarser region enum profiles.region
//                        already uses, and this repo has no per-profile LoL platform
//                        today — single-platform is a deliberate scope cut, not an
//                        oversight. Revisit if the player base isn't NA-dominant.
import { createClient } from "npm:@supabase/supabase-js@2";

import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

// Read directly, NOT via requireSecret: absence here means "skip this provider," not
// "refuse to run."
const STEAM_WEB_API_KEY = Deno.env.get("STEAM_WEB_API_KEY");
const RIOT_API_KEY = Deno.env.get("RIOT_API_KEY");
const RIOT_PLATFORM = Deno.env.get("RIOT_PLATFORM") ?? "na1";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function titleCase(word: string): string {
  return word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();
}

// Riot PUUIDs are a fixed, URL-safe character class at a stable length (78 chars as of
// this writing; a small buffer either side tolerates a future Riot-side length change
// without loosening the charset, which is the part that actually matters here — this
// value is interpolated straight into a request URL, so nothing outside
// alphanumeric/-/_ may ever reach it). Mirrors link-steam-callback's CLAIMED_ID_PATTERN
// approach of validating an external identifier before it's used, rather than trusting
// its source (linked_accounts.external_id has no format CHECK constraint at the DB
// layer — see 0025_linked_accounts.sql).
const PUUID_PATTERN = /^[A-Za-z0-9_-]{60,100}$/;

/** At most one retry, and only for network-level failures / non-2xx — a single flaky
 * profile's lookup should never take down the whole run, and this stays polite to
 * both providers' rate limits rather than hammering a failing endpoint. */
async function fetchWithOneRetry(url: string, init?: RequestInit): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      // 429s are the one response worth a short pause before the single retry.
      if (res.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      if (attempt === 1) return res; // give the caller the failing response to log
    } catch (err) {
      if (attempt === 1) {
        console.error("fetch failed after retry", { url: url.split("?")[0], err: String(err) });
        return null;
      }
    }
  }
  return null;
}

interface SyncSummary {
  linked: number;
  updated: number;
  skipped: number;
}

async function syncSteam(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncSummary> {
  const summary: SyncSummary = { linked: 0, updated: 0, skipped: 0 };

  const [{ data: accounts, error: accountsError }, { data: games, error: gamesError }] = await Promise.all([
    supabase.from("linked_accounts").select("profile_id, external_id").eq("provider", "steam"),
    supabase.from("games").select("id, steam_app_id").not("steam_app_id", "is", null),
  ]);
  if (accountsError) throw accountsError;
  if (gamesError) throw gamesError;

  const gameIdByAppId = new Map<number, string>();
  for (const g of games ?? []) {
    gameIdByAppId.set(Number(g.steam_app_id as number), g.id as string);
  }

  summary.linked = accounts?.length ?? 0;
  if (summary.linked === 0 || gameIdByAppId.size === 0) return summary;

  // Sequential, not Promise.all — small and polite rather than fanning out a burst of
  // concurrent requests at Steam's API for what's still an early-stage user base.
  for (const account of accounts ?? []) {
    const steamId64 = account.external_id as string;
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_WEB_API_KEY}&steamid=${steamId64}&format=json&include_played_free_games=true`;
    const res = await fetchWithOneRetry(url);
    if (!res || !res.ok) {
      summary.skipped++;
      continue;
    }

    const body = (await res.json().catch(() => null)) as {
      response?: { games?: { appid: number; playtime_forever: number }[] };
    } | null;
    const ownedGames = body?.response?.games ?? [];

    const rows = ownedGames
      .filter((g) => gameIdByAppId.has(g.appid))
      .map((g) => ({
        profile_id: account.profile_id as string,
        provider: "steam" as const,
        game_id: gameIdByAppId.get(g.appid)!,
        stat_kind: "playtime_hours" as const,
        // One decimal place: an early-access account with 40 minutes on a game should
        // read "0.7h", not round down to a flat, unconvincing "0h".
        stat_value: (g.playtime_forever / 60).toFixed(1),
        fetched_at: new Date().toISOString(),
      }));

    if (rows.length === 0) continue;

    const { error: upsertError } = await supabase
      .from("verified_stats")
      .upsert(rows, { onConflict: "profile_id,provider,game_id,stat_kind" });
    if (upsertError) {
      console.error("verified_stats upsert failed (steam)", { profileId: account.profile_id, code: upsertError.code });
      summary.skipped++;
      continue;
    }
    summary.updated += rows.length;
  }

  return summary;
}

async function syncRiot(
  supabase: ReturnType<typeof createClient>,
): Promise<SyncSummary> {
  const summary: SyncSummary = { linked: 0, updated: 0, skipped: 0 };

  const [{ data: accounts, error: accountsError }, { data: leagueGames, error: gamesError }] = await Promise.all([
    supabase.from("linked_accounts").select("profile_id, external_id").eq("provider", "riot"),
    supabase.from("games").select("id, riot_queue").not("riot_queue", "is", null),
  ]);
  if (accountsError) throw accountsError;
  if (gamesError) throw gamesError;

  // Today this is just League of Legends (RANKED_SOLO_5x5), but keyed off riot_queue
  // rather than hardcoded so a future Riot title only needs a games-row update.
  const leagueGame = (leagueGames ?? [])[0] as { id: string; riot_queue: string } | undefined;

  summary.linked = accounts?.length ?? 0;
  if (summary.linked === 0 || !leagueGame) return summary;

  for (const account of accounts ?? []) {
    const puuid = account.external_id as string;
    if (!PUUID_PATTERN.test(puuid)) {
      console.error("skipping riot account with malformed external_id", { profileId: account.profile_id });
      summary.skipped++;
      continue;
    }
    const url = `https://${RIOT_PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
    const res = await fetchWithOneRetry(url, { headers: { "X-Riot-Token": RIOT_API_KEY! } });
    if (!res || !res.ok) {
      summary.skipped++;
      continue;
    }

    const entries = (await res.json().catch(() => null)) as
      | { queueType: string; tier: string; rank: string; leaguePoints: number }[]
      | null;
    const entry = entries?.find((e) => e.queueType === leagueGame.riot_queue);
    if (!entry) continue; // linked but unranked in this queue — nothing to show yet

    const apex = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);
    const rankLabel = apex.has(entry.tier)
      ? `${titleCase(entry.tier)} (${entry.leaguePoints} LP)`
      : `${titleCase(entry.tier)} ${entry.rank}`;

    const { error: upsertError } = await supabase.from("verified_stats").upsert(
      {
        profile_id: account.profile_id as string,
        provider: "riot",
        game_id: leagueGame.id,
        stat_kind: "rank",
        stat_value: rankLabel,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,provider,game_id,stat_kind" },
    );
    if (upsertError) {
      console.error("verified_stats upsert failed (riot)", { profileId: account.profile_id, code: upsertError.code });
      summary.skipped++;
      continue;
    }
    summary.updated++;
  }

  return summary;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let steam: SyncSummary | "skipped" = "skipped";
  if (STEAM_WEB_API_KEY) {
    steam = await syncSteam(supabase);
  } else {
    console.log("STEAM_WEB_API_KEY not set — skipping Steam verified-stats sync");
  }

  let riot: SyncSummary | "skipped" = "skipped";
  if (RIOT_API_KEY) {
    riot = await syncRiot(supabase);
  } else {
    console.log("RIOT_API_KEY not set — skipping Riot verified-stats sync");
  }

  return jsonResponse({ steam, riot }, 200);
});
