export interface ModerationResult {
  approved: boolean;
  reason: string | null;
}

/**
 * Pluggable image-moderation provider. This stub always approves — wire in a real
 * provider (AWS Rekognition DetectModerationLabels, Google Cloud Vision SafeSearch,
 * Sightengine, etc.) before a production launch. Until then, the value this pipeline
 * provides is structural: moderation_status can only ever be flipped by this function
 * (see the column-level grant in 0006_moderation_and_notifications.sql), never written
 * directly by the client, so swapping in a real check later needs no schema or RLS
 * changes — and the admin moderation queue remains the manual-review backstop either way.
 */
export function checkImage(_imageUrl: string): Promise<ModerationResult> {
  return Promise.resolve({ approved: true, reason: null });
}
