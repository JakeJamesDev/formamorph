/**
 * One Test Code run: a stat box's code run once on the authored world, with no playthrough. The editor's
 * Test Code button and Formaquestion's code test both run through here, so both report the same writes.
 */
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { codePinText } from '@/lib/placeholderPins';
import { PLACEHOLDER_PATH_SEPARATOR } from '@/lib/placeholders';
import {
  CODE_BOUND_FIELDS, entityTraitsPath, executeStatCode, type CodeBoundField, type PlaceholderWrite, type SandboxEntity,
  type SandboxPlaceholderNode, type TraitWrite,
} from '@/lib/statCodeExecutor';
import type { AnalysisOptions, CodeEntityNames, CodePlaceholders, MissingName } from '@/lib/statCodeAnalysis';
import { statCodeName, statCodeNamed } from '@/lib/statCodeNames';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from '@/lib/statCodePlaceholders';
import { placeholderPathExpression, placeholderPathLabel } from '@/lib/statCodePaths';
import type { StatCodeTiming } from '@/lib/statCodeTiming';
import { entityTraitNames, sandboxTraits, unplayedEntities } from '@/lib/statCodeTraits';
import type { Stat, Trait, World } from '@/types';

/** Test Code names each bound a run wrote with its Details field label. */
const BOUND_LABELS: Record<CodeBoundField, string> = { min: 'Min', max: 'Max', regen: 'Regen' };

/** The clock each box reads under Test Code: the turn start the before box gets, a one-hour turn for the
 *  after box. Zero elapsed puts the before run on the opening turn, which its templates are written for. */
const TEST_CLOCK: Record<StatCodeTiming, { deltaHours: number; elapsedHours: number }> = {
  before: { deltaHours: 0, elapsedHours: 0 },
  after: { deltaHours: 1, elapsedHours: 1 },
};

/** The names a run reads and the editor's reader checks, all under their code names. */
export interface StatCodeNames {
  /** The world's stats under their code names. */
  codeNamedStats: Stat[];
  statNames: string[];
  placeholders: CodePlaceholders;
  traitNames: string[];
  /** The world's traits, for the run's sandbox entries. */
  traits: readonly Trait[];
  /** Every authored entity's code name and trait code names. */
  entities: CodeEntityNames[];
}

/** The parts of an authored world a stat's code reaches. */
export type StatCodeWorld = Pick<World, 'stats' | 'traits' | 'traitGroups' | 'entities' | 'entityGroups' | 'placeholders' | 'placeholderGroups' | 'dictionaries'>;

/** The names of `world` as the stat panel reads them. */
export function statCodeNames(world: StatCodeWorld): StatCodeNames {
  const list = allPlaceholders(world);
  const codeNamedStats = statCodeNamed(world.stats, list);
  return {
    codeNamedStats,
    statNames: codeNamedStats.map((stat) => stat.name).filter(Boolean),
    placeholders: { list, owners: placeholderOwners(world), dictionaries: codeDictionaries(world.dictionaries, list) },
    traitNames: statCodeNamed(world.traits, list).map((trait) => trait.name),
    traits: world.traits,
    entities: entityTraitNames({ ...world, traitGroups: world.traitGroups ?? [] }, list),
  };
}

/** The editor reader's options for code of the stat `selfName` names, under `names`. */
export const analysisOptionsOf = (
  { placeholders, traitNames, entities, statNames }: Pick<StatCodeNames, 'placeholders' | 'traitNames' | 'entities' | 'statNames'>, selfName?: string,
): AnalysisOptions =>
  ({ placeholders, traits: traitNames, entities, statNames, ...(selfName && { selfName }) });

/** The stat of `world` that code names `name`: by code name first, then by authored name. */
export function statNamed(world: StatCodeWorld, name: string): Stat | undefined {
  const list = allPlaceholders(world);
  return world.stats.find((stat) => statCodeName(stat.name, list) === name) ?? world.stats.find((stat) => stat.name === name);
}

/** What one run did. */
export interface TestCodeReport {
  /** Why the run failed; every write is then dropped. Null when it ran. */
  error: string | null;
  /** The value the code set, by return or by `self.value`; null when it left the value alone. */
  value: number | null;
  /** Each bound, placeholder and trait switch the run wrote, as one line each. */
  writes: string[];
  /** Each `persona` trait switch and placeholder write, which lands on the played persona in a real turn.
   *  Present only on a run that takes the persona as pending. */
  pending?: string[];
  /** The stats the run made up for names the world does not have yet. Present only on a run given them. */
  assumed?: string[];
  /** Each kind of write the run dropped, as one line each with the names. */
  dropped: string[];
}

/** How a run reads a world still being built. */
export interface TestRunOptions {
  /** Take `persona` as the persona to be played: it holds every trait and placeholder a persona-capable
   *  entity holds, and its writes are pending. */
  pendingPersona?: boolean;
  /** Names the world does not have yet. Each stat among them runs as a number at 0 in 0–100, and a write
   *  to any of them is left out of `dropped`. */
  missing?: readonly MissingName[];
}

/** The range and value an assumed stat runs with. */
const ASSUMED_STAT = { min: 0, max: 100, value: 0 };

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

/** The empty persona holding every trait name and placeholder a persona-capable entity holds, none chosen,
 *  and in the scene. Its traits read as an unplayed entity's do. */
const personaOfPlayables = (entities: readonly CodeEntityNames[], placeholders: SandboxPlaceholderNode): SandboxEntity => ({
  name: '',
  inScene: true,
  traits: [...new Set(entities.filter((entity) => entity.persona).flatMap((entity) => entity.traits.map((trait) => trait.name)))]
    .map((name) => ({ name, enabled: false, acquired: false })),
  placeholders,
});

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

/** The line of a dropped kind of write, or none when no names are left. */
const droppedLine = (lead: string, names: readonly string[] | undefined) =>
  (names?.length ? [`${lead} Writes ignored: ${names.join(', ')}.`] : []);

/**
 * Runs `code` from the `timing` box of `stat`, whose name is its code name. Applies nothing. With
 * `pendingPersona`, a `persona` write to a trait or placeholder a persona-capable entity holds is reported
 * as pending.
 */
export async function runTestCode(
  code: string, timing: StatCodeTiming, stat: Partial<Stat> & Pick<Stat, 'id' | 'name'>,
  { codeNamedStats, placeholders, traits, entities }: Pick<StatCodeNames, 'codeNamedStats' | 'placeholders' | 'traits' | 'entities'>,
  { pendingPersona: pending = false, missing }: TestRunOptions = {},
): Promise<TestCodeReport> {
  // No playthrough: an unrolled placeholder reads as a fresh draw, no one holds a trait, and no persona plays.
  // A pending run's empty persona holds the playable entities' traits and placeholders, so a write to one is kept.
  const placeholderEntries = sandboxPlaceholders({ placeholders: placeholders.list, owners: placeholders.owners, rolls: {} });
  const owners = placeholderEntries.owners;
  const traitEntries = sandboxTraits(
    { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [...traits], groups: [] } },
    placeholders.list,
  );
  const personaNode = pending ? personaPlaceholders(entities, owners) : undefined;
  const assumed = [...new Set((missing ?? []).filter(({ kind }) => kind === 'stat').map(({ segments }) => segments[0]))];
  const stats = assumed.length ? [
    ...codeNamedStats,
    ...assumed.map((name): Stat => ({ id: crypto.randomUUID(), name, type: 'number', description: '', regen: 0, descriptors: [], ...ASSUMED_STAT })),
  ] : codeNamedStats;
  const outcome = await executeStatCode(
    // A half-filled stat still runs: the executor defaults every number it marshals, so only the id and the
    // code name have to be real.
    code, stats, stat as Stat,
    {
      clock: TEST_CLOCK[timing], placeholders: placeholderEntries.top, traits: traitEntries,
      entities: unplayedEntities(entities, owners),
      dictionaries: sandboxDictionaries(placeholders.dictionaries ?? [], owners),
      ...(personaNode && { persona: personaOfPlayables(entities, personaNode) }),
    },
  );
  const assumedField = missing ? { assumed } : {};
  if (outcome.error) return { error: outcome.error, value: null, writes: [], ...(pending && { pending: [] }), ...assumedField, dropped: [] };
  // The executor names the empty persona ''.
  const personaWrites = pending ? outcome.entities?.find(({ entity }) => entity === '') : undefined;
  const personaKeys = personaNode ? nodeKeys(personaNode) : new Set<string>();
  const isPersonaPin = (entry: PlaceholderWrite) => personaKeys.has(pinKey(entry.id, entry.path));
  const pinLine = (entry: PlaceholderWrite, at: string) => ('unpin' in entry ? `${at} unpinned` : `${at} = ${codePinText(entry.value)}`);
  const writes = [
    ...CODE_BOUND_FIELDS.flatMap((field) => {
      const bound = outcome.bounds?.[field];
      return bound === undefined ? [] : [`${BOUND_LABELS[field]}: ${bound}`];
    }),
    // The path the code wrote, not the placeholder's bare name: that is what the author typed.
    ...(outcome.placeholders ?? []).filter((entry) => !isPersonaPin(entry)).map((entry) => pinLine(entry, placeholderPathLabel(entry.path))),
    ...(outcome.traits ?? []).map((entry) => switchLine('', entry)),
    ...(outcome.entities ?? []).filter((entry) => entry !== personaWrites).flatMap(({ entity, traits: switched = [] }) =>
      switched.map((entry) => switchLine(`${entityTraitsPath(entity)}.`, entry))),
  ];
  const keep = missing ? droppedFilter(missing) : KEEP_DROPPED;
  const dropped = [
    ...droppedLine('Unknown placeholder paths.', outcome.unknownPlaceholders?.filter(keep.placeholder)),
    ...droppedLine('Placeholders of owners not in play.', outcome.unknownOwnerPlaceholders?.filter(keep.placeholder)),
    ...droppedLine('Unknown trait names.', outcome.unknownTraits?.filter(keep.trait(null))),
    ...droppedLine('acquired is read-only.', outcome.acquiredWrites),
    ...droppedLine('Unknown entity names.', outcome.unknownEntities?.filter(keep.entity)),
    ...droppedLine('Read-only fields.', outcome.readOnlyWrites),
    ...(outcome.entities ?? []).flatMap(({ entity, unknownTraits, acquiredWrites }) => {
      const at = (names: string[]) => names.map((name) => `${entityTraitsPath(entity)}.${name}`);
      return [
        ...droppedLine('Unknown trait names.', unknownTraits && at(unknownTraits.filter(keep.trait(entity)))),
        ...droppedLine('acquired is read-only.', acquiredWrites && at(acquiredWrites)),
      ];
    }),
  ];
  return {
    error: null, value: outcome.value, writes,
    ...(pending && {
      pending: [
        ...(personaWrites?.traits ?? []).map((entry) => switchLine(`${entityTraitsPath('')}.`, entry)),
        ...(outcome.placeholders ?? []).filter(isPersonaPin).map((entry) => pinLine(entry, placeholderPathExpression(entry.path, 'persona'))),
      ],
    }),
    ...assumedField,
    dropped,
  };
}
