/**
 * The inventory settle: item trait grants, item stat effects, trait gates, equip requirements and Bodies,
 * brought in line with the Item Copies together. An equipped Item Copy whose requirement stops holding, or
 * whose owner's Body no longer holds it, unequips and its effects reverse (Q12, Q48); the passes repeat to a
 * fixed point under a cap (Q66). Pure.
 */
import {
  bodyInForce, bodyMisfits, nextTraitsOn, slotOwnerKey, traitBodyPicks, type BodyWorld, type SlotOwner, type TraitBodyPicks,
} from '@/lib/bodies';
import { itemRuleStates } from '@/lib/imageVisibility';
import { copySighting, sameWhere, seenItemName, type SourceSighting } from '@/lib/items';
import { inAuthoredOrder, isHidden, traitOrderIndex } from '@/lib/traitEffects';
import { playedEntityIds } from '@/lib/scope';
import {
  entityStatTraitsInForce, setGrantedTraits, settleTraits, traitForceScope, traitGateInput, traitNameIn, traitSwitchLog,
  type TraitRuntimeState, type TraitWorld,
} from '@/lib/traitRuntime';
import type { RowState } from '@/lib/traitGates';
import type {
  Body, BodyRuntime, BodyTraitOn, Item, ItemCopy, ItemEffectLedger, PersonaRef, Slot, TimedItemEffect, Trait,
} from '@/types';
import { itemEffectLog, settleItemEffects, type ItemUse } from './effects';
import type { ItemScriptEvent } from './index';
import { grantKey, wantedGrants } from './grants';

/** How many passes a settle runs before it stops (Q66). */
export const SETTLE_CAP = 10;

export interface InventorySettleState {
  copies: readonly ItemCopy[];
  /** The Item Copies before the change being settled, which name the items whose grants leave. */
  previous?: readonly ItemCopy[];
  traits: TraitRuntimeState;
  ledger: ItemEffectLedger | undefined;
  /** The uses this settle starts, from the validator's result. */
  itemUses?: readonly ItemUse[];
  /** The story clock's `gameTime`, which timed effects end by and start from. Absent: none ends. */
  now?: number;
  /** The Body state before the change. Absent ⇒ none. */
  bodies?: BodyRuntime;
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
  /** The Bodies and slots owners equip into. Absent ⇒ the settle leaves Bodies alone. */
  bodies?: SettleBodies;
  /** Who `you` was before a persona change, for the Body it had. Absent ⇒ `persona`. */
  previousPersona?: PersonaRef;
  cap?: number;
  /** Keeps requirement unequips out of the log, as a new game does (Q50). */
  quietUnequips?: boolean;
}

export type SettleBodies = Omit<BodyWorld, 'traitPicks'> & { slots?: readonly Slot[] };

export interface InventorySettleResult {
  copies: readonly ItemCopy[];
  traits: TraitRuntimeState;
  ledger: ItemEffectLedger;
  log: string[];
  /** The traits a gate cascade turned off, and their names as the banner reads them. */
  cascade: Trait[];
  cascadeNames: string[];
  /** One When Unequipped event per Item Copy a failed requirement or a Body change unequipped. */
  events: ItemScriptEvent[];
  bodies: BodyRuntime;
  /** One line per owner whose Body in force changed, naming what that unequipped (Q41). Apart from `log`. */
  bodyLog: string[];
  /** How many Item Copies the owners' Bodies no longer held. */
  bodyUnequipped: number;
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
  const lastSources = new Map<string, SourceSighting & { item: Item }>();
  const grantsOf = (effectCopies: readonly ItemCopy[], tw: TraitWorld, ledger?: ItemEffectLedger, itemUses?: readonly ItemUse[], now?: number) =>
    wantedGrants(
      effectCopies, { items, owners: tw.owners ?? [], persona, entities: world.entities }, ledger?.firstObtainTraits,
      { entries: ledger?.timed, itemUses, now },
    );
  const remember = (copies: readonly ItemCopy[], ledger: ItemEffectLedger | undefined) => {
    for (const [key, source] of grantsOf(copies, traitWorld(copies), ledger).sources) lastSources.set(key, source);
  };
  const itemOf = (copy: ItemCopy) => (copy.item.kind === 'item' ? items.get(copy.item.itemId) : undefined);
  /** A copy as the log names it: "An item" when it is hidden (Q63), the unidentified face when unidentified (Q17). */
  const copyName = (copy: ItemCopy) => {
    const item = itemOf(copy);
    const name = item && seenItemName(item, copySighting(copy));
    return name ? resolve(name) : 'An item';
  };

  /** One pass: grants and stat effects from `effectCopies`, then the trait gates, which read `copies`. `itemUses` start
   *  their After Use rows, so only one pass gets them. */
  const pass = (
    state: Omit<InventorySettleState, 'copies'>, effectCopies: readonly ItemCopy[], copies: readonly ItemCopy[], itemUses?: readonly ItemUse[],
  ): Pass => {
    const tw = traitWorld(copies);
    const grants = grantsOf(effectCopies, tw, state.ledger, itemUses, state.now);
    const granted = setGrantedTraits(state.traits, grants.held, tw);
    const log: string[] = [];
    for (const { ownerId, trait, on } of granted.switched) {
      if (isHidden(trait)) continue;
      const source = grants.sources.get(grantKey(ownerId, trait.id)) ?? lastSources.get(grantKey(ownerId, trait.id));
      const name = source && seenItemName(source.item, source);
      const by = !source ? undefined : name ? resolve(name) : 'An item';
      log.push(...traitSwitchLog(traitNameIn(tw, trait.id, nameOf, ownerId) ?? trait.name, on ? 'on' : 'off', [], by));
    }
    for (const [key, source] of grants.sources) lastSources.set(key, source);
    // The grants own the timed trait rows; the stat settle owns the timed stat rows.
    const timedStats = Object.entries(state.ledger?.timed ?? {}).filter(([, entry]) => entry.row === 'stat');
    const timed: Record<string, TimedItemEffect> = { ...Object.fromEntries(timedStats), ...grants.timedTraits };
    const effects = settleItemEffects(
      {
        copies: effectCopies, entityStats: granted.state.entityStats ?? {}, ledger: { ...state.ledger, timed }, itemUses,
        ...(state.now !== undefined && { now: state.now }),
      },
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

/** Every trait an entry can name, active or not: the acquired ones, the world's and each owner's tree. */
function traitLookup(world: TraitWorld, acquired: readonly Trait[]): (on: BodyTraitOn) => Trait | undefined {
  const owners = new Map((world.owners ?? []).map((owner) => [owner.id, owner.traits]));
  return (on) => (on.ownerId === null
    ? acquired.find((t) => t.id === on.traitId) ?? world.traits.find((t) => t.id === on.traitId)
    : owners.get(on.ownerId)?.find((t) => t.id === on.traitId));
}

/** Each owner's winning trait Body pick under `traitsOn`. */
const picksOf = (traitsOn: readonly BodyTraitOn[], world: TraitWorld, acquired: readonly Trait[], persona: PersonaRef | undefined) =>
  traitBodyPicks(traitsOn, traitLookup(world, acquired), persona ? playedEntityIds(persona, world.entities) : []);

/** Each owner's winning trait Body pick, as play reads it between settles. */
export const traitPicksInPlay = (bodies: BodyRuntime, traits: TraitRuntimeState, world: TraitWorld): TraitBodyPicks =>
  picksOf(bodies.traitsOn ?? [], world, traits.traits, world.persona);

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
  if (state.previous) read.remember(state.previous, state.ledger);
  const persona = world.persona ?? world.traits.persona;
  const globalOrder = traitOrderIndex(world.traits.traits, world.traits.groups);
  const before = state.bodies?.traitsOn ?? [];
  let traitsOn: readonly BodyTraitOn[] = before;
  let picks: TraitBodyPicks = {};
  let copies = state.copies;
  let current: Omit<InventorySettleState, 'copies'> = state;
  const log: string[] = [];
  const cascade: Trait[] = [];
  const cascadeNames: string[] = [];
  const events: ItemScriptEvent[] = [];
  const offByBody: ItemCopy[] = [];
  const fireUnequipped = (copy: ItemCopy) => {
    if (copy.item.kind !== 'item') return;
    events.push({ timing: 'unequipped', itemId: copy.item.itemId, copyId: copy.id, where: copy.where, quantity: copy.quantity });
  };
  for (let n = 1; ; n += 1) {
    const done = read.pass(current, copies, copies, n === 1 ? state.itemUses : undefined);
    current = { ...done, ...(state.now !== undefined && { now: state.now }) };
    log.push(...done.log);
    cascade.push(...done.cascade);
    cascadeNames.push(...done.cascadeNames);
    const tw: TraitWorld = { ...world.traits, itemCopies: copies };
    const scope = traitForceScope(current.traits, tw);
    // Global traits are held in acquisition order; a same-commit tie goes by tree order (Q40).
    traitsOn = nextTraitsOn(traitsOn, { ...scope, global: inAuthoredOrder(scope.global, globalOrder) });
    picks = picksOf(traitsOn, tw, current.traits.traits, persona);
    const misfits = world.bodies ? bodyMisfits(copies, { ...world.bodies, items: world.items, traitPicks: picks }, persona) : [];
    const failing = copies.filter((copy) => {
      if (!copy.equipped || misfits.includes(copy)) return false;
      const rows = read.requirementStates(current, copy, copies);
      return !!rows && !rows.some((row) => row.holds);
    });
    if (!failing.length && !misfits.length) break;
    if (n >= cap) {
      log.push(`Inventory settle stopped after ${cap} passes`);
      break;
    }
    copies = copies.map((copy) => (failing.includes(copy) || misfits.includes(copy) ? unequipped(copy) : copy));
    for (const copy of failing) {
      if (!world.quietUnequips) log.push(`Unequipped ${read.copyName(copy)}: requirement no longer holds`);
      fireUnequipped(copy);
    }
    for (const copy of misfits) fireUnequipped(copy);
    offByBody.push(...misfits);
  }
  const was = world.previousPersona ?? persona;
  const bodyLog = world.bodies ? bodyChangeLog({
    world: world.bodies,
    before: { picks: picksOf(before, world.traits, state.traits.traits, was), persona: was },
    after: { picks, persona },
    offByBody, copyName: read.copyName, resolve: world.resolve ?? same,
  }) : [];
  const { traitsOn: _was, ...rest } = state.bodies ?? {};
  return {
    copies, traits: current.traits, ledger: current.ledger ?? {}, log, cascade, cascadeNames, events,
    bodies: traitsOn.length ? { ...rest, traitsOn: [...traitsOn] } : rest, bodyLog, bodyUnequipped: offByBody.length,
  };
}

interface BodyChange {
  world: SettleBodies;
  before: { picks: TraitBodyPicks; persona: PersonaRef | undefined };
  after: { picks: TraitBodyPicks; persona: PersonaRef | undefined };
  offByBody: readonly ItemCopy[];
  copyName: (copy: ItemCopy) => string;
  resolve: (text: string) => string;
}

/** "Body: Wolf" for the played Persona, "Rex's Body: Wolf" for an entity, with ". Unequipped A, B" when the
 *  change took items off (Q41). One line per owner whose Body in force changed. */
function bodyChangeLog(change: BodyChange): string[] {
  const { world, before, after } = change;
  const entityIds = new Set([
    ...Object.keys(before.picks), ...Object.keys(after.picks),
    ...change.offByBody.flatMap((copy) => (copy.where.kind === 'entity' ? [copy.where.id] : [])),
  ]);
  const owners: SlotOwner[] = [{ kind: 'you' }, ...[...entityIds].filter(Boolean).map((id) => ({ kind: 'entity' as const, id }))];
  const nameOf = (body: Body | undefined) => (body ? change.resolve(body.name) : 'None');
  return owners.flatMap((owner) => {
    const was = bodyInForce({ ...world, traitPicks: before.picks }, owner, before.persona);
    const is = bodyInForce({ ...world, traitPicks: after.picks }, owner, after.persona);
    if (was?.id === is?.id) return [];
    const key = slotOwnerKey(owner);
    const off = change.offByBody.filter((copy) => copy.where.kind !== 'location' && slotOwnerKey(copy.where) === key).map(change.copyName);
    const entity = owner.kind === 'entity' ? world.entities?.find((e) => e.id === owner.id) : undefined;
    const who = owner.kind === 'entity' ? `${change.resolve(entity?.name ?? owner.id)}'s ` : '';
    return [`${who}Body: ${nameOf(is)}${off.length ? `. Unequipped ${off.join(', ')}` : ''}`];
  });
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
