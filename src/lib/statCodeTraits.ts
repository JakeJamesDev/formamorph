import type { CascadeOffTraitIds, Entity, GameState, OwnedTraitStates, Placeholder, Trait } from '@/types';
import { canBePlayer, inCast, playsAs, resolveBearers, type BearerWorld } from './bearers';
import type { SandboxEntity, SandboxTrait } from './statCodeExecutor';
import type { CodeEntityNames } from './statCodeAnalysis';
import { statCodeName } from './statCodeNames';
import { refreshChosenTraits } from './traitEffects';
import type { AppliedTraitValues, TraitWorld } from './traitRuntime';

/** The player's traits as the trait runtime holds them, and the authored world code switches them against. */
export interface StatCodeTraits {
  /** The player's list, chosen at creation or acquired in play. Switched-off ones stay listed. */
  acquired: readonly Trait[];
  disabledTraitIds: readonly string[];
  appliedValues: AppliedTraitValues;
  /** Owner id → the traits a cascade turned off. Absent ⇒ none. */
  cascadeOffTraitIds?: CascadeOffTraitIds;
  /** Each entity's owned traits, which a cascade can switch. Absent ⇒ none. */
  ownedTraits?: OwnedTraitStates;
  /** Every authored trait and group, and who the player is, for gates. `traits` maps each authored trait; a code switch-on acquires from here. */
  world: TraitWorld;
  /** The world's entities as authored, chips and all. Code names read these, never the resolved names the
   *  bearers carry. Absent ⇒ none. */
  entities?: readonly Entity[];
  /** The library entities in the playthrough as authored: the library persona, then the added characters. */
  library?: readonly Entity[];
}

/** The player's traits as a saved state holds them, each re-read from the world as play reads them. */
export function savedTraits(
  saved: Pick<GameState, 'playerTraits' | 'disabledTraitIds' | 'appliedTraitValues' | 'cascadeOffTraitIds' | 'ownedTraits'>,
  authored: Trait[],
): Pick<StatCodeTraits, 'acquired' | 'disabledTraitIds' | 'appliedValues' | 'cascadeOffTraitIds' | 'ownedTraits'> {
  return {
    acquired: refreshChosenTraits(saved.playerTraits, authored),
    disabledTraitIds: saved.disabledTraitIds ?? [],
    appliedValues: saved.appliedTraitValues ?? {},
    cascadeOffTraitIds: saved.cascadeOffTraitIds ?? {},
    ownedTraits: saved.ownedTraits ?? {},
  };
}

/** The sandbox's `traits` entries, one per authored trait in authored order, under their code names — the
 *  rule that names stats, so a chip in a trait's name never reaches code as this playthrough's roll. */
export function sandboxTraits(traits: StatCodeTraits, placeholders: readonly Placeholder[]): SandboxTrait[] {
  const acquired = new Set(traits.acquired.map((t) => t.id));
  const off = new Set(traits.disabledTraitIds);
  return traits.world.traits.map((trait) => ({
    name: statCodeName(trait.name, placeholders),
    acquired: acquired.has(trait.id),
    enabled: acquired.has(trait.id) && !off.has(trait.id),
  }));
}

/** One entity as code reads it: its bearer id, and each trait in its set by id. */
export interface CodeEntity extends SandboxEntity {
  /** Null for the empty persona. */
  id: string | null;
  traits: (SandboxTrait & { id: string })[];
}

/** What a turn's `entities` and `persona` read: every entity in play, and the played persona among them. */
export interface CodeEntities {
  /** In play order: the world's, then the library's. */
  entities: CodeEntity[];
  /** The empty entry when no persona entity plays. */
  persona: CodeEntity;
}

const NO_PERSONA: CodeEntity = { id: null, name: '', traits: [] };

/** The entity the player plays: the picked world or library persona, else the Custom Persona entity under
 *  None. Null when none plays. */
function playedPersonaId(traits: StatCodeTraits): string | null {
  const { persona, entities } = traits.world;
  if (!persona) return null;
  if (persona.source !== 'none') return persona.entityId;
  return (entities ?? traits.entities ?? []).find((e) => e.customPersona)?.id ?? null;
}

/**
 * One entity's entry, its traits the Bearer's own set, owned or linked, in tree order. A trait is acquired
 * when the entity has it chosen and enabled when it is also not switched off. Names are code names of the
 * authored text: an owned trait's own, a linked one's original's.
 */
function codeEntity(traits: StatCodeTraits, placeholders: readonly Placeholder[], authored: Entity): CodeEntity {
  const bearer = traits.world.bearers?.find((o) => o.id === authored.id);
  const state = traits.ownedTraits?.[authored.id];
  const chosen = new Set(state?.chosen ?? []);
  const off = new Set(state?.disabled ?? []);
  const named = withOwnPlaceholders(placeholders, authored);
  return {
    id: authored.id,
    name: statCodeName(authored.name, named),
    traits: (bearer?.traits ?? []).map((trait) => ({
      id: trait.id,
      name: statCodeName(authoredTraitName(trait, authored, traits.world.traits), named),
      acquired: chosen.has(trait.id),
      enabled: chosen.has(trait.id) && !off.has(trait.id),
    })),
  };
}

/**
 * Every entity in play and the played persona. A world entity is in play when it is the played persona, the
 * Custom Persona entity outside a world persona, or in the cast; every library entity is in play. Characters
 * the narrator invents are not listed.
 */
export function codeEntities(traits: StatCodeTraits, placeholders: readonly Placeholder[]): CodeEntities {
  const ref = traits.world.persona;
  const world = (traits.entities ?? []).filter((e) => playsAs(e, ref) || inCast(e, ref));
  const entities = [...world, ...traits.library ?? []].map((e) => codeEntity(traits, placeholders, e));
  const id = playedPersonaId(traits);
  return { entities, persona: entities.find((e) => e.id === id) ?? NO_PERSONA };
}

/** A bearer's trait as authored: the entity's own, else the original a link brings. */
const authoredTraitName = (trait: Trait, entity: Entity | null | undefined, worldTraits: readonly Trait[]): string =>
  entity?.traits?.find((t) => t.id === trait.id)?.name ?? worldTraits.find((t) => t.id === trait.id)?.name ?? trait.name;

/** The placeholders an entity's chips can name: the world's, then the entity's own. */
const withOwnPlaceholders = (placeholders: readonly Placeholder[], entity: Entity | null | undefined): readonly Placeholder[] =>
  (entity?.placeholders?.length ? [...placeholders, ...entity.placeholders] : placeholders);

/** Every authored entity, persona-only ones included, as the editor reads it: code names only, since the
 *  editor knows no playthrough. */
export function entityTraitNames(world: BearerWorld, placeholders: readonly Placeholder[]): CodeEntityNames[] {
  const bearers = new Map(resolveBearers(world, undefined).bearers.map((bearer) => [bearer.id, bearer]));
  return world.entities.map((entity) => {
    const named = withOwnPlaceholders(placeholders, entity);
    return {
      name: statCodeName(entity.name, named),
      traits: (bearers.get(entity.id)?.traits ?? []).map((trait) => statCodeName(authoredTraitName(trait, entity, world.traits), named)),
    };
  });
}

/** Whose trait maps hold one trait: the world's `traits`, the persona's, and each entity's by code name. */
export interface TraitHolders {
  world: boolean;
  persona: boolean;
  entities: readonly string[];
}

/** Whose trait maps hold a trait, as the editor reads the world: the world's own `traits` when it is a world
 *  trait, each entity whose set holds it owned or linked, and `persona` when one of those can be played. */
export function traitHolders(world: BearerWorld, placeholders: readonly Placeholder[], traitId: string): TraitHolders {
  const holding = resolveBearers(world, undefined).bearers.flatMap((bearer) =>
    (bearer.entity && bearer.traits.some((trait) => trait.id === traitId) ? [bearer.entity] : []));
  return {
    world: world.traits.some((trait) => trait.id === traitId),
    persona: holding.some(canBePlayer),
    entities: holding.map((entity) => statCodeName(entity.name, withOwnPlaceholders(placeholders, entity))),
  };
}

/** The code names of every trait a persona in the world can hold, owned or linked: what the editor offers
 *  after `persona.traits`. A library persona can hold others. */
export function personaTraitNames(world: BearerWorld, placeholders: readonly Placeholder[]): string[] {
  return resolveBearers(world, undefined).bearers
    .filter((bearer) => bearer.entity && canBePlayer(bearer.entity))
    .flatMap((bearer) => bearer.traits.map((trait) =>
      statCodeName(authoredTraitName(trait, bearer.entity, world.traits), withOwnPlaceholders(placeholders, bearer.entity))));
}

/** The sandbox's entry for an entity: its name and trait entries, without the ids. */
export const sandboxEntity = ({ name, traits }: CodeEntity): SandboxEntity =>
  ({ name, traits: traits.map(({ name: traitName, acquired, enabled }) => ({ name: traitName, acquired, enabled })) });
