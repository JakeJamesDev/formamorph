import type { GameState, Trait } from '@/types';
import type { SandboxTrait } from './statCodeExecutor';
import { refreshChosenTraits } from './traitEffects';
import type { AppliedTraitValues, TraitWorld } from './traitRuntime';

/** The player's traits as the trait runtime holds them, and the authored world code switches them against. */
export interface StatCodeTraits {
  /** The player's list, chosen at creation or acquired in play. Switched-off ones stay listed. */
  acquired: readonly Trait[];
  disabledTraitIds: readonly string[];
  appliedValues: AppliedTraitValues;
  /** Every authored trait and group. `traits` maps each authored trait; a code switch-on acquires from here. */
  world: TraitWorld;
  /** The name code reaches a trait by, and the log writes. Defaults to its own name. */
  nameOf?: (trait: Trait) => string;
}

/** The player's traits as a saved state holds them, each re-read from the world as play reads them. */
export function savedTraits(
  saved: Pick<GameState, 'playerTraits' | 'disabledTraitIds' | 'appliedTraitValues'>,
  authored: Trait[],
): Pick<StatCodeTraits, 'acquired' | 'disabledTraitIds' | 'appliedValues'> {
  return {
    acquired: refreshChosenTraits(saved.playerTraits, authored),
    disabledTraitIds: saved.disabledTraitIds ?? [],
    appliedValues: saved.appliedTraitValues ?? {},
  };
}

/** The resolver that names a trait for code and the log. */
export const traitNamer = (traits: StatCodeTraits) => traits.nameOf ?? ((trait: Trait) => trait.name);

/** The sandbox's `traits` entries, one per authored trait in authored order. */
export function sandboxTraits(traits: StatCodeTraits): SandboxTrait[] {
  const acquired = new Set(traits.acquired.map((t) => t.id));
  const off = new Set(traits.disabledTraitIds);
  const nameOf = traitNamer(traits);
  return traits.world.traits.map((trait) => ({
    name: nameOf(trait),
    acquired: acquired.has(trait.id),
    enabled: acquired.has(trait.id) && !off.has(trait.id),
  }));
}
