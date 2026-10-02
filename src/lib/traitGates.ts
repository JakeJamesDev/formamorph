// Trait gates: what a requirement list unlocks, and what a selection settles to. Every owner is one bearer
// and gates on its own active set; the player's owners (the world root and the played entity) read as one.

import type { PersonaRef, RequirementBearer, Trait, TraitGroup, TraitRequirement } from '@/types';
import { defaultPicks, exclusiveSiblings, isAlwaysOn, isHidden, traitOrderIndex } from './traitEffects';
// The generic tree, not traitTree: that module reads the bearer resolver, which reads this one.
import { buildTree, flattenTree } from './groupTree';

/** The owner id of the world's own traits, and the player bearer's key. */
export const WORLD_OWNER = 'world';

/** The breadcrumb of a world trait or group with no group above it. */
export const WORLD_BREADCRUMB: readonly string[] = ['World'];

/** One bearer's traits and groups. An entity owner's node sits in the world tree under `parentGroupId`. */
export interface GateOwner {
  id: string;
  /** The entity's name, for "Albus: Paladin". Unused for the world. */
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
  /** The Custom Persona mark: the entity's set is the player's under None and a library persona. */
  customPersona?: boolean;
}

export interface GateInput {
  /** Every present bearer, the player first. */
  owners: readonly GateOwner[];
  /** Owner id → its active trait ids. */
  active: Readonly<Record<string, readonly string[]>>;
  entities: readonly GateEntity[];
  persona: PersonaRef;
  /** Every world trait and group a requirement can name, whether or not a present bearer holds it. Absent,
   *  only the owners' items resolve. */
  originals?: { traits: readonly Trait[]; groups: readonly TraitGroup[] };
}

export interface RequirementState {
  text: string;
  holds: boolean;
  unresolved: boolean;
  /** The target is a Hidden trait, so player-facing lines leave it out (Q14). */
  hidden: boolean;
}

export interface GateState {
  unlocked: boolean;
  /** Every requirement in authored order. Empty for an ungated trait. */
  requirements: RequirementState[];
}

/** Owner id → trait id → that owner's gate on the trait. */
export type GateStates = ReadonlyMap<string, ReadonlyMap<string, GateState>>;

export const gateOf = (states: GateStates, ownerId: string, traitId: string): GateState | undefined =>
  states.get(ownerId)?.get(traitId);

/** A trait and the owner it belongs to. */
export interface GateTraitRef {
  ownerId: string;
  traitId: string;
}

/** The owner ids whose active sets are the player's: the world root, the played entity, and the Custom
 *  Persona entity under None and a library persona. */
export function playerOwnerIds(persona: PersonaRef, entities: readonly GateEntity[] = []): string[] {
  const custom = persona.source === 'world' ? [] : entities.filter((e) => e.customPersona).map((e) => e.id);
  return persona.source === 'none' ? [WORLD_OWNER, ...custom] : [WORLD_OWNER, persona.entityId, ...custom];
}

/** The first owner whose tree holds `traitId`: the world's copy of an original, else the entity that owns it. */
export const ownerHolding = (owners: readonly GateOwner[], traitId: string): GateOwner | undefined =>
  owners.find((o) => o.traits.some((t) => t.id === traitId));

/** The refs the player may see named: every one but a Hidden trait in its owner's tree. */
export const shownRefs = (owners: readonly GateOwner[], refs: readonly GateTraitRef[]): GateTraitRef[] =>
  refs.filter((ref) => !owners.some((o) => o.id === ref.ownerId && o.traits.some((t) => t.id === ref.traitId && isHidden(t))));

/** The bearer a requirement names; absent for the same bearer and for "playing as". */
export const bearerOf = (req: TraitRequirement): RequirementBearer | undefined =>
  (req.kind === 'playingAs' ? undefined : req.bearer);

/** One key per bearer choice, so two requirements compare by it. */
export const bearerKey = (bearer?: RequirementBearer): string =>
  (bearer === undefined ? 'same' : bearer.kind === 'you' ? 'you' : `entity:${bearer.id}`);

/** Whether two requirements add the same gate: the same target under the same bearer. */
export const sameRequirement = (a: TraitRequirement, b: TraitRequirement): boolean =>
  a.kind === b.kind && a.id === b.id && bearerKey(bearerOf(a)) === bearerKey(bearerOf(b));

interface Located<T> { owner: GateOwner; item: T }

const key = (ownerId: string, traitId: string) => `${ownerId}\u0000${traitId}`;
const keyOf = (t: Located<{ id: string }>) => key(t.owner.id, t.item.id);

/** Whether `id` is active in owner `ownerId`. */
type ActiveIn = (ownerId: string, id: string) => boolean;

interface OwnerIndex {
  owner: GateOwner;
  traits: Map<string, Located<Trait>>;
  groups: Map<string, Located<TraitGroup>>;
  /** Group id → every trait below it in this owner's tree, plus the traits of entity nodes placed in a
   *  world group's subtree. */
  below: Map<string, string[]>;
  /** Trait id → its exclusive siblings, which picking it retires, so they never hold it up. */
  rivals: Map<string, Set<string>>;
}

/** Lookups built once per input: each owner's tree, every name a requirement can read, and the player set. */
function index(input: GateInput) {
  const owners = new Map<string, OwnerIndex>();
  const traitNames = new Map<string, string>();
  const groupNames = new Map<string, string>();
  const hiddenTraits = new Set<string>();
  const nameTrait = (trait: Trait) => {
    if (traitNames.has(trait.id)) return;
    traitNames.set(trait.id, trait.name);
    if (isHidden(trait)) hiddenTraits.add(trait.id);
  };
  for (const trait of input.originals?.traits ?? []) nameTrait(trait);
  for (const group of input.originals?.groups ?? []) groupNames.set(group.id, group.name);
  for (const owner of input.owners) {
    const traits = new Map(owner.traits.map((item) => [item.id, { owner, item }]));
    const groups = new Map(owner.groups.map((item) => [item.id, { owner, item }]));
    for (const trait of owner.traits) nameTrait(trait);
    for (const group of owner.groups) if (!groupNames.has(group.id)) groupNames.set(group.id, group.name);
    const below = new Map<string, string[]>();
    const collect = (groupId: string): string[] => {
      const cached = below.get(groupId);
      if (cached) return cached;
      below.set(groupId, []);
      const ids = [
        ...owner.traits.filter((t) => (t.groupId ?? null) === groupId).map((t) => t.id),
        ...owner.groups.filter((g) => g.parentId === groupId).flatMap((g) => collect(g.id)),
        ...(owner.id === WORLD_OWNER
          ? input.owners.filter((o) => o.id !== WORLD_OWNER && o.parentGroupId === groupId).flatMap((o) => o.traits.map((t) => t.id))
          : []),
      ];
      below.set(groupId, ids);
      return ids;
    };
    for (const group of owner.groups) collect(group.id);
    const rivals = new Map(owner.traits.map((t) => [t.id, new Set(exclusiveSiblings(t, owner.traits, owner.groups))]));
    owners.set(owner.id, { owner, traits, groups, below, rivals });
  }
  const entities = new Map(input.entities.map((entity) => [entity.id, entity]));
  const playerIds = new Set(playerOwnerIds(input.persona, input.entities));
  /** The owners a requirement from `owner` reads: the player's owners together, or the owner alone. */
  const setOf = (owner: GateOwner): ReadonlySet<string> => (playerIds.has(owner.id) ? playerIds : new Set([owner.id]));
  const bearerSet = (bearer: RequirementBearer | undefined, from: GateOwner): ReadonlySet<string> =>
    (bearer === undefined ? setOf(from) : bearer.kind === 'you' ? playerIds : new Set([bearer.id]));
  const traitsBelow = (set: ReadonlySet<string>, groupId: string): string[] =>
    [...set].flatMap((ownerId) => owners.get(ownerId)?.below.get(groupId) ?? []);
  return { owners, traitNames, groupNames, hiddenTraits, entities, playerIds, bearerSet, traitsBelow, persona: input.persona };
}

type Index = ReturnType<typeof index>;

/** Each owner's active set, limited to the traits it holds: a pick an owner no longer holds, such as a
 *  Custom Persona pick lying dormant under a world persona, opens nothing. `settle` locates the same way. */
const activeSets = (input: GateInput): ActiveIn => {
  const sets = new Map(input.owners.map((owner) => {
    const held = new Set(owner.traits.map((t) => t.id));
    return [owner.id, new Set((input.active[owner.id] ?? []).filter((id) => held.has(id)))];
  }));
  return (ownerId, id) => sets.get(ownerId)?.has(id) ?? false;
};

/** Whether `req` holds for `trait` against `activeIn`. An exclusive sibling of the trait never counts. */
function requirementHolds(req: TraitRequirement, trait: Located<Trait>, activeIn: ActiveIn, idx: Index): boolean {
  if (req.kind === 'playingAs') return idx.persona.source === 'world' && idx.persona.entityId === req.id;
  const set = idx.bearerSet(req.bearer, trait.owner);
  const rivals = idx.owners.get(trait.owner.id)?.rivals.get(trait.item.id);
  const counts = (id: string) => !rivals?.has(id) && [...set].some((ownerId) => activeIn(ownerId, id));
  if (req.kind === 'trait') return counts(req.id);
  return idx.traitsBelow(set, req.id).some(counts);
}

/** The bearer's name as the text reads it, or null when the named entity is gone. */
function bearerName(bearer: RequirementBearer, idx: Index): string | null {
  if (bearer.kind === 'you') return 'You';
  return idx.entities.get(bearer.id)?.name ?? idx.owners.get(bearer.id)?.owner.name ?? null;
}

function requirementText(req: TraitRequirement, idx: Index): { text: string; unresolved: boolean } {
  if (req.kind === 'playingAs') {
    const entity = idx.entities.get(req.id);
    return entity
      ? { text: `playing as ${entity.name}`, unresolved: false }
      : { text: `playing as ${req.name ?? 'a missing persona'}`, unresolved: true };
  }
  const target = req.kind === 'trait'
    ? (idx.traitNames.has(req.id)
      ? { text: idx.traitNames.get(req.id)!, unresolved: false }
      : { text: req.name ?? 'a missing trait', unresolved: true })
    : (idx.groupNames.has(req.id)
      ? { text: `any ${idx.groupNames.get(req.id)}`, unresolved: false }
      : { text: req.name ? `any ${req.name}` : 'any trait in a missing group', unresolved: true });
  if (!req.bearer) return target;
  const name = bearerName(req.bearer, idx);
  return name
    ? { text: `${name}: ${target.text}`, unresolved: target.unresolved }
    : { text: `${req.bearer.kind === 'entity' && req.bearer.name ? req.bearer.name : 'a missing entity'}: ${target.text}`, unresolved: true };
}

/** Each owner's gate on each of its traits, against the input's active sets. */
export function gateStates(input: GateInput): GateStates {
  const idx = index(input);
  const activeIn = activeSets(input);
  const out = new Map<string, Map<string, GateState>>();
  for (const { owner, traits } of idx.owners.values()) {
    const states = new Map<string, GateState>();
    for (const trait of traits.values()) {
      const requirements = (trait.item.requires ?? []).map((req) => {
        const { text, unresolved } = requirementText(req, idx);
        const hidden = req.kind === 'trait' && idx.hiddenTraits.has(req.id);
        return { text, unresolved, hidden, holds: !unresolved && requirementHolds(req, trait, activeIn, idx) };
      });
      states.set(trait.item.id, { unlocked: requirements.length === 0 || requirements.some((r) => r.holds), requirements });
    }
    out.set(owner.id, states);
  }
  return out;
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
    for (const [id, i] of traitOrderIndex(owner.traits, owner.groups)) rank.set(key(owner.id, id), base + i);
  }
  return rank;
}

const byRank = <T extends Located<Trait>>(items: readonly T[], rank: ReadonlyMap<string, number>): T[] =>
  [...items].sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0));

/** Whether `req` on `from` could be met by `p` being active. */
function metBy(req: TraitRequirement, from: GateOwner, p: Located<Trait>, idx: Index): boolean {
  if (req.kind === 'playingAs') return false;
  const set = idx.bearerSet(req.bearer, from);
  if (!set.has(p.owner.id)) return false;
  return req.kind === 'trait' ? req.id === p.item.id : idx.traitsBelow(set, req.id).includes(p.item.id);
}

/** Order turned-off traits so each comes before every trait it required; ties and loops go by authored rank. */
function cascadeOrder(off: Located<Trait>[], idx: Index, rank: ReadonlyMap<string, number>): Located<Trait>[] {
  const ordered = byRank(off, rank);
  const prerequisites = new Map(ordered.map((d) => [keyOf(d), ordered.filter((p) =>
    p !== d && (d.item.requires ?? []).some((req) => metBy(req, d.owner, p, idx)))]));
  const dependents = new Map(ordered.map((p) => [keyOf(p), 0]));
  for (const list of prerequisites.values()) for (const p of list) dependents.set(keyOf(p), dependents.get(keyOf(p))! + 1);
  const out: Located<Trait>[] = [];
  const left = new Set(ordered);
  while (left.size) {
    const next = ordered.find((t) => left.has(t) && dependents.get(keyOf(t)) === 0) ?? ordered.find((t) => left.has(t))!;
    left.delete(next);
    out.push(next);
    for (const p of prerequisites.get(keyOf(next))!) dependents.set(keyOf(p), dependents.get(keyOf(p))! - 1);
  }
  return out;
}

/** The traits `lists` names, each located in its own owner; an id the owner lacks is skipped. */
function locate(idx: Index, lists: Readonly<Record<string, readonly string[]>>): Located<Trait>[] {
  const out: Located<Trait>[] = [];
  for (const owner of idx.owners.values()) {
    for (const id of lists[owner.owner.id] ?? []) {
      const found = owner.traits.get(id);
      if (found) out.push(found);
    }
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
 *
 * Every Always On trait is proposed too, so it joins whenever its gate holds and is reported as returned
 * when no pick named it. It never waits on the cascade-off list: its mode alone brings it back.
 */
export function settle(input: GateInput, cascadeOff: Readonly<Record<string, readonly string[]>> = {}): SettleResult {
  const idx = index(input);
  const rank = authoredRank(input);
  const proposed = locate(idx, input.active);
  const proposedKeys = new Set(proposed.map(keyOf));
  const automatic = byRank([...idx.owners.values()].flatMap((o) => [...o.traits.values()])
    .filter((t) => isAlwaysOn(t.item) && !proposedKeys.has(keyOf(t))), rank);
  const rivalIn = (t: Located<Trait>, keys: ReadonlySet<string>) =>
    [...(idx.owners.get(t.owner.id)?.rivals.get(t.item.id) ?? [])].some((id) => keys.has(key(t.owner.id, id)));
  const waiting = locate(idx, cascadeOff).filter((t) => !proposedKeys.has(keyOf(t)) && !isAlwaysOn(t.item));
  const candidates = byRank(waiting.filter((t) => !rivalIn(t, proposedKeys)), rank);

  const kept = new Set<string>();
  const activeIn: ActiveIn = (ownerId, id) => kept.has(key(ownerId, id));
  const returned: Located<Trait>[] = [];
  const opens = (t: Located<Trait>) => {
    const reqs = t.item.requires ?? [];
    return reqs.length === 0 || reqs.some((req) => requirementHolds(req, t, activeIn, idx));
  };
  for (let joined = true; joined;) {
    joined = false;
    for (const t of proposed) {
      if (kept.has(keyOf(t)) || !opens(t)) continue;
      kept.add(keyOf(t));
      joined = true;
    }
    for (const t of automatic) {
      if (kept.has(keyOf(t)) || !opens(t)) continue;
      kept.add(keyOf(t));
      returned.push(t);
      joined = true;
    }
    for (const t of candidates) {
      if (kept.has(keyOf(t)) || rivalIn(t, kept) || !opens(t)) continue;
      kept.add(keyOf(t));
      returned.push(t);
      joined = true;
    }
  }

  // An id the owner does not hold has no gate to check, so it stays: a save keeps a trait the world has
  // since deleted.
  const active: Record<string, string[]> = {};
  for (const owner of input.owners) {
    const held = idx.owners.get(owner.id)!.traits;
    active[owner.id] = [
      ...(input.active[owner.id] ?? []).filter((id) => kept.has(key(owner.id, id)) || !held.has(id)),
      ...returned.filter((t) => t.owner === owner).map((t) => t.item.id),
    ];
  }
  const off = cascadeOrder(proposed.filter((t) => !kept.has(keyOf(t))), idx, rank);
  const stillWaiting = candidates.filter((t) => !kept.has(keyOf(t)));
  const nextCascadeOff: Record<string, string[]> = {};
  for (const owner of input.owners) {
    nextCascadeOff[owner.id] = [...off, ...stillWaiting].filter((t) => t.owner === owner && !isAlwaysOn(t.item)).map((t) => t.item.id);
  }
  const ref = (t: Located<Trait>): GateTraitRef => ({ ownerId: t.owner.id, traitId: t.item.id });
  return { active, turnedOff: off.map(ref), returned: returned.map(ref), cascadeOff: nextCascadeOff };
}

/** A group's picks against one bearer's active set. Only traits placed directly in the group count. */
export interface GroupPickState {
  count: number;
  min: number;
  /** null = no limit. */
  max: number | null;
  /** Fewer picks than the minimum. */
  short: boolean;
  /** At the maximum: no further pick fits. */
  full: boolean;
}

/** `group`'s pick state against `active`, counting the traits in `traits` placed directly in it. */
export function groupPickState(group: TraitGroup, traits: readonly Trait[], active: readonly string[]): GroupPickState {
  const on = new Set(active);
  const count = traits.filter((t) => (t.groupId ?? null) === group.id && on.has(t.id)).length;
  const min = group.minPicks ?? 0;
  const max = group.maxPicks ?? null;
  return { count, min, max, short: count < min, full: max !== null && count >= max };
}

/** Owner id → group id → that bearer's pick state, for every group in every owner's tree. */
export function groupPickStates(input: Pick<GateInput, 'owners' | 'active'>): Map<string, Map<string, GroupPickState>> {
  return new Map(input.owners.map((owner) => {
    const active = input.active[owner.id] ?? [];
    return [owner.id, new Map(owner.groups.map((g) => [g.id, groupPickState(g, owner.traits, active)]))];
  }));
}

/** Whether switching `traitId` on would overfill its group in `ownerId`: the group is full at a max above
 *  one. A max-one group swaps its pick instead. */
export function overfills(input: Pick<GateInput, 'owners' | 'active'>, ownerId: string, traitId: string): boolean {
  const owner = input.owners.find((o) => o.id === ownerId);
  const groupId = owner?.traits.find((t) => t.id === traitId)?.groupId ?? null;
  const group = owner?.groups.find((g) => g.id === groupId);
  const active = input.active[ownerId] ?? [];
  return !!owner && !!group && group.maxPicks !== 1 && !active.includes(traitId)
    && groupPickState(group, owner.traits, active).full;
}

/** Whether dropping one pick from a group in `picks` leaves it below its minimum. */
export const leavesShort = (picks: GroupPickState): boolean => picks.count - 1 < picks.min;

/** Whether switching `traitId` off would leave its group in `ownerId` below the minimum, including a group
 *  a cascade has already left short. */
export function underfills(input: Pick<GateInput, 'owners' | 'active'>, ownerId: string, traitId: string): boolean {
  const owner = input.owners.find((o) => o.id === ownerId);
  const groupId = owner?.traits.find((t) => t.id === traitId)?.groupId ?? null;
  const group = owner?.groups.find((g) => g.id === groupId);
  const active = input.active[ownerId] ?? [];
  return !!owner && !!group && active.includes(traitId) && leavesShort(groupPickState(group, owner.traits, active));
}

/** Whether a trait's mode refuses the switch in `ownerId`: the trait is Always On, or switching it on would
 *  retire an active Always On sibling in a max-one group. */
export function modeRefuses(input: Pick<GateInput, 'owners' | 'active'>, ownerId: string, traitId: string): boolean {
  const owner = input.owners.find((o) => o.id === ownerId);
  const trait = owner?.traits.find((t) => t.id === traitId);
  if (!owner || !trait) return false;
  if (isAlwaysOn(trait)) return true;
  const active = input.active[ownerId] ?? [];
  const groupId = trait.groupId ?? null;
  return !active.includes(traitId) && owner.groups.find((g) => g.id === groupId)?.maxPicks === 1
    && owner.traits.some((t) => (t.groupId ?? null) === groupId && isAlwaysOn(t) && active.includes(t.id));
}

/**
 * Switch one owner's trait on or off, then settle. Switching on retires its exclusive siblings first, so the
 * cascade sees the retirement. A locked trait, or one whose group is full at a max above one, cannot switch
 * on, and the mode refuses what `modeRefuses` names: the result is null.
 */
export function switchTrait(
  input: GateInput, ownerId: string, traitId: string, cascadeOff: Readonly<Record<string, readonly string[]>> = {},
): SettleResult | null {
  if (modeRefuses(input, ownerId, traitId)) return null;
  const current = input.active[ownerId] ?? [];
  let next: string[];
  if (current.includes(traitId)) {
    next = current.filter((id) => id !== traitId);
  } else {
    if (gateOf(gateStates(input), ownerId, traitId)?.unlocked === false || overfills(input, ownerId, traitId)) return null;
    const owner = input.owners.find((o) => o.id === ownerId);
    const trait = owner?.traits.find((t) => t.id === traitId);
    const retire = new Set(owner && trait ? exclusiveSiblings(trait, owner.traits, owner.groups) : []);
    next = [...current.filter((id) => !retire.has(id)), traitId];
  }
  return settle({ ...input, active: { ...input.active, [ownerId]: next } }, cascadeOff);
}

/** Every owner's default traits, capped at each group's max in authored order after the Always On traits
 *  active with no pick, settled so a gated default whose chain has no open root starts unselected. */
export function settleDefaults(input: Omit<GateInput, 'active'>): SettleResult {
  const alwaysOnIn = (active: Record<string, string[]>) => Object.fromEntries(input.owners.map((owner) =>
    [owner.id, (active[owner.id] ?? []).filter((id) => owner.traits.some((t) => t.id === id && isAlwaysOn(t)))]));
  const withDefaults = (alwaysOn: Record<string, string[]>) => settle({
    ...input,
    active: Object.fromEntries(input.owners.map((o) => [o.id, defaultPicks(o.traits, o.groups, alwaysOn[o.id] ?? [])])),
  });
  // A default can open an Always On trait that then takes its group's room, so the cap reruns with it counted.
  let alwaysOn = alwaysOnIn(settle({ ...input, active: {} }).active);
  let result = withDefaults(alwaysOn);
  for (let pass = 0; pass < 3; pass++) {
    const next = alwaysOnIn(result.active);
    if (JSON.stringify(next) === JSON.stringify(alwaysOn)) break;
    alwaysOn = next;
    result = withDefaults(alwaysOn);
  }
  return result;
}

/**
 * The traits no selection can ever unlock for their owner, grouped into sets of traits that require one
 * another. A trait is unlockable when a chain of its requirements reaches a trait with none in a set it
 * reads, a world persona, or a group holding such a trait. So "A requires B or C, B requires A" passes,
 * because C opens A. The player set follows the input's persona; a "playing as" opens for any persona.
 */
export function neverUnlockable(input: Omit<GateInput, 'active'>): GateTraitRef[][] {
  const idx = index({ ...input, active: {} });
  const personas = new Set(input.entities.filter((e) => e.persona).map((e) => e.id));
  const open = new Set<string>();
  const activeIn: ActiveIn = (ownerId, id) => open.has(key(ownerId, id));
  const canHold = (trait: Located<Trait>) => (req: TraitRequirement) => (req.kind === 'playingAs'
    ? personas.has(req.id)
    : requirementHolds(req, trait, activeIn, idx));
  const all = [...idx.owners.values()].flatMap((o) => [...o.traits.values()]);
  for (let grew = true; grew;) {
    grew = false;
    for (const t of all) {
      if (open.has(keyOf(t))) continue;
      const reqs = t.item.requires ?? [];
      if (reqs.length > 0 && !reqs.some(canHold(t))) continue;
      open.add(keyOf(t));
      grew = true;
    }
  }

  const rank = authoredRank({ ...input, active: {} });
  const stuck = byRank(all.filter((t) => !open.has(keyOf(t))), rank);
  const root = new Map(stuck.map((t) => [keyOf(t), keyOf(t)]));
  const find = (k: string): string => (root.get(k) === k ? k : find(root.get(k)!));
  for (const d of stuck) {
    for (const p of stuck) {
      if (p !== d && (d.item.requires ?? []).some((req) => metBy(req, d.owner, p, idx))) root.set(find(keyOf(d)), find(keyOf(p)));
    }
  }
  const sets = new Map<string, GateTraitRef[]>();
  for (const t of stuck) {
    const k = find(keyOf(t));
    sets.set(k, [...(sets.get(k) ?? []), { ownerId: t.owner.id, traitId: t.item.id }]);
  }
  return [...sets.values()];
}

/** A group whose Always On traits can be on together past its max, on one bearer. */
export interface AlwaysOnOverflow {
  ownerId: string;
  groupId: string;
  max: number;
  /** The largest set one selection opens together, in authored order. */
  traitIds: string[];
}

// Search steps per group before the query gives up and reports every unlockable Always On trait.
const OVERFLOW_SEARCH_BUDGET = 20_000;

/**
 * Every group whose Always On traits placed directly in it can be on together past its max, under the
 * input's persona. A set counts when one selection opens every trait in it: each gate's chain reaches an
 * open root with no two max-one rivals picked. The search is brute force over the group's Always On traits.
 */
export function alwaysOnOverMax(input: Omit<GateInput, 'active'>): AlwaysOnOverflow[] {
  const idx = index({ ...input, active: {} });
  const rank = authoredRank({ ...input, active: {} });
  const stuck = new Set(neverUnlockable(input).flat().map((r) => key(r.ownerId, r.traitId)));
  const out: AlwaysOnOverflow[] = [];
  for (const { owner, traits } of idx.owners.values()) {
    for (const group of owner.groups) {
      const max = group.maxPicks;
      if (max === undefined) continue;
      const fixed = byRank([...traits.values()].filter((t) =>
        (t.item.groupId ?? null) === group.id && isAlwaysOn(t.item) && !stuck.has(keyOf(t))), rank);
      if (fixed.length <= max) continue;
      const together = largestTogether(fixed, max + 1, idx, stuck);
      if (together) out.push({ ownerId: owner.id, groupId: group.id, max, traitIds: together.map((t) => t.item.id) });
    }
  }
  return out;
}

/** The largest subset of `traits`, at least `atLeast` strong, that one selection opens together; null when
 *  none is. Past the search budget, every trait counts. */
function largestTogether(traits: Located<Trait>[], atLeast: number, idx: Index, stuck: ReadonlySet<string>): Located<Trait>[] | null {
  const budget = { left: OVERFLOW_SEARCH_BUDGET };
  for (let size = traits.length; size >= atLeast; size--) {
    for (const subset of combinations(traits, size)) {
      if (opensTogether(subset, idx, stuck, budget)) return subset;
      if (budget.left <= 0) return traits;
    }
  }
  return null;
}

function* combinations<T>(items: readonly T[], size: number, from = 0): Generator<T[]> {
  if (size === 0) { yield []; return; }
  for (let i = from; i <= items.length - size; i++) {
    for (const rest of combinations(items, size - 1, i + 1)) yield [items[i], ...rest];
  }
}

/** Whether one selection opens every trait in `targets`: a backtracking search that opens each gate through
 *  some requirement, prerequisites first, and never picks two max-one rivals. */
function opensTogether(targets: Located<Trait>[], idx: Index, stuck: ReadonlySet<string>, budget: { left: number }): boolean {
  const picked = new Set<string>();
  const pending = new Set<string>();
  const clashes = (t: Located<Trait>) =>
    [...(idx.owners.get(t.owner.id)?.rivals.get(t.item.id) ?? [])].some((id) => picked.has(key(t.owner.id, id)));
  const satisfiers = (req: Exclude<TraitRequirement, { kind: 'playingAs' }>, t: Located<Trait>): Located<Trait>[] => {
    const set = idx.bearerSet(req.bearer, t.owner);
    const rivals = idx.owners.get(t.owner.id)?.rivals.get(t.item.id);
    const ids = req.kind === 'trait' ? [req.id] : [...new Set(idx.traitsBelow(set, req.id))];
    return ids.filter((id) => !rivals?.has(id)).flatMap((id) => [...set].flatMap((ownerId) => {
      const found = idx.owners.get(ownerId)?.traits.get(id);
      return found ? [found] : [];
    }));
  };
  const open = (t: Located<Trait>, then: () => boolean): boolean => {
    const k = keyOf(t);
    if (picked.has(k)) return then();
    if (pending.has(k) || stuck.has(k) || --budget.left < 0) return false;
    pending.add(k);
    const finish = () => {
      if (clashes(t)) return false;
      picked.add(k);
      if (then()) return true;
      picked.delete(k);
      return false;
    };
    const reqs = t.item.requires ?? [];
    const ok = reqs.length === 0
      ? finish()
      : reqs.some((req) => (req.kind === 'playingAs'
        ? idx.persona.source === 'world' && idx.persona.entityId === req.id && finish()
        : satisfiers(req, t).some((s) => open(s, finish))));
    pending.delete(k);
    return ok;
  };
  return targets.reduceRight<() => boolean>((then, t) => () => open(t, then), () => true)();
}

/** A bearer the picker can name for a target, with the name its row shows. */
export interface RequirementBearerOption {
  bearer: RequirementBearer;
  name: string;
}

/** One row of the requirement picker: what it adds, how the chip reads, and where the target lives. */
export interface RequirementOption {
  requirement: TraitRequirement;
  label: string;
  /** The owner, when not the world, then the group path. `World` for a top-level world item. */
  breadcrumb: string[];
  /** The bearers the row can name instead of the same bearer: You, then every entity that bears the target. */
  bearers: RequirementBearerOption[];
}

export interface RequirementOptions {
  traits: RequirementOption[];
  groups: RequirementOption[];
  personas: RequirementOption[];
}

/** `requirement` scoped to `bearer`; the same bearer when `bearer` is absent. */
export const withBearer = (requirement: TraitRequirement, bearer?: RequirementBearer): TraitRequirement =>
  (requirement.kind === 'playingAs' || !bearer ? requirement : { ...requirement, bearer });

/**
 * Every requirement an author can give `traitId`, each target once, in tree order per owner. The trait
 * itself, its exclusive siblings, and a group holding only those are left out, because none of them can
 * ever hold it up.
 */
export function requirementOptions(input: Omit<GateInput, 'active' | 'persona'>, traitId: string): RequirementOptions {
  const idx = index({ ...input, active: {}, persona: { source: 'none' } });
  const from = ownerHolding(input.owners, traitId) ?? input.owners[0];
  const skip = new Set([traitId, ...(idx.owners.get(from.id)?.rivals.get(traitId) ?? [])]);
  const everyOwner = new Set(idx.owners.keys());
  // A group whose every trait is skipped can never hold; an empty one still can, once it gains a trait.
  const deadGroup = (groupId: string) => {
    const ids = idx.traitsBelow(everyOwner, groupId);
    return ids.length > 0 && ids.every((id) => skip.has(id));
  };
  const breadcrumbOf = (owner: GateOwner, groupId: string | null | undefined): string[] => {
    const path: string[] = [];
    for (let id = groupId ?? null, seen = 0; id && seen < owner.groups.length; seen++) {
      const group = owner.groups.find((g) => g.id === id);
      if (!group) break;
      path.unshift(group.name);
      id = group.parentId;
    }
    if (owner.id !== WORLD_OWNER) path.unshift(owner.name);
    return path.length > 0 ? path : [...WORLD_BREADCRUMB];
  };
  const bearersOf = (id: string, kind: 'trait' | 'group'): RequirementBearerOption[] => [
    { bearer: { kind: 'you' }, name: 'You' },
    ...input.owners
      .filter((o) => o.id !== WORLD_OWNER && (kind === 'trait' ? o.traits : o.groups).some((item) => item.id === id))
      .map((o): RequirementBearerOption => ({ bearer: { kind: 'entity', id: o.id, name: o.name }, name: o.name })),
  ];
  const option = (requirement: TraitRequirement, breadcrumb: string[], bearers: RequirementBearerOption[] = []): RequirementOption =>
    ({ requirement, label: requirementText(requirement, idx).text, breadcrumb, bearers });

  const seen = new Set<string>();
  const traits: RequirementOption[] = [];
  const groups: RequirementOption[] = [];
  for (const owner of input.owners) {
    for (const node of flattenTree(buildTree(owner.groups, owner.traits))) {
      const id = node.leaf?.id ?? node.group?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (node.leaf && !skip.has(id)) traits.push(option({ kind: 'trait', id }, breadcrumbOf(owner, node.leaf.groupId), bearersOf(id, 'trait')));
      if (node.group && !deadGroup(id)) groups.push(option({ kind: 'group', id }, breadcrumbOf(owner, node.group.parentId), bearersOf(id, 'group')));
    }
  }
  const personas = input.entities.filter((e) => e.persona).map((e) => option({ kind: 'playingAs', id: e.id }, ['Persona']));
  return { traits, groups, personas };
}

/** The gate input for a world with only its own traits. */
export const worldGateInput = (
  world: { traits: readonly Trait[]; groups: readonly TraitGroup[]; entities: readonly GateEntity[] },
  persona: PersonaRef,
  active: readonly string[] = [],
): GateInput => ({
  owners: [{ id: WORLD_OWNER, name: '', traits: world.traits, groups: world.groups }],
  active: { [WORLD_OWNER]: active },
  entities: world.entities,
  persona,
  originals: { traits: world.traits, groups: world.groups },
});
