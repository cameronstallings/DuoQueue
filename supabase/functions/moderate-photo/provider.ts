/**
 * Automated image moderation for profile photos.
 *
 * Three outcomes, not two. The old interface was a boolean, which forced every
 * "I don't know" — provider down, timeout, unparseable response — into either a false
 * approve or a false reject. Both are wrong: approving publishes unreviewed content, and
 * rejecting punishes a user for an outage. `undetermined` leaves the photo `pending`,
 * where it is invisible to everyone but its owner and shows up in the admin review queue
 * (see 0033_photo_review_queue.sql).
 *
 * Provider is Sightengine. The deciding factor over AWS Rekognition — which is a strong
 * detector — is that Rekognition's moderation labels do not answer "is this a minor",
 * and this is a strictly 18+ app where publishing a photo of a child is the single worst
 * outcome the system can produce. Sightengine exposes a per-face `minor` score directly.
 * It also authenticates with two query parameters instead of SigV4 request signing, which
 * matters in a Deno edge function with no AWS SDK.
 */

export type ModerationVerdict = "approved" | "rejected" | "undetermined";

export interface ModerationResult {
  verdict: ModerationVerdict;
  /** Shown to the uploader on rejection, and logged for the admin queue otherwise. */
  reason: string | null;
}

const SIGHTENGINE_ENDPOINT = "https://api.sightengine.com/1.0/check.json";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * "sightengine" runs the real check. "manual-review" skips it and sends every photo to
 * the admin queue.
 *
 * There is deliberately no "approve everything" mode. The previous stub was exactly that,
 * and a default that silently publishes unreviewed photos is the kind of thing that
 * survives to production because nothing ever appears broken. An unset variable therefore
 * degrades to manual-review — safe, visible, and obviously incomplete — rather than to
 * automatic approval.
 */
const PROVIDER = Deno.env.get("MODERATION_PROVIDER") ?? "manual-review";
const API_USER = Deno.env.get("SIGHTENGINE_API_USER");
const API_SECRET = Deno.env.get("SIGHTENGINE_API_SECRET");

/**
 * Thresholds.
 *
 * This is a gaming friend-finder, not a nudity-free zone: a shirtless gym photo or a
 * swimsuit shot at the beach is normal and must not be rejected. nudity-2.1 separates
 * intensity levels precisely so that judgement can be made, so only the three genuinely
 * explicit classes are considered, and `mildly_suggestive` / `suggestive` /
 * `very_suggestive` are ignored entirely.
 *
 * Each check has a reject threshold and a lower review threshold. The band between them
 * is where the model is unsure, and an unsure verdict belongs with a human rather than
 * being rounded toward either mistake.
 */
const EXPLICIT_REJECT = 0.5;
const EXPLICIT_REVIEW = 0.3;

/**
 * The minor thresholds are deliberately asymmetric with a wide review band. Wrongly
 * rejecting a young-looking adult is an annoyance they can appeal; wrongly approving a
 * child is unacceptable and possibly criminal. So anything past mild suspicion goes to a
 * human, and only a confident detection auto-rejects.
 */
const MINOR_REJECT = 0.7;
const MINOR_REVIEW = 0.35;

const GORE_REJECT = 0.5;
const GORE_REVIEW = 0.3;

interface SightengineResponse {
  status?: string;
  error?: { message?: string; type?: string };
  nudity?: Record<string, unknown>;
  gore?: { prob?: number };
  faces?: { attributes?: { minor?: number } }[];
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Highest score across the classes that actually denote explicit content. */
function explicitScore(nudity: Record<string, unknown> | undefined): number {
  if (!nudity) return 0;
  return Math.max(
    num(nudity.sexual_activity),
    num(nudity.sexual_display),
    num(nudity.erotica),
  );
}

function highestMinorScore(faces: SightengineResponse["faces"]): number {
  if (!Array.isArray(faces) || faces.length === 0) return 0;
  return Math.max(...faces.map((f) => num(f?.attributes?.minor)));
}

export async function checkImage(imageUrl: string): Promise<ModerationResult> {
  if (PROVIDER === "manual-review") {
    console.warn(
      "MODERATION_PROVIDER is not set to a real provider — routing this photo to the admin review queue. " +
        "Set MODERATION_PROVIDER=sightengine plus SIGHTENGINE_API_USER/SIGHTENGINE_API_SECRET to enable automated checks.",
    );
    return { verdict: "undetermined", reason: "awaiting_manual_review" };
  }

  if (PROVIDER !== "sightengine") {
    console.error(`Unknown MODERATION_PROVIDER "${PROVIDER}" — refusing to guess.`);
    return { verdict: "undetermined", reason: "moderation_misconfigured" };
  }

  if (!API_USER || !API_SECRET) {
    console.error("MODERATION_PROVIDER=sightengine but SIGHTENGINE_API_USER/SIGHTENGINE_API_SECRET are missing.");
    return { verdict: "undetermined", reason: "moderation_misconfigured" };
  }

  const params = new URLSearchParams({
    // face-attributes carries the per-face `minor` score; the other two are the content
    // checks. One request, three models.
    models: "nudity-2.1,gore-2.0,face-attributes",
    api_user: API_USER,
    api_secret: API_SECRET,
    url: imageUrl,
  });

  let body: SightengineResponse;
  try {
    const res = await fetch(`${SIGHTENGINE_ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Sightengine returned HTTP ${res.status}`);
      return { verdict: "undetermined", reason: "moderation_unavailable" };
    }
    body = (await res.json()) as SightengineResponse;
  } catch (err) {
    // Timeout, DNS failure, TLS error, malformed JSON — all the same to us.
    console.error("Sightengine request failed:", err instanceof Error ? err.message : String(err));
    return { verdict: "undetermined", reason: "moderation_unavailable" };
  }

  if (body.status !== "success") {
    console.error("Sightengine reported failure:", body.error?.message ?? body.status ?? "unknown");
    return { verdict: "undetermined", reason: "moderation_unavailable" };
  }

  // A successful response that carries none of the requested sections means the contract
  // changed under us. Treating a shape we don't recognise as "clean" would silently
  // disable moderation, so it goes to review instead.
  if (!body.nudity && !body.gore && !body.faces) {
    console.error("Sightengine response missing every expected section — treating as undetermined.");
    return { verdict: "undetermined", reason: "moderation_unavailable" };
  }

  const explicit = explicitScore(body.nudity);
  const minor = highestMinorScore(body.faces);
  const gore = num(body.gore?.prob);

  // Minor first: it outranks everything else regardless of what the photo otherwise shows.
  if (minor >= MINOR_REJECT) {
    return { verdict: "rejected", reason: "This photo appears to show a minor." };
  }
  if (explicit >= EXPLICIT_REJECT) {
    return { verdict: "rejected", reason: "This photo contains explicit sexual content." };
  }
  if (gore >= GORE_REJECT) {
    return { verdict: "rejected", reason: "This photo contains graphic or violent content." };
  }

  if (minor >= MINOR_REVIEW || explicit >= EXPLICIT_REVIEW || gore >= GORE_REVIEW) {
    console.warn(
      `Photo sent to manual review (minor=${minor.toFixed(2)} explicit=${explicit.toFixed(2)} gore=${gore.toFixed(2)})`,
    );
    return { verdict: "undetermined", reason: "awaiting_manual_review" };
  }

  return { verdict: "approved", reason: null };
}
