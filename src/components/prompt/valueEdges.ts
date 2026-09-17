// Edge rules for an open value: whitespace at either end is pending until the caret leaves it.

/** An open value's text cut at its edge whitespace runs. */
export interface ValueEdges { before: string; value: string; after: string }

/** Cuts the edge whitespace runs off `text`. A whitespace-only value goes whole to `side`. */
export function splitEdges(text: string, side: 'start' | 'end' = 'end'): ValueEdges {
  const before = text.match(/^[ \t]*/)?.[0] ?? '';
  if (before.length === text.length) {
    return side === 'start' ? { before: text, value: '', after: '' } : { before: '', value: '', after: text };
  }
  const after = text.match(/[ \t]*$/)?.[0] ?? '';
  return { before, value: text.slice(before.length, text.length - after.length), after };
}

/** Whether `caret` sits at either end of `text`. Anywhere inside an edge run counts as that end. */
export function caretEdge(text: string, caret: number): { atStart: boolean; atEnd: boolean } {
  const lead = text.match(/^[ \t]*/)?.[0].length ?? 0;
  const trail = text.match(/[ \t]*$/)?.[0].length ?? 0;
  return { atStart: caret <= lead, atEnd: caret >= text.length - trail };
}
