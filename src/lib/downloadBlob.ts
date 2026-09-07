import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { toast } from 'react-toastify';

interface FileExportPlugin {
  save(options: { uri: string; filename: string; mimeType: string }): Promise<void>;
}

const FileExport = registerPlugin<FileExportPlugin>('FormamorphFileExport');

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

/** Stage each export separately while the native Save As picker is open. */
async function saveFile(blob: Blob, filename: string): Promise<void> {
  const path = `exports/${crypto.randomUUID()}`;
  const { uri } = await Filesystem.writeFile({
    path,
    data: await toBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  try {
    await FileExport.save({
      uri,
      filename: filename.replace(/[/\\]/g, '-'),
      mimeType: blob.type || 'application/octet-stream',
    });
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch((error: unknown) => {
      console.warn('Could not remove the temporary export:', error);
    });
  }
}

/** Save a file through Android's Save As picker or a browser download. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (Capacitor.isNativePlatform()) {
    saveFile(blob, filename).catch((error: unknown) => {
      // The plugin's own text names its internals, so the player gets ours and the log keeps the reason.
      console.error('Failed to save an export:', error);
      toast.error(`Could not save ${filename}.`);
    });
    return;
  }
  const href = URL.createObjectURL(blob);
  downloadUrl(href, filename);
  URL.revokeObjectURL(href);
}
