/** One kind of hard reference to a record: how many there are and its noun in both numbers. */
export interface ReferenceKind {
  count: number;
  one: string;
  many: string;
  /** What the delete does to references it keeps, given the counted noun ("3 items"). Absent = they are deleted. */
  clause?: (counted: string) => string;
  /** Names the references in place of the count ("Gold and Silver"). */
  named?: string;
}

const joined = (parts: readonly string[]) => (parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);
const counted = (k: ReferenceKind) => k.named ?? `${k.count} ${k.count === 1 ? k.one : k.many}`;

/** The in-use delete confirm line: "This also deletes its link." or "This also deletes its 2 Body entries and
 *  clears the slot on 3 items." A lone deleted kind with one reference drops the number. Null when nothing
 *  uses the record, so no confirm. */
export function usedByText(kinds: readonly ReferenceKind[]): string | null {
  const used = kinds.filter((k) => k.count > 0);
  if (!used.length) return null;
  const deleted = used.filter((k) => !k.clause);
  const parts: string[] = [];
  if (deleted.length === 1 && deleted[0].count === 1) parts.push(`deletes its ${deleted[0].one}`);
  else if (deleted.length) parts.push(`deletes its ${joined(deleted.map(counted))}`);
  for (const k of used) if (k.clause) parts.push(k.clause(counted(k)));
  return `This also ${joined(parts)}.`;
}

/** The links kind both the stat and trait deletes count. */
export const linksKind = (count: number): ReferenceKind => ({ count, one: 'link', many: 'links' });
