/**
 * The inventory settle: item trait grants, item stat effects, trait gates and equip requirements, brought in
 * line with the Item Copies together. An equipped Item Copy whose requirement stops holding unequips and its
 * effects reverse (Q48); the passes repeat to a fixed point under a cap (Q66). Pure.
 */
import { itemRuleStates } from '@/lib/imageVisibility';
import { sameWhere } from '@/lib/items';
import { isHidden } from '@/lib/traitEffects';
import {
  entityStatTraitsInForce, setGrantedTraits, settleTraits, traitGateInput, traitNameIn, traitSwitchLog,
  type TraitRuntimeState, type TraitWorld,
} from '@/lib/traitRuntime';
import type { RowState } from '@/lib/traitGates';
import type { Item, ItemCopy, ItemEffectLedger, PersonaRef, Trait } from '@/types';
import { itemEffectLog, settleItemEffects } from './effects';
import { grantKey, wantedGrants } from './grants';

/** How many passes a settle runs before it stops (Q66). */
export const SETTLE_CAP = 10;

export interface InventorySettleState {
  copies: readonly ItemCopy[];
  /** The Item Copies before the change being settled, which name the items whose grants leave. */
  previous?: readonly ItemCopy[];
  traits: TraitRuntimeState;
  ledger: ItemEffectLedger | undefined;
}

export interface InventorySettleWorld {
  items: readonly Item[];
  /** The trait world. Its `itemCopies` are replaced by the settle's own. */
  traits: TraitWorld;
  /** Who `you` is. Absent ⇒ the trait world's persona. */
  persona?: PersonaRef;
  /** The world entities, for the Custom Persona entity a `you` owner can resolve to. */
  entities?: readonly { id: string; customPersona?: boolean }[];
  nameOf?: (trait: Trait) => string;
  /** Resolves the placeholders in an item or stat name. */
  resolve?: (text: string) => string;
  cap?: number;
}

export interface InventorySettleResult {
  copies: readonly ItemCopy[];
  traits: TraitRuntimeState;
  ledger: ItemEffectLedger;
  log: string[];
  /** The traits a gate cascade turned off, and their names as the banner reads them. */
  cascade: Trait[];
  cascadeNames: string[];
}

interface Pass {
  traits: TraitRuntimeState;
  ledger: ItemEffectLedger;
  log: string[];
  cascade: Trait[];
  cascadeNames: string[];
}

const same = (text: string) => text;

/** The settle's reading of the world. */
function reader(world: InventorySettleWorld) {
  const items = new Map(world.items.map((item) => [item.id, item]));
  const persona = world.persona ?? world.traits.persona;
  const nameOf = world.nameOf ?? ((trait: Trait) => trait.name);
  const resolve = world.resolve ?? same;
  const traitWorld = (copies: readonly ItemCopy[]): TraitWorld => ({ ...world.traits, itemCopies: copies });
  // A grant that leaves takes its item along, so its switch-off names the item it last read.
  const lastSources = new Map<string, { item: Item; hidden: boolean }>();
  const grantsOf = (effectCopies: readonly ItemCopy[], tw: TraitWorld, ledger?: ItemEffectLedger) =>
    wantedGrants(effectCopies, { items, owners: tw.owners ?? [], persona, entities: world.entities }, ledger?.firstObtainTraits);
  const remember = (copies: readonly ItemCopy[]) => {
    for (const [key, source] of grantsOf(copies, traitWorld(copies)).sources) lastSources.set(key, source);
  };
  const itemOf = (copy: ItemCopy) => (copy.item.kind === 'item' ? items.get(copy.item.itemId) : undefined);
  /** A copy as the log names it: "An item" when it is hidden (Q63). */
  const copyName = (copy: ItemCopy) => {
    const item = itemOf(copy);
    return copy.visibility === 'hidden' || !item ? 'An item' : resolve(item.name);
  };

  /** One pass: grants and stat effects from `effectCopies`, then the trait gates, which read `copies`. */
  const pass = (state: Omit<InventorySettleState, 'copies'>, effectCopies: readonly ItemCopy[], copies: readonly ItemCopy[]): Pass => {
    const tw = traitWorld(copies);
    const grants = grantsOf(effectCopies, tw, state.ledger);
    const granted = setGrantedTraits(state.traits, grants.held, tw);
    const log: string[] = [];
    for (const { ownerId, trait, on } of granted.switched) {
      if (isHidden(trait)) continue;
      const source = grants.sources.get(grantKey(ownerId, trait.id)) ?? lastSources.get(grantKey(ownerId, trait.id));
      const by = !source ? undefined : source.hidden ? 'An item' : resolve(source.item.name);
      log.push(...traitSwitchLog(traitNameIn(tw, trait.id, nameOf, ownerId) ?? trait.name, on ? 'on' : 'off', [], by));
    }
    for (const [key, source] of grants.sources) lastSources.set(key, source);
    const effects = settleItemEffects(
      { copies: effectCopies, entityStats: granted.state.entityStats ?? {}, ledger: state.ledger },
      { items: world.items, entities: world.entities, ...(persona && { persona }) },
      (id) => entityStatTraitsInForce(granted.state.ownedTraits, tw, id),
    );
    const moved = effects.entityStats === (granted.state.entityStats ?? {}) ? granted.state : { ...granted.state, entityStats: effects.entityStats };
    const settled = settleTraits(moved, tw, nameOf);
    const forGood = Object.keys(grants.firstObtainTraits).length ? { firstObtainTraits: grants.firstObtainTraits } : {};
    return {
      traits: settled.state,
      ledger: { ...effects.ledger, ...forGood },
      log: [...log, ...itemEffectLog(effects, resolve), ...grants.diagnostics, ...settled.log],
      cascade: settled.cascade,
      cascadeNames: settled.cascadeNames,
    };
  };

  /** Each row's state of `copy`'s equip requirement under `copies`, read without the effects of every Item
   *  Copy of that item at that owner (Q49, Q122); null when it has no requirement. */
  const requirementStates = (state: Omit<InventorySettleState, 'copies'>, copy: ItemCopy, copies: readonly ItemCopy[]): RowState[] | null => {
    const item = itemOf(copy);
    if (!item?.equipRequires.length) return null;
    const own = (c: ItemCopy) => c.item.kind === 'item' && c.item.itemId === item.id && sameWhere(c.where, copy.where);
    const without = pass(state, copies.filter((c) => !own(c)), copies);
    // The requirement reads the stats as they stand without the item, never a commit's snapshot.
    return itemRuleStates(traitGateInput(without.traits, { ...traitWorld(copies), gateStats: undefined }), copy, item.equipRequires);
  };

  return { pass, requirementStates, remember, copyName: copyName };
}

/** The rows' text, as a refused equip names it: each row's Conditions joined by "and", rows by "or". */
const rowsText = (rows: readonly RowState[]): string =>
  rows.map((row) => row.conditions.map((c) => c.text).join(' and ')).join(' or ');

const unequipped = (copy: ItemCopy): ItemCopy => {
  const { equipped: _off, ...rest } = copy;
  return rest;
};

/**
 * Brings grants, stat effects, trait gates and equipped items in line with `state.copies`. An equipped Item
 * Copy whose requirement fails unequips; the passes repeat until none does, or stop at the cap with a
 * diagnostic. Never changes its inputs.
 */
export function settleInventory(state: InventorySettleState, world: InventorySettleWorld): InventorySettleResult {
  const read = reader(world);
  const cap = world.cap ?? SETTLE_CAP;
  if (state.previous) read.remember(state.previous);
  let copies = state.copies;
  let current: Omit<InventorySettleState, 'copies'> = state;
  const log: string[] = [];
  const cascade: Trait[] = [];
  const cascadeNames: string[] = [];
  for (let n = 1; ; n += 1) {
    const done = read.pass(current, copies, copies);
    current = done;
    log.push(...done.log);
    cascade.push(...done.cascade);
    cascadeNames.push(...done.cascadeNames);
    const failing = copies.filter((copy) => {
      if (!copy.equipped) return false;
      const rows = read.requirementStates(current, copy, copies);
      return !!rows && !rows.some((row) => row.holds);
    });
    if (!failing.length) break;
    if (n >= cap) {
      log.push(`Inventory settle stopped after ${cap} passes`);
      break;
    }
    copies = copies.map((copy) => (failing.includes(copy) ? unequipped(copy) : copy));
    for (const copy of failing) log.push(`Unequipped ${read.copyName(copy)}: requirement no longer holds`);
  }
  return { copies, traits: current.traits, ledger: current.ledger ?? {}, log, cascade, cascadeNames };
}

/** Why `copy` cannot be equipped under `copies` (Q49), or null when its requirement holds. For the validator's
 *  equip check. */
export function equipRequirement(state: Omit<InventorySettleState, 'copies'>, world: InventorySettleWorld) {
  const read = reader(world);
  return (copy: ItemCopy, copies: readonly ItemCopy[]): string | null => {
    const rows = read.requirementStates(state, copy, copies);
    if (!rows || rows.some((row) => row.holds)) return null;
    return `${read.copyName(copy)} needs ${rowsText(rows)}`;
  };
}
