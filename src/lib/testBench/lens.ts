/**
 * The Bench's lens — `Testing as [Persona] · at [location]` — as data every instrument can read.
 *
 * The persona is a world persona or None, offered and preselected by the rules Enter World uses. Its default
 * traits apply through the game's own `traitEffects`, so the Bench can never resolve a chip differently from
 * a real turn.
 *
 * Pure and world-shaped: nothing here reads storage or React, and nothing writes the world.
 */
import { customPersonaEntity } from '@/lib/blueprints';
import { offeredPersonas, personaStartLocation, preselectPersona, startingPersona, worldPersonaRules } from '@/lib/personaPick';
import { describePlaceholders } from '@/lib/placeholders';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { labelPlaceholders, worldPlacementLetters } from '@/lib/placementLetters';
import { allPinRows, bindBlueprintPins, collectPinLayers, samePin, sameSource, type PinLayer } from '@/lib/placeholderPins';
import { ownerPinPlan, pinBlueprintsOf, type OwnerPinPlan, type PinBlueprints } from '@/lib/ownedTraitsInPlay';
import { globalStatsOf } from '@/lib/statLinks';
import { copyLookup, readerFor, type CopyLookup } from '@/lib/blueprints';
import { activeStatEnabled, defaultPicks, exclusiveSiblings, inAuthoredOrder, traitOrderIndex } from '@/lib/traitEffects';
import { startingStatsWith, statTraitsInForce, type TraitWorld } from '@/lib/traitRuntime';
import { seedWorldEntityStats } from '@/lib/entityStats';
import { ownedTraitStatesFrom } from '@/lib/ownedTraitState';
import { resolveOwners, type Owner } from '@/lib/owners';
import type { Entity, EntityStatValues, GameLocation, OwnedTraitPicks, PersonaRef, Placeholder, PlayerStat, Stat, Trait } from '@/types';
import { ownerWorldOf, type RuleWorld } from './rules';
import { optionPinLists } from '@/lib/worldOptions';

/** The slices of the authored world the lens reads. The rest of the document is optional and read only to
 *  letter the pickers' chips the way the editor letters them — entities come first in that walk. */
export type LensWorld =
  Pick<RuleWorld, 'traits' | 'traitGroups' | 'locations' | 'placeholders' | 'stats'>
  & Partial<Pick<RuleWorld, 'entities' | 'entityGroups' | 'dictionaries' | 'worldOverview' | 'statGroups' | 'placeholderGroups' | 'options'>>;

/** The traits the lens player picks from, with the links that brought them. */
type LensTree = Pick<Owner, 'traits' | 'groups' | 'linkOf'>;

/** The lens's player: every trait it can pick from, and the gate world those traits act in. */
interface LensPlayer extends LensTree {
  /** The played entity, whose traits are the persona's and never global. Null with no such entity. */
  personaId: string | null;
  personaTraitIds: ReadonlySet<string>;
  /** Play's trait world under this persona: global scope's tree and the present owners. */
  traitWorld: TraitWorld;
}

/** A lens persona as play's reference: a world persona, or None. */
export const lensPersonaRef = (personaId: string | null): PersonaRef =>
  (personaId ? { source: 'world', entityId: personaId } : { source: 'none' });

/** The lens player: the root outside Blueprints, then the played entity's tree, as one pick list. Under None
 *  the Custom Persona entity plays. Cached per world object and persona. */
const playersByWorld = new WeakMap<LensWorld, Map<string | null, LensPlayer>>();
function lensPlayer(world: LensWorld, personaId: string | null): LensPlayer {
  let players = playersByWorld.get(world);
  if (!players) {
    players = new Map();
    playersByWorld.set(world, players);
  }
  let player = players.get(personaId);
  if (!player) {
    const ownerWorld = ownerWorldOf(world);
    const { global, owners, gate } = resolveOwners(ownerWorld, lensPersonaRef(personaId));
    const played = owners.find((b) => b.isPlayer);
    const globalIds = new Set(global.traits.map((t) => t.id));
    player = {
      ...(played ? {
        traits: [...global.traits, ...played.traits],
        groups: [...global.groups, ...played.groups],
        linkOf: played.linkOf,
      } : { ...global, linkOf: new Map() }),
      personaId: played?.id ?? null,
      personaTraitIds: new Set((played?.traits ?? []).map((t) => t.id).filter((id) => !globalIds.has(id))),
      traitWorld: {
        traits: [...ownerWorld.traits], groups: [...ownerWorld.traitGroups], entities: gate.entities,
        persona: gate.persona, global: gate.global, owners: gate.owners,
      },
    };
    players.set(personaId, player);
  }
  return player;
}

/** The played entity's picks among `active`; global scope's tree leaves them out of the global picks. */
const personaPicks = (player: LensPlayer, active: readonly Trait[]): OwnedTraitPicks =>
  (player.personaId ? { [player.personaId]: active.filter((t) => player.personaTraitIds.has(t.id)).map((t) => t.id) } : {});

/** Each entity's own stats as a new game seeds them, so a row on an id an entity owns stays off the global stat (Q30). */
const lensEntityStats = (world: LensWorld): EntityStatValues =>
  seedWorldEntityStats({ stats: [...(world.stats ?? [])], statGroups: world.statGroups ?? [], entities: [...(world.entities ?? [])] });

/** The traits that apply on the global stats: the global picks, and the global rows of the persona's picks (Q30). */
export function lensStatTraits(world: LensWorld, active: readonly Trait[], personaId: string | null = null): Trait[] {
  const player = lensPlayer(world, personaId);
  const ownedTraits = ownedTraitStatesFrom(personaPicks(player, active));
  return statTraitsInForce({ traits: active, disabledTraitIds: [], ownedTraits, entityStats: lensEntityStats(world) }, player.traitWorld);
}

/** The global stats a fresh game under the lens starts with: the global picks, then the persona's global rows (Q33). */
export function lensStartingStats(world: LensWorld, authored: readonly Stat[], active: readonly Trait[], personaId: string | null = null): PlayerStat[] {
  const player = lensPlayer(world, personaId);
  return startingStatsWith(authored, active, player.traitWorld, personaPicks(player, active), lensEntityStats(world));
}

/** The played entity and the ids of its picks among `active`; null with no such entity. */
export function lensPersonaPicks(world: LensWorld, active: readonly Trait[], personaId: string | null = null): { personaId: string; ids: string[] } | null {
  const player = lensPlayer(world, personaId);
  return player.personaId ? { personaId: player.personaId, ids: personaPicks(player, active)[player.personaId] } : null;
}

/** What the author picked. Both ids are nullable: None is a real setting, and a world with no locations has
 *  nowhere to stand. */
export interface LensState {
  /** A world persona's id, or null for None. */
  personaId: string | null;
  locationId: string | null;
  /** The author picked the location by hand, so a persona pick no longer moves it. */
  locationChosen?: boolean;
  /** One trait applied over the defaults. Only the Authoring Tour's In Game sets it. */
  pickedTraitId?: string | null;
}

export const EMPTY_LENS: LensState = { personaId: null, locationId: null };

/** One choice in a selector, labeled as the editor's own lists label it. */
export interface LensOption {
  id: string;
  name: string;
}

/** A pin the world cannot honor: it names a placeholder that is gone, so nothing it says ever reaches the
 *  text. Surfaced rather than dropped silently — a pin that reads as working and isn't is the whole trap.
 *  A pin to a value the placeholder's list doesn't carry is not broken; forcing an off-list value is what
 *  the field is for, and play applies it verbatim. */
export interface BrokenPin {
  placeholderId: string;
  /** What play applies, verbatim. */
  value: string;
  /** The value as a sentence shows it — its own chips described, since a pin's text is chip-capable. */
  shown: string;
  /** The source as every pin surface names it: `Trait: Sworn`, `Location: Fen`, `Hunger ≤ 20`. */
  source: string;
}

/** One pin an active source lays under this lens, labeled as the pin editors label its source. */
export type LensPinLayer = PinLayer & { label: string };

/** The lens resolved against a world: who and where, and everything that follows from the persona. */
export interface BenchLens {
  state: LensState;
  /** The world persona played. Null under None. */
  persona: Entity | null;
  pickedTrait: Trait | null;
  location: GameLocation | null;
  /** Placeholder id → the value that applies, from every source a fresh game under this lens would have: the
   *  active traits, the location, the band each starting stat is in, and the value pins those settle. Broken
   *  pins are in here too when play would apply them, so what the Bench shows is what a turn would show. */
  pins: Record<string, string>;
  /** Every pin behind `pins`, in the order play lays them, the one that applies per placeholder marked. */
  pinLayers: LensPinLayer[];
  brokenPins: BrokenPin[];
  /** Stat id → whether it is live under this lens — the world's defaults with the active traits' toggles over them. */
  statEnabled: Record<string, boolean>;
  /** What the player's trait text reads a blueprint chip as: the persona's copy, else the blueprint. */
  copies: CopyLookup;
}

const worldPersonas = (world: LensWorld): Entity[] => (world.entities ?? []).filter((e) => e.persona && !e.customPersona);

/** Which personas the world lets a player pick, as Enter World offers them. The Bench has no library. */
const lensOffer = (world: LensWorld) => offeredPersonas(worldPersonaRules(world.worldOverview).allowed, {
  world: worldPersonas(world), library: [], custom: customPersonaEntity(world.entities ?? []),
});

/** The world personas an author can test as. Names read as the editor's own list reads them: a chip by its
 *  placement label, never by a roll or a pin. */
export function lensPersonaOptions(world: LensWorld): LensOption[] {
  const placeholders = allPlaceholders(world);
  const letters = worldPlacementLetters(world);
  return lensOffer(world).world.map((e) => ({
    id: e.id,
    name: labelPlaceholders(e.name, placeholders, { letters }) || 'Unnamed',
  }));
}

/** What the None row reads as: the Custom Persona entity standing in its place, else None. Null when the world
 *  does not offer it. */
export function lensNoneLabel(world: LensWorld): string | null {
  const offer = lensOffer(world);
  if (!offer.none) return null;
  if (!offer.custom) return 'None';
  return labelPlaceholders(offer.custom.name, allPlaceholders(world), { letters: worldPlacementLetters(world) }) || 'Unnamed';
}

/** Everywhere the author can stand, in authored order, named as the editor's own list names it. */
export function lensLocationOptions(world: LensWorld): LensOption[] {
  const placeholders = allPlaceholders(world);
  const letters = worldPlacementLetters(world);
  return (world.locations ?? []).map((l) => ({
    id: l.id,
    name: labelPlaceholders(l.name, placeholders, { letters }) || 'Untitled location',
  }));
}

/** Where a fresh lens points: the location the author already has open in the editor, else the one a
 *  playthrough would start at, else the first that exists. */
function seedLocationId(world: LensWorld, selectedLocationId: string | null): string | null {
  const locations = world.locations ?? [];
  const selected = locations.find((l) => l.id === selectedLocationId);
  if (selected) return selected.id;
  return locations.find((l) => l.isStarting)?.id ?? locations[0]?.id ?? null;
}

/**
 * The lens to open with. A stored selection wins wherever the world still has what it names — the author's
 * setup surviving a tab switch is the point — and each half falls back to a fresh seed on its own, so
 * deleting the location doesn't also forget the persona. A fresh persona follows Enter World's preselect rule.
 */
export function seedLens(
  world: LensWorld,
  stored: LensState | null,
  selectedLocationId: string | null,
): LensState {
  const offer = lensOffer(world);
  const persona = preselectPersona({
    rules: worldPersonaRules(world.worldOverview),
    remembered: stored ? lensPersonaRef(stored.personaId) : undefined,
    globalDefault: undefined,
    available: { world: offer.world.map((e) => e.id), library: [], custom: !!offer.custom },
  });
  const locations = world.locations ?? [];
  const storedLocation = stored?.locationId;
  const kept = !!storedLocation && locations.some((l) => l.id === storedLocation);
  const personaId = persona.source === 'world' ? persona.entityId : null;
  // Below the editor's selected location, a fresh seed starts where Enter World would for this persona.
  const starting = startingPersona(lensPersonaRef(personaId), world.entities ?? []);
  const personaStart = starting ? personaStartLocation(starting, locations) : null;
  const fresh = locations.some((l) => l.id === selectedLocationId) || !personaStart
    ? seedLocationId(world, selectedLocationId) : personaStart;
  return {
    personaId,
    locationId: kept ? storedLocation : fresh,
    ...(kept && stored?.locationChosen ? { locationChosen: true } : {}),
  };
}

/** The lens after a persona pick: a persona with start places moves the location to its own start, as Enter World
 *  does, until the author picks one by hand. */
export function lensWithPersona(world: LensWorld, state: LensState, personaId: string | null): LensState {
  const persona = startingPersona(lensPersonaRef(personaId), world.entities ?? []);
  const own = persona && !state.locationChosen ? personaStartLocation(persona, world.locations ?? []) : null;
  return { ...state, personaId, ...(own ? { locationId: own } : {}) };
}

/** The layers the world cannot honor: each names a placeholder that is gone. */
function brokenPinsOf(layers: LensPinLayer[], placeholders: Placeholder[]): BrokenPin[] {
  const known = new Set(placeholders.map((p) => p.id));
  return layers
    .filter((layer) => !known.has(layer.placeholderId))
    .map((layer) => ({
      placeholderId: layer.placeholderId,
      value: layer.value,
      shown: describePlaceholders(layer.value, placeholders),
      source: layer.label,
    }));
}

/**
 * The lens as every instrument reads it. A persona the world no longer has resolves to None rather than to a
 * stale entity, so an id outliving its entity costs the selection and nothing else. Pins come from the game's
 * own collector over what a fresh game under this lens would apply: the active traits, the lens location,
 * and each stat's band at the value the traits leave it starting on. No roll is drawn at design time, so a
 * Wildcard's value pins wait for a source above them to fix its value.
 *
 * Any trait works as `pickedTraitId`. The Authoring Tour's In Game relies on that to pick a trait the way the
 * setup screen does.
 */
export function buildLens(world: LensWorld, state: LensState): BenchLens {
  const traits = world.traits ?? [];
  const groups = world.traitGroups ?? [];
  const placeholders = allPlaceholders(world);
  const persona = worldPersonas(world).find((e) => e.id === state.personaId) ?? null;
  const personaId = persona?.id ?? null;
  const player = lensPlayer(world, personaId);
  const pickedTrait = player.traits.find((t) => t.id === state.pickedTraitId) ?? traits.find((t) => t.id === state.pickedTraitId) ?? null;
  const location = (world.locations ?? []).find((l) => l.id === state.locationId) ?? null;
  const active = activeTraitsFor(world, pickedTrait, personaId);
  const { pins, layers } = collectPinLayers(lensPinPlan(world, active, personaId, location).sources);
  // The editors' labels for the same rows, matched by the stored pin: a layer carries the pin object its
  // source holds, and so does every row.
  const rows = allPinRows({
    traits, traitGroups: groups, entities: world.entities ?? [],
    locations: world.locations ?? [], stats: world.stats ?? [],
    placeholders, placeholderOwners: placeholderOwners(world), placementLetters: worldPlacementLetters(world), options: world.options ?? [],
  });
  const pinLayers = layers.map((layer): LensPinLayer => ({
    ...layer,
    // A bound blueprint pin matches no stored row, but its source's label is the same for every pin.
    label: (rows.find((r) => sameSource(r.source, layer.source) && (r.pin === layer.pin || samePin(r.pin, layer.pin)))
      ?? rows.find((r) => sameSource(r.source, layer.source)))?.label ?? '',
  }));
  return {
    state,
    persona,
    pickedTrait,
    location,
    pins,
    pinLayers,
    brokenPins: brokenPinsOf(pinLayers, placeholders),
    statEnabled: activeStatEnabled(world.stats ?? [], lensStatTraits(world, active, personaId)),
    copies: copyLookup(lensBlueprints(world), lensReader(world, personaId)),
  };
}

/**
 * The traits a fresh game under this lens starts with: the world's defaults and the persona's, with a picked
 * trait replacing whichever default its own exclusive group contributed, in authored order — the same
 * substitution and ordering that picking it at game start applies.
 */
export function lensActiveTraits(world: LensWorld, lens: BenchLens): Trait[] {
  return activeTraitsFor(world, lens.pickedTrait, lens.persona?.id ?? null);
}

/**
 * The pin collection a fresh game under the lens runs, through play's own planner: the player's `active`
 * traits, every other present owner's default picks, each entity's own stats at their start, the global stats
 * as the traits leave them, and the lens location.
 */
export function lensPinPlan(
  world: LensWorld, active: readonly Trait[], personaId: string | null, location: GameLocation | null,
): OwnerPinPlan {
  const ownerWorld = ownerWorldOf(world);
  const persona = lensPersonaRef(personaId);
  const player = lensPlayer(world, personaId);
  const castDefaults = Object.fromEntries(resolveOwners(ownerWorld, persona).owners
    .filter((b) => b.present && !b.isPlayer)
    .map((b) => [b.id, defaultPicks(b.traits, b.groups)]));
  return ownerPinPlan({
    world: ownerWorld,
    persona,
    globalTraits: active,
    owned: { ...castDefaults, ...personaPicks(player, active) },
    sharedPlaceholders: world.placeholders ?? [],
    entityStats: lensEntityStats(world),
    blueprints: lensPinBlueprints(world),
  }, {
    // Outside play an Option reads its default (Q25).
    options: optionPinLists(world.options),
    location,
    stats: globalStatsOf(lensStartingStats(world, world.stats ?? [], active, personaId), world.statGroups ?? []),
    placeholders: allPlaceholders(world),
  });
}

/** The world's Blueprint stat and placeholder ids, as the lens's pin plan reads them. */
export const lensPinBlueprints = (world: LensWorld): PinBlueprints => pinBlueprintsOf({
  stats: world.stats ?? [], statGroups: world.statGroups ?? [], placeholders: world.placeholders ?? [], placeholderGroups: world.placeholderGroups ?? [],
});

/** How the lens player reads blueprints: a world persona through its own copies, None through the Custom
 *  Persona entity's. */
const lensReader = (world: LensWorld, personaId: string | null) => readerFor(
  lensPersonaRef(personaId), (world.entities ?? []).find((e) => e.id === personaId) ?? null, true,
);
const lensBlueprints = (world: LensWorld) => ({ placeholders: world.placeholders ?? [], entities: world.entities ?? [] });

function activeTraitsFor(world: LensWorld, picked: Trait | null, personaId: string | null): Trait[] {
  const { traits, groups } = lensPlayer(world, personaId);
  const order = traitOrderIndex(traits, groups);
  const capped = new Set(defaultPicks(traits, groups));
  const defaults = traits.filter((t) => capped.has(t.id));
  if (!picked) return inAuthoredOrder(defaults, order);
  const retired = new Set(exclusiveSiblings(picked, traits, groups));
  const kept = defaults.filter((t) => t.id !== picked.id && !retired.has(t.id));
  return inAuthoredOrder([...kept, picked], order);
}

/** A stat the lens switches away from the world's default, named as the stat list names it. */
export interface StatOverride {
  stat: string;
  enabled: boolean;
}

/** The stats this lens switches away from the world's default — what an instrument names when it explains why
 *  a stat it is showing (or not showing) isn't the one the stat list would suggest. */
export function lensStatOverrides(world: LensWorld, lens: BenchLens): StatOverride[] {
  if (!lens.persona && !lens.pickedTrait) return [];
  return (world.stats ?? [])
    .filter((s) => lens.statEnabled[s.id] !== (s.enabled !== false))
    .map((s) => ({ stat: s.name || s.id, enabled: lens.statEnabled[s.id] }));
}

const quote = (text: string) => `“${text}”`;

/** A broken pin as the sentence under the selector reads. Names the value it claims to force, since
 *  "broken" alone sends the author looking for which end of the pin moved. */
export function describeBrokenPin(pin: BrokenPin): string {
  return `${quote(pin.source)} pins a placeholder that doesn’t exist, so ${quote(pin.shown)} is never applied.`;
}

/**
 * Chip-bearing text as the lens reads it: the lens's pins masking their placeholders, everything else
 * described as the editor describes it. An unpinned Wildcard stays its `{a|b}` summary — its value is
 * decided by a roll at play time, and a design-time surface inventing one would be showing a fiction.
 */
export const resolveLensText = (
  text: string,
  placeholders: Placeholder[] | undefined,
  pins: Record<string, string>,
  /** The owner's copy lookup, for its trait text. */
  copies?: CopyLookup,
): string => describePlaceholders(text, placeholders ?? [], pins, copies);

/** One owner's scope under the lens: the pins its own text reads, and its blueprint copies. */
export interface LensOwnerScope {
  pins: Record<string, string>;
  copies: CopyLookup;
  /** The trait with its blueprint pins traced to this owner's copies. */
  bind: (trait: Trait) => Trait;
}

/** Each entity's scope as a fresh game under the lens reads it: the lens's own pins, which every text
 *  reads, and the entity's own copies. */
export function lensOwnerScopes(world: LensWorld, lens: BenchLens): (ownerId: string) => LensOwnerScope {
  const blueprints = lensBlueprints(world);
  const personaId = lens.persona?.id ?? null;
  const ref = lensPersonaRef(personaId);
  const { owners } = resolveOwners(ownerWorldOf(world), ref);
  const playerReader = lensReader(world, personaId);
  const playedScope: LensOwnerScope = {
    pins: lens.pins, copies: lens.copies, bind: (trait) => bindBlueprintPins(trait, blueprints, playerReader),
  };
  const cache = new Map<string, LensOwnerScope>();
  return (ownerId) => {
    const owner = owners.find((b) => b.id === ownerId);
    if (!owner || owner.isPlayer) return playedScope;
    let scope = cache.get(ownerId);
    if (!scope) {
      const reader = readerFor(ref, owner.entity, false);
      scope = { pins: lens.pins, copies: copyLookup(blueprints, reader), bind: (trait) => bindBlueprintPins(trait, blueprints, reader) };
      cache.set(ownerId, scope);
    }
    return scope;
  };
}

/** An entity's own text as the lens reads it, with the entity's described name as the Entity Name. */
export function resolveLensEntityText(
  entity: { name: string },
  text: string,
  placeholders: Placeholder[] | undefined,
  scope: Pick<LensOwnerScope, 'pins' | 'copies'>,
): string {
  const all = placeholders ?? [];
  // The name has no owner, so a Entity Name inside it reads as nothing, as play reads it.
  const character = describePlaceholders(entity.name, all, scope.pins, scope.copies, '');
  return describePlaceholders(text, all, scope.pins, scope.copies, character);
}
