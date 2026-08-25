/**
 * THE SHAPE OF A BEAT, and the rule that decides what is on the frame at any instant.
 *
 * =====================================================================================
 * ONE PEER ELEMENT, WHICH IS WHY THE OBJECT RECEDES INSTEAD OF THE TYPE MOVING ASIDE
 * =====================================================================================
 *
 * Measured: the Uber reel shows ONE peer element per beat for the entire 25.6 seconds. The
 * apparent exceptions are not exceptions - the blurred list at f105 is the OUTGOING STATE of the
 * same object mid zoom-through, and the two cards at f494 are CHILDREN of the phone. Its type
 * beats and its object beats strictly alternate; a line and a card are never both the subject.
 *
 * That is a composition rule before it is a doctrine, and ignoring it is what produced the note.
 * A 745px card centred at 44% of the height occupies y 607 to 1083. A two line statement centred
 * at 50% occupies y 870 to 1050. They cannot both be there. The rejected direction's answer was
 * to move the type to the top left corner and clamp the object low, which is precisely the
 * "weird spots" and the dead bottom third.
 *
 * The answer here is the one both references actually use. When the statement arrives, THE OBJECT
 * RECEDES IN Z: it pushes back to -520 in the stage's 1400px perspective, drops to 30% and takes
 * a soft blur, and the type builds in front of it. Uber does this at f372-432, where the picker
 * card holds while a map layer behind it fades up and scales at its own rate; ClickUp does it at
 * f312-342, where the tilted window rises from below BEHIND the type while the type rises with
 * it. Two planes, two velocities, one camera.
 *
 * So a beat is: THE OBJECT ALONE, then THE OBJECT RECEDING WHILE THE STATEMENT BUILDS, then THE
 * STATEMENT ALONE IN FRONT OF A FIELD THAT USED TO BE THE OBJECT, then the statement accelerating
 * out and the seam. Never a card and a line competing for the same 400 pixels.
 *
 * =====================================================================================
 * THE TYPE BUILDS FAST AND THEN WAITS, WHICH IS ALSO MEASURED
 * =====================================================================================
 *
 * Uber's word starts are f182, f187, f191, f196: gaps of 5, 4 and 5 frames. Speech at 150-170 wpm
 * is 0.36 to 0.40s per word, which is 11 to 12 frames, so THE TYPE BUILDS ABOUT 2.5 TIMES FASTER
 * THAN THE VOICE AND THEN HOLDS. It is a flourish, not a karaoke track, and trying to sync it to
 * the read is what makes a film look like a caption generator.
 *
 * `statementPlan` therefore fills the beat backwards from its exit, which is the one thing that
 * cannot move: the exit IS the seam and it has to end on the cut. Then the hold, then the build,
 * at the measured cadence, dropping to 3 frames only if a twelve word sentence genuinely cannot
 * be told at 5. The rejected direction ran a 2 frame cadence with a 0.84 decay on top, so its
 * last words machine gunned - the visual half of "the script is so choppy".
 */
import { BUILD, EASE, EXIT, ramp } from "./motion";
import type { ProScript } from "./script";
import { evidenceBeat } from "./shots";

/** Words in a statement. The unit `statementPlan` sizes a build in, and the unit a line's exit
 * stagger is counted in. Re-exported from ./type.ts, which is where every renderer imports it. */
export const wordCount = (lines: readonly string[]): number =>
  lines.reduce((total, line) => total + line.split(" ").length, 0);

/** Frames a whole line takes to clear the frame, stagger included. */
export const exitFrames = (words: number): number =>
  Math.ceil(EXIT.frames + (words - 1) * EXIT.stagger);

export interface StatementPlan {
  /** Frame, local to the beat, the first word starts building on. */
  start: number;
  /** Frames between one word starting and the next. */
  cadence: number;
  /** Frame the exit begins on. The last word clears the frame on the beat's last frame. */
  exitAt: number;
}

/**
 * =====================================================================================
 * THE HOOK, WHICH IS THE ONE STATEMENT WHOSE DEADLINE IS SET OUTSIDE THE FILM
 * =====================================================================================
 *
 * MEASURED ON THE DELIVERED BATCH, by pulling frames out of the MP4s rather than by reading the
 * plan. `statementPlan` at `SOLO.normal` and the measured cadence of 5 put the last word of the
 * first sentence at:
 *
 *   reel-pain        f81   2.700s   "solo queue hands you four strangers and a coin flip"
 *   reel-mechanic    f81   2.700s   "every card you see was scored before it was dealt"
 *   reel-objection   f86   2.867s   "it looks like a dating app until you read a card"
 *   reel-hours       f86   2.867s   "you play at midnight and everyone you know plays at eight"
 *   pro-a-light      f86   2.867s   "your best games were the ones you played with someone else"
 *
 * The voice starts at 0.20s in every one of them, so for a full second the viewer hears a sentence
 * they cannot read, and the differentiator lands somewhere north of two and a half seconds. A
 * scroll decision on Reels and TikTok is made in roughly the first 1 to 1.5 seconds. So the film
 * spent the whole decision window on an object and delivered its argument after the decision. On a
 * cold account with no follower graph carrying the post, that opening IS the distribution.
 *
 * THE DEADLINE IS THEREFORE 1.2 SECONDS, f36, AND IT IS FINISHED RATHER THAN STARTED. `settleBy`
 * below is f34, two frames inside it.
 *
 * =====================================================================================
 * WHY THE PER-WORD BUILD SURVIVES ON THE ONE BEAT THAT COULD NOT AFFORD IT
 * =====================================================================================
 *
 * The build is a flourish, and .claude/skills/animate is explicit that a flourish which costs the
 * thing it decorates is a defect. A hook exists to be READ. So the third option - beat one presents
 * its line already composed, no build at all, legible on the frame it appears - is the one to beat,
 * and it is the right answer whenever the arithmetic says the build finishes after the deadline.
 *
 * The arithmetic does not say that. At `solo` 0 and the cadence below, the hook is complete at f34
 * and the FIRST word is complete at f6, 0.20s, which is the frame the voice starts on. The entire
 * build happens inside the decision window. It therefore costs the read nothing, and against that
 * zero cost it buys three things a composed block does not:
 *
 *   IT IS THE READING ORDER. Ten words on three lines dropped in whole is a block the eye has to
 *   find its own way into. Revealed left to right at a tenth of a second a word, the film does the
 *   scanning: by the time the last word lands the viewer has been walked through the sentence once.
 *
 *   IT MOVES DURING THE ONLY SECOND THAT DECIDES ANYTHING. A composed block is a static poster for
 *   the whole of its hold. Something arriving is what stops a thumb, and the film's first frames
 *   are already a ramp out of black and a plate receding; type writing itself is the third thing in
 *   that motion rather than a fourth state after it.
 *
 *   IT IS THE FILM'S OWN TYPE LAW. Beats two, three and four build word by word and are not being
 *   touched. A composed beat one would be the viewer's first impression of a system the film then
 *   abandons, and the seam into beat two would read as the film slowing down rather than opening.
 *
 * If a future hook is long enough that `minCadence` cannot get it inside `settleBy`, the build has
 * started costing the thing it decorates and the composed presentation is what that hook should
 * get. Nothing here is a defence of the build in general; it is arithmetic that came out in its
 * favour on five specific sentences.
 */
export const HOOK = {
  /**
   * Frames the object owns beat one by itself. ZERO, against `SOLO.normal`'s 30.
   *
   * `SOLO` calls this "how long the object owns the frame by itself", and on beats two onward that
   * is a real want and is unchanged. On beat one it is a luxury the film cannot afford: 30 frames
   * of object alone is 1.0s of the 1.2s the entire decision gets.
   *
   * At zero, `focusAt` starts the recede at `-RECEDE.lead` and finishes it on f6, so the paper is
   * already clean before the second word has landed. Note what this does NOT do: it does not
   * composite a statement over an object. The recede still leads the type by the same four frames
   * it always did; it now leads it from before frame zero.
   */
  solo: 0,
  /**
   * The frame beat one's last word is fully painted on. 34 frames, 1.133s.
   *
   * A word is finished `BUILD.frames` after it starts, so this is a deadline the cadence is solved
   * backwards from rather than a target the build drifts toward. Every hook in the batch lands on
   * this exact frame whatever its length, which is worth having on its own: five films that exist
   * to be compared now open on one clock.
   */
  settleBy: 34,
  /**
   * The floor under the hook's cadence, below which the last words machine-gun.
   *
   * The general floor is 3 and this is 2.6, and the difference is what the two floors are for. 3
   * stops a twelve word sentence being told faster than the beat that holds it can afford - a
   * question about ROOM. This one is a question about LEGIBILITY: 2.6 frames is 0.087s a word,
   * flat, with no decay. The rejected direction's 2 frames with a 0.84 decay on top is what
   * machine-gunning actually was, and it is the decay rather than the interval that did it - its
   * last words landed about a frame apart. A constant interval does not accelerate and reads as
   * one continuous write.
   *
   * At the batch's longest hook, eleven words, the solved cadence is 2.8 and the floor is never
   * reached. It exists so that a longer hook fails visibly against `settleBy` rather than silently
   * against the eye.
   */
  minCadence: 2.6,
} as const;

/**
 * Where a statement lives inside a window.
 *
 * `statement.solo` is the earliest the statement may begin, which is how long the direction wants
 * the object to own the frame by itself. Everything after that is derived from the exit backwards,
 * EXCEPT on the hook, which is derived forwards from `settleBy` because the hook's deadline is a
 * fact about the platform rather than about the beat.
 *
 * It takes the whole `Statement` rather than three loose numbers so the hook rule cannot be applied
 * at one call site and forgotten at the other two: the cover still is solved out of this function
 * as well as the two directions that render from it.
 */
export const statementPlan = (statement: Statement, words: number): StatementPlan => {
  const start = statement.solo;
  const exitAt = statement.window - exitFrames(words);
  const gaps = Math.max(1, words - 1);
  if (statement.settleBy !== undefined) {
    // Forwards from the deadline. The last word starts on (words - 1) * cadence and is finished
    // BUILD.frames later, so this lands on `settleBy` exactly whenever the floor is not in the way.
    const cadence = Math.min(
      5,
      Math.max(HOOK.minCadence, (statement.settleBy - start - BUILD.frames) / gaps),
    );
    return { start, cadence, exitAt };
  }
  const room = exitAt - start - BUILD.hold - BUILD.frames;
  const cadence = Math.min(5, Math.max(3, room / gaps));
  return { start, cadence, exitAt };
};

/**
 * THE RECEDE. What happens to the object when the statement arrives.
 *
 * -520 in a 1400px perspective renders the object at 1400/1920 = 73% of its size, so the push
 * back is read as depth before any of the other numbers do anything. The opacity and the blur are
 * what stop a receded object from still competing: it should be a field with a memory of a card
 * in it, which is what the reference's map layer is.
 *
 * It starts four frames BEFORE the first word, so the frame has already changed depth by the time
 * anything is written on it. A recede that begins on the same frame as the type reads as the type
 * pushing the object away, which is a cause the film has not earned.
 *
 * =====================================================================================
 * `opacity` IS 0. IT WAS 0.46, AND THE SECOND PLANE WAS THE MISTAKE
 * =====================================================================================
 *
 * z, scale, blur, lead and frames are the depth law and none of them changed with the ground.
 * Opacity is not depth, it is contrast against whatever is behind, and the same alpha buys a
 * completely different amount of it on the two grounds. Measured off the two renders, on the
 * card whose mean luma is 136:
 *
 *   dark ground   receded card 38 against a ground of 20   a step of 18 on a base of 20, 90%
 *   light ground  receded card 226 against a ground of 243  a step of 17 on a base of 243, 7%
 *
 * That arithmetic is right, and 0.46 is what it argues for if the goal is to keep a second plane
 * alive under the statement. The goal was wrong. Cameron's note on the render was that the text
 * overlaps the phone, and measured on the delivered frame the object sat at luma 158 against a
 * ground of 240: not a plane behind the words, a washed-out phone with words across it.
 *
 * The references settle it. The Uber reel never composites a statement over an object. It shows
 * the ride card, alone, and then shows "You have got options" on empty white, alone. The analysis
 * this film was built from said so in as many words: ONE element on screen at a time. A film that
 * holds a 46% phone under its own headline is not doing what the thing it copies does.
 *
 * So the object leaves, completely. At 0 the recede finishes the job z, scale and blur start, the
 * statement lands on genuinely clean paper, and the beat is one element exactly as the reference is.
 * A trace was tried at 0.08 first and it still read as a phone behind the words. The frame is
 * not emptier for it: the object is back at full opacity the moment the statement is done, and the
 * cut between those two states IS the composition.
 *
 * The scrim in ../Hero that was pulled to 0.25 to support the second plane goes with it, for the
 * same reason: there is no longer anything under the type for a scrim to hold down.
 */
export const RECEDE = {
  lead: 4,
  frames: 10,
  z: -520,
  scale: 0.94,
  opacity: 0,
  blur: 7,
} as const;

/**
 * =====================================================================================
 * THE SCHEDULE, SHARED BY THE TWO OBJECT-LED DIRECTIONS
 * =====================================================================================
 *
 * A and B differ in what the object IS - a device in studio light against a card in space - and
 * not in when the words happen. Sharing the schedule is what makes them a comparison rather than
 * two films: put them side by side and every statement builds on the same frame.
 *
 * Direction C is not on this schedule and could not be, because its type law is the ClickUp one:
 * a continuous scroll with no build, no hold and no exit. That is the point of a third direction.
 */

/**
 * Frames the last image holds after the last word has cleared, before the brand arrives.
 *
 * 19 frames, 0.63s. The measured reference end cards are preceded by a held final image of 0.53s
 * in Uber and 0.67s in ClickUp. This is the stillness before the climax that the doctrine reserves
 * and it is spent once, on the only shot in the film that is outside the app.
 */
export const CLOSING_HOLD = 19;

/**
 * How long the object owns the frame by itself before the statement takes it.
 *
 * THE EVIDENCE BEAT gets nearly twice as long because it has two pieces of evidence to show and
 * the sentence names both of them. Which beat that is used to be the literal index 2, because the
 * approved film is the only film there was; it is now `evidenceBeat` in ./shots.ts, because the
 * sentence that names two chips is beat three in `pain` and beat two in `mechanic` and
 * `objection`, and `hours` does not have one at all. `pro-001` and `pro-pain` answer 2, so the
 * approved film is unchanged. The clauses of the last beat get eight frames each, which is the
 * price of three landings inside one breath.
 *
 * NONE OF THESE THREE APPLIES TO BEAT ONE ANY MORE. `HOOK.solo` does, and it is zero. Every number
 * here is an answer to "how long should the object have the frame to itself", and beat one is the
 * one beat where that is not the question being asked. Beats two onward are unchanged, including
 * on the two films whose evidence beat is beat two.
 */
export const SOLO = { normal: 30, evidence: 58, clause: 8 } as const;

export interface Statement {
  at: number;
  window: number;
  lines: readonly string[];
  key: string;
  solo: number;
  /**
   * The frame, local to the beat, this statement's last word has to be fully painted by.
   *
   * Set on beat one and on nothing else. A statement without it is planned the way every statement
   * in the three directions has always been planned - backwards from its exit, at the measured
   * cadence, with the room it happens to have. A statement WITH it is planned forwards from a
   * deadline that comes from the platform rather than from the beat. See `HOOK`.
   */
  settleBy?: number;
}

export const statementsOf = (
  script: ProScript,
  starts: readonly number[],
  frames: readonly number[],
): Statement[] =>
  script.beats.flatMap<Statement>((beat, index) => {
    const at = starts[index] ?? 0;
    const window = frames[index] ?? 1;
    if (index < script.beats.length - 1) {
      return [
        {
          at,
          window,
          lines: beat.lines,
          key: beat.key,
          // BEAT ONE IS THE HOOK AND IS PLANNED AGAINST THE CLOCK A STRANGER SCROLLS ON, which is
          // the only statement in the film whose timing is not an internal question. It takes
          // `HOOK.solo` even if a shot plan were ever to put the two-chip pair on beat zero: a
          // hook that arrives after the decision has been made is not evidence of anything.
          ...(index === 0
            ? { solo: HOOK.solo, settleBy: HOOK.settleBy }
            : { solo: index === evidenceBeat(script.id) ? SOLO.evidence : SOLO.normal }),
        },
      ];
    }
    // The last beat is one sentence in three clauses and the script has already broken it. Each
    // clause is its own statement over its own third, so the picture gets the three moments the
    // sentence contains while the voice runs through all three without stopping. That is the
    // three stutters the seventh script deleted by punctuation, kept as three pictures.
    const clause = clauseFrames(window, beat.lines.length);
    return beat.lines.map((line, i) => ({
      at: at + i * clause,
      window: clause,
      lines: [line],
      key: beat.key,
      solo: SOLO.clause,
    }));
  });

/** One clause's window inside the last beat, with the closing hold taken off the top. */
export const clauseFrames = (window: number, clauses: number): number =>
  Math.floor((window - CLOSING_HOLD) / clauses);

/**
 * The object's depth at a frame, as one number: 1 when it owns the frame, 0 when it has receded
 * behind a statement. Every direction drives every layer from this, so a beat cannot end up with
 * the card at one depth and its shadow at another.
 */
export const focusAt = (frame: number, statements: readonly Statement[]): number =>
  1 -
  statements.reduce((deepest, statement) => {
    const from = statement.at + statement.solo - RECEDE.lead;
    const down = ramp(frame, from, from + RECEDE.frames, 0, 1, EASE.cubicOut);
    const up = ramp(
      frame,
      statement.at + statement.window,
      statement.at + statement.window + 9,
      0,
      1,
      EASE.cubicOut,
    );
    return Math.max(deepest, Math.max(0, down - up));
  }, 0);
