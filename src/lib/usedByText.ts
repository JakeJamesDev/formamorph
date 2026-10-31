/** One kind of hard reference to a record: how many there are and its noun in both numbers. */
export interface ReferenceKind {
  count: number;
  one: string;
  many: string;
}

/** The in-use delete confirm line: "This also deletes its link." or "This also deletes its 2 links and 1 pick."
 *  A lone kind with one reference drops the number. Null when nothing uses the record, so no confirm. */
export function usedByText(kinds: readonly ReferenceKind[]): string | null {
  const used = kinds.filter((k) => k.count > 0);
  if (!used.length) return null;
  if (used.length === 1 && used[0].count === 1) return `This also deletes its ${used[0].one}.`;
  const named = used.map((k) => `${k.count} ${k.count === 1 ? k.one : k.many}`);
  const list = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`;
  return `This also deletes its ${list}.`;
}

/** The links kind both the stat and trait deletes count. */
export const linksKind = (count: number): ReferenceKind => ({ count, one: 'link', many: 'links' });
