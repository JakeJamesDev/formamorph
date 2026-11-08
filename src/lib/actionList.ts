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
  | { kind: 'drop' | 'pickup'; item: ActionItem; quantity: number; place: string }
  /** A manual stat edit: `owner` is absent for a global stat; `from` and `to` are the values before and after (Q20). */
  | { kind: 'stat'; stat: { id: string; name: string }; owner?: { id: string; name: string }; from: number; to: number };

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
const itemKeyOf = (facts: ListedActionFacts): string => ('item' in facts ? facts.item.key : '');
const targetOf = (facts: ListedActionFacts): string => {
  switch (facts.kind) {
    case 'give': return facts.to.id;
    case 'drop':
    case 'pickup': return facts.place;
    default: return '';
  }
};

export type StatFacts = Extract<ListedActionFacts, { kind: 'stat' }>;
const sameStat = (a: ListedActionFacts, b: StatFacts): a is StatFacts =>
  a.kind === 'stat' && a.stat.id === b.stat.id && a.owner?.id === b.owner?.id;

/** Whether `next` exactly reverses `newest` (Q17, Q28). Equip and unequip match on the copy `newest` left. */
function reverses(newest: ListedActionFacts, next: ListedActionFacts): boolean {
  if (REVERSE[newest.kind] !== next.kind) return false;
  if ((newest.kind === 'equip' || newest.kind === 'unequip') && (next.kind === 'equip' || next.kind === 'unequip')) {
    return newest.resultId !== undefined && newest.resultId === next.copyId;
  }
  return itemKeyOf(newest) === itemKeyOf(next) && quantityOf(newest) === quantityOf(next) && targetOf(newest) === targetOf(next);
}

/** Whether `next` repeats `newest`: same kind, item, target and quantity, of a kind that collapses (Q18, Q28). */
const repeats = (newest: ListedActionFacts, next: ListedActionFacts): boolean =>
  COLLAPSES.includes(next.kind) && newest.kind === next.kind && itemKeyOf(newest) === itemKeyOf(next)
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

/**
 * `list` with the action `facts` added after it ran, `snapshot` being the state just before it.
 * A stat edit of the newest entry's stat merges into it (Q37): the entry keeps its first old value, first snapshot and
 * hidden flag, and goes when the stat is back at the old value. A new stat entry arrives hidden (Q1).
 */
export function addAction<S>(list: ActionList<S>, facts: ListedActionFacts, snapshot: S, id: string): ListedAction<S>[] {
  const newest = list.at(-1);
  if (facts.kind === 'stat') {
    if (newest && sameStat(newest.facts, facts)) {
      const rest = list.slice(0, -1);
      if (facts.to === newest.facts.from) return rest;
      return [...rest, { ...newest, facts: { ...newest.facts, to: facts.to } }];
    }
    return facts.from === facts.to ? [...list] : [...list, { id, facts, count: 1, hidden: true, snapshots: [snapshot] }];
  }
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

/** A shown entry as a turn carries it to the AI: its facts and its repeat count, oldest first. */
export interface ToldAction {
  facts: ListedActionFacts;
  count: number;
}

/** The entries a send tells the AI: the shown ones, in list order. */
export const toldActions = <S>(list: ActionList<S>): ToldAction[] =>
  list.filter((entry) => !entry.hidden).map(({ facts, count }) => ({ facts, count }));

/** The told entries' lines, one per entry, as the narration request carries them under the wrapper (Q19). */
export const toldLines = (told: readonly ToldAction[]): string =>
  told.map((entry) => `- ${entryLine(entry)}`).join('\n');

/** A sent entry. Only the newest turn's record keeps its snapshots (Q34). */
export type SentAction<S> = Omit<ListedAction<S>, 'snapshots'> & { snapshots?: S[] };

/** The list a turn was sent with. `told` is false when the send told the AI nothing (a Chat send, Q31). */
export interface SentActionList<S> {
  told: boolean;
  entries: SentAction<S>[];
}

/** Sent lists by turn id. */
export type SentActionMap<S> = Record<string, SentActionList<S>>;

/**
 * `map` with `turnId`'s sent list recorded, and every other turn's snapshots dropped (Q34). An empty list
 * records nothing.
 */
export function recordSent<S>(map: SentActionMap<S>, turnId: string, list: ActionList<S>, told: boolean): SentActionMap<S> {
  const next: SentActionMap<S> = {};
  for (const [id, sent] of Object.entries(map)) {
    next[id] = sent.entries.some((entry) => entry.snapshots)
      ? { ...sent, entries: sent.entries.map(({ snapshots: _dropped, ...entry }) => entry) }
      : sent;
  }
  if (list.length > 0) next[turnId] = { told, entries: [...list] };
  return next;
}

/** Every kind a saved entry may carry; a new kind fails to compile until it is added here. */
const KINDS: Record<ListedActionKind, true> = { use: true, equip: true, unequip: true, give: true, drop: true, pickup: true, stat: true };

/** The facts name their subject: the item, or the stat for a stat edit. */
const namesSubject = (facts: ListedActionFacts): boolean =>
  facts.kind === 'stat' ? typeof facts.stat?.name === 'string' : typeof facts.item?.name === 'string';

const isSentAction = (value: unknown): value is SentAction<unknown> => {
  const v = value as Partial<SentAction<unknown>> | null;
  return !!v && typeof v.id === 'string' && typeof v.count === 'number' && v.count >= 1 && typeof v.hidden === 'boolean'
    && !!v.facts && typeof v.facts === 'object' && Object.hasOwn(KINDS, v.facts.kind) && namesSubject(v.facts)
    && (v.snapshots === undefined || Array.isArray(v.snapshots));
};

/** The sent lists a save holds, read back. A save is a file the player can edit, so malformed entries are
 *  left out. Absent ⇒ none. */
export function restoreSent<S>(raw: unknown): SentActionMap<S> {
  const restored: SentActionMap<S> = {};
  if (!raw || typeof raw !== 'object') return restored;
  for (const [turnId, sent] of Object.entries(raw)) {
    const v = sent as Partial<SentActionList<S>> | null;
    if (!v || typeof v.told !== 'boolean' || !Array.isArray(v.entries)) continue;
    const entries = (v.entries as unknown[]).filter(isSentAction) as SentAction<S>[];
    if (entries.length) restored[turnId] = { told: v.told, entries };
  }
  return restored;
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
      case 'stat': return `${facts.owner ? `${facts.owner.name}’s ` : ''}${facts.stat.name} ${Math.round(facts.from)} → ${Math.round(facts.to)}`;
    }
  })();
  return entry.count > 1 ? `${text} ×${entry.count}` : text;
}
