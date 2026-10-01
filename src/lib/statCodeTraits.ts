import type { CascadeOffTraitIds, Entity, GameState, OwnedTraitStates, Placeholder, Trait } from '@/types';
import { canBePlayer, resolveBearers, type BearerWorld } from './bearers';
import type { SandboxPersona, SandboxTrait } from './statCodeExecutor';
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
  /** The entities in play as authored, chips and all: the world's, then the library's. Code names read these,
   *  never the resolved names the bearers carry. Absent ⇒ names fall back to the bearers'. */
  entities?: readonly Entity[];
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

/** The played persona as code reads it: its bearer id, and each trait in its set by id. */
export interface CodePersona extends SandboxPersona {
  /** Null when no persona entity plays. */
  id: string | null;
  traits: (SandboxTrait & { id: string })[];
}

const NO_PERSONA: CodePersona = { id: null, name: '', traits: [] };

/** The entity the player plays: the picked world or library persona, else the Custom Persona entity under
 *  None. Null when none plays. */
function playedPersonaId(traits: StatCodeTraits): string | null {
  const { persona, entities } = traits.world;
  if (!persona) return null;
  if (persona.source !== 'none') return persona.entityId;
  return (entities ?? traits.entities ?? []).find((e) => e.customPersona)?.id ?? null;
}

/**
 * The played persona's entry, its traits the Bearer's own set, owned or linked, in tree order. A trait is
 * acquired when the persona has it chosen and enabled when it is also not switched off. Names are code names
 * of the authored text: an owned trait's own, a linked one's original's.
 */
export function codePersona(traits: StatCodeTraits, placeholders: readonly Placeholder[]): CodePersona {
  const id = playedPersonaId(traits);
  if (id === null) return NO_PERSONA;
  const bearer = traits.world.bearers?.find((o) => o.id === id);
  const authored = traits.entities?.find((e) => e.id === id);
  if (!bearer && !authored) return NO_PERSONA;
  const state = traits.ownedTraits?.[id];
  const chosen = new Set(state?.chosen ?? []);
  const off = new Set(state?.disabled ?? []);
  const named = withOwnPlaceholders(placeholders, authored);
  return {
    id,
    name: statCodeName(authored?.name ?? bearer?.name, named),
    traits: (bearer?.traits ?? []).map((trait) => ({
      id: trait.id,
      name: statCodeName(authoredTraitName(trait, authored, traits.world.traits), named),
      acquired: chosen.has(trait.id),
      enabled: chosen.has(trait.id) && !off.has(trait.id),
    })),
  };
}

/** A bearer's trait as authored: the entity's own, else the original a link brings. */
const authoredTraitName = (trait: Trait, entity: Entity | null | undefined, worldTraits: readonly Trait[]): string =>
  entity?.traits?.find((t) => t.id === trait.id)?.name ?? worldTraits.find((t) => t.id === trait.id)?.name ?? trait.name;

/** The placeholders an entity's chips can name: the world's, then the entity's own. */
const withOwnPlaceholders = (placeholders: readonly Placeholder[], entity: Entity | null | undefined): readonly Placeholder[] =>
  (entity?.placeholders?.length ? [...placeholders, ...entity.placeholders] : placeholders);

/** The code names of every trait a persona in the world can hold, owned or linked: what the editor offers
 *  after `persona.traits`. A library persona can hold others. */
export function personaTraitNames(world: BearerWorld, placeholders: readonly Placeholder[]): string[] {
  return resolveBearers(world, undefined).bearers
    .filter((bearer) => bearer.entity && canBePlayer(bearer.entity))
    .flatMap((bearer) => bearer.traits.map((trait) =>
      statCodeName(authoredTraitName(trait, bearer.entity, world.traits), withOwnPlaceholders(placeholders, bearer.entity))));
}

/** The sandbox's `persona` entry: the played persona's name and trait entries, without the ids. */
export const sandboxPersona = ({ name, traits }: CodePersona): SandboxPersona =>
  ({ name, traits: traits.map(({ name: traitName, acquired, enabled }) => ({ name: traitName, acquired, enabled })) });
