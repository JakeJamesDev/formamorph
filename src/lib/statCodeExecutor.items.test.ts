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
  id: 'i-key', name: 'Brass Key', instances: [
    { id: 'c-1', where: { kind: 'you' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false },
    { id: 'c-2', where: { kind: 'location', id: 'loc-vault' }, quantity: 2, equipped: false, slot: '', occupies: [], allowed: [], hidden: true },
  ],
};
const wand: SandboxItem = {
  id: 'i-wand', name: 'Wand', instances: [
    { id: 'c-3', where: { kind: 'entity', id: 'e-keeper' }, quantity: 1, equipped: true, slot: 'Hand', occupies: ['Hand'], allowed: [], hidden: false, uses: 1, state: 'charged' },
  ],
};

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, { places, entities: [keeper, hero], persona: hero, items: [key, wand], ...over });

describe('executeStatCode items', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads who owns each Item Instance and where it lies', async () => {
    const res = await run(`
      const [mine, lying] = items["Brass Key"].instances;
      if (mine.owner !== 'Hero' || mine.location !== '') throw new Error('owner ' + mine.owner);
      if (lying.owner !== '' || lying.location !== 'Vault' || !lying.hidden || lying.quantity !== 2) throw new Error('lying');
      const wand = items.Wand.instances[0];
      if (wand.owner !== 'Keeper' || !wand.equipped || wand.slot !== 'Hand' || wand.uses !== 1) throw new Error('wand');
      if (mine.uses !== null) throw new Error('uses');
      if (wand.state !== 'charged' || mine.state !== null) throw new Error('state');
    `);
    expect(res.error).toBeNull();
  });

  it('lists the instances at an entity, the persona and a location', async () => {
    const res = await run(`
      if (entities.Keeper.items.map((c) => c.id).join() !== 'c-3') throw new Error('keeper');
      if (persona.items.map((c) => c.id).join() !== 'c-1') throw new Error('persona');
      if (location.items.map((c) => c.id).join() !== 'c-2') throw new Error('here');
      if (locations.Gate.items.length !== 0) throw new Error('gate');
      if (persona.items[0] !== items["Brass Key"].instances[0]) throw new Error('one entry per copy');
    `);
    expect(res.error).toBeNull();
  });

  it('records each verb as an inventory write in call order', async () => {
    const res = await run(`
      items.Wand.give(entities.Keeper, 2);
      items["Brass Key"].give("Gate");
      items["Brass Key"].give(persona);
      const [mine, lying] = items["Brass Key"].instances;
      lying.moveTo(persona, 1);
      mine.lose();
      lying.reveal(1);
      const wand = items.Wand.instances[0];
      wand.unequip(); wand.equip(); wand.use(); wand.setUses(3); wand.setState('spent'); wand.setState('');
    `);
    expect(res.error).toBeNull();
    expect(res.worldWrites?.inventory).toEqual([
      { kind: 'gain', itemId: 'i-wand', to: { kind: 'entity', id: 'e-keeper' }, quantity: 2 },
      { kind: 'gain', itemId: 'i-key', to: { kind: 'location', id: 'loc-gate' }, quantity: 1 },
      { kind: 'gain', itemId: 'i-key', to: { kind: 'you' }, quantity: 1 },
      { kind: 'transfer', instanceId: 'c-2', to: { kind: 'you' }, quantity: 1 },
      { kind: 'lose', instanceId: 'c-1' },
      { kind: 'reveal', instanceId: 'c-2', quantity: 1 },
      { kind: 'unequip', instanceId: 'c-3' },
      { kind: 'equip', instanceId: 'c-3' },
      { kind: 'use', instanceId: 'c-3' },
      { kind: 'setUses', instanceId: 'c-3', uses: 3 },
      { kind: 'change', instanceId: 'c-3', state: 'spent' },
      { kind: 'change', instanceId: 'c-3', state: '' },
    ]);
  });

  it('fails the script on a target the game lacks and drops its writes', async () => {
    const res = await run('items.Wand.give(entities.Keeper); items.Wand.give("Moon");');
    expect(res.error).toMatch(/needs an entity, the persona or a location the game has, not "Moon"/);
    expect(res.worldWrites).toBeUndefined();
  });

  it('fails the script on a setState that is not a string', async () => {
    const res = await run('items.Wand.instances[0].setState(3);');
    expect(res.error).toMatch(/setState needs a string/);
    expect(res.worldWrites).toBeUndefined();
  });

  it('reads both faces of an item and the unidentified flag, and records reveal() as the validator op (Q19)', async () => {
    const ring: SandboxItem = {
      id: 'i-ring', name: 'Ring of Curses', unidentifiedName: 'Plain Ring', unidentifiedDescription: 'A dull band.',
      instances: [{ id: 'c-9', where: { kind: 'you' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false, unidentified: true }],
    };
    const res = await run(`
      const ring = items["Ring of Curses"];
      if (ring.unidentifiedName !== 'Plain Ring' || ring.unidentifiedDescription !== 'A dull band.') throw new Error('faces');
      if (items["Brass Key"].unidentifiedName !== '') throw new Error('blank face');
      if (ring.instances[0].unidentified !== true || items["Brass Key"].instances[0].unidentified !== false) throw new Error('flag');
      ring.instances[0].reveal();
    `, { items: [key, wand, ring] });
    expect(res.error).toBeNull();
    expect(res.worldWrites?.inventory).toEqual([{ kind: 'reveal', instanceId: 'c-9' }]);
  });

  it('lists a write to an Item Instance field as read-only', async () => {
    const res = await run('items.Wand.instances[0].quantity = 9;');
    expect(res.readOnlyWrites).toEqual(['items.Wand.instances[0].quantity']);
  });

  it('gives an item script its item as self, its Item Instance as instance and its side fields as args', async () => {
    const res = await run(`
      if (self.name !== 'Wand' || self.event !== undefined) throw new Error('self');
      if (instance !== items.Wand.instances[0] || args.quantity !== 1) throw new Error('event');
      self.give(owner);
    `, { owner: keeper, itemEvent: { itemId: 'i-wand', timing: 'equipped', instanceId: 'c-3', args: { quantity: 1 } } });
    expect(res.error).toBeNull();
    expect(res.worldWrites?.inventory).toEqual([{ kind: 'gain', itemId: 'i-wand', to: { kind: 'entity', id: 'e-keeper' }, quantity: 1 }]);
  });

  it('reads an event Item Instance that is gone as null', async () => {
    const res = await run('if (instance !== null) throw new Error("instance");',
      { itemEvent: { itemId: 'i-wand', timing: 'lost', instanceId: 'gone', args: { quantity: 1 } } });
    expect(res.error).toBeNull();
  });

  it('reads a gone event Item Instance as it stood before the event, listed at no owner', async () => {
    const was = { id: 'gone', where: { kind: 'you' as const }, quantity: 2, equipped: false, slot: '', occupies: [], allowed: [], hidden: false, uses: 1 };
    const res = await run(`
      if (instance.id !== 'gone' || instance.quantity !== 2 || instance.owner !== 'Hero' || instance.uses !== 1) throw new Error('instance');
      if (persona.items.some((c) => c.id === 'gone')) throw new Error('listed');
    `, { itemEvent: { itemId: 'i-wand', timing: 'lost', instanceId: 'gone', args: { quantity: 2 }, was } });
    expect(res.error).toBeNull();
  });

  it('lists only the fields its timing reads, in a frozen args', async () => {
    const event = { itemId: 'i-wand', instanceId: 'c-3', args: { quantity: 2, by: 'story' as const, from: null, to: null, purchase: null, target: 'c-1' } };
    const at = (timing: 'gained' | 'lost' | 'used', keys: string) => run(`
      args.quantity = 9;
      if (!Object.isFrozen(args) || args.quantity !== 2) throw new Error('frozen');
      if (Object.keys(args).join() !== '${keys}') throw new Error(Object.keys(args).join());
    `, { itemEvent: { ...event, timing } });
    expect((await at('gained', 'by,from,purchase,quantity')).error).toBeNull();
    expect((await at('lost', 'by,to,purchase,quantity')).error).toBeNull();
    const used = await run(`if (args.target !== items["Brass Key"].instances[0] || 'from' in args) throw new Error('target');`,
      { itemEvent: { ...event, timing: 'used' } });
    expect(used.error).toBeNull();
  });

  it('reads a use target that is gone as null', async () => {
    const res = await run('if (args.target !== null) throw new Error("target");',
      { itemEvent: { itemId: 'i-wand', timing: 'used', instanceId: 'c-3', args: { quantity: 1, target: 'gone' } } });
    expect(res.error).toBeNull();
  });

  it('gives a run with no trigger a frozen empty args and no instance', async () => {
    const res = await run(`
      if (!Object.isFrozen(args) || Object.keys(args).length || typeof instance !== 'undefined') throw new Error('args');
    `);
    expect(res.error).toBeNull();
  });

  it('reads items through a read-only run without its verbs', async () => {
    const res = await run('return typeof items.Wand.give + "/" + items.Wand.instances[0].owner;', { readOnly: true, args: {} });
    expect(res.error).toBeNull();
    expect(res.reply).toBe('undefined/Keeper');
  });
});
