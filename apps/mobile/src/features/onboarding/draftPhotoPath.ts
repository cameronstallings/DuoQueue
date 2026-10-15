/**
 * Where the draft's kept picture lives, as a rule that needs no file system (draftPhotoPath.test.ts).
 *
 * The draft stores the picture as an absolute file:// uri inside the app's Documents folder
 * (draftPhoto.ts). On iOS that folder's path carries the app container's id, which can change when
 * the app is updated, and a draft can live through an update (7 days). The file moves with the
 * container; the stored uri does not. So a uri that points into our own folder is re-anchored on
 * the CURRENT documents folder before it is used, and a picture kept before an update still
 * uploads at Save instead of "Your picture didn't upload".
 */

/** The folder under documentDirectory that holds the draft's picture (one file, photo-<ms>.<ext>). */
export const DRAFT_PHOTO_FOLDER = "onboarding-draft/";

/**
 * The same picture under today's `documentDirectory`. Only a file directly inside our folder is
 * moved; any other uri (the picker's own copy, which a failed keep falls back to) is returned as
 * it is, as is everything when the documents folder is unknown.
 */
export function rebaseDraftPhotoUri(uri: string, documentDirectory: string | null | undefined): string {
  if (!documentDirectory) return uri;
  const marker = `/${DRAFT_PHOTO_FOLDER}`;
  const at = uri.lastIndexOf(marker);
  if (at < 0) return uri;
  const name = uri.slice(at + marker.length);
  if (name === "" || name.includes("/")) return uri;
  const base = documentDirectory.endsWith("/") ? documentDirectory : `${documentDirectory}/`;
  return `${base}${DRAFT_PHOTO_FOLDER}${name}`;
}
