import { toast } from 'react-toastify';

/** Header the bundled local engine sets with the count of image parts it dropped. */
export const IMAGES_DROPPED_HEADER = 'X-Formamorph-Images-Dropped';

let warned = false;

/** Warns once per session when a response says the local engine dropped images. */
export function noteImagesDropped(response: Pick<Response, 'headers'>): void {
  if (warned) return;
  const count = Number(response.headers?.get(IMAGES_DROPPED_HEADER));
  if (!(count > 0)) return;
  warned = true;
  toast.warning("The local engine can't read images. The turn ran on text alone.");
}

/** Clears the once-per-session flag. Tests only. */
export function resetImagesDroppedWarning(): void {
  warned = false;
}
