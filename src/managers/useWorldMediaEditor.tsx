import { useEffect, useMemo, useState } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { ListToolbar } from '@/components/ListToolbar';
import { SearchField } from '@/components/ui/search-field';
import { Hint } from '@/components/ui/typography';
import type { ListEditorParts } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { matchesListSearch } from '@/lib/listSearch';
import { cn } from '@/lib/utils';
import {
  blankSections, canStack, filterSections, groupSections, isAvatarSection, mediaParentKey, mediaSections, sectionSelection, sectionTitle, sortSectionsLargestFirst, withAvatarsSection,
  type MediaFilter, type MediaParent,
} from '@/lib/mediaIndex';
import { useMediaViewPrefs } from '@/lib/useMediaViewPrefs';
import { AvatarStoreControls } from './AvatarStore';
import { MediaGallery } from './MediaGallery';
import { MediaHeader, type OptimizeControl } from './MediaHeader';
import { MediaItemPanel, MediaSummaryPanel } from './MediaPanels';
import { MediaImagePanel } from './MediaImagePanel';

/**
 * The Media tab's List Editor parts: a gallery of every media item in the world, and the panel for the
 * selected card or section, under a header row with the Publish Size meter, grouping, Largest First and a
 * filter. A search matches a card's parent and slot names. It builds the parts itself rather
 * than through `useListEditor`, whose rows and search list don't fit a card grid.
 */
export function useWorldMediaEditor({ selectedId, onSelect, search, onGoTo, publishBytes, optimize }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  search: ListSearch;
  onGoTo: (parent: MediaParent) => void;
  /** The worker-measured Publish Size, or null until the first measure lands. */
  publishBytes: number | null;
  /** The Optimize Images run: its progress, and the click that starts it. */
  optimize: OptimizeControl;
}): ListEditorParts {
  const { worldOverview, entities, entityGroups, locations, dictionaries, placeholders } = useGameData();
  const allSections = useMemo(
    () => mediaSections({ worldOverview, entities, entityGroups, locations, dictionaries }),
    [worldOverview, entities, entityGroups, locations, dictionaries],
  );
  const { grouping, setGrouping, largestFirst, setLargestFirst } = useMediaViewPrefs();
  // The filter lasts while the editor is open.
  const [filter, setFilter] = useState<MediaFilter>('all');
  // Blank cards show under No Images and nowhere else.
  const blankOnly = filter === 'noImages';
  const blankSource = useMemo(
    () => (blankOnly ? blankSections({ worldOverview, entities, entityGroups, locations, dictionaries }) : []),
    [blankOnly, worldOverview, entities, entityGroups, locations, dictionaries],
  );
  // What the gallery lays out, before the search narrows it.
  const shownSections = useMemo(() => {
    const filtered = filterSections(groupSections(blankOnly ? blankSource : allSections, grouping), filter);
    const sorted = largestFirst ? sortSectionsLargestFirst(filtered) : filtered;
    // Unfiltered, the Avatars section always shows, so the first Avatar has a way in.
    return filter === 'all' ? withAvatarsSection(sorted, grouping) : sorted;
  }, [allSections, blankSource, blankOnly, grouping, filter, largestFirst]);
  const term = search.term.trim();
  const sections = useMemo(() => {
    if (!term) return shownSections;
    const names = { placeholders };
    return shownSections
      .map((s) => ({ ...s, items: s.items.filter((i) => matchesListSearch(`${i.parent.name} ${i.slot}`, term, names)) }))
      .filter((s) => s.items.length);
  }, [shownSections, term, placeholders]);

  const allItems = useMemo(() => allSections.flatMap((s) => s.items), [allSections]);
  // A blank card's id is the one its filled slot takes, so an upload hands the selection to the real item.
  const blankItems = useMemo(() => blankSource.flatMap((s) => s.items), [blankSource]);
  const item = selectedId ? allItems.find((i) => i.id === selectedId) ?? blankItems.find((i) => i.id === selectedId) : undefined;
  const section = selectedId && !item ? shownSections.find((s) => sectionSelection(s.id) === selectedId && (s.items.length || !term)) : undefined;
  const held = !!item || !!section;
  // An undo or a removal elsewhere can take the selected item away.
  const stale = !!selectedId && !held;
  useEffect(() => { if (stale) onSelect(null); }, [stale, onSelect]);

  // A gallery's image opens its parent's image panel, framed on that image.
  const panelParent = item && canStack(item) ? item.parent : undefined;
  const panelKey = panelParent && mediaParentKey(panelParent);
  const panelImages = useMemo(
    () => (panelKey ? allItems.filter((i) => canStack(i) && mediaParentKey(i.parent) === panelKey) : []),
    [allItems, panelKey],
  );
  // The add tile frames an empty slot, which no item holds yet. It lasts until the selection moves.
  const [emptyFrame, setEmptyFrame] = useState<{ selectedId: string; index: number } | null>(null);
  const openFrame = emptyFrame && emptyFrame.selectedId === selectedId ? emptyFrame.index : undefined;
  // An image landing in the empty slot takes the selection, so the frame follows it.
  const landed = openFrame !== undefined ? panelImages[openFrame] : undefined;
  useEffect(() => { if (landed) onSelect(landed.id); }, [landed, onSelect]);
  const framePanel = (index: number) => {
    const next = panelImages[index];
    if (next) {
      setEmptyFrame(null);
      onSelect(next.id);
    } else if (selectedId) {
      setEmptyFrame({ selectedId, index });
    }
  };
  const pick = panelParent?.kind === 'entity' ? entities.find((e) => e.id === panelParent.id)?.vrmPick : undefined;
  const avatar = pick?.kind === 'world' ? allItems.find((i) => i.key === `avatar:${pick.id}`) : undefined;

  const detail = panelParent
    ? (
      <MediaImagePanel
        parent={panelParent}
        images={panelImages}
        framed={openFrame ?? item?.galleryIndex ?? 0}
        onFrame={framePanel}
        avatar={avatar}
        placeholders={placeholders}
        onGoTo={onGoTo}
        onSelect={onSelect}
      />
    )
    : item
    ? <MediaItemPanel item={item} placeholders={placeholders} onGoTo={onGoTo} />
    : section && blankOnly
      ? (
        <div className="space-y-1">
          <h2 className="text-title font-semibold">{sectionTitle(section)}</h2>
          <Hint>{section.items.length} {section.items.length === 1 ? 'card has' : 'cards have'} no image</Hint>
        </div>
      )
    : section
      ? (
        <MediaSummaryPanel
          title={sectionTitle(section)}
          items={section.items}
          placeholders={placeholders}
          onSelect={onSelect}
          controls={isAvatarSection(section) ? <AvatarStoreControls /> : undefined}
        />
      )
      : allItems.length
        ? (
          <div className="space-y-3">
            <MediaSummaryPanel title="World Media" items={allItems} placeholders={placeholders} onSelect={onSelect} />
            <Hint>Select a card to see it here</Hint>
          </div>
        )
        : null;

  const list = !sections.length
    ? <Hint className="p-2">{term ? <>No media matches &ldquo;{search.typed}&rdquo;</> : 'No media matches this filter'}</Hint>
    : (
      // The list pane deselects on a bubbled click; cards select through their own handlers.
      <div onClick={(e) => e.stopPropagation()}>
        {!allItems.length && !blankOnly && <Hint className="p-2">This world has no images, sounds, 3D Models or Avatars yet</Hint>}
        <MediaGallery sections={sections} selectedId={selectedId} onSelect={onSelect} placeholders={placeholders} />
      </div>
    );

  return {
    search,
    toolbar: (className, extras) => (
      <div className={cn('flex flex-shrink-0 flex-col gap-2', className)}>
        <MediaHeader
          publishBytes={publishBytes}
          grouping={grouping}
          onGroupingChange={setGrouping}
          largestFirst={largestFirst}
          onLargestFirstChange={setLargestFirst}
          filter={filter}
          onFilterChange={setFilter}
          optimize={optimize}
        />
        <ListToolbar target={extras?.target}>
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
      </div>
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
