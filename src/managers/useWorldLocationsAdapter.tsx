import { arrayMove } from '@dnd-kit/sortable';
import { Copy, X } from 'lucide-react';
import { EmptyListHint } from '@/components/EmptyListHint';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { useGameData } from '@/contexts/GameDataContext';
import { newLocation } from '@/lib/blankWorld';
import { matchesListSearch } from '@/lib/listSearch';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint } from '@/types';
import { focusFieldForItem } from '@/views/findFocus';
import type { LocationPanelTab } from '@/views/locationPanelTabs';
import type { LocationView } from '@/views/locationViews';
import LocationCanvas from './LocationCanvas';
import LocationManager from './LocationManager';
import LocationTree from './LocationTree';

/** The World Editor's Locations tab as a List Editor adapter: the tree or the canvas, a flat sortable search, and the location panel. */
export function useWorldLocationsAdapter({ selectedId, onSelect, search, view, tab, onTabChange, focusField }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The World Editor's shared search, which hides the open location while it leaves the location out. */
  search: ListSearch;
  view: LocationView;
  tab: LocationPanelTab;
  onTabChange: (tab: LocationPanelTab) => void;
  focusField: FocusFieldHint | null;
}): ListEditorAdapter {
  const { locations, placeholders, placementLetters, placeholderOwners, addLocation, removeLocation, setLocations } = useGameData();
  const names = { placeholders, letters: placementLetters, owners: placeholderOwners };

  const handleAdd = (typed: string) => {
    const id = randomUUID();
    addLocation(newLocation(id, typed || undefined));
    onSelect(id);
  };
  // The copy lands right after its original.
  const handleDuplicate = (id: string) => {
    const index = locations.findIndex((l) => l.id === id);
    if (index === -1) return;
    const copy = { ...structuredClone(locations[index]), id: randomUUID() };
    copy.name = `${copy.name} (Copy)`;
    setLocations([...locations.slice(0, index + 1), copy, ...locations.slice(index + 1)]);
    onSelect(copy.id);
  };

  const rows = (): ListEditorRow[] => locations.map((l) => ({
    id: l.id,
    name: l.name,
    sortable: true,
    actions: [
      { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => handleDuplicate(l.id) },
      { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => { removeLocation(l.id); onSelect(null); } },
    ],
  }));

  // Drift log #3: the drop moves the row by its index in the whole array.
  const onReorder = (activeId: string, overId: string) => {
    const oldIndex = locations.findIndex((l) => l.id === activeId);
    const newIndex = locations.findIndex((l) => l.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    setLocations(arrayMove(locations, oldIndex, newIndex));
  };

  // A search that leaves the open location out blanks its detail, in either view (drift log #2).
  const shown = (id: string | null) => {
    const location = id ? locations.find((l) => l.id === id) : undefined;
    return location && matchesListSearch(location.name, search.term, names) ? location : undefined;
  };

  const canvas = view === 'canvas';
  return {
    tree: canvas
      ? <LocationCanvas selectedId={selectedId} onSelect={onSelect} />
      : <LocationTree selectedId={selectedId} onSelect={onSelect} />,
    ownsSlot: canvas,
    rows,
    names,
    noun: 'locations',
    detail: (id) => {
      const location = shown(id);
      return location && (
        <LocationManager
          key={location.id}
          location={location}
          tab={tab}
          onTabChange={onTabChange}
          focusField={focusFieldForItem(focusField, location.id)}
        />
      );
    },
    // The tabbed panel keeps its strip above a body that scrolls itself.
    fills: (id) => !!shown(id),
    onReorder,
    add: { label: 'Add to Locations', onAdd: handleAdd },
    placeholder: 'Search or add new locations',
    holds: (id) => locations.some((l) => l.id === id),
    isEmpty: locations.length === 0,
    emptyHint: <EmptyListHint noun="locations" />,
  };
}
