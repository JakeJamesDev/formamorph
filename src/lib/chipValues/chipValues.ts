import { buildDictionaryContext } from '../dictionaryUtils';
import { formatAbsolute } from '../gameClock';
import {
  buildDestinationsContext, buildLocationContext, buildParentLocationContext, buildReachableEntitiesContext,
  buildReachableLocationsContext, buildSublocationEntitiesContext, buildSublocationsContext, chipFormat,
  expandScopedTokens, renderEntityRoster, sublocationEntityIds, type ContextOpts,
} from '../locationContext';
import { buildPersonaContext } from '../personaContext';
import { NONE_PLACEHOLDER } from '../promptFallbacks';
import {
  decodeVariant, tokenVariant, variableForToken, variableVariantIds, withVariant, type PromptVariable,
} from '../promptVariables';
import { buildStatContext } from '../statContext';
import { buildTraitContext } from '../traitTree';
import type { PlayerStat } from '@/types';
import type { ChipScene } from './chipScene';

const WORLD = variableForToken('<WORLD DESCRIPTION>')!;
const STATS = variableForToken('<STATS DESCRIPTION>')!;
const TRAITS = variableForToken('<TRAITS DESCRIPTION>')!;
const NOTES = variableForToken('<NOTES>')!;
const TIME = variableForToken('<TIME>')!;
const DICTIONARY = variableForToken('<DICTIONARY>')!;

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
 * Every Stats chip token rendered from `stats`: the Stats family on its own. This is the module's one narrow
 * export, for a caller that holds stats but no scene; `chipValues` renders its Stats family through it.
 * Placeholder chips are left as they are.
 */
export function statChipValues(stats: PlayerStat[]): Record<string, string> {
  return familyValues(STATS, (sel) => buildStatContext(
    stats,
    { values: sel.numbers != null, status: sel.descriptions != null, meaning: sel.meaning != null },
    chipFormat(sel.format),
  ));
}

/**
 * Turn a Chip Scene into a value for every scene-derived chip token the registry defines: World
 * Description, Stats, Traits, Persona, Location, Entities, Notes, Time and the lore blocks. Each family
 * walks its registry axes, so a token cannot be missed; the map holds no other token. Placeholder chips are
 * resolved in every value.
 */
export function chipValues(scene: ChipScene): Record<string, string> {
  const { location, locations, connections, entities, presentIds } = scene;
  const locationScopes: Record<string, (opts: ContextOpts) => string> = {
    '': (opts) => buildLocationContext(location, opts),
    sublocations: (opts) => buildSublocationsContext(location, locations, opts),
    parent: (opts) => buildParentLocationContext(location, locations, opts),
    reachable: (opts) => buildReachableLocationsContext(location, locations, opts),
    destinations: (opts) => buildDestinationsContext(location, locations, connections, opts),
  };
  // Roster precedence: here > sub-location > reachable. A character shows only in the highest scope it
  // belongs to, so the lower scopes drop the ids the higher ones list.
  const reachableExclude = [...presentIds, ...sublocationEntityIds(location, locations, entities)];
  const entityScopes: Record<string, (opts: ContextOpts) => string> = {
    '': (opts) => renderEntityRoster(presentIds, entities, opts),
    sublocations: (opts) => buildSublocationEntitiesContext(location, locations, entities, { ...opts, excludeIds: presentIds }),
    reachable: (opts) => buildReachableEntitiesContext(location, locations, entities, { ...opts, excludeIds: reachableExclude }),
    inscene: (opts) => renderEntityRoster(scene.inSceneIds, entities, opts),
  };

  const traitIds = scene.traits.map((trait) => trait.id);
  const values: Record<string, string> = {
    [WORLD.token]: scene.overview,
    ...statChipValues(scene.stats),
    ...familyValues(TRAITS, (sel) => (
      traitIds.length
        ? buildTraitContext(traitIds, scene.traits, scene.traitGroups, chipFormat(sel.format))
        : NONE_PLACEHOLDER
    )),
    ...expandScopedTokens('<PERSONA>', { '': (opts) => buildPersonaContext(scene.persona, opts) }),
    ...familyValues(DICTIONARY, (sel) => {
      const position = sel.variant === 'before' ? 'before' : 'after';
      const entries = scene.lore.filter((entry) => (entry.position ?? 'after') === position);
      return buildDictionaryContext(entries, false) || NONE_PLACEHOLDER;
    }),
    [NOTES.token]: scene.notes || NONE_PLACEHOLDER,
    // Off or unknown reads as the uniform placeholder, so an affixed placement simply vanishes.
    [TIME.token]: scene.time ? formatAbsolute(scene.time.elapsed, scene.time.calendar) : NONE_PLACEHOLDER,
    ...expandScopedTokens('<LOCATION>', locationScopes),
    ...expandScopedTokens('<ENTITIES>', entityScopes),
  };

  for (const token in values) values[token] = scene.resolve(values[token]);
  return values;
}
