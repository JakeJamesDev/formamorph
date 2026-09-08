import { useState, type MouseEvent } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { RemoteWorldCard } from '@/components/community/RemoteWorldCard';
import type { WorldRecord } from '@/components/WorldDetails';
import { Button } from '@/components/ui/button';
import { Hint, Meta } from '@/components/ui/typography';

const CARD_ART = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#27334d"/><stop offset="1" stop-color="#7b466e"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#31576f"/><stop offset="1" stop-color="#111c2c"/></linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#sky)"/><path d="M0 320 160 250 300 300 470 205 620 290 760 220 960 280V540H0Z" fill="#1a2234"/><path d="M0 355Q150 320 300 365T620 350 960 375V540H0Z" fill="url(#water)"/><circle cx="684" cy="134" r="52" fill="#f7d9a8" opacity=".88"/><path d="M220 326V190h56v136m-82 0V236h32v90m76 0V158h38v168" stroke="#e8c9ab" stroke-width="12"/><path d="M110 402h740" stroke="#d7e0f1" stroke-opacity=".35" stroke-width="3"/>
</svg>`);

const COMMUNITY_READER: WorldRecord = {
  id: 'showcase-reader',
  username: 'map-reader',
};

const FEATURED_WORLD: WorldRecord = {
  id: 'showcase-lantern-ledger',
  name: 'The Lantern Ledger of Brinewatch, or: Every Secret the Harbor Keeps After Midnight',
  description: 'A coastal mystery for one reader. Follow old charts, bargain with lighthouse keepers, and decide which names belong in the town ledger.',
  kind: 'world',
  thumbnail: `data:image/svg+xml,${CARD_ART}`,
  author: { id: 'river-quill', username: 'river-quill' },
  downloads: 1284,
  comment_count: 47,
  likes: 286,
  liked: true,
  tags: ['Mystery', 'Coastal', 'Single player', 'Low combat', 'Investigation', 'Atmospheric', 'Long-form', 'Character-driven', 'Historical fantasy', 'Open-ended', 'Quiet horror', 'Handcrafted maps', 'Branching consequences', 'Readable typography', 'Sea folklore'],
};

const UPDATE_WORLD: WorldRecord = {
  id: 'showcase-glass-marsh',
  name: 'The Glass Marsh Almanac',
  description: 'A survey expedition returns to a flooded observatory before the tide erases its last safe path.',
  kind: 'world',
  thumbnail: `data:image/svg+xml,${CARD_ART}`,
  author: { id: 'mira-vale', username: 'mira-vale' },
  downloads: 617,
  comment_count: 19,
  likes: 104,
  liked: false,
  tags: ['Exploration', 'Folklore', 'Puzzle'],
};

type PendingLike = {
  complete: () => void;
  next: boolean;
};

export function CommunityCardReference() {
  const [featuredLiked, setFeaturedLiked] = useState(Boolean(FEATURED_WORLD.liked));
  const [selectedName, setSelectedName] = useState<string>();
  const [lastAction, setLastAction] = useState('Select a creation.');
  const [pendingLike, setPendingLike] = useState<PendingLike>();

  const featuredWorld = { ...FEATURED_WORLD, liked: featuredLiked };
  const stopCardClick = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();

  const queueLike = async (_world: WorldRecord, next: boolean) => new Promise<void>((complete) => {
    setPendingLike({ complete, next });
    setLastAction(next ? 'The Like action is not complete.' : 'The Unlike action is not complete.');
  });

  const completeLike = () => {
    if (!pendingLike) return;
    setFeaturedLiked(pendingLike.next);
    setLastAction(pendingLike.next ? 'The local Like action is complete.' : 'The local Unlike action is complete.');
    pendingLike.complete();
    setPendingLike(undefined);
  };

  return (
    <section className="grid gap-6" aria-labelledby="community-card-reference-title">
      <div className="grid gap-2">
        <h3 id="community-card-reference-title" className="text-heading">Community Creation Cards</h3>
        <Hint>
          Each card shows a creation. The title and author appear on the image. The description, counts, and tags appear below the image.
        </Hint>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RemoteWorldCard
          world={featuredWorld}
          downloadState="none"
          downloadProgress={undefined}
          isAuthenticated
          currentUser={COMMUNITY_READER}
          onView={(world) => {
            setSelectedName(world.name);
            setLastAction(`The selected creation is ${world.name}.`);
          }}
          onLike={queueLike}
        />
        <RemoteWorldCard
          world={UPDATE_WORLD}
          downloadState="update"
          downloadProgress={undefined}
          isAuthenticated
          currentUser={COMMUNITY_READER}
          onView={(world) => {
            setSelectedName(world.name);
            setLastAction(`The selected creation is ${world.name}.`);
          }}
          onContextualDownload={(world) => setLastAction(`The local update action started for ${world.name}.`)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 p-3" onClick={stopCardClick}>
        <Meta aria-live="polite" className="min-w-0 flex-1">{lastAction}</Meta>
        {selectedName && <span className="inline-flex items-center gap-1 text-helper text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Selected</span>}
        {pendingLike ? (
          <Button size="sm" onClick={completeLike}>
            <CircleDashed className="h-3.5 w-3.5" /> Complete Local Action
          </Button>
        ) : (
          <Meta>Select the Like or Unlike button.</Meta>
        )}
      </div>
    </section>
  );
}
