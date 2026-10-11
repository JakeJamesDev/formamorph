/**
 * Opens a page outside the app: a new tab on the web, the system browser in the desktop and Android shells.
 * Electron denies the popup and hands the URL to the OS (`setWindowOpenHandler` in `electron/main.cjs`).
 * Android, read from the Capacitor source and not run on a device: the popup stays in the one WebView, where
 * `shouldOverrideUrlLoading` sends a host other than the app's to an `ACTION_VIEW` intent.
 */
export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
