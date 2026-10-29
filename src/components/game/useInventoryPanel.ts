import { useCallback, useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { presentEntityIds } from '@/lib/entityPresence';
import { applyInventoryOps, copiesAt, type InventoryOp } from '@/lib/inventory';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { randomUUID } from '@/lib/uuid';
import type { ItemCopy } from '@/types';
import type { InventoryTabProps } from './InventoryTab';

const YOU = { kind: 'you' } as const;
const NONE: never[] = [];

/** The live game's half of a panel write: the equip check (Q49), and the inventory settle that commits the
 *  new Item Copies with their effects, grants and requirements (Q48). */
export interface InventoryPanelSettle {
  requirement: (copy: ItemCopy, copies: readonly ItemCopy[]) => string | null;
  commit: (copies: readonly ItemCopy[], previous: readonly ItemCopy[], lines: readonly string[]) => void;
}

/** The Inventory tab's data and its one write: panel operations through the Inventory module (Q17), then the
 *  settle. Without `settle`, the operations alone land. */
export function useInventoryPanel(settle?: InventoryPanelSettle, imageOf?: InventoryTabProps['imageOf']): InventoryTabProps {
  const data = useGameDataOptional();
  const items = data?.items ?? NONE;
  const slots = data?.slots ?? NONE;
  const { itemCopies, setItemCopies, entityPositions, discoveredEntities, addLogEntry, isWaitingForAI, isViewingPast } = useGameplay();
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
      ...(settle && { requirement: settle.requirement }),
    });
    if (settle) {
      settle.commit(result.copies, itemCopies, result.diagnostics);
      return;
    }
    setItemCopies(result.copies);
    for (const line of result.diagnostics) addLogEntry(line);
  }, [itemCopies, items, slots, locationId, present, settle, setItemCopies, addLogEntry]);

  return {
    ownerName: persona?.entity.name ?? null,
    copies: useMemo(() => copiesAt(itemCopies, YOU), [itemCopies]),
    lying: useMemo(() => (locationId ? copiesAt(itemCopies, { kind: 'location', id: locationId }) : NONE), [itemCopies, locationId]),
    items, slots, present, locationId, disabled, resolveText, ...(imageOf && { imageOf }), onOps,
  };
}
