import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DragOverlay,
  getScrollableAncestors,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { arrayMove, type SortingStrategy } from '@dnd-kit/sortable';
import { getEventCoordinates } from '@dnd-kit/utilities';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { sameIds } from '@/lib/useSortableIds';
import { ArrowLeft, Trash2 } from 'lucide-react';
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
  readGesture,
  resolvePlacements,
  rowMajor,
  spanAt,
  SLICE_SHARE,
  type GestureReading,
  type LibraryTileSize,
  type PackedTile,
  type PlacementMap,
  type TilePlacement,
} from '@/lib/libraryOrganization';
import type { LibraryTiles } from '@/lib/useLibraryTiles';
import { THUMB_RATIO, thumbFit, type ThumbAspect } from '@/lib/thumbAspect';
import { LibraryGroupTile } from '@/components/library/LibraryGroupTile';

/** The scroll-viewport clamp alone; a grid drag moves in both axes, so no vertical-list clamp. */
const GRID_MODIFIERS = [restrictToFirstScrollableAncestor];

/** The grid's gutter, in pixels. Matches `gap-4`, which the tile grid sets in CSS. */
const GAP = 16;

/** Tiles hold their real grid slots at all times; reorders change the slots, never a transform. */
const NULL_STRATEGY: SortingStrategy = () => null;

const SIZE_LABELS: { size: LibraryTileSize; label: string }[] = [
  { size: 'small', label: 'Small' },
  { size: 'medium', label: 'Medium' },
  { size: 'large', label: 'Large' },
];

/**
 * As many medium columns as the measured width fits, never fewer than one.
 *
 * The grid's own measured width is the source of truth, so the board fills whatever room it has —
 * an ultrawide simply gets more columns — and a width change lands as a redraw at the new cell
 * pitch. The first frame, before the ResizeObserver has reported, falls back to the window width
 * minus the board's own padding, so the opening paint already stands at the right column count.
 */
function fitMediumColumns(measured: number, minMediumWidth: number): number {
  const width = measured > 0
    ? measured
    : (typeof window === 'undefined' ? 1024 : window.innerWidth - 32);
  return Math.max(1, Math.floor((width + GAP) / (minMediumWidth + GAP)));
}

/**
 * The measured inner width of the grid, so its rows can be sized from its columns.
 *
 * Returns a callback ref rather than reading one: the grid element is not rendered while the tab is
 * still loading, and an effect keyed on a ref object would have run once against nothing and never
 * measured the grid that mounted afterwards.
 */
function useMeasuredWidth(): [
  (node: HTMLDivElement | null) => void,
  number,
  React.RefObject<HTMLDivElement | null>,
] {
  const [width, setWidth] = useState(0);
  const observed = useRef<ResizeObserver | null>(null);
  // The element itself, because a drag reads its box to work out which cell the pointer wants.
  const node = useRef<HTMLDivElement | null>(null);

  const measure = useCallback((next: HTMLDivElement | null) => {
    observed.current?.disconnect();
    observed.current = null;
    node.current = next;
    if (!next) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(next);
    observed.current = observer;
    setWidth(next.clientWidth);
  }, []);

  return [measure, width, node];
}

/** The spot the carried tile currently reads onto, which is what keeps the grid tall enough. */
interface Claim {
  row: number;
  col: number;
  span: number;
}

/** How long a displaced tile takes to reach its new cell. Matches the sortable rows elsewhere. */
const SLIDE_MS = 200;

/** ms one reading must hold still before the board acts on it. */
const REST_MS = 250;

/** What an armed reading is drawing: the board a release would leave, its ring, its refusal. */
interface Preview {
  /** The board to draw, or null to keep drawing the pre-drag one. */
  board: PlacementMap | null;
  /** The tile a release would folder into. */
  folderTarget: string | null;
  blocked: boolean;
}

/** Nothing armed. A constant, so re-clearing an already clear preview costs no render. */
const NOTHING_ARMED: Preview = { board: null, folderTarget: null, blocked: false };

/** The board a reading describes: every tile's home, the carried one included. */
const boardOf = (tiles: PackedTile[]): PlacementMap =>
  Object.fromEntries(tiles.map((tile) => [tile.id, { row: tile.row, col: tile.col }]));

/** One reading in a word, so a pointer move that means the same thing does not restart the rest. */
const readingKey = (reading: GestureReading): string =>
  `${reading.anchor.row}:${reading.anchor.col}:${reading.target?.id ?? ''}:${reading.intent}`;

/** True when two boards put every tile in the same cell. */
const samePlaces = (a: PlacementMap, b: PlacementMap): boolean => {
  const ids = Object.keys(a);
  return ids.length === Object.keys(b).length
    && ids.every((id) => b[id] && a[id].row === b[id].row && a[id].col === b[id].col);
};

/** Rows the grid needs to show every home it is drawing. */
const rowsFor = (
  places: PlacementMap,
  ids: string[],
  span: (id: string) => number,
  claim: Claim | null,
): number => Math.max(
  claim ? claim.row + claim.span : 1,
  ...ids.map((id) => (places[id] ? places[id].row + span(id) : 1)),
);

/** The header of the folder view: back out and rename in place. Taking a tile out is a menu item. */
function FolderHeader({ name, settings, onBack, onRename }: {
  name: string;
  settings?: React.ReactNode;
  onBack: () => void;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  return (
    <div className="px-4 pb-3 flex flex-wrap items-center gap-3">
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
    </div>
  );
}

/**
 * One library tab's grid, as sizable tiles that can be grouped into folders.
 *
 * The grid layout packs tiles at their own size — half, one, or double a medium tile — while the
 * detailed layout keeps uniform cards and shows folders as cards among them. Clicking a folder swaps the
 * grid for that folder's members, with a header that renames it in place.
 *
 * A drag reads like an Android home screen: nothing moves while the hand travels, and a rest of
 * {@link REST_MS} arms whatever the pointer is reading. A rest past the middle of a tile moves —
 * a shared row or column pushes, anything else swaps — and a rest short of it folders the carried tile
 * into the target instead. Everything else about folders stays in the context menu.
 *
 * @param items - Everything the tab holds; the arrangement decides which of them the grid draws
 * @param idOf - The library id of one item, which is what the arrangement is keyed by
 * @param tiles - This tab's arrangement and the actions the grid dispatches against it
 * @param renderCard - The tab's own card for one item, told how to fill and label its tile
 * @param groupSettings - Settings shown in the folder header; omit on tabs that carry none
 * @param onDelete - Deletes one item, offered as the context menu's last entry
 */
export function LibraryTileGrid<T>({
  items,
  idOf,
  tiles,
  layout,
  aspect,
  minMediumWidth,
  detailedColumnsClass,
  thumbnailOf,
  renderCard,
  groupSettings,
  groupPresetName,
  emptyState,
  onDelete,
}: {
  items: T[];
  idOf: (item: T) => string;
  tiles: LibraryTiles;
  layout: 'grid' | 'detailed';
  aspect: ThumbAspect;
  /** The narrowest a medium tile may render, in px; the grid fits as many columns as that allows. */
  minMediumWidth: number;
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
  onDelete?: (id: string) => void;
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  // The drag in progress. The grid layout draws the pre-drag board until a reading has rested, and the
  // armed reading's board after — so the only movement on screen is one the player waited for. The
  // detailed layout has no cells to read, so it keeps the flat list's own live reorder.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<Preview>(NOTHING_ARMED);
  const [claim, setClaim] = useState<Claim | null>(null);
  // The tile elements and the board they were last painted at, which is what a slide is measured from.
  // The column count rides along, because a cell only means a distance on the board it was read from;
  // so does each tile's span, because a resize has to be animated from the size that was on screen.
  const tileNodes = useRef(new Map<string, HTMLDivElement>());
  const paintedRef = useRef<{
    columns: number;
    places: PlacementMap;
    spans: Record<string, number>;
  } | null>(null);
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number } | null>(null);
  const drawnRef = useRef<string[] | null>(null);
  // The gesture's fixed facts: the board as it stood when the drag began, which every reading is
  // computed against, and which cell of its own footprint the player grabbed.
  const preTilesRef = useRef<PackedTile[]>([]);
  const carriedRef = useRef<{ id: string; grabCell: TilePlacement } | null>(null);
  // The ghost's geometry: how far into the tile the press landed, its box, and the scroll viewport the
  // overlay is clamped to — so the ghost's corner can be read from the pointer without the DOM.
  const ghostRef = useRef<{
    grab: { x: number; y: number };
    size: { width: number; height: number };
    bounds: DOMRect | null;
  } | null>(null);
  // The tile just let go of. It stands in its cell on the commit paint; the slide leaves it there.
  const releasedRef = useRef<string | null>(null);
  // The pointer's latest reading, which is what a release commits — armed or not, so a drag too quick
  // to have rested still lands on the spot under the hand. `keyRef` is what the rest is waiting out.
  const readingRef = useRef<GestureReading | null>(null);
  const keyRef = useRef<string | null>(null);
  const restRef = useRef<number | null>(null);
  // Where the pointer actually is. dnd-kit's own delta is the MODIFIED translate, so the carried
  // tile's clamp to the scroll viewport bleeds into it: near the bottom of a list the read stops
  // short of the hand and every far-side rest reads as a near-side one. The pointer is never clamped.
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  const [measureGrid, width, gridNode] = useMeasuredWidth();

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

  const mediumCols = fitMediumColumns(width, minMediumWidth);
  const baseCols = mediumCols * 2;

  const spanOf = useCallback(
    (id: string) => spanAt(tiles.size(id), baseCols),
    [tiles, baseCols],
  );

  // Where every tile lives at this width: the arrangement the player left, seeded through the packer at
  // a width they have never used, with anything homeless dropped into the first free block.
  const homes = useMemo(
    () => (layout === 'grid' ? resolvePlacements(tiles.organization, renderedIds, baseCols) : {}),
    [layout, tiles.organization, renderedIds, baseCols],
  );

  // The board on screen right now. While a grid drag runs this IS the preview: tiles hold real cells at
  // every moment, and the slide effect below animates them when those cells change.
  const live = preview.board ?? homes;
  const drawnIds = layout === 'grid' ? rowMajor(live, renderedIds) : drawn ?? renderedIds;

  // Row height comes from the medium tile's ratio, so a medium tile is exactly the size it always was
  // and the half and double sizes fall out of it.
  const cellWidth = width > 0 ? (width - (baseCols - 1) * GAP) / baseCols : 0;
  const cellHeight = cellWidth > 0 ? ((2 * cellWidth + GAP) / THUMB_RATIO[aspect] - GAP) / 2 : 0;
  const pitch = { x: cellWidth + GAP, y: cellHeight + GAP };

  // The slide, run before the browser paints the new cells: each moved tile is pushed back to where it
  // was, the push is forced into the layout, and then released. Doing it here rather than through state
  // is what makes the movement answer the gesture instead of trailing a frame or two behind it.
  useLayoutEffect(() => {
    const before = paintedRef.current;
    const measured = cellWidth > 0 && cellHeight > 0;
    const spans = Object.fromEntries(drawnIds.map((id) => [id, spanOf(id)]));
    // A cell means something different on a board of a different width, so a board painted at one
    // column count is no distance at all from a board painted at another. Both the unmeasured grid and
    // the width that just changed drop the comparison rather than animate against it.
    paintedRef.current = layout === 'grid' && measured
      ? { columns: baseCols, places: live, spans }
      : null;
    const released = releasedRef.current;
    if (!activeId) releasedRef.current = null;
    if (!before || !measured || before.columns !== baseCols) return;

    // Each moved tile is pushed back to where it was — and a resized one back to the size it was —
    // then the push is forced into the layout and released. The carried tile is left out: the overlay
    // under the pointer is already drawing it.
    for (const [id, at] of Object.entries(live)) {
      const node = tileNodes.current.get(id);
      const was = before.places[id];
      if (!node || !was || id === activeId || id === released) continue;
      const dx = (was.col - at.col) * pitch.x;
      const dy = (was.row - at.row) * pitch.y;
      const from = before.spans[id] ?? spans[id];
      const resized = from !== spans[id];
      if (!dx && !dy && !resized) continue;

      node.style.transition = 'none';
      node.style.transform = dx || dy ? `translate3d(${dx}px, ${dy}px, 0)` : '';
      if (resized) {
        node.style.width = `${from * cellWidth + (from - 1) * GAP}px`;
        node.style.height = `${from * cellHeight + (from - 1) * GAP}px`;
      }
      // Read the box back, so the browser has a start value to animate away from.
      void node.offsetHeight;
      node.style.transition = resized
        ? `transform ${SLIDE_MS}ms ease, width ${SLIDE_MS}ms ease, height ${SLIDE_MS}ms ease`
        : `transform ${SLIDE_MS}ms ease`;
      node.style.transform = '';
      if (resized) {
        // A transition cannot end at `auto`, so the target is written in pixels and the box handed
        // back to the grid once the animation settles.
        node.style.width = `${spans[id] * cellWidth + (spans[id] - 1) * GAP}px`;
        node.style.height = `${spans[id] * cellHeight + (spans[id] - 1) * GAP}px`;
        const settle = () => {
          node.style.width = '';
          node.style.height = '';
        };
        node.addEventListener('transitionend', settle, { once: true });
        node.addEventListener('transitioncancel', settle, { once: true });
      }
    }
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // The tile a slide-aside just moved, so the same collision events cannot re-trigger it before the
  // board's rects are re-measured. Cleared as soon as the drag settles over anything else.
  const settledRef = useRef<string | null>(null);

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

  /**
   * Where the pointer sits on the board, in base cells.
   *
   * The grid's own box carries the scroll, so a point on the screen and that box are the whole reading:
   * the board sliding under a still hand moves the reading with it, as it should. Half the gutter is
   * counted into the cell on each side of it, so a tile's own middle reads as its middle — otherwise
   * the gutters pile up on one side and the reading drifts a fraction of a cell per column, which is
   * enough to put a rest on a tile's center in the wrong half of it.
   */
  const pointerOn = () => {
    const grid = gridNode.current;
    const at = pointRef.current;
    if (!grid || !at || cellWidth <= 0 || cellHeight <= 0) return null;
    const box = grid.getBoundingClientRect();
    const x = (at.x - box.left + GAP / 2) / pitch.x;
    const y = (at.y - box.top + GAP / 2) / pitch.y;
    if (x < 0 || y < 0) return null;
    return { pointer: { x, y }, cell: { row: Math.floor(y), col: Math.floor(x) }, box };
  };

  /**
   * The ghost's top-left corner in base cells: the pointer less the press offset, held inside the
   * scroll viewport exactly as the overlay's modifier holds the ghost. Computed rather than read off
   * the overlay, which is drawn a move behind the pointer.
   */
  const ghostOn = (box: DOMRect) => {
    const ghost = ghostRef.current;
    const at = pointRef.current;
    if (!ghost || !at) return undefined;
    let left = at.x - ghost.grab.x;
    let top = at.y - ghost.grab.y;
    const { bounds, size } = ghost;
    if (bounds) {
      left = Math.min(Math.max(left, bounds.left), bounds.right - size.width);
      top = Math.min(Math.max(top, bounds.top), bounds.bottom - size.height);
    }
    return { x: (left - box.left) / pitch.x, y: (top - box.top) / pitch.y };
  };

  /** Stop the rest countdown and put the board back to what it was drawing before anything armed. */
  const disarm = () => {
    if (restRef.current !== null) {
      clearTimeout(restRef.current);
      restRef.current = null;
    }
    setPreview(NOTHING_ARMED);
  };

  /**
   * Folders never nest, and a folder's own view holds no folders to make. Where neither can happen the
   * reader is handed a far slice that covers the whole target, so every rest on it reads as a move.
   */
  const sliceFor = (carriedId: string) =>
    (openGroupId || tiles.group(carriedId) ? 1 : SLICE_SHARE);

  /**
   * The per-move reading, for the grid layout: what the pointer means against the board as it stood
   * when the drag began. Nothing is drawn from it yet — a reading has to hold still for {@link REST_MS}
   * before the board acts on it, so travel across the board moves nothing at all.
   *
   * The claim follows the reading rather than the rest, because it only keeps the grid tall enough to
   * point into: a spot the player cannot reach is a spot they cannot rest on.
   */
  const readDrag = () => {
    const carried = carriedRef.current;
    const read = carried && pointerOn();
    if (!carried || !read) return;

    const reading = readGesture({
      tiles: preTilesRef.current,
      carriedId: carried.id,
      columns: baseCols,
      grabCell: carried.grabCell,
      pointerCell: read.cell,
      pointer: read.pointer,
      ghost: ghostOn(read.box),
      share: sliceFor(carried.id),
    });
    readingRef.current = reading;
    const key = readingKey(reading);
    if (key === keyRef.current) return;
    keyRef.current = key;
    setClaim({ ...reading.anchor, span: spanOf(carried.id) });
    disarm();
    restRef.current = window.setTimeout(() => {
      restRef.current = null;
      setPreview({
        // A blocked reading and a folder reading both leave the board alone: one because it cannot
        // happen, the other because grouping is not a rearrangement.
        board: reading.blocked || reading.intent === 'folder' ? null : boardOf(reading.tiles),
        folderTarget: reading.intent === 'folder' ? reading.target?.id ?? null : null,
        blocked: reading.blocked,
      });
    }, REST_MS);
  };

  const readRef = useRef(readDrag);
  useEffect(() => { readRef.current = readDrag; });

  /**
   * The pointer itself drives the reading, on the same two streams dnd-kit's sensors read.
   *
   * dnd-kit's own move event carries the MODIFIED translate, so the carried tile's clamp to the scroll
   * viewport does two things to it: it shifts the position, and once the clamp bites the event stops
   * firing entirely — the drag goes deaf exactly where a player is reaching for the last row.
   * `pointermove` is no good either, because the browser coalesces those to the frame and a reading
   * would run several moves behind the hand. dnd-kit's event is still wired up alongside this, because
   * a list scrolling under a still hand moves the board without moving the pointer.
   */
  useEffect(() => {
    if (!activeId || layout !== 'grid') return;
    const track = (event: Event) => {
      const at = getEventCoordinates(event as MouseEvent | TouchEvent);
      if (!at) return;
      pointRef.current = at;
      readRef.current();
    };
    window.addEventListener('mousemove', track, { capture: true, passive: true });
    window.addEventListener('touchmove', track, { capture: true, passive: true });
    return () => {
      window.removeEventListener('mousemove', track, { capture: true });
      window.removeEventListener('touchmove', track, { capture: true });
    };
  }, [activeId, layout]);

  /**
   * The per-move reading for the detailed layout, which has no cells to simulate. Crossing onto a card
   * slides it aside at once — there is nothing else a hover could mean, so there is nothing to wait to
   * find out.
   */
  const slideAside = (event: DragMoveEvent | DragOverEvent) => {
    const { active, over } = event;
    const id = String(active.id);
    const overId = over && String(over.id) !== id ? String(over.id) : null;
    if (settledRef.current && settledRef.current !== overId) settledRef.current = null;
    if (!overId || overId === settledRef.current) return;
    dodge(id, overId);
  };

  const updateDrag = (event: DragMoveEvent | DragOverEvent) => {
    if (!overlaySize) {
      const initial = event.active.rect.current.initial;
      if (initial) setOverlaySize({ width: initial.width, height: initial.height });
    }
    if (layout === 'grid') readDrag();
    else slideAside(event);
  };

  const resetDrag = () => {
    disarm();
    pointRef.current = null;
    settledRef.current = null;
    drawnRef.current = null;
    preTilesRef.current = [];
    carriedRef.current = null;
    ghostRef.current = null;
    releasedRef.current = null;
    readingRef.current = null;
    keyRef.current = null;
    setDrawn(null);
    setClaim(null);
    setActiveId(null);
    setOverlaySize(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (layout === 'grid') {
      // The reading under the hand at the moment of release, armed or not: a drag too quick to have
      // rested still lands where it was let go. A blocked reading commits nothing at all.
      const reading = readingRef.current;
      const id = String(event.active.id);
      resetDrag();
      releasedRef.current = id;
      if (!reading || reading.blocked) return;

      if (reading.intent === 'folder' && reading.target) {
        const target = reading.target.id;
        if (tiles.group(target)) tiles.addTo(id, target);
        else tiles.groupWith(id, target);
        return;
      }
      const settled = boardOf(reading.tiles);
      if (!samePlaces(settled, homes)) {
        tiles.commitPlacements(baseCols, settled, renderedIds, openGroupId);
      }
      return;
    }

    // The drop persists the order on screen, with one last stock arrayMove toward the card released on,
    // so a drop too quick to have slid anything still lands where every plain sortable would put it.
    let order = drawnRef.current ?? renderedIds;
    resetDrag();
    const { active, over } = event;
    if (!over) return;

    const id = String(active.id);
    if (String(over.id) !== id) {
      const from = order.indexOf(id);
      const to = order.indexOf(String(over.id));
      if (from !== -1 && to !== -1 && from !== to) order = arrayMove(order, from, to);
    }
    if (!sameIds(order, renderedIds)) tiles.commitOrder(order, openGroupId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    resetDrag();
    setActiveId(id);
    if (layout !== 'grid') {
      drawnRef.current = [...renderedIds];
      setDrawn(drawnRef.current);
      return;
    }

    const home = homes[id];
    const grid = gridNode.current;
    const pressed = getEventCoordinates(event.activatorEvent);
    if (!home || !grid || !pressed || cellWidth <= 0 || cellHeight <= 0) return;

    // Seeded from the press, because the first reading can arrive before the tracker is listening.
    pointRef.current = { x: pressed.x, y: pressed.y };

    const tileNode = tileNodes.current.get(id);
    const tileBox = tileNode?.getBoundingClientRect();
    if (tileNode && tileBox) {
      ghostRef.current = {
        grab: { x: pressed.x - tileBox.left, y: pressed.y - tileBox.top },
        size: { width: tileBox.width, height: tileBox.height },
        bounds: getScrollableAncestors(tileNode)[0]?.getBoundingClientRect() ?? null,
      };
    }

    // Which cell of its own footprint the player took hold of. It only decides where an open-space
    // drop lands: over a target the reader snaps the footprint and the grab offset drops out.
    const box = grid.getBoundingClientRect();
    const span = spanOf(id);
    const inside = (cell: number) => Math.min(Math.max(0, cell), span - 1);
    carriedRef.current = {
      id,
      grabCell: {
        row: inside(Math.floor((pressed.y - box.top + GAP / 2) / pitch.y) - home.row),
        col: inside(Math.floor((pressed.x - box.left + GAP / 2) / pitch.x) - home.col),
      },
    };
    preTilesRef.current = renderedIds
      .filter((tileId) => homes[tileId])
      .map((tileId) => ({ id: tileId, ...homes[tileId], span: spanOf(tileId) }));
    setClaim({ ...home, span });
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
              onValueChange={(value) => tiles.setSize(id, value as LibraryTileSize, renderedIds, baseCols)}
            >
              {/* The shared radio item only draws its check when told: it takes `checked` itself
                  rather than reading the group. */}
              {SIZE_LABELS.map(({ size, label }) => (
                <ContextMenuRadioItem key={size} value={size} checked={tiles.size(id) === size}>
                  {label}
                </ContextMenuRadioItem>
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

        {/* The card draws no delete control anymore, so the menu is where an item is deleted. */}
        {!group && onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDelete(id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </ContextMenuItem>
          </>
        )}
      </>
    );
  };

  const renderTile = (id: string) => {
    const group = tiles.group(id);
    const item = byId.get(id);
    if (!group && !item) return null;

    const spot = live[id];
    const size = tiles.size(id);
    const compact = layout === 'grid' && size === 'small';
    // `transform` and `transition` are left out on purpose: the slide effect owns both, and a value
    // written here would be reset by React on the very next render mid-gesture.
    const style: React.CSSProperties | undefined = spot && layout === 'grid'
      ? {
        gridColumn: `${spot.col + 1} / span ${spanOf(id)}`,
        gridRow: `${spot.row + 1} / span ${spanOf(id)}`,
      }
      : undefined;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            ref={(node) => {
              if (node) tileNodes.current.set(id, node);
              else tileNodes.current.delete(id);
            }}
            style={style}
            data-group-target={id === preview.folderTarget ? '' : undefined}
            className={cn(
              'relative min-w-0',
              layout === 'detailed' && 'h-full',
              // The carried tile's slot stands empty, because the overlay is already drawing it. Leaving
              // a dimmed copy here would put two of the same tile on screen at once, which the flat grid
              // never did: it floated the card itself and left a gap behind.
              id === activeId && 'opacity-0',
            )}
          >
            {/* Inner highlight, per the app standard — an outer ring clips against neighbors. Drawn as
                an overlay because an inset ring on the wrapper itself would paint behind the card. */}
            {id === preview.folderTarget && (
              <div className="pointer-events-none absolute inset-0 z-10 rounded-lg ring-2 ring-inset ring-primary" />
            )}
            {group ? (
              <LibraryGroupTile
                group={group}
                aspect={aspect}
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
      gridTemplateRows: `repeat(${rowsFor(live, drawnIds, spanOf, claim)}, ${Math.max(1, Math.round(cellHeight))}px)`,
    }
    : {};

  /**
   * The overlay's stand-in for the carried tile: the thumbnail — or a folder's mosaic — in a box the
   * size the tile had. The real card components register sortables, which the overlay must not, so
   * this is a plain clone rather than a second render of the card.
   *
   * Half opacity, and nothing else: the flat grid carried the card itself at exactly this, with no
   * shadow or ring under the hand. The one exception is a spot that cannot take the tile, which says so
   * under the hand rather than waiting for the release to do nothing.
   */
  const overlayContent = (id: string) => {
    const group = tiles.group(id);
    const item = byId.get(id);
    const thumb = item ? thumbnailOf(item) : undefined;
    return (
      <div className={cn(
        'h-full w-full overflow-hidden rounded-lg bg-card opacity-50',
        preview.blocked && 'ring-2 ring-inset ring-destructive',
      )}>
        {group ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px">
            {Array.from({ length: 4 }, (_, i) => {
              const member = byId.get(group.members[i] ?? '');
              const memberThumb = member ? thumbnailOf(member) : undefined;
              return memberThumb
                ? <img key={i} src={memberThumb} alt="" className={cn('h-full w-full', thumbFit(aspect))} />
                : <div key={i} className="h-full w-full bg-muted" />;
            })}
          </div>
        ) : thumb
          ? <img src={thumb} alt="" className={cn('h-full w-full', thumbFit(aspect))} />
          : <div className="h-full w-full bg-muted" />}
      </div>
    );
  };

  return (
    <EditorDndContext
      // A mouse press and a long press on touch, rather than one pointer sensor: a tile is also a scroll
      // surface on a phone, so a drag there has to be asked for by holding still first.
      sensors={sensors}
      onDragStart={handleDragStart}
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
          settings={groupSettings?.(openGroup.id)}
          onBack={() => setOpenGroupId(null)}
          onRename={(name) => tiles.rename(openGroup.id, name)}
        />
      )}
      <ScrollArea className="flex-1 min-h-0 px-4">
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
      {/* No drop animation: the old grid settled in one frame, and the default 250ms slide fights the
          synchronous state reset — its side effect re-hides the just-revealed tile, which reads as a
          flash. On release the overlay vanishes and the tile stands in its slot, same paint. */}
      <DragOverlay dropAnimation={null}>
        {activeId && overlaySize && (
          <div
            style={overlaySize}
            className="pointer-events-none"
            data-drag-blocked={preview.blocked ? '' : undefined}
          >
            {overlayContent(activeId)}
          </div>
        )}
      </DragOverlay>
    </EditorDndContext>
  );
}
