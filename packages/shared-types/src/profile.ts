import { z } from "zod";
import { GENDERS, PLATFORMS, PLAYSTYLE_TAGS, REGIONS, SKILL_LEVELS } from "./enums";
import { isLolDivisionalTier, LOL_TIER_CHOICES } from "./lol-rank";

/** Zod schemas for the onboarding wizard — shared between client-side form validation
 * and (eventually) Edge Function input validation, so both sides agree on the rules. */

export const BIO_MAX_LENGTH = 300;
export const PROMPT_ANSWER_MAX_LENGTH = 150;
export const PROMPT_COUNT = 3;
/** Mirrors profile_games.rank_text_length in supabase/migrations/0049_input_constraints.sql. */
export const RANK_TEXT_MAX_LENGTH = 40;
/** Mirrors hidden_words.hidden_word_max_length in supabase/migrations/0049_input_constraints.sql. */
export const HIDDEN_WORD_MAX_LENGTH = 50;
/** Mirrors reports.report_details_length in supabase/migrations/0049_input_constraints.sql. */
export const REPORT_DETAILS_MAX_LENGTH = 1000;
export const MIN_AGE = 18;
/** Kept equal to MIN_AGE for now — the app is 18+ only. If a lower age band is
 * reintroduced later, this is the boundary same_age_band()/is_minor() in the matching
 * migrations use to keep minors and adults in separate pools (currently dormant since
 * MIN_AGE means is_minor() can never be true). */
export const ADULT_AGE = 18;

/**
 * The one shape a date of birth is allowed to arrive in: a calendar date with no clock on it,
 * which is what `profiles.dob` is (a Postgres `date`) and what the picker hands back through
 * `toIsoDate`. Anything carrying a time, a slash or a timezone is not a birthdate, it is a
 * timestamp somebody guessed at.
 */
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A real day on a real calendar, read as UTC midnight the way Postgres reads a `date`.
 *
 * The round trip is the part that matters: JS rolls 2025-02-31 forward to March 3 rather than
 * refusing it, so a string that does not serialize back to itself was never a date.
 */
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE_SHAPE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * DELIBERATELY IDENTICAL to `checkDob` in apps/mobile/src/features/auth/completeSignup.ts.
 * THE TWO MUST CHANGE TOGETHER.
 *
 * They are the app's two client-side age gates. This one backs `dobSchema` and runs before an
 * email sign-up; `checkDob` runs after a provider sign-in, where the account already exists and
 * `complete_signup` asks the same question. Somebody refused by one and accepted by the other is
 * a bug report nobody can reproduce, because whether it happens depends on which button they
 * tapped. So the logic here is the same logic, written the same way, on purpose. `checkDob`
 * keeps a two-value return because its screen has to say which of the two things went wrong;
 * here `dobSchema` splits that across two refinements instead.
 *
 * BOTH DATES ARE COMPARED AS CALENDAR DATES IN UTC, packed as YYYYMMDD so one integer
 * comparison orders them the way a calendar does. Month and day are each bounded well below
 * their place value, so the ordering is exact rather than close. This is what Postgres does on
 * the other side: `v_parsed_dob > (current_date - interval '18 years')::date` has no time of day
 * in it at all. Somebody whose birthday is today is exactly the cutoff and passes.
 *
 * The shorter version this replaced (copy `now`, `setUTCFullYear(year - MIN_AGE)`, compare
 * timestamps) is wrong one day every four years. February 29 has no counterpart to land on in a
 * non-leap year, so JS rolled the cutoff forward to March 1, and somebody born on March 1
 * eighteen years earlier, who is a day short, passed. Postgres clamps the other way
 * (`date '2028-02-29' - interval '18 years'` is 2010-02-28) and refuses them, so the floor
 * itself never moved: the screen just said yes where the server said no.
 *
 * `now` is a parameter rather than a read of the clock so the function stays pure and a test can
 * name the day it means, February 29 included, without moving global time.
 */
export function meetsMinAge(dob: string, now: Date = new Date()): boolean {
  if (!isCalendarDate(dob)) return false;

  const birth = new Date(`${dob}T00:00:00.000Z`);
  const born = birth.getUTCFullYear() * 10000 + (birth.getUTCMonth() + 1) * 100 + birth.getUTCDate();
  const cutoff = (now.getUTCFullYear() - MIN_AGE) * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();

  return born <= cutoff;
}

/**
 * Both refinements are wrapped rather than passed by reference: zod calls a refinement with one
 * argument today, and neither of these would want a second one if that ever changed.
 */
export const dobSchema = z
  .string()
  .refine((val) => isCalendarDate(val), { message: "Enter a valid date." })
  .refine((val) => meetsMinAge(val), { message: `You must be ${MIN_AGE} or older to use DuoQueue.` });

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(30, "Display name must be 30 characters or fewer.");

export const bioSchema = z.string().trim().max(BIO_MAX_LENGTH).optional().default("");

export const promptAnswerSchema = z.object({
  promptId: z.string().uuid(),
  answer: z.string().trim().min(1, "Answer can't be empty.").max(PROMPT_ANSWER_MAX_LENGTH),
});

export const discordUsernameSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^[a-z0-9._]{2,32}$/i, "Enter a valid Discord username.")
  .optional()
  .or(z.literal(""));

export const genderSchema = z.enum(GENDERS);
export const regionSchema = z.enum(REGIONS);
export const platformSchema = z.enum(PLATFORMS);
export const skillLevelSchema = z.enum(SKILL_LEVELS);
export const playstyleTagSchema = z.enum(PLAYSTYLE_TAGS);

/**
 * `lolTier` / `lolDivision` mirror profile_games.lol_tier_valid and
 * lol_division_matches_tier (0069_league_rank_duo.sql): a divisional tier needs a division
 * 1..4, and Unranked, Master, Grandmaster and Challenger take none. Parity only for now;
 * nothing server-side consumes this schema yet. "Only on the League row" is not expressible
 * here (it needs the catalog), and the sync trigger enforces it.
 */
export const profileGameInputSchema = z
  .object({
    gameId: z.string().uuid().optional(),
    customName: z.string().trim().min(1).max(80).optional(),
    skillLevel: skillLevelSchema,
    rankText: z.string().trim().max(RANK_TEXT_MAX_LENGTH).optional(),
    lolTier: z.enum(LOL_TIER_CHOICES).optional(),
    lolDivision: z.number().int().min(1).max(4).optional(),
    priority: z.number().int().min(0),
  })
  .superRefine((game, ctx) => {
    const ok =
      game.lolTier === undefined
        ? game.lolDivision === undefined
        : isLolDivisionalTier(game.lolTier)
          ? game.lolDivision !== undefined
          : game.lolDivision === undefined;
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lolDivision"],
        message: "Pick a division for your League rank, or tap the tier again to clear it.",
      });
    }
  });

export const profileShowInputSchema = z.object({
  showId: z.string().uuid().optional(),
  customName: z.string().trim().min(1).max(80).optional(),
  priority: z.number().int().min(0),
});

export const onboardingProfileSchema = z.object({
  displayName: displayNameSchema,
  dob: dobSchema,
  gender: genderSchema,
  region: regionSchema,
  timezone: z.string().min(1),
  languages: z.array(z.string().min(2).max(10)).min(1, "Select at least one language."),
  platforms: z.array(platformSchema).min(1, "Select at least one platform."),
  favoriteGames: z
    .array(profileGameInputSchema)
    .min(1, "Add at least one favorite game.")
    .max(20),
  favoriteShows: z.array(profileShowInputSchema).max(20).default([]),
  playstyles: z.array(playstyleTagSchema).max(6).default([]),
  bio: bioSchema,
  prompts: z.array(promptAnswerSchema).length(PROMPT_COUNT, `Answer exactly ${PROMPT_COUNT} prompts.`),
  discordUsername: discordUsernameSchema,
  profilePhotoPath: z.string().min(1, "Add a profile picture."),
  headerPhotoPath: z.string().min(1, "Add a header picture."),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type ProfileGameInput = z.infer<typeof profileGameInputSchema>;
export type ProfileShowInput = z.infer<typeof profileShowInputSchema>;
