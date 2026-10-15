import { discordUsernameSchema } from "@duoqueue/shared-types";

/**
 * The Discord editor's rules and words (discordUsername.test.ts).
 *
 * The username lives on `profiles.discord_username` and is private: nobody sees it until its
 * owner taps Share my Discord in a chat, which writes a `discord_shares` row that the other
 * player can read through `get_shared_discord_username`. Before 1.0.2 there was no way to add one
 * after signup, and since 0073 the server refuses a share without one, so the chat's Discord
 * tool was simply missing for most players. The editor lives in Settings > Connections and opens
 * from the chat's Add your Discord chip.
 *
 * The client check is `discordUsernameSchema` (shared-types), the same rule as 0049's
 * `discord_username_format` check: 2 to 32 letters, digits, dots and underscores.
 */

export const DISCORD_COPY = {
  titleChat: "Add your Discord",
  titleSettings: "Your Discord",
  body: "It stays private until you tap Share my Discord in a chat.",
  fieldLabel: "Discord username",
  placeholder: "yourname",
  removeHint: "Leave it empty to remove it.",
  saveAndShare: "Save and share",
  save: "Save",
  cancel: "Cancel",
  invalid: "Enter a valid Discord username.",
  format: "Discord usernames can only use letters, numbers, dots and underscores.",
  saveFailed: "Couldn't save your Discord. Try again.",
  saved: "Discord saved",
  removed: "Discord removed",
  connectionsIntro: "Add your Discord so you can share it in a chat with one tap. Nobody sees it until you do.",
  rowName: "Discord",
  notAdded: "Not added",
  add: "Add",
  edit: "Edit",
  verifiedCaption:
    "A verified badge pulls your rank and username straight from the source, rather than trusting a typed-in claim.",
  settingsHint: "Your Discord and game accounts",
} as const;

export type DiscordParse = { ok: true; value: string | null } | { ok: false; error: string };

/** The field's value, ready to save: trimmed, `null` for empty (remove it), or the line to show
 * under the field. A character Discord does not allow gets the format line; a wrong length gets
 * the generic one. */
export function parseDiscordInput(raw: string): DiscordParse {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (discordUsernameSchema.safeParse(trimmed).success) return { ok: true, value: trimmed };
  if (/[^a-z0-9._]/i.test(trimmed)) return { ok: false, error: DISCORD_COPY.format };
  return { ok: false, error: DISCORD_COPY.invalid };
}

/** A failed save, in words. Only 0049's format check (23514 naming `discord_username_format`) is
 * explained; everything else is the generic line. Never `err.message`, which is Postgres
 * internals. */
export function discordSaveErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const e = err as { code?: unknown; message?: unknown; details?: unknown };
    const text = `${typeof e.message === "string" ? e.message : ""} ${typeof e.details === "string" ? e.details : ""}`;
    if (e.code === "23514" && text.includes("discord_username_format")) return DISCORD_COPY.format;
  }
  return DISCORD_COPY.saveFailed;
}
