/**
 * Leave the site entry with a real page load.
 *
 * A finished sign-in returns to wherever the reader came from, and that is often not one of this
 * entry's own routes — the landing page and `/play/` are separate documents that read the session at
 * start-up. Pushing history would leave both of them showing a signed-out page.
 *
 * It is a module of its own so a test can watch where a page sent the reader; jsdom implements no
 * navigation and would only log that it did not.
 *
 * @param path - An absolute path on this site, already through `safeNextPath`
 */
export function leaveTo(path: string): void {
  window.location.assign(path);
}
