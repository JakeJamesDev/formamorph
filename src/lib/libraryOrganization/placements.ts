import { packTiles, TILE_SPAN, type PackedTile } from './packer';
import type { LibraryTabOrganization, LibraryTileSize, PlacementMap } from './types';

/** The base-cell footprint a tile takes, clamped so a tile wider than the grid still fits on it. */
export const spanAt = (size: LibraryTileSize, columns: number): number =>
  Math.min(TILE_SPAN[size], Math.max(1, Math.floor(columns)));

/** Ids in the order the grid reads them: down the rows, then along each one. Homeless ids come last. */
export function rowMajor(places: PlacementMap, ids: string[]): string[] {
  const placed = ids.filter((id) => id in places);
  const rest = ids.filter((id) => !(id in places));
  placed.sort((a, b) => places[a].row - places[b].row || places[a].col - places[b].col);
  return [...placed, ...rest];
}

/** A board being filled in, as the footprints already claimed on it. */
interface Board {
  columns: number;
  taken: PackedTile[];
}

const hits = (a: PackedTile, b: PackedTile): boolean =>
  a.row < b.row + b.span && b.row < a.row + a.span
  && a.col < b.col + b.span && b.col < a.col + a.span;

const fits = (board: Board, tile: PackedTile): boolean =>
  tile.row >= 0 && tile.col >= 0 && tile.col + tile.span <= board.columns
  && !board.taken.some((other) => hits(other, tile));

/** The earliest free block of `span` cells, scanning row by row. A board always has one further down. */
function firstFit(board: Board, id: string, span: number): PackedTile {
  for (let row = 0; ; row++) {
    for (let col = 0; col <= board.columns - span; col++) {
      const tile = { id, row, col, span };
      if (fits(board, tile)) return tile;
    }
  }
}

/** Stored widths, nearest to `columns` first; a tie goes to the wider board, which says more. */
const nearestWidths = (placements: Record<number, PlacementMap>, columns: number): number[] =>
  Object.keys(placements)
    .map(Number)
    .filter((width) => Number.isFinite(width) && width > 0 && width !== columns)
    .sort((a, b) => Math.abs(a - columns) - Math.abs(b - columns) || b - a);

/**
 * The linear order a width never visited starts from: the nearest arranged width read the way the grid
 * reads it, and the tab's flat order for anything that width never held.
 */
function seedOrder(org: LibraryTabOrganization, ids: string[], columns: number): string[] {
  for (const width of nearestWidths(org.placements, columns)) {
    const places = org.placements[width];
    if (!ids.some((id) => id in places)) continue;
    return rowMajor(places, ids);
  }
  return ids;
}

/**
 * Every tile's home in one grid at one width.
 *
 * A width the player has arranged is returned as they left it, holes included — nothing here compacts,
 * repacks, or tidies. A width first seen is seeded from the nearest arranged one through the packer, so
 * a new device shows a familiar order rather than an alphabet. Anything with no home yet — a freshly
 * imported world, a tile whose stored spot no longer fits the grid — takes the first free block, which
 * leaves every other tile exactly where it was.
 *
 * Only `ids` are laid down, so the folders' member grids and the main grid never block each other even
 * though one map per width covers them all.
 *
 * @param ids - The tiles this grid draws, in the order to fall back on when nothing is stored
 * @param columns - Base-cell columns the grid is wide
 */
export function resolvePlacements(
  org: LibraryTabOrganization,
  ids: string[],
  columns: number,
): PlacementMap {
  const cols = Math.max(1, Math.floor(columns));
  const span = (id: string) => spanAt(org.sizes[id] ?? 'medium', cols);
  const stored = org.placements[cols];

  if (!stored) {
    const packed = packTiles(seedOrder(org, ids, cols), org.sizes, cols);
    return Object.fromEntries(packed.map((tile) => [tile.id, { row: tile.row, col: tile.col }]));
  }

  const board: Board = { columns: cols, taken: [] };
  const homeless: string[] = [];
  for (const id of rowMajor(stored, ids)) {
    const at = stored[id];
    const tile = at ? { id, row: at.row, col: at.col, span: span(id) } : null;
    if (tile && fits(board, tile)) board.taken.push(tile);
    else homeless.push(id);
  }
  for (const id of homeless) board.taken.push(firstFit(board, id, span(id)));

  return Object.fromEntries(board.taken.map((tile) => [tile.id, { row: tile.row, col: tile.col }]));
}

/** The organization with one width's map replaced; every other width is left alone. */
export function withPlacements(
  org: LibraryTabOrganization,
  columns: number,
  places: PlacementMap,
): LibraryTabOrganization {
  return { ...org, placements: { ...org.placements, [Math.max(1, Math.floor(columns))]: places } };
}

/**
 * Forget every home belonging to a tile the library no longer holds. The cells free up and every other
 * tile stays exactly where it was, so a deletion never reflows the board.
 *
 * Returns the same object when there is nothing to forget, so a load with no deletions writes nothing.
 */
export function prunePlacements(
  placements: Record<number, PlacementMap>,
  keep: Set<string>,
): Record<number, PlacementMap> {
  let changed = false;
  const next: Record<number, PlacementMap> = {};
  for (const [width, places] of Object.entries(placements)) {
    const kept = Object.entries(places).filter(([id]) => keep.has(id));
    if (kept.length !== Object.keys(places).length) changed = true;
    next[Number(width)] = Object.fromEntries(kept);
  }
  return changed ? next : placements;
}

/**
 * Re-place one tile at the size the organization now records for it, in every width it has a home in.
 *
 * Nothing else moves. A tile that still fits keeps its anchor, so shrinking never disturbs anything and
 * growing into free space is free. One that no longer fits takes the first free block instead of pushing
 * its neighbors around, so a resize can never destroy the arrangement it sits in.
 *
 * @param ids - The tiles sharing this tile's grid, so another grid's homes cannot block it
 */
export function resizePlacements(
  org: LibraryTabOrganization,
  id: string,
  ids: string[],
): LibraryTabOrganization {
  const placements: Record<number, PlacementMap> = {};
  for (const [key, places] of Object.entries(org.placements)) {
    const cols = Number(key);
    if (!(id in places) || !Number.isFinite(cols) || cols <= 0) {
      placements[cols] = places;
      continue;
    }

    const span = (tileId: string) => spanAt(org.sizes[tileId] ?? 'medium', cols);
    const board: Board = { columns: cols, taken: [] };
    for (const other of ids) {
      const at = places[other];
      if (other !== id && at) board.taken.push({ id: other, row: at.row, col: at.col, span: span(other) });
    }

    const held = { id, row: places[id].row, col: places[id].col, span: span(id) };
    const spot = fits(board, held) ? held : firstFit(board, id, span(id));
    placements[cols] = { ...places, [id]: { row: spot.row, col: spot.col } };
  }
  return { ...org, placements };
}
