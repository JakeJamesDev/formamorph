import { buildDictionaryContext } from '../dictionaryUtils';
import { formatAbsolute } from '../gameClock';
import {
  buildDestinationsContext, buildLocationContext, buildParentLocationContext, buildReachableEntitiesContext,
  buildReachableLocationsContext, buildSublocationEntitiesContext, buildSublocationsContext, chipFormat,
  expandScopedTokens, renderEntityRoster, sublocationEntityIds, type ContextOpts,
} from '../locationContext';
import { personaContextValues } from '../personaContext';
import { PLAYER_NAME, PLAYER_NAME_HEADER_KEY } from '../builtinPlaceholders';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import {
  decodeVariant, tokenVariant, variableForToken, variableVariantIds, withVariant, type PromptVariable,
} from '../promptVariables';
import { buildStatContext, type StatChipPart, type StatPlacement } from '../statContext';
import { statKeys } from '../statKeys';
import { stripMarkdown } from '../stripMarkdown';
import { buildTraitContext } from '../traitTree';
import type { PlayerStat } from '@/types';
import type { ChipScene } from './chipScene';

const WORLD = variableForToken('<WORLD DESCRIPTION>')!;
const STATS = variableForToken('<STATS DESCRIPTION>')!;
const TRAITS = variableForToken('<TRAITS DESCRIPTION>')!;
const NOTES = variableForToken('<NOTES>')!;
const TIME = variableForToken('<TIME>')!;
const DICTIONARY = variableForToken('<DICTIONARY>')!;
const ENTITIES = variableForToken('<ENTITIES>')!;
// A Header is reference text, cased mid-sentence; its title-casing capitalizes the words that lead.
const NO_PLAYER = PLAYER_NAME.resolve({ before: ' ' }, { kind: 'reference' });

/** Every concrete token one chip produces: its base form and each variant the registry defines. */
const familyTokens = (variable: PromptVariable): string[] =>
  [variable.token, ...variableVariantIds(variable).map((id) => withVariant(variable.token, id))];

/** One value per token of a chip, built from the token's decoded axis selection. */
function familyValues(
  variable: PromptVariable,
  build: (selection: Record<string, string | null>) => string,
): Record<string, string> {
  return Object.fromEntries(
    familyTokens(variable).map((token) => [token, build(decodeVariant(variable, tokenVariant(token)))]),
  );
}

/**
 * Every Stats chip token rendered from `stats`, nested as `placement` groups them: the Stats family on its
 * own. This is the module's one narrow export, for a caller that holds stats but no scene; `chipValues`
 * renders its Stats family through it. Placeholder chips are left as they are.
 */
export function statChipValues(stats: PlayerStat[], placement?: StatPlacement): Record<string, string> {
  return familyValues(STATS, (sel) => buildStatContext(
    stats,
    { values: sel.numbers != null, status: sel.descriptions != null, meaning: sel.meaning != null },
    chipFormat(sel.format),
    placement,
  ));
}

/** Every Stats chip token over `parts`, each part laid out by its own placement after the earlier parts'. A
 *  part with no stats adds nothing; with none at all, the chip reads as empty. */
export function statChipPartValues(parts: readonly StatChipPart[]): Record<string, string> {
  const filled = parts.filter((part) => part.stats.length).map((part) => statChipValues([...part.stats], part.placement));
  if (!filled.length) return statChipValues([]);
  return Object.fromEntries(Object.keys(filled[0]).map((token) => [token, filled.map((values) => values[token]).join('\n')]));
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
 * Turn a Chip Scene into a value for every scene-derived chip token the registry defines: World
 * Description, Stats, Traits, Persona, Location, Entities, Notes, Time and the lore blocks. Each family
 * walks its registry axes, so a token cannot be missed. The one other key is the Player Name, which only a
 * chip Header reads. Placeholder chips are resolved in every value.
 */
export function chipValues(scene: ChipScene): Record<string, string> {
  const { location, locations, connections } = scene;
  const locationScopes: Record<string, (opts: ContextOpts) => string> = {
    '': (opts) => buildLocationContext(location, opts),
    sublocations: (opts) => buildSublocationsContext(location, locations, opts),
    parent: (opts) => buildParentLocationContext(location, locations, opts),
    reachable: (opts) => buildReachableLocationsContext(location, locations, opts),
    destinations: (opts) => buildDestinationsContext(location, locations, connections, opts),
  };

  const traitIds = scene.traits.map((trait) => trait.id);
  const world = { stats: scene.stats, placement: scene.statPlacement };
  const played = playedStatParts(world, scene.playedStats ?? [], (name) => stripMarkdown(scene.resolve(name)).trim());
  // The persona's own stats render in its block; any other played entity's follow the world's.
  const personaId = scene.persona?.entity.id;
  const values: Record<string, string> = {
    [WORLD.token]: scene.overview,
    ...statChipPartValues([world, ...played.filter((part) => part.ownerId !== personaId)]),
    ...familyValues(TRAITS, (sel) => (
      buildTraitContext(traitIds, scene.traits, scene.traitGroups, chipFormat(sel.format)) || NONE_PLACEHOLDER
    )),
    // The played entity's owned traits and stats render in its own block, as a cast member's do.
    ...personaContextValues(scene.persona, scene.ownedTraits, played.find((part) => part.ownerId === personaId)?.stats),
    [PLAYER_NAME_HEADER_KEY]: scene.playerName == null ? NO_PLAYER : scene.playerName.trim(),
    ...familyValues(DICTIONARY, (sel) => {
      const position = sel.variant === 'before' ? 'before' : 'after';
      const entries = scene.lore.filter((entry) => (entry.position ?? 'after') === position);
      return buildDictionaryContext(entries, false) || NONE_PLACEHOLDER;
    }),
    [NOTES.token]: scene.notes || NONE_PLACEHOLDER,
    // Off or unknown reads as the uniform placeholder, so an affixed placement simply vanishes.
    [TIME.token]: scene.time ? formatAbsolute(scene.time.elapsed, scene.time.calendar) : NONE_PLACEHOLDER,
    ...expandScopedTokens('<LOCATION>', locationScopes),
    ...expandScopedTokens(ENTITIES.token, entityScopes(scene)),
  };
  return resolveAll(values, scene.resolve);
}

/** Every value with its placeholder chips resolved. */
function resolveAll(values: Record<string, string>, resolve: (text: string) => string): Record<string, string> {
  for (const token in values) values[token] = resolve(values[token]);
  return values;
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
 * who is in the scene in place of the location's roster. The same builder and expander as `chipValues`,
 * so the override cannot enumerate a set the base values do not.
 */
export function sceneEntityChipValues(scene: ChipScene, sceneIds: string[]): Record<string, string> {
  const { '': here } = entityScopes({ ...scene, presentIds: sceneIds });
  return resolveAll(expandScopedTokens(ENTITIES.token, { '': here }), scene.resolve);
}
