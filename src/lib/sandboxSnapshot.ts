/**
 * The Sandbox Snapshot: the world every Script of one turn or one check runs against. Build it once with
 * `snapshotOf`, then call `run` per Script unit and `switchesOf` per result. Owner entries, `self`, the cast, the
 * placeholders, the dictionaries, the places and the switched trait are assembled here and nowhere else.
 */
import type { Entity, Placeholder, Stat, Trait } from '@/types';
import {
  EMPTY_REPLY, executeStatCode, keyedEntities, type EntityTraitWrites, type KeyedEntities, type NarrationInput, type SandboxEntity, type SandboxPlace,
  type SandboxLocationLinks, type SandboxPlaceholderNode, type SandboxPlaces, type SandboxStats, type SandboxTrait, type StatCodeResult, type StatCodeRunOptions, type StatTurnInputs,
  type SandboxTurn, type SwitchedTrait, type TraitWrite,
} from './statCodeExecutor';
import { statCodeName, statCodeNamed } from './statCodeNames';
import { navigableDestinationEntries } from './locationContext';
import { parentIndex } from './locationGraph';
import {
  codeDictionaries, sandboxDictionaries, sandboxPlaceholders, withLibraryPlaceholders, type StatCodePlaceholderSet,
} from './statCodePlaceholders';
import { codeEntities, sandboxTraits, worldTraitPlaces, type CodeEntities, type CodeEntity } from './statCodeTraits';
import { sampleNarration, sampleSwitchedTrait } from './scriptTestSamples';
import { randomUUID } from './uuid';
import { withLoreToggles } from './loreToggles';
import { gateStatsOf, type TraitRuntimeState, type TraitSwitchEvent, type TraitWorld } from './traitRuntime';
import { activeStatEnabled } from './traitEffects';
import type { GateStats } from './traitGates';
import type { RunTiming } from './statCodeTiming';
import type { ScriptPromptHost } from './scriptPrompts';
import type { ResolveText, SandboxState, StatePlaces } from './statCodeTurn';

/** The trait a trait home names. */
export type HomeTrait = Pick<Trait, 'id' | 'name'>;

/** Where a Script lives. Stats carry their code names; a Blueprint stat carries its group's stats. */
export type UnitHome =
  | { kind: 'globalStat'; stat: Stat }
  | { kind: 'entityStat'; entityId: string; stat: Stat }
  | { kind: 'blueprintStat'; stat: Stat; groupStats: readonly Stat[] }
  /** A trait held globally (`entityId` null) or by an entity. */
  | { kind: 'trait'; trait: HomeTrait; entityId: string | null }
  | { kind: 'blueprintTrait'; trait: HomeTrait }
  | { kind: 'world' }
  | { kind: 'tool' };

/** Whose `owner` a Script runs under. */
export type UnitOwner =
  | { kind: 'none' }
  | { kind: 'entity'; entityId: string }
  /** An entry of its own holding the group's stats and no entity. */
  | { kind: 'blueprintStat'; stats: readonly Stat[] }
  /** The empty entry: a Blueprint trait's owners vary. */
  | { kind: 'blueprintTrait' };

/** The Owner a home's Script runs under. */
export function ownerOfHome(home: UnitHome): UnitOwner {
  switch (home.kind) {
    case 'entityStat': return { kind: 'entity', entityId: home.entityId };
    case 'trait': return home.entityId === null ? { kind: 'none' } : { kind: 'entity', entityId: home.entityId };
    case 'blueprintStat': return { kind: 'blueprintStat', stats: home.groupStats };
    case 'blueprintTrait': return { kind: 'blueprintTrait' };
    default: return { kind: 'none' };
  }
}

/** One Script run: its home, its Timing, its code, and the inputs that Timing needs. */
export interface ScriptRunUnit {
  home: UnitHome;
  timing: RunTiming;
  code: string;
  /** During AI Output's narration: play's live input, or an editor run's sentence, which the snapshot builds into
   *  the first sentence of a reply. */
  narration?: NarrationInput | string;
  /** When a Trait Switches' switch, and the world its trait reads. `sample` is an editor run's: the home's own
   *  trait, else the world's first trait (Q49). */
  switched?: { event: TraitSwitchEvent; world: TraitWorld } | 'sample';
  /** A World Tool call's arguments. */
  args?: Readonly<Record<string, unknown>>;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
  /** A user Tool's run: the surface without writes. */
  readOnly?: boolean;
  /** The `turn.choices` the earlier scripts of the batch left, which this run reads in place of the state's (Q14). */
  choices?: readonly string[];
}

/** Each scope's stat turn inputs: the global run's and each Owner's, by id. The caller leaves them empty at a
 *  Timing that reads the turn start. */
export interface TurnReadings {
  global: Readonly<Record<string, StatTurnInputs>>;
  owners?: Readonly<Record<string, Readonly<Record<string, StatTurnInputs>>>>;
}

export interface SnapshotOptions {
  /** This turn's asks, regen and previous values. Absent, every stat reads an untouched turn. */
  readings?: TurnReadings;
  /** An editor run's cast, which has no discovered entities: a `diary` name the cast lacks is a warning. */
  openCast?: boolean;
  /** Test Code's overlay: `persona` is a stand-in holding every trait, placeholder and stat a persona-capable
   *  entity holds, keyed `PENDING_PERSONA_ID`. */
  pendingPersona?: boolean;
  /** Test Code's overlay: global stats for names the world lacks, each a number at 0 in 0–100. */
  assumedStats?: readonly string[];
}

/** The id of the pending persona's stand-in, which keys its stat writes. */
export const PENDING_PERSONA_ID = 'pending-persona';

/** The range and value an assumed stat runs with. */
const ASSUMED_STAT = { min: 0, max: 100, value: 0 };

/** A trait switch a run wrote, by id: a global trait's, or an Owner's with `ownerId`. */
export interface TraitSwitchWrite {
  traitId: string;
  enabled: boolean;
  ownerId?: string;
}

/** The trait writes of one run, as the executor returns them. */
export interface RunTraitWrites {
  traits?: readonly TraitWrite[];
  entities?: readonly EntityTraitWrites[];
}

export interface SandboxSnapshot {
  run(unit: ScriptRunUnit): Promise<StatCodeResult>;
  /** `writes` with each trait named by its id, in the order written: world traits first, then each entity row's. */
  switchesOf(unit: Pick<ScriptRunUnit, 'home'>, writes: RunTraitWrites): TraitSwitchWrite[];
}

/** The trait runtime a state holds, as the gates and the turn's settles read it. */
export function runtimeStateOf(state: SandboxState): TraitRuntimeState {
  const { ownerTraits } = state;
  return {
    stats: [...state.stats],
    traits: [...ownerTraits.acquired],
    disabledTraitIds: [...ownerTraits.disabledTraitIds],
    appliedValues: ownerTraits.appliedValues,
    cascadeOffTraitIds: ownerTraits.cascadeOffTraitIds,
    ownedTraits: ownerTraits.ownedTraits,
    entityStats: Object.fromEntries((state.owners ?? []).map((owner) => [owner.id, [...owner.stats]])),
  };
}

/** `live` with the gate stats of the state's other owners kept under it. */
export const withStateGateStats = (state: SandboxState, live: GateStats): GateStats =>
  ({ global: live.global, owners: { ...state.gateStats?.owners, ...live.owners } });

/** The authored trait a switch names, in its owner's tree. */
export function switchedTraitOf({ traitId, ownerId }: TraitSwitchEvent, world: TraitWorld): Trait | undefined {
  const tree = ownerId === null ? world.traits : world.owners?.find((owner) => owner.id === ownerId)?.traits;
  return tree?.find((trait) => trait.id === traitId);
}

/** `set` listing the authored books in play, on, and the ones the world ships off, off; a book the player turned
 *  off reads as an unknown dictionary (Q33). */
const withBooksInPlay = (set: StatCodePlaceholderSet): StatCodePlaceholderSet => {
  const { inPlayDictionaryIds: inPlay } = set;
  return inPlay ? {
    ...set,
    dictionaries: set.dictionaries?.flatMap((book) => (inPlay.has(book.id) ? [{ ...book, enabled: true }]
      : book.enabled === false ? [book] : [])),
  } : set;
};

const AS_AUTHORED: ResolveText = (text) => text;

/** `places` under the code names scripts reach them by, their text resolved. */
function codePlaces(
  { locations, location, connections = [] }: StatePlaces, placeholders: readonly Placeholder[], resolve: ResolveText,
): SandboxPlaces {
  const named = (place: SandboxPlace): SandboxPlace => ({ id: place.id, name: statCodeName(place.name, placeholders) });
  // Built on the first read of any location's links, so a run that reads none builds no index.
  let index: { nameOf: Map<string, string>; childrenOf: ReadonlyMap<string, string[]> } | undefined;
  const indexOf = () => (index ??= {
    nameOf: new Map(locations.map((place) => [place.id, statCodeName(place.name, placeholders)])),
    childrenOf: parentIndex(locations).childrenOf,
  });
  const linksOf = (place: StatePlaces['locations'][number]) => (): SandboxLocationLinks => {
    const { nameOf, childrenOf } = indexOf();
    const codeName = (id: string) => nameOf.get(id) ?? '';
    return {
      parent: place.parentId ? codeName(place.parentId) : '',
      children: (childrenOf.get(place.id) ?? []).map(codeName),
      exits: navigableDestinationEntries(place, locations, connections)
        .map(({ location: exit, hint }) => ({ name: codeName(exit.id), hint: resolve(hint ?? '', null) })),
    };
  };
  return {
    locations: locations.map((place) => ({
      ...named(place), description: resolve(place.aiDescription ?? '', null), summary: resolve(place.aiSummary ?? '', null), starting: !!place.isStarting,
      links: linksOf(place),
    })),
    location: location && named(location),
  };
}

/** The fields `entity` adds from play: its text resolved, where it stands, and whether it follows. */
function playFields(
  entity: Entity, { positions, followers }: Pick<SandboxState, 'positions' | 'followers'>, resolve: ResolveText,
): Partial<CodeEntity> {
  const at = positions?.[entity.id];
  return {
    description: resolve(entity.aiDescription ?? '', entity), summary: resolve(entity.aiSummary ?? '', entity),
    aliases: (entity.aliases ?? []).map((alias) => resolve(alias, entity)),
    pronouns: resolve(entity.pronouns ?? '', entity),
    ...(at ? { locationId: at } : {}), locationIds: entity.locations ?? [],
    ...(followers?.includes(entity.id) ? { following: true } : {}),
  };
}

/** The entities with the fields `fieldsOf` gives each one laid on, `persona` still one of them. */
function withEntityFields(cast: CodeEntities, fieldsOf: (id: string) => Partial<CodeEntity>): CodeEntities {
  const entities = cast.entities.map((entity) => {
    const fields = fieldsOf(entity.id);
    return Object.keys(fields).length ? { ...entity, ...fields } : entity;
  });
  return { entities, persona: entities.find((entity) => cast.persona.id && entity.id === cast.persona.id) ?? cast.persona };
}

/** Everything a run reads but its own unit: built on the first run, so a turn that runs nothing builds none. */
interface Board {
  stats: SandboxStats;
  traits: SandboxTrait[];
  inPlay: CodeEntities;
  placeholders: StatCodeRunOptions['placeholders'];
  dictionaries: StatCodeRunOptions['dictionaries'];
  resolveEntryValue?: StatCodeRunOptions['resolveEntryValue'];
  places?: SandboxPlaces;
  ownerStats: (id: string) => SandboxStats;
  placeholderDefs: readonly Placeholder[];
}

/** The pending persona's placeholder node: every persona-capable entity's own placeholders under `persona`. Each
 *  node is a copy, so a write through it is told apart from one through the entity. */
function personaPlaceholders(playables: readonly string[], owners: ReadonlyMap<string, SandboxPlaceholderNode> | undefined): SandboxPlaceholderNode {
  const rooted = (node: SandboxPlaceholderNode): SandboxPlaceholderNode =>
    ({ ...node, path: ['persona', ...node.path.slice(1)], ownedBy: 'persona', children: (node.children ?? []).map(rooted) });
  const children = playables.flatMap((id) => owners?.get(id)?.children ?? []);
  return { name: 'persona', path: ['persona'], ownedBy: 'persona', children: children.map(rooted) };
}

/** The empty persona holding every trait name, placeholder and stat a persona-capable entity holds, none chosen,
 *  and in the scene. Its traits read as an unplayed entity's do. */
function pendingPersonaOf(
  state: SandboxState, cast: CodeEntities, owners: ReadonlyMap<string, SandboxPlaceholderNode> | undefined, ownerStats: (id: string) => SandboxStats,
): CodeEntity {
  const playables = (state.ownerTraits.entities ?? []).filter((entity) => entity.persona).map((entity) => entity.id);
  const entries = playables.map((id) => cast.entities.find((entity) => entity.id === id));
  const stats = playables.flatMap((id) => ownerStats(id).stats);
  return {
    id: PENDING_PERSONA_ID, name: '', type: '', pronouns: '', inScene: true,
    traits: [...new Set(entries.flatMap((entity) => entity?.traits.map((trait) => trait.name) ?? []))]
      .map((name) => ({ id: '', name, enabled: false, acquired: false })),
    placeholders: personaPlaceholders(playables, owners),
    stats: { stats, enabled: activeStatEnabled(stats, []) },
  };
}

function boardOf(state: SandboxState, { readings, pendingPersona, assumedStats = [] }: SnapshotOptions): Board {
  const placeholderDefs = state.placeholders?.placeholders ?? [];
  const { world } = state.ownerTraits;
  const before = runtimeStateOf(state);
  const live = gateStatsOf(before, world);
  const gateStats = withStateGateStats(state, live);
  // Resolved once, so every Script reads the same placeholders and the same traits.
  const readOwnerTraits = { ...state.ownerTraits, world: { ...world, gateStats } };
  const traits = sandboxTraits(readOwnerTraits, placeholderDefs);
  const cast = codeEntities(readOwnerTraits, placeholderDefs);
  // The library's pools join the run as the session's Placeholder Set joins them.
  const placeholderSet = state.placeholders && withLibraryPlaceholders(withBooksInPlay(state.placeholders), state.ownerTraits.library ?? []);
  const sandbox = placeholderSet ? sandboxPlaceholders(placeholderSet) : null;
  const scopeStats = (stats: readonly Stat[], enabled: SandboxStats['enabled'], inputs: TurnReadings['global'] | undefined): SandboxStats =>
    ({ stats: statCodeNamed(stats, placeholderDefs), ...(inputs ? { readings: inputs } : {}), enabled });
  const owned = new Map((state.owners ?? []).map((owner) => [owner.id, scopeStats(owner.stats, owner.enabled, readings && (readings.owners?.[owner.id] ?? {}))]));
  const ownerStats = (id: string): SandboxStats => owned.get(id) ?? { stats: [], ...(readings ? { readings: {} } : {}), enabled: {} };
  const resolve = state.resolveText ?? AS_AUTHORED;
  const { entities = [], library = [], discovered = [] } = state.ownerTraits;
  const authored = new Map([...entities, ...library, ...discovered].map((entity) => [entity.id, entity]));
  const withFields = withEntityFields(cast, (id) => {
    const node = sandbox?.owners.get(id);
    const stats = owned.get(id);
    const entity = authored.get(id);
    return { ...(node ? { placeholders: node } : {}), ...(stats ? { stats } : {}), ...(entity ? playFields(entity, state, resolve) : {}) };
  });
  const inPlay = pendingPersona ? { ...withFields, persona: pendingPersonaOf(state, withFields, sandbox?.owners, ownerStats) } : withFields;
  const assumed = assumedStats.map((name): Stat => ({ id: randomUUID(), name, type: 'number', description: '', regen: 0, descriptors: [], ...ASSUMED_STAT }));
  const globalStats = assumed.length ? [...state.stats, ...assumed] : state.stats;
  const globalEnabled = assumed.length ? { ...state.enabled, ...activeStatEnabled(assumed, []) } : state.enabled;
  return {
    stats: scopeStats(globalStats, globalEnabled, readings?.global),
    traits, inPlay, placeholderDefs, ownerStats,
    placeholders: sandbox?.top ?? [],
    dictionaries: sandboxDictionaries(
      codeDictionaries(placeholderSet?.dictionaries && withLoreToggles(placeholderSet.dictionaries, state.loreToggles), placeholderDefs), sandbox?.owners,
    ),
    ...(state.resolveText ? { resolveEntryValue: (value: string) => resolve(value, null) } : {}),
    ...(state.places ? { places: codePlaces(state.places, placeholderDefs, resolve) } : {}),
  };
}

/** A unit's `owner`: its entity's cast entry, else an entry of its own; none for global scope. */
function ownerEntryOf(board: Board, owner: UnitOwner): SandboxEntity | undefined {
  switch (owner.kind) {
    case 'none': return undefined;
    case 'entity': return board.inPlay.entities.find((entity) => entity.id === owner.entityId)
      ?? { id: owner.entityId, name: '', type: '', pronouns: '', inScene: false, traits: [], stats: board.ownerStats(owner.entityId) };
    case 'blueprintStat': return { name: '', traits: [], stats: { stats: owner.stats, enabled: activeStatEnabled(owner.stats, []) } };
    case 'blueprintTrait': return { name: '', traits: [], stats: { stats: [], enabled: {} } };
  }
}

/** The `trait` a switch run reads: the switched trait's entry in its owner's map after the switch, else one
 *  built from the authored trait. */
function switchedTraitEntry(board: Board, { event, world }: { event: TraitSwitchEvent; world: TraitWorld }): SwitchedTrait | undefined {
  const { traitId, ownerId, enabled } = event;
  const { inPlay, traits, placeholderDefs } = board;
  const entity = ownerId === null ? null : [...inPlay.entities, inPlay.persona].find((cast) => cast.id === ownerId);
  const entry = (entity ? entity.traits : ownerId === null ? traits : []).find((trait) => trait.id === traitId);
  const ownerName = world.owners?.find((owner) => owner.id === ownerId)?.name;
  const owner = entity?.name ?? (ownerName ? statCodeName(ownerName, placeholderDefs) : '');
  // A trait that left the tree keeps its stored state, so the switch sets `enabled`.
  if (entry) return { ...entry, enabled, owner };
  const authored = switchedTraitOf(event, world);
  return authored && { id: traitId, name: statCodeName(authored.name, placeholderDefs), enabled, acquired: true, owner };
}

const statOf = (home: UnitHome): Stat | null => ('stat' in home ? home.stat : null);

/** The page and choices read empty at a timing before the turn's reply is done (Q5); later, the choices are the ones
 *  the batch's earlier scripts left. A read-only run is a user Tool's, which reads the state's turn as it stands. */
const turnRead = (turn: SandboxTurn, { timing, readOnly, choices }: ScriptRunUnit): SandboxTurn => {
  if (!readOnly && (timing === 'start' || timing === 'before' || timing === 'output')) return { ...turn, ...EMPTY_REPLY };
  return choices && !turn.choicesOff ? { ...turn, choices } : turn;
};

/** Only an After the AI script writes `turn.choices`, and only while the player has choices on (Q11, Q21). */
const takesChoicesWrite = ({ home, timing, readOnly }: ScriptRunUnit, turn: SandboxTurn | undefined): boolean =>
  timing === 'after' && home.kind !== 'tool' && !readOnly && !turn?.choicesOff;

const optionsOfSnapshot = new WeakMap<SandboxSnapshot, (unit: ScriptRunUnit) => StatCodeRunOptions>();

/** The snapshot of `state`, which every Script of the turn or check runs through. */
export function snapshotOf(state: SandboxState, options: SnapshotOptions = {}): SandboxSnapshot {
  let built: Board | undefined;
  const board = () => (built ??= boardOf(state, options));
  const { traits: worldTraits, groups } = state.ownerTraits.world;
  const firstTraitId = () => worldTraitPlaces({ traits: worldTraits, traitGroups: groups ?? [] }, board().placeholderDefs)[0]?.id;
  const optionsFor = (unit: ScriptRunUnit): StatCodeRunOptions => {
    const read = board();
    const owner = ownerEntryOf(read, ownerOfHome(unit.home));
    const trait = unit.home.kind === 'trait' || unit.home.kind === 'blueprintTrait' ? unit.home.trait : undefined;
    // A trait's entry as its Owner's map holds it; one no map holds reads as not held.
    const selfTrait = trait && ((owner ? owner.traits : read.traits).find((entry) => entry.id === trait.id)
      ?? { id: trait.id, name: statCodeName(trait.name, read.placeholderDefs), enabled: false, acquired: false });
    const switchedTrait = unit.timing !== 'switch' || !unit.switched ? undefined
      : unit.switched === 'sample' ? sampleSwitchedTrait(read.traits, firstTraitId(), selfTrait && { entry: selfTrait, owner: owner?.name ?? '' })
        : switchedTraitEntry(read, unit.switched);
    return {
      clock: state.clock, ...(read.stats.readings ? { readings: read.stats.readings } : {}), ...(state.turn && { turn: turnRead(state.turn, unit) }),
      ...(takesChoicesWrite(unit, state.turn) && { choicesWritable: true }),
      enabled: read.stats.enabled,
      placeholders: read.placeholders, traits: read.traits, ...read.inPlay,
      ...(owner && { owner }), dictionaries: read.dictionaries, ...(read.resolveEntryValue && { resolveEntryValue: read.resolveEntryValue }),
      ...(unit.prompts && { prompts: unit.prompts }),
      ...(read.places && { places: read.places }),
      ...(unit.timing === 'output' && unit.narration !== undefined && {
        narration: typeof unit.narration === 'string' ? sampleNarration(unit.narration) : unit.narration,
      }),
      ...(selfTrait && { selfTrait }), ...(switchedTrait && { switchedTrait }), ...(unit.args && { args: unit.args }),
      ...(options.openCast && { openCast: true }), ...(state.memories && { memories: state.memories }),
      ...(state.notes && { notes: state.notes }), ...(unit.readOnly && { readOnly: true }),
    };
  };
  const snapshot: SandboxSnapshot = {
    run: (unit) => executeStatCode(unit.code, [...board().stats.stats], statOf(unit.home), optionsFor(unit)),
    switchesOf: ({ home }, { traits = [], entities = [] }) => {
      const read = board();
      const owner = ownerEntryOf(read, ownerOfHome(home));
      const keyed = keyedEntities(read.inPlay.entities, read.inPlay.persona);
      // A name resolves to the last trait with it, as the sandbox map does.
      const idByName = new Map(state.ownerTraits.world.traits.map((trait) => [statCodeName(trait.name, read.placeholderDefs), trait.id]));
      const out: TraitSwitchWrite[] = [];
      for (const write of traits) {
        const traitId = idByName.get(write.name);
        if (traitId !== undefined) out.push({ traitId, enabled: write.enabled });
      }
      for (const row of entities) out.push(...entitySwitches(row, owner, keyed));
      return out;
    },
  };
  optionsOfSnapshot.set(snapshot, optionsFor);
  return snapshot;
}

/** One entity row's switches by id. An empty name is `persona`, which an unnamed persona entity can still be. */
function entitySwitches(
  { entity: name, owner: viaOwner, traits: switched = [] }: EntityTraitWrites, owner: SandboxEntity | undefined,
  inPlay: KeyedEntities<CodeEntity>,
): TraitSwitchWrite[] {
  const entity = viaOwner ? owner : name ? inPlay.byName.get(name) : inPlay.persona;
  if (!entity?.id) return [];
  const ownerId = entity.id;
  const idByTraitName = new Map(entity.traits.map((trait) => [trait.name, trait.id]));
  return switched.flatMap((write) => {
    const traitId = idByTraitName.get(write.name);
    return traitId === undefined ? [] : [{ traitId, enabled: write.enabled, ownerId }];
  });
}

/** The run options `snapshot` assembles for `unit`. For this module's tests only; callers use `run`. */
export function optionsFor(snapshot: SandboxSnapshot, unit: ScriptRunUnit): StatCodeRunOptions {
  const assemble = optionsOfSnapshot.get(snapshot);
  if (!assemble) throw new Error('Not a snapshot from snapshotOf');
  return assemble(unit);
}
