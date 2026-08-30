import type { LibraryTileSize } from './types';

/** A tile's place in the base-cell grid: `span` cells wide and the same number tall. */
export interface PackedTile {
  id: string;
  row: number;
  col: number;
  span: number;
}

/** Base cells per side, at half / one / double a medium tile. */
export const TILE_SPAN: Record<LibraryTileSize, number> = { small: 1, medium: 2, large: 4 };

/** The column a run of small tiles is filling, and how deep it has stacked so far. */
interface SmallRun {
  row: number;
  col: number;
  depth: number;
}

/**
 * Place every tile in the order list into a `columns`-wide grid of base cells.
 *
 * Tiles are laid down in order and first-fit into the earliest free block, so a later small tile
 * backfills a hole a large one left rather than starting a new row. A run of consecutive small tiles
 * packs column-first instead: the second sits below the first, then the run steps one column right, so
 * four in a row fill exactly the block one medium tile would have taken.
 *
 * A tile wider than the grid is clamped to the full width rather than dropped, which keeps a large tile
 * visible on a narrow phone grid.
 *
 * @param order - Tile ids, top level or one group's members, in render order
 * @param sizes - Recorded size per id; anything missing counts as medium
 * @param columns - Base-cell columns available, i.e. twice the medium-tile column count
 */
export function packTiles(
  order: string[],
  sizes: Record<string, LibraryTileSize>,
  columns: number,
): PackedTile[] {
  const cols = Math.max(1, Math.floor(columns));
  const occupied: boolean[][] = [];

  const free = (row: number, col: number) => !occupied[row]?.[col];
  const fits = (row: number, col: number, span: number) => {
    if (col + span > cols) return false;
    for (let r = row; r < row + span; r++) {
      for (let c = col; c < col + span; c++) if (!free(r, c)) return false;
    }
    return true;
  };
  const mark = (row: number, col: number, span: number) => {
    for (let r = row; r < row + span; r++) {
      occupied[r] = occupied[r] ?? [];
      for (let c = col; c < col + span; c++) occupied[r][c] = true;
    }
  };
  const firstFit = (span: number): [number, number] => {
    for (let row = 0; ; row++) {
      for (let col = 0; col <= cols - span; col++) if (fits(row, col, span)) return [row, col];
    }
  };

  const packed: PackedTile[] = [];
  let run: SmallRun | null = null;

  for (const id of order) {
    const span = Math.min(TILE_SPAN[sizes[id] ?? 'medium'], cols);
    if (span > 1) {
      run = null;
      const [row, col] = firstFit(span);
      packed.push({ id, row, col, span });
      mark(row, col, span);
      continue;
    }

    let row: number;
    let col: number;
    if (run && run.depth < 2 && fits(run.row + run.depth, run.col, 1)) {
      row = run.row + run.depth;
      col = run.col;
      run.depth += 1;
    } else if (run && fits(run.row, run.col + 1, 1)) {
      row = run.row;
      col = run.col + 1;
      run = { row, col, depth: 1 };
    } else {
      [row, col] = firstFit(1);
      run = { row, col, depth: 1 };
    }
    packed.push({ id, row, col, span: 1 });
    mark(row, col, 1);
  }

  return packed;
}

/** Rows the grid needs to show everything the packer placed. */
export const packedRowCount = (packed: PackedTile[]): number =>
  packed.reduce((rows, tile) => Math.max(rows, tile.row + tile.span), 0);
