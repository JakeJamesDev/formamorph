import CommunityBrowserHost from '@/views/CommunityBrowserHost';
import { WEBSITE_COMMUNITY_CAPABILITIES } from '@/lib/communityBrowserCapabilities';
import { leaveTo } from '../leaveSite';
import { SiteAgeGate } from '../components/SiteAgeGate';
import { SiteLayout } from '../components/SiteLayout';

/** The public, read-only community catalog. The warning gate stays outside the host so it cannot fetch early. */
export function CommunityPage() {
  return (
    <SiteAgeGate>
      <SiteLayout surface>
        <CommunityBrowserHost
          open
          onOpenChange={(open) => { if (!open) leaveTo('/'); }}
          presentation="embedded"
          capabilities={WEBSITE_COMMUNITY_CAPABILITIES}
        />
      </SiteLayout>
    </SiteAgeGate>
  );
}
