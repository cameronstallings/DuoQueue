/**
 * The transcode of last resort, and nothing else.
 *
 * Footage arrives in whatever the capture device produced: HEVC in a .mov from an iPhone, a
 * 1440p landscape capture from a PC recorder, variable frame rate from a phone that was busy.
 * Most of it plays fine, because `Clip` uses `OffthreadVideo` and Remotion's compositor
 * decodes far more than Chromium's video element does. When a source does NOT play, the
 * symptom is black frames in Studio or a decode error mid render, and this is the way out
 * that does not require ffmpeg on PATH:
 *
 *   npx remotion render src/index.ts Normalize \
 *     public/footage/broll-gameplay-normalized.mp4 \
 *     --props='{"file":"broll-gameplay.mov","seconds":240}'
 *
 * Then point the clip in src/data/clips.ts at the normalized file. The output is H.264 in an
 * MP4 at exactly 1080x1920 and 30fps, which is the shape every post is, so the crop and the
 * frame rate conversion are paid once here instead of on every render that uses the clip.
 *
 * It is a fallback and not the intake path, because it costs a full encode of everything and
 * a second generation of lossy video. Reach for it only when a source will not decode.
 */
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

import { clips } from "@/data/clips";

/** A type alias and not an interface on purpose: `Composition` wants props assignable to
 * `Record<string, unknown>`, and an interface has no implicit index signature, so declaring
 * this the obvious way fails to typecheck at the registration in Root.tsx. */
export type NormalizeProps = {
  /** File name under public/footage/, extension included. */
  file: string;
  /** How much of it to write. There is no metadata read here, so this is the operator's job:
   * pass the source duration. Asking for more than the source has writes black frames rather
   * than stopping early, because `OffthreadVideo` renders nothing past its own end. */
  seconds: number;
};

/** `objectFit: cover` deliberately matches `Clip`, so what comes out of here is framed the
 * way the post will frame it. A landscape source loses its sides at this step rather than at
 * render time, which is the point: the clip is then already the right shape and the crop is
 * not re-decided three times a day. */
export const Normalize = ({ file }: NormalizeProps) => (
  // No background: `cover` fills the frame by definition, and this is the one composition in
  // the project that must not put a single pixel of its own into the picture.
  <AbsoluteFill>
    <OffthreadVideo
      src={staticFile(`footage/${file}`)}
      muted
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  </AbsoluteFill>
);

/** Any real clip file, so opening this in Studio without props shows something instead of
 * throwing on a missing asset. It is never the file anyone actually wants to normalize. */
export const NORMALIZE_DEFAULTS: NormalizeProps = {
  file: clips["deck-dark"].file,
  seconds: clips["deck-dark"].to,
};
