/**
 * One track, mounted once, at the root of a post.
 *
 * The mix is already finished when it gets here: the voice is anchored, the bed is carved and
 * ducked under it, and the sum is normalised to -14 LUFS with the true peak under -1 dBTP.
 * There is deliberately nothing to tune at this end. Doing any of it in Remotion would mean
 * the level depended on which frames were rendered, and a mix that changes when you re-render
 * it is not a mix.
 *
 * `getStaticFiles()` reads the manifest the bundler writes into the page, so it answers during
 * a render as well as in Studio. It has to be asked: public/audio/mix/ is gitignored, and a
 * post whose timings are committed but whose WAV has not been rebuilt yet must render silent
 * rather than fail. That is the same call `Clip` makes about footage.
 */
import { Audio, getStaticFiles, staticFile } from "remotion";

import { audioFor } from "./timings";

const isPresent = (path: string): boolean =>
  getStaticFiles().some((staticAsset) => staticAsset.name === path);

export const Soundtrack = ({ id }: { id: string }) => {
  const audio = audioFor(id);
  if (audio === null || !isPresent(audio.file)) {
    return null;
  }
  return <Audio src={staticFile(audio.file)} />;
};
