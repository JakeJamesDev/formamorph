/**
 * The Action List: the player's panel actions since the last turn, newest last. Pure: no React, no game state.
 * The caller takes and restores the snapshots; this module only holds them.
 */

/** The item an action acted on: `key` is the authored or runtime item, `name` its display name when it ran (Q30). */
export interface ActionItem {
  key: string;
  name: string;
}

/** What one panel action did, in facts. */
export type ListedActionFacts =
  /** `copyId` is the Item Copy acted on; `resultId` the row it ended in. */
  | { kind: 'use' | 'equip' | 'unequip'; item: ActionItem; copyId: string; resultId?: string }
  | { kind: 'give'; item: ActionItem; quantity: number; to: { id: string; name: string } }
  /** `place` is the location the copy went to (drop) or came from (pick up). */
  | { kind: 'drop' | 'pickup'; item: ActionItem; quantity: number; place: string };

export type ListedActionKind = ListedActionFacts['kind'];

/** One row of the list. `snapshots` holds one state per repeat, oldest first (Q16). */
export interface ListedAction<S> {
  id: string;
  facts: ListedActionFacts;
  count: number;
  hidden: boolean;
  snapshots: S[];
}

export type ActionList<S> = readonly ListedAction<S>[];

const REVERSE: Partial<Record<ListedActionKind, ListedActionKind>> = { equip: 'unequip', unequip: 'equip', drop: 'pickup', pickup: 'drop' };
const COLLAPSES: readonly ListedActionKind[] = ['use', 'give', 'drop', 'pickup'];

const quantityOf = (facts: ListedActionFacts): number => ('quantity' in facts ? facts.quantity : 1);
const targetOf = (facts: ListedActionFacts): string => {
  switch (facts.kind) {
    case 'give': return facts.to.id;
    case 'drop':
    case 'pickup': return facts.place;
    default: return '';
  }
};

/** Whether `next` exactly reverses `newest` (Q17, Q28). Equip and unequip match on the copy `newest` left. */
function reverses(newest: ListedActionFacts, next: ListedActionFacts): boolean {
  if (REVERSE[newest.kind] !== next.kind) return false;
  if ((newest.kind === 'equip' || newest.kind === 'unequip') && (next.kind === 'equip' || next.kind === 'unequip')) {
    return newest.resultId !== undefined && newest.resultId === next.copyId;
  }
  return newest.item.key === next.item.key && quantityOf(newest) === quantityOf(next) && targetOf(newest) === targetOf(next);
}

/** Whether `next` repeats `newest`: same kind, item, target and quantity, of a kind that collapses (Q18, Q28). */
const repeats = (newest: ListedActionFacts, next: ListedActionFacts): boolean =>
  COLLAPSES.includes(next.kind) && newest.kind === next.kind && newest.item.key === next.item.key
  && targetOf(newest) === targetOf(next) && quantityOf(newest) === quantityOf(next);

/** The list without its newest repeat, and the snapshot to restore. Null on an empty list (Q2, Q16). */
export function undoNewest<S>(list: ActionList<S>): { list: ListedAction<S>[]; restore: S } | null {
  const newest = list.at(-1);
  if (!newest) return null;
  const restore = newest.snapshots[newest.snapshots.length - 1];
  const rest = list.slice(0, -1);
  if (newest.count === 1) return { list: rest, restore };
  return { list: [...rest, { ...newest, count: newest.count - 1, snapshots: newest.snapshots.slice(0, -1) }], restore };
}

/**
 * The undo `facts` triggers when it exactly reverses the newest single entry (Q17), or null. Call it before the
 * action runs: on a hit the caller restores the snapshot and does not run the action.
 */
export function reversalOf<S>(list: ActionList<S>, facts: ListedActionFacts): { list: ListedAction<S>[]; restore: S } | null {
  const newest = list.at(-1);
  if (!newest || newest.count !== 1 || !reverses(newest.facts, facts)) return null;
  return undoNewest(list);
}

/** `list` with the action `facts` added after it ran, `snapshot` being the state just before it. */
export function addAction<S>(list: ActionList<S>, facts: ListedActionFacts, snapshot: S, id: string): ListedAction<S>[] {
  const newest = list.at(-1);
  if (newest && repeats(newest.facts, facts)) {
    return [...list.slice(0, -1), { ...newest, count: newest.count + 1, snapshots: [...newest.snapshots, snapshot] }];
  }
  return [...list, { id, facts, count: 1, hidden: false, snapshots: [snapshot] }];
}

export function toggleHidden<S>(list: ActionList<S>, id: string): ListedAction<S>[] {
  return list.map((entry) => (entry.id === id ? { ...entry, hidden: !entry.hidden } : entry));
}

/** The list a send closes: `sent` goes with the turn and the live list starts empty (Q3). */
export function closeList<S>(list: ActionList<S>): { sent: ListedAction<S>[]; live: ListedAction<S>[] } {
  return { sent: [...list], live: [] };
}

/** How many rows the AI is told and how many are hidden. */
export function listCounts<S>(list: ActionList<S>): { shown: number; hidden: number } {
  const hidden = list.filter((entry) => entry.hidden).length;
  return { shown: list.length - hidden, hidden };
}

const counted = (quantity: number, name: string) => (quantity > 1 ? `${quantity}× ${name}` : name);

/** The entry's line, written from its facts. A repeat adds ×N. */
export function entryLine(entry: Pick<ListedAction<unknown>, 'facts' | 'count'>): string {
  const { facts } = entry;
  const text = (() => {
    switch (facts.kind) {
      case 'use': return `Used ${facts.item.name}`;
      case 'equip': return `Equipped ${facts.item.name}`;
      case 'unequip': return `Unequipped ${facts.item.name}`;
      case 'give': return `Gave ${counted(facts.quantity, facts.item.name)} to ${facts.to.name}`;
      case 'drop': return `Dropped ${counted(facts.quantity, facts.item.name)}`;
      case 'pickup': return `Picked up ${counted(facts.quantity, facts.item.name)}`;
    }
  })();
  return entry.count > 1 ? `${text} ×${entry.count}` : text;
}
