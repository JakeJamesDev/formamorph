import { useCallback, useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { presentEntityIds } from '@/lib/entityPresence';
import { applyInventoryOps, copiesAt, itemEffectLog, settleItemEffects, type InventoryOp, type OwnerStatTraits } from '@/lib/inventory';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { randomUUID } from '@/lib/uuid';
import type { InventoryTabProps } from './InventoryTab';

const YOU = { kind: 'you' } as const;
const NONE: never[] = [];

/** The Inventory tab's data and its one write: panel operations through the Inventory module (Q17), then the
 *  item effects they change. `ownerStatTraits` is each entity's stat traits in force, which bounds derive from. */
export function useInventoryPanel(ownerStatTraits: OwnerStatTraits, imageOf?: InventoryTabProps['imageOf']): InventoryTabProps {
  const data = useGameDataOptional();
  const items = data?.items ?? NONE;
  const slots = data?.slots ?? NONE;
  const worldEntities = data?.entities ?? NONE;
  const {
    itemCopies, setItemCopies, itemEffects, setItemEffects, entityStats, setEntityStats, personaRef,
    entityPositions, discoveredEntities, addLogEntry, isWaitingForAI, isViewingPast,
  } = useGameplay();
  const { entities, currentLocation, persona } = useResolvedWorld();
  const resolveText = usePlaceholderResolver();
  const locationId = currentLocation?.id;
  const disabled = isWaitingForAI || isViewingPast;
  // Q62: the cast as it stands in play, runtime characters included.
  const present = useMemo(() => {
    const cast = [...entities, ...discoveredAsEntities(discoveredEntities)];
    const ids = new Set(presentEntityIds(cast, entityPositions, locationId));
    return cast.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, name: e.name }));
  }, [entities, discoveredEntities, entityPositions, locationId]);

  const onOps = useCallback((ops: InventoryOp[]) => {
    const result = applyInventoryOps(itemCopies, ops, {
      world: { items, slots }, source: 'panel', newId: randomUUID,
      presence: { locationId, entityIds: new Set(present.map((e) => e.id)) },
    });
    const effects = settleItemEffects(
      { copies: result.copies, entityStats, ledger: itemEffects },
      { items, entities: worldEntities, ...(personaRef && { persona: personaRef }) },
      ownerStatTraits,
    );
    setItemCopies(result.copies);
    setItemEffects(effects.ledger);
    if (effects.entityStats !== entityStats) setEntityStats(effects.entityStats);
    for (const line of [...result.diagnostics, ...itemEffectLog(effects, resolveText)]) addLogEntry(line);
  }, [itemCopies, items, slots, locationId, present, entityStats, itemEffects, worldEntities, personaRef, ownerStatTraits,
    setItemCopies, setItemEffects, setEntityStats, addLogEntry, resolveText]);

  return {
    ownerName: persona?.entity.name ?? null,
    copies: useMemo(() => copiesAt(itemCopies, YOU), [itemCopies]),
    lying: useMemo(() => (locationId ? copiesAt(itemCopies, { kind: 'location', id: locationId }) : NONE), [itemCopies, locationId]),
    items, slots, present, locationId, disabled, resolveText, ...(imageOf && { imageOf }), onOps,
  };
}
