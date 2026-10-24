import { useEffect, useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { ListToolbar } from '@/components/ListToolbar';
import { SearchField } from '@/components/ui/search-field';
import { Hint } from '@/components/ui/typography';
import type { ListEditorParts } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { matchesListSearch } from '@/lib/listSearch';
import { mediaSections, sectionSelection, sectionTitle, type MediaParent } from '@/lib/mediaIndex';
import { MediaGallery } from './MediaGallery';
import { MediaItemPanel, MediaSummaryPanel } from './MediaPanels';

/**
 * The Media tab's List Editor parts: a gallery of every media item in the world, and the panel for the
 * selected card or section. A search matches a card's parent and slot names. It builds the parts itself rather
 * than through `useListEditor`, whose rows and search list don't fit a card grid.
 */
export function useWorldMediaEditor({ selectedId, onSelect, search, onGoTo }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  search: ListSearch;
  onGoTo: (parent: MediaParent) => void;
}): ListEditorParts {
  const { worldOverview, entities, entityGroups, locations, dictionaries, placeholders } = useGameData();
  const allSections = useMemo(
    () => mediaSections({ worldOverview, entities, entityGroups, locations, dictionaries }),
    [worldOverview, entities, entityGroups, locations, dictionaries],
  );
  const term = search.term.trim();
  const sections = useMemo(() => {
    if (!term) return allSections;
    const names = { placeholders };
    return allSections
      .map((s) => ({ ...s, items: s.items.filter((i) => matchesListSearch(`${i.parent.name} ${i.slot}`, term, names)) }))
      .filter((s) => s.items.length);
  }, [allSections, term, placeholders]);

  const allItems = useMemo(() => allSections.flatMap((s) => s.items), [allSections]);
  const item = selectedId ? allItems.find((i) => i.id === selectedId) : undefined;
  const section = selectedId && !item ? allSections.find((s) => sectionSelection(s.id) === selectedId) : undefined;
  const held = !!item || !!section;
  // An undo or a removal elsewhere can take the selected item away.
  const stale = !!selectedId && !held;
  useEffect(() => { if (stale) onSelect(null); }, [stale, onSelect]);

  const detail = item
    ? <MediaItemPanel item={item} placeholders={placeholders} onGoTo={onGoTo} />
    : section
      ? <MediaSummaryPanel title={sectionTitle(section)} items={section.items} placeholders={placeholders} onSelect={onSelect} />
      : allItems.length
        ? (
          <div className="space-y-3">
            <MediaSummaryPanel title="World Media" items={allItems} placeholders={placeholders} onSelect={onSelect} />
            <Hint>Select a card to see it here</Hint>
          </div>
        )
        : null;

  const list = !allItems.length
    ? <Hint className="p-2">This world has no images, sounds, 3D Models or Avatars yet</Hint>
    : !sections.length
      ? <Hint className="p-2">No media matches &ldquo;{search.typed}&rdquo;</Hint>
      : (
        // The list pane deselects on a bubbled click; cards select through their own handlers.
        <div onClick={(e) => e.stopPropagation()}>
          <MediaGallery sections={sections} selectedId={selectedId} onSelect={onSelect} placeholders={placeholders} />
        </div>
      );

  return {
    search,
    toolbar: (className, extras) => (
      <ListToolbar className={className} target={extras?.target}>
        {extras?.children}
        <SearchField
          data-editor-find-skip
          placeholder="Search media"
          value={search.term}
          onChange={search.setTerm}
          onClear={search.clear}
          className="flex-1"
        />
        {extras?.after}
      </ListToolbar>
    ),
    list,
    detail,
    footer: undefined,
    fills: false,
    ownsSlot: false,
    showDetail: held,
    onBack: () => onSelect(null),
  };
}
