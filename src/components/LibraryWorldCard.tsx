import SortableWorldCard from '@/components/SortableWorldCard';
import { PlaceBadges } from '@/components/PlaceBadges';
import { placementsBy } from '@/lib/contests';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

/**
 * A world's tile in the local library — the shared card, plus whatever the contest archive says about it.
 *
 * Placement is worked out here at render rather than stored on the copy, so a contest decided long
 * after the download still reaches the library, an edited copy keeps what it earned, and an archive that
 * could not be fetched simply badges nothing.
 *
 * @param contests - The contest archive on hand; empty offline
 */
export function LibraryWorldCard({ world, contests, layout, onSelect, fill, compact }: {
  world: WorldRecord;
  contests: ServerEvent[];
  layout: 'grid' | 'detailed';
  onSelect: (id: string) => void;
  /** Fill the tile the grid hands it, instead of taking its height from the layout. */
  fill?: boolean;
  /** Trade the name strip for a tooltip, on the smallest tile size. */
  compact?: boolean;
}) {
  // A blank tile has no download link to match against the archive, so it is badged with nothing.
  const loading = !!world.isLoading;
  const placements = loading ? [] : placementsBy(world, contests);

  return (
    <SortableWorldCard
      world={world}
      layout={layout}
      fill={fill}
      compact={compact}
      loading={loading}
      // The grid tile is all thumbnail, so the badge rides a plate over it; the detailed card has a body
      // to put the same line in. Only the overlay is guarded — that slot wraps whatever it is given in a
      // positioned box, and a box around nothing is still a box.
      badge={placements.length > 0
        ? <PlaceBadges placements={placements} className="rounded bg-overlay/70 px-1.5 py-0.5" />
        : undefined}
      note={<PlaceBadges placements={placements} className="mb-2" />}
      onSelect={onSelect}
    />
  );
}
