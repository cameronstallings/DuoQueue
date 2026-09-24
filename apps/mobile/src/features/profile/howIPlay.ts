import { PLAYSTYLE_TAGS, type PlaystyleTag, type TiltHandling } from "@duoqueue/shared-types";

/**
 * HOW I PLAY on the Profile tab: the vibe sliders and play window as words on four tiles. You
 * still edit them as sliders; here "50/50/50" reads "Balanced / Mic sometimes / Open to tips"
 * instead of looking unanswered. Pure (howIPlay.test.ts).
 */

export type VibeBand = "low" | "mid" | "high";

/** A 0-100 slider as one of three bands. The middle is wide on purpose: every account starts at
 * 50 (profile_vibe's default), and a small nudge from 50 should still read as the neutral word. */
export function vibeBand(value: number): VibeBand {
  if (!Number.isFinite(value)) return "mid";
  const v = Math.min(100, Math.max(0, value));
  if (v <= 33) return "low";
  if (v >= 67) return "high";
  return "mid";
}

/** Ends taken from the Edit sliders' own labels ("Chill / norms & ARAM" to "Sweaty ranked grind"). */
export const INTENSITY_WORDS: Record<VibeBand, string> = { low: "Chill", mid: "Balanced", high: "Ranked grind" };
export const COMMS_WORDS: Record<VibeBand, string> = { low: "Mostly quiet", mid: "Mic sometimes", high: "Mic on" };
export const COACHING_WORDS: Record<VibeBand, string> = { low: "No tips, please", mid: "Open to tips", high: "Wants coaching" };

/** The tilt answers are 24-25 characters, too long for a half tile, so each splits in two. */
export const TILT_WORDS: Record<TiltHandling, { value: string; caption: string | null }> = {
  stays_calm: { value: "Stays calm", caption: null },
  gets_frustrated_sometimes: { value: "Gets frustrated", caption: "Sometimes" },
  tilts_but_recovers_fast: { value: "Recovers fast", caption: "After a quick tilt" },
  needs_space_after_losses: { value: "Needs space", caption: null },
};

export const TILE_LABELS = { style: "Style", when: "When", comms: "Comms", afterLoss: "After a loss" } as const;

/** The play-window presets (profile-labels PLAY_WINDOW_PRESETS) by name. Their labels carry en
 * dashes and a trailing hours range, so the names are restated here. */
const WINDOW_NAMES: { startHour: number; endHour: number; name: string }[] = [
  { startHour: 5, endHour: 9, name: "Early morning" },
  { startHour: 9, endHour: 12, name: "Morning" },
  { startHour: 12, endHour: 17, name: "Afternoon" },
  { startHour: 17, endHour: 21, name: "Evening" },
  { startHour: 21, endHour: 1, name: "Night" },
  { startHour: 1, endHour: 5, name: "Late night" },
];

export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export function playWindowWords(
  startHour: number | null,
  endHour: number | null,
): { value: string; caption: string | null } | null {
  if (startHour === null || endHour === null) return null;
  const hours = `${hourLabel(startHour)} to ${hourLabel(endHour)}`;
  const preset = WINDOW_NAMES.find((w) => w.startHour === startHour && w.endHour === endHour);
  return preset ? { value: preset.name, caption: hours } : { value: hours, caption: null };
}

export interface HowIPlayTile {
  key: "style" | "when" | "comms" | "afterLoss";
  label: string;
  value: string;
  caption: string | null;
  accessibilityLabel: string;
}

export interface HowIPlayInput {
  vibe: { intensity: number; commsStyle: number; coachingPref: number; tiltHandling: TiltHandling } | null;
  playstyles: PlaystyleTag[];
  playWindow: { startHour: number | null; endHour: number | null };
  playstyleLabels: Record<PlaystyleTag, string>;
  tiltLabels: Record<TiltHandling, string>;
}

function spoken(label: string, value: string, caption: string | null): string {
  return caption ? `${label}: ${value}. ${caption}` : `${label}: ${value}`;
}

/** STYLE, WHEN, COMMS, AFTER A LOSS; a tile with no data is left out. */
export function howIPlayTiles(input: HowIPlayInput): HowIPlayTile[] {
  const tiles: HowIPlayTile[] = [];
  const { vibe } = input;

  if (vibe) {
    const value = INTENSITY_WORDS[vibeBand(vibe.intensity)];
    const tags = PLAYSTYLE_TAGS.filter((tag) => input.playstyles.includes(tag))
      .map((tag) => input.playstyleLabels[tag])
      .filter((label) => label.toLowerCase() !== value.toLowerCase())
      .slice(0, 2);
    const caption = tags.length > 0 ? tags.join(" · ") : null;
    tiles.push({ key: "style", label: TILE_LABELS.style, value, caption, accessibilityLabel: spoken(TILE_LABELS.style, value, caption) });
  }

  const when = playWindowWords(input.playWindow.startHour, input.playWindow.endHour);
  if (when) {
    tiles.push({
      key: "when",
      label: TILE_LABELS.when,
      value: when.value,
      caption: when.caption,
      accessibilityLabel: spoken(TILE_LABELS.when, when.value, when.caption),
    });
  }

  if (vibe) {
    const comms = COMMS_WORDS[vibeBand(vibe.commsStyle)];
    const coaching = COACHING_WORDS[vibeBand(vibe.coachingPref)];
    tiles.push({
      key: "comms",
      label: TILE_LABELS.comms,
      value: comms,
      caption: coaching,
      accessibilityLabel: spoken(TILE_LABELS.comms, comms, coaching),
    });
    const tilt = TILT_WORDS[vibe.tiltHandling];
    tiles.push({
      key: "afterLoss",
      label: TILE_LABELS.afterLoss,
      value: tilt.value,
      caption: tilt.caption,
      accessibilityLabel: `After a losing streak: ${input.tiltLabels[vibe.tiltHandling]}`,
    });
  }

  return tiles;
}
