/** One community listing as represented in a website destination. */
export interface CommunityListing {
  id: string;
  kind: 'world' | 'entity' | 'dictionary';
}

export type CommunityListingTarget =
  | { status: 'catalog' }
  | { status: 'listing'; listing: CommunityListing }
  | { status: 'invalid' };

const COMMUNITY_LISTING = /^\/community\/(world|entity|dictionary)\/([^/]+)$/;

/** The canonical, shareable path for an individual public creation. */
export function communityListingPath({ kind, id }: CommunityListing): string {
  return `/community/${kind}/${encodeURIComponent(id)}`;
}

/** Reads a community path without treating malformed targets as the general catalog. */
export function communityListingTarget(pathname: string): CommunityListingTarget {
  if (pathname === '/community') return { status: 'catalog' };

  const match = COMMUNITY_LISTING.exec(pathname);
  if (!match) return pathname.startsWith('/community/') ? { status: 'invalid' } : { status: 'catalog' };

  try {
    const id = decodeURIComponent(match[2]);
    if (!id) return { status: 'invalid' };

    const kind = match[1];
    if (kind !== 'world' && kind !== 'entity' && kind !== 'dictionary') return { status: 'invalid' };

    return { status: 'listing', listing: { kind, id } };
  } catch {
    return { status: 'invalid' };
  }
}
