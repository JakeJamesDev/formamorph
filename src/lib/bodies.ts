/**
 * Bodies: which slots each owner equips into, with each slot's capacity. `bodyInForce` is the one resolver
 * every slot reader takes.
 */
import type { Body, BodyEntry, BodyPick, ItemCopyWhere, PersonaRef, Slot } from '@/types';

/** The authored slice the resolver reads. An absent slice reads as empty. */
export interface BodyWorld {
  bodies?: readonly Body[];
  entities?: readonly { id: string; body?: BodyPick; customPersona?: boolean }[];
}

/** One slot of a Body, as the panel and the validator read it. */
export interface BodySlot {
  slot: Slot;
  capacity: number;
}

/** An owner that can equip: the played Persona or an entity. */
export type SlotOwner = Exclude<ItemCopyWhere, { kind: 'location' }>;

export const entryCapacity = (entry: BodyEntry): number => entry.capacity ?? 1;

/** The Body a pick names: the Default when absent or when its Body is gone (Q33), none for None. */
const bodyOfPick = (bodies: readonly Body[], pick: BodyPick | undefined): Body | undefined => {
  if (pick?.kind === 'none') return undefined;
  return (pick && bodies.find((body) => body.id === pick.id)) ?? bodies[0];
};

/**
 * The Body in force for an owner. An entity reads its own pick; one the world lacks, such as a library or
 * AI-introduced character, takes the Default. The played Persona reads a world persona's own pick, and under
 * None or a library persona the Custom Persona entity's (Q9, Q31). Undefined = no slots.
 */
export function bodyInForce(world: BodyWorld, owner: SlotOwner, persona: PersonaRef | undefined): Body | undefined {
  const bodies = world.bodies ?? [];
  if (!bodies.length) return undefined;
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
