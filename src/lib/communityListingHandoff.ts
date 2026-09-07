import { CATALOG_KINDS, type CatalogKind } from '@/lib/catalogKinds';

export const COMMUNITY_LISTING_ID_PARAM = 'communityListingId';
export const COMMUNITY_LISTING_KIND_PARAM = 'communityListingKind';

/** A public listing target carried from the website into the browser game. */
export interface CommunityListingHandoff {
  id: string;
  kind: CatalogKind;
}

export function readCommunityListingHandoff(search: string): CommunityListingHandoff | null {
  const params = new URLSearchParams(search);
  const id = params.get(COMMUNITY_LISTING_ID_PARAM);
  const kind = params.get(COMMUNITY_LISTING_KIND_PARAM);
  if (!id?.trim() || !kind || !(CATALOG_KINDS as readonly string[]).includes(kind)) return null;

  return { id, kind: kind as CatalogKind };
}

/** Removes a consumed listing target without disturbing the browser game's own location. */
export function consumeCommunityListingHandoff(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(COMMUNITY_LISTING_ID_PARAM);
  url.searchParams.delete(COMMUNITY_LISTING_KIND_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
