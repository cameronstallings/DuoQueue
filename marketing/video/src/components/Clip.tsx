/** One cut of footage, trimmed at render time out of a longer file, under the scrim that
 * keeps overlay text readable. */
import { AbsoluteFill, getStaticFiles, OffthreadVideo, staticFile } from "remotion";

import { darkColors, spacing, type as typeScale } from "@app/theme/tokens";

import { scrim } from "@/lib/color";
import { FONT_FAMILY } from "@/lib/fonts";
import { FPS, px } from "@/lib/scale";
import { textStyle } from "@/lib/text-style";
import { clips } from "@/data/clips";
import type { ClipName } from "@/types";

import { Tick } from "./Tick";

/** Bottom-weighted: the overlay text sits above SAFE.bottom, and a ramp that started at the
 * top would grey out the middle third of the frame, which on app footage is exactly where
 * the interface being demonstrated is. */
const SCRIM = `linear-gradient(to bottom, ${scrim(0)} 40%, ${scrim(0.82)} 100%)`;

/** getStaticFiles() reads the manifest the bundler writes into the page, so it answers during
 * a render and not only in Studio. It is the only way a component in the browser can know
 * whether a file is there, and it has to know: public/footage/ is gitignored, Cameron drops
 * files into it by hand, and broll-gameplay.mp4 does not exist yet. */
const isPresent = (path: string): boolean =>
  getStaticFiles().some((staticAsset) => staticAsset.name === path);

/** What a clip looks like before its footage has been recorded. Loud on purpose: a black
 * rectangle is indistinguishable from a dark frame of real video, so every format except
 * `spec` would otherwise look finished while showing nothing. */
const MissingClip = ({ name, file }: { name: string; file: string }) => (
  <AbsoluteFill
    style={{
      backgroundColor: darkColors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      gap: px(spacing.md),
    }}
  >
    <Tick>MISSING CLIP</Tick>
    <div
      style={{
        fontFamily: FONT_FAMILY.mono,
        fontSize: `${px(typeScale.body.fontSize)}px`,
        color: darkColors.text,
      }}
    >
      {name}
    </div>
    {/* The file, not just the clip name, because the fix is dropping that file into that
        directory and the panel should say so without a trip to clips.ts. */}
    <div style={{ ...textStyle(typeScale.chipText), color: darkColors.textMuted }}>
      {`public/footage/${file}`}
    </div>
  </AbsoluteFill>
);

export const Clip = ({ name }: { name: ClipName }) => {
  const clip = clips[name];
  const path = `footage/${clip.file}`;

  return (
    <AbsoluteFill>
      {isPresent(path) ? (
        // OffthreadVideo, not Video: iPhone screen recordings are HEVC in a .mov, which
        // Chromium's <video> element will not decode. trimBefore/trimAfter are the current
        // prop names; Remotion 4 still accepts the older startFrom/endAt.
        <OffthreadVideo
          src={staticFile(path)}
          trimBefore={Math.round(clip.from * FPS)}
          trimAfter={Math.round(clip.to * FPS)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <MissingClip name={name} file={clip.file} />
      )}
      <AbsoluteFill style={{ backgroundImage: SCRIM }} />
    </AbsoluteFill>
  );
};
