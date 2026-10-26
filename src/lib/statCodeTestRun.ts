/**
 * One Test Code run: a box's code run once on the authored world at turn one, with no playthrough. The editor's
 * Test Code button and Formaquestion's code test both run through here, so both report the same writes.
 */
import { blueprintGroupStats, playStatWorld, statBlueprintIds } from './statLinks';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { codePinText } from '@/lib/placeholderPins';
import { PLACEHOLDER_PATH_SEPARATOR } from '@/lib/placeholders';
import {
  clampToOwnRange, CODE_BOUND_FIELDS, entityTraitsPath, memberPath, traitWritesPath, SELF_WRITABLE_FIELDS, type CodeBoundField,
  type OwnerStatWrites, type PlaceholderWrite, type SandboxPlace, type StatWrite, type TraitWrite, type WorldWrites,
} from '@/lib/statCodeExecutor';
import type { MissingName } from '@/lib/statCodeAnalysis';
import { cardWorldNames, codeLocationsOf, type StatCodeNames } from '@/lib/statCodeBoxOptions';
import { droppedLine, readOnlyWritesLines } from '@/lib/droppedWrites';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { blueprintItemIds } from '@/lib/traitTree';
import { placeholderPathExpression, placeholderPathLabel } from '@/lib/statCodePaths';
import { turnOneClock } from '@/lib/statCodeTiming';
import { sampleTurn } from '@/lib/scriptTestSamples';
import type { ScriptPromptHost } from '@/lib/scriptPrompts';
import type { ToolArgs } from '@/lib/tools/toolRunner';
import { openingHomeOf, openingStateOf, type OpeningFoldWorld } from '@/lib/openingState';
import {
  ownerOfHome, PENDING_PERSONA_ID, snapshotOf, type SandboxSnapshot, type ScriptRunUnit, type SnapshotOptions, type UnitHome,
} from '@/lib/sandboxSnapshot';
import type { ScriptTiming, Stat, Trait, World } from '@/types';

/** Test Code names each bound a run wrote with its Details field label. */
const BOUND_LABELS: Record<CodeBoundField, string> = { min: 'Min', max: 'Max', regen: 'Regen' };

/** The parts of an authored world a stat's code reaches. */
export type StatCodeWorld = Pick<World, 'stats' | 'statGroups' | 'traits' | 'traitGroups' | 'entities' | 'entityGroups' | 'placeholders' | 'placeholderGroups' | 'dictionaries'>
  & Partial<Pick<World, 'locations'>>;

/** The names of `world` as the stat panel reads them: the global stats without Blueprints, and each entity's
 *  with its links. */
export function statCodeNames(world: StatCodeWorld): StatCodeNames {
  return cardWorldNames({
    ...world, traitGroups: world.traitGroups ?? [], placeholders: allPlaceholders(world), placeholderOwners: placeholderOwners(world),
  });
}

/** The home of the stat code names `name`, by code name first, then by authored name: a global stat, then a
 *  Blueprint stat, then an entity's own stat in authored order. */
export function statHomeNamed(world: StatCodeWorld, names: StatCodeNames, name: string): UnitHome | undefined {
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
  if (worldStat) return { kind: 'globalStat', stat: worldStat };
  const blueprintIds = statBlueprintIds(link);
  const blueprints = world.stats.filter((stat) => blueprintIds.has(stat.id));
  const blueprint = hit(blueprints, statCodeNamed(blueprints, list));
  if (blueprint) {
    const group = world.stats.find((stat) => stat.id === blueprint.id)!;
    return { kind: 'blueprintStat', stat: blueprint, groupStats: statCodeNamed(blueprintGroupStats(link, group), list) };
  }
  for (const entity of play.entities) {
    const coded = names.entityStats[entity.id];
    const owned = coded && hit(entity.stats ?? [], coded);
    if (owned) return { kind: 'entityStat', entityId: entity.id, stat: owned };
  }
  return undefined;
}

/** The home of the trait `name` names, by code name first, then by authored name: a global trait, then a
 *  Blueprint trait, then an entity's own trait in authored order. */
export function traitHomeNamed(world: StatCodeWorld, name: string): UnitHome | undefined {
  const list = allPlaceholders(world);
  const hit = (traits: readonly Trait[]) => {
    const found = traits.find((trait) => statCodeName(trait.name, list) === name) ?? traits.find((trait) => trait.name === name);
    return found && { id: found.id, name: statCodeName(found.name, list) };
  };
  const blueprintIds = blueprintItemIds({ traits: world.traits, traitGroups: world.traitGroups ?? [] });
  const global = hit(world.traits.filter((trait) => !blueprintIds.has(trait.id)));
  if (global) return { kind: 'trait', trait: global, entityId: null };
  const blueprint = hit(world.traits.filter((trait) => blueprintIds.has(trait.id)));
  if (blueprint) return { kind: 'blueprintTrait', trait: blueprint };
  for (const entity of world.entities) {
    const owned = hit(entity.traits ?? []);
    if (owned) return { kind: 'trait', trait: owned, entityId: entity.id };
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
  /** What a run given `args` returned, as text; null when it returned nothing. Absent on a run with no `args`. */
  reply?: string | null;
}

/** How a run reads a world still being built. */
export interface TestRunOptions {
  /** Take `persona` as the persona to be played: it holds every trait and placeholder a persona-capable
   *  entity holds, and its writes are pending. */
  pendingPersona?: boolean;
  /** Names the world does not have yet. Each stat among them runs as a number at 0 in 0–100, and a write
   *  to any of them is left out of `dropped`. */
  missing?: readonly MissingName[];
  /** The sentence a During AI Output run rewrites. Absent, it reads blank. */
  sentence?: string;
  /** Who answers `player.*`. Absent, the game's prompt store does. */
  prompts?: ScriptPromptHost;
  /** A World Tool's call arguments. Given, `args` exists and the report carries the script's `reply`. */
  args?: ToolArgs;
}

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
    const written = fields[field as keyof typeof fields];
    return written === undefined ? [] : [`${memberPath(map, name)}.${field} = ${written}`];
  });

/** The stat map code wrote through to reach each owner a run wrote to: `owner.stats` for the home's Owner,
 *  `persona.stats` for the stand-in persona, else the entity's by its code name. */
function ownerMaps(entityNames: ReadonlyMap<string, string>, home: UnitHome) {
  const owner = ownerOfHome(home);
  // The executor keys an Owner entry with no entity as ''.
  const ownerId = owner.kind === 'none' ? undefined : owner.kind === 'entity' ? owner.entityId : '';
  return ({ ownerId: wrote }: OwnerStatWrites): { map: string; pending: boolean } => {
    if (wrote === PENDING_PERSONA_ID) return { map: 'persona.stats', pending: true };
    if (wrote === ownerId) return { map: 'owner.stats', pending: false };
    return { map: `${memberPath('entities', entityNames.get(wrote) ?? wrote)}.stats`, pending: false };
  };
}

/** One line for a move, one for the advances together, and one per discovery, memory line, pin, diary line and
 *  entity write. */
const worldWriteLines = (
  writes: WorldWrites | undefined, locations: readonly SandboxPlace[], entityNames: ReadonlyMap<string, string>,
): string[] => {
  if (!writes) return [];
  const { location, minutes, discover = [], memory = [], pins = [], diary = [], entities: entityWrites = [] } = writes;
  const entityName = (entity: string) => entityNames.get(entity) ?? entity;
  const placeName = (id: string) => locations.find((place) => place.id === id)?.name ?? id;
  return [
    ...(location === undefined ? [] : [`location.move: ${placeName(location)}`]),
    ...(minutes === undefined ? [] : [`clock.advance: ${minutes} minutes`]),
    ...discover.map(({ name, description }) => `discover: ${name}${description === undefined ? '' : ', described'}`),
    ...memory.map((line) => `memories.add: ${line}`),
    ...pins.map((line) => `memories.pin: ${line}`),
    ...diary.map(({ entity, line }) => `diary: ${entityName(entity)}: ${line}`),
    ...entityWrites.map((write) => `${memberPath('entities', entityName(write.entity))}.${write.kind === 'move' ? `move: ${placeName(write.location)}` : `${write.kind}()`}`),
  ];
};

/** Test Code's snapshot of `world` at turn one for a `timing` run. No playthrough: no picks, no persona and no
 *  rolls (Q3). The editor holds no discovered cast, so a `diary` name it lacks is a warning (Q46). */
export const testCodeSnapshotOf = (
  world: OpeningFoldWorld, timing: ScriptTiming, overlays: Pick<SnapshotOptions, 'pendingPersona' | 'assumedStats'> = {},
): SandboxSnapshot => snapshotOf(
  { ...openingStateOf(world), clock: turnOneClock(timing), turn: sampleTurn(world.worldOverview, timing) }, { openCast: true, ...overlays },
);

/**
 * Runs `code` from the `timing` box of `home` on `world` at turn one. Applies nothing. With `pendingPersona`, a
 * `persona` write to a trait or placeholder a persona-capable entity holds is reported as pending.
 */
export async function runTestCode(
  code: string, timing: ScriptTiming, home: UnitHome, world: OpeningFoldWorld,
  { pendingPersona: pending = false, missing, sentence, prompts, args }: TestRunOptions = {},
): Promise<TestCodeReport> {
  const seeded = openingHomeOf(home);
  const stat = 'stat' in seeded ? seeded.stat : null;
  const list = allPlaceholders(world);
  const entityNames = new Map((world.entities ?? []).map((entity) => [entity.id, statCodeName(entity.name, list)]));
  const { locations } = codeLocationsOf(world.locations ?? [], list);
  const assumed = [...new Set((missing ?? []).filter(({ kind }) => kind === 'stat').map(({ segments }) => segments[0]))];
  const snapshot = testCodeSnapshotOf(world, timing, { pendingPersona: pending, ...(assumed.length && { assumedStats: assumed }) });
  const unit: ScriptRunUnit = {
    home: seeded, timing, code,
    ...(timing === 'output' && { narration: sentence ?? '' }),
    ...(timing === 'switch' && { switched: 'sample' as const }), ...(prompts && { prompts }), ...(args && { args }),
  };
  const outcome = await snapshot.run(unit);
  const assumedField = missing ? { assumed } : {};
  if (outcome.error) return { error: outcome.error, value: null, writes: [], ...(pending && { pending: [] }), ...assumedField, dropped: [] };
  // The executor names the empty persona '', and the empty `owner` too, which it marks.
  const personaWrites = pending ? outcome.entities?.find((row) => row.entity === '' && !row.owner) : undefined;
  // Under a pending persona, only the stand-in's placeholder node is rooted at `persona`.
  const isPersonaPin = (entry: PlaceholderWrite) => pending && entry.path[0] === 'persona';
  const pinLine = (entry: PlaceholderWrite, at: string) => ('unpin' in entry ? `${at} unpinned` : `${at} = ${codePinText(entry.value)}`);
  // Each owner's stat writes under the map code wrote through; the stand-in persona's are pending.
  const mapOf = ownerMaps(entityNames, home);
  const ownerLines = (outcome.ownerStatWrites ?? []).map((row) => {
    const { map, pending: toPersona } = mapOf(row);
    return { pending: toPersona, lines: row.writes.flatMap((write) => statWriteLines(map, write)) };
  });
  const writes = [
    ...CODE_BOUND_FIELDS.flatMap((field) => {
      const bound = outcome.bounds?.[field];
      return bound === undefined ? [] : [`${BOUND_LABELS[field]}: ${bound}`];
    }),
    ...(outcome.hidden === undefined ? [] : [`Hidden: ${outcome.hidden}`]),
    ...(outcome.statWrites ?? []).flatMap((write) => statWriteLines('stats', write)),
    ...ownerLines.filter((row) => !row.pending).flatMap((row) => row.lines),
    // The path the code wrote, not the placeholder's bare name: that is what the author typed.
    ...(outcome.placeholders ?? []).filter((entry) => !isPersonaPin(entry)).map((entry) => pinLine(entry, placeholderPathLabel(entry.path))),
    ...(outcome.traits ?? []).map((entry) => switchLine('', entry)),
    ...(outcome.entities ?? []).filter((entry) => entry !== personaWrites).flatMap((row) =>
      (row.traits ?? []).map((entry) => switchLine(`${traitWritesPath(row)}.`, entry))),
    ...(outcome.lore ?? []).map(({ path, value }) => `${path} = ${value}`),
    ...(outcome.choices ? [`turn.choices = ${JSON.stringify(outcome.choices)}`] : []),
    ...worldWriteLines(outcome.worldWrites, locations, entityNames),
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
    ...droppedLine('Unknown dictionary entries.', outcome.unknownLore),
    ...readOnlyWritesLines(outcome.readOnlyWrites),
    ...(outcome.maybeDiary ?? []).map((name) => `Diary target “${name}” may be discovered in play.`),
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
    error: null, value: outcome.value === null || !stat ? null : clampToOwnRange(outcome.value, stat, outcome.bounds), writes,
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
    ...(args && { reply: outcome.reply ?? null }),
  };
}
