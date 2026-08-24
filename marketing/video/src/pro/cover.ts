/**
 * THE COVER FRAME, DERIVED FROM THE STATEMENT RATHER THAN TYPED IN.
 *
 * =====================================================================================
 * WHY THIS FILE EXISTS
 * =====================================================================================
 *
 * The cover still was taken on frame 20 of every film, one hard-coded number shared by four
 * scripts. Measured on the delivered batch, that is the worst frame the renderer could have
 * picked, and it fails in three ways at once:
 *
 *   NO WORDS. The first word of a statement lands on frame 34 - `SOLO.normal` is 30 and a word
 *   needs `BUILD.frames` to settle - so frame 20 is always before the type exists. Every cover in
 *   the batch was a wordless picture.
 *
 *   IDENTICAL COVERS. Frame 20 is inside the opening object beat, and the opening object beat is
 *   a property of the shot plan rather than of the words. `pain` and `hours` both open on the
 *   plate and `mechanic` and `objection` both open on the device, so the four covers were two
 *   files: md5 e2ea066f twice and ccc3f629 / e783014b for the other pair. Two reels sharing a
 *   thumbnail in the same feed is one reel as far as a scroller is concerned.
 *
 *   NOTHING AT THUMBNAIL SIZE. Scaled to 150px wide, which is about what a profile grid gives a
 *   post, a wordless plate is a grey-blue smear and a wordless device is a white rectangle.
 *
 * Frame 0 is worse still and cannot be fixed here: the approved film opens with a ten-frame ramp
 * out of black, measured 0, 21, 42 ... 208 on `pro-a-light.mp4` and frame-identical on all four
 * of these. That ramp is the approved system and this batch does not touch it, which is why the
 * cover PNG matters: it is the one still a platform will show instead of frame 0, and it has to
 * be set by hand at upload time on all three platforms. `captions.md` now says so.
 *
 * =====================================================================================
 * WHAT IS DERIVED, AND FROM WHAT
 * =====================================================================================
 *
 * The frame is solved out of the same `statementPlan` DirectionA renders from, so the cover
 * cannot drift from the film: change a read, a beat table or a solo and the cover moves with it.
 *
 *   settled   at + start + cadence * (words - 1) + BUILD.frames   the last word has landed
 *   exitAt    at + exitAt                                          the first word starts leaving
 *
 * The cover is the midpoint of [settled, exitAt], which is the only frame in a beat where the
 * whole sentence is on the frame and nothing is moving. Checked against pixels on `objection`
 * beat one: start 30, cadence 5, words 11, so settled = 86, and frame 86 is the first frame whose
 * last word reads `card`. The derivation and the render agree.
 *
 * WHICH BEAT is a shot-plan decision and lives in ./shots.ts beside the other three, because it
 * is the same kind of question: what is the picture under this sentence.
 */
import { BUILD } from "./motion";
import type { ProScript } from "./script";
import { statementPlan, statementsOf, wordCount } from "./film";
import { coverBeat } from "./shots";
import { beatFrames, beatStarts } from "./timing";

/** The frame the whole statement of `beat` is up and still. */
export const coverFrameOfBeat = (script: ProScript, beat: number): number => {
  const starts = beatStarts(script);
  const frames = beatFrames(script);
  const at = starts[beat] ?? 0;
  const statement = statementsOf(script, starts, frames).find((one) => one.at === at);
  if (statement === undefined) {
    throw new Error(`${script.id}: no statement starts on beat ${String(beat)}.`);
  }
  const words = wordCount(statement.lines);
  const shape = statementPlan(statement.window, words, statement.solo);
  const settled = shape.start + shape.cadence * (words - 1) + BUILD.frames;
  return statement.at + Math.round((settled + shape.exitAt) / 2);
};

/** The frame the cover still is taken on. */
export const coverFrame = (script: ProScript): number =>
  coverFrameOfBeat(script, coverBeat(script.id));
