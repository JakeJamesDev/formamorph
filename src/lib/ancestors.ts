/**
 * The ids above `id`, nearest first, `id` itself left out. A parent that no row holds ends the walk after it is
 * named. A cycle ends it before any id repeats, so a malformed world cannot hang a caller.
 */
export function ancestors(id: string, parentOf: (id: string) => string | null | undefined): string[] {
  const seen = new Set<string>([id]);
  const chain: string[] = [];
  for (let at = parentOf(id); at && !seen.has(at); at = parentOf(at)) {
    seen.add(at);
    chain.push(at);
  }
  return chain;
}

/** `parentOf` over a list of rows, each naming its parent through `parentKey`. */
export function parentLookup<T extends { id: string }>(
  rows: readonly T[],
  parentKey: (row: T) => string | null | undefined,
): (id: string) => string | null | undefined {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return (id) => {
    const row = byId.get(id);
    return row ? parentKey(row) : undefined;
  };
}
