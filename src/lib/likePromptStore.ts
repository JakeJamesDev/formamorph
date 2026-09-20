/**
 * Which listings this device has already been asked to like, so the in-game prompt asks once and then
 * goes quiet (the help/tutorial seen-state precedent).
 *
 * Keyed by listing id rather than by local world id: two copies of one world are one listing, and a
 * re-download is the same listing again. Per-device and outside both the world record and the save, so
 * neither export shape changes and a shared save never carries one player's answer to another.
 *
 * Local-only UI state. Writes are try/catch'd because private-mode browsers throw on `setItem`; a failed
 * write just means the prompt returns on a later turn.
 */

const PROMPTED_KEY = 'FORMAMORPH_likePrompted';

/** The listings already asked about. A malformed or absent value reads as "none asked". */
export function promptedListings(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(PROMPTED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/** Record that this listing was asked about. No-op when it already was. */
export function markListingPrompted(listingId: string): void {
  const asked = promptedListings();
  if (asked.has(listingId)) return;
  try {
    localStorage.setItem(PROMPTED_KEY, JSON.stringify([...asked, listingId]));
  } catch {
    /* private mode — the prompt returns on a later turn */
  }
}
