// What an active trait does beyond its stat changes: switching stats on or off, and pinning placeholders to
// a fixed value. Both are overlays computed fresh from the active set every render — nothing is baked into
// the world or the save, so switching a trait off simply removes its contribution.
//
// Two traits may target the same stat or placeholder. The later one in the authored trait tree wins, so an
// author sets precedence by dragging rows in the editor rather than by learning a rule.

import { buildTraitTree, flattenTraitTree } from './traitTree';
import type { Stat, Trait, TraitGroup } from '@/types';

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

/** The pins for a trait's OWN text: its pins over the active ones. A pinning trait's card always reads its
 *  own value — "Sworn to Marrow" stays "Sworn to Marrow" whatever else is ticked — because the card
 *  advertises what picking the trait does, not what the current selection happens to have made true.
 *  Everything outside the card (stat bars, locations, narration) keeps the active pins. Returns `activePins`
 *  itself when the trait pins nothing, so pin-less traits keep resolver identity. */
export function traitScopedPins(trait: Trait, activePins: Record<string, string>): Record<string, string> {
  const own = activePlaceholderPins([trait]);
  return Object.keys(own).length ? { ...activePins, ...own } : activePins;
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

/**
 * Collapse a default-trait selection so each exclusive group contributes at most one id — the first in
 * authored order, matching the radio the selection screen shows checked. An author can mark two exclusive
 * siblings default; without this both would silently apply on Enter World / Quick Start.
 */
export function collapseExclusiveDefaults(ids: string[], traits: Trait[], groups: TraitGroup[]): string[] {
  const byId = new Map(traits.map((t) => [t.id, t]));
  const order = traitOrderIndex(traits, groups);
  const exclusive = new Set(groups.filter((g) => g.exclusive).map((g) => g.id));
  const takenGroup = new Set<string>();
  const out: string[] = [];
  const sorted = [...ids].sort(
    (a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
  for (const id of sorted) {
    const groupId = byId.get(id)?.groupId ?? null;
    if (groupId !== null && exclusive.has(groupId)) {
      if (takenGroup.has(groupId)) continue;
      takenGroup.add(groupId);
    }
    out.push(id);
  }
  return out;
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
