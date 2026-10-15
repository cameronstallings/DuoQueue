import { describe, expect, it } from "vitest";

import { DRAFT_PHOTO_FOLDER, rebaseDraftPhotoUri } from "./draftPhotoPath";

const OLD_DOCS = "file:///var/mobile/Containers/Data/Application/AAAA-1111/Documents/";
const NEW_DOCS = "file:///var/mobile/Containers/Data/Application/BBBB-2222/Documents/";

describe("rebaseDraftPhotoUri", () => {
  it("moves a kept picture onto the current documents folder after the container changed", () => {
    expect(rebaseDraftPhotoUri(`${OLD_DOCS}${DRAFT_PHOTO_FOLDER}photo-1760500000000.jpg`, NEW_DOCS)).toBe(
      `${NEW_DOCS}onboarding-draft/photo-1760500000000.jpg`,
    );
  });

  it("leaves a picture already in the current folder as it is", () => {
    const uri = `${NEW_DOCS}onboarding-draft/photo-1.png`;
    expect(rebaseDraftPhotoUri(uri, NEW_DOCS)).toBe(uri);
  });

  it("leaves anything that is not a kept draft picture alone", () => {
    // The picker's own copy (a failed keep falls back to it).
    const cache = "file:///var/mobile/Containers/Data/Application/AAAA-1111/Library/Caches/ImagePicker/x.jpg";
    expect(rebaseDraftPhotoUri(cache, NEW_DOCS)).toBe(cache);
    // A nested path under the folder is not one this app writes.
    const nested = `${OLD_DOCS}onboarding-draft/sub/photo-1.jpg`;
    expect(rebaseDraftPhotoUri(nested, NEW_DOCS)).toBe(nested);
    // The folder with no file name.
    expect(rebaseDraftPhotoUri(`${OLD_DOCS}onboarding-draft/`, NEW_DOCS)).toBe(`${OLD_DOCS}onboarding-draft/`);
  });

  it("does nothing without a documents folder", () => {
    const uri = `${OLD_DOCS}onboarding-draft/photo-1.jpg`;
    expect(rebaseDraftPhotoUri(uri, null)).toBe(uri);
    expect(rebaseDraftPhotoUri(uri, undefined)).toBe(uri);
    expect(rebaseDraftPhotoUri(uri, "")).toBe(uri);
  });
});
