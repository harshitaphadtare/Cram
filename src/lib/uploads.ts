/**
 * Image upload limit. Vercel rejects request bodies over 4.5 MB before they reach our route, so
 * we stay under that and check in the browser first to give a clear message.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";

export function assertUploadSize(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Images must be ${MAX_UPLOAD_LABEL} or smaller.`);
  }
}
