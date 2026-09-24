import { describe, expect, it } from "vitest";

import { PICTURE_NOTE, PICTURE_TAG, ownPictureState, type OwnPhotoRows } from "./pictureStatus";

/**
 * What the owner's own card shows. The owner sees their pending picture (tagged); a rejected
 * picture is never shown, not even to its owner; an approved old cover stands in for a missing
 * picture exactly as it does for strangers (cardPicture).
 */
const NONE: OwnPhotoRows = { profileUrl: null, profileStatus: null, headerUrl: null, headerStatus: null };

describe("ownPictureState", () => {
  it("asks for a picture when there is none", () => {
    expect(ownPictureState(NONE)).toEqual({ url: null, tag: PICTURE_TAG.add, note: null, hasPicture: false });
  });

  it("shows an approved picture with no tag", () => {
    expect(ownPictureState({ ...NONE, profileUrl: "p", profileStatus: "approved" })).toEqual({
      url: "p",
      tag: null,
      note: null,
      hasPicture: true,
    });
  });

  it("shows the owner their pending picture, tagged, and says players see the initial", () => {
    expect(ownPictureState({ ...NONE, profileUrl: "p", profileStatus: "pending" })).toEqual({
      url: "p",
      tag: PICTURE_TAG.review,
      note: PICTURE_NOTE.review,
      hasPicture: true,
    });
  });

  it("never shows a rejected picture, even to its owner", () => {
    expect(ownPictureState({ ...NONE, profileUrl: "p", profileStatus: "rejected" })).toEqual({
      url: null,
      tag: PICTURE_TAG.rejected,
      note: PICTURE_NOTE.rejected,
      hasPicture: false,
    });
  });

  it("falls back to an approved old cover, which strangers see too", () => {
    expect(ownPictureState({ ...NONE, headerUrl: "h", headerStatus: "approved" })).toEqual({
      url: "h",
      tag: null,
      note: null,
      hasPicture: true,
    });
    expect(
      ownPictureState({ profileUrl: "p", profileStatus: "rejected", headerUrl: "h", headerStatus: "approved" }),
    ).toMatchObject({ url: "h", tag: PICTURE_TAG.rejected, hasPicture: true });
  });

  it("ignores an old cover that was never approved", () => {
    expect(ownPictureState({ ...NONE, headerUrl: "h", headerStatus: "pending" })).toEqual({
      url: null,
      tag: PICTURE_TAG.add,
      note: null,
      hasPicture: false,
    });
  });

  it("uses the cover when an approved picture could not be signed", () => {
    expect(ownPictureState({ profileUrl: null, profileStatus: "approved", headerUrl: "h", headerStatus: "approved" }).url).toBe("h");
  });

  it("has no em dash in its copy", () => {
    for (const text of [...Object.values(PICTURE_TAG), ...Object.values(PICTURE_NOTE)]) {
      expect(text).not.toContain("\u2014");
    }
  });
});
