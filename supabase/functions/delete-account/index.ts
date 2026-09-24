// Permanently deletes the caller's account and all personal data (App Store/Play Store
// account-deletion requirement). Storage objects aren't linked via a Postgres FK, so
// they're removed explicitly; everything else cascades automatically once the
// auth.users row is deleted, thanks to `on delete cascade` on every profile-linked table
// (profiles -> profile_media/games/shows/platforms/languages/playstyles/preferences/
// push_tokens/notification_settings/subscriptions, and swipes/matches/reports/blocks,
// which themselves cascade further into messages/discord_shares — see 0001_init.sql).
//
// Exception, per docs/legal/trust-and-safety.md section 4(b): media that never reached
// 'approved' — 'rejected' outright, or 'pending' (which covers both a provider outage
// and the minor-review band 0.35-0.69, see moderate-photo/provider.ts) — must survive
// account deletion so a moderator/legal hold can still reach it. Before anything is
// deleted, every such row for this user is read and copied into
// preserved_moderation_evidence (0046_preserve_safety_evidence.sql), a table with no FK
// to profiles, so the pointer survives even though the profile_media /
// profile_voice_intro row itself still cascades away with the profile. Their storage
// objects are then skipped in the removal loop below instead of deleted — and so is
// anything ALREADY preserved there from an earlier row delete/replace (0050's DELETE
// triggers, 0054's UPDATE triggers), since those objects are now orphaned (no current
// profile_media/profile_voice_intro row points at them) and would otherwise look
// unclaimed to this function and get deleted anyway.
//
// Two refusals happen before any of that, per 0054_preservation_completeness.sql:
//   - A currently-banned profile cannot self-delete at all. Durable bans
//     (banned_identities) already survive account deletion on their own, but refusing
//     outright here means a ban can never be raced by self-deleting the instant it
//     lands, and is simply more honest than letting the delete "succeed" while a
//     shadow ban record lives on.
//   - A profile with an open `underage` report against it (reports.reported_profile_id
//     = this user, reason = 'underage', status <> 'dismissed') is not deleted — it is
//     frozen in place instead (freeze_account_for_legal_hold), so the match(es) and
//     message(s) trust-and-safety.md section 4(b) requires be kept aren't cascaded away
//     with the profile. See that function's header comment for exactly what is retained
//     vs. anonymized.
//
// One thing happens that is not a deletion at all, and it happens LAST, immediately before
// the auth.users row goes: the user's Sign in with Apple grant is revoked. Apple requires any
// app offering Sign in with Apple to call its token revocation endpoint when an account is
// deleted (enforced at review since 30 June 2022, and checked on this exact flow), and
// auth.admin.deleteUser does not do it -- without the call the grant stays live in iOS
// Settings > Apple ID > Sign in with Apple, pointing at an account that no longer exists.
// The refresh token it spends was obtained at SIGN-IN by the apple-authorization function,
// because the authorization code it came from dies five minutes after the Apple sheet closes;
// see supabase/functions/_shared/apple-auth.ts. That sign-in call is fire and forget, so for
// an Apple account the client also asks Apple for a fresh code just before calling this and
// sends it as `appleAuthorizationCode`; when there is no stored token, or the stored one will
// not revoke, that code is exchanged here and its token revoked instead. A user who never
// signed in with Apple sends no code and has no token, and in every case the revocation is
// best effort: it is logged and the deletion proceeds. A deletion that stops halfway because
// Apple was unreachable would strand the one user who explicitly asked to leave, which is a
// worse failure than a grant that outlives the account by a log line.
//
// A PROFILE-LESS ACCOUNT, the Apple signup that stopped at the post-auth age gate (0067), goes
// through this same path unchanged: the profile read below is `.maybeSingle()`, so no row is
// "not banned", and every media query is simply empty. Only auth.users and, through its
// cascade, apple_refresh_tokens (0068) have anything to remove.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

import { appleAuthConfigFromEnv, exchangeAuthorizationCode, revokeRefreshToken } from "../_shared/apple-auth.ts";
import { isCallersAppleSubject } from "../_shared/apple-id-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Same cap apple-authorization applies. Apple's codes are short. */
const MAX_CODE_LENGTH = 2048;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * The fresh Apple authorization code the client may send, or null.
 *
 * FORGIVING ON PURPOSE. Every client before this one sent `{}`, a body that fails to parse is
 * still a user asking to delete their account, and the code is only ever a backstop for the
 * token stored at sign-in. So nothing about the body can refuse a deletion: anything that is
 * not a plausible code is treated as no code.
 */
async function readAppleAuthorizationCode(req: Request): Promise<string | null> {
  try {
    const body = (await req.json()) as { appleAuthorizationCode?: unknown } | null;
    const code = body?.appleAuthorizationCode;
    if (typeof code !== "string" || code.length === 0 || code.length > MAX_CODE_LENGTH) return null;
    return code;
  } catch {
    return null;
  }
}

/**
 * Revokes this user's Sign in with Apple grant, if there is one to revoke.
 *
 * EVERY BRANCH IS A LOG LINE AND A RETURN, and the whole body sits inside a try/catch that
 * does the same, because this runs AFTER the storage objects are already gone: a throw here
 * used to become a 500 that skipped deleteUser, leaving an account whose photos had been
 * removed from under it. Now nothing in here can stop the deletion the user has confirmed.
 *
 * Several of the ways this does nothing are completely ordinary: the account signed up with an
 * email and a password and has no Apple grant; the account signed in with Apple on a build
 * before apple-authorization existed and the client sent no fresh code; the deployment has no
 * .p8 configured yet. Apple answering with an error, or not answering, is the one worth an
 * alert.
 *
 * THE ORDER OF THE TWO SOURCES. The token stored at sign-in is tried first, since it needs no
 * extra round trip. The fresh code is exchanged only when that token is missing or its
 * revocation failed, and its token is spent only if the code turns out to belong to one of
 * this user's own Apple identities: `signInAsync` answers for whatever Apple ID the phone is
 * signed in to, which is not necessarily the one this account was made with, and revoking some
 * other account's grant is not what the user asked for.
 *
 * The read is done with the service role because apple_refresh_tokens has RLS on, no policies
 * and no grants: nobody else can see it, including the user it belongs to.
 */
async function revokeAppleGrant(
  // SupabaseClient, as _shared/rate-limit.ts has it, rather than ReturnType<typeof createClient>:
  // that resolves createClient's generics to their defaults (schema `never`), and under
  // supabase-js 2.117, which `npm:@supabase/supabase-js@2` resolves to today, the client
  // createClient returns is not assignable to it. `deno check` refused the call below.
  serviceClient: SupabaseClient,
  user: User,
  freshAuthorizationCode: string | null,
): Promise<void> {
  try {
    const { data: row, error } = await serviceClient
      .from("apple_refresh_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      // Not a return: the fresh code below does not need this table at all, and this is
      // exactly the failure it exists to cover.
      console.error("failed to read apple refresh token during account deletion", { message: error.message });
    }

    const storedToken = (row as { refresh_token?: unknown } | null)?.refresh_token;
    const hasStoredToken = typeof storedToken === "string" && storedToken.length > 0;
    if (!hasStoredToken && !freshAuthorizationCode) return; // No Apple grant we can reach. Nothing to revoke.

    const config = appleAuthConfigFromEnv();
    if (!config) {
      console.error("apple grant present but revocation secrets are not configured; grant will outlive the account", {
        userId: user.id,
      });
      return;
    }

    if (hasStoredToken) {
      const result = await revokeRefreshToken(config, storedToken);
      if (result.ok) return;
      console.error("stored apple token would not revoke", { detail: result.detail, willTryFreshCode: !!freshAuthorizationCode });
    }

    if (!freshAuthorizationCode) {
      console.error("apple token revocation failed; deleting the account anyway", { userId: user.id });
      return;
    }

    const exchange = await exchangeAuthorizationCode(config, freshAuthorizationCode);
    if (!exchange.ok) {
      console.error("fresh apple code exchange failed; deleting the account anyway", { detail: exchange.detail });
      return;
    }
    if (!isCallersAppleSubject(exchange.subject, user.identities)) {
      console.error("fresh apple code belongs to a different Apple ID; not revoking it, deleting the account anyway", {
        userId: user.id,
        hasSubject: exchange.subject !== null,
      });
      return;
    }

    const result = await revokeRefreshToken(config, exchange.refreshToken);
    if (!result.ok) {
      console.error("apple token revocation failed; deleting the account anyway", { detail: result.detail });
    }
  } catch (err) {
    console.error("apple grant revocation threw; deleting the account anyway", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

type PreservedEvidenceRow = {
  original_profile_id: string;
  original_media_id: string | null;
  media_kind: "profile_photo" | "voice_intro";
  storage_bucket: "profile-photos" | "voice-intros";
  storage_path: string;
  moderation_status: string;
  media_created_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  // Read now, spent last. Apple's code is good for about five minutes, and everything between
  // here and the revocation is a handful of queries.
  const appleAuthorizationCode = await readAppleAuthorizationCode(req);

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Refusal 1: a currently-banned profile cannot self-delete. ---
  const { data: profileRow, error: profileError } = await serviceClient
    .from("profiles")
    .select("is_banned")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("failed to read profile for ban check", { message: profileError.message });
    return jsonResponse({ error: "Failed to check account status" }, 500);
  }
  if (profileRow?.is_banned) {
    return jsonResponse(
      { error: "This account has been banned and cannot be deleted. Contact support if you believe this is a mistake." },
      403,
    );
  }

  // --- Refusal 2: an open `underage` report against this profile blocks a normal
  // delete and freezes the account (match/message evidence retained) instead. Uses
  // reported_profile_id, the non-FK copy 0046 added, per trust-and-safety.md section
  // 4(b)'s own predicate. ---
  const { data: openUnderageReports, error: reportsError } = await serviceClient
    .from("reports")
    .select("id")
    .eq("reported_profile_id", user.id)
    .eq("reason", "underage")
    .neq("status", "dismissed")
    .limit(1);
  if (reportsError) {
    console.error("failed to check open reports for legal hold", { message: reportsError.message });
    return jsonResponse({ error: "Failed to check account status" }, 500);
  }
  if (openUnderageReports && openUnderageReports.length > 0) {
    const { error: freezeError } = await serviceClient.rpc("freeze_account_for_legal_hold", {
      p_profile_id: user.id,
      p_reason: "Self-deletion blocked: open underage-report safety review (legal hold, trust-and-safety.md section 4b).",
    });
    if (freezeError) {
      console.error("failed to freeze account for legal hold", { message: freezeError.message });
      return jsonResponse({ error: "Failed to process deletion" }, 500);
    }
    return jsonResponse(
      {
        error:
          "Your account can't be deleted right now because it's part of an open safety review. " +
          "Your account has been suspended instead. Contact support if you have questions.",
      },
      403,
    );
  }

  // --- Find flagged/rejected media BEFORE touching storage or the auth user. ---
  // moderation_status is the only signal that exists today (T&S doc section 2.3, open
  // gap #2 — no separate minor-score/reason column is persisted yet), so "flagged" here
  // means anything that never reached 'approved'.
  const { data: flaggedPhotos, error: photosError } = await serviceClient
    .from("profile_media")
    .select("id, storage_path, moderation_status, created_at")
    .eq("profile_id", user.id)
    .neq("moderation_status", "approved");
  if (photosError) {
    console.error("failed to read profile_media for evidence preservation", { message: photosError.message });
    return jsonResponse({ error: "Failed to check media status" }, 500);
  }

  const { data: flaggedVoiceIntro, error: voiceError } = await serviceClient
    .from("profile_voice_intro")
    .select("profile_id, storage_path, moderation_status, created_at")
    .eq("profile_id", user.id)
    .neq("moderation_status", "approved");
  if (voiceError) {
    console.error("failed to read profile_voice_intro for evidence preservation", { message: voiceError.message });
    return jsonResponse({ error: "Failed to check media status" }, 500);
  }

  // Per-bucket set of storage paths to skip in the removal loop below.
  const preservedPaths: Record<string, Set<string>> = {
    "profile-photos": new Set(),
    "voice-intros": new Set(),
  };

  const evidenceRows: PreservedEvidenceRow[] = [];
  for (const media of flaggedPhotos ?? []) {
    preservedPaths["profile-photos"].add(media.storage_path);
    evidenceRows.push({
      original_profile_id: user.id,
      original_media_id: media.id,
      media_kind: "profile_photo",
      storage_bucket: "profile-photos",
      storage_path: media.storage_path,
      moderation_status: media.moderation_status,
      media_created_at: media.created_at,
    });
  }
  for (const intro of flaggedVoiceIntro ?? []) {
    preservedPaths["voice-intros"].add(intro.storage_path);
    evidenceRows.push({
      original_profile_id: user.id,
      original_media_id: null,
      media_kind: "voice_intro",
      storage_bucket: "voice-intros",
      storage_path: intro.storage_path,
      moderation_status: intro.moderation_status,
      media_created_at: intro.created_at,
    });
  }

  // Copy the pointers into the preservation table before anything is deleted. Upsert on
  // (storage_bucket, storage_path) so a retried/duplicate call doesn't error.
  if (evidenceRows.length > 0) {
    const { error: evidenceError } = await serviceClient
      .from("preserved_moderation_evidence")
      .upsert(evidenceRows, { onConflict: "storage_bucket,storage_path" });
    if (evidenceError) {
      console.error("failed to preserve flagged media pointers", { message: evidenceError.message });
      return jsonResponse({ error: "Failed to preserve flagged media" }, 500);
    }
  }

  // Union in anything already preserved for this profile from an earlier row
  // delete/replace (0050's BEFORE DELETE triggers, 0054's BEFORE UPDATE triggers) — those
  // objects have no *current* profile_media/profile_voice_intro row pointing at them
  // anymore (that's what makes them "preserved": intentionally orphaned), so the query
  // above would never find them, and the removal loop below would otherwise delete the
  // very thing an earlier preservation was written to keep.
  const { data: alreadyPreserved, error: alreadyPreservedError } = await serviceClient
    .from("preserved_moderation_evidence")
    .select("storage_bucket, storage_path")
    .eq("original_profile_id", user.id);
  if (alreadyPreservedError) {
    console.error("failed to read already-preserved evidence", { message: alreadyPreservedError.message });
    return jsonResponse({ error: "Failed to check media status" }, 500);
  }
  for (const row of alreadyPreserved ?? []) {
    preservedPaths[row.storage_bucket]?.add(row.storage_path);
  }

  // Every bucket holding personal data. Voice intros are recordings of the user's own
  // voice: the profile_voice_intro row cascades away with the profile, but the audio
  // object does not, and once the profile is gone no policy can ever reach it again.
  // Missing one here means "delete my account" quietly leaves personal data behind,
  // which is exactly what the App Store / Play deletion requirement forbids.
  for (const bucket of ["profile-photos", "voice-intros"] as const) {
    const preserved = preservedPaths[bucket];
    const toRemove: string[] = [];

    // list() returns at most 1000 entries per call and does not paginate on its own.
    // Explicit offset pagination (rather than the old "delete-then-relist" trick) is
    // required now that some objects are deliberately left behind: a page containing a
    // preserved object would come back unchanged on the next list() call otherwise, and
    // this loop would never converge for an account with >=1000 objects and any flagged
    // ones among them.
    let offset = 0;
    for (;;) {
      const { data: files, error: listError } = await serviceClient.storage
        .from(bucket)
        .list(user.id, { limit: 1000, offset });
      if (listError) {
        console.error("failed to list objects during account deletion", { bucket, message: listError.message });
        return jsonResponse({ error: "Failed to delete stored files" }, 500);
      }
      if (!files || files.length === 0) break;

      for (const f of files) {
        const path = `${user.id}/${f.name}`;
        if (!preserved.has(path)) toRemove.push(path);
      }

      if (files.length < 1000) break;
      offset += files.length;
    }

    // remove() in the same page-sized chunks used to list them, rather than one
    // arbitrarily large call.
    for (let i = 0; i < toRemove.length; i += 1000) {
      const chunk = toRemove.slice(i, i + 1000);
      const { error: removeError } = await serviceClient.storage.from(bucket).remove(chunk);
      if (removeError) {
        console.error("failed to remove objects during account deletion", { bucket, message: removeError.message });
        return jsonResponse({ error: "Failed to delete stored files" }, 500);
      }
    }
  }

  // --- Apple grant revocation, last and non-blocking. ---
  //
  // AFTER every refusal and every preservation copy, so a deletion that was going to be
  // refused (banned, or frozen for legal hold) never revokes anything -- both of those paths
  // returned long before this line, and the account they belong to still exists and still
  // needs to be able to sign in. BEFORE deleteUser, because apple_refresh_tokens references
  // auth.users with `on delete cascade` (0068) and the row is gone the instant the user is.
  // It cannot throw: see its header.
  await revokeAppleGrant(serviceClient, user, appleAuthorizationCode);

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
