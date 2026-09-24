import type { ModerationStatus } from "@duoqueue/shared-types";

/**
 * What your own card shows in the picture slot, and the tag and line that explain it.
 *
 * Strangers only ever get approved rows (public_profile_media). The owner can read their own
 * rows with moderation_status, so their card can say what strangers are seeing instead. A
 * rejected picture is never drawn, not even for its owner. An approved old cover (`header`,
 * which build 11 and earlier uploaded) stands in for a missing picture, exactly as cardPicture
 * does for strangers.
 *
 * Pure, relative imports only, so it is unit-tested (pictureStatus.test.ts).
 */

export const PICTURE_TAG = {
  add: "ADD A PICTURE",
  review: "PICTURE IN REVIEW",
  rejected: "PICTURE NOT APPROVED",
} as const;

export const PICTURE_NOTE = {
  review: "Your picture is in review. Until it's approved, players see your initial.",
  rejected: "That picture wasn't approved. Pick another one.",
} as const;

export interface OwnPhotoRows {
  profileUrl: string | null;
  profileStatus: ModerationStatus | null;
  headerUrl: string | null;
  headerStatus: ModerationStatus | null;
}

export interface OwnPictureState {
  /** What to draw on your own card; null draws the initial. */
  url: string | null;
  /** The solid tag on your card's picture area, or null for none. */
  tag: string | null;
  /** The line under your card, or null for none. */
  note: string | null;
  /** Counts as "a picture" for completeness: anything but missing or rejected. */
  hasPicture: boolean;
}

export function ownPictureState(rows: OwnPhotoRows): OwnPictureState {
  const legacyCover = rows.headerStatus === "approved" ? rows.headerUrl : null;

  switch (rows.profileStatus) {
    case "approved":
      return { url: rows.profileUrl ?? legacyCover, tag: null, note: null, hasPicture: true };
    case "pending":
      return { url: rows.profileUrl, tag: PICTURE_TAG.review, note: PICTURE_NOTE.review, hasPicture: true };
    case "rejected":
      return { url: legacyCover, tag: PICTURE_TAG.rejected, note: PICTURE_NOTE.rejected, hasPicture: legacyCover !== null };
    case null:
      return legacyCover
        ? { url: legacyCover, tag: null, note: null, hasPicture: true }
        : { url: null, tag: PICTURE_TAG.add, note: null, hasPicture: false };
  }
}
