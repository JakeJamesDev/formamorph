/** Opens a page outside the app: a new tab on the web, the system browser in the desktop and Android shells. */
export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
