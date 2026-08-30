import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { arrayMove, type SortingStrategy } from '@dnd-kit/sortable';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { sameIds } from '@/lib/useSortableIds';
import { ArrowLeft, FolderMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  GROUP_OVERLAP,
  groupOverlapRatio,
  packTiles,
  packedRowCount,
  type LibraryTileSize,
  type PackedTile,
} from '@/lib/libraryOrganization';
import type { LibraryTiles } from '@/lib/useLibraryTiles';
import { LibraryGroupTile } from '@/components/library/LibraryGroupTile';

/** The scroll-viewport clamp alone; a grid drag moves in both axes, so no vertical-list clamp. */
const GRID_MODIFIERS = [restrictToFirstScrollableAncestor];

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

/**
 * How long a drag settles over a tile before that hover is read at all — as a slide-aside, or as the
 * start of a group. Long enough that a drag passing across a tile reads as nothing.
 */
const HOVER_MS = 150;

/**
 * How long the carried tile must then hold on a group target before the drop arms as a fold, with the
 * ring fading in for exactly this long.
 */
const GROUP_ARM_MS = 300;

/** Tiles hold their real grid slots at all times; reorders change the slots, never a transform. */
const NULL_STRATEGY: SortingStrategy = () => null;

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
  // The drag in progress: the carried tile, the LIVE order the board is drawing — reordered in place
  // as the drag moves, the way dnd-kit's own sortable examples do — and any group charge building.
  // `drawnRef` mirrors the drawn order synchronously, so the drop commits exactly what is on screen
  // even when the last change has not rendered yet.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string[] | null>(null);
  const [charge, setCharge] = useState<{ targetId: string; armed: boolean } | null>(null);
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number } | null>(null);
  const drawnRef = useRef<string[] | null>(null);
  const chargeRef = useRef<{ targetId: string; armed: boolean } | null>(null);
  const [measureGrid, width] = useMeasuredWidth();
  const dragging = activeId !== null;

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

  // The order the board draws right now. While a drag runs this IS the preview: tiles hold real grid
  // slots at every moment, and dnd-kit's layout animations slide them when the order changes.
  const drawnIds = drawn ?? renderedIds;
  const placement = usePlacement(drawnIds, tiles.organization.sizes, baseCols, layout);

  // Row height comes from the medium tile's ratio, so a medium tile is exactly the size it always was
  // and the half and double sizes fall out of it.
  const cellWidth = width > 0 ? (width - (baseCols - 1) * GAP) / baseCols : 0;
  const cellHeight = cellWidth > 0 ? ((2 * cellWidth + GAP) / ASPECT[aspect] - GAP) / 2 : 0;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  /**
   * The hover clock: which tile the drag has settled over, waiting to be read. One short wait decides
   * what hovering a tile means — deeply overlapped, it starts a group charge; anything else, the tile
   * slides out of the way and the vacant slot takes its place under the carried tile. The wait is what
   * lets both gestures exist at once: an instant slide-aside would whisk every group target away
   * before it could ever be parked on, and an instant group would fold tiles on every pass-through.
   */
  const hoverRef = useRef<{ overId: string; timer: number; inZone: boolean } | null>(null);
  const armTimerRef = useRef<number | null>(null);
  // The tile a slide-aside just moved, so the same collision events cannot re-trigger it before the
  // board's rects are re-measured. Cleared as soon as the drag settles over anything else.
  const settledRef = useRef<string | null>(null);

  const clearHover = () => {
    if (hoverRef.current) window.clearTimeout(hoverRef.current.timer);
    hoverRef.current = null;
  };

  const discharge = () => {
    if (armTimerRef.current !== null) window.clearTimeout(armTimerRef.current);
    armTimerRef.current = null;
    if (!chargeRef.current) return;
    chargeRef.current = null;
    setCharge(null);
  };

  const setDrawnBoth = (next: string[]) => {
    drawnRef.current = next;
    setDrawn(next);
  };

  /** Slide the over tile out of the way: the carried tile takes its slot in the live drawn order. */
  const dodge = (activeIdNow: string, overId: string) => {
    const current = drawnRef.current ?? renderedIds;
    const from = current.indexOf(activeIdNow);
    const to = current.indexOf(overId);
    if (from === -1 || to === -1 || from === to) return;
    settledRef.current = overId;
    setDrawnBoth(arrayMove(current, from, to));
  };

  /** Start the group charge on a tile: the ring fades in, and the arm timer makes the drop a fold. */
  const beginCharge = (targetId: string) => {
    chargeRef.current = { targetId, armed: false };
    setCharge({ targetId, armed: false });
    armTimerRef.current = window.setTimeout(() => {
      if (chargeRef.current?.targetId !== targetId) return;
      chargeRef.current = { targetId, armed: true };
      setCharge({ targetId, armed: true });
    }, GROUP_ARM_MS);
  };

  /**
   * The per-move reading. Everything is measured against the live board — the drawn order is real,
   * the rects dnd-kit hands over are re-measured whenever it changes — so what the reading sees is
   * exactly what the player sees, and the drop can only ever do what the board showed.
   */
  const updateDrag = (event: DragMoveEvent | DragOverEvent) => {
    const { active, over } = event;
    const id = String(active.id);
    if (!overlaySize) {
      const initial = active.rect.current.initial;
      if (initial) setOverlaySize({ width: initial.width, height: initial.height });
    }

    const overId = over && over.id !== UNGROUP_DROP_ID && String(over.id) !== id
      ? String(over.id)
      : null;
    if (settledRef.current && settledRef.current !== overId) settledRef.current = null;
    if (!overId || overId === settledRef.current) {
      clearHover();
      discharge();
      return;
    }

    // How much of the carried tile sits on the over tile, both boxes live.
    const carried = active.rect.current.translated;
    const canGroup = !openGroupId && !tiles.group(id);
    const inZone = canGroup && carried !== null && over !== null
      && groupOverlapRatio(carried, over.rect) >= GROUP_OVERLAP;

    if (chargeRef.current) {
      if (chargeRef.current.targetId === overId && inZone) return;
      // Backing off the target cancels the group instantly, armed or not.
      discharge();
    }

    if (hoverRef.current?.overId === overId) {
      hoverRef.current.inZone = inZone;
      return;
    }
    clearHover();
    const timer = window.setTimeout(() => {
      const hover = hoverRef.current;
      hoverRef.current = null;
      if (!hover || hover.overId !== overId) return;
      if (hover.inZone) beginCharge(overId);
      else dodge(id, overId);
    }, HOVER_MS);
    hoverRef.current = { overId, timer, inZone };
  };

  const resetDrag = () => {
    clearHover();
    discharge();
    settledRef.current = null;
    drawnRef.current = null;
    setDrawn(null);
    setActiveId(null);
    setOverlaySize(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // The drop persists the order on screen, with one last stock arrayMove toward the tile released
    // on, so a quick drop lands where every plain sortable would put it — and an armed group folds
    // instead, exactly as the completed ring promised.
    const armed = chargeRef.current?.armed ? chargeRef.current.targetId : null;
    let order = drawnRef.current ?? renderedIds;
    resetDrag();
    const { active, over } = event;
    if (!over) return;

    const id = String(active.id);
    if (over.id === UNGROUP_DROP_ID) {
      tiles.removeFrom(id);
      return;
    }

    if (!armed && String(over.id) !== id) {
      const from = order.indexOf(id);
      const to = order.indexOf(String(over.id));
      if (from !== -1 && to !== -1 && from !== to) order = arrayMove(order, from, to);
    }
    if (!sameIds(order, renderedIds)) tiles.commitOrder(order, openGroupId);
    if (armed) {
      if (tiles.group(armed)) tiles.addTo(id, armed);
      else tiles.groupTiles(id, armed);
    }
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

    // The tile a parked drop would fold into. Its cell is its real position — tiles never carry
    // preview transforms here — so the ring sits exactly where the player sees the tile. It fades in
    // while the arming window runs, so the group is watched coming and can be pulled away from; with
    // reduced motion it appears only at arm.
    const chargeHere = charge?.targetId === id ? charge : null;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            style={style}
            className={cn(
              'relative min-w-0',
              layout === 'detailed' && 'h-full',
            )}
          >
            {chargeHere && (
              <div
                className={cn(
                  'pointer-events-none absolute inset-0 z-10 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background',
                  !chargeHere.armed && 'animate-in fade-in duration-300 motion-reduce:hidden',
                )}
              />
            )}
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
      gridTemplateRows: `repeat(${Math.max(1, packedRowCount([...placement.values()]))}, ${Math.max(1, Math.round(cellHeight))}px)`,
    }
    : {};

  /**
   * The overlay's stand-in for the carried tile: the thumbnail — or a folder's mosaic — in a box the
   * size the tile had. The real card components register sortables, which the overlay must not, so
   * this is a plain clone rather than a second render of the card.
   */
  const overlayContent = (id: string) => {
    const group = tiles.group(id);
    const item = byId.get(id);
    const thumb = item ? thumbnailOf(item) : undefined;
    return (
      <div className="h-full w-full overflow-hidden rounded-lg bg-card shadow-lg ring-1 ring-border">
        {group ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px">
            {Array.from({ length: 4 }, (_, i) => {
              const member = byId.get(group.members[i] ?? '');
              const memberThumb = member ? thumbnailOf(member) : undefined;
              return memberThumb
                ? <img key={i} src={memberThumb} alt="" className="h-full w-full object-cover" />
                : <div key={i} className="h-full w-full bg-muted" />;
            })}
          </div>
        ) : thumb
          ? <img src={thumb} alt="" className="h-full w-full object-cover" />
          : <div className="h-full w-full bg-muted" />}
      </div>
    );
  };

  return (
    <EditorDndContext
      // A mouse press and a long press on touch, rather than one pointer sensor: a tile is also a scroll
      // surface on a phone, so a drag there has to be asked for by holding still first.
      sensors={sensors}
      onDragStart={({ active }) => {
        resetDrag();
        setActiveId(String(active.id));
        drawnRef.current = [...renderedIds];
        setDrawn(drawnRef.current);
      }}
      // Both events feed the same reading. onDragOver alone misses movement within one tile — from
      // its edge into its middle — since it fires only when the over tile changes; onDragMove alone
      // lags one frame on tile changes, because its `over` is recomputed after the move.
      onDragOver={updateDrag}
      onDragMove={updateDrag}
      onDragCancel={resetDrag}
      onDragEnd={handleDragEnd}
      // The scroll-viewport clamp alone, not the vertical-list pair: a grid drag moves in both axes, so
      // dragging a tile past an edge must scroll this finite frame rather than grow the page.
      modifiers={GRID_MODIFIERS}
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
            <StableSortableContext items={drawnIds} strategy={NULL_STRATEGY}>
              {drawnIds.map(renderTile)}
            </StableSortableContext>
          </div>
        )}
      </ScrollArea>
      {/* The carried tile itself, rendered in a portal that follows the pointer. Its in-flow element
          stays in the board — moving slot to slot with the live order, dimmed — which IS the hole the
          drop will fill. */}
      <DragOverlay>
        {activeId && overlaySize && (
          <div style={overlaySize} className="pointer-events-none">
            {overlayContent(activeId)}
          </div>
        )}
      </DragOverlay>
    </EditorDndContext>
  );
}
