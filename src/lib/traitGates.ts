// Trait gates: what a requirement list unlocks, and what a selection settles to. Every owner gates on its
// own active set. A Condition reads the owner it names when that owner holds the target, else global scope
// for a global target (Q10, Q29).

import type {
  Daypart, PersonaRef, RequirementOwner, StatComparison, StatRequirement, TimeRequirement, Trait, TraitGroup, TraitRequirement, TraitRequirementRow,
} from '@/types';
import { DAYPARTS, OPENING_DAYPART, daypartSet } from './gameClock';
import { defaultPicks, exclusiveSiblings, isAlwaysOn, isHidden, traitOrderIndex } from './traitEffects';
// The generic tree, not traitTree: that module reads the owner resolver, which reads this one.
import { buildTree, flattenTree } from './groupTree';
import { blueprintsSubtreeIds } from './blueprintGroups';
import { conditionsOf, rowsHold } from './requirementRows';
import { partOf, playedEntityIds, scoped, scopedEntries, scopeKey, withPart, type OwnerId, type Scoped } from './scope';

/** The breadcrumb of a world trait or group with no group above it. */
export const WORLD_BREADCRUMB: readonly string[] = ['World'];

/** One tree of traits and groups: global scope's, or an entity owner's. */
export interface GateTree {
  traits: readonly Trait[];
  groups: readonly TraitGroup[];
}

/** One entity owner's traits and groups. Its node sits in the world tree under `parentGroupId`. */
export interface GateOwner extends GateTree {
  id: string;
  /** The entity's name, for "Albus: Paladin". */
  name: string;
  /** The world group the owner's node sits in; absent or null = top level. */
  parentGroupId?: string | null;
}

/** A tree with the owner that holds it: an entity owner, or global scope with a null id and no name. */
export type GateScopeTree = GateTree & { id: OwnerId; name: string; parentGroupId?: string | null };

/** The global tree as a scope. */
const globalScopeTree = (tree: GateTree): GateScopeTree => ({ id: null, name: '', traits: tree.traits, groups: tree.groups });

/** Every scope in the input: global scope first, then each entity owner in input order. */
export const gateTrees = (input: Pick<GateInput, 'global' | 'owners'>): GateScopeTree[] => [globalScopeTree(input.global), ...input.owners];

/** `fn` of each scope, scoped by the scope's id. A list without a global scope gets `fn`'s value for none. */
function perScopeOf<T, H extends { id: OwnerId }>(scopes: Iterable<H>, fn: (scope: H) => T, none: T): Scoped<T> {
  let global = none;
  const owners: Record<string, T> = {};
  for (const scope of scopes) {
    if (scope.id === null) global = fn(scope);
    else owners[scope.id] = fn(scope);
  }
  return { global, owners };
}

/** A world entity a "playing as" requirement can name. */
export interface GateEntity {
  id: string;
  name: string;
  persona?: boolean;
  /** The Custom Persona mark: the entity's set is the player's under None and a library persona. */
  customPersona?: boolean;
}

/** One stat as a stat Condition reads it: its value on its effective min→max. */
export interface GateStat {
  name: string;
  value: number;
  min: number;
  max: number;
  /** Switched off: a Condition on it is unresolved (Q21). */
  inert?: boolean;
  /** Hidden from the player, so player-facing lines leave a Condition on it out. */
  hidden?: boolean;
}

/** Stat id → one scope's stat. */
export type GateStatSet = Readonly<Record<string, GateStat>>;

/** The global stats and each entity owner's, by stat id. */
export type GateStats = Scoped<GateStatSet>;

/** Each scope's active trait ids. */
export type GateActive = Scoped<readonly string[]>;

/** No trait active anywhere. */
export const NO_ACTIVE: GateActive = scoped([]);

export interface GateInput {
  /** Global scope's tree: the traits and groups no one owns. */
  global: GateTree;
  /** Every present entity owner. */
  owners: readonly GateOwner[];
  active: GateActive;
  /** Absent, every stat Condition is unresolved. */
  stats?: GateStats;
  /** The story clock's daypart, which a time Condition reads. Absent, the opening hour's: what authoring
   *  lenses read. */
  daypart?: Daypart;
  entities: readonly GateEntity[];
  persona: PersonaRef;
  /** Every world trait and group a requirement can name, whether or not a present owner holds it. Absent,
   *  only the owners' items resolve. */
  originals?: { traits: readonly Trait[]; groups: readonly TraitGroup[] };
  /** Who reads the Condition text. The author reads the persona owner as "Persona"; the player reads the
   *  played persona's name, which the line marks (Q7, Q11). Absent, the author. */
  reader?: 'author' | 'player';
}

/** One Condition's state against the active sets. */
export interface ConditionState {
  text: string;
  /** The played persona's name the text opens with, for the You pill on the player's line. */
  persona?: string;
  holds: boolean;
  unresolved: boolean;
  /** The target is a Hidden trait, or a hidden or inert stat, so player-facing lines leave it out (Q14, Q21). */
  hidden: boolean;
}

/** One Requirement Row's state: it holds when every Condition in it holds. */
export interface RowState {
  holds: boolean;
  conditions: ConditionState[];
}

export interface GateState {
  unlocked: boolean;
  /** Every row in authored order. Empty for an ungated trait. */
  rows: RowState[];
}

/** Every Condition's state across the gate's rows, in authored order. */
export const gateConditions = (gate: GateState): ConditionState[] => gate.rows.flatMap((row) => row.conditions);

/** Trait id → a scope's gate on the trait, for global scope and each entity owner. */
export type GateStates = Scoped<ReadonlyMap<string, GateState>>;

export const gateOf = (states: GateStates, ownerId: OwnerId, traitId: string): GateState | undefined =>
  partOf(states, ownerId)?.get(traitId);

/** A trait and the owner it belongs to; a null owner is global scope. */
export interface GateTraitRef {
  ownerId: OwnerId;
  traitId: string;
}

/** The active ids `ownerId` holds; none for an owner the input lacks. */
export const activeOf = (active: GateActive, ownerId: OwnerId): readonly string[] =>
  partOf(active, ownerId) ?? [];

/** The first scope whose tree holds `traitId`, global scope first: the world's copy of an original, else
 *  the entity that owns it. */
export const ownerHolding = (input: Pick<GateInput, 'global' | 'owners'>, traitId: string): GateScopeTree | undefined =>
  gateTrees(input).find((o) => o.traits.some((t) => t.id === traitId));

/** The scope `ownerId` names in the input. */
export const gateTreeOf = (input: Pick<GateInput, 'global' | 'owners'>, ownerId: OwnerId): GateScopeTree | undefined =>
  (ownerId === null ? globalScopeTree(input.global) : input.owners.find((o) => o.id === ownerId));

/** The refs the player may see named: every one but a Hidden trait in its owner's tree. */
export const shownRefs = (input: Pick<GateInput, 'global' | 'owners'>, refs: readonly GateTraitRef[]): GateTraitRef[] =>
  refs.filter((ref) => !gateTreeOf(input, ref.ownerId)?.traits.some((t) => t.id === ref.traitId && isHidden(t)));

/** The owner a requirement names; absent for the same owner and for "playing as". */
export const requirementOwnerOf = (req: TraitRequirement): RequirementOwner | undefined =>
  (req.kind === 'playingAs' ? undefined : req.owner);

/** One key per owner choice, so two requirements compare by it. */
export const requirementOwnerKey = (owner?: RequirementOwner): string =>
  (owner === undefined ? 'same' : owner.kind === 'you' ? 'you' : `entity:${owner.id}`);

const sameDayparts = (a: TimeRequirement, b: TimeRequirement): boolean => daypartSet(a.dayparts).join() === daypartSet(b.dayparts).join();

/** Whether two requirements add the same gate: the same target under the same owner, both plain or both Not,
 *  for a stat the same comparison, and for a time the same dayparts. */
export const sameRequirement = (a: TraitRequirement, b: TraitRequirement): boolean =>
  a.kind === b.kind && a.id === b.id && requirementOwnerKey(requirementOwnerOf(a)) === requirementOwnerKey(requirementOwnerOf(b)) && !a.not === !b.not
  && (a.kind !== 'stat' || (b.kind === 'stat' && a.operator === b.operator && a.value === b.value && a.unit === b.unit))
  && (a.kind !== 'time' || (b.kind === 'time' && sameDayparts(a, b)));

interface Located<T> { owner: GateScopeTree; item: T }

const key = (ownerId: OwnerId, traitId: string) => `${scopeKey(ownerId)}\u0000${traitId}`;
const keyOf = (t: Located<{ id: string }>) => key(t.owner.id, t.item.id);

/** Whether `id` is active in scope `ownerId`. */
type ActiveIn = (ownerId: OwnerId, id: string) => boolean;

/** The stats `ownerId` holds; none for an owner the input lacks. */
const statsIn = (stats: GateStats | undefined, ownerId: OwnerId): GateStatSet | undefined =>
  (stats && partOf(stats, ownerId));

interface OwnerIndex {
  owner: GateScopeTree;
  traits: Map<string, Located<Trait>>;
  groups: Map<string, Located<TraitGroup>>;
  /** Group id → every trait below it in this owner's tree. */
  below: Map<string, string[]>;
  /** Trait id → its exclusive siblings, which picking it retires, so they never hold it up. */
  rivals: Map<string, Set<string>>;
}

/** Lookups built once per input: each owner's tree, every name a requirement can read, and the player set. */
function index(input: GateInput) {
  const owners = new Map<OwnerId, OwnerIndex>();
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
  for (const owner of gateTrees(input)) {
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
      ];
      below.set(groupId, ids);
      return ids;
    };
    for (const group of owner.groups) collect(group.id);
    const rivals = new Map(owner.traits.map((t) => [t.id, new Set(exclusiveSiblings(t, owner.traits, owner.groups))]));
    owners.set(owner.id, { owner, traits, groups, below, rivals });
  }
  const entities = new Map(input.entities.map((entity) => [entity.id, entity]));
  const played = playedEntityIds(input.persona, input.entities);
  // The owner carries the name the player entered under None; the entity list has the authored one.
  const personaName = input.reader === 'player' && played.length > 0
    ? owners.get(played[0])?.owner.name || entities.get(played[0])?.name || null
    : null;
  const stats = input.stats;
  const global = globalItems(input);
  const holds = (ownerId: OwnerId, req: Targeted): boolean => (req.kind === 'stat' ? !!statsIn(stats, ownerId)?.[req.id]
    : !!owners.get(ownerId)?.[req.kind === 'trait' ? 'traits' : 'groups'].has(req.id));
  const isGlobal = (req: Targeted): boolean => (req.kind === 'stat' ? !!stats?.global[req.id]
    : (req.kind === 'trait' ? global.traits : global.groups).has(req.id));
  /** The scopes a Condition on `from` reads: those it names (the host for Same Owner, the played entities
   *  for You) when one holds the target; else global scope for a global target (Q10, Q29); else the named
   *  ones. */
  const ownerSet = (req: Targeted, from: GateScopeTree): ReadonlySet<OwnerId> => {
    const named: OwnerId[] = req.owner === undefined ? [from.id] : req.owner.kind === 'you' ? played : [req.owner.id];
    if (named.some((id) => holds(id, req)) || !isGlobal(req)) return new Set(named);
    return new Set([null]);
  };
  const traitsBelow = (set: ReadonlySet<OwnerId>, groupId: string): string[] =>
    [...set].flatMap((ownerId) => owners.get(ownerId)?.below.get(groupId) ?? []);
  const statNames = new Map<string, string>();
  for (const [, set] of stats ? scopedEntries(stats) : []) {
    for (const [id, stat] of Object.entries(set)) if (!statNames.has(id)) statNames.set(id, stat.name);
  }
  /** The stat a stat Condition on `from` reads: the first scope of the id in its owner set. Null when no
   *  scope in the set has it. */
  const statOf = (req: StatRequirement, from: GateScopeTree): GateStat | null => {
    for (const ownerId of ownerSet(req, from)) {
      const stat = statsIn(stats, ownerId)?.[req.id];
      if (stat) return stat;
    }
    return null;
  };
  return {
    owners, traitNames, groupNames, hiddenTraits, statNames, entities, global, isGlobal, ownerSet, traitsBelow, statOf, persona: input.persona, personaName,
    daypart: input.daypart ?? OPENING_DAYPART,
  };
}

/** A Condition that names a trait, a group or a stat. */
type Targeted = Exclude<TraitRequirement, { kind: 'playingAs' } | TimeRequirement>;

/** A Condition whose target is a trait, a group or a persona: one an active set or the persona decides. */
type Switched = Exclude<TraitRequirement, StatRequirement | TimeRequirement>;

/** The global traits and groups: the world's own, outside Blueprints. Read from the originals, else from the
 *  global tree. */
export function globalItems(input: Pick<GateInput, 'global' | 'originals'>): { traits: ReadonlySet<string>; groups: ReadonlySet<string> } {
  const world = input.originals ?? input.global;
  const groups = world.groups;
  const blueprints = blueprintsSubtreeIds(groups);
  return {
    traits: new Set(world.traits.filter((t) => t.groupId == null || !blueprints.has(t.groupId)).map((t) => t.id)),
    groups: new Set(groups.filter((g) => !blueprints.has(g.id)).map((g) => g.id)),
  };
}

type Index = ReturnType<typeof index>;

/** Each owner's active set, limited to the traits it holds: a pick an owner no longer holds, such as a
 *  Custom Persona pick lying dormant under a world persona, opens nothing. `settle` locates the same way. */
const activeSets = (input: GateInput): ActiveIn => {
  const sets = new Map(gateTrees(input).map((owner) => {
    const held = new Set(owner.traits.map((t) => t.id));
    return [owner.id, new Set(activeOf(input.active, owner.id).filter((id) => held.has(id)))];
  }));
  return (ownerId, id) => sets.get(ownerId)?.has(id) ?? false;
};

/** Whether a Condition's target is on for `trait`. The trait itself and its exclusive siblings in its own tree
 *  never count (Q26); another owner's copy of a sibling does. */
function targetOn(req: Switched, trait: Located<{ id: string }>, activeIn: ActiveIn, idx: Index): boolean {
  if (req.kind === 'playingAs') return idx.persona.source === 'world' && idx.persona.entityId === req.id;
  const set = idx.ownerSet(req, trait.owner);
  const rivals = idx.owners.get(trait.owner.id)?.rivals.get(trait.item.id);
  const own = (id: string) => id === trait.item.id || !!rivals?.has(id);
  const counts = (id: string) => [...set].some((ownerId) => !(ownerId === trait.owner.id && own(id)) && activeIn(ownerId, id));
  if (req.kind === 'trait') return counts(req.id);
  return idx.traitsBelow(set, req.id).some(counts);
}

/** Where a stat reads on a stat Condition's scale: its value, or its share of min→max with a zero span at 0%
 *  (Q22). */
const statReading = (stat: GateStat, unit: StatRequirement['unit']): number => {
  if (unit === 'raw') return stat.value;
  const span = stat.max - stat.min;
  return span === 0 ? 0 : ((stat.value - stat.min) / span) * 100;
};

/** Whether `reading` compares to `value` as `operator` says. Equality reads the rounded number the stat bar
 *  shows. */
function compares(reading: number, operator: StatRequirement['operator'], value: number): boolean {
  switch (operator) {
    case '>': return reading > value;
    case '<': return reading < value;
    case '>=': return reading >= value;
    case '<=': return reading <= value;
    case '=': return Math.round(reading) === value;
    case '≠': return Math.round(reading) !== value;
  }
}

/** Whether a stat Condition on `from` holds: its stat resolves and is not inert, and it compares, or fails to
 *  under Not. */
function statHolds(req: StatRequirement, from: GateScopeTree, idx: Index): boolean {
  const stat = idx.statOf(req, from);
  if (!stat || stat.inert) return false;
  return compares(statReading(stat, req.unit), req.operator, req.value) !== !!req.not;
}

/** Whether one Condition holds for `trait` against `activeIn`: its target is on, or off under Not. */
function requirementHolds(req: TraitRequirement, trait: Located<{ id: string }>, activeIn: ActiveIn, idx: Index): boolean {
  if (req.kind === 'stat') return statHolds(req, trait.owner, idx);
  if (req.kind === 'time') return req.dayparts.includes(idx.daypart);
  return req.not ? !targetOn(req, trait, activeIn, idx) : targetOn(req, trait, activeIn, idx);
}

/** The Condition test for positive growth: every Not Condition on a target that exists holds, so growth stays
 *  monotone and a Condition whose target is gone never holds (Q27). A stat Condition reads no active set, so
 *  it evaluates directly. */
const growthHolds = (trait: Located<Trait>, activeIn: ActiveIn, idx: Index) => (req: TraitRequirement): boolean =>
  (req.not && req.kind !== 'stat' ? resolves(req, idx) : requirementHolds(req, trait, activeIn, idx));

/** The owner's name as the reader's text reads it, or null when the named entity is gone. The persona owner
 *  reads "Persona" to the author and the played persona's name to the player, which `persona` marks. */
function ownerName(owner: RequirementOwner, idx: Index): { name: string; persona?: string } | null {
  if (owner.kind === 'you') return idx.personaName ? { name: idx.personaName, persona: idx.personaName } : { name: 'Persona' };
  const name = idx.entities.get(owner.id)?.name ?? idx.owners.get(owner.id)?.owner.name;
  return name === undefined ? null : { name };
}

/** Whether a Condition's target, and its named owner, still exist. A global target's owner is inert (Q10). */
function resolves(req: Switched, idx: Index): boolean {
  if (req.kind === 'playingAs') return idx.entities.has(req.id);
  const target = req.kind === 'trait' ? idx.traitNames.has(req.id) : idx.groupNames.has(req.id);
  return target && (!req.owner || idx.isGlobal(req) || ownerName(req.owner, idx) !== null);
}

/** What follows the stat's name in a stat Condition's text: the operator, then the number, with `%` under percent. */
export const statTail = (req: StatRequirement): string => `${req.operator} ${req.value}${req.unit === 'percent' ? '%' : ''}`;

const DAYPARTS_OR = new Intl.ListFormat('en', { type: 'disjunction' });

/** A time Condition's dayparts in words, from the first one after a daypart it leaves out, so a stretch across
 *  midnight reads in order: "evening or night". */
export function timeText(req: TimeRequirement): string {
  if (!req.dayparts.length) return 'no time of day';
  const on = (i: number) => req.dayparts.includes(DAYPARTS[(i + DAYPARTS.length) % DAYPARTS.length]);
  const start = Math.max(0, DAYPARTS.findIndex((_, i) => on(i) && !on(i - 1)));
  return DAYPARTS_OR.format([...DAYPARTS.slice(start), ...DAYPARTS.slice(0, start)].filter((d) => req.dayparts.includes(d)));
}

/** "Paladin", "not any Class", "Ash: not Tamed" (Q11). `persona` is the played persona's name the text opens
 *  with, for the player's line to mark. */
function requirementText(req: TraitRequirement, idx: Index): { text: string; unresolved: boolean; persona?: string } {
  if (req.kind === 'time') return { text: timeText(req), unresolved: !req.dayparts.length };
  const not = req.not ? 'not ' : '';
  if (req.kind === 'playingAs') {
    const entity = idx.entities.get(req.id);
    return entity
      ? { text: `${not}playing as ${entity.name}`, unresolved: false }
      : { text: `${not}playing as ${req.name ?? 'a missing persona'}`, unresolved: true };
  }
  const named = req.kind === 'trait'
    ? (idx.traitNames.has(req.id)
      ? { text: idx.traitNames.get(req.id)!, unresolved: false }
      : { text: req.name ?? 'a missing trait', unresolved: true })
    : req.kind === 'group'
      ? (idx.groupNames.has(req.id)
        ? { text: `any ${idx.groupNames.get(req.id)}`, unresolved: false }
        : { text: req.name ? `any ${req.name}` : 'any trait in a missing group', unresolved: true })
      : {
        text: `${idx.statNames.get(req.id) ?? req.name ?? 'a missing stat'} ${statTail(req)}`,
        unresolved: !idx.statNames.has(req.id),
      };
  const target = { ...named, text: `${not}${named.text}` };
  if (!req.owner) return target;
  const owner = ownerName(req.owner, idx);
  return owner
    ? { text: `${owner.name}: ${target.text}`, unresolved: target.unresolved, persona: owner.persona }
    : {
      text: `${req.owner.kind === 'entity' && req.owner.name ? req.owner.name : 'a missing entity'}: ${target.text}`,
      unresolved: target.unresolved || !idx.isGlobal(req),
    };
}

/** A reader for any Condition's text against the input's names, as the gate line reads it. */
export function conditionTexts(input: Omit<GateInput, 'active' | 'persona'>): (req: TraitRequirement) => string {
  const idx = index({ ...input, active: NO_ACTIVE, persona: { source: 'none' } });
  return (req) => requirementText(req, idx).text;
}

/** `req` with its Not flag flipped. */
export const flipped = (req: TraitRequirement): TraitRequirement => {
  // A time Condition has no Not: its complement is the other dayparts.
  if (req.kind === 'time') return { kind: 'time', dayparts: DAYPARTS.filter((d) => !req.dayparts.includes(d)) };
  const { not, ...plain } = req;
  // The rest of a union loses its discriminant link; `plain` keeps every field of `req`'s own kind.
  return (not ? plain : { ...plain, not: true }) as TraitRequirement;
};

const COMPLEMENT: Record<StatComparison, StatComparison> = { '>': '<=', '<=': '>', '<': '>=', '>=': '<', '=': '≠', '≠': '=' };

/** The operator a stat Condition holds under once its Not is folded in. */
const effectiveOperator = (req: StatRequirement): StatComparison => (req.not ? COMPLEMENT[req.operator] : req.operator);

/** Whether exactly one of the two Conditions holds in every state: a Condition and its Not, two time
 *  Conditions that split the day between them, or two stat Conditions on one reading whose operators split the
 *  number line (`> n` and `<= n`, `= n` and `≠ n`). */
export const complementary = (a: TraitRequirement, b: TraitRequirement): boolean => {
  if (sameRequirement(a, flipped(b))) return true;
  if (a.kind !== 'stat' || b.kind !== 'stat') return false;
  return a.id === b.id && requirementOwnerKey(requirementOwnerOf(a)) === requirementOwnerKey(requirementOwnerOf(b)) && a.value === b.value && a.unit === b.unit
    && effectiveOperator(a) === COMPLEMENT[effectiveOperator(b)];
};

/** Each owner's gate on each of its traits, against the input's active sets. */
export function gateStates(input: GateInput): GateStates {
  const idx = index(input);
  const activeIn = activeSets(input);
  return perScopeOf([...idx.owners.values()].map((o) => o.owner), (owner) => {
    const states = new Map<string, GateState>();
    for (const trait of idx.owners.get(owner.id)!.traits.values()) {
      const rows = rowStatesOf(trait.item.requires ?? [], trait, activeIn, idx);
      states.set(trait.item.id, { unlocked: rows.length === 0 || rows.some((r) => r.holds), rows });
    }
    return states;
  }, new Map());
}

/** Each row's state for `rows` read from `host`: a stat resolves against the owner set of `host`, which the
 *  text alone does not read. */
function rowStatesOf(rows: readonly TraitRequirementRow[], host: Located<{ id: string }>, activeIn: ActiveIn, idx: Index): RowState[] {
  return rows.map((row): RowState => {
    const conditions = row.all.map((req): ConditionState => {
      const named = requirementText(req, idx);
      const stat = req.kind === 'stat' ? idx.statOf(req, host.owner) : null;
      const unresolved = named.unresolved || (req.kind === 'stat' && (!stat || !!stat.inert));
      const hidden = req.kind === 'trait' ? idx.hiddenTraits.has(req.id) : !!stat && (!!stat.hidden || !!stat.inert);
      return { text: named.text, persona: named.persona, unresolved, hidden, holds: !unresolved && requirementHolds(req, host, activeIn, idx) };
    });
    return { holds: conditions.every((c) => c.holds), conditions };
  });
}

/**
 * The state of loose Requirement Rows, such as an image's Visibility rule, read from `ownerId`: that owner when
 * the input holds it, else an owner with no traits (an entity that only has stats and images).
 */
export function ruleStates(input: GateInput, ownerId: OwnerId, rows: readonly TraitRequirementRow[]): RowState[] {
  const idx = index(input);
  const owner = idx.owners.get(ownerId)?.owner
    ?? { id: ownerId, name: (ownerId !== null && idx.entities.get(ownerId)?.name) || '', traits: [], groups: [] };
  return rowStatesOf(rows, { owner, item: { id: `rule:${scopeKey(ownerId)}` } }, activeSets(input), idx);
}

/** Each scope's trait id lists. */
export type ScopedIds = Scoped<string[]>;

export interface SettleResult {
  /** Each scope's settled active trait ids: the proposed order, then returned traits as they joined. */
  active: ScopedIds;
  /** Proposed traits whose gate did not hold, dependents before their prerequisites. */
  turnedOff: GateTraitRef[];
  /** Cascade-off traits whose gate holds again, prerequisites first. */
  returned: GateTraitRef[];
  /** Each scope's traits a cascade has turned off and that may still return. */
  cascadeOff: ScopedIds;
}

/** Every trait's position across scopes: the global tree first, then each owner's in input order. */
function authoredRank(input: GateInput): Map<string, number> {
  const rank = new Map<string, number>();
  for (const owner of gateTrees(input)) {
    const base = rank.size;
    for (const [id, i] of traitOrderIndex(owner.traits, owner.groups)) rank.set(key(owner.id, id), base + i);
  }
  return rank;
}

const byRank = <T extends Located<Trait>>(items: readonly T[], rank: ReadonlyMap<string, number>): T[] =>
  [...items].sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0));

/** The traits a Condition on `from` names, in the owners it reads, either polarity. */
function targetsOf(req: TraitRequirement, from: GateScopeTree, idx: Index): Located<Trait>[] {
  if (req.kind === 'playingAs' || req.kind === 'stat' || req.kind === 'time') return [];
  const set = idx.ownerSet(req, from);
  const ids = req.kind === 'trait' ? [req.id] : [...new Set(idx.traitsBelow(set, req.id))];
  return [...set].flatMap((ownerId) => ids.flatMap((id) => idx.owners.get(ownerId)?.traits.get(id) ?? []));
}

/** Whether `req` on `from` could be met by `p` being active. A Not Condition is never met by a trait. */
const metBy = (req: TraitRequirement, from: GateScopeTree, p: Located<Trait>, idx: Index): boolean =>
  !req.not && targetsOf(req, from, idx).includes(p);

/** Order turned-off traits so each comes before every trait it required; ties and loops go by authored rank. */
function cascadeOrder(off: Located<Trait>[], idx: Index, rank: ReadonlyMap<string, number>): Located<Trait>[] {
  const ordered = byRank(off, rank);
  const prerequisites = new Map(ordered.map((d) => [keyOf(d), ordered.filter((p) =>
    p !== d && conditionsOf(d.item.requires).some((req) => metBy(req, d.owner, p, idx)))]));
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
function locate(idx: Index, lists: GateActive): Located<Trait>[] {
  const out: Located<Trait>[] = [];
  for (const owner of idx.owners.values()) {
    for (const id of activeOf(lists, owner.owner.id)) {
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
 *
 * A Not Condition holds during growth. Once nothing joins, each kept trait is checked against the final set;
 * the latest-proposed one that a Not now fails is left out, and growth reruns without it. A returner never
 * turns off a pick or an Always On trait: it stays waiting instead. A left-out trait comes back once the set
 * checks clean with it. A pick that turns off this way goes to the cascade-off list like any other.
 */
export function settle(input: GateInput, cascadeOff: GateActive = NO_ACTIVE): SettleResult {
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

  // Proposal order: picks, then Automatic traits, then cascade-off returners. A later one loses a tie (Q8).
  const pool = [...proposed, ...automatic, ...candidates];
  const excluded = new Set<string>();
  let kept = new Set<string>();
  let returned: Located<Trait>[] = [];
  const activeIn: ActiveIn = (ownerId, id) => kept.has(key(ownerId, id));
  const grows = (t: Located<Trait>) => rowsHold(t.item.requires, growthHolds(t, activeIn, idx));
  const opens = (t: Located<Trait>) => rowsHold(t.item.requires, (req) => requirementHolds(req, t, activeIn, idx));
  const grow = () => {
    kept = new Set();
    returned = [];
    const join = (t: Located<Trait>, from: 'pick' | 'automatic' | 'cascadeOff') => {
      if (kept.has(keyOf(t)) || excluded.has(keyOf(t)) || (from === 'cascadeOff' && rivalIn(t, kept)) || !grows(t)) return false;
      kept.add(keyOf(t));
      if (from !== 'pick') returned.push(t);
      return true;
    };
    for (let joined = true; joined;) {
      joined = false;
      for (const t of proposed) joined = join(t, 'pick') || joined;
      for (const t of automatic) joined = join(t, 'automatic') || joined;
      for (const t of candidates) joined = join(t, 'cascadeOff') || joined;
    }
  };
  const returners = new Set(candidates.map(keyOf));
  const failing = () => pool.filter((t) => kept.has(keyOf(t)) && !opens(t));
  // Least fixpoint with every Not holding, then the latest kept trait a Not now fails turns off, until none
  // does (Q7, Q28). While only picks and Automatic traits fail, a kept returner goes first (Q30). Each pass
  // excludes one more trait, so the loop ends.
  for (;;) {
    grow();
    const failed = failing();
    if (!failed.length) break;
    const blamed = failed.some((t) => returners.has(keyOf(t))) ? failed
      : pool.filter((t) => returners.has(keyOf(t)) && kept.has(keyOf(t)));
    const off = blamed.length ? blamed : failed;
    excluded.add(keyOf(off[off.length - 1]));
  }
  // Each excluded trait, in proposal order, comes back unless it breaks a trait already on, so settling again
  // changes nothing (Q29). A newcomer that fails, the trait itself included, was off anyway and stays out; one
  // that can't join yet leaves the list and joins once a later return opens it. Each newcomer pass excludes
  // one more trait, so the inner loop ends.
  for (const t of pool) {
    if (!excluded.has(keyOf(t))) continue;
    const before = new Set(kept);
    const saved = [...excluded];
    excluded.delete(keyOf(t));
    for (;;) {
      grow();
      const newcomers = failing().filter((x) => !before.has(keyOf(x)));
      if (!newcomers.length) break;
      for (const x of newcomers) excluded.add(keyOf(x));
    }
    if (failing().length) {
      excluded.clear();
      for (const k of saved) excluded.add(k);
      grow();
    }
  }

  // An id the owner does not hold has no gate to check, so it stays: a save keeps a trait the world has
  // since deleted.
  const off = cascadeOrder(proposed.filter((t) => !kept.has(keyOf(t))), idx, rank);
  const stillWaiting = candidates.filter((t) => !kept.has(keyOf(t)));
  const scopes = [...idx.owners.values()].map((o) => o.owner);
  const active = perScopeOf(scopes, (owner) => [
    ...activeOf(input.active, owner.id).filter((id) => kept.has(key(owner.id, id)) || !idx.owners.get(owner.id)!.traits.has(id)),
    ...returned.filter((t) => t.owner === owner).map((t) => t.item.id),
  ], []);
  const nextCascadeOff = perScopeOf(scopes, (owner) =>
    [...off, ...stillWaiting].filter((t) => t.owner === owner && !isAlwaysOn(t.item)).map((t) => t.item.id), []);
  const ref = (t: Located<Trait>): GateTraitRef => ({ ownerId: t.owner.id, traitId: t.item.id });
  return { active, turnedOff: off.map(ref), returned: returned.map(ref), cascadeOff: nextCascadeOff };
}

/** A group's picks against one owner's active set. Only traits placed directly in the group count. */
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

/** Group id → each scope's pick state, for every group in every scope's tree. */
export function groupPickStates(input: Pick<GateInput, 'global' | 'owners' | 'active'>): Scoped<Map<string, GroupPickState>> {
  const of = (tree: GateTree, ownerId: OwnerId) => {
    const active = activeOf(input.active, ownerId);
    return new Map(tree.groups.map((g) => [g.id, groupPickState(g, tree.traits, active)]));
  };
  return scoped(of(input.global, null), Object.fromEntries(input.owners.map((owner) => [owner.id, of(owner, owner.id)])));
}

/** The input the switch checks read: the trees and the active sets. */
type SwitchInput = Pick<GateInput, 'global' | 'owners' | 'active'>;

/** Whether switching `traitId` on would overfill its group in `ownerId`: the group is full at a max above
 *  one. A max-one group swaps its pick instead. */
export function overfills(input: SwitchInput, ownerId: OwnerId, traitId: string): boolean {
  const owner = gateTreeOf(input, ownerId);
  const groupId = owner?.traits.find((t) => t.id === traitId)?.groupId ?? null;
  const group = owner?.groups.find((g) => g.id === groupId);
  const active = activeOf(input.active, ownerId);
  return !!owner && !!group && group.maxPicks !== 1 && !active.includes(traitId)
    && groupPickState(group, owner.traits, active).full;
}

/** Whether dropping one pick from a group in `picks` leaves it below its minimum. */
export const leavesShort = (picks: GroupPickState): boolean => picks.count - 1 < picks.min;

/** Whether switching `traitId` off would leave its group in `ownerId` below the minimum, including a group
 *  a cascade has already left short. */
export function underfills(input: SwitchInput, ownerId: OwnerId, traitId: string): boolean {
  const owner = gateTreeOf(input, ownerId);
  const groupId = owner?.traits.find((t) => t.id === traitId)?.groupId ?? null;
  const group = owner?.groups.find((g) => g.id === groupId);
  const active = activeOf(input.active, ownerId);
  return !!owner && !!group && active.includes(traitId) && leavesShort(groupPickState(group, owner.traits, active));
}

/** Whether a trait's mode refuses the switch in `ownerId`: the trait is Always On, or switching it on would
 *  retire an active Always On sibling in a max-one group. */
export function modeRefuses(input: SwitchInput, ownerId: OwnerId, traitId: string): boolean {
  const owner = gateTreeOf(input, ownerId);
  const trait = owner?.traits.find((t) => t.id === traitId);
  if (!owner || !trait) return false;
  if (isAlwaysOn(trait)) return true;
  const active = activeOf(input.active, ownerId);
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
  input: GateInput, ownerId: OwnerId, traitId: string, cascadeOff: GateActive = NO_ACTIVE,
): SettleResult | null {
  if (modeRefuses(input, ownerId, traitId)) return null;
  const current = activeOf(input.active, ownerId);
  let next: string[];
  if (current.includes(traitId)) {
    next = current.filter((id) => id !== traitId);
  } else {
    if (gateOf(gateStates(input), ownerId, traitId)?.unlocked === false || overfills(input, ownerId, traitId)) return null;
    const owner = gateTreeOf(input, ownerId);
    const trait = owner?.traits.find((t) => t.id === traitId);
    const retire = new Set(owner && trait ? exclusiveSiblings(trait, owner.traits, owner.groups) : []);
    next = [...current.filter((id) => !retire.has(id)), traitId];
  }
  return settle({ ...input, active: withPart(input.active, ownerId, next) }, cascadeOff);
}

/** Every scope's default traits, capped at each group's max in authored order after the Always On traits
 *  active with no pick, settled so a gated default whose chain has no open root starts unselected. */
export function settleDefaults(input: Omit<GateInput, 'active'>): SettleResult {
  const scopes = gateTrees(input);
  const alwaysOnIn = (active: GateActive): GateActive => perScopeOf(scopes, (owner) =>
    activeOf(active, owner.id).filter((id) => owner.traits.some((t) => t.id === id && isAlwaysOn(t))), []);
  const withDefaults = (alwaysOn: GateActive) => settle({
    ...input,
    active: perScopeOf(scopes, (o) => defaultPicks(o.traits, o.groups, [...activeOf(alwaysOn, o.id)]), []),
  });
  // A default can open an Always On trait that then takes its group's room, so the cap reruns with it counted.
  let alwaysOn = alwaysOnIn(settle({ ...input, active: NO_ACTIVE }).active);
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
 * another. A trait is unlockable when some row's every Condition chains to a trait with no rows in a set it
 * reads, a world persona, or a group holding such a trait. So "A requires B or C, B requires A" passes,
 * because C opens A. The player set follows the input's persona; a "playing as" opens for any persona. Every
 * Not Condition counts as holding, so the check may under-report (Q15).
 */
export function neverUnlockable(input: Omit<GateInput, 'active'>): GateTraitRef[][] {
  const idx = index({ ...input, active: NO_ACTIVE });
  const personas = new Set(input.entities.filter((e) => e.persona).map((e) => e.id));
  const open = new Set<string>();
  const activeIn: ActiveIn = (ownerId, id) => open.has(key(ownerId, id));
  // A stat can move either way in play, so its Condition counts as holding (Q20); the clock reaches any daypart.
  const canHold = (trait: Located<Trait>) => (req: TraitRequirement) => (req.kind === 'stat' ? true
    : req.kind === 'time' ? req.dayparts.length > 0
    : req.kind === 'playingAs' && !req.not ? personas.has(req.id)
      : growthHolds(trait, activeIn, idx)(req));
  const all = [...idx.owners.values()].flatMap((o) => [...o.traits.values()]);
  for (let grew = true; grew;) {
    grew = false;
    for (const t of all) {
      if (open.has(keyOf(t))) continue;
      if (!rowsHold(t.item.requires, canHold(t))) continue;
      open.add(keyOf(t));
      grew = true;
    }
  }

  const rank = authoredRank({ ...input, active: NO_ACTIVE });
  const stuck = byRank(all.filter((t) => !open.has(keyOf(t))), rank);
  const root = new Map(stuck.map((t) => [keyOf(t), keyOf(t)]));
  const find = (k: string): string => (root.get(k) === k ? k : find(root.get(k)!));
  for (const d of stuck) {
    for (const p of stuck) {
      if (p !== d && conditionsOf(d.item.requires).some((req) => metBy(req, d.owner, p, idx))) root.set(find(keyOf(d)), find(keyOf(p)));
    }
  }
  const sets = new Map<string, GateTraitRef[]>();
  for (const t of stuck) {
    const k = find(keyOf(t));
    sets.set(k, [...(sets.get(k) ?? []), { ownerId: t.owner.id, traitId: t.item.id }]);
  }
  return [...sets.values()];
}

/**
 * The sets of traits whose requirements loop through an odd number of Not Conditions, so no state of the
 * loop holds still (Q13, Q32). An even loop, such as two traits that exclude each other, settles by pick
 * order and passes. Each set is a strongly connected part of the requirement graph, in authored order.
 */
export function unstableCycles(input: Omit<GateInput, 'active'>): GateTraitRef[][] {
  const idx = index({ ...input, active: NO_ACTIVE });
  const rank = authoredRank({ ...input, active: NO_ACTIVE });
  const all = byRank([...idx.owners.values()].flatMap((o) => [...o.traits.values()]), rank);
  // The trait itself and its exclusive siblings in its own tree never count (Q26), so they add no edge.
  const own = (d: Located<Trait>, p: Located<Trait>) => p.owner.id === d.owner.id
    && (p.item.id === d.item.id || !!idx.owners.get(d.owner.id)?.rivals.get(d.item.id)?.has(p.item.id));
  const edges = new Map(all.map((d) => [keyOf(d), conditionsOf(d.item.requires).flatMap((req) =>
    targetsOf(req, d.owner, idx).filter((p) => !own(d, p)).map((p) => ({ to: keyOf(p), not: !!req.not })))]));

  // Tarjan's strongly connected components.
  const order = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const parts: string[][] = [];
  const visit = (k: string) => {
    order.set(k, order.size);
    low.set(k, order.get(k)!);
    stack.push(k);
    onStack.add(k);
    for (const { to } of edges.get(k)!) {
      if (!order.has(to)) {
        visit(to);
        low.set(k, Math.min(low.get(k)!, low.get(to)!));
      } else if (onStack.has(to)) {
        low.set(k, Math.min(low.get(k)!, order.get(to)!));
      }
    }
    if (low.get(k) !== order.get(k)) return;
    const part: string[] = [];
    for (let top = ''; top !== k;) {
      top = stack.pop()!;
      onStack.delete(top);
      part.push(top);
    }
    parts.push(part);
  };
  for (const t of all) if (!order.has(keyOf(t))) visit(keyOf(t));

  // A part holds an odd loop exactly when no Not parity can be given to its traits that every edge keeps.
  const odd = (part: string[]): boolean => {
    const inPart = new Set(part);
    const parity = new Map([[part[0], false]]);
    const queue = [part[0]];
    while (queue.length) {
      const k = queue.shift()!;
      for (const { to, not } of edges.get(k)!) {
        if (!inPart.has(to)) continue;
        const want = parity.get(k)! !== not;
        if (!parity.has(to)) {
          parity.set(to, want);
          queue.push(to);
        } else if (parity.get(to) !== want) {
          return true;
        }
      }
    }
    return false;
  };
  const byKey = new Map(all.map((t) => [keyOf(t), t]));
  return parts.filter(odd)
    .map((part) => byRank(part.map((k) => byKey.get(k)!), rank).map((t) => ({ ownerId: t.owner.id, traitId: t.item.id })))
    .sort((a, b) => (rank.get(key(a[0].ownerId, a[0].traitId)) ?? 0) - (rank.get(key(b[0].ownerId, b[0].traitId)) ?? 0));
}

/** A Requirement Row by its position in its trait's gate. */
export interface RowRef extends GateTraitRef {
  row: number;
}

/**
 * Every row that can never hold: it names one target both plain and Not, or a trait plain and a group above it
 * Not, under the same owner (Q14, Q34), or two time Conditions with no daypart in common. The group reads the
 * owner's own tree, as the gate does.
 */
export function deadRows(input: Omit<GateInput, 'active'>): RowRef[] {
  const idx = index({ ...input, active: NO_ACTIVE });
  // Two Conditions share an owner set when they read the same owners, however each names them.
  const sameOwners = (a: ReadonlySet<OwnerId>, b: ReadonlySet<OwnerId>) => a.size === b.size && [...a].every((id) => b.has(id));
  // A stat Condition is satisfiable both ways, so it clashes with nothing (Q20). Two time Conditions clash
  // when they share no daypart.
  const clash = (owner: GateScopeTree) => (plain: TraitRequirement, not: TraitRequirement): boolean => {
    if (plain.kind === 'time' && not.kind === 'time') return !plain.dayparts.some((d) => not.dayparts.includes(d));
    if (plain.not || !not.not || plain.kind === 'stat' || not.kind === 'stat' || plain.kind === 'time') return false;
    if (plain.kind === 'playingAs' || not.kind === 'playingAs') return plain.kind === not.kind && plain.id === not.id;
    const set = idx.ownerSet(plain, owner);
    if (!sameOwners(set, idx.ownerSet(not, owner))) return false;
    if (plain.kind === not.kind && plain.id === not.id) return true;
    return plain.kind === 'trait' && not.kind === 'group' && idx.traitsBelow(set, not.id).includes(plain.id);
  };
  return gateTrees(input).flatMap((owner) => owner.traits.flatMap((trait) => (trait.requires ?? []).flatMap((row, i) =>
    (row.all.some((a) => row.all.some((b) => clash(owner)(a, b))) ? [{ ownerId: owner.id, traitId: trait.id, row: i }] : []))));
}

/** A group whose Always On traits can be on together past its max, on one scope. */
export interface AlwaysOnOverflow {
  ownerId: OwnerId;
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
  const idx = index({ ...input, active: NO_ACTIVE });
  const rank = authoredRank({ ...input, active: NO_ACTIVE });
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
 *  every Condition of some row, prerequisites first, and never picks two max-one rivals. */
function opensTogether(targets: Located<Trait>[], idx: Index, stuck: ReadonlySet<string>, budget: { left: number }): boolean {
  const picked = new Set<string>();
  const pending = new Set<string>();
  const clashes = (t: Located<Trait>) =>
    [...(idx.owners.get(t.owner.id)?.rivals.get(t.item.id) ?? [])].some((id) => picked.has(key(t.owner.id, id)));
  const satisfiers = (req: Targeted, t: Located<Trait>): Located<Trait>[] => {
    const set = idx.ownerSet(req, t.owner);
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
    // Each Condition of a row opens in turn before the next; the trait itself joins after the last. A Not
    // Condition, a stat Condition and a time Condition count as met, as in `neverUnlockable`.
    const meet = (req: TraitRequirement, then: () => boolean) => (req.not || req.kind === 'stat' || req.kind === 'time' ? then() : req.kind === 'playingAs'
      ? idx.persona.source === 'world' && idx.persona.entityId === req.id && then()
      : satisfiers(req, t).some((s) => open(s, then)));
    const rows = t.item.requires ?? [];
    const ok = rows.length === 0
      ? finish()
      : rows.some((row) => row.all.reduceRight<() => boolean>((then, req) => () => meet(req, then), finish)());
    pending.delete(k);
    return ok;
  };
  return targets.reduceRight<() => boolean>((then, t) => () => open(t, then), () => true)();
}

/** An owner the picker can name for a target, with the name its row shows. */
export interface RequirementOwnerOption {
  owner: RequirementOwner;
  name: string;
}

/** One row of the requirement picker: what it adds, how the chip reads, and where the target lives. */
export interface RequirementOption {
  requirement: TraitRequirement;
  label: string;
  /** The owner, when not the world, then the group path. `World` for a top-level world item. */
  breadcrumb: string[];
  /** The owners the row can name instead of the same owner: You, then every entity that owns the target. None
   *  for a global target. */
  owners: RequirementOwnerOption[];
  /** The entity whose tree holds the target; absent for the world. */
  home?: { id: string; name: string };
}

export interface RequirementOptions {
  traits: RequirementOption[];
  groups: RequirementOption[];
  personas: RequirementOption[];
}

/** `requirement` scoped to `owner`; the same owner when `owner` is absent. */
export const withRequirementOwner = (requirement: TraitRequirement, owner?: RequirementOwner): TraitRequirement =>
  (requirement.kind === 'playingAs' || requirement.kind === 'time' || !owner ? requirement : { ...requirement, owner });

/**
 * Every requirement an author can give `traitId`, each target once, in tree order per owner. The trait
 * itself, its exclusive siblings, and a group holding only those are left out, because none of them can
 * ever hold it up.
 */
export function requirementOptions(input: Omit<GateInput, 'active' | 'persona'>, traitId: string): RequirementOptions {
  const idx = index({ ...input, active: NO_ACTIVE, persona: { source: 'none' } });
  const fromId = ownerHolding(input, traitId)?.id ?? null;
  const skip = new Set([traitId, ...(idx.owners.get(fromId)?.rivals.get(traitId) ?? [])]);
  const everyOwner = new Set(idx.owners.keys());
  // A group whose every trait is skipped can never hold; an empty one still can, once it gains a trait.
  const deadGroup = (groupId: string) => {
    const ids = idx.traitsBelow(everyOwner, groupId);
    return ids.length > 0 && ids.every((id) => skip.has(id));
  };
  const breadcrumbOf = (owner: GateScopeTree, groupId: string | null | undefined): string[] => {
    const path: string[] = [];
    for (let id = groupId ?? null, seen = 0; id && seen < owner.groups.length; seen++) {
      const group = owner.groups.find((g) => g.id === id);
      if (!group) break;
      path.unshift(group.name);
      id = group.parentId;
    }
    if (owner.id !== null) path.unshift(owner.name);
    return path.length > 0 ? path : [...WORLD_BREADCRUMB];
  };
  // A global item reads global scope whoever is named (Q10), so it offers no owner.
  const ownersOf = (id: string, kind: 'trait' | 'group'): RequirementOwnerOption[] => ((kind === 'trait' ? idx.global.traits : idx.global.groups).has(id) ? [] : [
    { owner: { kind: 'you' }, name: 'Persona' },
    ...input.owners
      .filter((o) => (kind === 'trait' ? o.traits : o.groups).some((item) => item.id === id))
      .map((o): RequirementOwnerOption => ({ owner: { kind: 'entity', id: o.id, name: o.name }, name: o.name })),
  ]);
  const option = (requirement: TraitRequirement, breadcrumb: string[], owners: RequirementOwnerOption[] = [], owner?: GateScopeTree): RequirementOption =>
    ({
      requirement, label: requirementText(requirement, idx).text, breadcrumb, owners,
      ...(owner?.id != null ? { home: { id: owner.id, name: owner.name } } : {}),
    });

  const seen = new Set<string>();
  const traits: RequirementOption[] = [];
  const groups: RequirementOption[] = [];
  for (const owner of gateTrees(input)) {
    for (const node of flattenTree(buildTree(owner.groups, owner.traits))) {
      const id = node.leaf?.id ?? node.group?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (node.leaf && !skip.has(id)) traits.push(option({ kind: 'trait', id }, breadcrumbOf(owner, node.leaf.groupId), ownersOf(id, 'trait'), owner));
      if (node.group && !deadGroup(id)) groups.push(option({ kind: 'group', id }, breadcrumbOf(owner, node.group.parentId), ownersOf(id, 'group'), owner));
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
  global: { traits: world.traits, groups: world.groups },
  owners: [],
  active: scoped(active),
  entities: world.entities,
  persona,
  originals: { traits: world.traits, groups: world.groups },
});
