// Sends a chat message on behalf of the authenticated caller. This is the only path
// that can write to public.messages (the table has no client INSERT grant) so the
// profanity filter and the free-tier "5 active conversations" gate are always applied
// before a message is delivered, never left to be skipped by a client that calls the
// table directly.
import { createClient } from "npm:@supabase/supabase-js@2";

import { filterProfanity } from "./profanity.ts";
import { isCleanText, isUuid, readJsonBody } from "../_shared/validation.ts";
import { checkRateLimit, RateLimitedError, rateLimitResponse } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendMessageBody {
  matchId?: string;
  content?: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// No CORS headers: this is a mobile-only API (Expo Go and native RN builds neither
// enforce nor need CORS — that's a browser-fetch concept). Every sibling function in
// this repo is already unreachable from a browser context the same way; this one used
// to opt back in with a wildcard origin for no stated reason, which only widened the
// endpoint's exposed surface without a corresponding product need.
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
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

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Loose on purpose: public.enforce_message_send_guard() (migration 0042) already
    // rate-limits actual inserts into `messages` at 8/10s and 300/hour, which is the
    // carefully-tuned constraint for real chatting. This outer check exists only to
    // stop the function invocation itself (auth lookup, match lookup, profanity
    // filter) from being hammered by something that never gets far enough to hit the
    // DB-level guard — set well above it so it never binds before that one does.
    try {
      await checkRateLimit(serviceClient, user.id, "edge:send-message", 20, 10);
    } catch (err) {
      if (err instanceof RateLimitedError) return rateLimitResponse(err.bucket);
      throw err;
    }

    const bodyResult = await readJsonBody<SendMessageBody>(req);
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.data;

    if (!isUuid(body.matchId)) {
      return jsonResponse({ error: "matchId must be a valid UUID" }, 400);
    }
    // Mirrors the messages_content_no_control_chars / messages_content_check bounds
    // added in 0049_input_constraints.sql exactly, so a bad message gets a clean 400
    // here instead of a raw constraint-violation 500 from the insert below.
    if (!isCleanText(body.content, { maxLength: 2000, allowNewlines: true })) {
      return jsonResponse({ error: "content must be 1-2000 characters with no control characters" }, 400);
    }
    const matchId = body.matchId;
    const rawContent = body.content.trim();

    const { data: match, error: matchError } = await userClient
      .from("matches")
      .select("id, user_a_id, user_b_id, unmatched_at")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return jsonResponse({ error: "Match not found" }, 404);
    }
    if (match.user_a_id !== user.id && match.user_b_id !== user.id) {
      return jsonResponse({ error: "Not a participant of this match" }, 403);
    }
    if (match.unmatched_at) {
      return jsonResponse({ error: "This match is no longer active" }, 400);
    }

    const { data: unlocked, error: unlockedError } = await userClient.rpc(
      "is_conversation_unlocked",
      { p_match_id: matchId },
    );
    if (unlockedError) {
      return jsonResponse({ error: unlockedError.message }, 500);
    }
    if (!unlocked) {
      return jsonResponse(
        {
          error: "conversation_locked",
          details:
            "This conversation is locked. Upgrade to DuoQueue+ for unlimited active conversations, or unmatch an older one to free up a slot.",
        },
        403,
      );
    }

    const { content, isFlagged } = filterProfanity(rawContent);

    const { data: message, error: insertError } = await serviceClient
      .from("messages")
      .insert({ match_id: matchId, sender_id: user.id, content, is_flagged: isFlagged })
      .select()
      .single();

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    return jsonResponse({ message }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
