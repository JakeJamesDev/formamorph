// What an active trait does beyond its stat changes: switching stats on or off, and which traits are active
// in which order. Overlays computed fresh from the active set every render — nothing is baked into the
// world or the save, so switching a trait off simply removes its contribution. The pins a trait lays are
// collected in lib/placeholderPins, beside the other pin sources.
//
// Two traits may target the same stat or placeholder. The later one in the authored trait tree wins, so an
// author sets precedence by dragging rows in the editor rather than by learning a rule.

import { buildTree, flattenTree } from './groupTree';
import type { ColorChannel, PlaceholderValue, PlayerStat, Stat, Trait, TraitGroup } from '@/types';

/** Trait id → its position in the authored tree, depth-first. Ids missing from the world sort last. */
export function traitOrderIndex(traits: readonly Trait[], groups: readonly TraitGroup[]): Map<string, number> {
  const map = new Map<string, number>();
  flattenTree(buildTree(groups, traits)).forEach((node, i) => {
    if (node.leaf) map.set(node.leaf.id, i);
  });
  return map;
}

/** Sort a set of active traits into authored order, so "last wins" means the same thing everywhere. */
export function inAuthoredOrder(active: readonly Trait[], order: ReadonlyMap<string, number>): Trait[] {
  return [...active].sort(
    (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * Re-read each chosen trait's authoring from the world, so a playthrough started before the author's latest
 * edit still gets them — a trait made switchable, renamed, re-described, or given stat toggles and pins.
 * A save stores whole trait objects, which makes its copy a snapshot of the world as it stood on turn 1.
 *
 * `statChanges` deliberately stay the saved copy: they are the authoring the player's numbers were settled
 * against, so re-deriving bounds from a later edit would rebalance a character mid-playthrough.
 * A trait the world no longer has keeps its saved copy and stays active — deleting and re-creating a trait
 * mints a new id, so dropping unmatched traits would strip them from every existing save.
 */
export function refreshChosenTraits(chosen: Trait[], authored: Trait[]): Trait[] {
  const byId = new Map(authored.map((t) => [t.id, t]));
  return chosen.map((t) => {
    const current = byId.get(t.id);
    return current ? { ...current, statChanges: t.statChanges } : t;
  });
}

/**
 * Re-read each saved stat's authoring identity from the world, the stat sibling of `refreshChosenTraits`:
 * `scripts`, `name`, `description`, `type` and both binding lists come from the world by id, so a save started
 * before the author's latest edit still runs the new code on its next turn.
 *
 * Every other field — `value`, bounds, `starting`, the AI max delta, the code delta, `enabled`, and the
 * trait-derived base fields — stays the saved stat's own: they are the numbers the playthrough actually
 * reached, not the author's current defaults. A stat the world no longer has keeps its saved copy whole,
 * the same fallback an unmatched trait gets.
 */
export function refreshSavedStats(saved: readonly PlayerStat[], authored: readonly Stat[]): PlayerStat[] {
  const byId = new Map(authored.map((s) => [s.id, s]));
  return refreshSavedBindings(saved, authored).map((stat) => {
    const current = byId.get(stat.id);
    return current
      ? {
        ...stat, scripts: current.scripts,
        name: current.name, description: current.description, type: current.type,
      }
      : stat;
  });
}

type StatBindings = Pick<Stat, 'morphBindings' | 'colorBindings'>;

/** `stat`'s bindings as a spread: each list absent when it has none. */
const withBindingsOf = (stat: StatBindings) => ({
  ...(stat.morphBindings && { morphBindings: stat.morphBindings }),
  ...(stat.colorBindings && { colorBindings: stat.colorBindings }),
});

/** Saved stats with their slider and color bindings re-read from the world by id, which a load runs so a binding
 *  the author changed reaches a save in progress. A stat the world no longer has keeps its saved bindings. */
export function refreshSavedBindings<S extends Pick<Stat, 'id'> & StatBindings>(
  saved: readonly S[], authored: readonly (Pick<Stat, 'id'> & StatBindings)[],
): S[] {
  const byId = new Map(authored.map((s) => [s.id, s]));
  return saved.map((stat) => {
    const current = byId.get(stat.id);
    if (!current) return stat;
    const { morphBindings: _morphs, colorBindings: _colors, ...rest } = stat;
    return { ...rest, ...withBindingsOf(current) } as S;
  });
}

/**
 * Which stats are live, given the world's defaults and the active traits. A stat is on unless its author set
 * `enabled: false`; each active trait's `statToggles` then override that, later traits winning.
 */
export function activeStatEnabled(
  stats: ReadonlyArray<Pick<Stat, 'id' | 'enabled'>>,
  activeInOrder: readonly Trait[],
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of stats) out[s.id] = s.enabled !== false;
  for (const t of activeInOrder) {
    for (const toggle of t.statToggles ?? []) {
      if (toggle.statId in out) out[toggle.statId] = toggle.enabled;
    }
  }
  return out;
}

/** Only the stats that are currently live — what the player panel, the AI context, regen and stat code see. */
export function enabledStats<T extends { id: string }>(stats: T[], enabled: Record<string, boolean>): T[] {
  return stats.filter((s) => enabled[s.id] !== false);
}

/** Whether the trait is on exactly while its gate holds and the player never switches it: Always On and Hidden. */
export const isAlwaysOn = (trait: Pick<Trait, 'mode'>): boolean => trait.mode === 'alwaysOn' || trait.mode === 'hidden';

/** Whether an Always On trait is off in `active`, so the player doesn't see it (Q15). */
export const isDormant = (trait: Pick<Trait, 'id' | 'mode'>, active: readonly string[]): boolean =>
  isAlwaysOn(trait) && !active.includes(trait.id);

/** Whether the player never sees the trait (Q13). */
export const isHidden = (trait: Pick<Trait, 'mode'>): boolean => trait.mode === 'hidden';

/** Whether the player sees the trait's row: not Hidden, and not a dormant Always On trait. */
export const isShown = (trait: Pick<Trait, 'id' | 'mode'>, active: readonly string[]): boolean =>
  !isHidden(trait) && !isDormant(trait, active);

/**
 * The traits a player toggle switches off alongside the one being switched on: a max-one group holds at
 * most one active trait, so enabling a member retires its active siblings. Nesting doesn't cascade — only
 * traits sitting directly in the same group compete. An Always On trait neither retires nor is retired.
 */
export function exclusiveSiblings(trait: Trait, traits: readonly Trait[], groups: readonly TraitGroup[]): string[] {
  const groupId = trait.groupId ?? null;
  if (groupId === null || isAlwaysOn(trait)) return [];
  if (groups.find((g) => g.id === groupId)?.maxPicks !== 1) return [];
  return traits.filter((t) => (t.groupId ?? null) === groupId && t.id !== trait.id && !isAlwaysOn(t)).map((t) => t.id);
}

/**
 * Cap a default-trait selection so each group contributes at most its `maxPicks` ids, the first in authored
 * order. For a max-one group that is the radio the selection screen shows checked. The `fixed` ids always
 * stay and fill their groups first.
 */
export function capDefaults(
  ids: readonly string[], traits: readonly Trait[], groups: readonly TraitGroup[], fixed: readonly string[] = [],
): string[] {
  const byId = new Map(traits.map((t) => [t.id, t]));
  const order = traitOrderIndex(traits, groups);
  const max = new Map(groups.flatMap((g) => (g.maxPicks === undefined ? [] : [[g.id, g.maxPicks] as const])));
  const taken = new Map<string, number>();
  const groupOf = (id: string) => byId.get(id)?.groupId ?? null;
  const inOrder = (list: readonly string[]) =>
    [...list].sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
  for (const id of fixed) {
    const groupId = groupOf(id);
    if (groupId !== null) taken.set(groupId, (taken.get(groupId) ?? 0) + 1);
  }
  const kept = new Set(fixed);
  for (const id of inOrder(ids)) {
    if (kept.has(id)) continue;
    const groupId = groupOf(id);
    const cap = groupId === null ? undefined : max.get(groupId);
    if (groupId !== null && cap !== undefined) {
      const count = taken.get(groupId) ?? 0;
      if (count >= cap) continue;
      taken.set(groupId, count + 1);
    }
    kept.add(id);
  }
  return inOrder([...kept]);
}

/**
 * A new game's picks: the active Always On traits, then the Optional defaults capped at each group's max.
 * `alwaysOn` defaults to the ungated Always On traits, for callers that check no gates.
 */
export function defaultPicks(
  traits: readonly Trait[], groups: readonly TraitGroup[],
  alwaysOn: readonly string[] = traits.filter((t) => isAlwaysOn(t) && !t.requires?.length).map((t) => t.id),
): string[] {
  return capDefaults(traits.filter((t) => t.isDefault && !isAlwaysOn(t)).map((t) => t.id), traits, groups, alwaysOn);
}

/** Another trait claiming the same target, and which of the two the precedence rule picks. */
export interface TraitConflict {
  /** The other traits targeting this, in authored order — id so the note can navigate to one. */
  others: Array<{ id: string; name: string }>;
  /** Whether the trait being edited is the one that wins. */
  winsHere: boolean;
}

/**
 * For one trait, the stats another trait also switches — what the editor shows as a precedence note.
 * Placeholder pins have their own note, read across every source by `pinConflict`.
 *
 * Traits that can never be active together are not a conflict, so exclusive siblings are excluded: a group
 * of mutually exclusive traits all switching one stat is the intended shape, not a mistake.
 */
export function traitConflicts(
  trait: Trait,
  traits: Trait[],
  groups: TraitGroup[],
): { stats: Record<string, TraitConflict> } {
  const order = traitOrderIndex(traits, groups);
  const impossible = new Set(exclusiveSiblings(trait, traits, groups));
  const rivals = traits.filter((t) => t.id !== trait.id && !impossible.has(t.id));
  const rank = (t: Trait) => order.get(t.id) ?? Number.MAX_SAFE_INTEGER;
  const claims = (t: Trait) => (t.statToggles ?? []).map((s) => s.statId);

  const stats: Record<string, TraitConflict> = {};
  for (const id of claims(trait).filter(Boolean)) {
    const others = inAuthoredOrder(rivals.filter((t) => claims(t).includes(id)), order);
    if (!others.length) continue;
    stats[id] = {
      others: others.map((t) => ({ id: t.id, name: t.name })),
      winsHere: others.every((t) => rank(t) < rank(trait)),
    };
  }
  return { stats };
}

/** A trait as a note names it. */
export type TraitName = Pick<Trait, 'id' | 'name'>;

/**
 * The other traits that can be active with `trait` and pin a slider it pins, by `trait`'s pin name, in tree
 * order. Two names that land on one model key through `keyOf` count as one slider; a name it maps to null
 * stands for itself. Pick-one siblings never rival (Q4). A pin with no rival is absent.
 */
export function morphPinOverlaps(
  trait: Trait,
  traits: readonly Trait[],
  groups: readonly TraitGroup[],
  keyOf: (name: string) => string | null = (name) => name,
): Record<string, TraitName[]> {
  const pins = trait.morphPins ?? [];
  if (!pins.length) return {};
  const order = traitOrderIndex(traits, groups);
  const impossible = new Set(exclusiveSiblings(trait, traits, groups));
  const rivals = inAuthoredOrder(traits.filter((t) => t.id !== trait.id && !impossible.has(t.id) && t.morphPins?.length), order);
  const slider = (name: string) => keyOf(name) ?? name;
  const out: Record<string, TraitName[]> = {};
  for (const pin of pins) {
    const key = slider(pin.name);
    const others = rivals.filter((t) => t.morphPins!.some((p) => slider(p.name) === key));
    if (others.length) out[pin.name] = others.map((t) => ({ id: t.id, name: t.name }));
  }
  return out;
}

/** The other traits that can be active with `trait` and set a color it sets, by channel, in tree order. The same
 *  rival rules as `morphPinOverlaps`. */
export function colorPinOverlaps(
  trait: Trait,
  traits: readonly Trait[],
  groups: readonly TraitGroup[],
): Partial<Record<ColorChannel, TraitName[]>> {
  const pins = trait.colorPins ?? [];
  if (!pins.length) return {};
  const order = traitOrderIndex(traits, groups);
  const impossible = new Set(exclusiveSiblings(trait, traits, groups));
  const rivals = inAuthoredOrder(traits.filter((t) => t.id !== trait.id && !impossible.has(t.id) && t.colorPins?.length), order);
  const out: Partial<Record<ColorChannel, TraitName[]>> = {};
  for (const { channel } of pins) {
    const others = rivals.filter((t) => t.colorPins!.some((p) => p.channel === channel));
    if (others.length) out[channel] = others.map((t) => ({ id: t.id, name: t.name }));
  }
  return out;
}

/** One value-list edit that reads as a rename: the text a value held, and what replaced it. */
export interface PlaceholderValueRename {
  from: string;
  to: string;
}

/**
 * The renames in an edit to a placeholder's value list — a value whose id stayed and whose text changed.
 * Nothing here is positional: a value's id is its identity, so a reorder renames nothing and a delete plus
 * an add is two edits rather than one rename.
 */
export function renamedPlaceholderValues(
  prev: readonly PlaceholderValue[],
  next: readonly PlaceholderValue[],
): PlaceholderValueRename[] {
  const before = new Map(prev.map((v) => [v.id, v.text]));
  const out: PlaceholderValueRename[] = [];
  for (const v of next) {
    const from = before.get(v.id);
    if (from && v.text && from !== v.text) out.push({ from, to: v.text });
  }
  return out;
}

/**
 * Carry every *text-keyed* trait pin on one placeholder across that placeholder's renames, so a pin
 * written before value ids existed stays on its value instead of orphaning on a string the placeholder no
 * longer offers. A pin naming its value by id needs nothing — it already follows the rename — and any
 * other pin, including a custom string the author typed off the list, is left exactly as written. Returns
 * `traits` itself when nothing matched.
 */
export function repinRenamedValues(
  traits: Trait[],
  placeholderId: string,
  renames: PlaceholderValueRename[],
): Trait[] {
  if (!renames.length) return traits;
  const byOldValue = new Map(renames.map((r) => [r.from, r.to]));
  let touched = false;
  const out = traits.map((trait) => {
    const pins = trait.placeholderPins;
    if (!pins?.length) return trait;
    let changed = false;
    const next = pins.map((pin) => {
      if (pin.placeholderId !== placeholderId || pin.valueId) return pin;
      const value = byOldValue.get(pin.value);
      if (value === undefined) return pin;
      changed = true;
      return { ...pin, value };
    });
    if (!changed) return trait;
    touched = true;
    return { ...trait, placeholderPins: next };
  });
  return touched ? out : traits;
}
