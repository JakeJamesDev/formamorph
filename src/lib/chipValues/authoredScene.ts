import { flattenEnabledBookEntries } from '../dictionaryUtils';
import { ownerStatParts, statPlacementOf } from '../statContext';
import { entityIdsAt } from '../entityPresence';
import { allPlaceholders } from '../placeholderHomes';
import { playsAs, resolveOwners, type Owner } from '../owners';
import { characterAsPlayer } from '../builtinPlaceholders';
import { resolvePersona } from '../persona';
import { copyLookup, readerFor, type CopyLookup, type CopyReader } from '../blueprints';
import { borneByPlayer, withOwnerTrees } from '../ownedTraitsInPlay';
import { resolveOwnerText, resolveEntityText, resolvePlaceholders } from '../placeholders';
import { bindBlueprintPins, traitScopedPins } from '../placeholderPins';
import { defaultPicks } from '../traitEffects';
import {
  resolveEntityTexts, resolveOwnedTraitTexts, type ResolveEntityText, type ResolveOwnedTraitText,
} from '../resolveWorldNames';
import { resolveStartingLocation } from '../startingLocation';
import { seedNewGameStats, treeStatTraits } from '../traitRuntime';
import { enabledOwnerStats, withTraitToggles } from '../statOwners';
import { playStatWorld } from '../statLinks';
import type {
  Connection, Dictionary, Entity, EntityGroup, GameLocation, Placeholder, PlayerStat, Stat, StatGroup, Trait,
  TraitGroup, WorldOverview,
} from '@/types';
import type { ChipScene } from './chipScene';

/** The authored world, as the editor holds it — no playthrough, no runtime state. */
export interface AuthoredWorld {
  worldOverview: WorldOverview;
  stats: Stat[];
  statGroups?: StatGroup[];
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
  /** Chip resolution, in place of a fresh unrecorded roll. `copies` is the player's, for the player's trait text. */
  resolve?: (text: string, copies?: CopyLookup) => string;
  /** An entity's own text under `resolve`'s rolls and pins. Absent with `resolve` given, `resolve` alone reads it. */
  resolveEntity?: ResolveEntityText;
  /** An entity's own trait text under that trait's pins over the entity's. Absent, a given `resolveEntity`
   *  reads it, else the trait's own pins do. */
  resolveOwned?: ResolveOwnedTraitText;
}


/**
 * The world being edited as a Chip Scene: its own opening. The scene is at the starting location with the
 * cast the author placed there, every stat seeded as a new game opens it, the traits the author marked
 * default, and every enabled lore entry (nothing has been typed yet, so no keyword has fired to narrow
 * them). No persona is picked, so the Custom Persona entity is the persona, as under None. There are no
 * notes and no clock: a world has none until a player enters it.
 */
export function authoredChipScene(world: AuthoredWorld, options: AuthoredSceneOptions = {}): ChipScene {
  // Destructuring defaults are runtime-only backstops: the type demands the slices, but a hand-edited
  // world JSON can still arrive without one, and a preview should read empty rather than fail.
  const {
    worldOverview, locations = [], connections = [], traits = [], traitGroups = [], dictionaries = [],
  } = world;
  // Blueprint stats are not the player's, and each entity's links read through their Blueprints.
  const { stats, entities } = playStatWorld({ stats: world.stats ?? [], statGroups: world.statGroups ?? [], entities: world.entities ?? [] });
  const placeholders = allPlaceholders(world);
  // A world with no locations yet previews as "nowhere" rather than failing.
  const location = options.location !== undefined ? options.location : resolveStartingLocation(locations, null) ?? null;
  // Chips resolve against a fresh roll, since a world has no playthrough whose rolls could be reused.
  const resolve = options.resolve
    ?? ((text: string) => resolvePlaceholders(text, { placeholders, rolls: {} }));
  const resolveEntity = options.resolveEntity ?? (options.resolve
    ? undefined
    : (entity: Entity, text: string) => resolveEntityText(entity, text, { placeholders, rolls: {} }));
  // Every tree with no persona picked: global scope's, and each entity's with its links expanded.
  const { global, owners: trees } = resolveOwners({ traits, traitGroups, entities }, undefined);
  const treeOf = new Map(trees.map((b) => [b.id, b]));
  const blueprints = { placeholders: world.placeholders ?? [], entities };
  const readerOf = (tree: Owner) => readerFor(undefined, tree.entity, tree.isPlayer);
  // Global traits read through the Custom Persona entity's copies, as play reads them with no persona picked.
  const globalReader = readerFor(undefined, null, true);
  const ownPins = (trait: Trait, reader: CopyReader | undefined) => traitScopedPins(
    reader ? bindBlueprintPins(trait, blueprints, reader) : trait, {}, placeholders,
  );
  const copiesOf = (reader: CopyReader | undefined) => (reader ? copyLookup(blueprints, reader) : undefined);
  // An entity's trait reads its own pins and copies, bound for that entity, with the entity as the Character Name.
  const ownTraitText: ResolveOwnedTraitText = options.resolveEntity
    ? (_trait, text, owner) => options.resolveEntity!(owner, text)
    : (trait, text, owner) => {
      const tree = treeOf.get(owner.id);
      const reader = tree && readerOf(tree);
      return resolveEntityText(owner, text, { placeholders, rolls: {}, pins: ownPins(trait, reader), copies: copiesOf(reader) });
    };
  const resolveOwned = options.resolveOwned ?? ownTraitText;
  const withLinks = withOwnerTrees(entities, trees);
  const cast = resolveEntity
    ? resolveOwnedTraitTexts(resolveEntityTexts(withLinks, resolveEntity), resolveOwned, resolveEntity)
    : withLinks;
  const presentIds = entityIdsAt(location?.id, entities);
  const defaultsOf = (tree: Pick<Owner, 'traits' | 'groups'>) =>
    defaultPicks(tree.traits, tree.groups);
  const activeIds = new Set(options.activeTraitIds ?? defaultsOf(global));
  const globalCopies = copiesOf(globalReader);
  // A global trait's Character Name reads as the Persona Name, under a caller's resolve or own pins.
  const globalText = (trait: Trait, text: string) => (options.resolve
    ? options.resolve(characterAsPlayer(text), globalCopies)
    : resolveOwnerText(null, text, { placeholders, rolls: {}, pins: ownPins(trait, globalReader), copies: globalCopies }));

  const played = entities.filter((entity) => playsAs(entity, undefined));
  // Each entity's default traits switch its stats on and off.
  const ownedStats = enabledOwnerStats(withTraitToggles(
    Object.fromEntries(entities.filter((e) => e.stats?.length).map((e) => [e.id, seedNewGameStats(e.stats ?? [])])),
    treeStatTraits(trees, Object.fromEntries(trees.map((b) => [b.id, defaultsOf(b)]))),
  ));

  return {
    overview: worldOverview?.systemPrompt || '',
    // Stats open as a playthrough's do.
    stats: options.stats ?? seedNewGameStats(stats),
    statPlacement: statPlacementOf(world),
    // With no persona picked, the Custom Persona entity's stats are the player's, as its traits are.
    playedStats: ownerStatParts(played, ownedStats),
    playedEntities: cast.filter((entity) => played.some((e) => e.id === entity.id)),
    // The global traits, where global scope's tree places them: never Blueprints.
    traits: borneByPlayer(global.traits.filter((trait) => activeIds.has(trait.id))
      .map((trait) => (trait.aiDescription ? { ...trait, aiDescription: globalText(trait, trait.aiDescription) } : trait))),
    traitGroups: borneByPlayer(global.groups),
    // Each entity holds its default traits, owned and linked, as the entry step preselects them.
    ownedTraits: Object.fromEntries(trees.flatMap((tree) => {
      const defaults = defaultsOf(tree);
      return defaults.length ? [[tree.id, defaults]] : [];
    })),
    ownedStats,
    // Under None the Custom Persona entity is the persona, as play resolves it.
    persona: resolvePersona(undefined, cast, []).persona,
    // Under None the Custom Persona entity plays, so its name is the Persona Name.
    playerName: played[0]?.name ?? null,
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
    resolveEntity,
    placeholders: world.placeholders ?? [],
  };
}
