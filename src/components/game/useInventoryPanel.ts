import { useCallback, useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { presentEntityIds } from '@/lib/entityPresence';
import { applyInventoryOps, copiesAt, type ItemUse, type InventoryOp, type ItemScriptEvent, type TimedEffectView } from '@/lib/inventory';
import { entityNamed, scenePresentHere } from '@/lib/locationContext';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { randomUUID } from '@/lib/uuid';
import type { ItemCopy } from '@/types';
import type { InventoryTabProps } from './InventoryTab';

const YOU = { kind: 'you' } as const;
const NONE: never[] = [];

/** The live game's half of the panel: the equip check (Q49), the inventory settle that commits the new Item
 *  Copies with their effects, grants, requirements and uses (Q48) and runs their item scripts, and the timed
 *  effects running. */
export interface InventoryPanelSettle {
  requirement: (copy: ItemCopy, copies: readonly ItemCopy[]) => string | null;
  commit: (
    copies: readonly ItemCopy[], previous: readonly ItemCopy[], lines: readonly string[], itemUses: readonly ItemUse[], events: readonly ItemScriptEvent[],
  ) => void;
  timed?: readonly TimedEffectView[];
  /** The names who took part in recent turns, the chip scene's In Scene source. Absent = nobody in scene. */
  participants?: readonly string[];
}

/** The Inventory tab's data and its one write: panel operations through the Inventory module (Q17), then the
 *  settle. Without `settle`, the operations alone land. */
export function useInventoryPanel(settle?: InventoryPanelSettle, imageOf?: InventoryTabProps['imageOf']): InventoryTabProps {
  const data = useGameDataOptional();
  const items = data?.items ?? NONE;
  const slots = data?.slots ?? NONE;
  const {
    itemCopies, setItemCopies, runtimeItems, entityPositions, discoveredEntities, addLogEntry, isWaitingForAI, isViewingPast,
  } = useGameplay();
  const { entities, currentLocation, persona } = useResolvedWorld();
  const resolveText = usePlaceholderResolver();
  const locationId = currentLocation?.id;
  const disabled = isWaitingForAI || isViewingPast;
  const participants = settle?.participants ?? NONE;
  // Q62: the cast as it stands in play, runtime characters included, each marked when it is In Scene.
  const present = useMemo(() => {
    const cast = [...entities, ...discoveredAsEntities(discoveredEntities)];
    const hereIds = presentEntityIds(cast, entityPositions, locationId);
    const here = new Set(hereIds);
    const inScene = new Set(scenePresentHere([...participants], cast, hereIds).flatMap((name) => entityNamed(cast, name)?.id ?? []));
    return cast.filter((e) => here.has(e.id)).map((e) => ({ id: e.id, name: e.name, inScene: inScene.has(e.id) }));
  }, [entities, discoveredEntities, entityPositions, locationId, participants]);

  const onOps = useCallback((ops: InventoryOp[]) => {
    const result = applyInventoryOps(itemCopies, ops, {
      world: { items, slots }, source: 'panel', newId: randomUUID,
      presence: { locationId, entityIds: new Set(present.map((e) => e.id)) },
      ...(settle && { requirement: settle.requirement }),
    });
    if (settle) {
      settle.commit(result.copies, itemCopies, result.diagnostics, result.itemUses, result.events);
      return;
    }
    setItemCopies(result.copies);
    for (const line of result.diagnostics) addLogEntry(line);
  }, [itemCopies, items, slots, locationId, present, settle, setItemCopies, addLogEntry]);

  return {
    ownerName: persona?.entity.name ?? null,
    copies: useMemo(() => copiesAt(itemCopies, YOU), [itemCopies]),
    lying: useMemo(() => (locationId ? copiesAt(itemCopies, { kind: 'location', id: locationId }) : NONE), [itemCopies, locationId]),
    items, ...(runtimeItems?.length && { runtimeItems }), slots, present, locationId,
    locationName: currentLocation ? resolveText(currentLocation.name) : null, disabled, resolveText, ...(imageOf && { imageOf }), ...(settle?.timed && { timed: settle.timed }), onOps,
  };
}
