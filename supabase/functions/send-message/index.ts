// Sends a chat message on behalf of the authenticated caller. This is the only path
// that can write to public.messages (the table has no client INSERT grant) so the
// profanity filter and the free-tier "5 active conversations" gate are always applied
// before a message is delivered, never left to be skipped by a client that calls the
// table directly.
import { createClient } from "npm:@supabase/supabase-js@2";

import { filterProfanity } from "./profanity.ts";

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

    const body = (await req.json().catch(() => ({}))) as SendMessageBody;
    const matchId = body.matchId;
    const rawContent = body.content?.trim();

    if (!matchId || !rawContent) {
      return jsonResponse({ error: "matchId and content are required" }, 400);
    }
    if (rawContent.length > 2000) {
      return jsonResponse({ error: "Message is too long" }, 400);
    }

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

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
