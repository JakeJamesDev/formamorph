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
  type DragMoveEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { getEventCoordinates } from '@dnd-kit/utilities';
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
import {
  isGroupDrop,
  packTiles,
  packedRowCount,
  projectedOrder,
  type DropIntent,
  type LibraryTileSize,
  type PackedTile,
  type TileRect,
} from '@/lib/libraryOrganization';
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

/** The drag in progress: what is held, what it is over, and what dropping there would do. */
interface DragPreview {
  activeId: string;
  overId: string;
  /** Null while the pointer is over nothing the drop can act on. */
  intent: DropIntent | null;
}

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

/** Every tile's cell in the packed grid, by id. Empty in the detailed layout, which packs nothing. */
function usePlacement(
  order: string[],
  sizes: Record<string, LibraryTileSize>,
  columns: number,
  layout: 'grid' | 'detailed',
): Map<string, PackedTile> {
  return useMemo(() => {
    if (layout !== 'grid') return new Map();
    return new Map(packTiles(order, sizes, columns).map((tile) => [tile.id, tile]));
  }, [order, sizes, columns, layout]);
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
  const [drag, setDrag] = useState<DragPreview | null>(null);
  // The same reading, held outside the render cycle: React defers renders for continuous pointer
  // events, so a fast move-and-release can drop before the state carrying the last intent has
  // rendered. The ref is written synchronously in the event handler and is what the drop reads.
  const dragRef = useRef<DragPreview | null>(null);
  const [measureGrid, width] = useMeasuredWidth();
  const dragging = drag !== null;

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

  // Where the tiles stand right now, and where they would stand if the drag were dropped. The two are
  // the same list unless a reorder is being previewed, and a grouping drop reflows nothing at all.
  const previewOrder = useMemo(() => {
    if (layout !== 'grid' || !drag || drag.intent?.kind !== 'reorder') return renderedIds;
    return projectedOrder(tiles.organization, tiles.itemIds, {
      activeId: drag.activeId,
      overId: drag.overId,
      position: drag.intent.position,
      container: openGroupId,
    });
  }, [layout, drag, renderedIds, tiles.organization, tiles.itemIds, openGroupId]);

  // Tiles keep their real grid slots for the whole drag; the preview below moves them by animated
  // transform, exactly the way the flat grid's sortable strategy always did, so a reorder slides the
  // board around instead of snapping it.
  const placement = usePlacement(renderedIds, tiles.organization.sizes, baseCols, layout);
  const previewPlacement = usePlacement(previewOrder, tiles.organization.sizes, baseCols, layout);

  // Row height comes from the medium tile's ratio, so a medium tile is exactly the size it always was
  // and the half and double sizes fall out of it.
  const cellWidth = width > 0 ? (width - (baseCols - 1) * GAP) / baseCols : 0;
  const cellHeight = cellWidth > 0 ? ((2 * cellWidth + GAP) / ASPECT[aspect] - GAP) / 2 : 0;

  /**
   * The strategy the sortable tiles animate by: each tile's offset from its slot to where the packer
   * says it lands if the drag drops now. dnd-kit transitions these transforms itself, which is what
   * made the old uniform grid feel smooth — this feeds that same pipeline positions that are actually
   * true for packed, mixed-size tiles. The held tile is skipped; it follows the pointer.
   */
  const packedStrategy: SortingStrategy = ({ index }) => {
    const id = renderedIds[index];
    const from = placement.get(id);
    const to = previewPlacement.get(id);
    if (!from || !to || (from.col === to.col && from.row === to.row)) return null;
    return {
      x: (to.col - from.col) * (cellWidth + GAP),
      y: (to.row - from.row) * (cellHeight + GAP),
      scaleX: 1,
      scaleY: 1,
    };
  };

  /**
   * The detailed layout's strategy: stock sorting, except while the drop would group. A grouping drop
   * changes no order, so sliding cards around during one would show a reorder that is not going to
   * happen — and would move the ringed tile away from the spot the reading found it at. The packed
   * grid gets the same stillness for free, since its preview order only changes on a reorder intent.
   */
  const detailedStrategy: SortingStrategy = (args) =>
    (drag?.intent?.kind === 'group' ? null : rectSortingStrategy(args));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  /**
   * The reading of the drag: which tile it is over, from dnd-kit's collision events, and where the
   * pointer is, from a native listener. The pointer has to come from the browser directly — dnd-kit's
   * own coordinates run through React state and lag several events behind under a fast drag, so a
   * quick release would execute a reading the player had already moved past. Both sources live in
   * one space: viewport coordinates, against tile rects measured at drag start. The preview slides
   * tiles away from those rects only by transform, so no reading ever disagrees with another.
   */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const overRef = useRef<{ id: string; rect: TileRect } | null>(null);

  /** The drop reading for the current pointer and over-tile, or a null intent when there is neither. */
  const computePreview = (activeId: string): DragPreview => {
    const over = overRef.current;
    const point = pointerRef.current;
    if (!over || !point || over.id === activeId) return { activeId, overId: activeId, intent: null };

    // Inside a folder there is nothing to group into, since groups hold only items.
    const canGroup = !openGroupId && !tiles.group(activeId);
    const intent: DropIntent = isGroupDrop(point, over.rect, canGroup)
      ? { kind: 'group' }
      // The stock sortable rule: the dragged tile takes the over tile's slot, landing after it when
      // it came from earlier in the list and before it otherwise. The reading moves only when the
      // over tile does — never with the pointer's position inside it — which is what keeps the
      // projection from flapping under small pointer moves. Past the grid's first or last tile the
      // collision layer hands that end tile over, so the same rule reaches both ends.
      : {
        kind: 'reorder',
        position: renderedIds.indexOf(activeId) < renderedIds.indexOf(over.id) ? 'after' : 'before',
      };
    return { activeId, overId: over.id, intent };
  };

  const commitPreview = (next: DragPreview) => {
    dragRef.current = next;
    // The per-move stream re-renders the grid only when the reading actually changed.
    setDrag((prev) => (
      prev
        && prev.overId === next.overId
        && prev.intent?.kind === next.intent?.kind
        && (prev.intent?.kind !== 'reorder' || next.intent?.kind !== 'reorder'
          || prev.intent.position === next.intent.position)
        ? prev
        : next
    ));
  };

  // Fresh closures for the native listener below, which cannot re-subscribe per render.
  const previewFnsRef = useRef({ computePreview, commitPreview });
  previewFnsRef.current = { computePreview, commitPreview };

  /** dnd-kit's collision events keep the over-tile current; the pointer is seeded as a fallback. */
  const updateDrag = (event: DragMoveEvent | DragOverEvent) => {
    const { active, over } = event;
    overRef.current = over && over.id !== UNGROUP_DROP_ID && String(over.id) !== String(active.id)
      ? { id: String(over.id), rect: over.rect }
      : null;
    if (!pointerRef.current) {
      const grabbed = getEventCoordinates(event.activatorEvent);
      if (grabbed) pointerRef.current = { x: grabbed.x + event.delta.x, y: grabbed.y + event.delta.y };
    }
    commitPreview(computePreview(String(active.id)));
  };

  // The native pointer, read directly off the document while a drag is live. This is what makes the
  // reading exact at release: the browser's last move event always lands here before the mouseup does,
  // with no framework scheduling in between.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent | TouchEvent) => {
      const source = 'touches' in event ? event.touches[0] : event;
      if (!source) return;
      pointerRef.current = { x: source.clientX, y: source.clientY };
      const current = dragRef.current;
      if (current) previewFnsRef.current.commitPreview(previewFnsRef.current.computePreview(current.activeId));
    };
    window.addEventListener('mousemove', onMove, { capture: true, passive: true });
    window.addEventListener('touchmove', onMove, { capture: true, passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove, { capture: true });
      window.removeEventListener('touchmove', onMove, { capture: true });
    };
  }, [dragging]);

  const handleDragEnd = (event: DragEndEvent) => {
    // The drop executes what the preview last promised. The last move's reading is the one the player
    // watched the tiles slide toward; re-reading at the drop reconstructs the pointer from a rect
    // dnd-kit has already stopped translating, and lands somewhere else.
    const preview = dragRef.current;
    dragRef.current = null;
    pointerRef.current = null;
    overRef.current = null;
    setDrag(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    if (over.id === UNGROUP_DROP_ID) {
      tiles.removeFrom(activeId);
      return;
    }

    const overId = String(over.id);
    const intent = preview?.overId === overId ? preview.intent : null;
    if (!intent) return;

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
        {/* Sizes only shape the packed grid; the detailed layout draws uniform cards, so offering
            them there would be a menu that does nothing. A size set in grid still persists. */}
        {layout === 'grid' && (
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
            <ContextMenuSeparator />
          </>
        )}

        {group ? (
          <>
            <ContextMenuItem onSelect={() => setOpenGroupId(group.id)}>Open Group</ContextMenuItem>
            <ContextMenuItem onSelect={() => tiles.disband(group.id)}>Delete Group</ContextMenuItem>
          </>
        ) : (
          <>
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

    // The tile a grouping drop would fold into. Nothing reflows for that drop, so the ring is the only
    // thing that says what it will do.
    const groupTarget = drag?.intent?.kind === 'group' && drag.overId === id;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            style={style}
            className={cn(
              'min-w-0',
              layout === 'detailed' && 'h-full',
              groupTarget && 'rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
          >
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
      gridTemplateRows: `repeat(${Math.max(1, packedRowCount([...placement.values()]), packedRowCount([...previewPlacement.values()]))}, ${Math.max(1, Math.round(cellHeight))}px)`,
    }
    : {};

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => {
        const start = { activeId: String(active.id), overId: String(active.id), intent: null };
        pointerRef.current = null;
        overRef.current = null;
        dragRef.current = start;
        setDrag(start);
      }}
      // Both events feed the same reading. onDragOver alone misses movement within one tile — from
      // its edge into its middle — since it fires only when the over tile changes; onDragMove alone
      // lags one frame on tile changes, because its `over` is recomputed after the move. Together
      // every position is read fresh, and the equality guard in commitPreview keeps the per-move
      // stream from re-rendering a grid nothing changed in.
      onDragOver={updateDrag}
      onDragMove={updateDrag}
      onDragCancel={() => {
        dragRef.current = null;
        pointerRef.current = null;
        overRef.current = null;
        setDrag(null);
      }}
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
              strategy={layout === 'grid' ? packedStrategy : detailedStrategy}
            >
              {renderedIds.map(renderTile)}
            </SortableContext>
          </div>
        )}
      </ScrollArea>
    </DndContext>
  );
}
