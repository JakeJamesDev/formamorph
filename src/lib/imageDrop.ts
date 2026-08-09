import { isRemoteImage } from './imageBytes';

/**
 * What a drag onto an image slot is carrying. Two shapes reach the uploader: files off the desktop, which
 * cost payload bytes and go through the optimize pass, and a picture dragged out of a browser tab, which
 * arrives as a link and costs nothing.
 */
export type ImageDropPayload =
  | { kind: 'files'; files: File[] }
  | { kind: 'url'; url: string };

/** Image files in the drag, in drop order. Non-images are dropped rather than failing the whole gesture —
 *  dragging a folder's worth of mixed files should still bring in the pictures. */
export const imageFilesFrom = (dt: Pick<DataTransfer, 'files'>): File[] =>
  Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'));

/** The link behind a picture dragged out of a browser tab. `text/uri-list` is what browsers set for an image
 *  drag; `text/plain` is the fallback for a URL dragged from the address bar or a text selection. A
 *  uri-list may hold several lines, comment lines first — the first real URL is the one dragged. */
export const imageUrlFrom = (dt: Pick<DataTransfer, 'getData'>): string | null => {
  for (const type of ['text/uri-list', 'text/plain']) {
    const raw = dt.getData(type);
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      const url = line.trim();
      if (!url || url.startsWith('#')) continue;
      if (isRemoteImage(url)) return url;
      break; // a non-URL first line means this flavor isn't carrying one
    }
  }
  return null;
};

/** Files win over the link: a browser image drag sets both flavors, and the bytes are the better copy. */
export const imageDropPayload = (dt: DataTransfer | null): ImageDropPayload | null => {
  if (!dt) return null;
  const files = imageFilesFrom(dt);
  if (files.length) return { kind: 'files', files };
  const url = imageUrlFrom(dt);
  return url ? { kind: 'url', url } : null;
};

/** True while a drag that this widget could actually take is overhead. Read from `types` rather than the
 *  data itself, which browsers withhold until drop — so a drag of something useless never lights the box. */
export const canDropImage = (dt: DataTransfer | null): boolean =>
  !!dt && dt.types.some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/plain');

/** A dropped file as a data URL, the same form the file picker's FileReader produces. */
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
