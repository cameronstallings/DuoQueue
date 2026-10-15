import * as FileSystem from "expo-file-system/legacy";

/**
 * The draft's one optional picture, kept where it survives a relaunch.
 *
 * The image picker hands back a file in its cache, and iOS may purge that cache between launches.
 * 1.0.1 uploaded the picture minutes later in the same session, so that never mattered. A 1.0.2
 * draft can sit for days before Save, so the picture is copied into the app's documents folder
 * the moment it is picked, and the draft stores the copy's uri.
 *
 * Every call is fail-soft: a failed copy keeps the original uri (it works for this launch), a
 * failed existence check reads as "gone" (the commit then skips the upload and says so, exactly
 * like a failed upload), and a failed clear is only a stale file.
 */

const FOLDER = "onboarding-draft/";

function folderUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${FOLDER}` : null;
}

function extensionOf(uri: string): string {
  const ext = uri.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  // Kept, because the upload derives the content type from it.
  return ext === "png" || ext === "webp" || ext === "jpeg" ? ext : "jpg";
}

export async function keepDraftPhoto(uri: string): Promise<string> {
  const folder = folderUri();
  if (!folder) return uri;
  try {
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const target = `${folder}photo-${Date.now()}.${extensionOf(uri)}`;
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch (err) {
    console.warn("Could not keep the draft picture; using the picker's copy:", err);
    return uri;
  }
}

export async function draftPhotoExists(uri: string | null): Promise<boolean> {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export async function clearDraftPhotos(): Promise<void> {
  const folder = folderUri();
  if (!folder) return;
  try {
    await FileSystem.deleteAsync(folder, { idempotent: true });
  } catch (err) {
    console.warn("Could not clear the draft pictures:", err);
  }
}
