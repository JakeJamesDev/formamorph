import type { GameState, Placeholder, Trait } from '@/types';
import type { SandboxTrait } from './statCodeExecutor';
import { statCodeName } from './statCodeNames';
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
