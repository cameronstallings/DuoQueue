/**
 * The initial drawn where a player's picture would be. `name[0]` splits an emoji's surrogate
 * pair into a broken glyph; Array.from walks code points instead. Display names are 2 to 30
 * characters after trim (shared-types displayNameSchema), so "?" only covers bad data.
 */
export function initialOf(name: string | null | undefined): string {
  const first = Array.from((name ?? "").trim())[0];
  return first ? first.toUpperCase() : "?";
}
