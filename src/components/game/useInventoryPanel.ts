import { useCallback, useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { presentEntityIds } from '@/lib/entityPresence';
import { applyInventoryOps, copiesAt, type InventoryOp } from '@/lib/inventory';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { randomUUID } from '@/lib/uuid';
import type { InventoryTabProps } from './InventoryTab';

const YOU = { kind: 'you' } as const;
const NONE: never[] = [];

/** The Inventory tab's data and its one write: panel operations through the Inventory module (Q17). */
export function useInventoryPanel(): InventoryTabProps {
  const data = useGameDataOptional();
  const items = data?.items ?? NONE;
  const slots = data?.slots ?? NONE;
  const {
    itemCopies, setItemCopies, entityPositions, discoveredEntities, addLogEntry, isWaitingForAI, isViewingPast,
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
    setItemCopies(result.copies);
    for (const line of result.diagnostics) addLogEntry(line);
  }, [itemCopies, items, slots, locationId, present, setItemCopies, addLogEntry]);

  return {
    ownerName: persona?.entity.name ?? null,
    copies: useMemo(() => copiesAt(itemCopies, YOU), [itemCopies]),
    items, slots, present, locationId, disabled, resolveText, onOps,
  };
}
