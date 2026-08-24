/**
 * FOUR MORE SCRIPTS FOR THE SAME FILM, and the reason this is a new file rather than four more
 * beats in ./script.ts.
 *
 * =====================================================================================
 * WHAT IS ACTUALLY BEING TESTED
 * =====================================================================================
 *
 * The first reel went out on a cold account with no following and returned 116 views and 3
 * likes. That is a BASELINE, and the only variable in it worth moving is the one the reel does
 * not control by being good: the first 1.5 seconds. There is no follower graph carrying the
 * post, so the hook is the entire distribution strategy and the rest of the film is what a
 * viewer gets AFTER the hook has already worked.
 *
 * So this is not four rewrites of `PRO`. `PRO` is one angle - the nostalgia one, "your best
 * games were the ones you played with someone else" - and it is a claim about the viewer's
 * past. These four are four DIFFERENT reasons a person stops scrolling, and the test is which
 * reason works on a stranger. The visual system, the ground, the camera, the type treatment,
 * the read rate, the gap, the mix and the end card are all held fixed, because a comparison in
 * which two things changed measures neither of them.
 *
 *   pain       solo queue hands you four strangers and a coin flip
 *   mechanic   every card you see was scored before it was dealt
 *   objection  it looks like a dating app until you read a card
 *   hours      you play at midnight and everyone you know plays at eight
 *
 * =====================================================================================
 * THE FOUR RULES CARRIED OVER FROM THE SEVENTH SCRIPT, UNCHANGED
 * =====================================================================================
 *
 * SPEECH, NOT A LIST. Four connected conversational sentences with an arc, never six
 * fragments. The test is the one ./script.ts states: reorder the beats and the film breaks. It
 * does, in all four.
 *
 * NO NEGATION ANYWHERE IN THE READ. There is not one "not", "no", "never", "isn't", "don't",
 * "doesn't", "won't" or "can't" in any of the sixteen phrases below, and `pnpm validate`
 * asserts it. This survives even in `objection`, which is the script whose whole subject is a
 * thing the product is not: it concedes the resemblance and then spends every remaining word
 * on what the product IS, so the correction is carried by evidence rather than by denial. See
 * THE OBJECTION below for the arithmetic.
 *
 * NO EM DASHES, read or heard. Eighteen plus and platonic by construction.
 *
 * NOTHING ON SCREEN CONTRADICTS THE WORDS. Every clause names a thing that is in the fragment
 * set at the pixel level, and the two places where it is not are written down rather than
 * papered over; see WHERE THE PICTURE IS THIN at the foot of this file.
 *
 * =====================================================================================
 * THE LINE BREAKS ARE STILL THE LAYOUT
 * =====================================================================================
 *
 * `lines` joined by one space equals `phrase`, asserted. No line carries one word alone. No
 * line is longer than about twenty-one characters, which is the measurement ./script.ts made
 * against the 745px measure: `groupSize` may only SHRINK a group to fit, so every character
 * past twenty-one is size the film cannot afford. Every break falls at a grammatical joint.
 *
 * The longest line in this file is twenty-one characters and there are nine of them, which is
 * the fit being used to the edge rather than approached.
 */
import type { ProBeat, ProScript } from "./script";

/**
 * =====================================================================================
 * 1. THE PAIN
 * =====================================================================================
 *
 * THE WIDEST REACH OF THE FOUR, because the sentence is a thing every ranked player has
 * already thought and has probably never said out loud. "Four strangers and a coin flip" is
 * not a complaint about the game, it is a description of the format, and describing somebody's
 * format back to them accurately is the cheapest way to be believed.
 *
 * THE TURN ARRIVES AT BEAT TWO, which is the note. One pain beat out of four is an observation;
 * two is whining, and a film that spends half its length on how bad the viewer's night is has
 * spent that half asking them to feel worse rather than telling them anything. So beat one is
 * the only line about the problem and beat two answers it directly.
 *
 * BEAT TWO IS THE MOST HONEST LINE IN THE BATCH and that is why it is the strongest. A duo does
 * not delete the coin flip, it takes one of the four out of it, and "duoqueue is where you pick
 * one of the four" says exactly and only that. The modesty is the credibility: a stranger who
 * has queued a thousand games knows that an app cannot pick their whole team, and a claim
 * shaped to what they already know reads as true where a bigger one reads as an ad. The echo of
 * "four" across the seam is what ties the two beats into one argument rather than two lines.
 *
 * BEAT THREE IS EVIDENCE, NOT A FEATURE. "every card shows" is a statement about the pixels,
 * and the two things it names are the two chips the fragment set already isolates: the amber
 * `>> 3 GAMES IN COMMON` and `ROCKET LEAGUE . Ranked Grinder`. It pays back "pick" from beat
 * two, because a viewer who has just been told they get to pick will ask what they are picking
 * on, and this is the answer.
 *
 * WHY SOMEBODY STOPS. The first four words name the audience out loud. At 1.5 seconds the read
 * has said "solo queue hands you" and the frame is building the same words over a shot of an
 * empty map, so the hook is on both tracks at once and it is addressed to one specific person.
 */
const PAIN_BEATS: ProBeat[] = [
  {
    phrase: "solo queue hands you four strangers and a coin flip",
    lines: ["solo queue hands you", "four strangers", "and a coin flip"],
    key: "strangers",
    speed: 0.828,
  },
  {
    phrase: "duoqueue is where you pick one of the four",
    lines: ["duoqueue is where you", "pick one of the four"],
    key: "pick",
    speed: 0.68,
  },
  {
    phrase: "every card shows the games you share and how they play",
    lines: ["every card shows", "the games you share", "and how they play"],
    key: "share",
    speed: 0.779,
  },
  // The campaign's refrain, carried over from `PRO` verbatim and on purpose. Four reels on one
  // account that all land on the same three clauses is a signature rather than a repetition,
  // and it is also the only three seconds of the campaign that tells a stranger what to
  // physically do. It hits the phrase cache, so the read is byte-identical to the approved one.
  {
    phrase: "lock the duo, send a message, and go play",
    lines: ["lock the duo,", "send a message,", "and go play"],
    key: "play",
    speed: 0.793,
  },
];

/**
 * =====================================================================================
 * 2. THE MECHANIC
 * =====================================================================================
 *
 * THE ANGLE THAT ANSWERS THE REAL COMPETITOR WITHOUT NAMING IT. The thing DuoQueue is actually
 * up against is a looking-for-group channel, and nobody in this category ever says so. A
 * channel is a LIST: whoever posted most recently is at the top and the ordering carries no
 * information. Every line here is about the ordering carrying information, so the difference is
 * argued rather than asserted and the competitor is never mentioned.
 *
 * EVERY WORD OF IT IS LITERALLY TRUE OF `get_deck`. Checked against
 * supabase/migrations/0020_play_window_matching.sql and 0031_security_hardening.sql, the deck's
 * score is
 *
 *     shared games x10  +  skill match x2  +  shared shows x5  +  shared languages x2
 *     +  same region +3  +  least(play_window_overlap_hours(...), 6)  +  boost
 *     order by score desc
 *
 * so "scored before it was dealt" is the query, "shared games, shared hours, and how you both
 * play" names three of its terms, and "the card on top is the highest score" is the ORDER BY.
 * Naming three of six terms is a simplification and is not a false claim; claiming it were a
 * filter rather than a ranking would have been, which is why beat three says "the card on top"
 * and never says every card.
 *
 * THE VOCABULARY IS DELIBERATELY COLD. "Scored", "dealt", "highest score". This is the one reel
 * of the four whose job is to satisfy a sceptic, and a sceptic is reassured by arithmetic and
 * put off by warmth. The deck words also hold the whole film together: a deck deals cards, the
 * app deals cards, and the object on screen is a card.
 *
 * WHY SOMEBODY STOPS, AND WHY IT IS THE WEAKEST OF THE FOUR. It stops the person who has
 * already wondered how this could possibly work. That is a real and valuable person and there
 * are far fewer of them than there are people who have lost a game to a random. See THE
 * ARGUMENT AGAINST at the foot of this file, which is not hidden in a commit message because
 * the whole point of running four is knowing which one to stop running.
 */
const MECHANIC_BEATS: ProBeat[] = [
  {
    phrase: "every card you see was scored before it was dealt",
    lines: ["every card you see", "was scored before", "it was dealt"],
    key: "scored",
    speed: 0.744,
  },
  // Three clauses in one breath, the same shape `PRO` uses to land its last beat, moved to the
  // middle because here the three clauses are the payload rather than the exit. It stays ONE
  // statement rather than three: ../film.ts splits only the last beat into clauses, and a three
  // line stack on clean paper is exactly the reference's type beat.
  {
    phrase: "shared games, shared hours, and how you both play",
    lines: ["shared games,", "shared hours,", "and how you both play"],
    key: "hours",
    speed: 0.839,
  },
  {
    phrase: "so the card on top is the highest score",
    lines: ["so the card on top", "is the highest score"],
    key: "score",
    speed: 0.678,
  },
  {
    phrase: "lock the duo, send a message, and go play",
    lines: ["lock the duo,", "send a message,", "and go play"],
    key: "play",
    speed: 0.793,
  },
];

/**
 * =====================================================================================
 * 3. THE OBJECTION
 * =====================================================================================
 *
 * THE MOST SHAREABLE AND THE MOST DANGEROUS, and both for the same reason: the tension is the
 * hook. A swipe deck with photographs on it invites exactly one assumption, the app has already
 * been rejected once under guideline 2.3.6, and a film that pretends the assumption is not
 * being made looks like it is hiding something. Meeting it in the first five words is the
 * honest move and it is also the one that gets sent to a friend.
 *
 * THE FIFTH SCRIPT DIED OF THIS ANGLE AND THIS ONE DOES NOT REPEAT IT. That script was every
 * beat a negation and spent its whole length talking about the category it did not want to be
 * filed under, which is the failure Cameron named. The fix here is structural and it is
 * countable:
 *
 *     40 words in the read
 *      3 of them are about the category, all three in beat one   ("a dating app")
 *     37 of them say what the product IS
 *      0 negations anywhere, so `pnpm validate`'s negation rule passes UNMODIFIED
 *
 * IT NAMES IT WITHOUT DENYING IT, which is stronger than denying it. "It looks like a dating app
 * until you read a card" concedes the whole resemblance in six words and then makes the
 * correction a thing the viewer does themselves rather than a thing the film insists on. The
 * next three beats are the card, the purpose and the action, and every one of them is
 * evidenced: `>> 3 GAMES IN COMMON` and `ROCKET LEAGUE . Ranked Grinder` are on the card, and
 * "someone to queue with" is the whole product stated as a purpose.
 *
 * THE ACCENT IS ON "card", NEVER ON "dating". ../type.ts lights exactly one word per statement
 * and `key` names it, so the brand colour lands on the correction and the two words that carry
 * the risk are set in the same ink as "it looks like".
 *
 * THE ONE RULE THIS SCRIPT SUSPENDS, and it is suspended narrowly and asserted rather than
 * commented. `checkPro` errors on any beat matching /dating|hookup|romantic|.../ because for
 * `PRO` the strongest thing to do with the category is never to mention it. This film exists to
 * mention it. So scripts/validate-content.ts permits the words in EXACTLY ONE beat of EXACTLY
 * this script, requires that beat to be the first, and still errors on the other three - which
 * is what stops a later edit from turning this back into the fifth script one line at a time.
 *
 * THE RISK, WRITTEN DOWN. The words "a dating app" will be on screen at group size for about a
 * second, and a single frame of that screenshotted out of context is the worst asset in this
 * campaign. It is mitigated three ways and none of them removes it: the line is one continuous
 * statement whose last line is the correction, the accent is on "card", and the caption carries
 * "18+ and platonic" in the first line rather than at the bottom. If Cameron wants that
 * frame not to exist, this is the script to cut, and cutting it costs the batch its most
 * shareable angle.
 */
const OBJECTION_BEATS: ProBeat[] = [
  {
    phrase: "it looks like a dating app until you read a card",
    lines: ["it looks like", "a dating app", "until you read a card"],
    key: "card",
    speed: 0.686,
  },
  {
    phrase: "the card says three games in common and how they play",
    lines: ["the card says", "three games in common", "and how they play"],
    key: "common",
    speed: 0.779,
  },
  {
    phrase: "it exists so you have someone to queue with",
    lines: ["it exists so you have", "someone to queue with"],
    key: "queue",
    speed: 0.702,
  },
  // The refrain, with the last clause swapped for the one that lands furthest from the
  // category. "go get a game in" is what a player would actually say and the picture under it
  // is `frag-play`, which is the only shot in the film that is outside the app.
  {
    phrase: "lock the duo, send a message, go get a game in",
    lines: ["lock the duo,", "send a message,", "go get a game in"],
    key: "game",
    speed: 0.694,
  },
];

/**
 * =====================================================================================
 * 4. THE HOURS
 * =====================================================================================
 *
 * THE PROBLEM NOBODY IN THE CATEGORY TALKS ABOUT, and the reason it is worth a whole reel is
 * that it is unglamorous. "Find people who play your games" is what every competitor says.
 * "Find people who are awake" is what nobody says, and it is the thing that actually stops a
 * person playing: not an absence of friends, a mismatch of windows.
 *
 * BEAT ONE IS A MISMATCH RATHER THAN AN ABSENCE, and that is the whole craft of it. "Nobody is
 * online" is a lonely sentence and also a negation. "You play at midnight and everyone you know
 * plays at eight" is the same fact stated as an arithmetic problem, it costs no negation, and it
 * is a sharper hook because the two numbers do the work. It also self-selects hard, which on a
 * cold account is a feature: the people it does not describe were never going to convert and
 * the people it does will feel seen in four words.
 *
 * BEAT TWO USES THE PRODUCT'S OWN VERB. `play_window_overlap_hours` is a real function in
 * 0020_play_window_matching.sql, it returns a count of overlapping hours, and `get_deck` adds
 * it to the score capped at six. So "counts the hours you overlap" is not a metaphor for the
 * matching, it is a description of it, and it is the shortest phrase in the batch at six words
 * because a mechanism stated briefly reads as a fact and a mechanism stated at length reads as
 * a pitch.
 *
 * BEAT THREE IS THE PAYOFF AND IT IS HEDGED CORRECTLY. Overlap is a ranking term, not a filter,
 * so the honest sentence is about the TOP of the deck and never about the deck. "Awake when you
 * are" resolves beat one's eight o'clock without ever saying the word midnight twice.
 *
 * BEAT FOUR IS THE ONE PLACE IN THE BATCH WHERE THE WORDS QUOTE THE FOOTAGE. `frag-dark-bubble`
 * is the app's own sent message and it reads "Hey you on tn?". "Ask if they are on" is that
 * message described, so the clause and the pixels under it are the same sentence twice.
 *
 * WHY SOMEBODY STOPS. Two numbers and a contradiction, in eight words, addressed to a person
 * who has closed the app at half past midnight and gone to bed.
 */
const HOURS_BEATS: ProBeat[] = [
  {
    phrase: "you play at midnight and everyone you know plays at eight",
    lines: ["you play at midnight", "and everyone you know", "plays at eight"],
    key: "midnight",
    speed: 0.733,
  },
  {
    phrase: "duoqueue counts the hours you overlap",
    lines: ["duoqueue counts", "the hours you overlap"],
    key: "overlap",
    speed: 0.884,
  },
  {
    phrase: "the top of your deck is awake when you are",
    lines: ["the top of your deck", "is awake when you are"],
    key: "awake",
    speed: 0.618,
  },
  {
    phrase: "lock the duo, ask if they are on, and go play",
    lines: ["lock the duo,", "ask if they are on,", "and go play"],
    key: "play",
    speed: 0.702,
  },
];

/**
 * The four, in the order they should be posted.
 *
 * `pain` first because it has the widest reach and the batch needs a number to compare against
 * the 116 before anything else is learned. `hours` second because it is the most self-selecting
 * and therefore the cleanest read on whether the account is reaching gamers at all. `objection`
 * third, once there is a follower or two to absorb it. `mechanic` last, and see THE ARGUMENT
 * AGAINST for why it may never need to go out at all.
 *
 * The ids are angles rather than numbers because a file called `reel-pain.mp4` and a mix called
 * `pro-003.wav` are the same asset with two names, and the last three directions all lost a
 * morning to somebody working out which was which.
 */
export const ANGLES: ProScript[] = [
  {
    id: "pro-pain",
    caption:
      "solo queue hands you four strangers and a coin flip. duoqueue is where you pick one of the four. 18+ and platonic. join the waitlist at duoqueue.io",
    beats: PAIN_BEATS,
  },
  {
    id: "pro-mechanic",
    caption:
      "every card in your deck is scored on shared games, shared hours and how you both play, and the highest score is the one on top. 18+ and platonic. join the waitlist at duoqueue.io",
    beats: MECHANIC_BEATS,
  },
  {
    id: "pro-objection",
    caption:
      "18+ and platonic. it looks like a dating app until you read a card: three games in common, how they play, and someone to queue with. join the waitlist at duoqueue.io",
    beats: OBJECTION_BEATS,
  },
  {
    id: "pro-hours",
    caption:
      "you play at midnight and everyone you know plays at eight. duoqueue counts the hours you overlap. 18+ and platonic. join the waitlist at duoqueue.io",
    beats: HOURS_BEATS,
  },
];

export const angleById = (id: string): ProScript | undefined =>
  ANGLES.find((script) => script.id === id);

/**
 * THE ONE TABLE THAT TIES A SCRIPT ID TO A COMPOSITION ID TO A FILENAME.
 *
 * `pro-pain` is the mix and the beat table, `Reel-Pain` is the composition Studio and the renderer
 * ask for, and `reel-pain.mp4` is the file that goes up. Three names for one asset is exactly how
 * the last three directions each lost a morning to somebody working out which was which, so they
 * are derived from each other here rather than typed in three places.
 *
 * It lives in this file and not in ./register.tsx because a render script has to read it, and
 * ./register.tsx pulls in every component in the direction, `@/lib/fonts` among them, which opens
 * a `delayRender` handle the moment it is imported. That is correct in a browser bundle and has
 * no business happening inside a node script.
 */
const COMPOSITION: Record<string, string> = {
  "pro-pain": "Reel-Pain",
  "pro-mechanic": "Reel-Mechanic",
  "pro-objection": "Reel-Objection",
  "pro-hours": "Reel-Hours",
};

/** The composition a script is registered under. */
export const compositionFor = (scriptId: string): string => COMPOSITION[scriptId] ?? scriptId;

/** The basename the finished file takes, without an extension. */
export const fileFor = (scriptId: string): string => scriptId.replace(/^pro-/, "reel-");

/**
 * =====================================================================================
 * WHAT EACH SCRIPT NEEDS OUT OF THE FRAGMENT SET
 * =====================================================================================
 *
 * Every name below is a key of FRAGMENTS in ../media.tsx, which resolves to a `ClipName` in
 * src/data/clips.ts and a file in public/footage. All of them exist today; the two gaps are
 * about what a fragment SHOWS rather than about whether it is there.
 *
 *   pain       play, card, games, role, locked, send, play
 *   mechanic   screen, card, games, role, locked, send, play
 *   objection  card, games, role, locked, send, play
 *   hours      play, card, bubble, locked, send, play
 *
 * `card` is `frag-*-card-top`, the crop that stops above Kofi's prompt sentence. It stays the
 * crop these films use in all four scripts, and in `pain` it is load bearing for a new reason:
 * the prompt reads "Hit Grand Champion in Rocket League SOLO QUEUE. Took two years. Worth it.",
 * and a film whose first line calls solo queue a coin flip must not put a man's solo queue
 * Grand Champion on screen underneath it. `frag-*-card-lower` and `frag-*-prompt` are unusable
 * in this batch for the same reason they are unusable in `PRO`, and in `pain` they would not
 * merely be unhelpful, they would argue back.
 *
 * =====================================================================================
 * WHERE THE PICTURE IS THIN, and neither of these is fixed by a rewrite
 * =====================================================================================
 *
 * "SHARED HOURS" HAS NO CHIP. The play window is a real column, a real function and a real term
 * in the deck's score, and the app renders it through MetaLine on the profile detail sheet. It
 * is NOT on the deck card, and none of the four source recordings ever opened a profile detail
 * sheet, so there is no crop of it in public/footage. Both `mechanic` and `hours` therefore
 * say "hours" over clean paper rather than over evidence. That contradicts nothing: the object
 * has already receded to zero by the time a statement is on screen, so the reference's own type
 * beat is a line on empty ground and this is exactly that. But it is the one claim in the batch
 * with no picture behind it anywhere, and the fix is thirty seconds of new recording: open any
 * card's detail sheet and hold on the meta line long enough to crop it. That would give the two
 * strongest mechanism reels their missing chip and it is the highest value footage this campaign
 * could shoot next.
 *
 * `pain` WANTS A LOSS AND THE SET ONLY HAS QUIET. `frag-play` is 1.9 seconds of daylight on
 * Breeze cut out of `broll-quiet`, and every edge of that rectangle is a redaction: the source
 * is a spectator capture whose full frame prints real gamertags in the killfeed. `broll-loss`
 * and `broll-teamfight` are cut and present in public/footage, and both are FULL FRAME, so
 * neither can be published as it stands. So the pain beat opens on an empty map rather than on
 * a defeat screen, which is a weaker picture and an honest one. A redacted crop of `broll-loss`
 * on the same terms as `frag-play`, taken inside a window with no nameplates and no killfeed,
 * is one ffmpeg line and would be worth having before this reel is rendered.
 *
 * `frag-play` IS 57 FRAMES AND A BEAT IS ABOUT 130. `Fragment` freezes on the last frame it has
 * rather than running out, and the plate that carries it has a slow scale push over the whole
 * beat, so a held gameplay still keeps moving. `PRO` already does this at both ends of its film.
 * It is recorded here because "the clip is shorter than the beat" looks like a bug in a review
 * and is not one.
 *
 * =====================================================================================
 * THE ARGUMENT AGAINST, and it is against `mechanic`
 * =====================================================================================
 *
 * `mechanic` is the weakest of the four and it is worth saying exactly why rather than shipping
 * four hooks that are all equally hedged.
 *
 * ITS HOOK IS ABOUT A SYSTEM AND NOT ABOUT A PERSON. "Every card you see was scored before it
 * was dealt" has no person in it, no stakes, and nothing that happened to the viewer. The other
 * three all open on the viewer's own life: a game they lost, an assumption they already made,
 * an hour they are awake at. On a cold account the first 1.5 seconds is the whole distribution
 * strategy, and a system is a worse thing to lead with than a feeling in the one second where
 * the decision is made.
 *
 * IT INVITES A WORSE SECOND QUESTION. "Scored" is a word that makes a sceptic ask what the score
 * is computed from and what the app therefore knows about them, and answering that is a
 * different and much longer film. The other three end on an action; this one ends on an
 * explanation.
 *
 * IT IS A SECOND TOUCH ASSET WEARING A FIRST TOUCH SHAPE. The person it is written for is the
 * person who is already curious, and that person is reached by a pinned post or a profile, not
 * by a cold scroll. Posting it fourth and pinning it is probably worth more than posting it at
 * all.
 *
 * IF IT IS RUN, THE HOOK TO RUN AGAINST IT is the output rather than the process: "the first
 * card you see already plays your games at your hours". That is the same claim with a person in
 * it and it is one line away. It is not the version written above because it collides head on
 * with `hours`, and two reels in a four reel batch competing for the same hook measures nothing.
 *
 * =====================================================================================
 * THE READ
 * =====================================================================================
 *
 * SOLVED PER PHRASE AGAINST THAT PHRASE'S OWN TWO POINT FIT, which is the method ./script.ts
 * arrived at and the only one that has produced an EVEN read. Nothing below was predicted;
 * `pnpm video:audio --only <id>` measured every number with ffprobe and the committed table in
 * src/audio/timings.generated.ts is where they live.
 *
 * PASS ONE, all sixteen phrases at the film's own plan rate of 0.9, written words per minute:
 *
 *   pain       178 / 218 / 209 / 199        objection   236 / 210 / 226 / 229
 *   mechanic   210 / 178 / 228 / 199        hours       206 / 144 / 265 / 229
 *
 * The whole batch is fast, which is the same result ./script.ts got and for the same reason:
 * every phrase here is a complete sentence and Kokoro reads a sentence at conversational speed.
 * 265 wpm on `hours` beat three is the fastest thing measured anywhere in this project. The one
 * value UNDER the band, `hours` beat two at 144, is the shortest phrase in the file and it had
 * to be sped UP rather than slowed, which is the proof that a plan level rate could not have
 * fixed this batch: two of the sixteen phrases needed correcting in opposite directions.
 *
 * PASS TWO, a second measured point per phrase, taken at a rate predicted from a single exponent
 * of 1.25. Fitting each phrase's own exponent to what it actually traced between the two passes
 * gives 0.91 to 1.69, and the spread is the finding: there is no one exponent, because a
 * phrase's head and tail silence does not scale with the rate and the share of a phrase that is
 * silence differs per phrase. ./script.ts measured 0.89 to 1.54 on four phrases; sixteen widen
 * that range rather than settle it.
 *
 * PASS THREE, solved per phrase on its own two point fit against a target of 165 words a minute
 * on the SPOKEN count. This is the delivered read, and the whole batch is inside the broadcast
 * band of 150 to 170:
 *
 *   film        beat  words  speed  duration  wpm     spoken wpm
 *   pain        1     10     0.828  3.712s    162     162
 *               2      9     0.68   3.413s    158     176   (Kokoro says ten: "duo queue")
 *               3     11     0.779  4.181s    158     158
 *               4      9     0.793  3.221s    168     168
 *   mechanic    1     10     0.744  3.648s    164     164
 *               2      9     0.839  3.264s    165     165
 *               3      9     0.678  3.286s    164     164
 *               4      9     0.793  3.222s    168     168
 *   objection   1     11     0.686  3.904s    169     169
 *               2     11     0.779  4.181s    158     158
 *               3      9     0.702  3.242s    167     167
 *               4     11     0.694  4.011s    165     165
 *   hours       1     11     0.733  3.989s    165     165
 *               2      6     0.884  2.539s    142     165   (Kokoro says seven: "duo queue")
 *               3     10     0.618  3.648s    164     164
 *               4     11     0.702  3.925s    168     168
 *
 * THE SPREAD IS 11 WPM ACROSS SIXTEEN PHRASES on the spoken count, 158 to 169, against `PRO`'s
 * 18 across four. The aggregates are 161 / 165 / 164 / 162 written and 165 / 165 / 164 / 166
 * spoken. THE TARGET IS THE SPOKEN COUNT rather than the written one because the spoken count is
 * what is actually in the WAV: the three phrases containing "duoqueue" are said as one word more
 * than the frame shows, and solving those on the written count is what would have made the two
 * brand beats the fastest lines in their own films.
 *
 * THE GAPS measured 0.566 to 0.567s, which is PRO_GAP_FRAMES exactly, twelve times.
 *
 * THE MIX measured -14.6 to -14.7 LUFS integrated, -1.8 to -1.9 dBTP, LRA 2.0 to 2.5.
 *
 * TWO FILMS SHARE A PHRASE AND THEREFORE SHARE ITS WAV. `pain` and `mechanic` end on the same
 * clause at the same rate, so they are one cache entry and the refrain is sample-identical in
 * both. That is the intent: a refrain that is re-synthesised is a different performance, and
 * four reels landing on four slightly different readings of the same three clauses is the kind
 * of drift nobody can name and everybody hears.
 *
 * =====================================================================================
 * THE DERIVED BEAT TABLES
 * =====================================================================================
 *
 * Computed by ./timing.ts from the measured read. Not typed in, and every one of them changes
 * by itself the next time a word does.
 *
 *   pain        beat  start          length          phrase      lead  slack
 *               1       0f   0.000s  128f  4.267s      6-117f      6f    11f
 *               2     128f   4.267s  120f  4.000s    134-237f      6f    11f
 *               3     248f   8.267s  142f  4.733s    254-379f      6f    11f
 *               4     390f  13.000s  121f  4.033s    396-493f      6f    18f
 *               end   511f  17.033s   45f  1.500s
 *               total 556f  18.533s
 *
 *   mechanic    1       0f   0.000s  126f  4.200s      6-115f      6f    11f
 *               2     126f   4.200s  115f  3.833s    132-230f      6f    11f
 *               3     241f   8.033s  116f  3.867s    247-346f      6f    11f
 *               4     357f  11.900s  121f  4.033s    363-460f      6f    18f
 *               end   478f  15.933s   45f  1.500s
 *               total 523f  17.433s
 *
 *   objection   1       0f   0.000s  134f  4.467s      6-123f      6f    11f
 *               2     134f   4.467s  143f  4.767s    140-266f      6f    11f
 *               3     277f   9.233s  114f  3.800s    283-380f      6f    11f
 *               4     391f  13.033s  144f  4.800s    397-517f      6f    18f
 *               end   535f  17.833s   45f  1.500s
 *               total 580f  19.333s
 *
 *   hours       1       0f   0.000s  137f  4.567s      6-126f      6f    11f
 *               2     137f   4.567s   93f  3.100s    143-219f      6f    11f
 *               3     230f   7.667s  126f  4.200s    236-345f      6f    11f
 *               4     356f  11.867s  142f  4.733s    362-480f      6f    18f
 *               end   498f  16.600s   45f  1.500s
 *               total 543f  18.100s
 *
 * THE LEAD IS 6 FRAMES AT EVERY ONE OF THE SIXTEEN CUTS, so it is flat by construction and
 * cannot accumulate, and every phrase finishes inside its own beat with at least 11 frames to
 * spare, so no line is ever heard over the next beat's picture. `pnpm validate` asserts both.
 *
 * EVERY FILM IS INSIDE THE FIFTEEN TO TWENTY SECOND WINDOW: 17.4, 18.1, 18.5 and 19.3. `mix`
 * equals `film` on all four, which is the assertion in checkProScript and the thing that stays
 * false until the audio has been built twice; see the header of ./timing.ts for why twice.
 *
 * WHAT A DIRECTION HAS TO DO WITH THIS. Four beats of 3.1 to 4.8s is NOT four shots. Each spoken
 * beat is a CONTAINER for two to four visual events joined by content morphs and continuous
 * transforms rather than by cuts, and the last beat of every film is already broken into its
 * three clauses by `lines`, which ./film.ts turns into three statements of 34 to 41 frames each.
 * `mechanic` beat two is the one three clause stack that is NOT a last beat, so it stays one
 * statement on clean paper rather than three, which is the reference's own type beat.
 */
