/** A tile's footprint in base cells: a square `span` cells on a side, anchored at its top-left. */
export interface SimTile {
  id: string;
  row: number;
  col: number;
  span: number;
}

/** Where the gesture wants the dragged footprint's top-left corner to sit. */
export interface CellAnchor {
  row: number;
  col: number;
}

/** The tile standing in the way of a claim, and which of the two refusals it is. */
export interface SimBlocker {
  id: string;
  /** True when the tile would move but has no valid spot; false when too little of it is swept. */
  consented: boolean;
}

/** The board as one gesture has left it so far. */
export interface SimResult {
  /** The dragged tile at the anchor the gesture reached, clamped to the board. */
  pinned: SimTile;
  /** Every other tile's home right now. */
  tiles: SimTile[];
  /** Ids that relocated on this advance. */
  moved: string[];
  blocked: boolean;
  blocker: SimBlocker | null;
}

export interface CellSim {
  /** Step the dragged footprint to `want` and read the board it leaves. */
  advance: (want: CellAnchor) => SimResult;
}

/** Cells a tile must have swept before the whole group moves. Fixed: no setting, no UI. */
export const CONSENT_THRESHOLD = 0.5;

/** Base cells two footprints claim in common. */
const overlap = (a: SimTile, b: SimTile): boolean =>
  a.row < b.row + b.span && b.row < a.row + a.span
  && a.col < b.col + b.span && b.col < a.col + a.span;

/**
 * The mixed-size tile drag, as an ungrouped board of base cells.
 *
 * Through the whole gesture the board simulates what single cells would do: every cell the dragged
 * footprint sweeps over hops directly behind its trailing edge, which is exactly the dodge a flat grid
 * of one-cell tiles performs. Backtracking runs the same steps the other way, so retreating walks the
 * cells home.
 *
 * A group of cells is still one tile, so it moves only once the gesture has swept at least half of its
 * cells — accumulated over the path, not read off one moment. It then relocates by the way its cells
 * leaned, shape intact, and only to a spot that is on the board and free. A tile that never consents
 * never moves, so clipping a large tile's corner cannot teleport it.
 *
 * Pure: no DOM, no clock, no storage. One instance per gesture, because the accumulated sweep is the
 * gesture's own history.
 *
 * @param tiles - Every tile's home when the gesture started, the dragged one included
 * @param draggedId - The tile the player is carrying; it is pinned rather than simulated
 * @param columns - Base-cell columns the board is wide
 * @param consent - Fraction of a tile's cells the sweep must cover before the tile moves
 */
export function createCellSim(
  tiles: SimTile[],
  draggedId: string,
  columns: number,
  consent: number = CONSENT_THRESHOLD,
): CellSim {
  const cols = Math.max(1, Math.floor(columns));
  const start = tiles.find((tile) => tile.id === draggedId);
  if (!start) throw new Error(`${draggedId} is not on the board`);

  const span = Math.min(start.span, cols);
  // Homes are copied, so the caller's array is never the thing this mutates.
  const home = new Map(
    tiles.filter((tile) => tile.id !== draggedId).map((tile) => [tile.id, { ...tile }]),
  );

  /** Every resident's cells, keyed by tile and index within its own formation. */
  const cells = new Map<string, CellAnchor>();
  for (const tile of home.values()) {
    let i = 0;
    for (let r = 0; r < tile.span; r++) {
      for (let c = 0; c < tile.span; c++) {
        cells.set(`${tile.id}:${i++}`, { row: tile.row + r, col: tile.col + c });
      }
    }
  }

  let anchor: CellAnchor = { row: Math.max(0, start.row), col: Math.min(Math.max(0, start.col), cols - span) };

  const occupied = (row: number, col: number): boolean => {
    for (const cell of cells.values()) if (cell.row === row && cell.col === col) return true;
    return false;
  };

  /** One unit step of the footprint: cells on the leading edge hop to the freed trailing edge. */
  const step = (dr: number, dc: number) => {
    const moved = { row: anchor.row + dr, col: anchor.col + dc };
    for (let k = 0; k < span; k++) {
      const lead = dr !== 0
        ? { row: dr > 0 ? moved.row + span - 1 : moved.row, col: anchor.col + k }
        : { row: anchor.row + k, col: dc > 0 ? moved.col + span - 1 : moved.col };
      const trail = dr !== 0
        ? { row: dr > 0 ? anchor.row : anchor.row + span - 1, col: anchor.col + k }
        : { row: anchor.row + k, col: dc > 0 ? anchor.col : anchor.col + span - 1 };
      for (const cell of cells.values()) {
        // The guard is what keeps two cells off one spot; without it a sweep can stack the board.
        if (cell.row === lead.row && cell.col === lead.col && !occupied(trail.row, trail.col)) {
          cell.row = trail.row;
          cell.col = trail.col;
          break;
        }
      }
    }
    anchor = moved;
  };

  /** How far each of a tile's cells has been pushed from where that cell belongs. */
  const displacement = (tile: SimTile): CellAnchor[] => {
    const pushed: CellAnchor[] = [];
    let i = 0;
    for (let r = 0; r < tile.span; r++) {
      for (let c = 0; c < tile.span; c++) {
        const cell = cells.get(`${tile.id}:${i++}`)!;
        if (cell.row !== tile.row + r || cell.col !== tile.col + c) {
          pushed.push({ row: cell.row - (tile.row + r), col: cell.col - (tile.col + c) });
        }
      }
    }
    return pushed;
  };

  /** The way a tile's swept cells lean: the displacement vector most of them share. */
  const modal = (pushed: CellAnchor[]): CellAnchor => {
    const counts = new Map<string, number>();
    for (const vector of pushed) {
      const key = `${vector.row},${vector.col}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const [key] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const [row, col] = key.split(',').map(Number);
    return { row, col };
  };

  /** Snap a tile's cells back into formation around its home, which resets its accumulated sweep. */
  const reform = (tile: SimTile) => {
    let i = 0;
    for (let r = 0; r < tile.span; r++) {
      for (let c = 0; c < tile.span; c++) {
        const cell = cells.get(`${tile.id}:${i++}`)!;
        cell.row = tile.row + r;
        cell.col = tile.col + c;
      }
    }
  };

  const advance = (want: CellAnchor): SimResult => {
    // Clamped rather than trusted: an anchor off the board would step forever looking for it.
    const target = {
      row: Math.max(0, Math.round(want.row)),
      col: Math.min(Math.max(0, Math.round(want.col)), cols - span),
    };
    while (anchor.row !== target.row || anchor.col !== target.col) {
      const dr = Math.sign(target.row - anchor.row);
      step(dr, dr === 0 ? Math.sign(target.col - anchor.col) : 0);
    }

    const pinned: SimTile = { id: draggedId, span, row: anchor.row, col: anchor.col };
    const moved: string[] = [];
    for (const tile of home.values()) {
      const pushed = displacement(tile);
      if (pushed.length / (tile.span * tile.span) < consent) continue;

      const lean = modal(pushed);
      const candidate: SimTile = { ...tile, row: tile.row + lean.row, col: tile.col + lean.col };
      if (candidate.row < 0 || candidate.col < 0 || candidate.col + candidate.span > cols) continue;
      if (overlap(pinned, candidate)) continue;
      let clash = false;
      for (const other of home.values()) {
        if (other.id !== tile.id && overlap(other, candidate)) { clash = true; break; }
      }
      if (clash) continue;

      tile.row = candidate.row;
      tile.col = candidate.col;
      reform(tile);
      moved.push(tile.id);
    }

    // Blocked is about the claim itself: someone is still standing where the dragged tile wants to be.
    let blocker: SimBlocker | null = null;
    for (const tile of home.values()) {
      if (!overlap(pinned, tile)) continue;
      const swept = displacement(tile).length / (tile.span * tile.span);
      blocker = { id: tile.id, consented: swept >= consent };
      break;
    }

    return {
      pinned,
      tiles: [...home.values()].map((tile) => ({ ...tile })),
      moved,
      blocked: blocker !== null,
      blocker,
    };
  };

  return { advance };
}
