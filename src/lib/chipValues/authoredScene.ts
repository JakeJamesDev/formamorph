import { flattenEnabledBookEntries } from '../dictionaryUtils';
import { entityIdsAt } from '../entityPresence';
import { allPlaceholders } from '../placeholderHomes';
import { resolveEntityText, resolvePlaceholders } from '../placeholders';
import { resolveEntityTexts, type ResolveEntityText } from '../resolveWorldNames';
import { resolveStartingLocation } from '../startingLocation';
import type {
  Connection, Dictionary, Entity, EntityGroup, GameLocation, Placeholder, PlayerStat, Stat, Trait, TraitGroup,
  WorldOverview,
} from '@/types';
import type { ChipScene } from './chipScene';

/** The authored world, as the editor holds it — no playthrough, no runtime state. */
export interface AuthoredWorld {
  worldOverview: WorldOverview;
  stats: Stat[];
  locations: GameLocation[];
  connections?: Connection[];
  entities: Entity[];
  entityGroups?: EntityGroup[];
  traits: Trait[];
  traitGroups?: TraitGroup[];
  dictionaries?: Dictionary[];
  placeholders?: Placeholder[];
}

/** Overrides for a scene scoped tighter than "the world's own opening" — the Test Bench's Opening
 *  instrument passes the lens PC's traits, its settled stats and its frozen rolls through these. */
export interface AuthoredSceneOptions {
  /** The traits in force, in place of the world's defaults. */
  activeTraitIds?: string[];
  /** The stats the Stats chips render, in place of the authored list at its starting values. */
  stats?: PlayerStat[];
  /** The location the scene opens at, in place of a fresh starting-location roll. `null` is a real
   *  choice (nowhere), so only an absent field falls back. */
  location?: GameLocation | null;
  /** Chip resolution, in place of a fresh unrecorded roll. */
  resolve?: (text: string) => string;
  /** An entity's own text under the same resolution, with that entity as the Character Name. Absent while
   *  `resolve` is given, entity text resolves with the rest of its block. */
  resolveEntity?: ResolveEntityText;
}

/**
 * The world being edited as a Chip Scene: its own opening. The scene is at the starting location with the
 * cast the author placed there, every stat at its authored starting value, the traits the author marked
 * default, and every enabled lore entry (nothing has been typed yet, so no keyword has fired to narrow
 * them). There is no persona, no notes and no clock: a world has none until a player enters it.
 */
export function authoredChipScene(world: AuthoredWorld, options: AuthoredSceneOptions = {}): ChipScene {
  // Destructuring defaults are runtime-only backstops: the type demands the slices, but a hand-edited
  // world JSON can still arrive without one, and a preview should read empty rather than fail.
  const {
    worldOverview, stats = [], locations = [], connections = [], entities = [], traits = [],
    traitGroups = [], dictionaries = [],
  } = world;
  const placeholders = allPlaceholders(world);
  // A world with no locations yet previews as "nowhere" rather than failing.
  const location = options.location !== undefined ? options.location : resolveStartingLocation(locations, null) ?? null;
  // Chips resolve against a fresh roll, since a world has no playthrough whose rolls could be reused.
  const resolve = options.resolve
    ?? ((text: string) => resolvePlaceholders(text, { placeholders, rolls: {} }));
  const resolveEntity = options.resolveEntity ?? (options.resolve
    ? undefined
    : (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders, rolls: {} }));
  const cast = resolveEntity ? resolveEntityTexts(entities, resolveEntity) : entities;
  const presentIds = entityIdsAt(location?.id, entities);
  const activeIds = new Set(options.activeTraitIds ?? traits.filter((trait) => trait.isDefault).map((trait) => trait.id));

  return {
    overview: worldOverview?.systemPrompt || '',
    // Stats read their authored starting value — the same shape a playthrough's stats carry.
    stats: options.stats
      ?? stats.map((stat) => ({ ...stat, value: typeof stat.value === 'number' ? stat.value : stat.min })),
    traits: traits.filter((trait) => activeIds.has(trait.id)),
    traitGroups,
    persona: null,
    location,
    locations,
    connections,
    entities: cast,
    presentIds,
    // No turns have happened, so nobody is in scene beyond who the author placed here.
    inSceneIds: presentIds,
    lore: flattenEnabledBookEntries(dictionaries).filter((entry) => entry.enabled !== false),
    notes: '',
    time: null,
    resolve,
  };
}
