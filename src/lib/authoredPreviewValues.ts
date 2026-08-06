import {
  buildLocationContext, buildEntityContext, buildSublocationsContext, buildSublocationEntitiesContext,
  buildReachableLocationsContext, buildReachableEntitiesContext, buildDestinationsContext,
  buildParentLocationContext, sublocationEntityIds, expandScopedTokens, type ContextOpts,
} from './locationContext';
import { buildStatContext } from './statContext';
import { buildDictionaryContext, flattenEnabledBookEntries } from './dictionaryUtils';
import { buildTraitContext } from './traitTree';
import { resolveStartingLocation } from './startingLocation';
import { resolvePlaceholders } from './placeholders';
import { variableForToken, variableVariantIds, withVariant, decodeVariant, tokenVariant } from './promptVariables';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, TraitGroup, WorldOverview } from '@/types';

const STATS_VARIABLE = variableForToken('<STATS DESCRIPTION>')!;
const STATS_TOKENS = [
  '<STATS DESCRIPTION>',
  ...variableVariantIds(STATS_VARIABLE).map((id) => withVariant('<STATS DESCRIPTION>', id)),
];

/** The authored world, as the editor holds it — no playthrough, no runtime state. */
export interface AuthoredWorld {
  worldOverview: WorldOverview;
  stats: Stat[];
  locations: GameLocation[];
  entities: Entity[];
  traits: Trait[];
  traitGroups?: TraitGroup[];
  dictionaries?: Dictionary[];
  placeholders?: Placeholder[];
}

/**
 * What the world being edited would put into a prompt, for the editor's Preview — the same context builders
 * the running game feeds its prompts, given the authored world instead of a playthrough.
 *
 * The scene is the world's own opening: its starting location, that location's cast, every stat at its
 * authored starting value, the traits the author marked default, and every enabled lore entry (nothing has
 * been typed yet, so no keyword has fired to narrow them). Tokens that only a turn can answer
 * (the player's action, the narration, who is speaking) are absent, so the caller's sample pool still
 * covers them — the same layering `composePreviewValues` does for a live game.
 */
export function authoredPreviewValues(world: AuthoredWorld): Record<string, string> {
  const {
    worldOverview, stats, locations, entities, traits, traitGroups = [], dictionaries = [], placeholders = [],
  } = world;
  // A world with no locations yet previews as "nowhere" rather than failing — the builders all take null.
  const loc = resolveStartingLocation(locations, null) ?? null;
  // Preview-only: chips resolve against a fresh roll, since a world has no playthrough whose rolls could
  // be reused. A Wildcard therefore shows one of its values rather than its raw token.
  const resolve = (text: string) => resolvePlaceholders(text, { placeholders, rolls: {} });

  const presentIds = loc?.entities ?? [];
  const subEntityIds = loc ? sublocationEntityIds(loc, locations) : [];
  const reachableExclude = [...presentIds, ...subEntityIds];

  const locationScopes: Record<string, (opts: ContextOpts) => string> = {
    '': (opts) => buildLocationContext(loc, opts),
    sublocations: (opts) => buildSublocationsContext(loc, locations, opts),
    parent: (opts) => buildParentLocationContext(loc, locations, opts),
    reachable: (opts) => buildReachableLocationsContext(loc, locations, opts),
    destinations: (opts) => buildDestinationsContext(loc, locations, opts),
  };
  const entityScopes: Record<string, (opts: ContextOpts) => string> = {
    '': (opts) => buildEntityContext(loc, entities, opts),
    sublocations: (opts) => buildSublocationEntitiesContext(loc, locations, entities, { ...opts, excludeIds: presentIds }),
    reachable: (opts) => buildReachableEntitiesContext(loc, locations, entities, { ...opts, excludeIds: reachableExclude }),
    // No turns have happened, so nobody is "in scene" beyond who the author placed here.
    inscene: (opts) => buildEntityContext(loc, entities, opts),
  };

  // Stats read their authored starting value — the same shape a playthrough's stats carry.
  const playerStats = stats.map((stat) => ({ ...stat, value: typeof stat.value === 'number' ? stat.value : stat.min }));
  const statsValues = Object.fromEntries(STATS_TOKENS.map((token) => {
    const sel = decodeVariant(STATS_VARIABLE, tokenVariant(token));
    return [token, buildStatContext(
      playerStats,
      { values: sel.numbers != null, status: sel.descriptions != null, meaning: sel.meaning != null },
      sel.format === 'markdown' ? 'markdown' : sel.format === 'xml' ? 'xml' : 'simple',
    )];
  }));

  // No turn has happened, so nothing has been activated by keyword — the preview shows every enabled entry,
  // which is the most this world's lore could inject, split into the same two blocks the game fills.
  const lore = flattenEnabledBookEntries(dictionaries).filter((entry) => entry.enabled !== false);
  const loreBlock = (entries: typeof lore) => buildDictionaryContext(entries, false) || NONE_PLACEHOLDER;

  const defaultTraitIds = traits.filter((t) => t.isDefault).map((t) => t.id);
  const traitsFor = (format: 'simple' | 'markdown' | 'xml') =>
    buildTraitContext(defaultTraitIds, traits, traitGroups, format);

  const values: Record<string, string> = {
    '<WORLD DESCRIPTION>': worldOverview.systemPrompt || '',
    ...statsValues,
    '<TRAITS DESCRIPTION>': traitsFor('simple'),
    '<TRAITS DESCRIPTION|markdown>': traitsFor('markdown'),
    '<TRAITS DESCRIPTION|xml>': traitsFor('xml'),
    '<DICTIONARY>': loreBlock(lore.filter((entry) => entry.position !== 'before')),
    '<DICTIONARY|before>': loreBlock(lore.filter((entry) => entry.position === 'before')),
    ...expandScopedTokens('<LOCATION>', locationScopes),
    ...expandScopedTokens('<ENTITIES>', entityScopes),
  };

  for (const key in values) values[key] = resolve(values[key]);
  return values;
}
