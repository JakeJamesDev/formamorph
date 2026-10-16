// What binding a carried entity's links to a receiving world shares: finding an original by name, and moving a
// link's data keys onto the original it bound to.

export type Named = { id: string; name: string };

/** The one item carrying `name`, else null: no match and two matches both bind nothing. */
export function uniqueNamed<T extends Named>(list: readonly T[], name: string | undefined): T | null {
  const wanted = name?.trim();
  const named = wanted ? list.filter((item) => item.name.trim() === wanted) : [];
  return named.length === 1 ? named[0] : null;
}

/** The map with each key rewritten, a key that maps to null dropped; absent when nothing is left. */
export function rekeyed<V>(map: Record<string, V> | undefined, key: (id: string) => string | null): Record<string, V> | undefined {
  const out = Object.fromEntries(Object.entries(map ?? {}).flatMap(([id, v]) => {
    const next = key(id);
    return next === null ? [] : [[next, v] as const];
  }));
  return Object.keys(out).length ? out : undefined;
}
