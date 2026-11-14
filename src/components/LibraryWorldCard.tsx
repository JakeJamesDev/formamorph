import SortableWorldCard from '@/components/SortableWorldCard';
import { PlaceBadges } from '@/components/PlaceBadges';
import { PatreonMark } from '@/components/PatreonMark';
import { SUPPORTER_WORLD_TIP } from '@/lib/supporterCopy';
import { placementsBy } from '@/lib/contests';
import { useWorldOptimizeProgress } from '@/lib/worldOptimizeProgress';
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
  const progress = useWorldOptimizeProgress(world.id);
  const supporter = !loading && world.supporterCopy
    ? <PatreonMark label="Supporter world" tip={SUPPORTER_WORLD_TIP} />
    : null;

  return (
    <SortableWorldCard
      world={world}
      layout={layout}
      fill={fill}
      compact={compact}
      loading={loading}
      progress={progress}
      // The grid tile is all thumbnail, so the badge overlays it; the detailed card has a body to put
      // the same line in. Only the overlay is guarded — that slot wraps whatever it is given in a
      // positioned box, and a box around nothing is still a box.
      badge={supporter || placements.length > 0
        ? <div className="flex items-start gap-1">{supporter}{placements.length > 0 && <PlaceBadges placements={placements} />}</div>
        : undefined}
      note={supporter
        ? <div className="mb-2 flex items-start gap-1">{supporter}<PlaceBadges placements={placements} /></div>
        : <PlaceBadges placements={placements} className="mb-2" />}
      onSelect={onSelect}
    />
  );
}
