/**
 * Trigger a browser file download of `blob` saved as `filename` — the standard
 * create-anchor/click/remove dance, with the object URL revoked afterward.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}
