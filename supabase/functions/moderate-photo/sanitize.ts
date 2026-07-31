// Decodes and re-encodes an uploaded image server-side. This is the actual EXIF
// defense: client-side stripping is bypassable (anyone can call the Storage API
// directly with the anon key), so the only stripping that counts happens after the
// bytes are already in the bucket, before the photo is ever marked approved.
//
// Re-encoding buys three things at once:
//   1. EXIF/XMP/ICC metadata is gone — including GPS coordinates, which are a live
//      doxxing vector on a profile photo.
//   2. Real format validation. The bucket's allowed_mime_types only checks the
//      client-supplied Content-Type header; decode() checks the actual bytes, so a
//      .jpg that isn't a JPEG fails here.
//   3. Polyglot payloads (files that are simultaneously a valid image and a valid
//      archive/script) don't survive a decode/encode round trip.
import { decode, Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

/** Matches the bucket's file_size_limit in 0002_storage.sql. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Longest edge kept for a profile/header photo. Also caps a decompression bomb from
 * turning into a huge re-encode. */
const MAX_DIMENSION = 2048;

export interface SanitizedImage {
  bytes: Uint8Array;
  contentType: string;
  width: number;
  height: number;
}

export class ImageRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejectedError";
  }
}

export async function sanitizeImage(raw: Uint8Array): Promise<SanitizedImage> {
  if (raw.byteLength === 0) {
    throw new ImageRejectedError("Empty file");
  }
  if (raw.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageRejectedError("File exceeds the 5MB limit");
  }

  let decoded;
  try {
    decoded = await decode(raw);
  } catch {
    throw new ImageRejectedError("Not a decodable image");
  }

  // decode() also handles GIFs, which come back as a Frame collection rather than a
  // single Image. Profile photos are stills — reject rather than silently flattening.
  if (!(decoded instanceof Image)) {
    throw new ImageRejectedError("Animated images aren't supported for profile photos");
  }

  let image = decoded;
  const longestEdge = Math.max(image.width, image.height);
  if (longestEdge > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longestEdge;
    image = image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
  }

  // encodeJPEG() writes only pixel data — no metadata chunks are carried over from
  // the source, so this is where EXIF actually dies.
  const bytes = await image.encodeJPEG(85);
  return { bytes, contentType: "image/jpeg", width: image.width, height: image.height };
}
