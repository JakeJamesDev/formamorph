import { useEffect, useState } from 'react';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { isRecord } from '@/lib/tools/toolValidation';
import { useMountedRef } from '@/lib/useMountedRef';
import WorldStorageService from '@/services/WorldStorageService';

/** A Supporter-only Mascot listing, as the Mascot tab's locked entry shows it. */
export interface SupporterMascotListing {
  readonly id: string;
  readonly name: string;
  readonly thumbnailUrl: string | null;
}

/** Pinned listings come first, so one page holds every Supporter-only Mascot staff keep in view. */
const CATALOG_PAGE = 50;

/** The Supporter-only listings of a page of Mascot catalog rows. */
export function supporterMascotListingsOf(rows: readonly unknown[], apiUrl: string): SupporterMascotListing[] {
  return rows.flatMap((row) => {
    if (!isRecord(row) || row.supporter_only !== true) return [];
    const { id, name, thumbnail_file: file } = row;
    if ((typeof id !== 'string' && typeof id !== 'number') || typeof name !== 'string') return [];
    return [{ id: String(id), name, thumbnailUrl: typeof file === 'string' && file ? `${apiUrl}/thumbnails/${file}` : null }];
  });
}

/** The Supporter-only Mascot listings, read once per mount. None without Community or when the read fails. */
export function useSupporterMascotListings(): readonly SupporterMascotListing[] {
  const mounted = useMountedRef();
  const [listings, setListings] = useState<readonly SupporterMascotListing[]>([]);
  useEffect(() => {
    if (!COMMUNITY_ENABLED) return;
    void WorldStorageService.fetchRemoteWorlds(1, CATALOG_PAGE, '', false, false, '', 'desc', 'mascot').then((result) => {
      if (mounted.current && result.success) setListings(supporterMascotListingsOf(result.data, WorldStorageService.API_URL));
    });
  }, [mounted]);
  return listings;
}
