import { useCallback, useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { bodyInForce, bodyPickEntities, bodySlots, type TraitBodyPicks } from '@/lib/bodies';
import { applyInventoryOps, copiesAt, type ItemUse, type InventoryOp, type ItemScriptEvent, type TimedEffectView } from '@/lib/inventory';
import { usePresence } from '@/lib/usePresence';
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
  /** Each owner's winning trait Body pick. Absent = none. */
  traitPicks?: TraitBodyPicks;
  /** Each owner's base Body a script wrote. Absent = none. */
  basePicks?: TraitBodyPicks;
}

/** The Inventory tab's data and its one write: panel operations through the Inventory module (Q17), then the
 *  settle. Without `settle`, the operations alone land. */
export function useInventoryPanel(settle?: InventoryPanelSettle, imageOf?: InventoryTabProps['imageOf']): InventoryTabProps {
  const data = useGameDataOptional();
  const items = data?.items ?? NONE;
  const slots = data?.slots ?? NONE;
  const bodies = data?.bodies ?? NONE;
  const {
    itemCopies, setItemCopies, runtimeItems, addLogEntry, isWaitingForAI, isViewingPast, personaRef,
  } = useGameplay();
  const { currentLocation, persona, entities: cast, worldPersonas, customPersona } = useResolvedWorld();
  const entities = useMemo(() => bodyPickEntities(cast, worldPersonas, customPersona), [cast, worldPersonas, customPersona]);
  const traitPicks = settle?.traitPicks;
  const basePicks = settle?.basePicks;
  const bodyOfYou = useMemo(
    () => bodyInForce({ bodies, entities, traitPicks, basePicks }, YOU, personaRef), [bodies, entities, personaRef, traitPicks, basePicks],
  );
  const bodySlotsOfYou = useMemo(() => bodySlots(bodyOfYou, slots), [bodyOfYou, slots]);
  const resolveText = usePlaceholderResolver();
  const locationId = currentLocation?.id;
  const disabled = isWaitingForAI || isViewingPast;
  const { inScene } = usePresence();
  // Q54, Q56: Give and the panel writes take the In Scene set, each under its label.
  const present = useMemo(() => inScene.flatMap((p) => p.label === null ? [] : [{ id: p.entity.id, name: p.label }]), [inScene]);

  const onOps = useCallback((ops: InventoryOp[]) => {
    const result = applyInventoryOps(itemCopies, ops, {
      world: { items, slots, bodies, entities, traitPicks, basePicks }, source: 'panel', newId: randomUUID, persona: personaRef,
      presence: { locationId, entityIds: new Set(present.map((e) => e.id)) },
      ...(settle && { requirement: settle.requirement }),
    });
    if (settle) {
      settle.commit(result.copies, itemCopies, result.diagnostics, result.itemUses, result.events);
      return;
    }
    setItemCopies(result.copies);
    for (const line of result.diagnostics) addLogEntry(line);
  }, [itemCopies, items, slots, bodies, entities, traitPicks, basePicks, personaRef, locationId, present, settle, setItemCopies, addLogEntry]);

  return {
    ownerName: persona?.entity.name ?? null,
    copies: useMemo(() => copiesAt(itemCopies, YOU), [itemCopies]),
    lying: useMemo(() => (locationId ? copiesAt(itemCopies, { kind: 'location', id: locationId }) : NONE), [itemCopies, locationId]),
    items, ...(runtimeItems?.length && { runtimeItems }), body: bodyOfYou, slots: bodySlotsOfYou, present, locationId,
    locationName: currentLocation ? resolveText(currentLocation.name) : null, disabled, resolveText, ...(imageOf && { imageOf }), ...(settle?.timed && { timed: settle.timed }), onOps,
  };
}
