import { useCallback, useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { bodyInForce, bodyPickEntities, bodySlots, type TraitBodyPicks } from '@/lib/bodies';
import { applyInventoryOps, copiesAt, type ItemUse, type InventoryOp, type ItemScriptEvent, type TimedEffectView } from '@/lib/inventory';
import { usePresence } from '@/lib/usePresence';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { randomUUID } from '@/lib/uuid';
import { copyName } from '@/lib/items';
import { actionItemKey, type ActionSnapshot, type ListedActionFacts } from '@/lib/actionList';
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
  /** The Action List the panel's actions go to. Absent = not listed. */
  actions?: PanelActionList;
  /** Item scripts of an earlier action still run, so a new action would snapshot a state they have yet to write. */
  busy?: boolean;
}

/** The live game's Action List, as the panel writes it. */
export interface PanelActionList {
  /** Undoes the newest entry when `facts` exactly reverses it (Q17). True when it did. */
  reverse: (facts: ListedActionFacts) => boolean;
  /** The state just before an action. */
  snapshot: () => ActionSnapshot;
  add: (facts: ListedActionFacts, snapshot: ActionSnapshot) => void;
}

const itemKey = (copy: ItemCopy): string => actionItemKey(copy.item);

/** What a panel `op` does, before it runs; null for an op the panel never lists. */
function plannedFacts(op: InventoryOp, copies: readonly ItemCopy[], name: (copy: ItemCopy) => string, entityName: (id: string) => string): ListedActionFacts | null {
  if (op.kind === 'gain') return null;
  const copy = copies.find((c) => c.id === op.copyId);
  if (!copy) return null;
  const item = { key: itemKey(copy), name: name(copy) };
  switch (op.kind) {
    case 'use':
    case 'equip':
    case 'unequip':
      return { kind: op.kind, item, copyId: copy.id };
    case 'transfer': {
      const quantity = op.quantity ?? copy.quantity;
      if (op.to.kind === 'entity') return { kind: 'give', item, quantity, to: { id: op.to.id, name: entityName(op.to.id) } };
      if (op.to.kind === 'location') return { kind: 'drop', item, quantity, place: op.to.id };
      return copy.where.kind === 'location' ? { kind: 'pickup', item, quantity, place: copy.where.id } : null;
    }
    default:
      return null;
  }
}

/** `facts` with the row an equip or unequip left: the copy itself, a copy split off it, or the stack it merged into. */
function ranFacts(facts: ListedActionFacts, before: readonly ItemCopy[], after: readonly ItemCopy[]): ListedActionFacts {
  if (facts.kind !== 'equip' && facts.kind !== 'unequip') return facts;
  const equip = facts.kind === 'equip';
  const grew = (c: ItemCopy) => c.id === facts.copyId || c.quantity > (before.find((b) => b.id === c.id)?.quantity ?? 0);
  const row = after.find((c) => !!c.equipped === equip && itemKey(c) === facts.item.key && grew(c));
  return row ? { ...facts, resultId: row.id } : facts;
}

/** Whether `after` differs from `before`. A skipped op changes no Item Copy. */
const changed = (before: readonly ItemCopy[], after: readonly ItemCopy[]) =>
  before.length !== after.length || after.some((copy, i) => copy !== before[i]);

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
  const disabled = isWaitingForAI || isViewingPast || !!settle?.busy;
  const { inScene } = usePresence();
  // Q54, Q56: Give and the panel writes take the In Scene set, each under its label.
  const present = useMemo(() => inScene.flatMap((p) => p.label === null ? [] : [{ id: p.entity.id, name: p.label }]), [inScene]);

  const runtimeItemList = runtimeItems ?? NONE;
  const onOps = useCallback((ops: InventoryOp[]) => {
    const list = settle?.actions;
    const planned = list && ops.length === 1 ? plannedFacts(
      ops[0], itemCopies, (copy) => copyName(copy, items, runtimeItemList, resolveText),
      (id) => present.find((e) => e.id === id)?.name ?? 'an entity',
    ) : null;
    if (list && planned && list.reverse(planned)) return;
    const before = list && planned ? list.snapshot() : null;
    const result = applyInventoryOps(itemCopies, ops, {
      world: { items, slots, bodies, entities, traitPicks, basePicks }, source: 'panel', newId: randomUUID, persona: personaRef,
      presence: { locationId, entityIds: new Set(present.map((e) => e.id)) },
      ...(settle && { requirement: settle.requirement }),
    });
    if (settle) {
      settle.commit(result.copies, itemCopies, result.diagnostics, result.itemUses, result.events);
      if (list && planned && before && changed(itemCopies, result.copies)) list.add(ranFacts(planned, itemCopies, result.copies), before);
      return;
    }
    setItemCopies(result.copies);
    for (const line of result.diagnostics) addLogEntry(line);
  }, [itemCopies, items, runtimeItemList, resolveText, slots, bodies, entities, traitPicks, basePicks, personaRef, locationId, present, settle, setItemCopies, addLogEntry]);

  return {
    ownerName: persona?.entity.name ?? null,
    copies: useMemo(() => copiesAt(itemCopies, YOU), [itemCopies]),
    lying: useMemo(() => (locationId ? copiesAt(itemCopies, { kind: 'location', id: locationId }) : NONE), [itemCopies, locationId]),
    items, ...(data?.currencies?.length && { currencies: data.currencies }), ...(runtimeItems?.length && { runtimeItems }), body: bodyOfYou, slots: bodySlotsOfYou, worldSlots: slots, present, locationId,
    locationName: currentLocation ? resolveText(currentLocation.name) : null, disabled, resolveText, ...(imageOf && { imageOf }), ...(settle?.timed && { timed: settle.timed }), onOps,
  };
}
