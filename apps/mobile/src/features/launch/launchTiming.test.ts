import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import appConfig from "../../../app.json";
import { CANVAS, CXA, CXB, CY, D, mix, NUB, R, VB_H, VB_W, VB_X, VB_Y, W } from "../../theme/logo-geometry";
import { darkColors } from "../../theme/tokens";
import {
  BRACKET_FADE_MS,
  BRACKET_SPRING,
  RING_TRAVEL_UNITS,
  ringTravel,
  WEAVE_MAX_CENTRES_R,
  WEAVE_MIN_CENTRES_R,
} from "../match/matchMoment";

import { bracketInkPoints, LAUNCH_BRACKET_TRAVEL } from "./launchBrackets";
import {
  ANDROID_MARK_W,
  ANDROID_SPLASH_IMAGE_WIDTH,
  BREATHE_AFTER_MS,
  LAUNCH_BEAT_MS,
  LAUNCH_BRACKETS_AT_MS,
  LAUNCH_DISSOLVE_MS,
  LAUNCH_LOCK_MS,
  LAUNCH_MARK_W,
  LAUNCH_PALETTE,
  LAUNCH_POP_SPRING,
  LAUNCH_RUSH_REACH_MS,
  LAUNCH_RUSH_SPRING,
  LAUNCH_WINDUP,
  LAUNCH_WINDUP_MS,
  launchMarkWidth,
  launchOpening,
  launchSchedule,
  APP_MOUNT_AFTER_LOCK_MS,
  LOCK_LATE_MS,
  LOCKED_HOLD_MS,
  msUntil,
  ringsApartBounds,
  SPLASH_IMAGE_PX,
  SPLASH_IMAGE_WIDTH,
  splashViewBox,
} from "./launchTiming";
import { springAt, springDoneMs, springFirstReachMs, springRange } from "./springMath";

interface SplashProps {
  image: string;
  imageWidth: number;
  backgroundColor: string;
  dark: { image: string; backgroundColor: string };
  android: { image: string; imageWidth: number; dark: { image: string; backgroundColor: string } };
}

function splashPlugin(): SplashProps {
  const entry = appConfig.expo.plugins.find((p) => Array.isArray(p) && p[0] === "expo-splash-screen");
  if (!Array.isArray(entry)) throw new Error("expo-splash-screen is not configured in app.json");
  return entry[1] as unknown as SplashProps;
}

/**
 * The bracket lock as LaunchIntro.tsx drives it, in ms after the opening starts, with the device's
 * frames taken out: the value each withTiming / withSpring holds at that instant.
 */
function motionAt(ms: number): { rings: number; pop: number; brackets: number } {
  const rushAt = LAUNCH_BEAT_MS + LAUNCH_WINDUP_MS;
  let rings = 0;
  if (ms > LAUNCH_BEAT_MS && ms < rushAt) {
    const u = (ms - LAUNCH_BEAT_MS) / LAUNCH_WINDUP_MS;
    rings = LAUNCH_WINDUP * (1 - (1 - u) * (1 - u)); // Easing.out(Easing.quad)
  } else if (ms >= rushAt) rings = springAt(LAUNCH_RUSH_SPRING, LAUNCH_WINDUP, 1, ms - rushAt).value;
  const pop = ms < LAUNCH_LOCK_MS ? 1 : springAt(LAUNCH_POP_SPRING, 1, 1, ms - LAUNCH_LOCK_MS).value;
  const brackets = ms <= LAUNCH_BRACKETS_AT_MS ? 0 : springAt(BRACKET_SPRING, 0, 1, ms - LAUNCH_BRACKETS_AT_MS).value;
  return { rings, pop, brackets };
}

/** The rings' centres, in ring radii, at a RingsLock progress. */
const centresR = (progress: number) => (D + 2 * (1 - progress) * RING_TRAVEL_UNITS) / R;

/** The launch mark's geometry in points, from its centre (y down). */
const PT = LAUNCH_MARK_W / VB_W;
const MID_X = VB_X + VB_W / 2;
const MID_Y = VB_Y + VB_H / 2;
const TRAVEL_PT = ringTravel(LAUNCH_MARK_W);

/** How close the brackets' ink comes to the rings' ink, in points, before the pop's scale (which
 * scales rings and brackets together about one point, so it scales the gap with them). */
function bracketGapPt(rings: number, brackets: number): number {
  const shift = (1 - rings) * TRAVEL_PT;
  const o = { x: (CXA - MID_X) * PT - shift, y: (CY - MID_Y) * PT };
  const q = { x: (CXB - MID_X) * PT + shift, y: (CY - MID_Y) * PT };
  const nub = { x: (NUB.cx - MID_X) * PT + shift, y: (NUB.cy - MID_Y) * PT };
  let gap = Infinity;
  for (const [glyph, out] of [
    ["[", -LAUNCH_BRACKET_TRAVEL],
    ["]", LAUNCH_BRACKET_TRAVEL],
  ] as const) {
    const pts = bracketInkPoints(glyph).map(([x, y]) => [x + (1 - brackets) * out, y] as const);
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[(i + 1) % pts.length]!;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.1);
      for (let j = 0; j <= n; j++) {
        const x = x0 + ((x1 - x0) * j) / n;
        const y = y0 + ((y1 - y0) * j) / n;
        const ring = (c: { x: number; y: number }) => Math.abs(Math.hypot(x - c.x, y - c.y) - R * PT) - (W / 2) * PT;
        gap = Math.min(gap, ring(o), ring(q), Math.hypot(x - nub.x, y - nub.y) - NUB.r * PT);
      }
    }
  }
  return gap;
}

describe("the native splash in app.json", () => {
  it("is the rings apart on iOS, in the light and dark appearance alike", () => {
    const splash = splashPlugin();
    expect(splash.image).toBe("./assets/splash-rings-apart.png");
    expect(splash.dark.image).toBe("./assets/splash-rings-apart.png");
  });

  it("is drawn at the width the overlay is laid out for", () => {
    expect(splashPlugin().imageWidth).toBe(SPLASH_IMAGE_WIDTH);
  });

  it("sits on the overlay's field", () => {
    const splash = splashPlugin();
    expect(splash.backgroundColor).toBe(LAUNCH_PALETTE.background);
    expect(splash.dark.backgroundColor).toBe(LAUNCH_PALETTE.background);
    expect(splash.android.dark.backgroundColor).toBe(LAUNCH_PALETTE.background);
  });

  it("keeps the locked mark on Android, where the splash icon is masked to a circle", () => {
    const { android } = splashPlugin();
    expect(android.image).toBe("./assets/splash-icon.png");
    expect(android.dark.image).toBe("./assets/splash-icon.png");
    expect(android.imageWidth).toBe(ANDROID_SPLASH_IMAGE_WIDTH);
  });

  it("points at a PNG drawn at the @3x size (regenerate it with scripts/generate-launch-splash.ts)", () => {
    const png = readFileSync(new URL("../../../assets/splash-rings-apart.png", import.meta.url));
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(SPLASH_IMAGE_PX);
    expect(png.readUInt32BE(20)).toBe(SPLASH_IMAGE_PX);
  });
});

describe("the launch palette", () => {
  it("is the dark app's field, ink, duo grey and volt, whatever the theme", () => {
    expect(LAUNCH_PALETTE.background).toBe(darkColors.background);
    expect(LAUNCH_PALETTE.ink).toBe(darkColors.text);
    expect(LAUNCH_PALETTE.duo).toBe(mix(darkColors.text, darkColors.background, 0.58));
    // DUO LOCKED's brackets are colors.volt, which is this on the dark field.
    expect(LAUNCH_PALETTE.volt).toBe(darkColors.volt);
    expect(LAUNCH_PALETTE.volt).toBe("#CDFF3D");
  });
});

describe("the launch geometry", () => {
  it("puts the mark's box on whole @3x and @2x pixels, an even number of them at @3x", () => {
    expect(LAUNCH_MARK_W * 3).toBeCloseTo(502, 9);
    expect(Math.round(LAUNCH_MARK_W * 3) % 2).toBe(0);
    expect(SPLASH_IMAGE_WIDTH % 2).toBe(0);
  });

  it("starts each ring within 0.05px of a whole @3x pixel from its place", () => {
    const px = ringTravel(LAUNCH_MARK_W) * 3;
    expect(Math.abs(px - Math.round(px))).toBeLessThan(0.05);
  });

  it("centres the splash square where RingsLock's box is centred", () => {
    const box = splashViewBox();
    expect(box.x + box.size / 2).toBeCloseTo(VB_X + VB_W / 2, 9);
    expect(box.y + box.size / 2).toBeCloseTo(VB_Y + VB_H / 2, 9);
    // One point of the screen is the same number of mark units in the image and in the overlay.
    expect(box.size / SPLASH_IMAGE_WIDTH).toBeCloseTo(VB_W / LAUNCH_MARK_W, 9);
  });

  it("fits the rings apart inside the square with room to spare on every side", () => {
    const box = splashViewBox();
    const reach = ringsApartBounds();
    const unitsPerPt = VB_W / LAUNCH_MARK_W;
    const margins = [
      reach.left - box.x,
      box.x + box.size - reach.right,
      reach.top - box.y,
      box.y + box.size - reach.bottom,
    ].map((u) => u / unitsPerPt);
    for (const m of margins) expect(m).toBeGreaterThan(6);
  });

  it("is narrower than the narrowest iPhone, brackets included, even all the way out", () => {
    expect(SPLASH_IMAGE_WIDTH).toBeLessThan(320);
    const reach = Math.max(...bracketInkPoints("]").map(([x]) => x)) + LAUNCH_BRACKET_TRAVEL;
    expect(2 * reach).toBeLessThan(320);
  });

  it("draws Android's locked mark at the size the old splash drew it", () => {
    expect(ANDROID_MARK_W).toBeCloseTo(180 * (VB_W / CANVAS), 9);
  });
});

describe("launchOpening", () => {
  it("runs the bracket lock on iOS", () => {
    expect(launchOpening("ios", false)).toBe("bracket-lock");
  });

  it("dissolves instead under Reduce Motion", () => {
    expect(launchOpening("ios", true)).toBe("dissolve");
  });

  it("starts locked on Android, whose splash is already the locked mark", () => {
    expect(launchOpening("android", false)).toBe("none");
    expect(launchOpening("android", true)).toBe("none");
  });

  it("sizes the mark to the native splash under it", () => {
    expect(launchMarkWidth("bracket-lock")).toBe(LAUNCH_MARK_W);
    expect(launchMarkWidth("dissolve")).toBe(LAUNCH_MARK_W);
    expect(launchMarkWidth("none")).toBe(ANDROID_MARK_W);
  });
});

describe("the bracket lock, against the approved preview (launch-pop/bracket-report.md)", () => {
  it("winds up 7% over 110ms, then rushes on 225/18/1 from a standstill", () => {
    expect(LAUNCH_WINDUP).toBe(-0.07);
    expect(LAUNCH_WINDUP_MS).toBe(110);
    expect(LAUNCH_RUSH_SPRING).toEqual({ stiffness: 225, damping: 18, mass: 1 });
    expect(motionAt(LAUNCH_BEAT_MS + LAUNCH_WINDUP_MS - 1e-9).rings).toBeCloseTo(LAUNCH_WINDUP, 6);
  });

  it("locks 184.5ms into the rush: 444.5ms after the splash hides (670 before)", () => {
    expect(LAUNCH_RUSH_REACH_MS).toBeCloseTo(184.5, 1);
    expect(LAUNCH_LOCK_MS).toBeCloseTo(444.5, 1);
    expect(motionAt(LAUNCH_LOCK_MS - 0.01).rings).toBeLessThan(1);
    expect(motionAt(LAUNCH_LOCK_MS + 0.01).rings).toBeGreaterThan(1);
  });

  it("overshoots to 1.101 77ms after the lock, and never takes the rings out of the weave's range", () => {
    const rushAt = LAUNCH_BEAT_MS + LAUNCH_WINDUP_MS;
    const after = springRange(LAUNCH_RUSH_SPRING, LAUNCH_WINDUP, 1, LAUNCH_RUSH_REACH_MS, 2000);
    expect(after.max).toBeCloseTo(1.1014, 4);
    expect(rushAt + after.maxAtMs - LAUNCH_LOCK_MS).toBeCloseTo(77.3, 0);
    // The weave is drawn from the lock on: the centres stay 1.3R to 1.52R apart all the while.
    expect(centresR(after.max)).toBeGreaterThanOrEqual(WEAVE_MIN_CENTRES_R);
    expect(centresR(after.max)).toBeCloseTo(1.3208, 4);
    expect(centresR(after.min)).toBeLessThanOrEqual(WEAVE_MAX_CENTRES_R);
    expect(centresR(1)).toBeCloseTo(1.5, 12);
  });

  // The maths only: launchPop.test.ts runs the pop through Reanimated's own setter, which drops a
  // bare spring from rest at 1 to 1.
  it("pops the mark to 1.08, 60ms after the lock, set moving from rest at 1", () => {
    expect(LAUNCH_POP_SPRING).toEqual({ stiffness: 400, damping: 20, mass: 1, velocity: 2.9288 });
    const { max, maxAtMs } = springRange(LAUNCH_POP_SPRING, 1, 1, 0, 400);
    expect(max).toBeCloseTo(1.08, 4);
    expect(maxAtMs).toBeCloseTo(60.5, 0);
  });

  it("brings DUO LOCKED's brackets home at the lock, fading in over 140ms from 312ms", () => {
    expect(BRACKET_SPRING).toEqual({ mass: 1, stiffness: 420, damping: 24 });
    expect(BRACKET_FADE_MS).toBe(140);
    const home = springFirstReachMs(BRACKET_SPRING, 0, 1);
    expect(home).toBeCloseTo(132.2, 1);
    expect(LAUNCH_BRACKETS_AT_MS).toBe(Math.round(LAUNCH_LOCK_MS - home));
    expect(LAUNCH_BRACKETS_AT_MS).toBe(312);
    // Home within a millisecond of the rings' lock: 0.1pt of travel at that speed.
    expect(Math.abs(LAUNCH_BRACKETS_AT_MS + home - LAUNCH_LOCK_MS)).toBeLessThan(1);
    expect(Math.abs(1 - motionAt(LAUNCH_LOCK_MS).brackets) * LAUNCH_BRACKET_TRAVEL).toBeLessThan(0.1);
  });

  it("overshoots the brackets 4.1pt inward, 57ms after the lock", () => {
    const { max, maxAtMs } = springRange(BRACKET_SPRING, 0, 1, 0, 600);
    expect((max - 1) * LAUNCH_BRACKET_TRAVEL).toBeCloseTo(4.12, 2);
    expect(LAUNCH_BRACKETS_AT_MS + maxAtMs - LAUNCH_LOCK_MS).toBeCloseTo(57, 0);
  });

  it("keeps the brackets clear of the rings: 9.6pt at rest, never under 9pt on the way", () => {
    // The preview measured 9.73 / 9.43pt on its pixel-rounded 334px mark; this is the exact geometry.
    expect(bracketGapPt(1, 1)).toBeCloseTo(9.58, 2);
    let tightest = Infinity;
    for (let ms = LAUNCH_BRACKETS_AT_MS + BRACKET_FADE_MS / 2; ms <= LAUNCH_LOCK_MS + 900; ms += 2) {
      const m = motionAt(ms);
      // On screen the pop scales the gap with everything else.
      tightest = Math.min(tightest, bracketGapPt(m.rings, m.brackets) * m.pop);
    }
    expect(tightest).toBeGreaterThan(9);
  });

  it("would only hear the rush's completion callback ~900ms after the lock, so the lock is watched for", () => {
    const done = springDoneMs(LAUNCH_RUSH_SPRING, LAUNCH_WINDUP, 1);
    expect(done - LAUNCH_RUSH_REACH_MS).toBeGreaterThan(890);
  });
});

describe("launchSchedule", () => {
  it("runs the bracket lock with springs, travelling brackets and the haptic", () => {
    expect(launchSchedule("bracket-lock")).toEqual({
      lockMs: LAUNCH_LOCK_MS,
      lockBackstopMs: LAUNCH_LOCK_MS + LOCK_LATE_MS,
      springs: true,
      brackets: { atMs: LAUNCH_BRACKETS_AT_MS, fadeMs: BRACKET_FADE_MS, travel: true },
      haptic: true,
    });
  });

  it("under Reduce Motion: no springs, the brackets fade in at home over the dissolve's second half, the haptic still fires", () => {
    expect(LAUNCH_DISSOLVE_MS).toBe(200);
    expect(launchSchedule("dissolve")).toEqual({
      lockMs: LAUNCH_BEAT_MS + LAUNCH_DISSOLVE_MS,
      lockBackstopMs: 2350,
      springs: false,
      brackets: { atMs: 250, fadeMs: 100, travel: false },
      haptic: true,
    });
  });

  it("under Reduce Motion, starts the brackets once the rings apart are half gone, and finishes both at the lock", () => {
    const { lockMs, brackets } = launchSchedule("dissolve");
    if (!brackets) throw new Error("the dissolve draws the brackets");
    // LaunchIntro fades both with withTiming's default ease, Easing.inOut(Easing.quad).
    const inOutQuad = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    const apartOpacity = (ms: number) => 1 - inOutQuad(Math.min(1, Math.max(0, (ms - LAUNCH_BEAT_MS) / LAUNCH_DISSOLVE_MS)));
    expect(apartOpacity(brackets.atMs)).toBeCloseTo(0.5, 12);
    expect(brackets.atMs + brackets.fadeMs).toBe(lockMs);
    // Where both are on screen at once, the fainter of the two never passes a quarter (it was a
    // half when the brackets faded in over the whole dissolve).
    let overlap = 0;
    for (let ms = brackets.atMs; ms <= lockMs; ms += 0.5) {
      const bracketOpacity = inOutQuad((ms - brackets.atMs) / brackets.fadeMs);
      overlap = Math.max(overlap, Math.min(apartOpacity(ms), bracketOpacity));
    }
    expect(overlap).toBeLessThan(0.25);
  });

  it("is locked from the start on Android, with no brackets and no haptic: there is no lock to see", () => {
    expect(launchSchedule("none")).toEqual({ lockMs: 0, lockBackstopMs: 2000, springs: false, brackets: null, haptic: false });
  });
});

describe("after the lock", () => {
  it("holds until the rings, the pop and the brackets have all settled, then fades over 250ms", () => {
    // Everything within half an @3x pixel of rest, for good: the rings' travel, the pop's swing at
    // the farthest ink from the centre (a bracket corner), and the brackets' travel.
    const farthest = Math.max(...(["[", "]"] as const).flatMap((g) => bracketInkPoints(g).map(([x, y]) => Math.hypot(x, y))));
    let settledAt = LAUNCH_LOCK_MS;
    for (let ms = LAUNCH_LOCK_MS; ms <= LAUNCH_LOCK_MS + 1500; ms += 0.1) {
      const m = motionAt(ms);
      const off = Math.abs(1 - m.rings) * TRAVEL_PT + Math.abs(m.pop - 1) * farthest + Math.abs(1 - m.brackets) * LAUNCH_BRACKET_TRAVEL * m.pop;
      if (off > 1 / 6) settledAt = ms;
    }
    const settledAfterLock = settledAt - LAUNCH_LOCK_MS;
    expect(settledAfterLock).toBeCloseTo(496.4, 0);
    expect(LOCKED_HOLD_MS).toBe(500);
    expect(LOCKED_HOLD_MS).toBeGreaterThanOrEqual(settledAfterLock);
    expect(LOCKED_HOLD_MS - settledAfterLock).toBeLessThan(20);
  });

  it("breathes only well after the hold", () => {
    expect(BREATHE_AFTER_MS).toBe(1500);
    expect(BREATHE_AFTER_MS).toBeGreaterThan(LOCKED_HOLD_MS);
  });

  it("mounts the app after the pop's peak and the rings' deepest overshoot, well before the fade", () => {
    let popPeakAt = LAUNCH_LOCK_MS;
    let deepestAt = LAUNCH_LOCK_MS;
    for (let ms = LAUNCH_LOCK_MS; ms <= LAUNCH_LOCK_MS + 300; ms += 0.1) {
      const m = motionAt(ms);
      if (m.pop > motionAt(popPeakAt).pop) popPeakAt = ms;
      if (m.rings > motionAt(deepestAt).rings) deepestAt = ms;
    }
    expect(APP_MOUNT_AFTER_LOCK_MS).toBe(180);
    expect(APP_MOUNT_AFTER_LOCK_MS).toBeGreaterThan(popPeakAt - LAUNCH_LOCK_MS);
    expect(APP_MOUNT_AFTER_LOCK_MS).toBeGreaterThan(deepestAt - LAUNCH_LOCK_MS);
    expect(LOCKED_HOLD_MS - APP_MOUNT_AFTER_LOCK_MS).toBeGreaterThanOrEqual(300);
  });

  it("waits for a late lock report 2s past when it was due, well past the whole opening", () => {
    for (const opening of ["bracket-lock", "dissolve", "none"] as const) {
      const { lockMs, lockBackstopMs } = launchSchedule(opening);
      expect(lockBackstopMs - lockMs).toBe(2000);
      expect(lockBackstopMs - lockMs).toBeGreaterThanOrEqual(2 * (LAUNCH_LOCK_MS + LOCKED_HOLD_MS));
    }
  });
});

describe("msUntil", () => {
  const lockedAt = 10_000;

  it("holds a fast app until the lock has settled", () => {
    expect(msUntil(LOCKED_HOLD_MS, lockedAt, lockedAt + 100)).toBe(400);
  });

  it("fades a slow app the moment it is ready", () => {
    expect(msUntil(LOCKED_HOLD_MS, lockedAt, lockedAt + 3_000)).toBe(0);
  });

  it("is exact at the boundary and never negative", () => {
    expect(msUntil(LOCKED_HOLD_MS, lockedAt, lockedAt + LOCKED_HOLD_MS)).toBe(0);
    expect(msUntil(0, lockedAt, lockedAt + 1)).toBe(0);
  });
});

describe("the cold start", () => {
  it("is pending once per JS runtime, until the intro ends", async () => {
    vi.resetModules();
    const fresh = await import("./launchTiming");
    expect(fresh.isColdStart()).toBe(true);
    expect(fresh.isColdStart()).toBe(true);
    fresh.endColdStart();
    expect(fresh.isColdStart()).toBe(false);
  });
});
