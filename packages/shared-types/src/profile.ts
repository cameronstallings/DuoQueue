import { z } from "zod";
import { GENDERS, PLATFORMS, PLAYSTYLE_TAGS, REGIONS, SKILL_LEVELS } from "./enums";

/** Zod schemas for the onboarding wizard — shared between client-side form validation
 * and (eventually) Edge Function input validation, so both sides agree on the rules. */

export const BIO_MAX_LENGTH = 300;
export const MAX_PROFILE_PHOTOS = 6;
export const MIN_AGE = 18;

function isAtLeast18(dob: string): boolean {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return false;
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - MIN_AGE);
  return birthDate.getTime() <= cutoff.getTime();
}

export const dobSchema = z
  .string()
  .refine((val) => !Number.isNaN(new Date(val).getTime()), { message: "Enter a valid date." })
  .refine(isAtLeast18, { message: "You must be 18 or older to use DuoQueue." });

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters.")
  .max(30, "Display name must be 30 characters or fewer.");

export const bioSchema = z.string().trim().max(BIO_MAX_LENGTH).optional().default("");

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

export const profileGameInputSchema = z.object({
  gameId: z.string().uuid().optional(),
  customName: z.string().trim().min(1).max(80).optional(),
  skillLevel: skillLevelSchema,
  rankText: z.string().trim().max(40).optional(),
  priority: z.number().int().min(0),
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
  discordUsername: discordUsernameSchema,
  photoPaths: z.array(z.string()).min(1, "Add at least one photo.").max(MAX_PROFILE_PHOTOS),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type ProfileGameInput = z.infer<typeof profileGameInputSchema>;
export type ProfileShowInput = z.infer<typeof profileShowInputSchema>;
