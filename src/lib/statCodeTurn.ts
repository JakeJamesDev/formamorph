import type {
  CascadeOffTraitIds, CodeBounds, CodePins, Connection, Currency, Dictionary, Entity, EntityPositions, EntityStatValues, GameLocation, Item, ItemCopy, LoreToggles,
  OwnedTraitStates, Placeholder, Placement, PersonaRef, PlayerStat, Script, Slot, Trait,
} from '@/types';
import type { BodyWorld } from './bodies';
import { bareLoreWrite, withLoreWrites, type LoreWrite } from './loreToggles';
import {
  CODE_BOUND_FIELDS, type EntityTraitWrites, type NarrationInput, type PlaceholderWrite, type StatClock, type StatCodeResult,
  type StatTurnInputs, type StatWrite, type SandboxTurn, type TraitWrite, type ValueAndMax, type SandboxMemory, type SandboxPlace, type WorldWrites,
} from './statCodeExecutor';
import { mergeWorldWrites } from './worldWrites';
import { withWorldWrites } from './chainedWorld';
import { applyInventoryOps, type ItemUse, type InventoryOp, type InventoryResult, type ItemScriptEvent } from './inventory';
import { faceName, isUnidentified } from './items';
import { statCodeNamed } from './statCodeNames';
import type { StatCodePlaceholderSet } from './statCodePlaceholders';
import { recordKey } from './ownedTraitState';
import type { StatCodeOwners } from './statCodeTraits';
import {
  applyCodeTraitSwitches, codeDeltaFor, gateStatsOf, ownerStatTraitsInForce, sameCodeDelta, sameHidden, traitForceScope, traitSwitchEvents, withCodeDelta,
  type AppliedTraitValues, type CodeTraitSwitch, type TraitForceState, type TraitSwitchEvent, type TraitWorld,
} from './traitRuntime';
import {
  runtimeStateOf, snapshotOf, switchedTraitOf, withStateGateStats, type SandboxSnapshot, type SnapshotOptions, type TraitSwitchWrite, type TurnReadings, type UnitHome,
} from './sandboxSnapshot';
import type { GateStats } from './traitGates';
import type { RoutineReading } from './positionPlay';
import { readsTurnStart, type RunTiming } from './statCodeTiming';
import { filledScriptsAt, inRowOrder, inRunOrder, SCRIPT_TIMING_LABEL, scriptLabel } from './scripts';
import { rowKeyOf } from './worldScripts';
import { activeStatEnabled, inAuthoredOrder, traitOrderIndex } from './traitEffects';
import { clamp } from './utils';
import type { OwnerId, Scoped } from './scope';
import { silentPrompts, type ScriptPromptHost } from './scriptPrompts';
import { sameChoices } from './scriptedChoices';
import { randomUUID } from './uuid';

/** The trait state a run's switches left, and the log lines they wrote. */
export interface StatCodeTraitResult {
  acquired: Trait[];
  disabledTraitIds: string[];
  appliedValues: AppliedTraitValues;
  cascadeOffTraitIds: CascadeOffTraitIds;
  ownedTraits: OwnedTraitStates;
  /** The owner's stat traits in force after the switches, which the bounds re-derive under. */
  inForce: Trait[];
  log: string[];
  /** The record key of the trait each `log` line reports, null for a line no single switch owns. Absent ⇒ none
   *  is tagged. */
  logTraits?: (string | null)[];
}

/** The world's locations as authored, and where the turn stands. */
export interface StatePlaces {
  locations: readonly Pick<GameLocation, 'id' | 'name' | 'aiDescription' | 'aiSummary' | 'isStarting' | 'parentId'>[];
  location: SandboxPlace | null;
  /** The world's Connections, which the exits read as the router does. Absent ⇒ none. */
  connections?: readonly Connection[];
}

/** Authored text as the AI reads it: chips resolved, an entity's own against that entity. */
export type ResolveText = (text: string, owner: Entity | null) => string;

/** The world a script runs against, as the turn found it: everything but what this turn alone brings. */
export interface SandboxState {
  /** Every global stat as the turn's pipeline left it: AI asks and regen applied, code not yet run. Names are
   *  the authored ones, chips and all — code reads each stat's code name, derived here. */
  stats: readonly PlayerStat[];
  /** The live stat-enabled map. A disabled stat's code never runs; other code reads it with `enabled: false`. */
  enabled: Readonly<Record<string, boolean>>;
  /** The entities whose stats also run this turn, in owner order: world entities in authored order, then
   *  library entities in pick order. */
  owners?: readonly OwnerState[];
  /** Every owner's stats as gates read them at the turn's start; the run lays its owners' stats over them.
   *  Absent ⇒ gates read only the run's owners. */
  gateStats?: GateStats;
  /** What `traits`, `entities` and `persona` read and switch. Bounds re-derive under the ones in force. */
  ownerTraits: StatCodeOwners;
  /** What `placeholders`, each owner entry's `placeholders` and `dictionaries` read. Absent, all are empty. */
  placeholders?: StatCodePlaceholderSet;
  /** The world's locations, authored names and text and all, and where the turn stands. Absent, code names none. */
  places?: StatePlaces;
  /** Where each entity with a runtime position stands, by entity id. Absent ⇒ none has one. */
  positions?: Readonly<EntityPositions>;
  /** The places each Generic entity's instances stand at, by entity id. Absent ⇒ a Generic entity reads its listed locations. */
  genericPositions?: Readonly<Record<string, readonly string[]>>;
  /** The ids of the entities following the player. Absent ⇒ none. */
  followers?: readonly string[];
  /** The ids of the followers left waiting. Absent ⇒ none. */
  waiting?: readonly string[];
  /** Each Unique entity's routine action and hold, by id, from the same book as `positions`. Absent ⇒ none. */
  routineNow?: Readonly<Record<string, RoutineReading>>;
  /** Absent, text reads as authored. */
  resolveText?: ResolveText;
  /** The story clock: the hours this turn consumed, the hours elapsed, and the calendar. */
  clock: StatClock;
  /** The Memory panel's rows as the turn began, oldest first; between turns, as they stand. Absent, `memories` is
   *  empty, as in the editor. */
  memories?: readonly SandboxMemory[];
  /** The player's notes. Absent, `notes` is empty, as in the editor. */
  notes?: string;
  /** What `turn` reads. Absent, an empty action at turn 0. */
  turn?: SandboxTurn;
  /** What scripts switched on the books' entries in play. Absent ⇒ none. */
  loreToggles?: LoreToggles;
  /** Every Item Copy in play. Absent ⇒ none. */
  itemCopies?: readonly ItemCopy[];
  /** The world's items, which `items` reads. Absent ⇒ none. */
  items?: readonly Item[];
  /** The world's slots, which an equipped Item Copy names. Absent ⇒ none. */
  slots?: readonly Slot[];
  /** The world's Currencies and the Placements that track a shopkeeper's Currency Items, which `currencies` reads and pays
   *  over. Absent ⇒ no Currency. */
  money?: { currencies: readonly Currency[]; placements: readonly Placement[] };
  /** The Bodies `body` reads, with the picks that decide which is in force. Absent ⇒ no Bodies. */
  bodies?: { world: BodyWorld & { slots?: readonly Slot[] }; persona: PersonaRef | undefined };
}

/** One entity owner's stats in the state, in the same terms as the global ones. */
export interface OwnerState extends Pick<SandboxState, 'stats' | 'enabled'> {
  /** The owner entity's id. */
  id: string;
}

/** One entity owner's part of this turn alone, in the same terms as the turn owner's. */
export interface OwnerTurn extends Pick<StatCodeTurn, 'previous' | 'regenApplied'> {
  /** Absent ⇒ none. */
  asks?: StatCodeTurn['asks'];
}

/** The stats of the state a timing began from, by scope. */
export interface TimingStart {
  stats: readonly PlayerStat[];
  owners: Readonly<Record<string, readonly PlayerStat[]>>;
}

/** `state`'s stats as a timing's start. */
export const timingStartOf = (state: SandboxState): TimingStart => ({
  stats: state.stats, owners: Object.fromEntries((state.owners ?? []).map((owner) => [owner.id, owner.stats])),
});

/** Everything one turn hands to stat code: the state, and what this turn alone brings. The forward turn and
 *  the re-roll both build one of these; a turn with no stat response builds one with no asks. Scripts run one by
 *  one in run order, the Scripts tab's (see `rowOrder`). Each reads a fresh snapshot of what the script before
 *  left: the global stats as `stats`, its owner's as `owner.stats`, and each one's as `entities[x].stats`. */
export interface StatCodeTurn {
  state: SandboxState;
  /** Which timing's scripts run. `before`, `start` and `output` run over the turn's starting state, reading each AI
   *  and regen `delta` as zero and `previous` as the value when the timing began, whatever the turn carries. `after`,
   *  the default, runs over the asks and the regen. `output` runs one sentence: see `narration`. */
  timing?: RunTiming;
  /** The sentence an `output` run rewrites. The run's scripts chain in run order: each reads the sentence the
   *  one before it left. */
  narration?: NarrationInput;
  /** The switch a `switch` run fires on. The run's state is the one the switch left. */
  switched?: TraitSwitchEvent;
  /** The global stats a penalty's "no script moved it" compares against, when a nested run fired inside a timing
   *  that began earlier. Absent ⇒ when this run began. */
  penaltyStart?: readonly PlayerStat[];
  /** The world the switches held under before they fired, when it differs (a persona change). A switch-off's
   *  trait reads this one (Q16). Absent ⇒ `ownerTraits.world`. */
  switchedFrom?: TraitWorld;
  /** The world's own scripts, which run with no `self` and no `owner`. Absent ⇒ none. */
  worldScripts?: readonly Script[];
  /** The Scripts tab's row keys at this timing in run order (`runRowKeys`). The turn runs each row's scripts at
   *  its place, and the library entities' after every row. Absent ⇒ owner order, scripts with an `order` first. */
  rowOrder?: readonly string[];
  /** The Scripts tab's row keys at When a Trait Switches (`runRowKeys`), which every switch run this turn fires reads
   *  as its `rowOrder`. */
  switchRowOrder: readonly string[];
  /** The global stats as they stood at the start of the turn, matched by id. A stat missing here reads its
   *  `previous` as a copy of its own current entry. */
  previous: readonly PlayerStat[];
  /** The stats `previous` reads at a timing that reads the turn start, when the run began earlier than this call:
   *  a reply's first sentence (Q27). Absent ⇒ the state this call was handed. */
  timingStart?: TimingStart;
  /** This turn's AI asks, raw: before flags and clamping. */
  asks: readonly (ValueAndMax & { id: string })[];
  /** Regen applied this turn, by stat id. */
  regenApplied: Readonly<Record<string, number>>;
  /** Each entity owner's part of this turn, by owner id. An owner missing here reads its `previous` as its
   *  own stats, with no asks and no regen. */
  ownerTurns?: Readonly<Record<string, OwnerTurn>>;
  /** A stat's name as the player reads it, for the turn log. Required, not defaulted: a caller that left
   *  it out would print an unresolved chip token in a line the player reads. */
  statNameOf: (stat: PlayerStat) => string;
  /** A trait's name as the player reads it, for the trait switch log. Required for the same reason
   *  `statNameOf` is; code reaches the trait by its code name, which the turn derives itself. */
  traitNameOf: (trait: Trait) => string;
  /** Stat id → the value a penalty takes from the turn owner's stat after the run, unless code moves that stat:
   *  the starvation penalty. */
  penalties?: Readonly<Record<string, number>>;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
  /** World Tool calls that run ahead of every script of the timing, in this order (Q4). Absent ⇒ none. */
  triggers?: readonly ScriptTrigger[];
  /** Runs `triggers` and `replayed` alone, as an On Call Tool does. */
  triggersOnly?: boolean;
  /** Runs the scripts alone, as Regenerate Choices does: `choices` is the one thing the result carries, and every
   *  `player` call answers through {@link silentPrompts} (Q10, Q20). */
  choicesOnly?: boolean;
  /** Saved World Tool writes laid on ahead of `triggers`, in this order, with no script run (Q41). */
  replayed?: readonly ReplayedTrigger[];
  /** The Item Copy event an item run fires on: its item's scripts of the event's timing run alone. */
  itemEvent?: ItemEventRun;
  /** How a script's inventory writes apply, before the next script runs. */
  inventory: InventoryStep;
}

/** One Item Copy event and its item, with the item's name as the player reads it. */
export interface ItemEventRun {
  event: ItemScriptEvent;
  item: Pick<Item, 'id' | 'name' | 'scripts'>;
  itemName: string;
}

/** One World Tool call a run fires: the Tool's name, its script, and the call's arguments. */
export interface ScriptTrigger {
  name: string;
  code: string;
  args: Readonly<Record<string, unknown>>;
}

/** What a World Tool call's script wrote to stats, pins, traits and items, in the shape a save keeps. Its scene
 *  writes are left out: a stat re-roll keeps the turn's location, clock and cast. */
export interface SavedScriptWrites {
  stats?: { owner: OwnerId; writes: TargetWrite[] }[];
  placeholders?: PlaceholderWrite[];
  traits?: StatTraitWrites;
  /** Absent ⇒ none (Q50). */
  lore?: LoreWrite[];
  /** Absent ⇒ none. A write naming a copy the turn made skips on replay, which makes new ids (Q49). */
  inventory?: InventoryOp[];
}

/** A World Tool call replayed from its saved writes: the Tool's name, for the switch log, and the writes. */
export interface ReplayedTrigger {
  name: string;
  writes: SavedScriptWrites;
}

/** What the run's first trigger answered: its return value as text, or why it failed. */
export type TriggerReply = { text: string | null } | { error: string };

/** One entity owner's stats and its part of this turn, as play assembles them. */
export type OwnerCodeTurn = OwnerState & OwnerTurn;

/** Owner rows split into the board's part and this turn's part, by owner id. */
export function splitOwnerTurns(rows: readonly OwnerCodeTurn[]): { owners: OwnerState[]; ownerTurns: Record<string, OwnerTurn> } {
  return {
    owners: rows.map(({ id, stats, enabled }) => ({ id, stats, enabled })),
    ownerTurns: Object.fromEntries(rows.map(({ id, previous, regenApplied, asks }) => [id, { previous, regenApplied, ...(asks ? { asks } : {}) }])),
  };
}

/** What one entity owner's code and the run's trait switches did to its stats. */
export type OwnerCodeResult = Pick<StatCodeTurnResult, 'stats' | 'moved' | 'boundsChanged' | 'hiddenChanged'> & {
  /** The owner's stat traits in force after the switches; absent when code switched no trait. */
  inForce?: Trait[];
};

export interface StatCodeTurnResult {
  /** `stats` with the trait switches, then the code writes, applied, in the same order; the same array when
   *  nothing moved. */
  stats: readonly PlayerStat[];
  /** Ids of the stats whose value the run moved, in stat order. */
  moved: string[];
  /** Ids of the stats whose code delta the run changed, in stat order. */
  boundsChanged: string[];
  /** Ids of the stats the run hid or showed, in stat order. */
  hiddenChanged: string[];
  /** Where two stats touched one placeholder, the later stat's action is the one here. */
  pinWrites: PinWrites;
  /** Absent when code switched no trait. */
  traits?: StatCodeTraitResult;
  /** Each entity owner's result by owner id; absent when the turn named none. */
  owners?: Readonly<Record<string, OwnerCodeResult>>;
  /** The one stat snapshot every settle in the run read (Q19): asks, regen, `penalties` and code writes applied,
   *  before any trait switch moved a stat. */
  gateStats: GateStats;
  /** The sentence an `output` run left: as it came when no script changed it. Absent on any other run. */
  sentence?: string;
  /** The `turn.choices` an `after` run's scripts left, in run order. Absent when none changed it. */
  choices?: readonly string[];
  /** The run's location, clock and discovery writes, merged in run order. Absent when no script wrote one. */
  worldWrites?: WorldWrites;
  /** Every entry field the run's scripts wrote, in run order, so the later write wins. Absent when none wrote one. */
  loreWrites?: LoreWrite[];
  /** What the run's inventory writes left. Absent when no script wrote one. */
  items?: ChainedItems;
  /** Present on a run with triggers. */
  reply?: TriggerReply;
  /** What the run's first trigger wrote, when it ran clean. */
  triggerWrites?: SavedScriptWrites;
}

/** The Item Copies a run left. `worldWrites.inventory` holds the writes that made them, automatic unequips included. */
export interface ChainedItems {
  /** The Item Copies the run began from. */
  from: readonly ItemCopy[];
  copies: readonly ItemCopy[];
  /** The module's skips, the settles' log lines, and a line per event that fired no script. */
  log: readonly string[];
  /** The uses the writes made, which start their After Use effects. */
  itemUses: readonly ItemUse[];
  /** The item events a During AI Output write holds back until the After batch. */
  heldEvents: readonly ItemScriptEvent[];
  /** The Item Copies a Body took off in the chain's settles, which the commit's Body line names. */
  offByBody: readonly ItemCopy[];
}

const mergedWorldWrites = (writers: readonly (WorldWrites | undefined)[]): WorldWrites | undefined =>
  writers.reduce<WorldWrites | undefined>(mergeWorldWrites, undefined);

/** Placeholder id → what code pinned it to, or null where code unpinned it. An Object's pin is a list. */
export type PinWrites = Readonly<Record<string, string | string[] | null>>;

/** Whether two stored pins hold the same thing, so a rewrite of the same pin mints no new state. */
const samePin = (a: string | readonly string[] | undefined, b: string | readonly string[]): boolean => {
  if (typeof a === 'string' || a === undefined) return a === b;
  return Array.isArray(b) && a.length === b.length && a.every((item, i) => item === b[i]);
};

/** `codePins` with a turn's pin writes laid on; the same object when they change nothing. */
export function withPinWrites(codePins: CodePins, pinWrites: PinWrites): CodePins {
  const changed = Object.entries(pinWrites)
    .filter(([id, pin]) => (pin === null ? id in codePins : !samePin(codePins[id], pin)));
  if (!changed.length) return codePins;
  const next: Record<string, string | readonly string[]> = { ...codePins };
  for (const [id, pin] of changed) {
    if (pin === null) delete next[id];
    else next[id] = pin;
  }
  return next;
}

/** Lay a turn's code result onto the latest stats, which may have moved since the run read its snapshot:
 *  only a value the run moved, the code delta it changed and the `hidden` it flipped apply, re-derived
 *  onto the latest bases. After a trait switch every stat re-derives, under the traits the switch left in force. */
export function overlayStatCodeResult(
  latest: readonly PlayerStat[],
  result: OwnerCodeResult & { traits?: Pick<StatCodeTraitResult, 'inForce'> },
  active: readonly Trait[],
): PlayerStat[] {
  const coded = new Map(result.stats.map((stat) => [stat.id, stat]));
  const switched = result.traits?.inForce ?? result.inForce;
  const inForce = switched ?? active;
  return latest.map((stat) => {
    const run = coded.get(stat.id);
    const value = run && result.moved.includes(stat.id) ? run.value : stat.value;
    const withHidden = run && result.hiddenChanged.includes(stat.id) ? { ...stat, hidden: run.hidden === true } : stat;
    if (run && result.boundsChanged.includes(stat.id)) return withCodeDelta(withHidden, run.codeDelta, value, inForce);
    if (switched) return withCodeDelta(withHidden, stat.codeDelta, value, inForce);
    return value === stat.value ? withHidden : { ...withHidden, value };
  });
}

/** A playthrough's placeholder set, short of the pins each run reads at its own base. The authored books in
 *  play are the ones `runtimeDictionaries` leaves on. */
export function playthroughPlaceholderSet({ runtimeDictionaries, ...set }: Omit<StatCodePlaceholderSet, 'inPlayDictionaryIds'> & {
  runtimeDictionaries: readonly Dictionary[];
}): StatCodePlaceholderSet {
  return { ...set, inPlayDictionaryIds: new Set(runtimeDictionaries.filter((book) => book.enabled !== false).map((book) => book.id)) };
}

/** Each result field that lists dropped writes, and how the turn's warning describes it. */
const RESULT_WARNINGS = {
  unknownPlaceholders: 'wrote placeholders the world does not have',
  unknownOwnerPlaceholders: 'wrote placeholders of owners not in the game',
  unknownTraits: 'switched traits the world does not have',
  acquiredWrites: 'wrote acquired on',
  readOnlyWrites: 'wrote read-only fields',
  unknownStatWrites: 'wrote stats that do not exist',
  disabledStatWrites: 'wrote switched-off stats',
  unknownEntities: 'switched traits of entities not in the game',
  unknownLore: 'wrote dictionary entries the game does not have',
} as const satisfies Partial<Record<keyof StatCodeResult, string>>;

/** Each entity row field that lists dropped writes, and how the warning describes it for `whose` traits. */
const ENTITY_WARNINGS = {
  unknownTraits: (whose: string) => `switched traits ${whose} does not have`,
  acquiredWrites: (whose: string) => `wrote acquired on traits of ${whose}`,
} as const satisfies Partial<Record<keyof EntityTraitWrites, (whose: string) => string>>;

/** Warn of every write a run dropped, one line per result field that lists any. `who` names the script. */
function warnDroppedWrites(who: string, result: StatCodeResult): void {
  const warn = (message: string, names: readonly string[] | undefined) => {
    if (names) console.warn(`${who} ${message}: ${names.join(', ')}`);
  };
  for (const [field, message] of Object.entries(RESULT_WARNINGS) as [keyof typeof RESULT_WARNINGS, string][]) {
    warn(message, result[field]);
  }
  for (const row of result.entities ?? []) {
    for (const [field, message] of Object.entries(ENTITY_WARNINGS) as [keyof typeof ENTITY_WARNINGS, (whose: string) => string][]) {
      warn(message(row.owner ? 'the owner' : row.entity || 'the persona'), row[field]);
    }
  }
}

/** The owner name a world script's fallback label carries (Q6). */
const WORLD_OWNER = 'World';

/** A run's scope: global scope, with a null id, or an entity owner. */
type RunOwner = Omit<OwnerCodeTurn, 'id'> & { id: OwnerId };

/** One scope's part of a run: its stats under their code names, its turn inputs, and the scripts that run. */
interface OwnerRun<O extends RunOwner = RunOwner> {
  owner: O;
  named: PlayerStat[];
  inputs: Record<string, StatTurnInputs>;
  /** In owner order: the world's scripts on the global run, then each enabled stat's in stat order, then each
   *  active trait's in tree order. */
  units: ScriptUnit[];
}

/** One script's run in a scope: its stat or its trait (neither for a world script), and what it wrote. */
interface ScriptUnit {
  home: UnitHome;
  stat: PlayerStat | null;
  trait?: Trait;
  /** An item script's item name, as the player reads it. */
  itemName?: string;
  script: Script;
  /** A World Tool call's arguments; absent on a Script. */
  args?: ScriptTrigger['args'];
  /** Absent until the script ran clean. */
  writes?: ScriptWrites;
}

/** What one script wrote. `stats` holds its stat writes by target scope. */
interface ScriptWrites {
  stats: ReadonlyMap<OwnerId, readonly TargetWrite[]>;
  placeholders: readonly PlaceholderWrite[];
  traits?: StatTraitWrites;
  world?: WorldWrites;
  lore?: readonly LoreWrite[];
}

/** One stat's fields a box wrote. */
type TargetWrite = Pick<StatWrite, 'id' | 'value' | keyof CodeBounds | 'hidden'>;

/** A target's merged write, as `settleWrites` lays it on. */
type SettledWrite = { value: number | null; bounds: CodeBounds | null; hidden: boolean | null };

/** What one run wrote, by target scope: its own stat first, under `ownerId`; its `stats` writes under global
 *  scope; then each entity's. A world script has no stat of its own. */
function targetWrites(stat: PlayerStat | null, result: StatCodeResult, ownerId: OwnerId): Map<OwnerId, TargetWrite[]> {
  const out = new Map<OwnerId, TargetWrite[]>();
  const add = (id: OwnerId, writes: readonly TargetWrite[] = []) => {
    if (writes.length) out.set(id, [...out.get(id) ?? [], ...writes]);
  };
  if (stat && (result.value !== null || result.bounds || result.hidden !== undefined)) {
    add(ownerId, [{
      id: stat.id, ...result.bounds, ...(result.value === null ? {} : { value: result.value }),
      ...(result.hidden === undefined ? {} : { hidden: result.hidden }),
    }]);
  }
  add(null, result.statWrites);
  for (const row of result.ownerStatWrites ?? []) add(row.ownerId, row.writes);
  return out;
}

/** `writes` as a save keeps them; empty fields are left out. */
function savedWrites({ stats, placeholders, traits, lore, world }: ScriptWrites): SavedScriptWrites {
  return {
    ...(stats.size ? { stats: [...stats].map(([owner, writes]) => ({ owner, writes: [...writes] })) } : {}),
    ...(placeholders.length ? { placeholders: [...placeholders] } : {}),
    ...(traits ? { traits } : {}),
    ...(lore?.length ? { lore: [...lore] } : {}),
    ...(world?.inventory?.length ? { inventory: [...world.inventory] } : {}),
  };
}

/** Saved writes as a run lays them on. */
const scriptWritesOf = ({ stats = [], placeholders = [], traits, lore, inventory }: SavedScriptWrites): ScriptWrites => ({
  stats: new Map(stats.map(({ owner, writes }) => [owner, writes])), placeholders, ...(traits ? { traits } : {}), ...(lore ? { lore } : {}),
  ...(inventory ? { world: { inventory } } : {}),
});

/** One script's writes by target scope, each target stat's merged field by field, its later write winning a field. */
function statWritesByOwner(writes: ScriptWrites | undefined): Map<OwnerId, Map<string, SettledWrite>> {
  const out = new Map<OwnerId, Map<string, SettledWrite>>();
  for (const [ownerId, targets] of writes?.stats ?? []) {
    const owner = out.get(ownerId) ?? new Map<string, SettledWrite>();
    out.set(ownerId, owner);
    for (const { id, value, hidden, ...bounds } of targets) {
      const at = owner.get(id) ?? { value: null, bounds: null, hidden: null };
      const written = Object.fromEntries(CODE_BOUND_FIELDS.flatMap((field) => (bounds[field] === undefined ? [] : [[field, bounds[field]]])));
      owner.set(id, {
        value: value ?? at.value,
        bounds: Object.keys(written).length ? { ...at.bounds, ...written } : at.bounds,
        hidden: hidden ?? at.hidden,
      });
    }
  }
  return out;
}

function ownerRun<O extends RunOwner>(
  owner: O, timing: RunTiming, placeholderDefs: readonly Placeholder[], worldScripts: readonly Script[] = [],
  /** The owner's active traits, whose scripts run after its stats' (Q3). */
  traits: readonly Trait[] = [],
): OwnerRun<O> {
  // Code reaches a stat by its code name, which no roll moves. The log and the panel keep the rolled text.
  const named = statCodeNamed(owner.stats, placeholderDefs);
  const previous = new Map(statCodeNamed(owner.previous, placeholderDefs).map((stat) => [stat.id, stat]));
  const asks = new Map((owner.asks ?? []).map((ask) => [ask.id, ask]));
  // Only what this turn knows; the executor reads a missing part as untouched. The before box, the start
  // scripts and the output scripts run at the turn's start, so they hand over only `previous`, the value when the
  // timing began (Q13): the executor then reads every AI and regen delta as zero, whatever the turn it rides in holds.
  const inputs: Record<string, StatTurnInputs> = Object.fromEntries(named.map((stat) => {
    const before = previous.get(stat.id);
    if (readsTurnStart(timing)) return [stat.id, { previous: before }];
    const ask = asks.get(stat.id);
    return [stat.id, {
      previous: before,
      delta: { ai: ask && { value: ask.value, max: ask.max }, regen: { value: owner.regenApplied[stat.id] } },
    }];
  }));
  const statHome = (stat: PlayerStat): UnitHome =>
    (owner.id === null ? { kind: 'globalStat', stat } : { kind: 'entityStat', entityId: owner.id, stat });
  const units: ScriptUnit[] = [
    ...filledScriptsAt({ scripts: worldScripts }, timing).map((script): ScriptUnit => ({ home: { kind: 'world' }, stat: null, script })),
    ...named.filter((stat) => owner.enabled[stat.id] !== false)
      .flatMap((stat) => filledScriptsAt(stat, timing).map((script): ScriptUnit => ({ home: statHome(stat), stat, script }))),
    ...traits.flatMap((trait) => filledScriptsAt(trait, timing)
      .map((script): ScriptUnit => ({ home: { kind: 'trait', trait, entityId: owner.id }, stat: null, trait, script }))),
  ];
  return { owner, named, inputs, units };
}

/**
 * `units` in the order they run. With `rowOrder`, the Scripts tab's row keys, each row's units run back to back at
 * the row's place and the library entities' run after every row (Q8, Q9); the units no row names follow the rows,
 * in the order given. Without it, the owners' order: scripts with an `order` first.
 */
function rowedUnits<T extends { unit: ScriptUnit; run: OwnerRun; script: Script }>(
  units: readonly T[], rowOrder: readonly string[] | undefined, owners: StatCodeOwners,
): T[] {
  if (!rowOrder) return inRunOrder(units);
  const entities = new Map([...owners.entities ?? [], ...owners.library ?? []].map((entity) => [entity.id, entity]));
  const libraryIds = new Set((owners.library ?? []).map((entity) => entity.id));
  const rows = new Set(rowOrder);
  const byRow = new Map<string, T[]>();
  const loose: T[] = [];
  const library: T[] = [];
  for (const entry of units) {
    if (libraryIds.has(entry.run.owner.id ?? '')) {
      library.push(entry);
      continue;
    }
    const key = rowKeyOf(entry.unit.home, entry.script.id, entities);
    if (key !== null && rows.has(key)) byRow.set(key, [...byRow.get(key) ?? [], entry]);
    else loose.push(entry);
  }
  return inRowOrder(rowOrder.map((key) => byRow.get(key) ?? []), [...loose, ...library]);
}

/** Nested rounds of switch runs one script's switch fires before a further switch stops firing scripts (Q47). */
export const SWITCH_DEPTH_CAP = 8;

/** Switch runs one action fires across all depths before a further switch fires no script (Q40). */
export const SWITCH_RUN_TOTAL = 100;

/** One action's limit on the runs it nests, shared across all depths. */
export interface RunTotal {
  /** Whether one more run may fire. The first refusal warns. */
  take: () => boolean;
}

/** A fresh {@link RunTotal} of `total` runs, which reports `refused` once. */
export function runTotal(total: number, refused: string, report: (line: string) => void = console.warn): RunTotal {
  let left = total;
  let warned = false;
  return {
    take: () => {
      if (left > 0) {
        left -= 1;
        return true;
      }
      if (!warned) report(refused);
      warned = true;
      return false;
    },
  };
}

/** Item runs one action fires across all levels before a further event fires no script. */
export const ITEM_RUN_TOTAL = 100;

/** The limits every run of one action spends, across each between-turn pass it starts (Q40, Q45, Q55). */
export interface ActionTotals {
  switches: RunTotal;
  itemRuns: RunTotal;
}

/** Full totals for one action. `reportItems` takes the item total's one line. */
export const actionTotals = (reportItems: (line: string) => void): ActionTotals => ({
  switches: runTotal(SWITCH_RUN_TOTAL, `Trait switches fired ${SWITCH_RUN_TOTAL} runs in one action; further switches skipped their scripts`),
  itemRuns: runTotal(ITEM_RUN_TOTAL, `Item scripts fired ${ITEM_RUN_TOTAL} runs in one action; further events skipped their scripts`, reportItems),
});

/** What every run nested inside one action shares. */
interface ActionRuns extends ActionTotals {
  /** The turn the action began from, which a settle reads the runs so far over. */
  root: StatCodeTurn;
  /** Every script's result so far, in order. */
  runsSoFar: StatCodeTurnResult[];
  log: string[];
  itemUses: ItemUse[];
  offByBody: ItemCopy[];
}

/** Where an action's own runs sit. */
const ACTION_TOP: RunNesting = { switchDepth: 0, itemLevel: 1 };

const actionRunsOf = (root: StatCodeTurn, totals?: ActionTotals): ActionRuns => {
  const log: string[] = [];
  return { root, runsSoFar: [], log, itemUses: [], offByBody: [], ...(totals ?? actionTotals((line) => log.push(line))) };
};

/** How deep a run sits: its nested switch rounds, and the level its inventory writes fire their item events at. */
interface RunNesting {
  switchDepth: number;
  itemLevel: number;
}

/** `result` with what its whole action logged and used. */
function withActionItems(result: StatCodeTurnResult, { log, itemUses, offByBody }: ActionRuns): StatCodeTurnResult {
  if (!result.items) return result;
  return {
    ...result,
    items: { ...result.items, log: [...result.items.log, ...log], itemUses: [...result.items.itemUses, ...itemUses], offByBody: [...result.items.offByBody, ...offByBody] },
  };
}

/** Run one timing's scripts over one turn in the sandbox. Each script's trait switches and inventory writes fire their
 *  runs at once, before the next script (Q5). An `output` run's fire with the After batch instead, where its writes
 *  apply (Q42). */
export const runStatCodeTurn = (turn: StatCodeTurn): Promise<StatCodeTurnResult> => runScripts(turn);

/** An `output` run's `result` with the runs its switches and inventory writes fire, as one result over `turn`. */
export async function withSwitchRuns(turn: StatCodeTurn, result: StatCodeTurnResult): Promise<StatCodeTurnResult> {
  const after = afterRun(turn, result);
  const fired = switchesBetween(turn, after);
  if (!fired.length && !result.items) return result;
  const action = { ...actionRunsOf(turn), runsSoFar: [result] };
  const steps = [result];
  let now = fired.length ? await switchRuns(after, fired, ACTION_TOP, steps, action) : after;
  if (result.items) {
    const unequips = settledCopies(now, action, result.items.itemUses);
    if (unequips.ops.length) steps[0] = { ...result, worldWrites: mergeWorldWrites(result.worldWrites, { inventory: unequips.ops }) };
    now = await itemRuns(unequips.at, [...result.items.heldEvents, ...unequips.events], ACTION_TOP, steps, action);
  }
  const chained = withActionItems(chainedResult(turn, steps, now), action);
  return chained.items ? { ...chained, items: { ...chained.items, heldEvents: [] } } : chained;
}

/** How many levels of item events fire item scripts: a turn's or a panel's event is level 1 (Q66). */
export const ITEM_EVENT_DEPTH = 3;

/** Lays inventory writes onto Item Copies through the Inventory module, with the events they fire. */
export type ApplyInventory = (copies: readonly ItemCopy[], ops: readonly InventoryOp[], so?: StatCodeTurnResult) => Pick<InventoryResult, 'copies' | 'events' | 'diagnostics' | 'itemUses'>;

/**
 * The inventory settle over `copies`, as if the runs had stopped there: `itemUses` are every use so far, and
 * `so` is the runs so far as one result. Hands back the Item Copies with the automatic unequips applied, their
 * events, the settle's log lines, and the copies a Body took off.
 */
export type SettleCopies = (copies: readonly ItemCopy[], itemUses: readonly ItemUse[], so: StatCodeTurnResult) =>
  { copies: readonly ItemCopy[]; events: readonly ItemScriptEvent[]; log: readonly string[]; offByBody?: readonly ItemCopy[] };

/** How a script's inventory writes apply in the chain. */
export interface InventoryStep {
  /** The items whose scripts the events fire. */
  items: readonly Pick<Item, 'id' | 'name' | 'scripts' | 'unidentifiedName'>[];
  apply: ApplyInventory;
  itemNameOf: (item: Pick<Item, 'name'>) => string;
  /** Absent = no settle after a write. */
  settle?: SettleCopies;
}

/** The step of a run with no game behind it: the Inventory module over the state's world, with no settle. */
export const stateInventory = ({ items = [], slots, bodies }: Pick<SandboxState, 'items' | 'slots' | 'bodies'>): InventoryStep => ({
  items,
  apply: (copies, ops) => applyInventoryOps(copies, ops, {
    world: { ...bodies?.world, items, ...(slots ? { slots } : {}) }, source: 'script', newId: randomUUID, ...(bodies?.persona ? { persona: bodies.persona } : {}),
  }),
  itemNameOf: (item) => item.name,
});

/** Where a batch of item events starts. */
export interface ItemRunOptions {
  /** The level the events fire at. Absent = 1. */
  depth?: number;
  /** The totals of the action this batch is a pass of. Absent = the batch is its own action. */
  totals?: ActionTotals;
}

/** What the item runs of one batch of events left. */
export interface ItemRunsResult {
  /** The runs as one result over the turn, their inventory writes taken out; null when no script ran. */
  result: StatCodeTurnResult | null;
  /** The Item Copies after every run's inventory writes. */
  copies: readonly ItemCopy[];
  /** The module's skips, the settles' log lines, and one line per event past the depth cap. */
  diagnostics: string[];
  /** The uses the runs' writes made, which start their After Use effects. */
  itemUses: ItemUse[];
  /** Every inventory write the runs applied, the settle's unequips among them, in order, for a caller whose Item
   *  Copies moved meanwhile. */
  ops: InventoryOp[];
  /** The Item Copies a Body took off in the runs' settles. */
  offByBody: ItemCopy[];
}

/**
 * Each event's item scripts, in order, over the state the run before left; `turn.state.itemCopies` is the state
 * the events left. A run's inventory writes go through the step's `apply` at once, and their events nest one level
 * deeper, with the automatic unequips its `settle` finds after that write (Q66). Past {@link ITEM_EVENT_DEPTH} the
 * writes still apply, but their events fire nothing (Q66, Q140). A run's own trait switches fire their switch runs
 * at once, whose inventory writes apply with the run's.
 */
export async function runItemScripts(
  turn: StatCodeTurn, events: readonly ItemScriptEvent[], inventory: InventoryStep, { depth = 1, totals }: ItemRunOptions = {},
): Promise<ItemRunsResult> {
  const start: StatCodeTurn = { ...turn, inventory };
  const action = actionRunsOf(start, totals);
  const steps: StatCodeTurnResult[] = [];
  const end = await itemRuns(start, events, { ...ACTION_TOP, itemLevel: depth }, steps, action);
  const base = { copies: end.state.itemCopies ?? [], diagnostics: action.log, itemUses: action.itemUses, offByBody: action.offByBody };
  if (!steps.length) return { ...base, result: null, ops: [] };
  const { items: _landed, worldWrites, ...chained } = chainedResult(start, steps, end);
  const rest = withoutInventory(worldWrites);
  return { ...base, result: { ...chained, ...(rest ? { worldWrites: rest } : {}) }, ops: worldWrites?.inventory ?? [] };
}

/** `events`' item scripts in order, at `itemLevel`, each over the state the run before left. Every run joins `steps`. */
async function itemRuns(
  turn: StatCodeTurn, events: readonly ItemScriptEvent[], { switchDepth, itemLevel }: RunNesting, steps: StatCodeTurnResult[], action: ActionRuns,
): Promise<StatCodeTurn> {
  const byId = new Map(turn.inventory.items.map((item) => [item.id, item]));
  let now = turn;
  for (const event of events) {
    const item = byId.get(event.itemId);
    if (!item || !filledScriptsAt(item, event.timing).length) continue;
    // The run names the item by the face its copy shows (Q17).
    const copy = now.state.itemCopies?.find((c) => c.id === event.copyId) ?? event.was;
    const itemName = turn.inventory.itemNameOf({ name: faceName(item, !!copy && isUnidentified(copy)) });
    if (itemLevel > ITEM_EVENT_DEPTH) {
      action.log.push(`Item scripts nested past ${ITEM_EVENT_DEPTH} levels; ${SCRIPT_TIMING_LABEL[event.timing]} of ${itemName} did not run`);
      continue;
    }
    if (!action.itemRuns.take()) continue;
    const step = await runScripts(itemRunOf(now, { event, item, itemName }), { switchDepth, itemLevel: itemLevel + 1 }, action);
    steps.push(step);
    now = afterRun(now, step);
  }
  return now;
}

/** `turn` after the settle of its Item Copies, with the automatic unequips as events and writes. */
function settledCopies(turn: StatCodeTurn, action: ActionRuns, usedBefore: readonly ItemUse[] = []): { at: StatCodeTurn; events: readonly ItemScriptEvent[]; ops: InventoryOp[] } {
  const { settle } = turn.inventory;
  if (!settle) return { at: turn, events: [], ops: [] };
  const settled = settle(turn.state.itemCopies ?? [], [...usedBefore, ...action.itemUses], chainedResult(action.root, action.runsSoFar, turn));
  action.log.push(...settled.log);
  action.offByBody.push(...(settled.offByBody ?? []));
  return {
    at: { ...turn, state: { ...turn.state, itemCopies: settled.copies } },
    events: settled.events,
    ops: settled.events.map((e): InventoryOp => ({ kind: 'unequip', copyId: e.copyId })),
  };
}

/**
 * `step` with the script's inventory writes applied over `next`, the state they left, and the item events they
 * fire. An `output` run's events wait in `step` for the After batch, and its settle with them (Q36).
 */
function landedInventory(
  next: StatCodeTurn, step: StatCodeTurnResult, action: ActionRuns,
  { ops, from, holdsEvents }: { ops: readonly InventoryOp[]; from: readonly ItemCopy[]; holdsEvents: boolean },
): { step: StatCodeTurnResult; next: StatCodeTurn; events: readonly ItemScriptEvent[] } {
  const landed = next.inventory.apply(next.state.itemCopies ?? [], ops, chainedResult(action.root, action.runsSoFar, next));
  action.log.push(...landed.diagnostics);
  action.itemUses.push(...landed.itemUses);
  const applied = { ...next, state: { ...next.state, itemCopies: landed.copies } };
  const settled = holdsEvents ? { at: applied, events: [], ops: [] } : settledCopies(applied, action);
  const items: ChainedItems = { from, copies: settled.at.state.itemCopies ?? [], log: [], itemUses: [], heldEvents: holdsEvents ? landed.events : [], offByBody: [] };
  const worldWrites = settled.ops.length ? mergeWorldWrites(step.worldWrites, { inventory: settled.ops }) : step.worldWrites;
  return {
    step: { ...step, items, ...(worldWrites ? { worldWrites } : {}) }, next: settled.at,
    events: holdsEvents ? [] : [...landed.events, ...settled.events],
  };
}

/** `writes` without their inventory writes; undefined when nothing else is left. */
export function withoutInventory(writes: WorldWrites | undefined): WorldWrites | undefined {
  if (!writes) return writes;
  const { inventory: _landed, ...rest } = writes;
  return Object.keys(rest).length ? rest : undefined;
}

/** `writes` without their Body writes; undefined when nothing else is left. */
export function withoutBodies(writes: WorldWrites | undefined): WorldWrites | undefined {
  if (!writes) return writes;
  const { bodies: _landed, ...rest } = writes;
  return Object.keys(rest).length ? rest : undefined;
}

/** One switch run per event, over `turn`, the state the switches left (Q12, Q47). `totals` are those of the action
 *  this batch is a pass of; absent = the batch is its own action. Null when no run fired. */
export async function runSwitchScripts(turn: StatCodeTurn, events: readonly TraitSwitchEvent[], totals?: ActionTotals): Promise<StatCodeTurnResult | null> {
  if (!events.length) return null;
  const action = actionRunsOf(turn, totals);
  const steps: StatCodeTurnResult[] = [];
  const now = await switchRuns(turn, events, ACTION_TOP, steps, action);
  if (!steps.length) return null;
  return withActionItems(chainedResult(turn, steps, now), action);
}

/** The traits that switched from one turn's state to the next's, as the timing fires on them. */
const switchesBetween = (from: StatCodeTurn, to: StatCodeTurn): TraitSwitchEvent[] =>
  traitSwitchEvents(forceStateOf(from), forceStateOf(to), to.state.ownerTraits.world);

/** `turn` as the switch run of `switched` runs over it: only the state and the turn's readings carry over. A World
 *  Tool's call, a sentence and an item event belong to the run that fired it. */
function switchRunOf(turn: StatCodeTurn, switched: TraitSwitchEvent): StatCodeTurn {
  const { itemEvent: _i, ...rest } = nestedRunBase(turn);
  return { ...rest, timing: 'switch', switched, rowOrder: turn.switchRowOrder };
}

/** `turn` as the item run of `itemEvent` runs over it. Like a switch run, only the state and the turn's readings carry over. */
function itemRunOf(turn: StatCodeTurn, itemEvent: ItemEventRun): StatCodeTurn {
  const { switched: _w, switchedFrom: _f, ...rest } = nestedRunBase(turn);
  return { ...rest, timing: itemEvent.event.timing, itemEvent };
}

/** `turn` without what only the run that fired a nested run owns. */
function nestedRunBase(turn: StatCodeTurn) {
  const { triggers: _t, replayed: _r, triggersOnly: _o, narration: _n, timingStart: _s, ...rest } = turn;
  return rest;
}

/** Runs `events` in order, each over the state the run before left, one round below `nesting`, while the total
 *  allows. Every run's result joins `steps`. */
async function switchRuns(
  turn: StatCodeTurn, events: readonly TraitSwitchEvent[], { switchDepth, itemLevel }: RunNesting, steps: StatCodeTurnResult[], action: ActionRuns,
): Promise<StatCodeTurn> {
  const depth = switchDepth + 1;
  if (depth > SWITCH_DEPTH_CAP) {
    console.warn(`Trait switches nested past ${SWITCH_DEPTH_CAP} rounds; ${events.length} switch(es) skipped their scripts`);
    return turn;
  }
  let now = turn;
  for (const switched of events) {
    if (!action.switches.take()) continue;
    const step = await runScripts(switchRunOf(now, switched), { switchDepth: depth, itemLevel }, action);
    steps.push(step);
    now = afterRun(now, step);
  }
  return now;
}

/** The trait slice of a turn, as the switch diff reads it. */
const forceStateOf = ({ state: { ownerTraits } }: StatCodeTurn): TraitForceState => ({
  traits: ownerTraits.acquired, disabledTraitIds: ownerTraits.disabledTraitIds, ownedTraits: ownerTraits.ownedTraits,
});

/** `turn` as the next run finds it after `result`: the stats, traits and pins the run left. */
export function afterRun(turn: StatCodeTurn, result: StatCodeTurnResult): StatCodeTurn {
  const { traits } = result;
  const state = withWorldWrites(turn.state, result.worldWrites);
  const ownerTraits = !traits ? state.ownerTraits : {
    ...state.ownerTraits,
    acquired: traits.acquired,
    disabledTraitIds: traits.disabledTraitIds,
    appliedValues: traits.appliedValues,
    cascadeOffTraitIds: traits.cascadeOffTraitIds,
    ownedTraits: traits.ownedTraits,
  };
  const set = state.placeholders;
  const codePins = withPinWrites(set?.codePins ?? {}, result.pinWrites);
  const pins = set?.pinsAfter?.({
    codePins, acquired: ownerTraits.acquired, disabledTraitIds: ownerTraits.disabledTraitIds, ownedTraits: ownerTraits.ownedTraits,
    stats: result.stats,
    ...(state.owners?.length && {
      entityStats: Object.fromEntries(state.owners.map((owner) => [owner.id, result.owners?.[owner.id]?.stats ?? owner.stats])),
    }),
  });
  return {
    ...turn,
    state: {
      ...state,
      stats: result.stats,
      // A trait switch can turn a stat on or off, which the next script's turn reads.
      enabled: traits ? activeStatEnabled(result.stats, traits.inForce) : state.enabled,
      gateStats: result.gateStats,
      ...(result.items ? { itemCopies: result.items.copies } : {}),
      owners: state.owners?.map((owner) => {
        const ran = result.owners?.[owner.id];
        if (!ran) return owner;
        return { ...owner, stats: ran.stats, enabled: ran.inForce ? activeStatEnabled(ran.stats, ran.inForce) : owner.enabled };
      }),
      ownerTraits,
      placeholders: set && { ...set, codePins, ...(pins ? { pins } : {}) },
      ...(result.loreWrites ? { loreToggles: withLoreWrites(state.loreToggles ?? {}, result.loreWrites) } : {}),
      // The switch runs of a commit read the choices the batch left.
      ...(result.choices && state.turn ? { turn: { ...state.turn, choices: result.choices } } : {}),
    },
  };
}

/** The stat ids a run changed: its value, its code delta, or its `hidden`. */
export type ChangedStats = Pick<StatCodeTurnResult, 'moved' | 'boundsChanged' | 'hiddenChanged'>;

/** Whether a run changed any stat. */
export const changedAnyStat = ({ moved, boundsChanged, hiddenChanged }: ChangedStats): boolean =>
  moved.length > 0 || boundsChanged.length > 0 || hiddenChanged.length > 0;

/** The ids of the stats in `now` whose value, code delta or `hidden` differs from `start`, matched by id. */
function changedStats(start: readonly PlayerStat[], now: readonly PlayerStat[]): ChangedStats {
  const was = new Map(start.map((stat) => [stat.id, stat]));
  const moved: string[] = [];
  const boundsChanged: string[] = [];
  const hiddenChanged: string[] = [];
  for (const stat of now) {
    const before = was.get(stat.id);
    if (!before) continue;
    if (stat.value !== before.value) moved.push(stat.id);
    if (!sameCodeDelta(before.codeDelta, stat.codeDelta)) boundsChanged.push(stat.id);
    if (!sameHidden(before, stat)) hiddenChanged.push(stat.id);
  }
  return { moved, boundsChanged, hiddenChanged };
}

/** Runs chained from `start` to `now`, one after the other, as one run's result over `start`. The later step
 *  wins a pin. */
export function chainedResult(start: StatCodeTurn, steps: readonly StatCodeTurnResult[], now: StatCodeTurn): StatCodeTurnResult {
  const finalStep = steps.at(-1);
  if (!finalStep) throw new Error('A chained result needs a step');
  const pinWrites: PinWrites = Object.assign({}, ...steps.map((step) => step.pinWrites));
  const worldWrites = mergedWorldWrites(steps.map((step) => step.worldWrites));
  const loreWrites = steps.flatMap((step) => step.loreWrites ?? []);
  const last = steps.findLast((step) => step.traits)?.traits;
  const logs = steps.map((step) => step.traits?.log ?? []);
  const traits: StatCodeTraitResult | undefined = last && {
    ...last, log: logs.flat(),
    logTraits: steps.flatMap((step, i) => step.traits?.logTraits ?? logs[i].map(() => null)),
  };
  const owners = start.state.owners && Object.fromEntries(start.state.owners.map((owner): [string, OwnerCodeResult] => {
    const after = now.state.owners?.find((ran) => ran.id === owner.id) ?? owner;
    const inForce = steps.findLast((step) => step.owners?.[owner.id]?.inForce)?.owners?.[owner.id]?.inForce;
    return [owner.id, { stats: after.stats, ...changedStats(owner.stats, after.stats), ...(inForce ? { inForce } : {}) }];
  }));
  const stepItems = steps.flatMap((step) => (step.items ? [step.items] : []));
  const items: ChainedItems | undefined = stepItems.length ? {
    from: stepItems[0].from, copies: now.state.itemCopies ?? [], log: stepItems.flatMap((each) => each.log),
    itemUses: stepItems.flatMap((each) => each.itemUses), heldEvents: stepItems.flatMap((each) => each.heldEvents),
    offByBody: stepItems.flatMap((each) => each.offByBody),
  } : undefined;
  return {
    stats: now.state.stats, ...changedStats(start.state.stats, now.state.stats), pinWrites, gateStats: finalStep.gateStats,
    ...(traits ? { traits } : {}), ...(owners ? { owners } : {}), ...(worldWrites ? { worldWrites } : {}),
    ...(loreWrites.length ? { loreWrites } : {}), ...(items ? { items } : {}),
  };
}

/** The scripts a run runs on traits, by scope. A switch run runs the switched trait's own scripts alone,
 *  whichever way it switched, so a trait's script sees its own switch-off (Q13). */
function scriptTraits(
  timing: RunTiming, switched: TraitSwitchEvent | undefined, inForce: Scoped<Trait[]>, world: TraitWorld,
): Scoped<readonly Trait[]> {
  if (timing !== 'switch' || !switched) return inForce;
  const trait = switchedTraitOf(switched, world);
  const own = (ownerId: OwnerId) => (trait && ownerId === switched.ownerId ? [trait] : []);
  // An owner that left the world with the switch still runs its trait's script.
  const ownerIds = new Set([...Object.keys(inForce.owners), ...(switched.ownerId === null ? [] : [switched.ownerId])]);
  return { global: own(null), owners: Object.fromEntries([...ownerIds].map((id) => [id, own(id)])) };
}

/** The world a switch's trait reads: a switch-off's is the one it held under. */
const switchedWorldOf = (turn: StatCodeTurn, switched: TraitSwitchEvent): TraitWorld =>
  (!switched.enabled && turn.switchedFrom && switchedTraitOf(switched, turn.switchedFrom) ? turn.switchedFrom : turn.state.ownerTraits.world);

/** One script's place in a plan: the unit and the scope it runs in. */
export interface PlannedUnit {
  unit: ScriptUnit;
  run: OwnerRun;
  script: Script;
}

/** The scripts a turn's state would run, in run order, and the turn inputs they read. */
interface RunPlan {
  entries: PlannedUnit[];
  readings: TurnReadings;
}

/** `entries` by their identity across the chain's states, in order. A repeated id keeps a place of its own. */
function keyedPlan(entries: readonly PlannedUnit[]): Map<string, PlannedUnit> {
  const keyed = new Map<string, PlannedUnit>();
  for (const entry of entries) {
    const { unit, run } = entry;
    const key = JSON.stringify([run.owner.id, unit.home.kind, unit.stat?.id ?? unit.trait?.id ?? null, unit.script.id]);
    let free = key;
    for (let nth = 1; keyed.has(free); nth += 1) free = `${key}#${nth}`;
    keyed.set(free, entry);
  }
  return keyed;
}

/** What `turn`'s `previous` reads at a timing that reads the turn start. */
const beganOf = (turn: StatCodeTurn): TimingStart => turn.timingStart ?? timingStartOf(turn.state);

/** Whether a script's writes change anything the next script reads or the turn commits. */
const landsAnything = ({ stats, placeholders, traits, world, lore }: ScriptWrites) =>
  stats.size > 0 || placeholders.length > 0 || !!traits || !!world || !!lore?.length;

/** The Sandbox Snapshot `turn`'s next script runs over. */
export const chainSnapshotOf = (turn: StatCodeTurn, options: Omit<SnapshotOptions, 'readings'> = {}): SandboxSnapshot =>
  snapshotOf(turn.state, { ...options, readings: planOf(turn, beganOf(turn)).readings });

/**
 * What `turn`'s state would run. `allScripts` plans every script the state could come to run, each stat on and each
 * trait in force, which fixes where a script switched on later falls in the order.
 */
function planOf(turn: StatCodeTurn, began: TimingStart, allScripts = false): RunPlan {
  const { state } = turn;
  const timing = turn.timing ?? 'after';
  const placeholderDefs = state.placeholders?.placeholders ?? [];
  const startReads = readsTurnStart(timing);
  const globalTurn: RunOwner = {
    id: null, stats: state.stats, enabled: allScripts ? {} : state.enabled, previous: startReads ? began.stats : turn.previous,
    asks: turn.asks, regenApplied: turn.regenApplied,
  };
  const world = state.ownerTraits.world;
  const switchWorld = turn.switched ? switchedWorldOf(turn, turn.switched) : world;
  // A trait's scripts run while it is active (Q3). A global pick reads the world's current trait, not its stored copy,
  // and runs in the world's tree order, not pick order (Q38).
  const force = traitForceScope(runtimeStateOf(state), world);
  const authored = new Map(world.traits.map((trait) => [trait.id, trait]));
  const globalTraits = allScripts ? [...world.traits, ...force.global.filter((trait) => !authored.has(trait.id))] : force.global;
  const ownerTraits = allScripts
    ? Object.fromEntries(Object.entries(force.owners).map(([id, held]) => [id, [...world.owners?.find((owner) => owner.id === id)?.traits ?? held]]))
    : force.owners;
  const inForce = scriptTraits(timing, turn.switched, {
    global: inAuthoredOrder(globalTraits.map((trait) => authored.get(trait.id) ?? trait), traitOrderIndex(world.traits, world.groups)),
    owners: ownerTraits,
  }, switchWorld);
  const globalRun = ownerRun(globalTurn, timing, placeholderDefs, turn.worldScripts, inForce.global);
  const entityRuns = (state.owners ?? []).map((owner) => {
    const own = turn.ownerTurns?.[owner.id];
    const previous = (startReads ? undefined : own?.previous) ?? began.owners[owner.id] ?? [];
    return ownerRun(
      { ...owner, ...(allScripts && { enabled: {} }), regenApplied: {}, ...own, previous },
      timing, placeholderDefs, [], inForce.owners[owner.id],
    );
  });
  // An owner with no stats of its own still runs its traits' scripts, in owner order: ahead of the next owner
  // with stats in authored owner order (world entities, then the library's), the owners that hold no trait last.
  const withStats = new Set(entityRuns.map((run) => run.owner.id));
  const ownerIndex = new Map([...world.entities ?? [], ...state.ownerTraits.library ?? []].map((entity, i) => [entity.id, i]));
  const indexOf = (id: string) => ownerIndex.get(id) ?? Infinity;
  const order = [...new Set([...Object.keys(inForce.owners), ...withStats])].sort((a, b) => indexOf(a) - indexOf(b) || 0);
  const ahead = new Map<string, OwnerRun[]>();
  let waiting: OwnerRun[] = [];
  for (const id of order) {
    if (withStats.has(id)) {
      if (waiting.length) ahead.set(id, waiting);
      waiting = [];
      continue;
    }
    const run = ownerRun({ id, stats: [], enabled: {}, previous: [], regenApplied: {} }, timing, placeholderDefs, [], inForce.owners[id]);
    if (run.units.length) waiting.push(run);
  }
  const ownerRuns = [...entityRuns.flatMap((run) => [...ahead.get(run.owner.id) ?? [], run]), ...waiting];
  const runs: OwnerRun[] = [globalRun, ...ownerRuns];
  if (turn.triggersOnly) for (const run of runs) run.units = [];
  const { itemEvent } = turn;
  if (itemEvent) {
    for (const run of runs) run.units = [];
    globalRun.units = filledScriptsAt(itemEvent.item, itemEvent.event.timing).map((script): ScriptUnit => ({
      home: { kind: 'item', item: itemEvent.item, where: itemEvent.event.where }, stat: null, itemName: itemEvent.itemName, script,
    }));
  }
  return {
    entries: rowedUnits(runs.flatMap((run) => run.units.map((unit) => ({ unit, run, script: unit.script }))), turn.rowOrder, state.ownerTraits),
    readings: { global: globalRun.inputs, owners: Object.fromEntries(entityRuns.map((run) => [run.owner.id, run.inputs])) },
  };
}

/** What one clean script run wrote, in the shape a step settles. `ownerId` is the scope it ran in. */
const scriptWritesFrom = (stat: PlayerStat | null, result: StatCodeResult, ownerId: OwnerId): ScriptWrites => ({
  stats: targetWrites(stat, result, ownerId),
  placeholders: result.placeholders ?? [],
  ...(result.traits || result.entities ? { traits: { world: result.traits ?? [], entities: result.entities ?? [] } } : {}),
  ...(result.worldWrites ? { world: result.worldWrites } : {}),
  ...(result.lore ? { lore: result.lore.map(bareLoreWrite) } : {}),
});

/** The name a trait switch's log line gives a script: its stat's or trait's as the player reads it, else its own. */
const switcherName = (turn: StatCodeTurn, { stat, trait, itemName, script }: ScriptUnit) =>
  (stat ? turn.statNameOf(stat) : trait ? turn.traitNameOf(trait) : itemName ?? scriptLabel(script, WORLD_OWNER));

/** `turn` with `unit`'s writes applied, as the next script finds it. */
function afterWrites(turn: StatCodeTurn, began: TimingStart, unit: ScriptUnit, writes: ScriptWrites, snapshot: SandboxSnapshot): { step: StatCodeTurnResult; next: StatCodeTurn } {
  const written = writes.traits ? snapshot.switchesOf(unit, { traits: writes.traits.world, entities: writes.traits.entities }) : [];
  const step = settledStep(turn, began, writes, traitSwitchesOf(switcherName(turn, unit), written));
  return { step, next: afterRun(turn, step) };
}

/** The scripts `turn`'s state would run now, by Scripts tab row. A Blueprint row names its first owner's. */
export function playedScripts(turn: StatCodeTurn): ReadonlyMap<string, PlannedUnit> {
  const { entities = [], library = [] } = turn.state.ownerTraits;
  const authored = new Map([...entities, ...library].map((entity) => [entity.id, entity]));
  const played = new Map<string, PlannedUnit>();
  for (const entry of planOf(turn, beganOf(turn)).entries) {
    const key = rowKeyOf(entry.unit.home, entry.script.id, authored);
    if (key !== null && !played.has(key)) played.set(key, entry);
  }
  return played;
}

/** `turn` as the next script finds it after `played` ran clean with `result`. */
export function afterScript(turn: StatCodeTurn, { unit, run }: PlannedUnit, result: StatCodeResult): StatCodeTurn {
  const writes = scriptWritesFrom(unit.stat, result, run.owner.id);
  const { next } = afterWrites(turn, beganOf(turn), unit, writes, snapshotOf(turn.state));
  const ops = writes.world?.inventory;
  if (!ops?.length) return next;
  // A check fires no nested run (Q38).
  return { ...next, state: { ...next.state, itemCopies: next.inventory.apply(next.state.itemCopies ?? [], ops).copies } };
}

/**
 * Run one timing's scripts one by one, each over a fresh snapshot of what the script before left: the replayed
 * writes, the triggers, then the world's and every owner's in run order. Which scripts run reads at each script's
 * turn. A failing script is logged and adds nothing. A script's trait switches and inventory writes fire their runs
 * before the next script, a level deeper; an `output` run's wait for the After batch (Q42). `parent` is the action a
 * nested run belongs to.
 */
async function runScripts(turn: StatCodeTurn, nesting: RunNesting = ACTION_TOP, parent?: ActionRuns): Promise<StatCodeTurnResult> {
  const action = parent ?? actionRunsOf(turn);
  const timing = turn.timing ?? 'after';
  const began = beganOf(turn);
  const { itemEvent } = turn;
  /** A World Tool call's unit. */
  const toolUnit = (name: string, code: string, rest: Pick<ScriptUnit, 'args' | 'writes'>): ScriptUnit =>
    ({ home: { kind: 'tool' }, stat: null, script: { id: `tool:${name}`, name, timing, code }, ...rest });
  // A choices-only run runs no World Tool: its choice writes drop (Q21), and nothing else it writes is kept.
  const triggers = (turn.choicesOnly ? [] : turn.triggers ?? []).map(({ name, code, args }) => toolUnit(name, code, { args }));
  const replayed = (turn.choicesOnly ? [] : turn.replayed ?? []).map(({ name, writes }) => toolUnit(name, '', { writes: scriptWritesOf(writes) }));
  /** A script's name in the logs: its stat's or trait's, else its own name or the world-and-timing fallback. */
  const whoRan = ({ stat, trait, itemName, script, args }: ScriptUnit) => (stat ? `Stat ${stat.name}`
    : trait ? `Trait ${trait.name}` : itemName !== undefined ? `Item ${itemName}` : `${args ? 'Tool' : 'Script'} ${scriptLabel(script, WORLD_OWNER)}`);
  // The sentence a During AI Output run hands from one script to the next.
  let sentence = timing === 'output' ? turn.narration?.sentence : undefined;
  // The choices an After the AI script left, which the next one reads (Q14). Unset until a script changes them.
  let choices: readonly string[] | undefined;
  let reply: TriggerReply | undefined;
  let triggerWrites: SavedScriptWrites | undefined;
  const prompts = turn.choicesOnly ? silentPrompts : turn.prompts;
  const steps: StatCodeTurnResult[] = [];
  let now = turn;
  // The plan of `now`, dropped whenever a script's writes change it.
  let plan: RunPlan | undefined;
  const planNow = () => (plan ??= planOf(now, began));
  const land = async (unit: ScriptUnit, writes: ScriptWrites, snapshot: SandboxSnapshot) => {
    const { step, next } = afterWrites(now, began, unit, writes, snapshot);
    action.runsSoFar.push(step);
    const fired = step.traits && timing !== 'output' ? switchesBetween(now, next) : [];
    const ops = writes.world?.inventory;
    const landed = ops?.length
      ? landedInventory(next, step, action, { ops, from: now.state.itemCopies ?? [], holdsEvents: timing === 'output' }) : { step, next, events: [] };
    steps.push(landed.step);
    now = landed.next;
    plan = undefined;
    if (!fired.length && !landed.events.length) return;
    // The nested runs read the choices so far. Their own switches hold under the world they ran in.
    const read = choices && now.state.turn ? { ...now.state, turn: { ...now.state.turn, choices } } : now.state;
    let at: StatCodeTurn = { ...now, state: read, switchedFrom: undefined, penaltyStart: turn.penaltyStart ?? began.stats };
    if (fired.length) at = await switchRuns(at, fired, nesting, steps, action);
    if (landed.events.length) at = await itemRuns(at, landed.events, nesting, steps, action);
    now = { ...now, state: at.state };
  };
  const runUnit = async (unit: ScriptUnit, ownerId: OwnerId) => {
    const snapshot = snapshotOf(now.state, { readings: planNow().readings });
    // A replayed unit holds its saved writes already and runs no script.
    if (unit.writes) {
      await land(unit, unit.writes, snapshot);
      return;
    }
    const { stat, script, args } = unit;
    const result = await snapshot.run({
      home: unit.home, timing, code: script.code, ...(args && { args }), ...(prompts && { prompts }),
      ...(timing === 'switch' && turn.switched && { switched: { event: turn.switched, world: switchedWorldOf(now, turn.switched) } }),
      ...(itemEvent && {
        itemEvent: {
          copyId: itemEvent.event.copyId, quantity: itemEvent.event.quantity, ...(itemEvent.event.was && { was: itemEvent.event.was }),
          ...(itemEvent.event.target && { targetCopyId: itemEvent.event.target.id }),
        },
      }),
      ...(sentence === undefined || !turn.narration ? {} : { narration: { ...turn.narration, sentence } }),
      ...(choices && { choices }),
    });
    const first = args && unit === triggers[0];
    if (result.error) {
      console.error(`Error executing code for ${whoRan(unit)}${args ? '' : ` (${SCRIPT_TIMING_LABEL[script.timing]})`}:`, result.error);
      if (first) reply = { error: result.error };
      return;
    }
    if (first) reply = { text: result.reply ?? null };
    if (result.sentence !== undefined) sentence = result.sentence;
    if (result.choices) choices = result.choices;
    const writes = scriptWritesFrom(stat, result, ownerId);
    if (first) triggerWrites = savedWrites(writes);
    if (!turn.choicesOnly) warnDroppedWrites(whoRan(unit), result);
    if (landsAnything(writes)) await land(unit, writes, snapshot);
  };
  for (const unit of [...replayed, ...triggers]) await runUnit(unit, null);
  // Every script's place is fixed from the start, so one switched on runs only if it is lower than the one that
  // switched it. A script's own entry is read again at its turn, with the state it runs over.
  let inPlay: { from: RunPlan; keyed: Map<string, PlannedUnit> } | undefined;
  for (const key of keyedPlan(planOf(turn, began, true).entries).keys()) {
    const current = planNow();
    if (inPlay?.from !== current) inPlay = { from: current, keyed: keyedPlan(current.entries) };
    const entry = inPlay.keyed.get(key);
    if (entry) await runUnit(entry.unit, entry.run.owner.id);
  }
  // The one settle carries the gate snapshot and the penalties when no script applied a write. A choices-only run
  // chains its scripts' writes and switch runs to build the choices, then keeps none of them.
  const settled = (turn.choicesOnly && !parent) || !steps.length ? settledStep(turn, began) : undefined;
  const ran = settled ? chainedResult(turn, [settled], afterRun(turn, settled)) : chainedResult(turn, steps, now);
  const chained = parent ? ran : withActionItems(ran, action);
  // What the chained scripts left: the sentence, and the choices once a script changed them.
  // Scripts that restore the list between them leave no change.
  const changedChoices = choices && !sameChoices(choices, turn.state.turn?.choices ?? []) ? { choices } : {};
  return {
    ...chained, ...(sentence === undefined ? {} : { sentence }), ...changedChoices,
    ...(reply ? { reply } : {}), ...(triggerWrites ? { triggerWrites } : {}),
  };
}

/** `turn` with one script's writes and trait switches applied, as one run's result. Absent writes change nothing. */
function settledStep(
  turn: StatCodeTurn, began: TimingStart, writes?: ScriptWrites, switches: readonly CodeTraitSwitch[] = [],
): StatCodeTurnResult {
  const { state } = turn;
  const world = state.ownerTraits.world;
  const before = runtimeStateOf(state);
  const owned = state.owners ?? [];
  const pinWrites = pinWritesOf(writes?.placeholders ?? []);
  const withWorld = {
    ...(writes?.world ? { worldWrites: writes.world } : {}),
    ...(writes?.lore?.length ? { loreWrites: [...writes.lore] } : {}),
  };

  // Merged per target before the first settle, so the gate snapshot and the penalties see every owner's writes.
  const byOwner = statWritesByOwner(writes);
  const mainWrites = byOwner.get(null) ?? new Map<string, SettledWrite>();
  const ownerWrites = new Map(owned.map((owner) => [owner.id, byOwner.get(owner.id) ?? new Map<string, SettledWrite>()]));
  // The snapshot every settle below reads: the code writes applied with no switch yet, then the penalties.
  const landedMain = withPenalties(
    settleWrites(state.stats, state.stats, mainWrites, ownerStatTraitsInForce(before, world, null)).stats, turn.penalties, turn.penaltyStart ?? began.stats,
  );
  const landedOwners: EntityStatValues = Object.fromEntries(owned.map((owner) => [owner.id, settleWrites(
    owner.stats, owner.stats, ownerWrites.get(owner.id) ?? new Map(), ownerStatTraitsInForce(before, world, owner.id),
  ).stats]));
  const gateStats = withStateGateStats(state, gateStatsOf({ ...before, stats: landedMain, entityStats: landedOwners }, world));

  // Trait switches first, so bounds re-derive under them; the code's own bounds and values then go on top.
  const switched = applyCodeTraitSwitches(before, switches, { ...world, gateStats }, turn.traitNameOf);
  const active = ownerStatTraitsInForce(switched.state, world, null);
  const traitResult: StatCodeTraitResult | undefined = switched.state === before ? undefined : {
    acquired: switched.state.traits,
    disabledTraitIds: switched.state.disabledTraitIds,
    appliedValues: switched.state.appliedValues,
    cascadeOffTraitIds: switched.state.cascadeOffTraitIds ?? {},
    ownedTraits: switched.state.ownedTraits ?? {},
    inForce: active,
    log: switched.log,
    logTraits: switched.logTraits,
  };

  const owners = state.owners && Object.fromEntries(owned.map((owner): [string, OwnerCodeResult] => {
    const inForce = ownerStatTraitsInForce(switched.state, world, owner.id);
    const result = settleWrites(
      owner.stats, switched.state.entityStats?.[owner.id] ?? owner.stats, ownerWrites.get(owner.id) ?? new Map(), inForce,
    );
    const settled = changedAnyStat(result) ? result : { ...result, stats: owner.stats };
    return [owner.id, traitResult ? { ...settled, inForce } : settled];
  }));
  const withOwners = owners ? { owners } : {};
  const settledMain = settleWrites(state.stats, switched.state.stats, mainWrites, active);
  const { stats, moved, boundsChanged, hiddenChanged } = settledMain;
  if (!traitResult && !changedAnyStat(settledMain)) {
    return { stats: state.stats, moved, boundsChanged, hiddenChanged, pinWrites, gateStats, ...withOwners, ...withWorld };
  }
  return {
    stats, moved, boundsChanged, hiddenChanged, pinWrites, gateStats, ...(traitResult ? { traits: traitResult } : {}), ...withOwners, ...withWorld,
  };
}

/** The settled stats with each penalty taken from a stat no script has moved since the timing began, clamped into
 *  its bounds. A stat the code moved keeps the code's value, as the overlay keeps it over a penalty applied
 *  meanwhile. `landed` never holds a penalty, so a chain never takes one penalty twice (Q29). */
function withPenalties(
  landed: PlayerStat[], penalties: StatCodeTurn['penalties'], began: readonly PlayerStat[],
): PlayerStat[] {
  if (!penalties) return landed;
  const atStart = new Map(began.map((stat) => [stat.id, stat.value]));
  return landed.map((stat) => {
    const loss = penalties[stat.id];
    if (loss === undefined || stat.value !== atStart.get(stat.id)) return stat;
    return { ...stat, value: clamp(stat.value - loss, stat.min, stat.max) };
  });
}

/** `current` with an owner's code writes laid on, re-derived under `active`. A bound write books its
 *  difference from the bound `active` derives into the code delta. `start` is the stats the run read, in
 *  the same order, which `moved` compares against. */
function settleWrites(
  start: readonly PlayerStat[],
  current: readonly PlayerStat[],
  writes: ReadonlyMap<string, SettledWrite>,
  active: readonly Trait[],
): ChangedStats & { stats: PlayerStat[] } {
  const moved: string[] = [];
  const boundsChanged: string[] = [];
  const hiddenChanged: string[] = [];
  const stats = current.map((stat, i) => {
    const write = writes.get(stat.id);
    const codeDelta = write?.bounds && codeDeltaFor(stat, write.bounds, active);
    // A value-only write keeps the bounds as they stand, which a trait switch may have moved.
    const landed = !write ? stat
      : !codeDelta ? { ...stat, value: clamp(write.value ?? stat.value, stat.min, stat.max) }
        : withCodeDelta(stat, codeDelta, write.value ?? stat.value, active);
    const hiddenWrite = write?.hidden ?? null;
    const next = hiddenWrite === null || sameHidden(stat, { hidden: hiddenWrite }) ? landed : { ...landed, hidden: hiddenWrite };
    if (codeDelta && !sameCodeDelta(codeDelta, stat.codeDelta)) boundsChanged.push(stat.id);
    if (next.value !== start[i].value) moved.push(stat.id);
    if (!sameHidden(next, start[i])) hiddenChanged.push(stat.id);
    return next.value === stat.value && !boundsChanged.includes(stat.id) && next.hidden === stat.hidden ? stat : next;
  });
  return { stats, moved, boundsChanged, hiddenChanged };
}
/** One stat's switches: through `traits`, then through each entity's `traits`. */
interface StatTraitWrites {
  world: readonly TraitWrite[];
  entities: readonly EntityTraitWrites[];
}

/** One script's trait switches keyed by owner and trait: its later switch of a trait wins, at that switch's place.
 *  `by` names the script in the log line. */
function traitSwitchesOf(by: string, written: readonly TraitSwitchWrite[]): CodeTraitSwitch[] {
  const out = new Map<string, CodeTraitSwitch>();
  for (const { traitId, enabled, ownerId } of written) {
    const key = ownerId === undefined ? traitId : recordKey(ownerId, traitId);
    out.delete(key);
    out.set(key, { traitId, enabled, by, ...(ownerId === undefined ? {} : { ownerId }) });
  }
  return [...out.values()];
}

/** One script's placeholder writes keyed by placeholder id. Each write already names the placeholder it wrote to,
 *  whichever path the code reached it by. */
function pinWritesOf(writes: readonly PlaceholderWrite[]): PinWrites {
  const out: Record<string, string | string[] | null> = {};
  for (const write of writes) {
    out[write.id] = 'unpin' in write ? null : write.value;
  }
  return out;
}
