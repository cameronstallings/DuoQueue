import { LANGUAGE_CODES, type LanguageCode, type Region } from "@duoqueue/shared-types";

/**
 * The two answers the phone can already give before the player is asked: where they play from
 * (their time zone) and which languages they speak (their locales). Used once, on "Build my
 * card", to prefill the region and languages steps; both stay editable, and a choice the player
 * already made is never overwritten (the store's `prefillFromDevice`).
 *
 * Pure, with no expo import: the caller passes `Localization.getCalendars()[0]?.timeZone` and
 * `Localization.getLocales()`, so every zone below is pinned in localePrefill.test.ts.
 *
 * MIRRORS `server_group` (0071): na_east and na_west are one group server side, so East or West
 * only decides the label on the card, and a guess on the wrong side of the line costs nothing.
 * Getting NA vs not-NA right is what matters, because that is what the deck orders by and what
 * the Duo Pop rule requires.
 *
 * WHEN IT DOES NOT KNOW, IT SAYS NULL. Mexico, Central America, the Caribbean, Turkey, UTC and
 * anything unrecognised leave the region empty for the player to pick (open question Q7): a
 * confident wrong guess is worse than one tap.
 */

const NA_WEST_AMERICA = new Set([
  "Los_Angeles",
  "Vancouver",
  "Tijuana",
  "Whitehorse",
  "Dawson",
  "Dawson_Creek",
  "Fort_Nelson",
  "Creston",
  "Denver",
  "Boise",
  "Edmonton",
  "Phoenix",
  "Yellowknife",
  "Inuvik",
  "Anchorage",
  "Juneau",
  "Sitka",
  "Yakutat",
  "Nome",
  "Metlakatla",
  "Adak",
  // Old names the tz database still ships as links.
  "Shiprock",
  "Atka",
]);

const NA_EAST_AMERICA = new Set([
  "New_York",
  "Chicago",
  "Detroit",
  "Toronto",
  "Montreal",
  "Halifax",
  "St_Johns",
  "Winnipeg",
  "Regina",
  "Menominee",
  "Moncton",
  "Glace_Bay",
  "Goose_Bay",
  "Iqaluit",
  "Pangnirtung",
  "Rankin_Inlet",
  "Resolute",
  "Cambridge_Bay",
  "Swift_Current",
  "Nipigon",
  "Thunder_Bay",
  "Rainy_River",
  "Atikokan",
  "Coral_Harbour",
  "Blanc-Sablon",
  // Old names the tz database still ships as links.
  "Indianapolis",
  "Fort_Wayne",
  "Knox_IN",
  "Louisville",
]);

const NA_EAST_AMERICA_PREFIXES = ["Indiana/", "Kentucky/", "North_Dakota/"];

/** US/* and Canada/* aliases on the western side; every other US/* and Canada/* one is East. */
const NA_WEST_ALIASES = new Set([
  "US/Pacific",
  "US/Pacific-New",
  "US/Mountain",
  "US/Arizona",
  "US/Alaska",
  "US/Aleutian",
  "US/Hawaii",
  "Canada/Pacific",
  "Canada/Mountain",
  "Canada/Yukon",
]);

const SA_AMERICA = new Set([
  "Sao_Paulo",
  "Buenos_Aires",
  "Catamarca",
  "Cordoba",
  "Jujuy",
  "Mendoza",
  "Rosario",
  "Santiago",
  "Lima",
  "Bogota",
  "Caracas",
  "Montevideo",
  "Asuncion",
  "La_Paz",
  "Guayaquil",
  "Fortaleza",
  "Recife",
  "Bahia",
  "Belem",
  "Manaus",
  "Cuiaba",
  "Campo_Grande",
  "Porto_Velho",
  "Boa_Vista",
  "Rio_Branco",
  "Maceio",
  "Araguaina",
  "Santarem",
  "Noronha",
  "Paramaribo",
  "Cayenne",
  "Guyana",
  "Punta_Arenas",
]);

const MENA_AFRICA = new Set(["Cairo", "Casablanca", "Algiers", "Tunis", "Tripoli", "El_Aaiun"]);

const MENA_ASIA = new Set([
  "Dubai",
  "Riyadh",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Baghdad",
  "Tehran",
  "Amman",
  "Beirut",
  "Damascus",
  "Jerusalem",
  "Tel_Aviv",
  "Gaza",
  "Hebron",
  "Muscat",
  "Aden",
  "Nicosia",
]);

const SEA_ASIA = new Set([
  "Singapore",
  "Kuala_Lumpur",
  "Kuching",
  "Jakarta",
  "Pontianak",
  "Makassar",
  "Jayapura",
  "Bangkok",
  "Ho_Chi_Minh",
  "Saigon",
  "Manila",
  "Phnom_Penh",
  "Vientiane",
  "Yangon",
  "Rangoon",
  "Brunei",
  "Dili",
]);

const OCE_PACIFIC = new Set(["Auckland", "Chatham", "Fiji", "Guam", "Port_Moresby", "Noumea", "Tongatapu", "Apia"]);

/** Atlantic islands that belong to European countries. */
const EU_ATLANTIC = new Set(["Canary", "Madeira", "Azores", "Faroe", "Faeroe", "Reykjavik"]);

function after(tz: string, prefix: string): string | null {
  return tz.startsWith(prefix) ? tz.slice(prefix.length) : null;
}

export function regionFromTimeZone(tz: string | null | undefined): Region | null {
  if (!tz) return null;

  const america = after(tz, "America/");
  if (america !== null) {
    if (NA_WEST_AMERICA.has(america)) return "na_west";
    if (NA_EAST_AMERICA.has(america)) return "na_east";
    if (NA_EAST_AMERICA_PREFIXES.some((p) => america.startsWith(p))) return "na_east";
    if (america.startsWith("Argentina/") || SA_AMERICA.has(america)) return "sa";
    // Mexico, Central America and the Caribbean: not guessed (Q7).
    return null;
  }

  if (tz.startsWith("US/") || tz.startsWith("Canada/")) {
    if (tz === "US/Samoa") return null;
    return NA_WEST_ALIASES.has(tz) ? "na_west" : "na_east";
  }
  if (tz.startsWith("Brazil/")) return "sa";
  if (tz === "Chile/Continental") return "sa";

  if (tz === "Europe/Istanbul" || tz === "Asia/Istanbul") return null;
  if (tz.startsWith("Europe/")) return "eu";

  const atlantic = after(tz, "Atlantic/");
  if (atlantic !== null) return EU_ATLANTIC.has(atlantic) ? "eu" : null;

  const africa = after(tz, "Africa/");
  if (africa !== null) return MENA_AFRICA.has(africa) ? "mena" : "africa";

  const asia = after(tz, "Asia/");
  if (asia !== null) {
    if (MENA_ASIA.has(asia)) return "mena";
    if (SEA_ASIA.has(asia)) return "sea";
    return "asia";
  }

  if (tz.startsWith("Australia/")) return "oce";

  const pacific = after(tz, "Pacific/");
  if (pacific !== null) {
    if (pacific === "Honolulu" || pacific === "Johnston") return "na_west";
    return OCE_PACIFIC.has(pacific) ? "oce" : null;
  }

  return null;
}

/** The parts of an expo-localization `Locale` this reads. */
export interface LocaleLike {
  languageCode?: string | null;
  languageTag?: string | null;
}

/** Old or alternative tags that name a language the app offers under another code. */
const LANGUAGE_ALIASES: Record<string, string> = { fil: "tl", in: "id" };

const OFFERED = new Set<string>(LANGUAGE_CODES);

/** The phone's languages, as codes the languages step offers: deduped, at most three. */
export function languagesFromLocales(locales: readonly LocaleLike[] | null | undefined): LanguageCode[] {
  const out: LanguageCode[] = [];
  for (const locale of locales ?? []) {
    const raw = locale.languageCode ?? locale.languageTag?.split("-")[0] ?? null;
    if (!raw) continue;
    const lower = raw.toLowerCase();
    const code = LANGUAGE_ALIASES[lower] ?? lower;
    if (!OFFERED.has(code) || out.includes(code as LanguageCode)) continue;
    out.push(code as LanguageCode);
    if (out.length === 3) break;
  }
  return out;
}

/** True only for a chosen region outside NA (the honest "most players are in NA" line). */
export function isOutsideNa(region: Region | null): boolean {
  return region !== null && region !== "na_east" && region !== "na_west";
}
