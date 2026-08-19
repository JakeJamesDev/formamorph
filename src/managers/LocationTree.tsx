import { randomUUID } from "@/lib/uuid";
import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import {
  locationRows, removeCollapsedChildren, getLocationDropProjection,
  applyLocationDrop, removeLocationPromotingChildren, type FlatLocationNode,
} from '@/lib/locationTree';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { TREE_INDENT } from '@/components/EditorRow';
import { EmptyListHint } from '@/components/EmptyListHint';
import PlaceholderText from '@/components/prompt/PlaceholderText';

/** The Locations tab's sub-location tree: a flat sortable list where horizontal drag sets nesting depth. */
const LocationTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { locations, setLocations, placeholders } = useGameData();

  // Ids that are a parent of at least one location — drives the chevron (from the full list, so a
  // collapsed node still shows its expand chevron).
  const parentIds = useMemo(
    () => new Set(locations.map((l) => l.parentId ?? null).filter((p): p is string => p !== null)),
    [locations],
  );

  const adapter: SortableTreeAdapter<FlatLocationNode> = {
    getVisible: (collapsed) => removeCollapsedChildren(locationRows(locations), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getLocationDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      const next = applyLocationDrop(locations, collapsed, activeId, overId, offsetLeft, TREE_INDENT);
      if (next !== locations) setLocations(next);
    },
    rowSpec: (node) => ({
      // Every location can hold children, so non-parents reserve the chevron slot for alignment.
      lead: parentIds.has(node.id) ? 'chevron' : 'spacer',
      collapseLabels: ['Expand sub-locations', 'Collapse sub-locations'],
      label: <PlaceholderText text={node.location.name} placeholders={placeholders} />,
      remove: () => setLocations(removeLocationPromotingChildren(locations, node.id)),
      duplicate: () => {
        const index = locations.findIndex((l) => l.id === node.id);
        if (index === -1) return;
        const copy = { ...structuredClone(locations[index]), id: randomUUID() };
        copy.name = `${copy.name} (Copy)`;
        setLocations([...locations.slice(0, index + 1), copy, ...locations.slice(index + 1)]);
        onSelect(copy.id);
      },
    }),
  };

  if (!locations.length) {
    return <EmptyListHint noun="locations" />;
  }

  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />;
};

export default LocationTree;
