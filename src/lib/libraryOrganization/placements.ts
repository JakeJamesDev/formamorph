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

/**
 * Remove every row and column no footprint touches, shifting everything up and left.
 *
 * Partial holes are the player's and stay put; a line nothing crosses is dead space the grid would
 * only ever scroll past. A footprint spanning a candidate line keeps it alive, so collapsing can never
 * fold a tile, and disjoint footprints stay disjoint because lines only ever move closer together.
 *
 * Returns the same array when nothing collapses, so callers can cheaply tell a no-op apart.
 */
export function collapseBoard(tiles: PackedTile[]): PackedTile[] {
  const used = { rows: new Set<number>(), cols: new Set<number>() };
  for (const tile of tiles) {
    for (let i = 0; i < tile.span; i++) {
      used.rows.add(tile.row + i);
      used.cols.add(tile.col + i);
    }
  }
  const packed = (lines: Set<number>): Map<number, number> =>
    new Map([...lines].sort((a, b) => a - b).map((line, index) => [line, index]));
  const rowTo = packed(used.rows);
  const colTo = packed(used.cols);
  const still = [...rowTo].every(([from, to]) => from === to)
    && [...colTo].every(([from, to]) => from === to);
  return still ? tiles : tiles.map((tile) => ({
    ...tile,
    row: rowTo.get(tile.row)!,
    col: colTo.get(tile.col)!,
  }));
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
 * A width the player has arranged is returned as they left it, holes included. The one tidying that
 * happens is {@link collapseBoard}: a row or column nothing touches folds away, so a partial hole is
 * the player's and dead lines are nobody's. A width first seen is seeded from the nearest arranged one
 * through the packer, so a new device shows a familiar order rather than an alphabet. Anything with no
 * home yet — a freshly imported world, a tile whose stored spot no longer fits the grid — takes the
 * first free block, which leaves every other tile exactly where it was.
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
    const packed = collapseBoard(packTiles(seedOrder(org, ids, cols), org.sizes, cols));
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

  return Object.fromEntries(
    collapseBoard(board.taken).map((tile) => [tile.id, { row: tile.row, col: tile.col }]),
  );
}

/**
 * The homes of a filtered view: `shown` packed in the order the full board reads, at their saved sizes.
 * A hidden tile leaves no hole, and the saved arrangement is only read.
 *
 * @param ids - Every tile of this grid, which fixes the reading order
 * @param shown - The tiles the filter lets through
 */
export function filteredPlacements(
  org: LibraryTabOrganization,
  ids: string[],
  shown: string[],
  columns: number,
): PlacementMap {
  const order = rowMajor(resolvePlacements(org, ids, columns), shown);
  const packed = collapseBoard(packTiles(order, org.sizes, Math.max(1, Math.floor(columns))));
  return Object.fromEntries(packed.map((tile) => [tile.id, { row: tile.row, col: tile.col }]));
}

/**
 * The spot that reads last on the board: on the last row, right of its last tile, when the rest of that row
 * has room; else the left end of a new row below everything.
 */
function afterLastTile(board: Board, id: string, span: number): PackedTile {
  if (board.taken.length === 0) return { id, row: 0, col: 0, span };
  const lastRow = Math.max(...board.taken.map((tile) => tile.row));
  const rightEdge = Math.max(...board.taken.filter((tile) => tile.row === lastRow).map((tile) => tile.col + tile.span));
  for (let col = rightEdge; col <= board.columns - span; col++) {
    const tile = { id, row: lastRow, col, span };
    if (fits(board, tile)) return tile;
  }
  const bottom = Math.max(...board.taken.map((tile) => tile.row + tile.span));
  return { id, row: bottom, col: 0, span };
}

/**
 * Give items that just arrived a saved home at the end of the board at every arranged width, and put them
 * last in the order. Saving the home is what keeps them there: an item with no home fills the first hole.
 *
 * The bottom is read from the board as drawn, and the drawn homes of the other top-level tiles are saved
 * with it. Nothing on screen moves, and no homeless tile can be fitted above the newcomer later.
 *
 * Only items the arrangement has never recorded count: none in the order, a folder, or any width's map.
 * So a repeat call changes nothing, and a wrong arrival list can never re-home a tile the player has.
 *
 * @param topLevel - The main grid's tiles, newcomers included
 * @param newcomers - Items that arrived since the player last loaded this tab
 */
export function withNewcomersAtEnd(
  org: LibraryTabOrganization,
  topLevel: string[],
  newcomers: string[],
): LibraryTabOrganization {
  const recorded = new Set([
    ...org.order,
    ...Object.values(org.groups).flatMap((group) => group.members),
    ...Object.values(org.placements).flatMap((places) => Object.keys(places)),
  ]);
  const fresh = newcomers.filter((id) => !recorded.has(id));
  if (fresh.length === 0) return org;
  const freshSet = new Set(fresh);
  const others = topLevel.filter((id) => !freshSet.has(id));

  const placements: Record<number, PlacementMap> = { ...org.placements };
  for (const [width, stored] of Object.entries(org.placements)) {
    const cols = Number(width);
    const span = (id: string) => spanAt(org.sizes[id] ?? 'medium', cols);
    const drawn = resolvePlacements(org, others, cols);
    const board: Board = {
      columns: cols,
      taken: others.map((id) => ({ id, row: drawn[id].row, col: drawn[id].col, span: span(id) })),
    };
    const added: PlacementMap = {};
    for (const id of fresh) {
      const tile = afterLastTile(board, id, span(id));
      board.taken.push(tile);
      added[id] = { row: tile.row, col: tile.col };
    }
    // Folder members keep their own homes; only this grid's tiles are written.
    placements[cols] = { ...stored, ...drawn, ...added };
  }
  return { ...org, placements, order: [...org.order, ...fresh] };
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

/** The free block of the tile's span nearest its own anchor. The rows past everything are empty, so
 *  scanning one span beyond the tallest footprint always finds one. */
function nearestFit(board: Board, tile: PackedTile): PackedTile {
  const limit = board.taken.reduce((max, t) => Math.max(max, t.row + t.span), 0) + tile.span;
  let best: { score: number; spot: PackedTile } | null = null;
  for (let row = 0; row <= limit; row++) {
    for (let col = 0; col <= board.columns - tile.span; col++) {
      const spot = { ...tile, row, col };
      if (!fits(board, spot)) continue;
      const score = (row - tile.row) ** 2 + (col - tile.col) ** 2;
      if (!best || score < best.score) best = { score, spot };
    }
  }
  return best!.spot;
}

/**
 * Re-place one tile at the size the organization now records for it, in every width it has a home in.
 *
 * The tile grows where it stands, and whoever the bigger footprint lands on moves to their own nearest
 * free block instead — closest casualties first — so a resize is felt right where it happened rather
 * than throwing the resized tile across the board. Shrinking lands on no one and so moves nothing.
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
    const at = places[id];
    const grown: PackedTile = { id, row: at.row, col: Math.min(at.col, cols - span(id)), span: span(id) };
    const others = ids
      .filter((other) => other !== id && places[other])
      .map((other) => ({ id: other, ...places[other], span: span(other) }));

    const board: Board = { columns: cols, taken: [grown, ...others.filter((t) => !hits(t, grown))] };
    const bumped = others
      .filter((t) => hits(t, grown))
      .sort((a, b) =>
        (a.row - grown.row) ** 2 + (a.col - grown.col) ** 2
        - ((b.row - grown.row) ** 2 + (b.col - grown.col) ** 2));
    for (const tile of bumped) board.taken.push(nearestFit(board, tile));

    placements[cols] = {
      ...places,
      ...Object.fromEntries(board.taken.map((t) => [t.id, { row: t.row, col: t.col }])),
    };
  }
  return { ...org, placements };
}
