import { createContext, useContext, useMemo } from 'react';
import { useOptionalTraitStore } from '@/contexts/TraitStoreContext';
import { entityLookReads, lazyLookReads } from '@/lib/entityLook';
import { OUTSIDE_PLAY, type LayerReads } from '@/lib/layeredImages';
import type { GateInput } from '@/lib/traitGates';
import type { Placeholder } from '@/types';

/** What a rule editor outside the trait panels reads: the gate input, the chip vocabulary, and whether
 *  requirements point only inside the entity (off-world). */
export interface RuleSource {
  gateInput: GateInput;
  placeholders: readonly Placeholder[];
  offWorld: boolean;
}

/**
 * Builds a rule source on demand. A host with no world binds it, so the gate input is built when a rule editor
 * opens rather than on every keystroke in the entity behind it.
 */
export const RuleSourceContext = createContext<(() => RuleSource) | null>(null);

/** The rule source in scope: the host's builder, else the loaded world's trait store. Null with neither. */
export function useRuleSource(): RuleSource | null {
  const build = useContext(RuleSourceContext);
  const store = useOptionalTraitStore();
  const gateInput = store?.gateInput;
  const placeholders = store?.placeholders;
  const offWorld = !!store?.offWorld;
  return useMemo(() => {
    if (build) return build();
    return gateInput && placeholders ? { gateInput, placeholders, offWorld } : null;
  }, [build, gateInput, placeholders, offWorld]);
}

/** What entity `entityId`'s Layered Images read under the rule source in scope; the first Variants with none.
 *  A host's builder runs at the first rule read, so a rig without rules builds nothing. */
export function useEntityLookReads(entityId: string | undefined): LayerReads {
  const build = useContext(RuleSourceContext);
  const gateInput = useOptionalTraitStore()?.gateInput;
  return useMemo(() => {
    if (!entityId) return OUTSIDE_PLAY;
    if (build) return lazyLookReads(() => build().gateInput, entityId);
    return gateInput ? entityLookReads(gateInput, entityId) : OUTSIDE_PLAY;
  }, [build, gateInput, entityId]);
}
