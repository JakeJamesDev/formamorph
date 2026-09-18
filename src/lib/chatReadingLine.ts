/** Where the reading line sits, as a share of the viewport height from its top. */
export const READING_LINE = 0.3;

/** A mounted turn's box, in pixels from the viewport top. */
export interface TurnBox {
  index: number;
  top: number;
  bottom: number;
}

/**
 * The turn the Chat list shows the panels for: the latest turn when the list is at the bottom, else the turn
 * that crosses the reading line, else the nearest turn above the line. Null when no turn is mounted.
 */
export function viewedTurn(
  turns: readonly TurnBox[],
  { viewportHeight, atBottom, latestIndex }: { viewportHeight: number; atBottom: boolean; latestIndex: number },
): number | null {
  if (turns.length === 0) return null;
  if (atBottom) return latestIndex;
  const line = viewportHeight * READING_LINE;
  let above: TurnBox | null = null;
  for (const turn of turns) {
    if (turn.top <= line && turn.bottom > line) return turn.index;
    if (turn.bottom <= line && (above === null || turn.index > above.index)) above = turn;
  }
  if (above) return above.index;
  return Math.min(...turns.map((turn) => turn.index));
}

/** The viewed page and the page count at one render. */
export interface PageView {
  page: number;
  totalPages: number;
}

/**
 * Whether the stat bars snap instead of animate. In Chat a move of the viewed turn with the same page count
 * is a scroll, so the bars snap; they keep snapping until the page count changes (a submit or a rollback).
 */
export function statsSnap(snapping: boolean, prev: PageView, next: PageView, chat: boolean): boolean {
  if (!chat || next.totalPages !== prev.totalPages) return false;
  return next.page !== prev.page || snapping;
}
