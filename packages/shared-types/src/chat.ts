/** Row shape returned by the `get_matches_summary` Postgres RPC (0004_chat.sql). */
export interface MatchSummary {
  match_id: string;
  other_profile_id: string;
  other_display_name: string;
  other_photo_path: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  is_locked: boolean;
}

/** Body shape sent to the send-message Edge Function. */
export interface SendMessageRequest {
  matchId: string;
  content: string;
}

export interface SendMessageResponse {
  message?: {
    id: string;
    match_id: string;
    sender_id: string;
    content: string;
    is_flagged: boolean;
    read_at: string | null;
    created_at: string;
  };
  /** Machine-readable error code, e.g. "conversation_locked". */
  error?: string;
  /** Human-readable description of `error`, for direct display. */
  details?: string;
}
