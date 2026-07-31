/**
 * Seeds ~50 fake profiles (with games, shows, platforms, languages, playstyles, and
 * placeholder media) for local dev/testing against a Supabase project.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (never the anon key — this script
 * uses the Auth admin API and bypasses RLS on purpose). Run with:
 *   pnpm seed:profiles
 */
import "dotenv/config";
import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import {
  GENDERS,
  LANGUAGE_CODES,
  PLATFORMS,
  PLAYSTYLE_TAGS,
  REGIONS,
  SKILL_LEVELS,
} from "@duoqueue/shared-types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROFILE_COUNT = Number(process.env.SEED_PROFILE_COUNT ?? 50);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment. Copy .env.example " +
      "to .env, fill in your project's service role key, and re-run (never commit that key).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sample<T>(items: readonly T[], count: number): T[] {
  return faker.helpers.arrayElements(items, { min: 1, max: Math.min(count, items.length) });
}

async function fetchCatalog(table: "games" | "shows", limit: number) {
  const { data, error } = await supabase.from(table).select("id, name").limit(limit);
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(`No rows in public.${table} — run \`supabase db reset\` (applies seed.sql) first.`);
  }
  return data;
}

async function createFakeProfile(games: { id: string }[], shows: { id: string }[], index: number) {
  const displayName = faker.person.firstName();
  const email = `duoqueue.seed.${index}.${faker.string.alphanumeric(6).toLowerCase()}@example.com`;
  const dob = faker.date.birthdate({ min: 18, max: 45, mode: "age" });
  const region = faker.helpers.arrayElement(REGIONS);
  const timezone = faker.location.timeZone();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: faker.internet.password({ length: 16 }),
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError || !created.user) {
    throw new Error(`createUser failed for ${email}: ${createError?.message}`);
  }
  const profileId = created.user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      dob: dob.toISOString().slice(0, 10),
      gender: faker.helpers.arrayElement(GENDERS),
      region,
      timezone,
      bio: faker.lorem.sentence({ min: 8, max: 20 }).slice(0, 300),
      discord_username: faker.internet.username().toLowerCase().slice(0, 32),
      onboarding_completed: true,
      is_active: true,
      last_active_at: faker.date.recent({ days: 14 }).toISOString(),
    })
    .eq("id", profileId);
  if (profileError) throw new Error(`profile update failed for ${email}: ${profileError.message}`);

  const platformRows = sample(PLATFORMS, 3).map((platform) => ({ profile_id: profileId, platform }));
  const languageRows = sample(LANGUAGE_CODES, 2).map((language_code) => ({
    profile_id: profileId,
    language_code,
  }));
  const playstyleRows = sample(PLAYSTYLE_TAGS, 3).map((tag) => ({ profile_id: profileId, tag }));

  const chosenGames = sample(games, 6);
  const gameRows = chosenGames.map((game, i) => ({
    profile_id: profileId,
    game_id: game.id,
    skill_level: faker.helpers.arrayElement(SKILL_LEVELS),
    rank_text: faker.datatype.boolean() ? faker.helpers.arrayElement(["Diamond II", "Gold III", "Immortal", "Ascendant I", null]) : null,
    priority: i,
  }));

  const chosenShows = sample(shows, 5);
  const showRows = chosenShows.map((show, i) => ({ profile_id: profileId, show_id: show.id, priority: i }));

  const mediaRows = (["profile", "header"] as const).map((photo_role) => ({
    profile_id: profileId,
    // Must live under the owning profile's folder: profile_media has a CHECK tying
    // storage_path to profile_id, and the storage read policy re-checks the same
    // convention (0031_security_hardening.sql).
    storage_path: `${profileId}/${photo_role}.jpg`,
    photo_role,
    moderation_status: "approved" as const,
  }));

  const inserts = await Promise.all([
    supabase.from("profile_platforms").insert(platformRows),
    supabase.from("profile_languages").insert(languageRows),
    supabase.from("profile_playstyles").insert(playstyleRows),
    supabase.from("profile_games").insert(gameRows),
    supabase.from("profile_shows").insert(showRows),
    supabase.from("profile_media").insert(mediaRows),
  ]);
  for (const { error } of inserts) {
    if (error) throw new Error(`profile-tree insert failed for ${email}: ${error.message}`);
  }

  return displayName;
}

async function main() {
  console.log(`Loading game/show catalogs...`);
  const [games, shows] = await Promise.all([fetchCatalog("games", 200), fetchCatalog("shows", 100)]);

  console.log(`Seeding ${PROFILE_COUNT} fake profiles...`);
  for (let i = 0; i < PROFILE_COUNT; i++) {
    const name = await createFakeProfile(games, shows, i);
    console.log(`  [${i + 1}/${PROFILE_COUNT}] created ${name}`);
  }
  console.log("Done.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
