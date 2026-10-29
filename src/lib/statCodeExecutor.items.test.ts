/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxEntity, type SandboxItem, type StatCodeRunOptions } from './statCodeExecutor';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const places: NonNullable<StatCodeRunOptions['places']> = {
  locations: [{ id: 'loc-vault', name: 'Vault' }, { id: 'loc-gate', name: 'Gate' }],
  location: { id: 'loc-vault', name: 'Vault' },
};

const keeper: SandboxEntity = { id: 'e-keeper', name: 'Keeper', traits: [] };
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [] };

const key: SandboxItem = {
  id: 'i-key', name: 'Brass Key', copies: [
    { id: 'c-1', where: { kind: 'you' }, quantity: 1, equipped: false, slot: '', hidden: false },
    { id: 'c-2', where: { kind: 'location', id: 'loc-vault' }, quantity: 2, equipped: false, slot: '', hidden: true },
  ],
};
const wand: SandboxItem = {
  id: 'i-wand', name: 'Wand', copies: [
    { id: 'c-3', where: { kind: 'entity', id: 'e-keeper' }, quantity: 1, equipped: true, slot: 'Hand', hidden: false, charges: 1 },
  ],
};

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, { places, entities: [keeper, hero], persona: hero, items: [key, wand], ...over });

describe('executeStatCode items', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads who owns each Item Copy and where it lies', async () => {
    const res = await run(`
      const [mine, lying] = items["Brass Key"].copies;
      if (mine.owner !== 'Hero' || mine.location !== '') throw new Error('owner ' + mine.owner);
      if (lying.owner !== '' || lying.location !== 'Vault' || !lying.hidden || lying.quantity !== 2) throw new Error('lying');
      const wand = items.Wand.copies[0];
      if (wand.owner !== 'Keeper' || !wand.equipped || wand.slot !== 'Hand' || wand.charges !== 1) throw new Error('wand');
      if (mine.charges !== null) throw new Error('charges');
    `);
    expect(res.error).toBeNull();
  });

  it('lists the copies at an entity, the persona and a location', async () => {
    const res = await run(`
      if (entities.Keeper.items.map((c) => c.id).join() !== 'c-3') throw new Error('keeper');
      if (persona.items.map((c) => c.id).join() !== 'c-1') throw new Error('persona');
      if (location.items.map((c) => c.id).join() !== 'c-2') throw new Error('here');
      if (locations.Gate.items.length !== 0) throw new Error('gate');
      if (persona.items[0] !== items["Brass Key"].copies[0]) throw new Error('one entry per copy');
    `);
    expect(res.error).toBeNull();
  });

  it('records each verb as an inventory write in call order', async () => {
    const res = await run(`
      items.Wand.give(entities.Keeper, 2);
      items["Brass Key"].give("Gate");
      items["Brass Key"].give(persona);
      const [mine, lying] = items["Brass Key"].copies;
      lying.moveTo(persona, 1);
      mine.lose();
      lying.reveal(1);
      const wand = items.Wand.copies[0];
      wand.unequip(); wand.equip(); wand.consume(); wand.setCharges(3);
    `);
    expect(res.error).toBeNull();
    expect(res.worldWrites?.inventory).toEqual([
      { kind: 'gain', itemId: 'i-wand', to: { kind: 'entity', id: 'e-keeper' }, quantity: 2 },
      { kind: 'gain', itemId: 'i-key', to: { kind: 'location', id: 'loc-gate' }, quantity: 1 },
      { kind: 'gain', itemId: 'i-key', to: { kind: 'you' }, quantity: 1 },
      { kind: 'transfer', copyId: 'c-2', to: { kind: 'you' }, quantity: 1 },
      { kind: 'lose', copyId: 'c-1' },
      { kind: 'reveal', copyId: 'c-2', quantity: 1 },
      { kind: 'unequip', copyId: 'c-3' },
      { kind: 'equip', copyId: 'c-3' },
      { kind: 'consume', copyId: 'c-3' },
      { kind: 'setCharges', copyId: 'c-3', charges: 3 },
    ]);
  });

  it('fails the script on a target the game lacks and drops its writes', async () => {
    const res = await run('items.Wand.give(entities.Keeper); items.Wand.give("Moon");');
    expect(res.error).toMatch(/needs an entity, the persona or a location the game has, not "Moon"/);
    expect(res.worldWrites).toBeUndefined();
  });

  it('lists a write to an Item Copy field as read-only', async () => {
    const res = await run('items.Wand.copies[0].quantity = 9;');
    expect(res.readOnlyWrites).toEqual(['items.Wand.copies[0].quantity']);
  });

  it('gives an item script its item as self, with the event', async () => {
    const res = await run(`
      if (self.name !== 'Wand' || self.event.timing !== 'equipped' || self.event.quantity !== 1) throw new Error('self');
      if (self.event.copy.id !== 'c-3') throw new Error('copy');
      self.give(owner);
    `, { owner: keeper, itemEvent: { itemId: 'i-wand', timing: 'equipped', copyId: 'c-3', quantity: 1 } });
    expect(res.error).toBeNull();
    expect(res.worldWrites?.inventory).toEqual([{ kind: 'gain', itemId: 'i-wand', to: { kind: 'entity', id: 'e-keeper' }, quantity: 1 }]);
  });

  it('reads an event copy that is gone as null', async () => {
    const res = await run('if (self.event.copy !== null) throw new Error("copy");',
      { itemEvent: { itemId: 'i-wand', timing: 'lost', copyId: 'gone', quantity: 1 } });
    expect(res.error).toBeNull();
  });

  it('reads a gone event copy as it stood before the event, listed at no owner', async () => {
    const was = { id: 'gone', where: { kind: 'you' as const }, quantity: 2, equipped: false, slot: '', hidden: false, charges: 1 };
    const res = await run(`
      const copy = self.event.copy;
      if (copy.id !== 'gone' || copy.quantity !== 2 || copy.owner !== 'Hero' || copy.charges !== 1) throw new Error('copy');
      if (persona.items.some((c) => c.id === 'gone')) throw new Error('listed');
    `, { itemEvent: { itemId: 'i-wand', timing: 'lost', copyId: 'gone', quantity: 2, was } });
    expect(res.error).toBeNull();
  });

  it('reads items through a read-only run without its verbs', async () => {
    const res = await run('return typeof items.Wand.give + "/" + items.Wand.copies[0].owner;', { readOnly: true, args: {} });
    expect(res.error).toBeNull();
    expect(res.reply).toBe('undefined/Keeper');
  });
});
