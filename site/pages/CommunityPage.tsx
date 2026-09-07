import { useCallback, useEffect, useState } from 'react';
import CommunityBrowserHost from '@/views/CommunityBrowserHost';
import { WEBSITE_COMMUNITY_CAPABILITIES } from '@/lib/communityBrowserCapabilities';
import { kindOf } from '@/lib/catalogKinds';
import type { WorldRecord } from '@/components/WorldDetails';
import { leaveTo } from '../leaveSite';
import { signInTo } from '../nextPath';
import { SiteAgeGate } from '../components/SiteAgeGate';
import { SiteLayout } from '../components/SiteLayout';
import {
  communityListingPath,
  communityListingTarget,
  type CommunityListing,
  type CommunityListingTarget,
} from '../communityListing';
import { navigateSite, useSiteLocation } from '../router';

/** The public, read-only community catalog. The warning gate stays outside the host so it cannot fetch early. */
export function CommunityPage() {
  const { pathname } = useSiteLocation();
  const [target, setTarget] = useState<CommunityListingTarget>(() => communityListingTarget(pathname));
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setTarget(communityListingTarget(pathname));
    setUnavailable(false);
  }, [pathname]);

  const setListing = useCallback((listing: CommunityListing | null) => {
    if (target.status === 'listing'
      && listing
      && target.listing.id === listing.id
      && target.listing.kind === listing.kind) return;
    if (target.status === 'catalog' && !listing) return;

    navigateSite(listing ? communityListingPath(listing) : '/community');
  }, [target]);

  const signInToLike = useCallback((world: WorldRecord) => {
    leaveTo(signInTo(communityListingPath({
      id: String(world._id || world.id),
      kind: kindOf(world),
    })));
  }, []);

  if (target.status === 'invalid') {
    return (
      <SiteAgeGate>
        <SiteLayout title="Creation unavailable" subtitle="This creation link cannot be opened.">
          <p role="alert" className="text-label text-destructive">This creation link is unavailable.</p>
        </SiteLayout>
      </SiteAgeGate>
    );
  }

  const listing = target.status === 'listing' ? target.listing : null;

  return (
    <SiteAgeGate>
      <SiteLayout surface>
        {unavailable && (
          <p role="alert" className="px-6 py-3 text-label text-destructive">
            This creation is no longer available.
          </p>
        )}
        <CommunityBrowserHost
          open
          onOpenChange={(open) => { if (!open) leaveTo('/'); }}
          presentation="embedded"
          capabilities={WEBSITE_COMMUNITY_CAPABILITIES}
          listing={unavailable ? null : listing}
          onListingChange={setListing}
          onListingUnavailable={() => setUnavailable(true)}
          onGuestLike={signInToLike}
        />
      </SiteLayout>
    </SiteAgeGate>
  );
}
