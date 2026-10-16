/**
 * One Test Code run: a stat box's code run once on the authored world, with no playthrough. The editor's
 * Test Code button and Formaquestion's code test both run through here, so both report the same writes.
 */
import { blueprintGroupStats, playStatWorld, statBlueprintIds } from './statLinks';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { codePinText } from '@/lib/placeholderPins';
import { PLACEHOLDER_PATH_SEPARATOR } from '@/lib/placeholders';
import {
  clampToOwnRange, CODE_BOUND_FIELDS, entityTraitsPath, executeStatCode, memberPath, traitWritesPath, SELF_WRITABLE_FIELDS, type CodeBoundField,
  type OwnerStatWrites, type PlaceholderWrite, type SandboxEntity, type SandboxPlaceholderNode, type StatWrite, type TraitWrite,
} from '@/lib/statCodeExecutor';
import type { CodeEntityNames, MissingName } from '@/lib/statCodeAnalysis';
import { cardWorldNames, type StatCodeNames } from '@/lib/statCodeBoxOptions';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { blueprintItemIds } from '@/lib/traitTree';
import { sandboxDictionaries, sandboxPlaceholders } from '@/lib/statCodePlaceholders';
import { placeholderPathExpression, placeholderPathLabel } from '@/lib/statCodePaths';
import { statCodeTimingOf, type StatCodeTiming } from '@/lib/statCodeTiming';
import { sandboxTraits, unplayedEntities } from '@/lib/statCodeTraits';
import { activeStatEnabled } from '@/lib/traitEffects';
import { sampleNarration, sampleSwitchedTrait } from '@/lib/scriptTestSamples';
import type { ScriptPromptHost } from '@/lib/scriptPrompts';
import { startingGateStatsOf } from '@/lib/gateStats';
import type { ScriptTiming, Stat, Trait, World } from '@/types';
import { randomUUID } from '@/lib/uuid';

/** Test Code names each bound a run wrote with its Details field label. */
const BOUND_LABELS: Record<CodeBoundField, string> = { min: 'Min', max: 'Max', regen: 'Regen' };

/** The clock each box reads under Test Code: the turn start the before box gets, a one-hour turn for the
 *  after box. Zero elapsed puts the before run on the opening turn, which its templates are written for. */
const TEST_CLOCK: Record<StatCodeTiming, { deltaHours: number; elapsedHours: number }> = {
  before: { deltaHours: 0, elapsedHours: 0 },
  after: { deltaHours: 1, elapsedHours: 1 },
};

/** The parts of an authored world a stat's code reaches. */
export type StatCodeWorld = Pick<World, 'stats' | 'statGroups' | 'traits' | 'traitGroups' | 'entities' | 'entityGroups' | 'placeholders' | 'placeholderGroups' | 'dictionaries'>;

/** The names of `world` as the stat panel reads them: the global stats without Blueprints, and each entity's
 *  with its links. */
export function statCodeNames(world: StatCodeWorld): StatCodeNames {
  return cardWorldNames({
    ...world, traitGroups: world.traitGroups ?? [], placeholders: allPlaceholders(world), placeholderOwners: placeholderOwners(world),
  });
}

/** The owner a non-global stat's code runs under. */
export interface TestRunOwner {
  /** The entity that owns the stat. Absent for a Blueprint stat, whose `owner` is no entity of the world. */
  entityId?: string;
  /** What `owner.stats` holds, under code names, at their starting values: the entity's own stats, or the
   *  Blueprint group's. */
  stats: readonly Stat[];
}

/** A stat found by name, under its code name, with the owner its box runs under. */
export interface StatCodeTarget {
  stat: Stat;
  /** Absent for a global stat. */
  owner?: TestRunOwner;
}

/** The stat code names `name`, by code name first, then by authored name: a global stat, then a Blueprint
 *  stat, then an entity's own stat in authored order. */
export function findStat(world: StatCodeWorld, names: StatCodeNames, name: string): StatCodeTarget | undefined {
  const list = allPlaceholders(world);
  const link = { stats: world.stats, statGroups: world.statGroups ?? [] };
  const play = playStatWorld({ ...link, entities: world.entities });
  const hit = (authored: readonly Stat[], coded: readonly Stat[]): Stat | undefined => {
    const byCode = coded.find((stat) => stat.name === name);
    if (byCode) return byCode;
    const byAuthored = authored.find((stat) => stat.name === name);
    return byAuthored && coded.find((stat) => stat.id === byAuthored.id);
  };
  const worldStat = hit(play.stats, names.codeNamedStats);
  if (worldStat) return { stat: worldStat };
  const blueprintIds = statBlueprintIds(link);
  const blueprints = world.stats.filter((stat) => blueprintIds.has(stat.id));
  const blueprint = hit(blueprints, statCodeNamed(blueprints, list));
  if (blueprint) {
    const group = world.stats.find((stat) => stat.id === blueprint.id)!;
    return { stat: blueprint, owner: { stats: statCodeNamed(blueprintGroupStats(link, group), list) } };
  }
  for (const entity of play.entities) {
    const coded = names.entityStats[entity.id];
    const owned = coded && hit(entity.stats ?? [], coded);
    if (owned) return { stat: owned, owner: { entityId: entity.id, stats: coded } };
  }
  return undefined;
}

/** A trait found by name, under its code name, with the owner its scripts run under. */
export interface TraitCodeTarget {
  trait: { id: string; name: string };
  /** Absent for a global trait. A Blueprint trait's owner holds no stats, since its owners vary. */
  owner?: TestRunOwner;
}

/** The trait that `name` names, by code name first, then by authored name: a global trait, then a Blueprint
 *  trait, then an entity's own trait in authored order. */
export function findTrait(world: StatCodeWorld, names: StatCodeNames, name: string): TraitCodeTarget | undefined {
  const list = allPlaceholders(world);
  const hit = (traits: readonly Trait[]) => {
    const found = traits.find((trait) => statCodeName(trait.name, list) === name) ?? traits.find((trait) => trait.name === name);
    return found && { id: found.id, name: statCodeName(found.name, list) };
  };
  const blueprintIds = blueprintItemIds({ traits: world.traits, traitGroups: world.traitGroups ?? [] });
  const global = hit(world.traits.filter((trait) => !blueprintIds.has(trait.id)));
  if (global) return { trait: global };
  const blueprint = hit(world.traits.filter((trait) => blueprintIds.has(trait.id)));
  if (blueprint) return { trait: blueprint, owner: { stats: [] } };
  for (const entity of world.entities) {
    const owned = hit(entity.traits ?? []);
    if (owned) return { trait: owned, owner: { entityId: entity.id, stats: names.entityStats[entity.id] ?? [] } };
  }
  return undefined;
}

/** What one run did. */
export interface TestCodeReport {
  /** Why the run failed; every write is then dropped. Null when it ran. */
  error: string | null;
  /** The value the code set, by return or by `self.value`; null when it left the value alone. */
  value: number | null;
  /** Each bound, placeholder and trait switch the run wrote, as one line each. */
  writes: string[];
  /** Each `persona` trait switch, placeholder write and stat write, which lands on the played persona in a real
   *  turn. Present only on a run that takes the persona as pending. */
  pending?: string[];
  /** The stats the run made up for names the world does not have yet. Present only on a run given them. */
  assumed?: string[];
  /** Each kind of write the run dropped, as one line each with the names. */
  dropped: string[];
  /** The sentence a During AI Output run left. */
  sentence?: string;
}

/** How a run reads a world still being built. */
export interface TestRunOptions {
  /** Take `persona` as the persona to be played: it holds every trait and placeholder a persona-capable
   *  entity holds, and its writes are pending. */
  pendingPersona?: boolean;
  /** Names the world does not have yet. Each stat among them runs as a number at 0 in 0–100, and a write
   *  to any of them is left out of `dropped`. */
  missing?: readonly MissingName[];
  /** Whose code it is, for an owned or Blueprint stat. Absent for a global stat, whose `owner` is empty. In
   *  every run `stats` is the global stats. */
  owner?: TestRunOwner;
  /** A trait script's own trait, which `self` reads in place of a stat. */
  selfTrait?: { id: string; name: string };
  /** The sentence a During AI Output run rewrites. Absent, it reads blank. */
  sentence?: string;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
}

/** The range and value an assumed stat runs with. */
const ASSUMED_STAT = { min: 0, max: 100, value: 0 };

/** The id of the stand-in persona a pending run reads. */
const PENDING_PERSONA_ID = 'pending-persona';

/** The stand-in persona's placeholder node: every persona-capable entity's own placeholders under
 *  `persona`. Each node is a copy, so a write through it is told apart from one through the entity. */
function personaPlaceholders(entities: readonly CodeEntityNames[], owners: ReadonlyMap<string, SandboxPlaceholderNode>): SandboxPlaceholderNode {
  const rooted = (node: SandboxPlaceholderNode): SandboxPlaceholderNode =>
    ({ ...node, path: ['persona', ...node.path.slice(1)], ownedBy: 'persona', children: (node.children ?? []).map(rooted) });
  const children = entities.filter((entity) => entity.persona).flatMap((entity) => owners.get(entity.id)?.children ?? []);
  return { name: 'persona', path: ['persona'], ownedBy: 'persona', children: children.map(rooted) };
}

/** A pin by the entry it lands on and the path it was reached by. */
const pinKey = (id: string, path: readonly string[]) => JSON.stringify([id, path]);

/** The keys of every entry under `node`. */
function nodeKeys(node: SandboxPlaceholderNode): Set<string> {
  const keys = new Set<string>();
  const walk = (at: SandboxPlaceholderNode) => {
    if (at.entry) keys.add(pinKey(at.entry.id, at.path));
    (at.children ?? []).forEach(walk);
  };
  walk(node);
  return keys;
}

/** The empty persona holding every trait name, placeholder and stat a persona-capable entity holds, none
 *  chosen, and in the scene. Its traits read as an unplayed entity's do. */
const personaOfPlayables = (
  entities: readonly CodeEntityNames[], placeholders: SandboxPlaceholderNode, entityStats: Readonly<Record<string, readonly Stat[]>>,
): SandboxEntity => {
  const playables = entities.filter((entity) => entity.persona);
  const playableStats = playables.flatMap((entity) => entityStats[entity.id] ?? []);
  return {
    // The stand-in has an id so the run keys its stat writes, which land on the played persona in a real turn.
    id: PENDING_PERSONA_ID,
    name: '',
    inScene: true,
    traits: [...new Set(playables.flatMap((entity) => entity.traits.map((trait) => trait.name)))]
      .map((name) => ({ name, enabled: false, acquired: false })),
    placeholders,
    stats: { stats: playableStats, enabled: activeStatEnabled(playableStats, []) },
  };
};

/** The keys of a missing name from its map's root, `persona` first under `persona`. */
export const missingSegments = ({ root, segments }: MissingName): readonly string[] =>
  (root === 'persona' ? ['persona', ...segments] : segments);

/** A trait by its owner: null for the world's `traits`, '' for `persona`, else the entity's code name. */
const traitKey = (owner: string | null, name: string) => JSON.stringify([owner, name]);

/** Which dropped writes a run keeps: all but those to a name the world does not have yet, or under one. */
function droppedFilter(missing: readonly MissingName[]) {
  const traits = new Set<string>();
  const entities = new Set<string>();
  const labels: string[] = [];
  for (const name of missing) {
    const { kind, root, segments } = name;
    if (kind === 'trait') traits.add(traitKey(root === 'traits' ? null : root === 'persona' ? '' : segments[0], segments[segments.length - 1]));
    if (kind === 'entity') entities.add(segments[0]);
    if (kind === 'entity' || kind === 'dictionary' || kind === 'placeholder') labels.push(placeholderPathLabel(missingSegments(name)));
  }
  return {
    trait: (owner: string | null) => (name: string) => !traits.has(traitKey(owner, name)),
    entity: (name: string) => !entities.has(name),
    placeholder: (label: string) => !labels.some((at) => label === at || label.startsWith(`${at}${PLACEHOLDER_PATH_SEPARATOR}`)),
  };
}

/** Keeps every dropped write. */
const KEEP_DROPPED: ReturnType<typeof droppedFilter> = { trait: () => () => true, entity: () => true, placeholder: () => true };

const switchLine = (at: string, { name, enabled }: TraitWrite) => `${at}${name} switched ${enabled ? 'on' : 'off'}`;

/** One line per field a run wrote to another stat, as code names it: `stats.Luck.max = 12`. `map` is the stat
 *  map the code wrote through. */
const statWriteLines = (map: string, { name, ...fields }: StatWrite) =>
  SELF_WRITABLE_FIELDS.flatMap((field) => {
    const number = fields[field as keyof typeof fields];
    return typeof number === 'number' ? [`${memberPath(map, name)}.${field} = ${number}`] : [];
  });

/** The stat map code wrote through to reach each owner a run wrote to: `owner.stats` for the run's own owner,
 *  `persona.stats` for the stand-in persona, else the entity's by its code name. */
function ownerMaps(entities: readonly CodeEntityNames[], owner: TestRunOwner | undefined) {
  const names = new Map(entities.map((entity) => [entity.id, entity.name]));
  return ({ ownerId }: OwnerStatWrites): { map: string; pending: boolean } => {
    if (ownerId === PENDING_PERSONA_ID) return { map: 'persona.stats', pending: true };
    if (owner && ownerId === (owner.entityId ?? '')) return { map: 'owner.stats', pending: false };
    return { map: `${memberPath('entities', names.get(ownerId) ?? ownerId)}.stats`, pending: false };
  };
}

/** The line of a dropped kind of write, or none when no names are left. */
const droppedLine = (lead: string, names: readonly string[] | undefined) =>
  (names?.length ? [`${lead} Writes ignored: ${names.join(', ')}.`] : []);

/**
 * Runs `code` from the `timing` box of `stat`, whose name is its code name, or of `selfTrait` with no stat. Applies nothing. With
 * `pendingPersona`, a `persona` write to a trait or placeholder a persona-capable entity holds is reported
 * as pending.
 */
export async function runTestCode(
  code: string, timing: ScriptTiming, stat: (Partial<Stat> & Pick<Stat, 'id' | 'name'>) | null,
  { codeNamedStats, placeholders, traits, traitPlaces, entities, entityStats }:
    Pick<StatCodeNames, 'codeNamedStats' | 'placeholders' | 'traits' | 'traitPlaces' | 'entities' | 'entityStats'>,
  { pendingPersona: pending = false, missing, owner, selfTrait, sentence, prompts }: TestRunOptions = {},
): Promise<TestCodeReport> {
  // No playthrough: an unrolled placeholder reads as a fresh draw, no one holds a trait, and no persona plays.
  // A pending run's empty persona holds the playable entities' traits and placeholders, so a write to one is kept.
  const placeholderEntries = sandboxPlaceholders({ placeholders: placeholders.list, owners: placeholders.owners, rolls: {} });
  const owners = placeholderEntries.owners;
  // Stat Conditions read the authored start, as Enter World's do (Q23, Q33).
  const traitEntries = sandboxTraits(
    {
      acquired: [], disabledTraitIds: [], appliedValues: {},
      world: { traits: [...traits], groups: [], gateStats: startingGateStatsOf(codeNamedStats, entityStats) },
    },
    placeholders.list,
  );
  const personaNode = pending ? personaPlaceholders(entities, owners) : undefined;
  const assumed = [...new Set((missing ?? []).filter(({ kind }) => kind === 'stat').map(({ segments }) => segments[0]))];
  const stats = assumed.length ? [
    ...codeNamedStats,
    ...assumed.map((name): Stat => ({ id: randomUUID(), name, type: 'number', description: '', regen: 0, descriptors: [], ...ASSUMED_STAT })),
  ] : codeNamedStats;
  // Each entity's stats read as authored, as `stats` does, a switched-off one as off.
  const entityEntries = unplayedEntities(entities, owners).map((entity) => {
    const own = entity.id ? entityStats[entity.id] : undefined;
    return own ? { ...entity, stats: { stats: own, enabled: activeStatEnabled(own, []) } } : entity;
  });
  // The owner reads as the turn hands it: its entry among the entities, or, for a Blueprint stat, an entry of
  // its own holding the group's stats and no entity.
  const ownerEntry: SandboxEntity | undefined = owner && {
    ...(entityEntries.find((entity) => owner.entityId && entity.id === owner.entityId) ?? { name: '', traits: [], ...(owner.entityId && { id: owner.entityId }) }),
    stats: { stats: owner.stats, enabled: activeStatEnabled(owner.stats, []) },
  };
  // A trait's entry as its owner's map holds it; one no map holds reads as not held.
  const traitSelf = selfTrait && (
    (ownerEntry ? ownerEntry.traits : traitEntries).find((entry) => entry.id === selfTrait.id)
    ?? { ...selfTrait, enabled: false, acquired: false }
  );
  // A switch run fires on the trait's own switch, else on the world's first trait (Q49).
  const switchedTrait = timing === 'switch' ? sampleSwitchedTrait(
    traitEntries, traitPlaces[0]?.id, traitSelf && { entry: traitSelf, owner: ownerEntry?.name ?? '' },
  ) : undefined;
  const outcome = await executeStatCode(
    // A half-filled stat still runs: the executor defaults every number it marshals, so only the id and the
    // code name have to be real.
    code, stats, stat as Stat | null,
    {
      clock: TEST_CLOCK[statCodeTimingOf(timing)],
      ...(traitSelf && { selfTrait: traitSelf }), placeholders: placeholderEntries.top, traits: traitEntries,
      // No trait is on, so a stat is off only as authored; a write to it is dropped as it is in a turn.
      enabled: activeStatEnabled(stats, []),
      entities: entityEntries,
      dictionaries: sandboxDictionaries(placeholders.dictionaries ?? [], owners),
      ...(personaNode && { persona: personaOfPlayables(entities, personaNode, entityStats) }),
      ...(ownerEntry && { owner: ownerEntry }),
      ...(timing === 'output' && { narration: sampleNarration(sentence ?? '') }),
      ...(switchedTrait && { switchedTrait }), ...(prompts && { prompts }),
    },
  );
  const assumedField = missing ? { assumed } : {};
  if (outcome.error) return { error: outcome.error, value: null, writes: [], ...(pending && { pending: [] }), ...assumedField, dropped: [] };
  // The executor names the empty persona '', and the empty `owner` too, which it marks.
  const personaWrites = pending ? outcome.entities?.find((row) => row.entity === '' && !row.owner) : undefined;
  const personaKeys = personaNode ? nodeKeys(personaNode) : new Set<string>();
  const isPersonaPin = (entry: PlaceholderWrite) => personaKeys.has(pinKey(entry.id, entry.path));
  const pinLine = (entry: PlaceholderWrite, at: string) => ('unpin' in entry ? `${at} unpinned` : `${at} = ${codePinText(entry.value)}`);
  // Each owner's stat writes under the map code wrote through; the stand-in persona's are pending.
  const mapOf = ownerMaps(entities, owner);
  const ownerLines = (outcome.ownerStatWrites ?? []).map((row) => {
    const { map, pending: toPersona } = mapOf(row);
    return { pending: toPersona, lines: row.writes.flatMap((write) => statWriteLines(map, write)) };
  });
  const writes = [
    ...CODE_BOUND_FIELDS.flatMap((field) => {
      const bound = outcome.bounds?.[field];
      return bound === undefined ? [] : [`${BOUND_LABELS[field]}: ${bound}`];
    }),
    ...(outcome.statWrites ?? []).flatMap((write) => statWriteLines('stats', write)),
    ...ownerLines.filter((row) => !row.pending).flatMap((row) => row.lines),
    // The path the code wrote, not the placeholder's bare name: that is what the author typed.
    ...(outcome.placeholders ?? []).filter((entry) => !isPersonaPin(entry)).map((entry) => pinLine(entry, placeholderPathLabel(entry.path))),
    ...(outcome.traits ?? []).map((entry) => switchLine('', entry)),
    ...(outcome.entities ?? []).filter((entry) => entry !== personaWrites).flatMap((row) =>
      (row.traits ?? []).map((entry) => switchLine(`${traitWritesPath(row)}.`, entry))),
  ];
  const keep = missing ? droppedFilter(missing) : KEEP_DROPPED;
  const dropped = [
    ...droppedLine('Unknown stat names.', outcome.unknownStatWrites),
    ...droppedLine('Switched-off stats.', outcome.disabledStatWrites),
    ...droppedLine('Unknown placeholder paths.', outcome.unknownPlaceholders?.filter(keep.placeholder)),
    ...droppedLine('Placeholders of owners not in the game.', outcome.unknownOwnerPlaceholders?.filter(keep.placeholder)),
    ...droppedLine('Unknown trait names.', outcome.unknownTraits?.filter(keep.trait(null))),
    ...droppedLine('acquired is read-only.', outcome.acquiredWrites),
    ...droppedLine('Unknown entity names.', outcome.unknownEntities?.filter(keep.entity)),
    ...droppedLine('Read-only fields.', outcome.readOnlyWrites),
    ...(outcome.entities ?? []).flatMap((row) => {
      const { entity, unknownTraits, acquiredWrites } = row;
      const at = (names: string[]) => names.map((name) => `${traitWritesPath(row)}.${name}`);
      // No missing name sits under `owner`, so its unknown traits all stay.
      const kept = row.owner ? () => true : keep.trait(entity);
      return [
        ...droppedLine('Unknown trait names.', unknownTraits && at(unknownTraits.filter(kept))),
        ...droppedLine('acquired is read-only.', acquiredWrites && at(acquiredWrites)),
      ];
    }),
  ];
  return {
    // Applies nothing, so the value lands in the range the run left on itself.
    error: null, value: outcome.value === null || !stat ? null : clampToOwnRange(outcome.value, stat as Stat, outcome.bounds), writes,
    ...(pending && {
      pending: [
        ...(personaWrites?.traits ?? []).map((entry) => switchLine(`${entityTraitsPath('')}.`, entry)),
        ...(outcome.placeholders ?? []).filter(isPersonaPin).map((entry) => pinLine(entry, placeholderPathExpression(entry.path, 'persona'))),
        ...ownerLines.filter((row) => row.pending).flatMap((row) => row.lines),
      ],
    }),
    ...assumedField,
    dropped,
    ...(outcome.sentence !== undefined && { sentence: outcome.sentence }),
  };
}
