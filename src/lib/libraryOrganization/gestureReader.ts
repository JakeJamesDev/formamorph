import type { PackedTile } from './packer';
import type { TilePlacement } from './types';

/** A pointer position in base-cell units, measured from the board's top-left corner. */
export interface BoardPoint {
  x: number;
  y: number;
}

/** What a rest on the current reading would do: relocate the carried tile, or folder it into a target. */
export type GestureIntent = 'move' | 'folder';

/** One pointer reading of a drag, against the board as it stood when the drag began. */
export interface GestureInput {
  /** Every tile's home before the drag, the carried one included. */
  tiles: PackedTile[];
  carriedId: string;
  /** Base-cell columns the board is wide. */
  columns: number;
  /** Which cell of its own footprint the player grabbed. */
  grabCell: TilePlacement;
  /** The cell the pointer sits in. */
  pointerCell: TilePlacement;
  /** Where the pointer sits within that cell, for the move-versus-folder split. */
  pointer: BoardPoint;
  /** Share of the target the far slice covers. Defaults to {@link SLICE_SHARE}. */
  share?: number;
}

/** What one pointer reading means. */
export interface GestureReading {
  /** The tile under the pointer, or null over open board or the carried tile's own home. */
  target: PackedTile | null;
  intent: GestureIntent;
  /** Where the carried footprint's top-left corner lands. */
  anchor: TilePlacement;
  /** The whole board a release would commit, the carried tile included. */
  tiles: PackedTile[];
  /** Ids that changed place, the carried tile excluded. */
  moved: string[];
  blocked: boolean;
  /** Which tile refused and why, by id. Null when nothing refused. */
  reason: string | null;
}

/** Share of a target the far slice covers, so half of it moves and half of it folders. Fixed. */
export const SLICE_SHARE = 0.5;

/** A rectangle of base cells. Footprints are square; the push band is not. */
interface Rect {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

const rectOf = (tile: PackedTile): Rect => ({
  row: tile.row, col: tile.col, rows: tile.span, cols: tile.span,
});

const hits = (a: Rect, b: Rect): boolean =>
  a.row < b.row + b.rows && b.row < a.row + a.rows
  && a.col < b.col + b.cols && b.col < a.col + a.cols;

const covers = (tile: PackedTile, cell: TilePlacement): boolean =>
  tile.row <= cell.row && cell.row < tile.row + tile.span
  && tile.col <= cell.col && cell.col < tile.col + tile.span;

/** The board a move leaves, or the reason it cannot happen. */
interface MoveOutcome {
  tiles: PackedTile[];
  moved: string[];
  blocked: boolean;
  reason: string | null;
}

/**
 * What the rest of the board does when the carried footprint is pinned at `anchor`.
 *
 * Nothing under the footprint is an open move. A pin sharing the pickup's row or column is a push:
 * every tile in the band between the two footprints shifts one carried span toward the hole. Anything
 * else is a swap: the tiles under the footprint translate by the vector back to the pickup. Either way
 * every mover has to stay on the board, clear the pinned footprint, and land on no bystander.
 */
function applyMove(
  others: PackedTile[],
  carried: PackedTile,
  anchor: TilePlacement,
  columns: number,
): MoveOutcome {
  const asIs: MoveOutcome = { tiles: others, moved: [], blocked: false, reason: null };
  if (anchor.row === carried.row && anchor.col === carried.col) return asIs;

  const pinned: Rect = { row: anchor.row, col: anchor.col, rows: carried.span, cols: carried.span };
  const hit = others.filter((tile) => hits(pinned, rectOf(tile)));
  if (!hit.length) return asIs;

  const sameRow = anchor.row === carried.row;
  const sameCol = anchor.col === carried.col;
  let movers: PackedTile[];
  let vector: TilePlacement;
  if (sameRow || sameCol) {
    const band: Rect = {
      row: Math.min(carried.row, anchor.row),
      col: Math.min(carried.col, anchor.col),
      rows: Math.abs(anchor.row - carried.row) + carried.span,
      cols: Math.abs(anchor.col - carried.col) + carried.span,
    };
    movers = others.filter((tile) => hits(band, rectOf(tile)));
    const axis = sameRow ? 'col' : 'row';
    const toward = anchor[axis] > carried[axis] ? -carried.span : carried.span;
    vector = sameRow ? { row: 0, col: toward } : { row: toward, col: 0 };
  } else {
    movers = hit;
    vector = { row: carried.row - anchor.row, col: carried.col - anchor.col };
  }

  const stay = others.filter((tile) => !movers.includes(tile));
  const moved = movers.map((tile) => ({
    ...tile, row: tile.row + vector.row, col: tile.col + vector.col,
  }));
  for (const mover of moved) {
    if (mover.row < 0 || mover.col < 0 || mover.col + mover.span > columns) {
      return { ...asIs, blocked: true, reason: `${mover.id} would leave the board` };
    }
    if (hits(pinned, rectOf(mover))) {
      return { ...asIs, blocked: true, reason: `${mover.id} would still sit under ${carried.id}` };
    }
    const bystander = stay.find((tile) => hits(rectOf(tile), rectOf(mover)));
    if (bystander) {
      return { ...asIs, blocked: true, reason: `${mover.id} would land on ${bystander.id}` };
    }
  }

  const shifted = new Map(moved.map((tile) => [tile.id, tile]));
  return {
    tiles: others.map((tile) => shifted.get(tile.id) ?? tile),
    moved: moved.map((tile) => tile.id),
    blocked: false,
    reason: null,
  };
}

const clampAnchor = (anchor: TilePlacement, span: number, columns: number): TilePlacement => ({
  row: Math.max(0, anchor.row),
  col: Math.min(Math.max(0, anchor.col), columns - span),
});

/**
 * Where the carried footprint lands.
 *
 * Over open board it follows the pointer, offset by the cell the player grabbed. Over a target the
 * grab offset drops out and size fixes the range instead: a bigger carried tile has to contain the
 * target, a smaller one has to sit inside it, equal sizes take its cells. Spots in that range are
 * tried nearest the pickup first, so a big tile settles back toward home, and the first whose move
 * works wins. When every spot blocks the nearest one stands, and the reading shows as blocked.
 */
function snapAnchor(
  others: PackedTile[],
  carried: PackedTile,
  target: PackedTile | null,
  grabCell: TilePlacement,
  pointerCell: TilePlacement,
  columns: number,
): TilePlacement {
  const span = carried.span;
  if (!target) {
    return clampAnchor(
      { row: pointerCell.row - grabCell.row, col: pointerCell.col - grabCell.col },
      span,
      columns,
    );
  }

  const range = (start: number, extent: number): [number, number] => {
    const far = start + extent - span;
    return [Math.min(far, start), Math.max(far, start)];
  };
  const [firstRow, lastRow] = range(target.row, target.span);
  const [firstCol, lastCol] = range(target.col, target.span);
  const candidates: TilePlacement[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const spot = clampAnchor({ row, col }, span, columns);
      if (!candidates.some((seen) => seen.row === spot.row && seen.col === spot.col)) {
        candidates.push(spot);
      }
    }
  }
  const reach = (spot: TilePlacement) =>
    (spot.row - carried.row) ** 2 + (spot.col - carried.col) ** 2;
  candidates.sort((a, b) => reach(a) - reach(b));
  return candidates.find((spot) => !applyMove(others, carried, spot, columns).blocked)
    ?? candidates[0];
}

/**
 * Which half of the target the pointer rests in.
 *
 * A line runs from the pickup's center to the target's center. The pointer is projected onto that
 * line, and the far slice covers `share` of the target's extent along it. Resting past the split
 * moves; resting short of it folders. The reader knows nothing about folders as such, so a folder
 * tile splits like any other tile and the caller decides whether a release creates one or joins one.
 */
function readIntent(
  carried: PackedTile,
  target: PackedTile | null,
  pointer: BoardPoint,
  share: number,
): GestureIntent {
  if (!target) return 'move';
  const from = { x: carried.col + carried.span / 2, y: carried.row + carried.span / 2 };
  const to = { x: target.col + target.span / 2, y: target.row + target.span / 2 };
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const line = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const half = (target.span / 2) * (Math.abs(line.x) + Math.abs(line.y));
  const threshold = half * (1 - 2 * share);
  const along = (pointer.x - to.x) * line.x + (pointer.y - to.y) * line.y;
  return along >= threshold ? 'move' : 'folder';
}

/**
 * What one pointer reading of a tile drag means, against the board as it stood before the drag.
 *
 * The pointer names the target and which half of it the hand rests in; the half decides between
 * relocating the carried tile and foldering it into the target. A move reports the whole board it
 * would leave, so leaving a spot simply undoes it: every reading is computed from the pre-drag board,
 * never from the previous one. A blocked reading hands back the pre-drag board and says which tile
 * refused and why. A folder reading moves nothing, because grouping is the caller's operation.
 *
 * Pure: no DOM, no clock, no history between calls. The rest delay that arms a reading and the
 * rendering of it both belong to the grid.
 */
export function readGesture(input: GestureInput): GestureReading {
  const columns = Math.max(1, Math.floor(input.columns));
  const carried = input.tiles.find((tile) => tile.id === input.carriedId);
  if (!carried) throw new Error(`${input.carriedId} is not on the board`);

  const others = input.tiles.filter((tile) => tile.id !== input.carriedId);
  const target = others.find((tile) => covers(tile, input.pointerCell)) ?? null;
  const intent = readIntent(carried, target, input.pointer, input.share ?? SLICE_SHARE);
  const anchor = snapAnchor(
    others, carried, target, input.grabCell, input.pointerCell, columns,
  );
  const outcome = intent === 'folder'
    ? { tiles: others, moved: [], blocked: false, reason: null }
    : applyMove(others, carried, anchor, columns);

  const settled = outcome.blocked || intent === 'folder'
    ? carried
    : { ...carried, row: anchor.row, col: anchor.col };
  const byId = new Map(outcome.tiles.map((tile) => [tile.id, tile]));
  return {
    target,
    intent,
    anchor,
    tiles: input.tiles.map((tile) => (tile.id === carried.id ? settled : byId.get(tile.id)!)),
    moved: outcome.moved,
    blocked: outcome.blocked,
    reason: outcome.reason,
  };
}
