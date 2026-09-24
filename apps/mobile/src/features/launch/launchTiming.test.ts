import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import appConfig from "../../../app.json";
import { CANVAS, mix, VB_H, VB_W, VB_X, VB_Y } from "../../theme/logo-geometry";
import { darkColors } from "../../theme/tokens";
import { RINGS_MS, ringTravel } from "../match/matchMoment";

import {
  ANDROID_MARK_W,
  ANDROID_SPLASH_IMAGE_WIDTH,
  BREATHE_AFTER_MS,
  LAUNCH_BEAT_MS,
  LAUNCH_DISSOLVE_MS,
  LAUNCH_MARK_W,
  LAUNCH_PALETTE,
  launchMarkWidth,
  launchOpening,
  launchSchedule,
  LOCK_LATE_MS,
  LOCKED_HOLD_MS,
  msUntil,
  ringsApartBounds,
  SPLASH_IMAGE_PX,
  SPLASH_IMAGE_WIDTH,
  splashViewBox,
} from "./launchTiming";

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
  it("is the dark app's field, ink and duo grey, whatever the theme", () => {
    expect(LAUNCH_PALETTE.background).toBe(darkColors.background);
    expect(LAUNCH_PALETTE.ink).toBe(darkColors.text);
    expect(LAUNCH_PALETTE.duo).toBe(mix(darkColors.text, darkColors.background, 0.58));
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

  it("is narrower than the narrowest iPhone", () => {
    expect(SPLASH_IMAGE_WIDTH).toBeLessThan(320);
  });

  it("draws Android's locked mark at the size the old splash drew it", () => {
    expect(ANDROID_MARK_W).toBeCloseTo(180 * (VB_W / CANVAS), 9);
  });
});

describe("launchOpening", () => {
  it("slides on iOS", () => {
    expect(launchOpening("ios", false)).toBe("slide");
  });

  it("dissolves instead under Reduce Motion", () => {
    expect(launchOpening("ios", true)).toBe("dissolve");
  });

  it("starts locked on Android, whose splash is already the locked mark", () => {
    expect(launchOpening("android", false)).toBe("none");
    expect(launchOpening("android", true)).toBe("none");
  });

  it("sizes the mark to the native splash under it", () => {
    expect(launchMarkWidth("slide")).toBe(LAUNCH_MARK_W);
    expect(launchMarkWidth("dissolve")).toBe(LAUNCH_MARK_W);
    expect(launchMarkWidth("none")).toBe(ANDROID_MARK_W);
  });
});

describe("launchSchedule", () => {
  it("locks after a rest and DUO LOCKED's slide", () => {
    expect(RINGS_MS).toBe(520);
    expect(launchSchedule("slide")).toEqual({
      lockMs: LAUNCH_BEAT_MS + RINGS_MS,
      lockBackstopMs: LAUNCH_BEAT_MS + RINGS_MS + LOCK_LATE_MS,
    });
    expect(launchSchedule("slide")).toEqual({ lockMs: 670, lockBackstopMs: 2670 });
  });

  it("locks after a rest and the dissolve under Reduce Motion", () => {
    expect(launchSchedule("dissolve")).toEqual({ lockMs: LAUNCH_BEAT_MS + LAUNCH_DISSOLVE_MS, lockBackstopMs: 2350 });
  });

  it("is locked from the start on Android", () => {
    expect(launchSchedule("none")).toEqual({ lockMs: 0, lockBackstopMs: 2000 });
  });
});

describe("after the lock", () => {
  it("holds the locked mark before the fade, and breathes only well after it", () => {
    expect(LOCKED_HOLD_MS).toBe(250);
    expect(BREATHE_AFTER_MS).toBe(1500);
    expect(BREATHE_AFTER_MS).toBeGreaterThan(LOCKED_HOLD_MS);
  });

  it("waits for a late lock report well past the whole opening before giving up on it", () => {
    for (const opening of ["slide", "dissolve", "none"] as const) {
      const { lockMs, lockBackstopMs } = launchSchedule(opening);
      expect(lockBackstopMs - lockMs).toBeGreaterThanOrEqual(2 * (LAUNCH_BEAT_MS + RINGS_MS));
    }
  });
});

describe("msUntil", () => {
  const lockedAt = 10_000;

  it("holds a fast app until the lock has been seen", () => {
    expect(msUntil(LOCKED_HOLD_MS, lockedAt, lockedAt + 100)).toBe(150);
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
