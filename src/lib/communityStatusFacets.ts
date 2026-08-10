import { type DownloadState } from '@/lib/downloadState';
import { type WorldRecord } from '@/components/WorldDetails';

/**
 * The "what is this listing to me" filters, as opposed to what it is in itself (its author, its tags).
 *
 * They are one family rather than separate toggles because they answer one question and combine the same
 * way: every active facet must hold. `downloaded` and `undownloaded` together therefore match nothing,
 * which is the honest answer to asking for both rather than a case worth special-casing.
 */
export const STATUS_FACETS = ['liked', 'downloaded', 'undownloaded', 'update', 'mine'] as const;

export type StatusFacet = (typeof STATUS_FACETS)[number];

export const STATUS_FACET_LABELS: Record<StatusFacet, string> = {
  liked: 'Liked',
  downloaded: 'Downloaded',
  undownloaded: 'Not Downloaded',
  update: 'Has Update',
  mine: 'Mine',
};

/** Facets that only mean anything to a signed-in reader — likes and authorship both need an account. */
export const SIGNED_IN_FACETS: readonly StatusFacet[] = ['liked', 'mine'];

/** Narrow an arbitrary string to a facet id, for the stored state and the `status:` search prefix. */
export function asStatusFacet(value: string): StatusFacet | null {
  const v = value.trim().toLowerCase();
  return (STATUS_FACETS as readonly string[]).includes(v) ? (v as StatusFacet) : null;
}

/** The facets a reader may actually use: everything when signed in, the account-free ones when not. */
export function availableFacets(signedIn: boolean): StatusFacet[] {
  return STATUS_FACETS.filter((f) => signedIn || !SIGNED_IN_FACETS.includes(f));
}

/**
 * Whether a listing satisfies every active facet.
 *
 * `viewerId` is the signed-in account's id; without one the account-bound facets can never match, so a
 * stored `liked` chip that outlives a sign-out empties the grid rather than quietly matching everything.
 */
export function matchesStatusFacets(
  world: WorldRecord,
  facets: readonly StatusFacet[],
  downloadState: DownloadState,
  viewerId: string | undefined,
): boolean {
  return facets.every((facet) => {
    switch (facet) {
      case 'liked': return Boolean(viewerId) && Boolean(world.liked);
      case 'downloaded': return downloadState !== 'none';
      case 'undownloaded': return downloadState === 'none';
      case 'update': return downloadState === 'update';
      case 'mine': return Boolean(viewerId) && String(world.author?.id ?? '') === String(viewerId);
      default: return true;
    }
  });
}
