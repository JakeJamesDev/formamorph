import { buildDictionaryContext } from '../dictionaryUtils';
import { formatAbsolute } from '../gameClock';
import {
  buildDestinationsContext, buildLocationContext, buildParentLocationContext, buildReachableEntitiesContext,
  buildReachableLocationsContext, buildSublocationEntitiesContext, buildSublocationsContext, chipFormat,
  chipFamilyValues, ownedStatLines, renderEntityRoster, scopedChipValues, sublocationEntityIds, type ContextOpts,
} from '../locationContext';
import { personaContextValues } from '../personaContext';
import { PLAYER_NAME, PLAYER_NAME_HEADER_KEY } from '../builtinPlaceholders';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import { variableForToken, type PromptVariable } from '../promptVariables';
import { mapValues, memoLookup, type ValueLookup } from '../promptValues';
import { buildStatContext, type StatChipPart, type StatPlacement } from '../statContext';
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
  return chipFamilyValues(STATS.token, (sel) => buildStatContext(
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
  return memoLookup((key) => (filled[0](key) === undefined ? undefined : filled.map((values) => values(key)).join('\n')));
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
 * any token the registry's axes can spell has a value. The one other key is the Player Name, which only a
 * chip Header reads. Placeholder chips are resolved in every value.
 */
export function chipValues(scene: ChipScene): ValueLookup {
  const { location, locations, connections } = scene;
  const traitIds = scene.traits.map((trait) => trait.id);
  const world = { stats: scene.stats, placement: scene.statPlacement };
  const played = playedStatParts(world, scene.playedStats ?? [], (name) => stripMarkdown(scene.resolve(name)).trim());
  // The persona's own stats render in its block; any other played entity's follow the world's.
  const personaId = scene.persona?.entity.id;
  const families = new Map<PromptVariable, ValueLookup>([
    [WORLD, chipFamilyValues(WORLD.token, () => scene.overview)],
    [STATS, statChipPartValues([world, ...played.filter((part) => part.ownerId !== personaId)])],
    [TRAITS, chipFamilyValues(TRAITS.token, (sel) => (
      buildTraitContext(traitIds, scene.traits, scene.traitGroups, chipFormat(sel.format)) || NONE_PLACEHOLDER
    ))],
    // The played entity's owned traits and stats render in its own block, as a cast member's do.
    [PERSONA, personaContextValues(scene.persona, scene.ownedTraits, played.find((part) => part.ownerId === personaId)?.stats)],
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
    [ENTITIES, scopedChipValues(ENTITIES.token, entityScopes(scene))],
  ]);
  return mapValues((key) => {
    if (key === PLAYER_NAME_HEADER_KEY) return scene.playerName == null ? NO_PLAYER : scene.playerName.trim();
    const variable = variableForToken(key);
    return variable && families.get(variable)?.(key);
  }, (value) => scene.resolve(value));
}

/** The Entities chip's scope builders over one scene. */
function entityScopes(scene: ChipScene): Record<string, (opts: ContextOpts) => string> {
  const { location, locations, entities, presentIds, inSceneIds, inSceneNames = [], ownedTraits, ownedStats } = scene;
  const outer = scene.outerScopeEntities ?? entities;
  // Roster precedence: here > sub-location > reachable. A character shows only in the highest scope it
  // belongs to, so the lower scopes drop the ids the higher ones list.
  const reachableExclude = [...presentIds, ...sublocationEntityIds(location, locations, outer)];
  // Every scope renders each entity with its owned traits in force.
  const roster = (opts: ContextOpts) => ({ ...opts, ownedTraits });
  // Only the scopes of who is present carry stats, and the chip's stats piece can switch them off.
  const presentOpts = (opts: ContextOpts) => ({ ...roster(opts), ownedStats: opts.noStats ? undefined : ownedStats });
  return {
    '': (opts) => renderEntityRoster(presentIds, entities, presentOpts(opts)),
    sublocations: (opts) => buildSublocationEntitiesContext(location, locations, outer, { ...roster(opts), excludeIds: presentIds }),
    reachable: (opts) => buildReachableEntitiesContext(location, locations, outer, { ...roster(opts), excludeIds: reachableExclude }),
    inscene: (opts) => {
      const block = renderEntityRoster(inSceneIds, entities, presentOpts(opts));
      if (!opts.nameOnly || !inSceneNames.length) return block;
      return [...(block === NONE_PLACEHOLDER ? [] : [block]), ...inSceneNames].join(', ');
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
  return mapValues(scopedChipValues(ENTITIES.token, { '': here }), (value) => scene.resolve(value));
}

/** An entity's stats field in the scene, as the Entities chip's markdown form renders it, or '' when it holds
 *  none. An ad-hoc character, with no entity, holds none. */
export function entityStatsField(scene: ChipScene, entity: Entity | undefined): string {
  const stats = (entity && scene.ownedStats?.[entity.id]) ?? [];
  return entity && stats.length ? scene.resolve(ownedStatLines(entity, stats, 'markdown')) : '';
}
