import { displayNameSchema } from "@duoqueue/shared-types";

/**
 * Turning Apple's name components into something `complete_signup` will accept.
 *
 * ============================================================================
 * WHY THIS IS ITS OWN FILE
 * ============================================================================
 *
 * Two reasons, and the second is the real one.
 *
 * `credential.fullName` is a structured object, not a string: six nullable fields, any subset
 * of which Apple may hand back, and the user is free to edit every one of them on the consent
 * sheet before we ever see it. `displayNameSchema` has a floor of 2 and a ceiling of 30. So
 * there is an actual decision between the two, and a decision that can be wrong deserves to be
 * exercised without a device attached.
 *
 * Which is the second reason: `appleSignIn.ts` imports `expo-apple-authentication` and the
 * Supabase client, and `pendingDisplayName.ts` imports AsyncStorage. None of those load under
 * the vitest runner. This module imports nothing but the schema, so the composition rules can
 * be tested for real rather than trusted.
 */

/**
 * `AppleAuthenticationFullName`, restated structurally.
 *
 * Deliberately not imported from `expo-apple-authentication`: a type-only import would be
 * erased at build time anyway, but stating the shape here is what lets a test construct one
 * without the native module in the tree. Every field is optional as well as nullable so the
 * real type — where all six are present and `string | null` — is assignable to it, and so is a
 * hand-rolled partial in a test.
 */
export interface AppleFullNameParts {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  nickname?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
}

/**
 * The best display name Apple's components can support, or null.
 *
 * NULL IS THE ORDINARY ANSWER, not the failure. Apple returns `fullName` on the FIRST
 * authorization for a given Apple ID and never again, so every returning user lands here with
 * nothing, and a user who tapped the name field on the consent sheet and cleared it lands here
 * with nothing on their first time too. What a null costs is one empty field on the onboarding
 * wizard's first step, which asks for a display name regardless. It cannot cost a flow. When
 * there IS a name, `complete_signup` stores it on the profile and that step prefills from the
 * profile (see `displayNameSeed`), so the user confirms it rather than being asked again.
 *
 * THE CANDIDATE CHAIN, first one that validates wins:
 *
 *   1. given name alone. What other players would call you across a lobby.
 *   2. nickname. Rarely populated, but it is a display name by definition when it is.
 *
 * THE FAMILY NAME IS NEVER USED, and that is the decision this function exists to make. The
 * value becomes a handle every stranger in the deck sees, and the user never typed it: it is
 * whatever their Apple ID says, carried through the age gate and prefilled on the wizard's first
 * step. Given + family, the first choice this used to make, put a full legal name forward as a
 * public handle by default, with the only defence being that somebody notices and edits it on a
 * screen that is mostly about photos. A first name is a friendly default; a first and last name
 * is a doxxing default. Anybody who wants their surname shown can type it.
 *
 * Middle name, prefix and suffix are dropped for the same reason. "Dr." and "Jr." belong on a
 * legal name, and this value is a prefill for a handle other players see.
 *
 * A candidate that fails the schema is discarded rather than sent. `complete_signup` would
 * reject an over-long name and the whole age gate would fail with it, which would mean a user
 * whose only mistake was having a long name could not create an account at all. The floor of 2
 * matters less but works the same way: a single-initial `givenName` is not a display name.
 */
export function composeAppleDisplayName(fullName: AppleFullNameParts | null | undefined): string | null {
  if (!fullName) return null;

  const candidates = [normalizeWhitespace(fullName.givenName), normalizeWhitespace(fullName.nickname)];

  for (const candidate of candidates) {
    if (!candidate) continue;
    // `.trim()` is already in the schema, so `parsed.data` is the exact string to store and
    // send. Reading it back rather than reusing the candidate keeps one source of truth for
    // what "valid" means, which is the point of validating against the shared schema at all.
    const parsed = displayNameSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }

  return null;
}

/**
 * Collapses every run of whitespace to a single space and trims.
 *
 * Not cosmetic. These strings are typed by hand into Apple's sheet, they can arrive padded, and
 * a newline pasted into the field would otherwise be carried all the way into a display name.
 * `\s` covers the tab and the newline as well as the space.
 */
function normalizeWhitespace(part: string | null | undefined): string {
  return typeof part === "string" ? part.replace(/\s+/g, " ").trim() : "";
}
