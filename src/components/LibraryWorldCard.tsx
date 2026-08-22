import SortableWorldCard from '@/components/SortableWorldCard';
import { WinnerBadges } from '@/components/WinnerBadges';
import { contestsWonBy } from '@/lib/contests';
import type { WorldRecord } from '@/components/WorldDetails';
import type { ServerEvent } from '@/types';

/**
 * A world's tile in the local library — the shared card, plus whatever the contest archive says about it.
 *
 * Winner status is worked out here at render rather than stored on the copy, so a contest decided long
 * after the download still reaches the library, an edited copy keeps what it earned, and an archive that
 * could not be fetched simply badges nothing.
 *
 * @param contests - The contest archive on hand; empty offline
 */
export function LibraryWorldCard({ world, contests, layout, onSelect, onDelete }: {
  world: WorldRecord;
  contests: ServerEvent[];
  layout: 'grid' | 'detailed';
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const wins = contestsWonBy(world, contests);

  return (
    <SortableWorldCard
      world={world}
      layout={layout}
      // The grid tile is all thumbnail, so the badge rides a plate over it; the detailed card has a body
      // to put the same line in. Only the overlay is guarded — that slot wraps whatever it is given in a
      // positioned box, and a box around nothing is still a box.
      badge={wins.length > 0
        ? <WinnerBadges contests={wins} className="rounded bg-overlay/70 px-1.5 py-0.5" />
        : undefined}
      note={<WinnerBadges contests={wins} className="mb-2" />}
      onSelect={onSelect}
      onDelete={onDelete}
    />
  );
}
