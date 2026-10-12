import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Hint } from '@/components/ui/typography';
import { usePlacementLetters } from '@/contexts/PlacementLettersContext';
import { statLinksBoundTo, statLinksCarriedFrom } from '@/lib/portableStats';
import { NO_STAT_WORLD, type StatLinkWorld } from '@/lib/statLinks';
import type { Entity, Placeholder } from '@/types';
import EntityStatsEditor from './EntityStatsEditor';
import type { LibraryEditorWorld } from '@/lib/libraryGateInput';

/**
 * A library entity's Stats tab: the shared entity stats editor, side by side, over the entity's own stats.
 * Opened inside `world`, a Link reads its Blueprint there and stores its edits named from it; standalone, and
 * when the world has no such Blueprint, it reads by its stored name and brings nothing. No Link is made here.
 * The tab unmounts on a tab switch, so its selection starts over each time it opens.
 */
const LibraryStatsEditor = ({ entity, setEntity, placeholders, world = null, detailHeader }: {
  entity: Entity;
  setEntity: Dispatch<SetStateAction<Entity | null>>;
  placeholders: Placeholder[];
  world?: LibraryEditorWorld | null;
  detailHeader?: ReactNode;
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const letters = usePlacementLetters();
  const linkWorld = useMemo<StatLinkWorld>(
    () => (world?.stats ? { stats: world.stats, statGroups: world.statGroups ?? [] } : NO_STAT_WORLD),
    [world],
  );
  const bound = useMemo(() => (world ? statLinksBoundTo(entity, world) : entity), [entity, world]);
  const edit = (change: (e: Entity) => Entity) => setEntity((prev) => {
    if (!prev) return prev;
    return world ? statLinksCarriedFrom(change(statLinksBoundTo(prev, world)), world) : change(prev);
  });
  return (
    <EntityStatsEditor
      entity={bound}
      world={linkWorld}
      edit={edit}
      names={{ placeholders, letters }}
      layout="sideBySide"
      selectedId={selectedId}
      onSelect={setSelectedId}
      canLink={false}
      standalone={linkWorld === NO_STAT_WORLD}
      placeholder="Search or add new stats"
      emptyHint={<Hint className="p-2">No stats yet. Add one to track something about this entity.</Hint>}
      detailHeader={detailHeader}
    />
  );
};

export default LibraryStatsEditor;
