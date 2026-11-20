import type { MajorItem, ReleaseSummary, SummaryItem } from './releaseSummary';

/** How many of the grid's three columns a tile spans. */
export type TileSpan = 1 | 2 | 3;

export type TileCell =
  | { kind: 'major'; item: MajorItem; span: TileSpan }
  | { kind: 'new'; item: SummaryItem; span: 1 }
  | { kind: 'fixes'; paragraphs: string[]; span: TileSpan };

/**
 * Lays the highlights on a three-column grid. A Major takes two cells beside its nested pair, or else the next
 * unpaired New item, or the full row when none is left. Remaining New items fill rows of three. Fixes takes the
 * last row's empty cells, or a full row when it has none.
 */
export function tileCells(summary: Pick<ReleaseSummary, 'major' | 'newItems' | 'fixes'>): TileCell[] {
  const cells: TileCell[] = [];
  const unpaired = [...summary.newItems];
  for (const major of summary.major) {
    const partner = major.pair ?? unpaired.shift() ?? null;
    cells.push({ kind: 'major', item: major, span: partner ? 2 : 3 });
    if (partner) cells.push({ kind: 'new', item: partner, span: 1 });
  }
  for (const item of unpaired) cells.push({ kind: 'new', item, span: 1 });
  if (summary.fixes.length > 0) {
    const open = (3 - (unpaired.length % 3)) % 3;
    cells.push({ kind: 'fixes', paragraphs: summary.fixes, span: open === 0 ? 3 : (open as TileSpan) });
  }
  return cells;
}
