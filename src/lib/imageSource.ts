/**
 * Remote-vs-embedded image handling.
 *
 * Every image field in the app stores a bare string. An author may now paste an `http(s)` URL instead of
 * uploading bytes, which keeps a published world's payload small. Which kind a value is comes from its own
 * prefix rather than from a companion field, so no stored shape changes and a world written before this
 * feature stays byte-identical.
 */
import { optimizeImageDataUrl, type ImageCap } from './imageOptim';
import { imageHost } from './imageBytes';

// Re-exported so callers have one import for "anything about where an image comes from"; the predicates
// themselves live in the DOM-free leaf so the optimize pipeline can use them too.
export { isRemoteImage, imageHost } from './imageBytes';

/**
 * Download a remote image and return it as an optimized data URL.
 *
 * Unlike rendering, this needs permissive CORS from the host: `<img>` does not read bytes, and this does.
 * A host that serves the picture perfectly can still refuse here, so callers must surface the failure rather
 * than swallow it. The desktop build widens every external response's CORS headers, so this succeeds against
 * any host there.
 *
 * @throws When the host is unreachable, answers non-2xx, blocks the read, or returns something that isn't an image.
 */
export async function fetchAsDataUrl(url: string, cap: ImageCap): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`Couldn't download the image from ${imageHost(url)} — the site may not allow it.`);
  }
  if (!response.ok) throw new Error(`${imageHost(url)} answered ${response.status} for that image.`);

  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error(`That link from ${imageHost(url)} isn't an image.`);

  const dataUrl = await blobToDataUrl(blob);
  return optimizeImageDataUrl(dataUrl, cap);
}

/** Blob → data URL. FileReader rather than a manual base64 pass so the mime comes along for free. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the downloaded image.'));
    reader.readAsDataURL(blob);
  });
}
