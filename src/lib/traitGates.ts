// Trait gates: what a requirement list unlocks, and what a selection settles to. Trait and group ids are
// unique across owners (the world or an entity), so a requirement names its target by id alone.

import type { PersonaRef, Trait, TraitGroup, TraitRequirement } from '@/types';
import { collapseExclusiveDefaults, exclusiveSiblings, traitOrderIndex } from './traitEffects';
import { buildTraitTree, flattenTraitTree } from './traitTree';

/** The owner id of the world's own traits. */
export const WORLD_OWNER = 'world';

/** One owner's traits and groups. An entity owner's node sits in the world tree under `parentGroupId`. */
export interface GateOwner {
  id: string;
  /** The entity's name, for "Ash's Tamed". Unused for the world. */
  name: string;
  traits: readonly Trait[];
  groups: readonly TraitGroup[];
  /** The world group an entity owner's node sits in; absent or null = top level. */
  parentGroupId?: string | null;
}

/** A world entity a "playing as" requirement can name. */
export interface GateEntity {
  id: string;
  name: string;
  persona?: boolean;
}

export interface GateInput {
  /** Every owner, the world first. */
  owners: readonly GateOwner[];
  /** Owner id → its active trait ids. */
  active: Readonly<Record<string, readonly string[]>>;
  entities: readonly GateEntity[];
  persona: PersonaRef;
}

export interface RequirementState {
  text: string;
  holds: boolean;
  unresolved: boolean;
}

export interface GateState {
  unlocked: boolean;
  /** Every requirement in authored order. Empty for an ungated trait. */
  requirements: RequirementState[];
}

interface Located<T> { owner: GateOwner; item: T }

/** Lookups built once per input: where each trait and group lives, and which traits sit below each group. */
function index(input: GateInput) {
  const traits = new Map<string, Located<Trait>>();
  const groups = new Map<string, Located<TraitGroup>>();
  for (const owner of input.owners) {
    for (const trait of owner.traits) traits.set(trait.id, { owner, item: trait });
    for (const group of owner.groups) groups.set(group.id, { owner, item: group });
  }
  const entities = new Map(input.entities.map((entity) => [entity.id, entity]));

  // Group id → every trait below it: its owner's traits in its subtree, plus the traits of entity nodes
  // placed anywhere in that subtree.
  const below = new Map<string, string[]>();
  const collect = (groupId: string, owner: GateOwner): string[] => {
    const cached = below.get(groupId);
    if (cached) return cached;
    below.set(groupId, []);
    const ids = [
      ...owner.traits.filter((t) => (t.groupId ?? null) === groupId).map((t) => t.id),
      ...owner.groups.filter((g) => g.parentId === groupId).flatMap((g) => collect(g.id, owner)),
      ...(owner.id === WORLD_OWNER
        ? input.owners.filter((o) => o.id !== WORLD_OWNER && o.parentGroupId === groupId).flatMap((o) => o.traits.map((t) => t.id))
        : []),
    ];
    below.set(groupId, ids);
    return ids;
  };
  for (const { owner, item } of groups.values()) collect(item.id, owner);

  // Trait id → its exclusive siblings, which picking it retires, so they never hold it up.
  const rivals = new Map([...traits.values()].map(({ owner, item }) =>
    [item.id, new Set(exclusiveSiblings(item, owner.traits, owner.groups))]));
  return { traits, groups, entities, below, rivals };
}

type Index = ReturnType<typeof index>;

const activeIds = (input: GateInput): Set<string> => new Set(Object.values(input.active).flat());

const traitsBelow = (idx: Index, groupId: string): readonly string[] => idx.below.get(groupId) ?? [];

/** Whether `req` holds for `trait` against `active`. An exclusive sibling of the trait never counts. */
function requirementHolds(
  req: TraitRequirement, trait: Trait, active: ReadonlySet<string>, idx: Index, persona: PersonaRef,
): boolean {
  const counts = (id: string) => active.has(id) && !idx.rivals.get(trait.id)?.has(id);
  if (req.kind === 'trait') return counts(req.id);
  if (req.kind === 'group') return traitsBelow(idx, req.id).some(counts);
  return persona.source === 'world' && persona.entityId === req.id;
}

function requirementText(req: TraitRequirement, from: GateOwner, idx: Index): { text: string; unresolved: boolean } {
  if (req.kind === 'trait') {
    const target = idx.traits.get(req.id);
    if (!target) return { text: req.name ?? 'a missing trait', unresolved: true };
    const prefix = target.owner.id !== WORLD_OWNER && target.owner.id !== from.id ? `${target.owner.name}'s ` : '';
    return { text: `${prefix}${target.item.name}`, unresolved: false };
  }
  if (req.kind === 'group') {
    const target = idx.groups.get(req.id);
    return target
      ? { text: `any ${target.item.name}`, unresolved: false }
      : { text: req.name ? `any ${req.name}` : 'any trait in a missing group', unresolved: true };
  }
  const entity = idx.entities.get(req.id);
  return entity
    ? { text: `playing as ${entity.name}`, unresolved: false }
    : { text: `playing as ${req.name ?? 'a missing persona'}`, unresolved: true };
}

/** Each trait's gate against the input's active sets. */
export function gateStates(input: GateInput): Map<string, GateState> {
  const idx = index(input);
  const active = activeIds(input);
  const out = new Map<string, GateState>();
  for (const { owner, item: trait } of idx.traits.values()) {
    const requirements = (trait.requires ?? []).map((req) => {
      const { text, unresolved } = requirementText(req, owner, idx);
      return { text, unresolved, holds: !unresolved && requirementHolds(req, trait, active, idx, input.persona) };
    });
    out.set(trait.id, { unlocked: requirements.length === 0 || requirements.some((r) => r.holds), requirements });
  }
  return out;
}

/** A trait and the owner it belongs to. */
export interface GateTraitRef {
  ownerId: string;
  traitId: string;
}

export interface SettleResult {
  /** Owner id → the settled active trait ids: the proposed order, then returned traits as they joined. */
  active: Record<string, string[]>;
  /** Proposed traits whose gate did not hold, dependents before their prerequisites. */
  turnedOff: GateTraitRef[];
  /** Cascade-off traits whose gate holds again, prerequisites first. */
  returned: GateTraitRef[];
  /** Owner id → the traits a cascade has turned off and that may still return. */
  cascadeOff: Record<string, string[]>;
}

/** Every trait's position across owners: the world's tree first, then each owner's in input order. */
function authoredRank(input: GateInput): Map<string, number> {
  const rank = new Map<string, number>();
  for (const owner of input.owners) {
    const base = rank.size;
    for (const [id, i] of traitOrderIndex(owner.traits, owner.groups)) rank.set(id, base + i);
  }
  return rank;
}

const byRank = <T extends Located<Trait>>(items: readonly T[], rank: ReadonlyMap<string, number>): T[] =>
  [...items].sort((a, b) => (rank.get(a.item.id) ?? 0) - (rank.get(b.item.id) ?? 0));

/** Whether `req` could be met by `id` being active. */
const metBy = (req: TraitRequirement, id: string, idx: Index): boolean =>
  (req.kind === 'trait' && req.id === id) || (req.kind === 'group' && traitsBelow(idx, req.id).includes(id));

/** Order turned-off traits so each comes before every trait it required; ties and loops go by authored rank. */
function cascadeOrder(off: Located<Trait>[], idx: Index, rank: ReadonlyMap<string, number>): Located<Trait>[] {
  const ordered = byRank(off, rank);
  const prerequisites = new Map(ordered.map((d) => [d.item.id, ordered.filter((p) =>
    p !== d && (d.item.requires ?? []).some((req) => metBy(req, p.item.id, idx)))]));
  const dependents = new Map(ordered.map((p) => [p.item.id, 0]));
  for (const list of prerequisites.values()) for (const p of list) dependents.set(p.item.id, dependents.get(p.item.id)! + 1);
  const out: Located<Trait>[] = [];
  const left = new Set(ordered);
  while (left.size) {
    const next = ordered.find((t) => left.has(t) && dependents.get(t.item.id) === 0) ?? ordered.find((t) => left.has(t))!;
    left.delete(next);
    out.push(next);
    for (const p of prerequisites.get(next.item.id)!) dependents.set(p.item.id, dependents.get(p.item.id)! - 1);
  }
  return out;
}

/**
 * Settle the proposed active sets against every gate. The settled set grows from the ground up: a proposed
 * trait joins once its gate holds against what has joined so far, until nothing joins. Traits that only
 * require each other never join, because neither is in the set when the other is checked.
 *
 * A trait in `cascadeOff` joins the same way, so it returns once its gate holds again. One whose exclusive
 * sibling is proposed stays off and leaves the list: the player picked the sibling since.
 */
export function settle(input: GateInput, cascadeOff: Readonly<Record<string, readonly string[]>> = {}): SettleResult {
  const idx = index(input);
  const locate = (ids: Iterable<string>) =>
    [...ids].map((id) => idx.traits.get(id)).filter((t): t is Located<Trait> => !!t);
  const proposedIds = activeIds(input);
  const proposed = locate(proposedIds);
  const rivalIn = (t: Located<Trait>, ids: ReadonlySet<string>) => [...idx.rivals.get(t.item.id)!].some((id) => ids.has(id));
  const waiting = locate(Object.values(cascadeOff).flat()).filter((t) => !proposedIds.has(t.item.id));
  const rank = authoredRank(input);
  const candidates = byRank(waiting.filter((t) => !rivalIn(t, proposedIds)), rank);

  const kept = new Set<string>();
  const returned: Located<Trait>[] = [];
  const opens = (trait: Trait) => {
    const reqs = trait.requires ?? [];
    return reqs.length === 0 || reqs.some((req) => requirementHolds(req, trait, kept, idx, input.persona));
  };
  for (let joined = true; joined;) {
    joined = false;
    for (const t of proposed) {
      if (kept.has(t.item.id) || !opens(t.item)) continue;
      kept.add(t.item.id);
      joined = true;
    }
    for (const t of candidates) {
      if (kept.has(t.item.id) || rivalIn(t, kept) || !opens(t.item)) continue;
      kept.add(t.item.id);
      returned.push(t);
      joined = true;
    }
  }

  // An id no owner holds has no gate to check, so it stays: a save keeps a trait the world has since deleted.
  const stays = (id: string) => kept.has(id) || !idx.traits.has(id);
  const active: Record<string, string[]> = {};
  for (const owner of input.owners) {
    active[owner.id] = [
      ...(input.active[owner.id] ?? []).filter(stays),
      ...returned.filter((t) => t.owner === owner).map((t) => t.item.id),
    ];
  }
  const off = cascadeOrder(proposed.filter((t) => !kept.has(t.item.id)), idx, rank);
  const stillWaiting = candidates.filter((t) => !kept.has(t.item.id));
  const nextCascadeOff: Record<string, string[]> = {};
  for (const owner of input.owners) {
    nextCascadeOff[owner.id] = [...off, ...stillWaiting].filter((t) => t.owner === owner).map((t) => t.item.id);
  }
  const ref = (t: Located<Trait>): GateTraitRef => ({ ownerId: t.owner.id, traitId: t.item.id });
  return { active, turnedOff: off.map(ref), returned: returned.map(ref), cascadeOff: nextCascadeOff };
}

/**
 * Switch one trait on or off, then settle. Switching on retires its exclusive siblings first, so the
 * cascade sees the retirement. A locked trait cannot switch on: the result is null.
 */
export function switchTrait(
  input: GateInput, ownerId: string, traitId: string, cascadeOff: Readonly<Record<string, readonly string[]>> = {},
): SettleResult | null {
  const current = input.active[ownerId] ?? [];
  let next: string[];
  if (current.includes(traitId)) {
    next = current.filter((id) => id !== traitId);
  } else {
    if (gateStates(input).get(traitId)?.unlocked === false) return null;
    const owner = input.owners.find((o) => o.id === ownerId);
    const trait = owner?.traits.find((t) => t.id === traitId);
    const retire = new Set(owner && trait ? exclusiveSiblings(trait, owner.traits, owner.groups) : []);
    next = [...current.filter((id) => !retire.has(id)), traitId];
  }
  return settle({ ...input, active: { ...input.active, [ownerId]: next } }, cascadeOff);
}

/** Every owner's default traits, one per exclusive group, settled so a gated default whose chain has no open
 *  root starts unselected. */
export function settleDefaults(input: Omit<GateInput, 'active'>): SettleResult {
  const active: Record<string, string[]> = {};
  for (const owner of input.owners) {
    const traits = [...owner.traits];
    const groups = [...owner.groups];
    active[owner.id] = collapseExclusiveDefaults(traits.filter((t) => t.isDefault).map((t) => t.id), traits, groups);
  }
  return settle({ ...input, active });
}

/**
 * The traits no selection can ever unlock, grouped into sets of traits that require one another. A trait
 * is unlockable when a chain of its requirements reaches a trait with none, a world persona, or a group
 * holding such a trait. So "A requires B or C, B requires A" passes, because C opens A.
 */
export function neverUnlockable(input: Omit<GateInput, 'active'>): string[][] {
  const idx = index({ ...input, active: {} });
  const personas = new Set(input.entities.filter((e) => e.persona).map((e) => e.id));
  const open = new Set<string>();
  const canHold = (trait: Trait) => (req: TraitRequirement) => req.kind === 'playingAs'
    ? personas.has(req.id)
    : requirementHolds(req, trait, open, idx, { source: 'none' });
  const all = [...idx.traits.values()];
  for (let grew = true; grew;) {
    grew = false;
    for (const { item } of all) {
      if (open.has(item.id)) continue;
      const reqs = item.requires ?? [];
      if (reqs.length > 0 && !reqs.some(canHold(item))) continue;
      open.add(item.id);
      grew = true;
    }
  }

  const rank = authoredRank({ ...input, active: {} });
  const stuck = byRank(all.filter((t) => !open.has(t.item.id)), rank);
  const root = new Map(stuck.map((t) => [t.item.id, t.item.id]));
  const find = (id: string): string => (root.get(id) === id ? id : find(root.get(id)!));
  for (const d of stuck) {
    for (const p of stuck) {
      if (p !== d && (d.item.requires ?? []).some((req) => metBy(req, p.item.id, idx))) root.set(find(d.item.id), find(p.item.id));
    }
  }
  const sets = new Map<string, string[]>();
  for (const t of stuck) {
    const key = find(t.item.id);
    sets.set(key, [...(sets.get(key) ?? []), t.item.id]);
  }
  return [...sets.values()];
}

/** One row of the requirement picker: what it adds, how the chip reads, and where the target lives. */
export interface RequirementOption {
  requirement: TraitRequirement;
  label: string;
  /** "Ash › Bond": the owner, when not the world, then the group path. "World" for a top-level world item. */
  where: string;
}

export interface RequirementOptions {
  traits: RequirementOption[];
  groups: RequirementOption[];
  personas: RequirementOption[];
}

/**
 * Every requirement an author can give `traitId`, in tree order per owner. The trait itself, its
 * exclusive siblings, and a group holding only those are left out, because none of them can ever hold it up.
 */
export function requirementOptions(input: Omit<GateInput, 'active' | 'persona'>, traitId: string): RequirementOptions {
  const idx = index({ ...input, active: {}, persona: { source: 'none' } });
  const from = idx.traits.get(traitId)?.owner ?? input.owners[0];
  const skip = new Set([traitId, ...(idx.rivals.get(traitId) ?? [])]);
  // A group whose every trait is skipped can never hold; an empty one still can, once it gains a trait.
  const deadGroup = (groupId: string) => {
    const ids = traitsBelow(idx, groupId);
    return ids.length > 0 && ids.every((id) => skip.has(id));
  };
  const where =(owner: GateOwner, groupId: string | null | undefined) => {
    const path: string[] = [];
    for (let id = groupId ?? null, seen = 0; id && seen < owner.groups.length; seen++) {
      const group = owner.groups.find((g) => g.id === id);
      if (!group) break;
      path.unshift(group.name);
      id = group.parentId;
    }
    if (owner.id !== WORLD_OWNER) path.unshift(owner.name);
    return path.join(' › ') || 'World';
  };
  const option = (requirement: TraitRequirement, whereText: string): RequirementOption =>
    ({ requirement, label: requirementText(requirement, from, idx).text, where: whereText });

  const traits: RequirementOption[] = [];
  const groups: RequirementOption[] = [];
  for (const owner of input.owners) {
    for (const node of flattenTraitTree(buildTraitTree(owner.groups, owner.traits))) {
      if (node.leaf && !skip.has(node.leaf.id)) traits.push(option({ kind: 'trait', id: node.leaf.id }, where(owner, node.leaf.groupId)));
      if (node.group && !deadGroup(node.group.id)) groups.push(option({ kind: 'group', id: node.group.id }, where(owner, node.group.parentId)));
    }
  }
  const personas = input.entities.filter((e) => e.persona).map((e) => option({ kind: 'playingAs', id: e.id }, 'Persona'));
  return { traits, groups, personas };
}

/** The gate input for a world with only its own traits, as the enter-world step uses it. */
export const worldGateInput = (
  world: { traits: readonly Trait[]; groups: readonly TraitGroup[]; entities: readonly GateEntity[] },
  persona: PersonaRef,
  active: readonly string[] = [],
): GateInput => ({
  owners: [{ id: WORLD_OWNER, name: '', traits: world.traits, groups: world.groups }],
  active: { [WORLD_OWNER]: active },
  entities: world.entities,
  persona,
});
