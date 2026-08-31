import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
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
  createCellSim,
  resolvePlacements,
  rowMajor,
  spanAt,
  type CellAnchor,
  type CellSim,
  type LibraryTileSize,
  type PlacementMap,
  type SimResult,
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

/** The dragged tile's footprint while a gesture runs, which is what keeps the grid tall enough. */
interface Claim {
  row: number;
  col: number;
  span: number;
}

/** One cell key, so an anchor that has not changed costs nothing. */
const anchorKey = (row: number, col: number) => `${row}:${col}`;

/** How long a displaced tile takes to reach its new cell. Matches the sortable rows elsewhere. */
const SLIDE_MS = 200;

/** ms the carried tile must hold over a standing tile before a release means group rather than move. */
const GROUP_HOLD_MS = 300;

/** The board a sim result describes: every tile's home, the dragged one included. */
const boardOf = (result: SimResult): PlacementMap => ({
  ...Object.fromEntries(result.tiles.map((tile) => [tile.id, { row: tile.row, col: tile.col }])),
  [result.pinned.id]: { row: result.pinned.row, col: result.pinned.col },
});

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
 * A drag moves a tile, and moving always wins. Only when the carried tile holds over a tile this
 * gesture cannot move does a group drop arm — the release then folds the carried tile into the one it
 * was held over. Everything else about folders stays in the context menu.
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
  // The drag in progress. The grid layout draws the LIVE board the cell simulation reports, so every
  // dodge the gesture has earned is on screen before the player lets go. The detailed layout has no
  // cells to simulate, so it keeps the flat list's own live reorder.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string[] | null>(null);
  const [board, setBoard] = useState<PlacementMap | null>(null);
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
  // One simulation per gesture: the sweep it accumulates is that gesture's own history.
  const simRef = useRef<CellSim | null>(null);
  const anchorRef = useRef<string | null>(null);
  // The last board the gesture could legally leave behind. A release over a blocked spot commits this
  // one rather than the illegal claim, so the dodges stand and the tile in the way is untouched.
  const validRef = useRef<PlacementMap | null>(null);
  // The tile a release would group the carried one into. Armed only after the carried tile has held
  // over a tile that stands its ground for GROUP_HOLD_MS; the ref mirrors the state for the handlers,
  // and holdRef is the countdown toward arming.
  const [groupTarget, setGroupTarget] = useState<string | null>(null);
  const groupTargetRef = useRef<string | null>(null);
  const holdRef = useRef<{ target: string; timer: number } | null>(null);
  // The last board the sim reported, so the arming read can run on pointer moves that changed no cell.
  const resultRef = useRef<SimResult | null>(null);
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
  // every moment, and dnd-kit's layout animations slide them when those cells change.
  const live = board ?? homes;
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
    if (!before || !measured || before.columns !== baseCols) return;

    // Each moved tile is pushed back to where it was — and a resized one back to the size it was —
    // then the push is forced into the layout and released. The carried tile is left out: the overlay
    // under the pointer is already drawing it.
    for (const [id, at] of Object.entries(live)) {
      const node = tileNodes.current.get(id);
      const was = before.places[id];
      if (!node || !was || id === activeId) continue;
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

  /** The cell the carried tile's top-left corner is currently over, in this grid's own coordinates. */
  const wantedAnchor = (event: DragMoveEvent | DragOverEvent) => {
    const grid = gridNode.current;
    const rect = event.active.rect.current.translated;
    if (!grid || !rect || cellWidth <= 0 || cellHeight <= 0) return null;
    const box = grid.getBoundingClientRect();
    return {
      row: Math.round((rect.top - box.top) / (cellHeight + GAP)),
      col: Math.round((rect.left - box.left) / (cellWidth + GAP)),
    };
  };

  /** Stop any countdown and stand down an armed group target. */
  const disarmGroup = () => {
    if (holdRef.current) {
      clearTimeout(holdRef.current.timer);
      holdRef.current = null;
    }
    if (groupTargetRef.current) {
      groupTargetRef.current = null;
      setGroupTarget(null);
    }
  };

  /** The cell the pointer itself is on, from the press point plus how far the drag has come. */
  const pointerCell = (event: DragMoveEvent | DragOverEvent): CellAnchor | null => {
    const grid = gridNode.current;
    const pressed = getEventCoordinates(event.activatorEvent);
    if (!grid || !pressed || cellWidth <= 0 || cellHeight <= 0) return null;
    const box = grid.getBoundingClientRect();
    const x = pressed.x + event.delta.x - box.left;
    const y = pressed.y + event.delta.y - box.top;
    if (x < 0 || y < 0) return null;
    return { row: Math.floor(y / (cellHeight + GAP)), col: Math.floor(x / (cellWidth + GAP)) };
  };

  /**
   * The tile a release right now could mean grouping into: the one standing under the pointer, or
   * failing that under the middle of the claim — the finger says the intent, the footprint backs it
   * up. A tile that could make way already has — the sim moves whatever consents on the same
   * advance — so a tile still standing there is one this gesture cannot move. Folders never nest, so a
   * carried folder has no candidate, and neither does a drag inside a folder view.
   */
  const groupCandidate = (result: SimResult, pointer: CellAnchor | null): string | null => {
    if (openGroupId || tiles.group(result.pinned.id)) return null;
    const standingAt = (row: number, col: number) => result.tiles.find((tile) =>
      tile.row <= row && row < tile.row + tile.span
      && tile.col <= col && col < tile.col + tile.span)?.id ?? null;
    const center = Math.floor(result.pinned.span / 2);
    return (pointer && standingAt(pointer.row, pointer.col))
      ?? standingAt(result.pinned.row + center, result.pinned.col + center);
  };

  /**
   * Grouping never overrides moving: it arms only after the carried tile has held over the same
   * standing tile for GROUP_HOLD_MS. Passing across a tile changes the candidate and resets the
   * countdown, and a tile that dodges away stops being the candidate the moment it moves.
   */
  const updateArming = (result: SimResult, pointer: CellAnchor | null) => {
    const candidate = groupCandidate(result, pointer);
    if (candidate === (holdRef.current?.target ?? groupTargetRef.current)) return;
    disarmGroup();
    if (!candidate) return;
    holdRef.current = {
      target: candidate,
      timer: window.setTimeout(() => {
        holdRef.current = null;
        groupTargetRef.current = candidate;
        setGroupTarget(candidate);
      }, GROUP_HOLD_MS),
    };
  };

  /**
   * The per-move reading, for the grid layout: step the gesture's simulation to the cell the tile is
   * over and draw whatever board that leaves. Cells the footprint sweeps dodge behind it at once, and a
   * whole group follows only once the gesture has swept half of it, so a big tile clipped at the corner
   * simply stands there.
   *
   * A blocked claim still draws the dodges that really happened; only the claim itself is refused, and
   * the release then commits the last board the gesture could legally leave.
   */
  const simulateDrag = (event: DragMoveEvent | DragOverEvent) => {
    const sim = simRef.current;
    const want = sim && wantedAnchor(event);
    if (!sim || !want) return;

    const key = anchorKey(want.row, want.col);
    if (key !== anchorRef.current) {
      anchorRef.current = key;
      const result = sim.advance(want);
      resultRef.current = result;
      const next = boardOf(result);
      setClaim(result.pinned);
      setBoard(next);
      // A blocked board is drawn — the dodges it holds really happened — but never remembered, so the
      // release falls back to the last one the gesture could legally have left behind.
      if (!result.blocked) validRef.current = next;
    }
    // Re-read on every move, not just anchor changes: the pointer can cross onto a tile — and change
    // what a release would mean — while the claim itself has not moved a cell.
    if (resultRef.current) updateArming(resultRef.current, pointerCell(event));
  };

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
    if (layout === 'grid') simulateDrag(event);
    else slideAside(event);
  };

  const resetDrag = () => {
    disarmGroup();
    resultRef.current = null;
    settledRef.current = null;
    drawnRef.current = null;
    simRef.current = null;
    anchorRef.current = null;
    validRef.current = null;
    setDrawn(null);
    setBoard(null);
    setClaim(null);
    setActiveId(null);
    setOverlaySize(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (layout === 'grid') {
      // The last board the gesture could legally leave. Every dodge that really happened is in it, and a
      // claim that was refused simply never landed.
      const target = groupTargetRef.current;
      const settled = validRef.current;
      resetDrag();
      if (settled && !samePlaces(settled, homes)) {
        tiles.commitPlacements(baseCols, settled, renderedIds, openGroupId);
      }
      // An armed release groups on top of the settled board: the dodges stand, and the carried tile
      // folds into the tile it was held over rather than landing anywhere.
      if (target) {
        const id = String(event.active.id);
        if (tiles.group(target)) tiles.addTo(id, target);
        else tiles.groupWith(id, target);
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

  const handleDragStart = ({ active }: { active: { id: string | number } }) => {
    const id = String(active.id);
    resetDrag();
    setActiveId(id);
    if (layout !== 'grid') {
      drawnRef.current = [...renderedIds];
      setDrawn(drawnRef.current);
      return;
    }
    if (!homes[id]) return;

    simRef.current = createCellSim(
      renderedIds
        .filter((tileId) => homes[tileId])
        .map((tileId) => ({ id: tileId, ...homes[tileId], span: spanOf(tileId) })),
      id,
      baseCols,
    );
    validRef.current = homes;
    anchorRef.current = anchorKey(homes[id].row, homes[id].col);
    setBoard(homes);
    setClaim({ ...homes[id], span: spanOf(id) });
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
            data-group-target={id === groupTarget ? '' : undefined}
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
            {id === groupTarget && (
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
   * shadow or ring under the hand.
   */
  const overlayContent = (id: string) => {
    const group = tiles.group(id);
    const item = byId.get(id);
    const thumb = item ? thumbnailOf(item) : undefined;
    return (
      <div className="h-full w-full overflow-hidden rounded-lg bg-card opacity-50">
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
          <div style={overlaySize} className="pointer-events-none">
            {overlayContent(activeId)}
          </div>
        )}
      </DragOverlay>
    </EditorDndContext>
  );
}
