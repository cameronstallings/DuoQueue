import { type as typeScale } from "@app/theme/tokens";

export const VIDEO_W = 1080;
export const VIDEO_H = 1920;
export const FPS = 30;
/** iPhone logical width the app is designed against. App chrome multiplied by this is the
 * same size on video, relative to the frame, as it is on a phone. */
const APP_W = 393;
export const S = VIDEO_W / APP_W;               // 2.7481
export const px = (n: number) => Math.round(n * S);
/** Hook lines are the deliberate exception to the app scale. See Decision 9. */
export const display = { hero: 108, sub: 64, item: 52 } as const;
/** Leading for that display scale. Taken from the app's own display token (screenTitle,
 * 22 over 28) rather than picked, so a hook line's box is the shape a screen title's is
 * on device and retuning the app's leading moves the video with it. */
export const DISPLAY_LEADING = typeScale.screenTitle.lineHeight / typeScale.screenTitle.fontSize;
export const SAFE = { top: 260, bottom: 520, side: 96 } as const;
