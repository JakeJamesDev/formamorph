// Owned traits during play: which are active, and the pins each bearer's traits lay.

import type { DiscoveredEntity, Entity, OwnedTraitStates, PersonaRef, Placeholder, Trait } from '@/types';
import { PLAYER_BEARER, resolveBearers, type Bearer, type BearerWorld } from './bearers';
import { bindBearerPins, collectPins, type PinSources } from './placeholderPins';
import { bindOwnedTraits, type TraitWorld } from './portableTraits';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';
import type { GateOwner } from './traitGates';
import { ownedTraitTree } from './traitTree';

/** The entity whose owned traits are the player's own: the played persona's, or null. */
export const playedEntityId = (ref: PersonaRef | undefined): string | null =>
  (ref && ref.source !== 'none' ? ref.entityId : null);

/** Entity id → its active owned trait ids: the chosen ones less those switched off. */
export function activeOwnedTraitIds(states: Readonly<OwnedTraitStates>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(states).map(([id, s]) => {
    const off = new Set(s.disabled ?? []);
    return [id, s.chosen.filter((t) => !off.has(t))];
  }));
}


/** The characters added from the library at Enter World, among the discovered cast. */
export const addedCharacters = (discovered: readonly DiscoveredEntity[]): Entity[] =>
  discovered.filter((d) => d.sourceTurnId === INITIAL_SOURCE_TURN_ID).map((d) => d.entity);

/** The library entities a playthrough holds, whose nodes sit last in the one tree: the library persona, then
 *  the added characters, with their owned trait requirements bound to the world. */
export const inPlayLibrary = (
  world: TraitWorld, libraryPersona: Entity | null | undefined, added: readonly Entity[] = [],
): Entity[] => [...(libraryPersona ? [libraryPersona] : []), ...added].map((e) => bindOwnedTraits(e, world));

/** Every present bearer as the gate module reads it in play: the player, the world's entities, then the
 *  library's. */
export const inPlayBearers = (world: BearerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = []): readonly GateOwner[] =>
  resolveBearers(world, persona, library).gate.owners;

/** What every bearer's pins are read from in play. */
export interface BearerPinState {
  world: BearerWorld;
  persona: PersonaRef | undefined;
  /** The library entities the playthrough holds, the library persona among them. */
  library?: readonly Entity[];
  /** The player's chosen world traits as the save holds them: the root's and Custom Persona's originals. */
  playerTraits: readonly Trait[];
  /** The player's traits switched off. */
  disabledTraitIds?: readonly string[];
  /** Entity id → its active trait ids: owned ones, and originals it links. */
  owned: Readonly<Record<string, readonly string[]>>;
  /** The world's shared placeholders, which a bearer-relative pin falls back to by name. */
  sharedPlaceholders: readonly Placeholder[];
}

/** The pins in force per bearer. */
export interface PinSet {
  /** World-level text, and the played persona's own: the world pins plus the player's traits. */
  world: Record<string, string>;
  /** One bearer's own text. A cast entity's lays its traits over `world`; the played persona, null and the
   *  player bearer read `world`. */
  of: (bearerId: string | null | undefined) => Record<string, string>;
  /** The trait with its bearer-relative pins bound for that bearer, for its own card. */
  bind: (trait: Trait, bearerId: string | null | undefined) => Trait;
}

/**
 * The pins in force per bearer, with `sources` supplying the world pins. The player's traits lay first: the
 * world traits and the played entity's, together in one-tree order, then the played entity's links. A cast
 * entity's active traits lay after them in its own tree order, so it wins in its own text. Only the player's
 * traits switch stat bands.
 */
export function bearerPins(state: BearerPinState, sources: Omit<PinSources, 'traits' | 'disabledTraitIds' | 'statTraits'>): PinSet {
  const { world, persona, library = [], owned, sharedPlaceholders } = state;
  const { bearers } = resolveBearers(world, persona, library);
  const played = playedEntityId(persona);
  const playerBearer = bearers.find((b) => b.id === PLAYER_BEARER);
  const playedBearer = played ? bearers.find((b) => b.id === played) : undefined;
  const personaEntity = played ? [...world.entities, ...library].find((e) => e.id === played) : undefined;
  const isPlayer = (id: string | null | undefined) => !id || id === PLAYER_BEARER || id === played;

  const ownOf = (id: string | null | undefined) =>
    (isPlayer(id) ? personaEntity : bearers.find((b) => b.id === id)?.entity)?.placeholders ?? [];
  const linkOf = (trait: Trait, id: string | null | undefined) => (isPlayer(id)
    ? playerBearer?.linkOf.get(trait.id) ?? playedBearer?.linkOf.get(trait.id)
    : bearers.find((b) => b.id === id)?.linkOf.get(trait.id));
  const bind = (trait: Trait, id: string | null | undefined) =>
    bindBearerPins(trait, linkOf(trait, id), ownOf(id), sharedPlaceholders);
  const activeIn = (bearer: Bearer | undefined) => {
    const on = new Set(bearer ? owned[bearer.id] ?? [] : []);
    return bearer ? bearer.traits.filter((t) => on.has(t.id)) : [];
  };

  const off = new Set(state.disabledTraitIds ?? []);
  const tree = ownedTraitTree(world, world.entities, library);
  const playedOwned = activeIn(playedBearer);
  const playerTraits = [
    ...inAuthoredOrder([...state.playerTraits, ...playedOwned.filter((t) => !playedBearer?.linkOf.has(t.id))],
      traitOrderIndex(tree.traits, tree.groups)),
    ...(playedBearer ? inBearerOrder(playedOwned.filter((t) => playedBearer.linkOf.has(t.id)), playedBearer) : []),
  ].filter((t) => !off.has(t.id));
  const playerLaid = playerTraits.map((t) => bind(t, null));
  const collect = (traits: readonly Trait[]) => collectPins({ ...sources, traits, statTraits: playerTraits });

  const worldPins = collect(playerLaid);
  const cache = new Map<string, Record<string, string>>();
  const of = (id: string | null | undefined) => {
    if (isPlayer(id)) return worldPins;
    let pins = cache.get(id!);
    if (!pins) {
      const bearer = bearers.find((b) => b.id === id);
      const own = bearer ? inBearerOrder(activeIn(bearer), bearer).map((t) => bind(t, id)).filter((t) => t.placeholderPins?.length) : [];
      cache.set(id!, (pins = own.length ? collect([...playerLaid, ...own]) : worldPins));
    }
    return pins;
  };
  return { world: worldPins, of, bind };
}

const inBearerOrder = (traits: readonly Trait[], bearer: Bearer): Trait[] =>
  inAuthoredOrder(traits, traitOrderIndex(bearer.traits, bearer.groups));
