import { DoorOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommunityListing } from '../communityListing';

export function CommunityOpenInAppLink({ listing }: { listing: CommunityListing }) {
  const params = new URLSearchParams({
    communityListingId: listing.id,
    communityListingKind: listing.kind,
  });

  return (
    <Button asChild variant="outline" className="shrink-0">
      <a href={`/play/?${params}`}>
        <DoorOpen className="mr-2 h-4 w-4" /> Open in app
      </a>
    </Button>
  );
}
