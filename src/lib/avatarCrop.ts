import { AVATAR_SIZE } from '@/lib/avatar';

/** What the reader has chosen: how far the source is scaled up, and where they dragged it. */
export interface CropTransform {
  /** Multiplier over the zoom that just fills the circle. 1 is "fits exactly". */
  zoom: number;
  /** Offset from center, in displayed pixels. */
  offsetX: number;
  offsetY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Nothing chosen yet: the source filling the circle, centered. */
export const IDENTITY_CROP: CropTransform = { zoom: 1, offsetX: 0, offsetY: 0 };

/**
 * The scale at which a source just covers a square of `frame` pixels.
 *
 * Cover rather than contain: a circle with letterboxing inside it reads as a mistake, and the reader can
 * always pan to whichever part they meant.
 *
 * @param width - Source width in pixels
 * @param height - Source height in pixels
 * @param frame - The square being filled
 * @returns The scale factor, or 0 for a source with no area
 */
export function coverScale(width: number, height: number, frame: number): number {
  if (!width || !height) return 0;

  return Math.max(frame / width, frame / height);
}

/**
 * Clamp a pan so the source cannot be dragged off its own frame.
 *
 * Without this the reader can pull the image away from under the circle and crop empty space, which the
 * preview shows honestly and then bakes in.
 *
 * @param transform - The chosen zoom and offset
 * @param width - Source width in pixels
 * @param height - Source height in pixels
 * @param frame - The square being filled
 * @returns The same transform with its offsets brought inside the allowed range
 */
export function clampCrop(
  transform: CropTransform,
  width: number,
  height: number,
  frame: number
): CropTransform {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, transform.zoom));
  const scale = coverScale(width, height, frame) * zoom;

  // How far each axis overhangs the frame; half of it in either direction is the travel available.
  const slackX = Math.max(0, (width * scale - frame) / 2);
  const slackY = Math.max(0, (height * scale - frame) / 2);

  return {
    zoom,
    offsetX: Math.min(slackX, Math.max(-slackX, transform.offsetX)),
    offsetY: Math.min(slackY, Math.max(-slackY, transform.offsetY)),
  };
}

/**
 * Rescale a pan when the preview frame changes size.
 *
 * The offsets are in displayed pixels, so a frame that grows or shrinks (a resized window, a different
 * breakpoint) would otherwise move the crop out from under the reader.
 *
 * @param transform - The chosen zoom and offset
 * @param fromFrame - The frame the offsets were measured against
 * @param toFrame - The frame they should be measured against now
 * @returns The transform in the new frame's terms
 */
export function rescaleCrop(transform: CropTransform, fromFrame: number, toFrame: number): CropTransform {
  if (!fromFrame || fromFrame === toFrame) return transform;

  const ratio = toFrame / fromFrame;

  return { ...transform, offsetX: transform.offsetX * ratio, offsetY: transform.offsetY * ratio };
}

/** Whether this browser's canvas can encode WebP; Firefox's cannot, and answers with a PNG instead. */
export function canEncodeWebp(): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;

    return probe.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * Render the chosen crop to a square data-URI.
 *
 * Always re-encodes, even when the source is already a WebP: the pixels change, so passing the original
 * through is not an option. Lossless, because the result is small either way and a face at 256 pixels is
 * exactly where lossy artifacts show.
 *
 * WebP unless the canvas cannot produce it, in which case a lossless PNG — the server accepts both.
 *
 * @param image - The decoded source
 * @param transform - The chosen zoom and offset, measured against `frame`
 * @param frame - The preview frame the offsets were measured in
 * @returns A `data:image/(webp|png);base64,…` URI
 */
export function renderCrop(
  image: HTMLImageElement | HTMLCanvasElement,
  transform: CropTransform,
  frame: number
): string {
  const width = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const height = 'naturalHeight' in image ? image.naturalHeight : image.height;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the image');

  const clamped = clampCrop(transform, width, height, frame);
  // The preview is `frame` wide and the output is AVATAR_SIZE; everything scales by the ratio between
  // them, which is what keeps what was on screen and what is saved the same picture.
  const ratio = AVATAR_SIZE / frame;
  const scale = coverScale(width, height, frame) * clamped.zoom * ratio;

  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const left = (AVATAR_SIZE - drawWidth) / 2 + clamped.offsetX * ratio;
  const top = (AVATAR_SIZE - drawHeight) / 2 + clamped.offsetY * ratio;

  context.imageSmoothingQuality = 'high';
  context.drawImage(image, left, top, drawWidth, drawHeight);

  // The square is stored whole and masked to a circle in CSS wherever it is shown. Baking the mask in
  // would leave transparent corners that read as a hole against any background but the one it was cut on.
  return canEncodeWebp() ? canvas.toDataURL('image/webp', 1) : canvas.toDataURL('image/png');
}

/**
 * Decode a picked file.
 *
 * An animated GIF or WebP decodes to its first frame, which is what makes an animated source usable
 * without carrying animation through a pipeline that cannot re-encode it.
 *
 * @param file - The picked file
 * @returns The decoded image, whose object URL the caller must revoke
 */
export function loadImageFile(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That file could not be read as an image'));
    };
    image.src = objectUrl;
  });
}
