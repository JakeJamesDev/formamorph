/**
 * Bodies: which slots each owner equips into, with each slot's capacity. `bodyInForce` is the one resolver
 * every slot reader takes.
 */
import { slotSizeOf } from '@/lib/items';
import type { Body, BodyEntry, BodyPick, BodyTraitOn, Item, ItemCopy, ItemCopyWhere, PersonaRef, Slot, Trait } from '@/types';

/** The authored slice the resolver reads. An absent slice reads as empty. */
export interface BodyWorld {
  bodies?: readonly Body[];
  entities?: readonly { id: string; name?: string; body?: BodyPick; customPersona?: boolean }[];
  /** Each owner's winning trait Body pick, by {@link slotOwnerKey}. Absent = none. */
  traitPicks?: TraitBodyPicks;
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

export const entryCapacity = (entry: BodyEntry): number => entry.capacity ?? 1;

/** The Body a pick names: the Default when absent or when its Body is gone (Q33), none for None. */
const bodyOfPick = (bodies: readonly Body[], pick: BodyPick | undefined): Body | undefined => {
  if (pick?.kind === 'none') return undefined;
  return (pick && bodies.find((body) => body.id === pick.id)) ?? bodies[0];
};

/**
 * The Body in force for an owner: its winning trait's pick first (Q13). Otherwise an entity reads its own pick;
 * one the world lacks, such as a library or AI-introduced character, takes the Default. The played Persona reads
 * a world persona's own pick, and under None or a library persona the Custom Persona entity's (Q9, Q31).
 * Undefined = no slots.
 */
export function bodyInForce(world: BodyWorld, owner: SlotOwner, persona: PersonaRef | undefined): Body | undefined {
  const bodies = world.bodies ?? [];
  if (!bodies.length) return undefined;
  const traitPick = world.traitPicks?.[slotOwnerKey(owner)];
  if (traitPick) return bodyOfPick(bodies, traitPick);
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
