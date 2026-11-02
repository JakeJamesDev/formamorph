import { describe, expect, it } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import {
  bodyInForce, bodyPickEntities, bodySlots, parseBodies, slotEntryCount, slotsInForce, withoutBodyPicks,
  withoutSlotEntries, type BodyWorld,
} from './bodies';
import type { Body, Slot } from '@/types';

const humanoid: Body = bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'head' }, { slotId: 'hand', capacity: 2 }] });
const dog: Body = bodyFixture({ id: 'dog', name: 'Dog', entries: [{ slotId: 'collar' }] });
const slots: Slot[] = [{ id: 'hand', name: 'Hand' }, { id: 'head', name: 'Head' }, { id: 'collar', name: 'Collar' }];

const world = (entities: BodyWorld['entities'] = [], bodies: Body[] = [humanoid, dog]): BodyWorld => ({ bodies, entities });
const at = (id: string) => ({ kind: 'entity', id }) as const;
const you = { kind: 'you' } as const;

describe('bodyInForce', () => {
  it('gives an entity its picked Body', () => {
    expect(bodyInForce(world([{ id: 'rex', body: { kind: 'body', id: 'dog' } }]), at('rex'), undefined)).toBe(dog);
  });

  it('gives the Default, the first Body, to an entity with no pick', () => {
    expect(bodyInForce(world([{ id: 'ilsa' }]), at('ilsa'), undefined)).toBe(humanoid);
    expect(bodyInForce(world([{ id: 'ilsa' }], [dog, humanoid]), at('ilsa'), undefined)).toBe(dog);
  });

  it('gives no Body for None, or in a world with no Bodies', () => {
    expect(bodyInForce(world([{ id: 'ghost', body: { kind: 'none' } }]), at('ghost'), undefined)).toBeUndefined();
    expect(bodyInForce(world([{ id: 'ilsa', body: { kind: 'body', id: 'dog' } }], []), at('ilsa'), undefined)).toBeUndefined();
  });

  it('gives the Default for a pick whose Body is gone', () => {
    expect(bodyInForce(world([{ id: 'ilsa', body: { kind: 'body', id: 'wolf' } }]), at('ilsa'), undefined)).toBe(humanoid);
  });

  it('gives the Default to a character the world lacks, such as a library or AI-introduced one', () => {
    expect(bodyInForce(world([]), at('stranger'), undefined)).toBe(humanoid);
  });

  describe('the played Persona', () => {
    const custom = { id: 'me', customPersona: true, body: { kind: 'body', id: 'dog' } } as const;
    const knight = { id: 'knight', body: { kind: 'none' } } as const;
    const entities = [custom, knight];

    it('reads the Custom Persona entity under None', () => {
      expect(bodyInForce(world(entities), you, { source: 'none' })).toBe(dog);
      expect(bodyInForce(world(entities), you, undefined)).toBe(dog);
    });

    it('reads the Custom Persona entity under a library persona', () => {
      expect(bodyInForce(world(entities), you, { source: 'library', entityId: 'lib-1' })).toBe(dog);
    });

    it('reads a world persona its own pick', () => {
      expect(bodyInForce(world(entities), you, { source: 'world', entityId: 'knight' })).toBeUndefined();
    });

    it('takes the Default with no Custom Persona entity', () => {
      expect(bodyInForce(world([knight]), you, { source: 'library', entityId: 'lib-1' })).toBe(humanoid);
    });
  });
});

describe('bodySlots', () => {
  it('lists the Body slots in entry order with their capacity, skipping a slot that is gone', () => {
    const body: Body = bodyFixture({ ...humanoid, entries: [...humanoid.entries, { slotId: 'tail' }] });
    expect(bodySlots(body, slots).map((s) => [s.slot.name, s.capacity])).toEqual([['Head', 1], ['Hand', 2]]);
  });

  it('lists nothing without a Body', () => {
    expect(bodySlots(undefined, slots)).toEqual([]);
  });
});

describe('slotsInForce', () => {
  it("lists the slots of the owner's Body in force", () => {
    const picks = { ...world([{ id: 'rex', body: { kind: 'body', id: 'dog' } }]), slots };
    expect(slotsInForce(picks, at('rex'), undefined).map((s) => s.slot.name)).toEqual(['Collar']);
    expect(slotsInForce(picks, at('ilsa'), undefined).map((s) => s.slot.name)).toEqual(['Head', 'Hand']);
  });
});

describe('bodyPickEntities', () => {
  it('adds the persona entities the cast leaves out', () => {
    expect(bodyPickEntities(['cast'], ['knight'], 'me')).toEqual(['cast', 'knight', 'me']);
    expect(bodyPickEntities(['cast'], [], null)).toEqual(['cast']);
  });
});

describe('withoutSlotEntries', () => {
  it('drops the slot from every Body and keeps the list when no Body holds it', () => {
    expect(withoutSlotEntries([humanoid, dog], 'hand').map((b) => b.entries.map((e) => e.slotId))).toEqual([['head'], ['collar']]);
    const bodies = [humanoid, dog];
    expect(withoutSlotEntries(bodies, 'tail')).toBe(bodies);
  });
});

describe('parseBodies', () => {
  it('drops records without an id and entries without a slot', () => {
    expect(parseBodies([{ id: 'b', name: 'B', entries: [{ slotId: 's', capacity: 2 }, { capacity: 1 }] }, { name: 'no id' }, 'x']))
      .toEqual([bodyFixture({ id: 'b', name: 'B', entries: [{ slotId: 's', capacity: 2 }] })]);
    expect(parseBodies(undefined)).toEqual([]);
  });
});

describe('slotEntryCount', () => {
  it('counts the Body entries that hold the slot', () => {
    const imp: Body = bodyFixture({ id: 'imp', name: 'Imp', entries: [{ slotId: 'hand', capacity: 3 }] });
    expect(slotEntryCount([humanoid, imp, dog], 'hand')).toBe(2);
    expect(slotEntryCount([humanoid, dog], 'tail')).toBe(0);
  });
});

describe('withoutBodyPicks', () => {
  it('sets picks of the Body back to Default and leaves other picks alone', () => {
    const entities = [
      { id: 'rex', body: { kind: 'body' as const, id: 'dog' } },
      { id: 'ghost', body: { kind: 'none' as const } },
      { id: 'ann', body: { kind: 'body' as const, id: 'humanoid' } },
    ];
    expect(withoutBodyPicks(entities, 'dog')).toEqual([{ id: 'rex' }, entities[1], entities[2]]);
    expect(withoutBodyPicks(entities, 'imp')).toBe(entities);
  });
});
