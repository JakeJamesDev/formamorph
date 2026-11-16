/**
 * Save migration for Item Instance keys: renames `itemCopies` to `itemInstances`, and the `copyId` and
 * `targetCopyId` of a saved inventory write or listed action to `instanceId` and `targetInstanceId`.
 * Presence-based and idempotent: a record already carrying the new key keeps it.
 */

import type { ChatMessage, GameState } from '@/types';

type Rec = Record<string, unknown>;

const isRec = (value: unknown): value is Rec => !!value && typeof value === 'object' && !Array.isArray(value);

const RENAMED = { copyId: 'instanceId', targetCopyId: 'targetInstanceId' } as const;

/** `record` with its old id keys renamed; the same reference when it holds none. */
function renameIds<T>(record: T): T {
  if (!isRec(record) || !Object.keys(RENAMED).some((old) => old in record)) return record;
  const next: Rec = {};
  for (const [key, value] of Object.entries(record)) {
    const renamed = RENAMED[key as keyof typeof RENAMED];
    if (!renamed) next[key] = value;
    else if (!(renamed in record)) next[renamed] = value;
  }
  return next as T;
}

/** `list` with `fix` applied to each item; the same reference when nothing changed. */
function mapSame<T>(list: readonly T[], fix: (item: T) => T): T[] {
  const next = list.map(fix);
  return next.some((item, i) => item !== list[i]) ? next : (list as T[]);
}

function fixSnapshot(snapshot: unknown): unknown {
  if (!isRec(snapshot) || !isRec(snapshot.state)) return snapshot;
  // A loaded save's state is unchecked; migrateItemInstanceKeys guards it as a record.
  const state: unknown = migrateItemInstanceKeys(snapshot.state as unknown as GameState);
  return state === snapshot.state ? snapshot : { ...snapshot, state };
}

function fixListed(entry: unknown): unknown {
  if (!isRec(entry)) return entry;
  const facts = renameIds(entry.facts);
  const snapshots = Array.isArray(entry.snapshots) ? mapSame(entry.snapshots, fixSnapshot) : entry.snapshots;
  return facts === entry.facts && snapshots === entry.snapshots ? entry : { ...entry, facts, ...(snapshots ? { snapshots } : {}) };
}

function fixSent(sent: unknown): unknown {
  if (!isRec(sent)) return sent;
  const entries = Array.isArray(sent.entries) ? mapSame(sent.entries, fixListed) : sent.entries;
  const after = fixSnapshot(sent.after);
  return entries === sent.entries && after === sent.after ? sent : { ...sent, entries, ...(after === undefined ? {} : { after }) };
}

/** A snapshot with its Item Instances under `itemInstances`. The same snapshot when it holds no old key. */
export function migrateItemInstanceKeys(state: GameState): GameState {
  if (!isRec(state) || !('itemCopies' in state)) return state;
  // GameState no longer types the old key, so the rename works on the raw record.
  const { itemCopies, ...rest } = state as unknown as Rec;
  return { ...rest, ...('itemInstances' in rest ? {} : { itemInstances: itemCopies }) } as unknown as GameState;
}

/** The save's live Action List with the instance ids and each snapshot's keys renamed. The same list when none is old. */
export function migrateActionListKeys<T>(list: T[] | undefined): T[] | undefined {
  return Array.isArray(list) ? (mapSame(list as unknown[], fixListed) as T[]) : list;
}

/** The save's sent lists, by turn id, renamed the same way. The same map when none is old. */
export function migrateSentActionKeys<T>(sent: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!isRec(sent)) return sent;
  const next = Object.fromEntries(Object.entries(sent).map(([turn, list]) => [turn, fixSent(list)]));
  return Object.entries(next).some(([turn, list]) => list !== sent[turn]) ? (next as Record<string, T>) : sent;
}

/** A message whose saved Tool calls carry their inventory writes under the current names. The same message when none does. */
export function migrateMessageInstanceKeys(message: ChatMessage): ChatMessage {
  const calls = (message as { toolCalls?: unknown }).toolCalls;
  if (!Array.isArray(calls)) return message;
  const fixed = mapSame(calls, (call) => {
    if (!isRec(call) || !isRec(call.writes) || !Array.isArray(call.writes.inventory)) return call;
    const inventory = mapSame(call.writes.inventory, renameIds);
    return inventory === call.writes.inventory ? call : { ...call, writes: { ...call.writes, inventory } };
  });
  return fixed === calls ? message : ({ ...message, toolCalls: fixed } as ChatMessage);
}
