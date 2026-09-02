/**
 * The AI Context instrument's data: everything the harness serves the model from one location, as blocks
 * with their rendered text and what each costs.
 *
 * Every value comes out of the game's own context builders — the same functions a live turn calls — fed the
 * authored world instead of a playthrough. Nothing here re-derives a roster, a destination set or a
 * description choice; a second implementation could disagree with play, which would make the whole
 * instrument a liar.
 *
 * Each block names the prompt chip that serves it, and its content/format options are *decoded from that
 * token* rather than passed separately, so a block can never render in a shape no prompt asks for. The
 * tokens are the shipped default prompts' own — prompts are a global setting the editor cannot read, so the
 * defaults are the only honest stand-in.
 *
 * Pure and world-shaped: no React, no storage, no world mutation.
 */
import { buildDictionaryContext, flattenEnabledBookEntries } from '@/lib/dictionaryUtils';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { entityIdsAt } from '@/lib/entityPresence';
import {
  buildDestinationsContext, buildEntityContext, buildLocationContext, buildParentLocationContext,
  buildReachableEntitiesContext, buildReachableLocationsContext, buildSublocationEntitiesContext,
  buildSublocationsContext, contextDelivery, navigableDestinationEntries, reachableEntityIds,
  sublocationEntityIds, type ContextDelivery, type ContextOpts,
} from '@/lib/locationContext';
import { estimateTokens } from '@/lib/memoryUtils';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import { decodeVariant, tokenVariant, variableForToken } from '@/lib/promptVariables';
import { buildStatContext, type StatPieces } from '@/lib/statContext';
import { enabledStats } from '@/lib/traitEffects';
import { buildTraitContext } from '@/lib/traitTree';
import type { Entity, GameLocation, PlayerStat } from '@/types';
import { lensActiveTraits, resolveLensText, type BenchLens } from './lens';
import type { RuleWorld } from './rules';

/** The slices of the authored world this instrument reads. */
export type AiContextWorld = Pick<
  RuleWorld,
  'worldOverview' | 'stats' | 'locations' | 'connections' | 'entities' | 'traits' | 'traitGroups'
  | 'dictionaries' | 'placeholders'
>;

/** The blocks, in the order the prompts lay them out: the world, then who you are, then where you are. */
export type ContextBlockId =
  | 'world' | 'stats' | 'traits'
  | 'location' | 'sublocations' | 'parent' | 'reachable' | 'destinations'
  | 'entities' | 'subEntities' | 'reachableEntities'
  | 'dictionary';

/** One context block as the panel lists it: what it is, what it renders to, and what that costs. */
export interface ContextBlock {
  id: ContextBlockId;
  label: string;
  /** The prompt chip that serves this block, spelled as the default prompts spell it. */
  token: string;
  text: string;
  /** Chars-based estimate — worlds run against arbitrary endpoints, so an exact count is impossible. */
  tokens: number;
  /** True when the block renders the empty placeholder: this location has nothing of that kind to serve. */
  empty: boolean;
  /** Why this block's contents are what they are, where that isn't obvious from the location. */
  note?: string;
}

/** One place the player can move to from here, and how the trip is made. */
export interface DestinationRow {
  id: string;
  name: string;
  /** The Connection's authored travel hint — what the model is told the trip involves. */
  hint?: string;
  via: 'implicit' | 'connection';
}

/** Which roster an entity is listed in — the three scopes the prompts pull separately. */
export type RosterScope = 'here' | 'sublocations' | 'reachable';

/** One entity in one scope's roster, and which of its descriptions that scope's block carries. */
export interface RosterEntity {
  id: string;
  name: string;
  delivery: ContextDelivery;
}

/** One scope's roster, paired with the block that renders it. */
export interface RosterGroup {
  scope: RosterScope;
  label: string;
  block: ContextBlockId;
  /** True when this scope's block asks for summaries — what makes a `full` row here a fallback. */
  prefersSummary: boolean;
  entities: RosterEntity[];
}

/** Everything the AI Context instrument shows for one lens. */
export interface AiContextData {
  location: GameLocation | null;
  /** The location's name with the lens PC's chips resolved, as every other name here is. */
  locationName: string;
  blocks: ContextBlock[];
  destinations: DestinationRow[];
  rosters: RosterGroup[];
  /** The sum of every block's estimate — every block a prompt can pull from here. */
  totalTokens: number;
}

/** What the instrument reads while it has nothing to assemble — a Bench closed, or closed on another tab. */
export const EMPTY_AI_CONTEXT: AiContextData = {
  location: null, locationName: '', blocks: [], destinations: [], rosters: [], totalTokens: 0,
};

// The chips the shipped default prompts use for each block. Two are not in any default prompt: `parent` is
// only ever placed name-only in the now-line, and `destinations` belongs to the location router — both are
// listed in their family's shape so the panel reads as one set.
const BLOCK_TOKENS: Record<ContextBlockId, { label: string; token: string }> = {
  world: { label: 'World Description', token: '<WORLD DESCRIPTION>' },
  stats: { label: 'Stats', token: '<STATS DESCRIPTION|descriptions.markdown>' },
  traits: { label: 'Traits', token: '<TRAITS DESCRIPTION|markdown>' },
  location: { label: 'Location', token: '<LOCATION|markdown>' },
  sublocations: { label: 'Sub-Locations', token: '<LOCATION|sublocations.summary.markdown>' },
  parent: { label: 'Parent Location', token: '<LOCATION|parent.summary.markdown>' },
  reachable: { label: 'Reachable Locations', token: '<LOCATION|reachable.summary.markdown>' },
  destinations: { label: 'Destinations', token: '<LOCATION|destinations.summary.markdown>' },
  entities: { label: 'Entities Here', token: '<ENTITIES|markdown>' },
  subEntities: { label: 'Entities in Sub-Locations', token: '<ENTITIES|sublocations.markdown>' },
  reachableEntities: { label: 'Entities Reachable', token: '<ENTITIES|reachable.summary.markdown>' },
  dictionary: { label: 'Dictionary', token: '<DICTIONARY>' },
};

/** A token's per-axis selection, or an all-default selection for a token with no axes. */
function selectionOf(token: string): Record<string, string | null> {
  const variable = variableForToken(token);
  return variable ? decodeVariant(variable, tokenVariant(token)) : {};
}

/** The section style a chip's `format` axis names. */
type ContextFormat = 'simple' | 'markdown' | 'xml';

const formatOf = (selection: Record<string, string | null>): ContextFormat =>
  selection.format === 'markdown' ? 'markdown' : selection.format === 'xml' ? 'xml' : 'simple';

/** The builder options a scoped chip's token encodes — the axes the chip pop-out offers, read off the token
 *  so a block's shape and its stated token can never drift apart. */
function scopedOpts(token: string): ContextOpts & { preferSummary: boolean; format: ContextFormat } {
  const selection = selectionOf(token);
  return {
    preferSummary: selection.content === 'summary',
    nameOnly: selection.content === 'name',
    format: formatOf(selection),
  };
}

/** Whether a scoped chip's token asks for summaries — what decides each roster row's delivery. */
const prefersSummary = (id: ContextBlockId): boolean => scopedOpts(BLOCK_TOKENS[id].token).preferSummary;

/** The stat pieces and format the Stats chip's token encodes. */
function statArgs(token: string): { pieces: StatPieces; format: ContextFormat } {
  const selection = selectionOf(token);
  return {
    pieces: {
      values: selection.numbers != null,
      status: selection.descriptions != null,
      meaning: selection.meaning != null,
    },
    format: formatOf(selection),
  };
}

/** The scopes' rosters, each paired with the entity block that renders it. */
const ROSTERS: { scope: RosterScope; label: string; block: ContextBlockId }[] = [
  { scope: 'here', label: 'Here', block: 'entities' },
  { scope: 'sublocations', label: 'In Sub-Locations', block: 'subEntities' },
  { scope: 'reachable', label: 'In Reachable Locations', block: 'reachableEntities' },
];

/** The traits active under this lens, as the shared fresh-game substitution computes them. */
const activeTraitIds = (world: AiContextWorld, lens: BenchLens): string[] =>
  lensActiveTraits(world, lens).map((t) => t.id);

/** The world's stats at their authored starting values, minus the ones this PC switches off. */
function lensStats(world: AiContextWorld, lens: BenchLens): PlayerStat[] {
  const stats = (world.stats ?? []).map((stat) => ({
    ...stat,
    value: typeof stat.value === 'number' ? stat.value : stat.min,
  }));
  return enabledStats(stats, lens.statEnabled);
}

/**
 * Everything the AI Context instrument shows for `lens`. The location is the lens's, and every chip resolves
 * through the lens PC's pins, so a world whose text is placeholder-driven reads as that character sees it.
 *
 * The dictionary block is the ceiling rather than a turn's actual pull: no scene text exists here to fire
 * keywords, so it renders every enabled entry — the most lore a turn from this place could inject.
 */
export function buildAiContext(world: AiContextWorld, lens: BenchLens): AiContextData {
  const locations = world.locations ?? [];
  const connections = world.connections ?? [];
  const entities = world.entities ?? [];
  const placeholders = allPlaceholders(world);
  const location = lens.location;
  const resolve = (text: string) => resolveLensText(text, placeholders, lens.pins);

  // Each scope drops whoever a higher-precedence one already listed, exactly as the entity blocks do — a
  // roster that listed someone twice would disagree with the text beside it.
  const hereIds = entityIdsAt(location?.id, entities);
  const here = new Set(hereIds);
  const subIds = sublocationEntityIds(location, locations, entities).filter((id) => !here.has(id));
  const shownAlready = [...hereIds, ...subIds];
  const shown = new Set(shownAlready);
  const reachIds = reachableEntityIds(location, locations, entities).filter((id) => !shown.has(id));

  const opts = (id: ContextBlockId) => scopedOpts(BLOCK_TOKENS[id].token);
  const stats = statArgs(BLOCK_TOKENS.stats.token);
  // Every enabled entry, in book order — no turn text has narrowed them.
  const lore = flattenEnabledBookEntries(world.dictionaries).filter((entry) => entry.enabled !== false);

  const rendered: Record<ContextBlockId, string> = {
    world: world.worldOverview?.systemPrompt || NONE_PLACEHOLDER,
    stats: buildStatContext(lensStats(world, lens), stats.pieces, stats.format),
    traits: buildTraitContext(
      activeTraitIds(world, lens),
      world.traits ?? [],
      world.traitGroups ?? [],
      opts('traits').format,
    ),
    location: buildLocationContext(location, opts('location')),
    sublocations: buildSublocationsContext(location, locations, opts('sublocations')),
    parent: buildParentLocationContext(location, locations, opts('parent')),
    reachable: buildReachableLocationsContext(location, locations, opts('reachable')),
    destinations: buildDestinationsContext(location, locations, connections, opts('destinations')),
    entities: buildEntityContext(location, entities, opts('entities')),
    subEntities: buildSublocationEntitiesContext(location, locations, entities, {
      ...opts('subEntities'), excludeIds: hereIds,
    }),
    reachableEntities: buildReachableEntitiesContext(location, locations, entities, {
      ...opts('reachableEntities'), excludeIds: shownAlready,
    }),
    dictionary: buildDictionaryContext(lore, false) || NONE_PLACEHOLDER,
  };

  // Text stays exactly as the builders produced it, trailing newline included — what an author reads here is
  // byte-for-byte the block the model receives.
  const blocks = (Object.keys(BLOCK_TOKENS) as ContextBlockId[]).map((id): ContextBlock => {
    const text = resolve(rendered[id]);
    const empty = text.trim() === '' || text.trim() === NONE_PLACEHOLDER;
    return {
      id,
      label: BLOCK_TOKENS[id].label,
      token: BLOCK_TOKENS[id].token,
      text,
      tokens: empty ? 0 : estimateTokens(text.length),
      empty,
      note: id === 'dictionary' && !empty
        ? `Every enabled entry (${lore.length}) — no scene text has fired keywords here.`
        : undefined,
    };
  });

  const byId = new Map(entities.map((e) => [e.id, e]));
  const roster = (ids: string[], summary: boolean): RosterEntity[] => ids.flatMap((id) => {
    const entity: Entity | undefined = byId.get(id);
    return entity
      ? [{ id, name: resolve(entity.name), delivery: contextDelivery(entity, summary) }]
      : [];
  });
  const scopeIds: Record<RosterScope, string[]> = {
    here: hereIds, sublocations: subIds, reachable: reachIds,
  };

  return {
    location,
    locationName: location ? resolve(location.name) : '',
    blocks,
    destinations: navigableDestinationEntries(location, locations, connections).map((entry) => ({
      id: entry.location.id,
      name: resolve(entry.location.name),
      hint: entry.hint ? resolve(entry.hint) : undefined,
      via: entry.via,
    })),
    rosters: ROSTERS.map((scope) => ({
      ...scope,
      prefersSummary: prefersSummary(scope.block),
      entities: roster(scopeIds[scope.scope], prefersSummary(scope.block)),
    })),
    totalTokens: blocks.reduce((sum, block) => sum + block.tokens, 0),
  };
}
