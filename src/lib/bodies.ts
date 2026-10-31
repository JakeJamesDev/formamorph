/**
 * Bodies: which slots each owner equips into, with each slot's capacity. `bodyInForce` is the one resolver
 * every slot reader takes.
 */
import { itemsInSlot, slotSizeOf } from '@/lib/items';
import { usedByText } from '@/lib/usedByText';
import type { Body, BodyEntry, BodyPick, BodyTraitOn, Item, ItemCopy, ItemCopyWhere, PersonaRef, Slot, Trait, TraitBodyRow } from '@/types';

/** The authored slice the resolver reads. An absent slice reads as empty. */
export interface BodyWorld {
  bodies?: readonly Body[];
  entities?: readonly { id: string; name?: string; body?: BodyPick; customPersona?: boolean }[];
  /** Each owner's winning trait Body pick, by {@link slotOwnerKey}. Absent = none. */
  traitPicks?: TraitBodyPicks;
  /** Each owner's base Body a script wrote, by {@link slotOwnerKey}. It yields to a trait pick (Q14). Absent = none. */
  basePicks?: TraitBodyPicks;
}

/** Owner key → the Body pick its winning trait sets. */
export type TraitBodyPicks = Readonly<Record<string, BodyPick>>;

/** One slot of a Body, as the panel and the validator read it. */
export interface BodySlot {
  slot: Slot;
  capacity: number;
}

/** An owner that can equip: the played Persona or an entity. */
export type SlotOwner = Exclude<ItemCopyWhere, { kind: 'location' }>;

/** The key an owner's trait pick sits under: the empty string for the played Persona, else the entity id. */
export const slotOwnerKey = (owner: SlotOwner): string => (owner.kind === 'you' ? '' : owner.id);

/** A Body's name as the editor shows it. */
export const bodyLabel = (body: Body): string => body.name || 'Unnamed Body';

export const entryCapacity = (entry: BodyEntry): number => entry.capacity ?? 1;

/** The Body a pick names: the Default when absent or when its Body is gone (Q33), none for None. */
const bodyOfPick = (bodies: readonly Body[], pick: BodyPick | undefined): Body | undefined => {
  if (pick?.kind === 'none') return undefined;
  return (pick && bodies.find((body) => body.id === pick.id)) ?? bodies[0];
};

/**
 * The Body in force for an owner: its winning trait's pick first (Q13), then the base a script wrote (Q14).
 * Otherwise an entity reads its own pick; one the world lacks, such as a library or AI-introduced character,
 * takes the Default. The played Persona reads
 * a world persona's own pick, and under None or a library persona the Custom Persona entity's (Q9, Q31).
 * Undefined = no slots.
 */
export function bodyInForce(world: BodyWorld, owner: SlotOwner, persona: PersonaRef | undefined): Body | undefined {
  const bodies = world.bodies ?? [];
  if (!bodies.length) return undefined;
  const forced = world.traitPicks?.[slotOwnerKey(owner)] ?? world.basePicks?.[slotOwnerKey(owner)];
  if (forced) return bodyOfPick(bodies, forced);
  const entities = world.entities ?? [];
  const entity = owner.kind === 'entity' ? entities.find((e) => e.id === owner.id)
    : persona?.source === 'world' ? entities.find((e) => e.id === persona.entityId)
      : entities.find((e) => e.customPersona);
  return bodyOfPick(bodies, entity?.body);
}

/** The Body's slots in entry order. An entry whose slot is gone is skipped. */
export function bodySlots(body: Body | undefined, slots: readonly Slot[]): BodySlot[] {
  if (!body) return [];
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  return body.entries.flatMap((entry) => {
    const slot = byId.get(entry.slotId);
    return slot ? [{ slot, capacity: entryCapacity(entry) }] : [];
  });
}

/** The slots of the owner's Body in force, in entry order. */
export const slotsInForce = (world: BodyWorld & { slots?: readonly Slot[] }, owner: SlotOwner, persona: PersonaRef | undefined): BodySlot[] =>
  bodySlots(bodyInForce(world, owner, persona), world.slots ?? []);

/** Every Body of the world with its slots by name, as a script's `body` reads them. */
export const bodyDefsOf = (world: BodyWorld & { slots?: readonly Slot[] }): { id: string; name: string; slots: { name: string; capacity: number }[] }[] =>
  (world.bodies ?? []).map((body) => ({
    id: body.id, name: body.name, slots: bodySlots(body, world.slots ?? []).map(({ slot, capacity }) => ({ name: slot.name, capacity })),
  }));

/** The owner's Body in force as a script reads it: its id (null = none), and whether a trait forces it so a script's write waits (Q14). */
export function bodyReadingOf(world: BodyWorld, owner: SlotOwner, persona: PersonaRef | undefined): { id: string | null; locked: boolean } {
  return { id: bodyInForce(world, owner, persona)?.id ?? null, locked: !!world.traitPicks?.[slotOwnerKey(owner)] };
}

/** Why the owner's authored Body refuses a starting equip: no Body, no such slot, or too little room. */
export type StartingEquipGap =
  | { kind: 'noBody' }
  | { kind: 'noSlot'; body: Body }
  | { kind: 'tooSmall'; body: Body; capacity: number };

/** The editor's read of a starting equip into `slotId` taking `size` (Q2, Q18), or null when it fits. The played
 *  Persona reads the Custom Persona entity's pick. */
export function startingEquipGap(world: BodyWorld, owner: SlotOwner, slotId: string, size: number): StartingEquipGap | null {
  const body = bodyInForce(world, owner, undefined);
  if (!body) return { kind: 'noBody' };
  const entry = body.entries.find((e) => e.slotId === slotId);
  if (!entry) return { kind: 'noSlot', body };
  const capacity = entryCapacity(entry);
  return size > capacity ? { kind: 'tooSmall', body, capacity } : null;
}

/** The entities whose Body picks play reads: the cast, plus the persona entities the cast leaves out. */
export const bodyPickEntities = <E>(cast: readonly E[], worldPersonas: readonly E[], customPersona: E | null): E[] =>
  [...cast, ...worldPersonas, ...(customPersona ? [customPersona] : [])];

/** The largest capacity any Body gives the slot: the bound on an item's Slot Size. 1 when no Body holds it. */
export const largestCapacity = (bodies: readonly Body[], slotId: string): number =>
  Math.max(1, ...bodies.flatMap((body) => body.entries.filter((e) => e.slotId === slotId).map(entryCapacity)));

/** `bodies` without their entries for the slot. */
export function withoutSlotEntries(bodies: Body[], slotId: string): Body[] {
  if (!bodies.some((body) => body.entries.some((e) => e.slotId === slotId))) return bodies;
  return bodies.map((body) => ({ ...body, entries: body.entries.filter((e) => e.slotId !== slotId) }));
}

/** How many Body entries hold the slot. */
export const slotEntryCount = (bodies: readonly Body[], slotId: string): number =>
  bodies.reduce((n, body) => n + body.entries.filter((e) => e.slotId === slotId).length, 0);

/** `items` with each Slot Size cut to the largest capacity `bodies` give its slot (Q44). */
export function withSlotSizesWithin<I extends { slotId?: string; slotSize?: number }>(items: I[], bodies: readonly Body[]): I[] {
  const over = (item: I) => !!item.slotId && (item.slotSize ?? 1) > largestCapacity(bodies, item.slotId);
  if (!items.some(over)) return items;
  return items.map((item) => {
    if (!over(item) || !item.slotId) return item;
    const size = largestCapacity(bodies, item.slotId);
    const { slotSize: _drop, ...rest } = item;
    return (size === 1 ? rest : { ...item, slotSize: size }) as I;
  });
}

/** Whether the entity picks the Body by id. */
export const picksBody = (entity: { body?: BodyPick }, bodyId: string): boolean =>
  entity.body?.kind === 'body' && entity.body.id === bodyId;

/** `entities` with picks of the Body set back to Default. */
export function withoutBodyPicks<E extends { body?: BodyPick }>(entities: E[], bodyId: string): E[] {
  if (!entities.some((e) => picksBody(e, bodyId))) return entities;
  return entities.map((entity) => {
    if (!picksBody(entity, bodyId)) return entity;
    const { body: _drop, ...rest } = entity;
    return rest as E;
  });
}

/** The confirm line for deleting a slot: the Body entries it deletes and the items it leaves without a slot. */
export const slotUsedBy = (items: readonly Item[], bodies: readonly Body[], slotId: string): string | null => usedByText([
  { count: slotEntryCount(bodies, slotId), one: 'Body entry', many: 'Body entries' },
  { count: itemsInSlot(items, slotId), one: 'item', many: 'items', clause: (n) => `clears the slot on ${n}` },
]);

type BodyRowTrait = { body?: TraitBodyRow };
type BodyPicker = { body?: BodyPick; traits?: readonly BodyRowTrait[] };

/** Whether the trait's Body row picks the Body by id. */
const rowPicksBody = (trait: BodyRowTrait, bodyId: string): boolean =>
  trait.body?.pick?.kind === 'body' && trait.body.pick.id === bodyId;

/** The trait Body rows that pick the Body: the world's traits plus the ones entities own. */
export const bodyRowCount = (traits: readonly BodyRowTrait[], entities: readonly BodyPicker[], bodyId: string): number =>
  [...traits, ...entities.flatMap((e) => e.traits ?? [])].filter((t) => rowPicksBody(t, bodyId)).length;

/** `traits` with their Body rows for the Body blanked. */
export function withoutBodyRows<T extends BodyRowTrait>(traits: T[], bodyId: string): T[] {
  if (!traits.some((t) => rowPicksBody(t, bodyId))) return traits;
  return traits.map((t) => (rowPicksBody(t, bodyId) ? { ...t, body: {} } : t));
}

/** `entities` with their picks of the Body back to Default and their own traits' rows for it blanked. */
export function withoutEntityBodyRefs<E extends { body?: BodyPick; traits?: Trait[] }>(entities: E[], bodyId: string): E[] {
  const picked = withoutBodyPicks(entities, bodyId);
  if (!picked.some((e) => e.traits?.some((t) => rowPicksBody(t, bodyId)))) return picked;
  return picked.map((e) => (e.traits ? { ...e, traits: withoutBodyRows(e.traits, bodyId) } : e));
}

/** The confirm line for deleting a Body: the picks that go back to Default and the trait Body rows it blanks. */
export const bodyUsedBy = (entities: readonly BodyPicker[], traits: readonly BodyRowTrait[], bodyId: string): string | null => usedByText([
  { count: entities.filter((e) => picksBody(e, bodyId)).length, one: 'pick', many: 'picks', clause: (n) => `resets ${n} to Default` },
  { count: bodyRowCount(traits, entities, bodyId), one: 'trait Body row', many: 'trait Body rows', clause: (n) => `clears ${n}` },
]);

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

/** A world file's Bodies. Records without an id, and entries without a slot, are dropped. */
export const parseBodies = (raw: unknown): Body[] => (Array.isArray(raw) ? raw : [])
  .filter((value): value is Body => isRecord(value) && typeof value.id === 'string')
  .map((body) => ({
    ...body,
    name: typeof body.name === 'string' ? body.name : '',
    entries: (Array.isArray(body.entries) ? body.entries : []).filter((e): e is BodyEntry => isRecord(e) && typeof e.slotId === 'string'),
  }));

/** The active traits as one settle reads them: global ones, and each entity owner's in its tree order. */
export interface BodyTraitScope {
  global: readonly Trait[];
  owners: Readonly<Record<string, readonly Trait[]>>;
}

const setsBody = (trait: Trait | undefined): boolean => !!trait?.body?.pick;
const sameOn = (a: BodyTraitOn, b: BodyTraitOn): boolean => a.ownerId === b.ownerId && a.traitId === b.traitId;

/** `previous` without the Body-setting traits no longer active, then the newly active ones in tree order, so
 *  the latest switch-on comes last (Q13, Q40). The same array when nothing moved. */
export function nextTraitsOn(previous: readonly BodyTraitOn[], scope: BodyTraitScope): readonly BodyTraitOn[] {
  const active: BodyTraitOn[] = [
    ...scope.global.filter(setsBody).map((t) => ({ ownerId: null, traitId: t.id })),
    ...Object.entries(scope.owners).flatMap(([ownerId, traits]) => traits.filter(setsBody).map((t) => ({ ownerId, traitId: t.id }))),
  ];
  const kept = previous.filter((on) => active.some((a) => sameOn(a, on)));
  const added = active.filter((a) => !kept.some((on) => sameOn(on, a)));
  return kept.length === previous.length && !added.length ? previous : [...kept, ...added];
}

/** Each owner's winning trait Body pick: the last of `traitsOn` it holds whose row picks a Body. Global traits and
 *  a played entity's own traits set the played Persona's (Q24). */
export function traitBodyPicks(
  traitsOn: readonly BodyTraitOn[], traitOf: (on: BodyTraitOn) => Trait | undefined, played: readonly string[],
): TraitBodyPicks {
  const picks: Record<string, BodyPick> = {};
  for (const on of traitsOn) {
    const pick = traitOf(on)?.body?.pick;
    if (!pick) continue;
    picks[on.ownerId === null || played.includes(on.ownerId) ? '' : on.ownerId] = pick;
  }
  return picks;
}

/** The equipped Item Copies the owners' Bodies in force no longer hold: every copy in a slot its Body lacks, and
 *  the most recently equipped first where a slot's capacity dropped (Q12). */
export function bodyMisfits(
  copies: readonly ItemCopy[], world: BodyWorld & { slots?: readonly Slot[]; items: readonly Item[] }, persona: PersonaRef | undefined,
): ItemCopy[] {
  const items = new Map(world.items.map((item) => [item.id, item]));
  const sizeOf = (copy: ItemCopy) => slotSizeOf(copy.item.kind === 'item' ? items.get(copy.item.itemId) : undefined);
  const groups = new Map<string, ItemCopy[]>();
  for (const copy of copies) {
    if (!copy.equipped || copy.where.kind === 'location') continue;
    const key = `${slotOwnerKey(copy.where)}|${copy.equipped.slotId}`;
    groups.set(key, [...(groups.get(key) ?? []), copy]);
  }
  return [...groups.values()].flatMap((worn) => {
    const [first] = worn;
    if (!first.equipped || first.where.kind === 'location') return [];
    const { slotId } = first.equipped;
    const capacity = slotsInForce(world, first.where, persona).find((s) => s.slot.id === slotId)?.capacity ?? 0;
    const newestFirst = [...worn].sort((a, b) => (b.equipped?.order ?? 0) - (a.equipped?.order ?? 0));
    let used = worn.reduce((sum, copy) => sum + sizeOf(copy), 0);
    const out: ItemCopy[] = [];
    for (const copy of newestFirst) {
      if (used <= capacity) break;
      out.push(copy);
      used -= sizeOf(copy);
    }
    return out;
  });
}
