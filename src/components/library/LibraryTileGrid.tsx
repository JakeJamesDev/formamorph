import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { SortableContext, rectSortingStrategy, type SortingStrategy } from '@dnd-kit/sortable';
import { ArrowLeft, FolderMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTAINED_AUTO_SCROLL } from '@/lib/dndAutoScroll';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { dropIntent, packTiles, packedRowCount, type LibraryTileSize } from '@/lib/libraryOrganization';
import type { LibraryTiles } from '@/lib/useLibraryTiles';
import { LibraryGroupTile } from '@/components/library/LibraryGroupTile';

/** Medium-tile columns per breakpoint; base cells are twice these, since a medium tile spans two. */
export interface MediumColumns {
  base: number;
  sm: number;
  lg: number;
}

/** Tile shape per tab, as the width-to-height ratio of a medium tile. */
const ASPECT = { landscape: 16 / 9, portrait: 2 / 3 };

/** The grid's gutter, in pixels. Matches `gap-4`, which the tile grid sets in CSS. */
const GAP = 16;

/** Tailwind's `sm` and `lg` breakpoints, so column counts change where the rest of the app's do. */
const BREAKPOINTS = { sm: 640, lg: 1024 };

/** The header's drop target: dropping a tile here takes it out of the folder. */
const UNGROUP_DROP_ID = '__library-ungroup__';

/** A packed grid places every tile itself, so dnd-kit must not also shuffle their neighbours. */
const NO_SHIFT: SortingStrategy = () => null;

const SIZE_LABELS: { size: LibraryTileSize; label: string }[] = [
  { size: 'small', label: 'Small' },
  { size: 'medium', label: 'Medium' },
  { size: 'large', label: 'Large' },
];

/** The medium-tile column count for the current viewport width. */
function useMediumColumns(columns: MediumColumns): number {
  const read = useCallback(() => {
    const width = typeof window === 'undefined' ? BREAKPOINTS.lg : window.innerWidth;
    if (width >= BREAKPOINTS.lg) return columns.lg;
    return width >= BREAKPOINTS.sm ? columns.sm : columns.base;
  }, [columns]);

  const [count, setCount] = useState(read);
  useEffect(() => {
    const update = () => setCount(read());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [read]);

  return count;
}

/**
 * The measured inner width of the grid, so its rows can be sized from its columns.
 *
 * Returns a callback ref rather than reading one: the grid element is not rendered while the tab is
 * still loading, and an effect keyed on a ref object would have run once against nothing and never
 * measured the grid that mounted afterwards.
 */
function useMeasuredWidth(): [(node: HTMLDivElement | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observed = useRef<ResizeObserver | null>(null);

  const measure = useCallback((node: HTMLDivElement | null) => {
    observed.current?.disconnect();
    observed.current = null;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    observed.current = observer;
    setWidth(node.clientWidth);
  }, []);

  return [measure, width];
}

/** The header of the folder view: back out, rename in place, and a drop zone that ungroups. */
function FolderHeader({ name, dragging, settings, onBack, onRename }: {
  name: string;
  dragging: boolean;
  settings?: React.ReactNode;
  onBack: () => void;
  onRename: (name: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNGROUP_DROP_ID });
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  return (
    <div className="container mx-auto px-4 pb-3 flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" />
        Library
      </Button>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onRename(draft);
          // A blank name is refused, so the field goes back to the name the folder kept.
          setDraft((current) => current.trim() || name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(name);
        }}
        aria-label="Group name"
        className="h-8 w-56 font-semibold"
      />
      {settings}
      {/* Only while a drag is live: an always-on zone would be a permanent bar over the grid. */}
      {dragging && (
        <div
          ref={setNodeRef}
          className={cn(
            'ml-auto flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-label',
            isOver ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
          )}
        >
          <FolderMinus className="h-4 w-4" />
          Move Out Of Group
        </div>
      )}
    </div>
  );
}

/**
 * One library tab's grid, as sizable tiles that can be grouped into folders.
 *
 * The grid layout packs tiles at their own size — half, one, or double a medium tile — while the
 * detailed layout keeps uniform cards and shows folders as cards among them. Clicking a folder swaps the
 * grid for that folder's members, with a header that renames it and a drop zone that takes tiles out.
 *
 * @param items - Everything the tab holds; the arrangement decides which of them the grid draws
 * @param idOf - The library id of one item, which is what the arrangement is keyed by
 * @param tiles - This tab's arrangement and the actions the grid dispatches against it
 * @param renderCard - The tab's own card for one item, told how to fill and label its tile
 * @param groupSettings - Settings shown in the folder header; omit on tabs that carry none
 */
export function LibraryTileGrid<T>({
  items,
  idOf,
  tiles,
  layout,
  aspect,
  mediumColumns,
  detailedColumnsClass,
  thumbnailOf,
  renderCard,
  groupSettings,
  groupPresetName,
  emptyState,
}: {
  items: T[];
  idOf: (item: T) => string;
  tiles: LibraryTiles;
  layout: 'grid' | 'detailed';
  aspect: 'landscape' | 'portrait';
  mediumColumns: MediumColumns;
  detailedColumnsClass: string;
  thumbnailOf: (item: T) => string | undefined;
  renderCard: (item: T, options: {
    layout: 'grid' | 'detailed';
    fill: boolean;
    compact: boolean;
  }) => React.ReactNode;
  groupSettings?: (groupId: string) => React.ReactNode;
  groupPresetName?: (groupId: string) => string | undefined;
  emptyState?: React.ReactNode;
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [measureGrid, width] = useMeasuredWidth();

  const openGroup = openGroupId ? tiles.group(openGroupId) : undefined;
  useEffect(() => {
    // A folder disbanded from anywhere — its last member deleted, its own Delete Group — drops the
    // view back to the library rather than leaving an empty room open.
    if (openGroupId && !openGroup) setOpenGroupId(null);
  }, [openGroupId, openGroup]);

  const byId = useMemo(() => new Map(items.map((item) => [idOf(item), item] as const)), [items, idOf]);
  const renderedIds = useMemo(
    () => (openGroup ? openGroup.members.filter((id) => byId.has(id)) : tiles.topLevel),
    [openGroup, byId, tiles.topLevel],
  );

  const mediumCols = useMediumColumns(mediumColumns);
  const baseCols = mediumCols * 2;
  const packed = useMemo(
    () => (layout === 'grid' ? packTiles(renderedIds, tiles.organization.sizes, baseCols) : []),
    [layout, renderedIds, tiles.organization.sizes, baseCols],
  );
  const placement = useMemo(() => new Map(packed.map((tile) => [tile.id, tile])), [packed]);

  // Row height comes from the medium tile's ratio, so a medium tile is exactly the size it always was
  // and the half and double sizes fall out of it.
  const cellWidth = width > 0 ? (width - (baseCols - 1) * GAP) / baseCols : 0;
  const cellHeight = cellWidth > 0 ? ((2 * cellWidth + GAP) / ASPECT[aspect] - GAP) / 2 : 0;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(false);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    if (over.id === UNGROUP_DROP_ID) {
      tiles.removeFrom(activeId);
      return;
    }

    const overId = String(over.id);
    if (activeId === overId) return;

    const rect = active.rect.current.translated;
    // Inside a folder there is nothing to group into, since groups hold only items.
    const canGroup = !openGroupId && !tiles.group(activeId);
    const intent = rect
      ? dropIntent(
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        over.rect,
        { canGroup, overSize: layout === 'grid' ? tiles.size(overId) : 'medium' },
      )
      : ({ kind: 'reorder', position: 'after' } as const);

    if (intent.kind === 'group') {
      if (tiles.group(overId)) tiles.addTo(activeId, overId);
      else tiles.groupTiles(activeId, overId);
      return;
    }
    tiles.move({ activeId, overId, position: intent.position, container: openGroupId });
  };

  /** The context menu for one tile: its size, then whatever grouping applies to it. */
  const tileMenu = (id: string) => {
    const group = tiles.group(id);
    const inFolder = tiles.groupOfItem(id);

    return (
      <>
        <ContextMenuLabel>Tile Size</ContextMenuLabel>
        <ContextMenuRadioGroup
          value={tiles.size(id)}
          onValueChange={(value) => tiles.setSize(id, value as LibraryTileSize)}
        >
          {SIZE_LABELS.map(({ size, label }) => (
            <ContextMenuRadioItem key={size} value={size}>{label}</ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>

        {group ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => setOpenGroupId(group.id)}>Open Group</ContextMenuItem>
            <ContextMenuItem onSelect={() => tiles.disband(group.id)}>Delete Group</ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel>Add To Group</ContextMenuLabel>
            {tiles.groups
              .filter((candidate) => candidate.id !== inFolder?.id)
              .map((candidate) => (
                <ContextMenuItem key={candidate.id} onSelect={() => tiles.addTo(id, candidate.id)}>
                  {candidate.name}
                </ContextMenuItem>
              ))}
            {/* Named apart from the folders listed above it: a fresh folder is called "New Group", and
                two identical labels in one menu would not say which one acts. */}
            <ContextMenuItem onSelect={() => tiles.groupWithNew(id)}>Create New Group</ContextMenuItem>
            {inFolder && (
              <ContextMenuItem onSelect={() => tiles.removeFrom(id)}>Remove From Group</ContextMenuItem>
            )}
          </>
        )}
      </>
    );
  };

  const renderTile = (id: string) => {
    const group = tiles.group(id);
    const item = byId.get(id);
    if (!group && !item) return null;

    const spot = placement.get(id);
    const size = tiles.size(id);
    const compact = layout === 'grid' && size === 'small';
    const style: React.CSSProperties | undefined = spot && layout === 'grid'
      ? {
        gridColumn: `${spot.col + 1} / span ${spot.span}`,
        gridRow: `${spot.row + 1} / span ${spot.span}`,
      }
      : undefined;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div style={style} className={cn('min-w-0', layout === 'detailed' && 'h-full')}>
            {group ? (
              <LibraryGroupTile
                group={group}
                thumbnails={group.members.map((memberId) => {
                  const member = byId.get(memberId);
                  return member ? thumbnailOf(member) : undefined;
                })}
                layout={layout}
                fill={layout === 'grid'}
                compact={compact}
                presetName={groupPresetName?.(group.id)}
                onOpen={setOpenGroupId}
              />
            ) : (
              renderCard(item as T, { layout, fill: layout === 'grid', compact })
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="max-h-[60vh] overflow-y-auto">{tileMenu(id)}</ContextMenuContent>
      </ContextMenu>
    );
  };

  const gridStyle: React.CSSProperties = layout === 'grid'
    ? {
      gridTemplateColumns: `repeat(${baseCols}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${Math.max(1, packedRowCount(packed))}, ${Math.max(1, Math.round(cellHeight))}px)`,
    }
    : {};

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={handleDragEnd}
      // Clamp the drag to the scroll viewport and never auto-scroll the page, so dragging a tile past
      // an edge scrolls this finite frame rather than growing the page.
      modifiers={[restrictToFirstScrollableAncestor]}
      autoScroll={CONTAINED_AUTO_SCROLL}
    >
      {openGroup && (
        <FolderHeader
          name={openGroup.name}
          dragging={dragging}
          settings={groupSettings?.(openGroup.id)}
          onBack={() => setOpenGroupId(null)}
          onRename={(name) => tiles.rename(openGroup.id, name)}
        />
      )}
      <ScrollArea className="flex-1 min-h-0 container mx-auto px-4">
        {renderedIds.length === 0 && !openGroup ? emptyState : (
          <div
            ref={measureGrid}
            style={gridStyle}
            className={cn('grid gap-4', layout === 'detailed' && detailedColumnsClass)}
          >
            <SortableContext
              items={renderedIds}
              strategy={layout === 'grid' ? NO_SHIFT : rectSortingStrategy}
            >
              {renderedIds.map(renderTile)}
            </SortableContext>
          </div>
        )}
      </ScrollArea>
    </DndContext>
  );
}
