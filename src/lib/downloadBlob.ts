/**
 * Trigger a browser file download of an existing `href` (a regular URL or a `data:` URL) saved as
 * `filename` — the standard create-anchor/click/remove dance.
 */
export function downloadUrl(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Trigger a browser file download of `blob` saved as `filename`, revoking the temporary object URL
 * afterward.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  downloadUrl(href, filename);
  URL.revokeObjectURL(href);
}
