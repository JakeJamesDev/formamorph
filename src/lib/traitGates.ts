// Trait gates: what a requirement list unlocks, and what a selection settles to. Every owner gates on its
// own active set. A Condition reads the owner it names when that owner holds the target, else global scope
// for a global target (Q10, Q29).

import type {
  Daypart, ItemInstance, ItemRequirement, OptionRequirement, PersonaRef, RequirementOwner, StatComparison, StatRequirement, TimeRequirement, Trait, TraitGroup, TraitRequirement, TraitRequirementRow, WeatherKind, WeatherRequirement, OpeningRequirement,
  SlotRule, ValuedWorldOption, WorldOption, WorldOptionValues,
} from '@/types';
import { DAYPARTS, OPENING_DAYPART } from './gameClock';
import { ALL_WEATHER_KINDS, weatherKindsText, weatherText } from './weather';
import { isDrawnOpening, openingKeyId, openingLabelMap, openingNames, openingText } from './openingCondition';
import type { OpeningKey } from './drawnOpening';
import type { OpeningPickGroup } from './testBench/openingPick';
import { defaultPicks, exclusiveSiblings, isAlwaysOn, isHidden, traitOrderIndex } from './traitEffects';
// The generic tree, not traitTree: that module reads the owner resolver, which reads this one.
import { buildTree, flattenTree } from './groupTree';
import { blueprintsSubtreeIds } from './blueprintGroups';
import { conditionsOf, rowsHold } from './requirementRows';
import { optionDefault, optionValue, valuedOptions } from './worldOptions';
import { faceName, isUnidentified, itemHasUnidentifiedFace, stateKey, stateTextKey } from './items';
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

/** An authored item as a Condition reads it. `slotRule` marks an item that can be equipped. */
export interface GateItem {
  id: string;
  name: string;
  slotRule?: SlotRule;
  unidentifiedName?: string;
  unidentifiedDescription?: string;
}

export interface GateInput {
  /** Global scope's tree: the traits and groups no one owns. */
  global: GateTree;
  /** Every present entity owner. */
  owners: readonly GateOwner[];
  active: GateActive;
  /** Absent, every stat Condition is unresolved. */
  stats?: GateStats;
  /** Setup only: the stats a game starts with under a set of picks (Q26). Present, a trait's gate reads the
   *  stats of the picks around it, its own left out, and the settle grows them from the ground up. */
  statsOf?: (active: GateActive) => GateStats;
  /** Play only: `stats` with one held trait's own contribution taken out, which that trait's gate reads (Q32). */
  statsWithout?: (ownerId: OwnerId, traitId: string) => GateStats;
  /** The story clock's daypart, which a time Condition reads. Absent, the opening hour's: what authoring
   *  lenses read. */
  daypart?: Daypart;
  /** The World Weather, which a weather Condition reads. Absent, Clear: authoring reads the Default Weather it is given. */
  weather?: WeatherKind;
  /** The kinds a weather Condition can pick, Clear first. Present only while the world's weather can change: absent, the editor offers none. */
  weatherKinds?: readonly WeatherKind[];
  /** The Drawn Opening, resolved against the cast, which an Opening Condition reads. Absent or null, none. */
  opening?: OpeningKey | null;
  /** Every Opening an Opening Condition can name, grouped by owner. Present only outside play: absent, the editor
   *  offers none and no listed key reads as missing. */
  openings?: readonly OpeningPickGroup[];
  entities: readonly GateEntity[];
  persona: PersonaRef;
  /** Every world trait and group a requirement can name, whether or not a present owner holds it. Absent,
   *  only the owners' items resolve. */
  originals?: { traits: readonly Trait[]; groups: readonly TraitGroup[] };
  /** Every Item Instance in play, hidden ones included (Q63). Absent, no one owns anything. */
  itemInstances?: readonly ItemInstance[];
  /** Every authored item an item Condition can name. Absent, every item Condition is unresolved. */
  worldItems?: readonly GateItem[];
  /** The traits item grants hold (Q52): `only` the active ones no pick holds, which count toward no Pick
   *  Count; `waiting` the ones whose gate fails, which join when it holds. Absent, none. */
  grants?: { only: GateActive; waiting: GateActive };
  /** The world's Options, which an Option Condition reads. Absent, every Option Condition is unresolved. */
  worldOptions?: readonly WorldOption[];
  /** The playthrough's Option values. Absent, or missing an id, the Option's default (Q25). */
  optionValues?: WorldOptionValues;
  /** Who reads the Condition clauses. The player's say "you" for the played persona (Q18). Absent, the author. */
  reader?: 'author' | 'player';
}

/** One Condition's state against the active sets. */
export interface ConditionState {
  /** The chip text, for author tools. */
  text: string;
  /** The Condition as a clause in the reader's view, which the gate line joins (Q18). */
  clause: string;
  holds: boolean;
  unresolved: boolean;
  /** The target is a Hidden trait, a hidden or inert stat, or a hidden Option, so player-facing lines leave
   *  it out (Q14, Q21, Q11). */
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

/** The owner a requirement names; absent for the same owner, "playing as" and an Option. */
export const requirementOwnerOf = (req: TraitRequirement): RequirementOwner | undefined =>
  (req.kind === 'playingAs' || req.kind === 'option' ? undefined : req.owner);

/** One key per owner choice, so two requirements compare by it. */
export const requirementOwnerKey = (owner?: RequirementOwner): string =>
  (owner === undefined ? 'same' : owner.kind === 'you' ? 'you' : `entity:${owner.id}`);

/** The State word an item Condition requires as stacking compares it: trimmed and lower case, empty for none (Q31). */
const itemStateKey = (req: ItemRequirement): string => stateTextKey(req.state);

/** The dayparts a time Condition holds in, Not folded in. An empty list holds in none, Not or not. */
export const heldDayparts = (req: TimeRequirement): Daypart[] =>
  (req.dayparts.length ? DAYPARTS.filter((d) => req.dayparts.includes(d) !== !!req.not) : []);

/** The kinds a weather Condition holds under, Not folded in over every kind. An empty list holds under none. */
export const heldWeatherKinds = (req: WeatherRequirement): WeatherKind[] =>
  (req.kinds.length ? ALL_WEATHER_KINDS.filter((k) => req.kinds.includes(k) !== !!req.not) : []);

const sameKinds = (a: WeatherRequirement, b: WeatherRequirement): boolean => heldWeatherKinds(a).join() === heldWeatherKinds(b).join();

/** Whether the Drawn Opening `drawn` is one of the Condition's Openings, Not folded in. An empty list holds never. */
export const openingHolds = (req: OpeningRequirement, drawn: OpeningKey | null | undefined): boolean =>
  req.openings.length > 0 && req.openings.some((key) => isDrawnOpening(key, drawn)) !== !!req.not;

/** Whether two Opening Conditions list the same Openings, in any order. */
const sameOpenings = (a: OpeningRequirement, b: OpeningRequirement): boolean =>
  a.openings.length === b.openings.length && a.openings.every((key) => b.openings.some((other) => openingKeyId(key) === openingKeyId(other)));

const sameDayparts = (a: TimeRequirement, b: TimeRequirement): boolean => heldDayparts(a).join() === heldDayparts(b).join();

/** Whether two requirements add the same gate: the same target under the same owner, both plain or both Not,
 *  for a stat the same comparison, and for a time or weather the same held set, however Not writes it. */
export const sameRequirement = (a: TraitRequirement, b: TraitRequirement): boolean =>
  a.kind === b.kind && a.id === b.id && requirementOwnerKey(requirementOwnerOf(a)) === requirementOwnerKey(requirementOwnerOf(b))
  && (a.kind === 'time' || a.kind === 'weather' || !a.not === !b.not)
  && (a.kind !== 'stat' || (b.kind === 'stat' && a.operator === b.operator && a.value === b.value && a.unit === b.unit))
  && (a.kind !== 'item' || (b.kind === 'item' && a.status === b.status && itemStateKey(a) === itemStateKey(b) && a.identity === b.identity))
  && (a.kind !== 'time' || (b.kind === 'time' && sameDayparts(a, b)))
  && (a.kind !== 'weather' || (b.kind === 'weather' && sameKinds(a, b)))
  && (a.kind !== 'opening' || (b.kind === 'opening' && sameOpenings(a, b)))
  && (a.kind !== 'option' || (b.kind === 'option' && a.valueId === b.valueId && a.operator === b.operator && a.value === b.value));

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
  // Picks move values, never which stats exist, so any set names them.
  const stats = input.stats ?? input.statsOf?.(NO_ACTIVE);
  const global = globalItems(input);
  const holds = (ownerId: OwnerId, req: Targeted): boolean => (req.kind === 'item' ? false
    : req.kind === 'stat' ? !!statsIn(stats, ownerId)?.[req.id]
    : !!owners.get(ownerId)?.[req.kind === 'trait' ? 'traits' : 'groups'].has(req.id));
  const isGlobal = (req: Targeted): boolean => (req.kind === 'item' ? false : req.kind === 'stat' ? !!stats?.global[req.id]
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
  const itemNames = new Map((input.worldItems ?? []).map((item) => [item.id, item.name]));
  /** The instances of the item an item Condition on `from` names, held by its owner. */
  const instancesOf = (req: ItemRequirement, from: GateScopeTree): ItemInstance[] => {
    const owner: RequirementOwner = req.owner ?? (from.id === null ? { kind: 'you' } : { kind: 'entity', id: from.id });
    const ids = owner.kind === 'you' ? played : [owner.id];
    const you = owner.kind === 'you' || ids.some((id) => played.includes(id));
    return (input.itemInstances ?? []).filter((instance) => instance.item.kind === 'item' && instance.item.itemId === req.id && instance.quantity > 0
      && (instance.where.kind === 'you' ? you : instance.where.kind === 'entity' && ids.includes(instance.where.id)));
  };
  /** Whether an item Condition on `from` holds before Not: one instance of its owner matches the status, the State
   *  word and the identity together. An owner-less one on global scope reads the persona (Q88); a played entity
   *  reads the instances of `you` (Q54, Q90). */
  const itemHeld = (req: ItemRequirement, from: GateScopeTree, visibleOnly = false): boolean => {
    const state = itemStateKey(req);
    return instancesOf(req, from).some((instance) => (!visibleOnly || instance.visibility === 'visible') && (req.status === 'owned' || !!instance.equipped)
      && (!state || stateKey(instance) === state)
      && (req.identity === undefined || isUnidentified(instance) === (req.identity === 'unidentified')));
  };
  const worldItem = new Map((input.worldItems ?? []).map((item) => [item.id, item]));
  /** The name the player's text gives a required item: its unidentified face while its owner holds no visible
   *  identified instance (Q45). `from` absent, the owner is unknown and the true name reads. */
  const itemNameFor = (req: ItemRequirement, from?: GateScopeTree): string | undefined => {
    const item = worldItem.get(req.id);
    if (!item) return undefined;
    const showUnidentified = input.reader === 'player' && from && itemHasUnidentifiedFace(item)
      && !instancesOf(req, from).some((instance) => instance.visibility === 'visible' && !isUnidentified(instance));
    return faceName(item, !!showUnidentified);
  };
  const statNames = new Map<string, string>();
  for (const [, set] of stats ? scopedEntries(stats) : []) {
    for (const [id, stat] of Object.entries(set)) if (!statNames.has(id)) statNames.set(id, stat.name);
  }
  /** The stat a stat Condition on `from` reads in `read`: the first scope of the id in its owner set. Null when
   *  no scope in the set has it. */
  const statOf = (req: StatRequirement, from: GateScopeTree, read: GateStats | undefined = stats): GateStat | null => {
    for (const ownerId of ownerSet(req, from)) {
      const stat = statsIn(read, ownerId)?.[req.id];
      if (stat) return stat;
    }
    return null;
  };
  const options = new Map(valuedOptions(input.worldOptions).map((option) => [option.id, option]));
  return {
    owners, traitNames, groupNames, hiddenTraits, statNames, entities, global, isGlobal, ownerSet, traitsBelow, statOf, itemNames, itemNameFor, itemHeld, persona: input.persona, played, reader: input.reader, globalTree: globalScopeTree(input.global),
    daypart: input.daypart ?? OPENING_DAYPART, weather: input.weather ?? 'clear', options, optionValues: input.optionValues,
    opening: input.opening ?? null, openingLabels: input.openings && openingLabelMap(input.openings),
  };
}

/** A Condition that names a trait, a group or a stat. */
type Targeted = Exclude<TraitRequirement, { kind: 'playingAs' } | TimeRequirement | WeatherRequirement | OpeningRequirement | OptionRequirement>;

/** A Condition whose target is a trait, a group or a persona: one an active set or the persona decides. */
type Switched = Exclude<TraitRequirement, StatRequirement | TimeRequirement | WeatherRequirement | OpeningRequirement | ItemRequirement | OptionRequirement>;

/** A Condition that reads no active set: its Not evaluates directly, never through a target that resolves. */
const readsNoSet = (req: TraitRequirement): boolean =>
  req.kind === 'stat' || req.kind === 'item' || req.kind === 'option' || req.kind === 'time' || req.kind === 'weather' || req.kind === 'opening';

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
 *  never count (Q26); another owner's instance of a sibling does. */
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
function statHolds(req: StatRequirement, from: GateScopeTree, idx: Index, read?: GateStats): boolean {
  const stat = idx.statOf(req, from, read);
  if (!stat || stat.inert) return false;
  return compares(statReading(stat, req.unit), req.operator, req.value) !== !!req.not;
}

/** The Option an Option Condition names, when its fields fit the Option's type and its value exists. */
function fittedOption(req: OptionRequirement, idx: Index): ValuedWorldOption | null {
  const option = idx.options.get(req.id);
  if (!option) return null;
  switch (option.type) {
    case 'choice': return req.operator === undefined && !!req.valueId && option.values.some((v) => v.id === req.valueId) ? option : null;
    case 'boolean': return req.operator === undefined && req.valueId === undefined ? option : null;
    case 'number': return req.operator !== undefined && typeof req.value === 'number' && !req.not && req.valueId === undefined ? option : null;
  }
}

/** Whether no value of one Option meets both Conditions: a choice's two plain values, or one value or boolean
 *  both plain and Not. Number comparisons are left alone, as a stat's are. */
const optionsClash = (a: OptionRequirement, b: OptionRequirement): boolean => {
  if (a.id !== b.id || a.operator !== undefined || b.operator !== undefined) return false;
  if (a.valueId !== b.valueId) return !a.not && !b.not && a.valueId !== undefined && b.valueId !== undefined;
  return !a.not !== !b.not;
};

/** Whether an Option Condition holds: a choice holds its value and a boolean is on, Not flipping either; a
 *  number compares. An unfitted one never holds. */
function optionHolds(req: OptionRequirement, idx: Index): boolean {
  const option = fittedOption(req, idx);
  if (!option) return false;
  const value = optionValue(option, idx.optionValues);
  if (option.type === 'number') return compares(Number(value), req.operator!, req.value!);
  return (option.type === 'choice' ? value === req.valueId : value === true) !== !!req.not;
}

/** Whether one Condition holds for `trait` against `activeIn`, a stat one in `read`: its target is on, or off
 *  under Not. */
function requirementHolds(req: TraitRequirement, trait: Located<{ id: string }>, activeIn: ActiveIn, idx: Index, read?: GateStats): boolean {
  if (req.kind === 'stat') return statHolds(req, trait.owner, idx, read);
  if (req.kind === 'option') return optionHolds(req, idx);
  if (req.kind === 'time') return heldDayparts(req).includes(idx.daypart);
  if (req.kind === 'weather') return heldWeatherKinds(req).includes(idx.weather);
  if (req.kind === 'opening') return openingHolds(req, idx.opening);
  // Like a stat, an item that is gone or an owner that is gone never holds, Not included.
  if (req.kind === 'item') {
    return idx.itemNames.has(req.id) && (!req.owner || ownerName(req.owner, idx) !== null)
      && idx.itemHeld(req, trait.owner) !== !!req.not;
  }
  return req.not ? !targetOn(req, trait, activeIn, idx) : targetOn(req, trait, activeIn, idx);
}

/** The Condition test for positive growth: every Not Condition on a target that exists holds, so growth stays
 *  monotone and a Condition whose target is gone never holds (Q27). A stat Condition reads no active set, so
 *  it evaluates directly. */
const growthHolds = (trait: Located<Trait>, activeIn: ActiveIn, idx: Index, read?: () => GateStats | undefined) => (req: TraitRequirement): boolean =>
  (req.not && !readsNoSet(req) ? resolves(req as Switched, idx) : requirementHolds(req, trait, activeIn, idx, req.kind === 'stat' ? read?.() : undefined));

/** The owner's name as chip text reads it, or null when the named entity is gone. The persona owner reads "Persona". */
function ownerName(owner: RequirementOwner, idx: Index): { name: string } | null {
  if (owner.kind === 'you') return { name: 'Persona' };
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
export const statTail = (req: StatRequirement): string => `${req.operator} ${statValue(req)}`;

/** A stat Condition's number, with `%` under percent. */
const statValue = (req: StatRequirement): string => `${req.value}${req.unit === 'percent' ? '%' : ''}`;

const DAYPARTS_OR = new Intl.ListFormat('en', { type: 'disjunction' });

/** A time Condition's dayparts in words, from the first one after a daypart it leaves out, so a stretch across
 *  midnight reads in order: "evening or night", "not night" under Not. */
export function timeText(req: TimeRequirement): string {
  if (!req.dayparts.length) return 'no time of day';
  const text = daypartsInOrder(req);
  return req.not ? `not ${text}` : text;
}

/** A time Condition's dayparts joined by "or", starting after a daypart it leaves out. */
function daypartsInOrder(req: TimeRequirement): string {
  const on = (i: number) => req.dayparts.includes(DAYPARTS[(i + DAYPARTS.length) % DAYPARTS.length]);
  const start = Math.max(0, DAYPARTS.findIndex((_, i) => on(i) && !on(i - 1)));
  return DAYPARTS_OR.format([...DAYPARTS.slice(start), ...DAYPARTS.slice(0, start)].filter((d) => req.dayparts.includes(d)));
}

/** An item Condition's State and identity checks, in parentheses after the name: " (lit, unidentified)" (Q46). */
export const itemChecks = (req: ItemRequirement): string => {
  const parts = [req.state?.trim(), req.identity].filter(Boolean);
  return parts.length ? ` (${parts.join(', ')})` : '';
};

/** What follows a number Option's name: the operator, then the number. */
export const optionNumberTail = (req: OptionRequirement): string => `${req.operator ?? '='} ${req.value ?? 0}`;

/** "Reply Length is Short", "Reply Length is not Short", "Lanterns Lit is on", "Heat >= 3". Names come from
 *  the world, else the stored ones. */
function optionText(req: OptionRequirement, idx: Index): { text: string; unresolved: boolean } {
  const option = idx.options.get(req.id);
  const name = option?.name ?? req.name ?? 'a missing World Option';
  const unresolved = !fittedOption(req, idx);
  const type = option?.type ?? (req.operator !== undefined ? 'number' : req.valueId !== undefined ? 'choice' : 'boolean');
  if (type === 'number') return { text: `${name} ${optionNumberTail(req)}`, unresolved };
  if (type === 'boolean') return { text: `${name} is ${req.not ? 'off' : 'on'}`, unresolved };
  const valueName = (option?.type === 'choice' ? option.values.find((v) => v.id === req.valueId)?.name : undefined) ?? req.valueName ?? 'a missing value';
  return { text: `${name} is ${req.not ? 'not ' : ''}${valueName}`, unresolved };
}

/** "Paladin", "not any Class", "Ash: not Tamed" (Q11). */
function requirementText(req: TraitRequirement, idx: Index, from?: GateScopeTree): { text: string; unresolved: boolean } {
  if (req.kind === 'time') return { text: timeText(req), unresolved: !req.dayparts.length };
  if (req.kind === 'weather') return { text: weatherText(req), unresolved: !req.kinds.length };
  if (req.kind === 'opening') return openingText(req, idx.openingLabels);
  if (req.kind === 'option') return optionText(req, idx);
  const not = req.not ? 'not ' : '';
  if (req.kind === 'playingAs') {
    const entity = idx.entities.get(req.id);
    return entity
      ? { text: `${not}playing as ${entity.name}`, unresolved: false }
      : { text: `${not}playing as ${req.name ?? 'a missing persona'}`, unresolved: true };
  }
  const named = req.kind === 'item'
    ? (idx.itemNames.has(req.id)
      ? { text: `${req.status === 'owned' ? 'owning' : 'equipping'} ${idx.itemNameFor(req, from)!}${itemChecks(req)}`, unresolved: false }
      : { text: `${req.status === 'owned' ? 'owning' : 'equipping'} ${req.name ?? 'a missing item'}${itemChecks(req)}`, unresolved: true })
    : req.kind === 'trait'
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
    ? { text: `${owner.name}: ${target.text}`, unresolved: target.unresolved }
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

/** What a clause part is. `subject` is an owner; `word` is fixed text, such as "It" or "is active". */
export type ClauseRole = 'subject' | 'verb' | 'target' | 'comparison' | 'value' | 'checks' | 'set' | 'word';

/** One part of a clause. `broken` marks what an unresolved Condition lacks; `attach` joins with no space ("'s"). */
export interface ClausePart {
  role: ClauseRole;
  text: string;
  broken?: true;
  attach?: true;
}

/** The record a Condition with no owner sits on. An entity's id lets a Condition on global scope drop its subject (Q25). */
export type ClauseHost = { kind: 'entity'; id?: string; name?: string } | { kind: 'world' } | { kind: 'persona' };

export interface ClauseView {
  /** Default: an entity with no name. */
  host?: ClauseHost;
  /** The clause opens a sentence: its first fixed word takes a capital, names keep their case. */
  sentenceStart?: boolean;
}

const COMPARISON_WORDS: Record<StatComparison, string> = {
  '>': 'above', '<': 'below', '>=': 'at least', '<=': 'at most', '=': 'exactly', '≠': 'different from',
};

/** Who a clause is about. `fixed` marks our own words ("the player"), which a sentence start capitalizes. */
type ClauseSubject = { kind: 'you' } | { kind: 'named'; text: string; fixed: boolean; broken: boolean } | { kind: 'none' };

/** Verbs by kind: the author's third person, then the player's second person for "you". */
const VERBS = {
  trait: [['has', "doesn't have"], ['have', "don't have"]],
  group: [['has a trait in', 'has no trait in'], ['have a trait in', 'have no trait in']],
  owned: [['owns', "doesn't own"], ['own', "don't own"]],
  equipped: [['has equipped', "doesn't have equipped"], ['have equipped', "don't have equipped"]],
  playingAs: [['is', 'is not'], ['are', 'are not']],
} as const;

const part = (role: ClauseRole, text: string, broken = false): ClausePart => (broken ? { role, text, broken: true } : { role, text });
const word = (text: string): ClausePart => part('word', text);
const isVerb = (not?: true): ClausePart => part('verb', not ? 'is not' : 'is');

/** A clause's parts, and whether the first is fixed text a sentence start capitalizes. */
interface Built { parts: ClausePart[]; fixedStart: boolean }

/**
 * A reader for any Condition's clause as ordered parts, in the input's reader's view (Q18, Q20). Joined by
 * {@link clauseText}, the parts are the plain clause.
 */
export function conditionClauses(input: Omit<GateInput, 'active' | 'persona'> & { persona?: PersonaRef }): ClauseReader {
  return clausesOf(index({ ...input, active: NO_ACTIVE, persona: input.persona ?? { source: 'none' } }));
}

type ClauseReader = (req: TraitRequirement, view?: ClauseView) => ClausePart[];

const clauseReaders = new WeakMap<Index, ClauseReader>();

/** The clause reader for an index, built once. */
function clausesOf(idx: Index): ClauseReader {
  let reader = clauseReaders.get(idx);
  if (!reader) clauseReaders.set(idx, reader = buildClauseReader(idx));
  return reader;
}

/** The host a Condition on `owner`'s scope sits on. */
const hostOf = (owner: GateScopeTree): ClauseHost => (owner.id === null ? { kind: 'world' } : { kind: 'entity', id: owner.id, name: owner.name });

function buildClauseReader(idx: Index): ClauseReader {
  const player = idx.reader === 'player';
  /** Whether the player's view reads `id` as "you". */
  const isPlayed = (id: string): boolean => player && idx.played.includes(id);
  const verb = (forms: readonly (readonly [string, string])[], you: boolean, not?: true) => part('verb', forms[you && player ? 1 : 0][not ? 1 : 0]);

  /** The scope a Condition on `host` reads from; null for an entity with no id. */
  const fromOf = (host: ClauseHost): GateScopeTree | null => {
    if (host.kind === 'world' || host.kind === 'persona') return idx.globalTree;
    if (host.id === undefined) return null;
    return idx.owners.get(host.id)?.owner ?? { id: host.id, name: host.name ?? '', traits: [], groups: [] };
  };

  const subjectOf = (req: Targeted, host: ClauseHost, from: GateScopeTree | null): ClauseSubject => {
    const owner = req.owner ?? (host.kind === 'persona' || (host.kind === 'world' && req.kind === 'item') ? { kind: 'you' as const } : undefined);
    if (owner?.kind === 'you') return player ? { kind: 'you' } : { kind: 'named', text: 'the player', fixed: true, broken: false };
    // The player's view says "you" for any owner that is the played entity (Q18).
    if (owner && isPlayed(owner.id)) return { kind: 'you' };
    if (owner) {
      const named = ownerName(owner, idx);
      return named
        ? { kind: 'named', text: named.name, fixed: false, broken: false }
        : { kind: 'named', text: owner.name || 'a missing entity', fixed: false, broken: !idx.isGlobal(req) };
    }
    if (req.kind !== 'item' && from && idx.ownerSet(req, from).has(null)) {
      // A Condition on a world trait, group or stat has no subject in either view (Q25).
      return { kind: 'none' };
    }
    if (host.kind === 'entity' && host.id !== undefined && isPlayed(host.id)) return { kind: 'you' };
    const name = host.kind === 'entity' ? host.name : undefined;
    return name ? { kind: 'named', text: name, fixed: false, broken: false } : { kind: 'named', text: 'this entity', fixed: true, broken: false };
  };

  const subjectParts = (subject: ClauseSubject, possessive = false): ClausePart[] => {
    if (subject.kind === 'none') return [];
    if (subject.kind === 'you') return [part('subject', possessive ? 'your' : 'you')];
    const owner = part('subject', subject.text, subject.broken);
    return possessive ? [owner, { role: 'word', text: "'s", attach: true }] : [owner];
  };

  const build = (req: TraitRequirement, host: ClauseHost): Built => {
    switch (req.kind) {
      case 'time':
        return { fixedStart: true, parts: [word('it'), isVerb(req.not), req.dayparts.length ? part('set', daypartsInOrder(req)) : part('set', 'pick a time', true)] };
      case 'weather':
        return { fixedStart: true, parts: [word('the weather'), isVerb(req.not), req.kinds.length ? part('set', weatherKindsText(req.kinds)) : part('set', 'pick the weather', true)] };
      case 'opening': {
        const labels = idx.openingLabels;
        const set = !req.openings.length ? part('set', 'pick an opening', true)
          : labels ? part('set', openingNames(req, labels), req.openings.some((key) => !labels.has(openingKeyId(key))))
            : part('set', req.openings.length > 1 ? `one of ${req.openings.length} openings` : 'an opening');
        return { fixedStart: true, parts: [word('the opening'), isVerb(req.not), set] };
      }
      case 'option': return { fixedStart: false, parts: optionClause(req) };
      case 'playingAs': {
        const entity = idx.entities.get(req.id);
        return {
          fixedStart: true,
          parts: [word(player ? 'you' : 'the player'), verb(VERBS.playingAs, true, req.not), part('target', entity?.name ?? req.name ?? 'a missing persona', !entity)],
        };
      }
      default: return ownedClause(req, host);
    }
  };

  const ownedClause = (req: Targeted, host: ClauseHost): Built => {
    const from = fromOf(host);
    const subject = subjectOf(req, host, from);
    const you = subject.kind === 'you';
    const fixedStart = you || (subject.kind === 'named' && subject.fixed);
    if (req.kind === 'stat') {
      const name = part('target', idx.statNames.get(req.id) ?? req.name ?? 'a missing stat', !idx.statNames.has(req.id));
      return {
        fixedStart,
        parts: [...subjectParts(subject, true), name, isVerb(req.not), part('comparison', COMPARISON_WORDS[req.operator]), part('value', statValue(req))],
      };
    }
    if (req.kind === 'item') {
      const known = idx.itemNames.has(req.id);
      const checks = [req.state?.trim(), req.identity].filter(Boolean);
      return {
        fixedStart,
        parts: [
          ...subjectParts(subject), verb(req.status === 'owned' ? VERBS.owned : VERBS.equipped, you, req.not),
          part('target', known ? idx.itemNameFor(req, from ?? undefined)! : req.name ?? 'a missing item', !known),
          ...(checks.length ? [part('checks', `(${checks.join(', ')})`)] : []),
        ],
      };
    }
    const known = req.kind === 'trait' ? idx.traitNames.get(req.id) : idx.groupNames.get(req.id);
    const name = part('target', known ?? req.name ?? (req.kind === 'trait' ? 'a missing trait' : 'a missing group'), known === undefined);
    if (subject.kind === 'none') {
      // A no-owner Condition on global scope names no one: "Paladin is active", "No trait in Combat is active" (Q25).
      return req.kind === 'trait'
        ? { fixedStart: false, parts: [name, isVerb(req.not), word('active')] }
        : { fixedStart: true, parts: [part('verb', req.not ? 'no trait in' : 'a trait in'), name, word('is active')] };
    }
    return { fixedStart, parts: [...subjectParts(subject), verb(VERBS[req.kind], you, req.not), name] };
  };

  const optionClause = (req: OptionRequirement): ClausePart[] => {
    const option = idx.options.get(req.id);
    const name = part('target', option?.name ?? req.name ?? 'a missing World Option', !option);
    const value = (text: string) => part('value', text, !!option && !fittedOption(req, idx));
    const type = option?.type ?? (req.operator !== undefined ? 'number' : req.valueId !== undefined ? 'choice' : 'boolean');
    if (type === 'number') return [name, word('is'), part('comparison', COMPARISON_WORDS[req.operator ?? '=']), value(`${req.value ?? 0}`)];
    if (type === 'boolean') return [name, word('is'), value(req.not ? 'off' : 'on')];
    const valueName = (option?.type === 'choice' ? option.values.find((v) => v.id === req.valueId)?.name : undefined) ?? req.valueName ?? 'a missing value';
    return [name, isVerb(req.not), value(valueName)];
  };

  return (req, view = {}) => {
    const { parts, fixedStart } = build(req, view.host ?? { kind: 'entity' });
    if (!view.sentenceStart || !fixedStart) return parts;
    const [first, ...rest] = parts;
    return [{ ...first, text: first.text.charAt(0).toUpperCase() + first.text.slice(1) }, ...rest];
  };
}

/** A clause's parts as plain text. */
export const clauseText = (parts: readonly ClausePart[]): string =>
  parts.map((part, i) => (i === 0 || part.attach ? part.text : ` ${part.text}`)).join('');

/** `req` with its Not flag flipped. */
export const flipped = (req: TraitRequirement): TraitRequirement => {
  // A number Option Condition has no Not: its complement is the opposite comparison.
  if (req.kind === 'option' && req.operator !== undefined) return { ...req, operator: COMPLEMENT[req.operator] };
  const { not, ...plain } = req;
  // The rest of a union loses its discriminant link; `plain` keeps every field of `req`'s own kind.
  return (not ? plain : { ...plain, not: true }) as TraitRequirement;
};

const COMPLEMENT: Record<StatComparison, StatComparison> = { '>': '<=', '<=': '>', '<': '>=', '>=': '<', '=': '≠', '≠': '=' };

/** The operator a stat Condition holds under once its Not is folded in. */
const effectiveOperator = (req: StatRequirement): StatComparison => (req.not ? COMPLEMENT[req.operator] : req.operator);

/** Whether `a` and `b` share nothing and together cover `all`. */
function splits<T>(a: readonly T[], b: readonly T[], all: readonly T[]): boolean {
  return !a.some((x) => b.includes(x)) && all.every((x) => a.includes(x) || b.includes(x));
}

/** Whether exactly one of the two Conditions holds in every state: a Condition and its Not, two time
 *  Conditions that split the day between them, or two stat Conditions on one reading whose operators split the
 *  number line (`> n` and `<= n`, `= n` and `≠ n`). */
export const complementary = (a: TraitRequirement, b: TraitRequirement): boolean => {
  // Two time or two weather Conditions split their whole range between them, however Not writes either.
  if (a.kind === 'time' && b.kind === 'time') return splits(heldDayparts(a), heldDayparts(b), DAYPARTS);
  if (a.kind === 'weather' && b.kind === 'weather') return splits(heldWeatherKinds(a), heldWeatherKinds(b), ALL_WEATHER_KINDS);
  if (sameRequirement(a, flipped(b))) return true;
  if (a.kind !== 'stat' || b.kind !== 'stat') return false;
  return a.id === b.id && requirementOwnerKey(requirementOwnerOf(a)) === requirementOwnerKey(requirementOwnerOf(b)) && a.value === b.value && a.unit === b.unit
    && effectiveOperator(a) === COMPLEMENT[effectiveOperator(b)];
};

/** Each owner's gate on each of its traits, against the input's active sets. */
export function gateStates(input: GateInput): GateStates {
  const idx = index(input);
  const activeIn = activeSets(input);
  const reader = ownRowsReader(input, idx);
  const active = new Set(locate(idx, input.active).filter((t) => activeIn(t.owner.id, t.item.id)).map(keyOf));
  return perScopeOf([...idx.owners.values()].map((o) => o.owner), (owner) => {
    const states = new Map<string, GateState>();
    for (const trait of idx.owners.get(owner.id)!.traits.values()) {
      const read = reader && conditionsOf(trait.item.requires).some((req) => req.kind === 'stat') ? reader(active, trait) : undefined;
      const rows = rowStatesOf(trait.item.requires ?? [], trait, activeIn, idx, read);
      states.set(trait.item.id, { unlocked: rows.length === 0 || rows.some((r) => r.holds), rows });
    }
    return states;
  }, new Map());
}

/** Each row's state for `rows` read from `host`: a stat resolves against the owner set of `host`, which the
 *  text alone does not read. */
function rowStatesOf(
  rows: readonly TraitRequirementRow[], host: Located<{ id: string }>, activeIn: ActiveIn, idx: Index, read?: GateStats,
): RowState[] {
  return rows.map((row): RowState => {
    const conditions = row.all.map((req): ConditionState => {
      const named = requirementText(req, idx, host.owner);
      const stat = req.kind === 'stat' ? idx.statOf(req, host.owner, read) : null;
      const unresolved = named.unresolved || (req.kind === 'stat' && (!stat || !!stat.inert));
      // An item held only as a hidden Item Instance stays out of the player's line (Q63, Q115).
      const hidden = req.kind === 'trait' ? idx.hiddenTraits.has(req.id)
        : req.kind === 'item' ? !req.not && idx.itemHeld(req, host.owner) && !idx.itemHeld(req, host.owner, true)
          : req.kind === 'option' ? idx.options.get(req.id)?.shownToPlayer === false
            // An Opening names a story route, so the player's line never shows it (Q23).
            : req.kind === 'opening' ? true
            : !!stat && (!!stat.hidden || !!stat.inert);
      const clause = clauseText(clausesOf(idx)(req, { host: hostOf(host.owner) }));
      return { text: named.text, clause, unresolved, hidden, holds: !unresolved && requirementHolds(req, host, activeIn, idx, read) };
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
  if (req.kind === 'playingAs' || req.kind === 'stat' || req.kind === 'time' || req.kind === 'weather' || req.kind === 'opening' || req.kind === 'item' || req.kind === 'option') return [];
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

/** The stats a trait's gate reads, its own rows left out: at setup, the stats of the other picks among `on`
 *  (Q26b); in play, the live stats (Q32). Null when the input carries neither. Only the traits with stat rows
 *  key the setup cache, since only they move a stat. */
function ownRowsReader(input: GateInput, idx: Index): ((on: ReadonlySet<string>, without: Located<Trait>) => GateStats) | null {
  const { statsOf, statsWithout } = input;
  if (!statsOf) return statsWithout ? (_on, without) => statsWithout(without.owner.id, without.item.id) : null;
  const moving = [...idx.owners.values()].flatMap((o) => [...o.traits.values()])
    .filter((t) => (t.item.statChanges?.length ?? 0) > 0 || (t.item.statToggles?.length ?? 0) > 0);
  const cache = new Map<string, GateStats>();
  return (on, without) => {
    const picks = moving.filter((t) => t !== without && on.has(keyOf(t)));
    const sig = picks.map(keyOf).join('\u0001');
    const hit = cache.get(sig);
    if (hit) return hit;
    const scopes = [...idx.owners.values()].map((o) => o.owner);
    const stats = statsOf(perScopeOf(scopes, (owner) => picks.filter((t) => t.owner === owner).map((t) => t.item.id), []));
    cache.set(sig, stats);
    return stats;
  };
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
  // A granted trait waits on its gate like an Always On one, and never on the cascade-off list (Q119).
  const grantKeys = new Set(input.grants ? locate(idx, input.grants.only).map(keyOf) : []);
  const grantWaiting = new Set(input.grants ? locate(idx, input.grants.waiting).map(keyOf) : []);
  const automatic = byRank([...idx.owners.values()].flatMap((o) => [...o.traits.values()])
    .filter((t) => (isAlwaysOn(t.item) || grantWaiting.has(keyOf(t))) && !proposedKeys.has(keyOf(t))), rank);
  const rivalIn = (t: Located<Trait>, keys: ReadonlySet<string>) =>
    [...(idx.owners.get(t.owner.id)?.rivals.get(t.item.id) ?? [])].some((id) => keys.has(key(t.owner.id, id)) && !grantKeys.has(key(t.owner.id, id)));
  const waiting = locate(idx, cascadeOff).filter((t) => !proposedKeys.has(keyOf(t)) && !isAlwaysOn(t.item) && !grantKeys.has(keyOf(t)));
  const candidates = byRank(waiting.filter((t) => !rivalIn(t, proposedKeys)), rank);

  // Proposal order: picks, then Automatic traits, then cascade-off returners. A later one loses a tie (Q8).
  const pool = [...proposed, ...automatic, ...candidates];
  const excluded = new Set<string>();
  let kept = new Set<string>();
  let returned: Located<Trait>[] = [];
  const activeIn: ActiveIn = (ownerId, id) => kept.has(key(ownerId, id));
  // At setup a stat reads what has joined so far, so a pick never props up the gate it needs (Q26c). In play it
  // reads the live stats less the trait's own rows (Q32).
  const reader = ownRowsReader(input, idx);
  const read = (t: Located<Trait>) => (reader ? () => reader(kept, t) : undefined);
  const grows = (t: Located<Trait>) => rowsHold(t.item.requires, growthHolds(t, activeIn, idx, read(t)));
  const opens = (t: Located<Trait>) => rowsHold(t.item.requires, (req) =>
    requirementHolds(req, t, activeIn, idx, req.kind === 'stat' ? read(t)?.() : undefined));
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
    [...off, ...stillWaiting].filter((t) => t.owner === owner && !isAlwaysOn(t.item) && !grantKeys.has(keyOf(t))).map((t) => t.item.id), []);
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

/** One owner's active traits that count as picks: those only a grant holds count toward no Pick Count (Q52). */
const picksOf = (input: SwitchInput, ownerId: OwnerId): readonly string[] => {
  const active = activeOf(input.active, ownerId);
  const only = input.grants ? activeOf(input.grants.only, ownerId) : [];
  return only.length ? active.filter((id) => !only.includes(id)) : active;
};

/** Group id → each scope's pick state, for every group in every scope's tree. */
export function groupPickStates(input: Pick<GateInput, 'global' | 'owners' | 'active' | 'grants'>): Scoped<Map<string, GroupPickState>> {
  const of = (tree: GateTree, ownerId: OwnerId) => {
    const active = picksOf(input, ownerId);
    return new Map(tree.groups.map((g) => [g.id, groupPickState(g, tree.traits, active)]));
  };
  return scoped(of(input.global, null), Object.fromEntries(input.owners.map((owner) => [owner.id, of(owner, owner.id)])));
}

/** The input the switch checks read: the trees, the active sets and the grants. */
type SwitchInput = Pick<GateInput, 'global' | 'owners' | 'active' | 'grants'>;

/** Whether switching `traitId` on would overfill its group in `ownerId`: the group is full at a max above
 *  one. A max-one group swaps its pick instead. */
export function overfills(input: SwitchInput, ownerId: OwnerId, traitId: string): boolean {
  const owner = gateTreeOf(input, ownerId);
  const groupId = owner?.traits.find((t) => t.id === traitId)?.groupId ?? null;
  const group = owner?.groups.find((g) => g.id === groupId);
  const active = picksOf(input, ownerId);
  return !!owner && !!group && group.maxPicks !== 1 && !activeOf(input.active, ownerId).includes(traitId)
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
  const active = picksOf(input, ownerId);
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
  // A stat can move either way in play, so its Condition counts as holding (Q20); the clock reaches any daypart;
  // a script can write any Option (Q17).
  const canHold = (trait: Located<Trait>) => (req: TraitRequirement) => (req.kind === 'time' ? heldDayparts(req).length > 0
    : req.kind === 'weather' ? heldWeatherKinds(req).length > 0
    : req.kind === 'opening' ? req.openings.length > 0
    : readsNoSet(req) ? true
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
  // when they share no daypart; two Option Conditions when no value of the Option meets both.
  const clash = (owner: GateScopeTree) => (plain: TraitRequirement, not: TraitRequirement): boolean => {
    if (plain.kind === 'time' && not.kind === 'time') return !heldDayparts(plain).some((d) => heldDayparts(not).includes(d));
    if (plain.kind === 'weather' && not.kind === 'weather') return !heldWeatherKinds(plain).some((k) => heldWeatherKinds(not).includes(k));
    if (plain.kind === 'option' || not.kind === 'option') return plain.kind === 'option' && not.kind === 'option' && optionsClash(plain, not);
    if (plain.not || !not.not || plain.kind === 'stat' || not.kind === 'stat') return false;
    if (plain.kind === 'time' || plain.kind === 'weather' || plain.kind === 'opening' || not.kind === 'time' || not.kind === 'weather' || not.kind === 'opening') return false;
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
    const meet = (req: TraitRequirement, then: () => boolean) => (req.not || req.kind === 'stat' || req.kind === 'time' || req.kind === 'weather' || req.kind === 'opening' || req.kind === 'option' ? then() : req.kind === 'playingAs'
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
  /** The World Option a World Option row names, whose values the chip's controls offer. */
  worldOption?: WorldOption;
}

export interface RequirementOptions {
  traits: RequirementOption[];
  groups: RequirementOption[];
  personas: RequirementOption[];
  /** Each item once as owned, and once as equipped when it fits a slot. */
  items?: RequirementOption[];
  /** Each World Option once, starting on its default value. */
  worldOptions?: RequirementOption[];
  /** The one Weather row, while the world's weather can change. */
  weather?: RequirementOption[];
  /** The kinds the Weather row's chip offers, Clear first. */
  weatherKinds?: readonly WeatherKind[];
  /** The one Opening row, while the world has an Opening. */
  opening?: RequirementOption[];
  /** The Openings the Opening row's chip offers, grouped by owner. */
  openings?: readonly OpeningPickGroup[];
}

/** A new Condition on `option`: a choice on its default value, a boolean on, a number at least its default. */
export function optionRequirement(option: ValuedWorldOption): OptionRequirement {
  const base = { kind: 'option' as const, id: option.id, name: option.name };
  switch (option.type) {
    case 'choice': {
      const value = option.values.find((v) => v.id === optionDefault(option)) ?? option.values[0];
      return value ? { ...base, valueId: value.id, valueName: value.name } : base;
    }
    case 'boolean': return base;
    case 'number': return { ...base, operator: '>=', value: Number(optionDefault(option)) };
  }
}

/** The picker's World Option rows, in Options-tab order. A Preset holds nothing to gate on. */
export const worldOptionRows = (options: readonly WorldOption[] | undefined): RequirementOption[] =>
  valuedOptions(options).map((option) => ({ requirement: optionRequirement(option), label: option.name, breadcrumb: [], owners: [], worldOption: option }));

/** `requirement` scoped to `owner`; the same owner when `owner` is absent. */
export const withRequirementOwner = (requirement: TraitRequirement, owner?: RequirementOwner): TraitRequirement =>
  (requirement.kind === 'playingAs' || requirement.kind === 'time' || requirement.kind === 'weather' || requirement.kind === 'opening' || requirement.kind === 'option' || !owner ? requirement : { ...requirement, owner });

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
  // Anyone can own an item, so every entity is a choice beside the Persona.
  const itemOwners: RequirementOwnerOption[] = [
    { owner: { kind: 'you' }, name: 'Persona' },
    ...input.entities.map((e): RequirementOwnerOption => ({ owner: { kind: 'entity', id: e.id, name: e.name }, name: e.name })),
  ];
  const items = (input.worldItems ?? []).flatMap((item) => [
    option({ kind: 'item', id: item.id, status: 'owned' }, [], itemOwners),
    ...(item.slotRule ? [option({ kind: 'item', id: item.id, status: 'equipped' }, [], itemOwners)] : []),
  ].map((o) => ({ ...o, label: item.name })));
  const weatherKinds = input.weatherKinds;
  // A new weather Condition starts with no kind, unresolved until the author turns one on.
  const weather = weatherKinds?.length ? [{ ...option({ kind: 'weather', kinds: [] }, [], []), label: 'Weather' }] : undefined;
  // A new Opening Condition starts with none picked, unresolved until the author checks one.
  const opening = input.openings?.length ? [{ ...option({ kind: 'opening', openings: [] }, [], []), label: 'Opening' }] : undefined;
  return {
    traits, groups, personas, items, worldOptions: worldOptionRows(input.worldOptions), ...(weather && { weather, weatherKinds }),
    ...(opening && { opening, openings: input.openings }),
  };
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
