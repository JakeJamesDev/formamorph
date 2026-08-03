// What an active trait does beyond its stat changes: switching stats on or off, and pinning placeholders to
// a fixed value. Both are overlays computed fresh from the active set every render — nothing is baked into
// the world or the save, so switching a trait off simply removes its contribution.
//
// Two traits may target the same stat or placeholder. The later one in the authored trait tree wins, so an
// author sets precedence by dragging rows in the editor rather than by learning a rule.

import { buildTraitTree, flattenTraitTree } from './traitTree';
import type { Stat, StatChange, Trait, TraitGroup } from '@/types';

/** Trait id → its position in the authored tree, depth-first. Ids missing from the world sort last. */
export function traitOrderIndex(traits: Trait[], groups: TraitGroup[]): Map<string, number> {
  const map = new Map<string, number>();
  flattenTraitTree(buildTraitTree(groups, traits)).forEach((node, i) => {
    if (node.leaf) map.set(node.leaf.id, i);
  });
  return map;
}

/** Sort a set of active traits into authored order, so "last wins" means the same thing everywhere. */
export function inAuthoredOrder(active: Trait[], order: Map<string, number>): Trait[] {
  return [...active].sort(
    (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * The stat changes that undo `changes`. Reversal is negation, not a recompute: `applyTraitStatChanges` is
 * already built to let traits cancel each other's bound raises (and floors a min at the stat's authored
 * value), so feeding it the negated deltas restores the stat to where it stood.
 */
export function invertStatChanges(changes: StatChange[]): StatChange[] {
  return changes.map((c) => ({ ...c, value: -c.value }));
}

/**
 * Which stats are live, given the world's defaults and the active traits. A stat is on unless its author set
 * `enabled: false`; each active trait's `statToggles` then override that, later traits winning.
 */
export function activeStatEnabled(
  stats: Array<Pick<Stat, 'id' | 'enabled'>>,
  activeInOrder: Trait[],
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

/** Placeholder id → the value the active traits force it to, later traits winning. Empty pins are ignored,
 *  so a half-filled editor row never blanks a placeholder. */
export function activePlaceholderPins(activeInOrder: Trait[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of activeInOrder) {
    for (const pin of t.placeholderPins ?? []) {
      if (pin.placeholderId && pin.value) out[pin.placeholderId] = pin.value;
    }
  }
  return out;
}

/**
 * The traits a player toggle switches off alongside the one being switched on: an exclusive group holds at
 * most one active trait, so enabling a member retires its active siblings. Nesting doesn't cascade — only
 * traits sitting directly in the same group compete.
 */
export function exclusiveSiblings(trait: Trait, traits: Trait[], groups: TraitGroup[]): string[] {
  const groupId = trait.groupId ?? null;
  if (groupId === null) return [];
  if (!groups.find((g) => g.id === groupId)?.exclusive) return [];
  return traits.filter((t) => (t.groupId ?? null) === groupId && t.id !== trait.id).map((t) => t.id);
}

/** Another trait claiming the same target, and which of the two the precedence rule picks. */
export interface TraitConflict {
  /** Names of the other traits targeting this, in authored order. */
  others: string[];
  /** Whether the trait being edited is the one that wins. */
  winsHere: boolean;
}

/**
 * For one trait, the targets another trait also claims — what the editor shows as a precedence note.
 *
 * Traits that can never be active together are not a conflict, so exclusive siblings are excluded: a group
 * of mutually exclusive hair traits all pinning Hair Color is the intended shape, not a mistake.
 */
export function traitConflicts(
  trait: Trait,
  traits: Trait[],
  groups: TraitGroup[],
): { stats: Record<string, TraitConflict>; placeholders: Record<string, TraitConflict> } {
  const order = traitOrderIndex(traits, groups);
  const impossible = new Set(exclusiveSiblings(trait, traits, groups));
  const rivals = traits.filter((t) => t.id !== trait.id && !impossible.has(t.id));
  const rank = (t: Trait) => order.get(t.id) ?? Number.MAX_SAFE_INTEGER;

  const collect = (
    mine: string[],
    claims: (t: Trait) => string[],
  ): Record<string, TraitConflict> => {
    const out: Record<string, TraitConflict> = {};
    for (const id of mine) {
      const others = inAuthoredOrder(rivals.filter((t) => claims(t).includes(id)), order);
      if (!others.length) continue;
      out[id] = {
        others: others.map((t) => t.name),
        winsHere: others.every((t) => rank(t) < rank(trait)),
      };
    }
    return out;
  };

  return {
    stats: collect(
      (trait.statToggles ?? []).map((s) => s.statId).filter(Boolean),
      (t) => (t.statToggles ?? []).map((s) => s.statId),
    ),
    placeholders: collect(
      (trait.placeholderPins ?? []).map((p) => p.placeholderId).filter(Boolean),
      (t) => (t.placeholderPins ?? []).map((p) => p.placeholderId),
    ),
  };
}
