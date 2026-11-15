/**
 * Which Supporter Copies the signed-in account may see. A copy marked for another account stays stored until
 * that account's first good check removes it, and stays hidden from every listing meanwhile. Signed out, no
 * copy is hidden, the same as the Supporter content module that serves its cache inside the offline window.
 */

let viewer: () => string | null = () => null;

/** Bind the signed-in account's id, or null when signed out. */
export function bindCopyViewer(accountId: () => string | null): void {
  viewer = accountId;
}

/** Whether a stored copy's marker belongs to an account other than the signed-in one. */
export function isHiddenCopy(marker: { accountId: string } | null | undefined): boolean {
  const account = viewer();
  return !!marker && account !== null && marker.accountId !== account;
}
