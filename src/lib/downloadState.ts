/** Contextual state of a Discover world's download button, derived by comparing the server's live
 *  `updated_at` against the source version(s) of the local copies the user already holds. */
export type DownloadState = 'none' | 'refresh' | 'update';

/** The slice of a local copy this comparison needs. */
export interface DownloadCopy {
  sourceUpdatedAt?: string;
}

/** Decide whether a server world is not downloaded, current (refresh), or has a newer version (update).
 *  `update` when *any* copy we hold predates the server's `updated_at` — even if another copy is current
 *  — so an out-of-date copy is never masked by a fresh one. Missing/unparsable stamps default to
 *  `refresh` (safe — never a false "update"). */
export function getDownloadState(
  serverUpdatedAt: string | undefined,
  copies: DownloadCopy[],
): DownloadState {
  if (copies.length === 0) return 'none';

  const serverTime = Date.parse(serverUpdatedAt ?? '');
  if (Number.isNaN(serverTime)) return 'refresh';

  const heldTimes = copies
    .map((c) => Date.parse(c.sourceUpdatedAt ?? ''))
    .filter((t) => !Number.isNaN(t));
  if (heldTimes.length === 0) return 'refresh';

  return heldTimes.some((t) => t < serverTime) ? 'update' : 'refresh';
}
