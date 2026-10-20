import { buildDictionaryContext } from '../dictionaryUtils';
import { formatAbsolute } from '../gameClock';
import {
  buildDestinationsContext, buildLocationContext, buildParentLocationContext, buildReachableLocationsContext,
  buildSublocationsContext, chipFamilyRuns, chipFamilyValues, chipFormat, entityRosterRuns, hasOnlyWith, ownedStatLines,
  knownEntityIds, knownEntityRuns, reachableEntityIds, reachableEntityRuns, scopedChipRuns, scopedChipValues, sublocationEntityIds, sublocationEntityRuns, type ContextOpts,
} from '../locationContext';
import { relatedIds, relationshipCast, relationshipLines } from '../entityRelationships';
import { joinRuns, mark, textOf, type MarkedText } from '../markedText';
import { personaContextValues } from '../personaContext';
import { PLAYER_NAME, PLAYER_NAME_HEADER_KEY } from '../builtinPlaceholders';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import { variableForToken, type PromptVariable } from '../promptVariables';
import { fromMarked, mapValues, readMarked, withMarked, type ValueLookup } from '../promptValues';
import { statContextRuns, type StatChipPart, type StatPlacement } from '../statContext';
import { statKeys } from '../statKeys';
import { stripMarkdown } from '../stripMarkdown';
import { buildTraitContext } from '../traitTree';
import type { Entity, PlayerStat } from '@/types';
import type { ChipScene } from './chipScene';

const WORLD = variableForToken('<WORLD DESCRIPTION>')!;
const STATS = variableForToken('<STATS DESCRIPTION>')!;
const TRAITS = variableForToken('<TRAITS DESCRIPTION>')!;
const PERSONA = variableForToken('<PERSONA>')!;
const LOCATION = variableForToken('<LOCATION>')!;
const NOTES = variableForToken('<NOTES>')!;
const TIME = variableForToken('<TIME>')!;
const DICTIONARY = variableForToken('<DICTIONARY>')!;
const ENTITIES = variableForToken('<ENTITIES>')!;
// A Header is reference text, cased mid-sentence; its title-casing capitalizes the words that lead.
const NO_PLAYER = PLAYER_NAME.resolve({ before: ' ' }, { kind: 'reference' });

/**
 * Every Stats chip token rendered from `stats`, nested as `placement` groups them: the Stats family on its
 * own. This is the module's one narrow export, for a caller that holds stats but no scene; `chipValues`
 * renders its Stats family through it. Placeholder chips are left as they are.
 */
export function statChipValues(stats: PlayerStat[], placement?: StatPlacement): ValueLookup {
  return chipFamilyRuns(STATS.token, (sel) => statContextRuns(
    stats,
    { values: sel.numbers != null, status: sel.descriptions != null, meaning: sel.meaning != null },
    chipFormat(sel.format),
    placement,
  ));
}

/** Every Stats chip token over `parts`, each part laid out by its own placement after the earlier parts'. A
 *  part with no stats adds nothing; with none at all, the chip reads as empty. */
export function statChipPartValues(parts: readonly StatChipPart[]): ValueLookup {
  const filled = parts.filter((part) => part.stats.length).map((part) => statChipValues([...part.stats], part.placement));
  if (!filled.length) return statChipValues([]);
  return fromMarked((key) => (
    filled[0](key) === undefined ? undefined : joinRuns(filled.map((values) => readMarked(values, key) ?? []), '\n')
  ));
}

/** Each played entity's part after the world's stats. A played stat whose plain name clashes with an earlier
 *  stat takes the numbered key the stat request gives it; every other name stays as written. */
export function playedStatParts<P extends StatChipPart>(
  world: StatChipPart, played: readonly P[], plainName: (name: string) => string,
): P[] {
  if (!played.some((part) => part.stats.length)) return [];
  const keys = statKeys([world, ...played].flatMap((part) => part.stats.map((stat) => plainName(stat.name))));
  let at = world.stats.length;
  return played.map((part) => ({
    ...part,
    stats: part.stats.map((stat) => {
      const key = keys[at++];
      return key === plainName(stat.name) ? stat : { ...stat, name: key };
    }),
  }));
}

/**
 * A Chip Scene as a lookup over every scene-derived chip token: World Description, Stats, Traits, Persona,
 * Location, Entities, Notes, Time and the lore blocks. A key renders from its decoded axes on first read, so
 * any token the registry's axes can spell has a value. The one other key is the Persona Name, which only a
 * chip Header reads. Placeholder chips are resolved in every value.
 */
export function chipValues(scene: ChipScene): ValueLookup {
  const { location, locations, connections } = scene;
  const traitIds = scene.traits.map((trait) => trait.id);
  const world = { stats: scene.stats, placement: scene.statPlacement };
  const played = playedStatParts(world, scene.playedStats ?? [], (name) => stripMarkdown(scene.resolve(name)).trim());
  // Every played entity's stats render in the persona's block; with no persona, they follow the global stats.
  const personaId = scene.persona?.entity.id;
  const otherIds = [...new Set([...(scene.playedEntities ?? []).map((e) => e.id), ...played.map((part) => part.ownerId)])]
    .filter((id) => id !== personaId);
  const others = otherIds.map((id) => {
    const part = played.find((p) => p.ownerId === id);
    return { stats: part?.stats ?? [], placement: part?.placement, entity: scene.playedEntities?.find((e) => e.id === id) };
  });
  const cast = sceneRelationshipCast(scene);
  const families = new Map<PromptVariable, ValueLookup>([
    [WORLD, chipFamilyValues(WORLD.token, () => scene.overview)],
    [STATS, statChipPartValues(scene.persona ? [world] : [world, ...played])],
    [TRAITS, chipFamilyValues(TRAITS.token, (sel) => (
      buildTraitContext(traitIds, scene.traits, scene.traitGroups, chipFormat(sel.format)) || NONE_PLACEHOLDER
    ))],
    // The played entities' owned traits and stats render in the persona's block, as a cast member's do.
    // A relationship that touches the played persona prints on its block.
    [PERSONA, personaContextValues(
      scene.persona, scene.ownedTraits, played.find((part) => part.ownerId === personaId)?.stats, others,
      personaId ? relationshipLines(cast, [], personaId) : undefined,
    )],
    [DICTIONARY, chipFamilyValues(DICTIONARY.token, (sel) => {
      const position = sel.variant === 'before' ? 'before' : 'after';
      const entries = scene.lore.filter((entry) => (entry.position ?? 'after') === position);
      return buildDictionaryContext(entries, false) || NONE_PLACEHOLDER;
    })],
    [NOTES, chipFamilyValues(NOTES.token, () => scene.notes || NONE_PLACEHOLDER)],
    // Off or unknown reads as the uniform placeholder, so an affixed placement simply vanishes.
    [TIME, chipFamilyValues(TIME.token, () => (scene.time ? formatAbsolute(scene.time.elapsed, scene.time.calendar) : NONE_PLACEHOLDER))],
    [LOCATION, scopedChipValues(LOCATION.token, {
      '': (opts) => buildLocationContext(location, opts),
      sublocations: (opts) => buildSublocationsContext(location, locations, opts),
      parent: (opts) => buildParentLocationContext(location, locations, opts),
      reachable: (opts) => buildReachableLocationsContext(location, locations, opts),
      destinations: (opts) => buildDestinationsContext(location, locations, connections, opts),
    })],
    [ENTITIES, scopedChipRuns(ENTITIES.token, entityScopes(scene, cast))],
  ]);
  const familyOf = (key: string) => {
    const variable = variableForToken(key);
    return variable && families.get(variable);
  };
  return mapValues(withMarked((key) => {
    if (key === PLAYER_NAME_HEADER_KEY) return scene.playerName == null ? NO_PLAYER : scene.playerName.trim();
    return familyOf(key)?.(key);
  }, (key) => {
    const family = familyOf(key);
    return family ? readMarked(family, key) : undefined;
  }), (value) => scene.resolve(value));
}

/** The scene's relationship ends, the played persona first. */
const sceneRelationshipCast = (scene: Pick<ChipScene, 'entities' | 'persona' | 'playedEntities'>) =>
  relationshipCast(scene.entities, scene.persona?.entity ?? null, scene.playedEntities);

/** The ids a relationship pulls into the known roster: the other end of each one that touches the played
 *  persona, Here or In Scene. */
export function knownPulledIds(scene: Pick<ChipScene, 'entities' | 'persona' | 'playedEntities' | 'presentIds' | 'inSceneIds'>): string[] {
  return pulledIdsOver(sceneRelationshipCast(scene), scene);
}

/** {@link knownPulledIds} over a cast already built. */
const pulledIdsOver = (cast: readonly Entity[], scene: Pick<ChipScene, 'persona' | 'presentIds' | 'inSceneIds'>) => {
  const personaId = scene.persona?.entity.id;
  return [...relatedIds(cast, [...(personaId ? [personaId] : []), ...scene.presentIds, ...scene.inSceneIds])];
};

/** The Entities chip's scope builders over one scene and its relationship ends. */
function entityScopes(scene: ChipScene, cast = sceneRelationshipCast(scene)): Record<string, (opts: ContextOpts) => MarkedText> {
  const { location, locations, connections, entities, presentIds, inSceneIds, inSceneNames = [], ownedTraits, ownedStats } = scene;
  const outer = scene.outerScopeEntities ?? entities;
  // Roster precedence: here > sub-location > reachable > known. A character shows only in the highest scope
  // it belongs to, so the lower scopes drop the ids the higher ones list.
  const reachableExclude = [...presentIds, ...sublocationEntityIds(location, locations, outer)];
  const knownExclude = [...reachableExclude, ...reachableEntityIds(location, locations, connections, outer)];
  const pulledIds = pulledIdsOver(cast, scene);
  // Each relationship prints once over the chain, and once over In Scene, which no default prompt pairs with it.
  // The Persona block heads both, so a line that touches the persona prints there alone.
  const personaId = scene.persona?.entity.id;
  const chainLines = relationshipLines(cast, [...knownExclude, ...knownEntityIds(location, locations, outer, pulledIds)], personaId);
  const inSceneLines = relationshipLines(cast, inSceneIds, personaId);
  // Every scope renders each entity with its owned traits in force. The scene's owned stats go to every
  // scope, since Only With counts them; whether a scope lists them is `noStats`.
  const roster = (opts: ContextOpts, lines = chainLines) => ({ ...opts, ownedTraits, ownedStats, relationshipLines: lines });
  // Here and In Scene list stats unless the chip switches them off; the lower scopes only when it switches them on.
  const lowerOpts = (opts: ContextOpts) => ({ ...roster(opts), noStats: !opts.statsOn });
  return {
    '': (opts) => entityRosterRuns(presentIds, entities, roster(opts)),
    sublocations: (opts) => sublocationEntityRuns(location, locations, outer, { ...lowerOpts(opts), excludeIds: presentIds }),
    reachable: (opts) => reachableEntityRuns(location, locations, connections, outer, { ...lowerOpts(opts), excludeIds: reachableExclude }),
    known: (opts) => knownEntityRuns(location, locations, outer, { ...roster(opts), excludeIds: knownExclude, pulledIds }),
    inscene: (opts) => {
      const block = entityRosterRuns(inSceneIds, entities, roster(opts, inSceneLines));
      // A name with no entity record owns nothing, so a filter drops it.
      if (!opts.nameOnly || !inSceneNames.length || hasOnlyWith(opts)) return block;
      const names = inSceneNames.map((name) => mark(['content'], name));
      return joinRuns([...(textOf(block) === NONE_PLACEHOLDER ? [] : [block]), ...names], ', ');
    },
  };
}

/**
 * The scene-roster override for the Choices and re-roll prompts: every unscoped Entities token, built from
 * who is in the scene in place of the location's roster. The same builder as `chipValues`, so the override
 * cannot spell a token the base values do not.
 */
export function sceneEntityChipValues(scene: ChipScene, sceneIds: string[]): ValueLookup {
  const { '': here } = entityScopes({ ...scene, presentIds: sceneIds });
  return mapValues(scopedChipRuns(ENTITIES.token, { '': here }), (value) => scene.resolve(value));
}

/** An entity's stats field in the scene, as the Entities chip's markdown form renders it, or '' when it holds
 *  none. An ad-hoc character, with no entity, holds none. */
export function entityStatsField(scene: ChipScene, entity: Entity | undefined): string {
  const stats = (entity && scene.ownedStats?.[entity.id]) ?? [];
  return entity && stats.length ? scene.resolve(ownedStatLines(entity, stats, 'markdown')) : '';
}
