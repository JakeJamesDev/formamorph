/**
 * A copy of the edited world kept in a worker, updated by patches that carry only the records an edit
 * replaced. The editor replaces a record on every edit and keeps the rest by identity, so a patch after a
 * keystroke is one record, not the world.
 */
import type { RuleWorld } from './rules';

type Rec = { id: string };

/** One top-level slice as the mirror rebuilds it. */
export type SlicePatch =
  /** A list of records with unique ids: its order, and the records the mirror doesn't hold yet. */
  | { kind: 'records'; order: string[]; upserts: Rec[] }
  /** A plain object: its key order, and the fields whose values changed. */
  | { kind: 'fields'; keys: string[]; changed: Record<string, unknown> }
  /** Anything else, sent whole. */
  | { kind: 'whole'; value: unknown };

/** The changed slices, and the key order of the world. */
export interface WorldPatch {
  keys: string[];
  slices: Record<string, SlicePatch>;
}

const isRecordList = (value: unknown): value is Rec[] => {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof (item as Rec).id !== 'string' || ids.has((item as Rec).id)) return false;
    ids.add((item as Rec).id);
  }
  return true;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * The main-thread side: each call returns the patch from the last world it saw to `world`. The first call,
 * and the first after {@link WorldPatcher.reset}, sends everything.
 */
export interface WorldPatcher {
  patch(world: RuleWorld): WorldPatch;
  /** Forget what was sent, after the mirror is lost. */
  reset(): void;
}

export function createWorldPatcher(): WorldPatcher {
  // Per slice: the value last sent, and for record lists each record by id.
  let sent = new Map<string, { value: unknown; byId?: Map<string, Rec> }>();
  return {
    reset: () => { sent = new Map(); },
    patch(world) {
      const source = world as unknown as Record<string, unknown>;
      const keys = Object.keys(source);
      const slices: Record<string, SlicePatch> = {};
      const next = new Map<string, { value: unknown; byId?: Map<string, Rec> }>();
      for (const key of keys) {
        const value = source[key];
        const last = sent.get(key);
        if (last && last.value === value) { next.set(key, last); continue; }
        if (isRecordList(value)) {
          const byId = new Map(value.map((r) => [r.id, r]));
          const upserts = last?.byId ? value.filter((r) => last.byId!.get(r.id) !== r) : value;
          slices[key] = { kind: 'records', order: value.map((r) => r.id), upserts };
          next.set(key, { value, byId });
        } else if (isPlainObject(value)) {
          const before = isPlainObject(last?.value) ? last.value : undefined;
          const fieldKeys = Object.keys(value);
          const changed: Record<string, unknown> = {};
          for (const k of fieldKeys) if (!before || before[k] !== value[k] || !(k in before)) changed[k] = value[k];
          slices[key] = { kind: 'fields', keys: fieldKeys, changed };
          next.set(key, { value });
        } else {
          slices[key] = { kind: 'whole', value };
          next.set(key, { value });
        }
      }
      sent = next;
      return { keys, slices };
    },
  };
}

/** The worker side: the world as the patches so far describe it. Unchanged records keep their identity. */
export interface WorldMirror {
  apply(patch: WorldPatch): RuleWorld;
}

export function createWorldMirror(): WorldMirror {
  let world: Record<string, unknown> = {};
  const byId = new Map<string, Map<string, Rec>>();
  return {
    apply({ keys, slices }) {
      const next: Record<string, unknown> = {};
      for (const key of keys) {
        const slice = slices[key];
        if (!slice) { next[key] = world[key]; continue; }
        if (slice.kind === 'records') {
          const held = byId.get(key) ?? new Map<string, Rec>();
          for (const r of slice.upserts) held.set(r.id, r);
          const list = slice.order.map((id) => held.get(id)!);
          byId.set(key, new Map(list.map((r) => [r.id, r])));
          next[key] = list;
        } else if (slice.kind === 'fields') {
          const before = isPlainObject(world[key]) ? world[key] as Record<string, unknown> : {};
          next[key] = Object.fromEntries(slice.keys.map((k) => [k, k in slice.changed ? slice.changed[k] : before[k]]));
          byId.delete(key);
        } else {
          next[key] = slice.value;
          byId.delete(key);
        }
      }
      for (const key of byId.keys()) if (!(key in next)) byId.delete(key);
      world = next;
      return world as unknown as RuleWorld;
    },
  };
}
