import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'react-toastify';

/** Android rejects a dismissed chooser like a failure, and this message is the only signal it gives. */
const SHARE_DISMISSED = 'Share canceled';

/**
 * Trigger a browser file download of an existing `href` (a regular URL or a `data:` URL) saved as
 * `filename` — the standard create-anchor/click/remove dance.
 */
function downloadUrl(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Base64 payload of `blob`, with the `data:` prefix cut. The native Filesystem plugin takes base64. */
async function toBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the export'));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/**
 * Stage `blob` in the app's cache directory and hand that file to the Android share sheet. The cache
 * is the one place the app writes without a storage permission, and the manifest's file provider
 * exposes it to the app the player picks. A separator in the name would read as a directory, so the
 * whole name becomes one path segment.
 */
async function shareFile(blob: Blob, filename: string): Promise<void> {
  const { uri } = await Filesystem.writeFile({
    path: filename.replace(/[/\\]/g, '-'),
    data: await toBase64(blob),
    directory: Directory.Cache,
  });
  await Share.share({ title: filename, files: [uri] });
}

/**
 * Save `blob` as `filename`: the share sheet in the Android app, an anchor download everywhere else.
 * The Android WebView has no download manager, so the sheet is how a file leaves the app at all.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (Capacitor.isNativePlatform()) {
    shareFile(blob, filename).catch((error: unknown) => {
      if ((error as Error).message === SHARE_DISMISSED) return;
      // The plugin's own text names its internals, so the player gets ours and the log keeps the reason.
      console.error('Failed to share an export:', error);
      toast.error(`Could not share ${filename}.`);
    });
    return;
  }
  const href = URL.createObjectURL(blob);
  downloadUrl(href, filename);
  URL.revokeObjectURL(href);
}
