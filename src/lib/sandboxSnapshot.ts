/**
 * The Sandbox Snapshot: the world every Script of one turn or one check runs against. Build it once with
 * `snapshotOf`, then call `run` per Script unit and `switchesOf` per result. Owner entries, `self`, the cast, the
 * placeholders, the dictionaries, the places and the switched trait are assembled here and nowhere else.
 */
import type { Placeholder, Stat, Trait } from '@/types';
import {
  executeStatCode, keyedEntities, type EntityTraitWrites, type KeyedEntities, type NarrationInput, type SandboxEntity, type SandboxPlace,
  type SandboxPlaces, type SandboxStats, type SandboxTrait, type StatCodeResult, type StatCodeRunOptions, type StatTurnInputs,
  type SwitchedTrait, type TraitWrite,
} from './statCodeExecutor';
import { statCodeName, statCodeNamed } from './statCodeNames';
import {
  codeDictionaries, sandboxDictionaries, sandboxPlaceholders, withLibraryPlaceholders, type StatCodePlaceholderSet,
} from './statCodePlaceholders';
import { codeEntities, sandboxTraits, type CodeEntities, type CodeEntity } from './statCodeTraits';
import { gateStatsOf, type TraitRuntimeState, type TraitSwitchEvent, type TraitWorld } from './traitRuntime';
import { activeStatEnabled } from './traitEffects';
import type { GateStats } from './traitGates';
import type { RunTiming } from './statCodeTiming';
import type { ScriptPromptHost } from './scriptPrompts';
import type { SandboxState } from './statCodeTurn';

/** Where a Script lives. Stats carry their code names; a Blueprint stat carries its group's stats. */
export type UnitHome =
  | { kind: 'globalStat'; stat: Stat }
  | { kind: 'entityStat'; entityId: string; stat: Stat }
  | { kind: 'blueprintStat'; stat: Stat; groupStats: readonly Stat[] }
  /** A trait held globally (`entityId` null) or by an entity. */
  | { kind: 'trait'; trait: Trait; entityId: string | null }
  | { kind: 'blueprintTrait'; trait: Trait }
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
  /** During AI Output's sentence. */
  narration?: NarrationInput;
  /** When a Trait Switches' switch, and the world its trait reads. */
  switched?: { event: TraitSwitchEvent; world: TraitWorld };
  /** A World Tool call's arguments. */
  args?: Readonly<Record<string, unknown>>;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
}

/** Each scope's stat turn inputs: the global run's and each Owner's, by id. The caller leaves them empty at a
 *  Timing that reads the turn start. */
export interface TurnReadings {
  global: Readonly<Record<string, StatTurnInputs>>;
  owners?: Readonly<Record<string, Readonly<Record<string, StatTurnInputs>>>>;
}

export interface SnapshotOptions {
  /** This turn's asks, regen and previous values. Absent, every stat reads an untouched turn. */
  turn?: TurnReadings;
}

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

/** `set` listing only the authored books in play; a book turned off reads as an unknown dictionary. */
const withBooksInPlay = (set: StatCodePlaceholderSet): StatCodePlaceholderSet => {
  const { inPlayDictionaryIds: inPlay } = set;
  return inPlay ? { ...set, dictionaries: set.dictionaries?.filter((book) => inPlay.has(book.id)) } : set;
};

/** `places` under the code names scripts reach them by. */
function codePlaces({ locations, location }: SandboxPlaces, placeholders: readonly Placeholder[]): SandboxPlaces {
  const coded = (place: SandboxPlace): SandboxPlace => ({ id: place.id, name: statCodeName(place.name, placeholders) });
  return { locations: locations.map(coded), location: location && coded(location) };
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
  places?: SandboxPlaces;
  discovered?: readonly SandboxPlace[];
  ownerStats: (id: string) => SandboxStats;
  placeholderDefs: readonly Placeholder[];
}

function boardOf(state: SandboxState, { turn }: SnapshotOptions): Board {
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
    ({ stats: statCodeNamed(stats, placeholderDefs), ...(inputs ? { turn: inputs } : {}), enabled });
  const owned = new Map((state.owners ?? []).map((owner) => [owner.id, scopeStats(owner.stats, owner.enabled, turn && (turn.owners?.[owner.id] ?? {}))]));
  const ownerStats = (id: string): SandboxStats => owned.get(id) ?? { stats: [], ...(turn ? { turn: {} } : {}), enabled: {} };
  const inPlay = withEntityFields(cast, (id) => {
    const node = sandbox?.owners.get(id);
    const stats = owned.get(id);
    return { ...(node ? { placeholders: node } : {}), ...(stats ? { stats } : {}) };
  });
  return {
    stats: scopeStats(state.stats, state.enabled, turn?.global),
    traits, inPlay, placeholderDefs, ownerStats,
    placeholders: sandbox?.top ?? [],
    dictionaries: sandboxDictionaries(codeDictionaries(placeholderSet?.dictionaries, placeholderDefs), sandbox?.owners),
    ...(state.places ? { places: codePlaces(state.places, placeholderDefs) } : {}),
    ...(state.discovered ? { discovered: codePlaces({ locations: state.discovered, location: null }, placeholderDefs).locations } : {}),
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
function switchedTraitEntry(board: Board, { event, world }: NonNullable<ScriptRunUnit['switched']>): SwitchedTrait | undefined {
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

const optionsOfSnapshot = new WeakMap<SandboxSnapshot, (unit: ScriptRunUnit) => StatCodeRunOptions>();

/** The snapshot of `state`, which every Script of the turn or check runs through. */
export function snapshotOf(state: SandboxState, options: SnapshotOptions = {}): SandboxSnapshot {
  let built: Board | undefined;
  const board = () => (built ??= boardOf(state, options));
  const optionsFor = (unit: ScriptRunUnit): StatCodeRunOptions => {
    const read = board();
    const owner = ownerEntryOf(read, ownerOfHome(unit.home));
    const trait = unit.home.kind === 'trait' || unit.home.kind === 'blueprintTrait' ? unit.home.trait : undefined;
    // A trait's entry as its Owner's map holds it; one no map holds reads as not held.
    const selfTrait = trait && ((owner ? owner.traits : read.traits).find((entry) => entry.id === trait.id)
      ?? { id: trait.id, name: statCodeName(trait.name, read.placeholderDefs), enabled: false, acquired: false });
    const switchedTrait = unit.timing === 'switch' && unit.switched ? switchedTraitEntry(read, unit.switched) : undefined;
    return {
      clock: state.clock, ...(read.stats.turn ? { turn: read.stats.turn } : {}), enabled: read.stats.enabled,
      placeholders: read.placeholders, traits: read.traits, ...read.inPlay,
      ...(owner && { owner }), dictionaries: read.dictionaries, ...(unit.prompts && { prompts: unit.prompts }),
      ...(read.places && { places: read.places }), ...(read.discovered && { discovered: read.discovered }),
      ...(unit.timing === 'output' && unit.narration && { narration: unit.narration }),
      ...(selfTrait && { selfTrait }), ...(switchedTrait && { switchedTrait }), ...(unit.args && { args: unit.args }),
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
