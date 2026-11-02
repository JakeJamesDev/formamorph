/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode, type SandboxBodyDef, type SandboxEntity, type SandboxItem, type StatCodeRunOptions } from './statCodeExecutor';
import type { Stat } from '@/types';

const health: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [],
};

const defs: SandboxBodyDef[] = [
  { id: 'b-human', name: 'Humanoid', slots: [{ name: 'Hand', capacity: 2 }, { name: 'Head', capacity: 1 }] },
  { id: 'b-wolf', name: 'Wolf', slots: [{ name: 'Collar', capacity: 1 }] },
];

const keeper: SandboxEntity = { id: 'e-keeper', name: 'Keeper', traits: [], body: { id: 'b-human', locked: false } };
const rex: SandboxEntity = { id: 'e-rex', name: 'Rex', traits: [], body: { id: 'b-wolf', locked: true } };
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [], body: { id: 'b-human', locked: false } };

const sword: SandboxItem = {
  id: 'i-sword', name: 'Sword', copies: [
    { id: 'c-1', where: { kind: 'entity', id: 'e-keeper' }, quantity: 1, equipped: true, slot: 'Hand', occupies: ['Hand'], allowed: [], hidden: false },
    { id: 'c-2', where: { kind: 'entity', id: 'e-keeper' }, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false },
    { id: 'c-3', where: { kind: 'you' }, quantity: 1, equipped: true, slot: 'Head', occupies: ['Head'], allowed: [], hidden: false },
  ],
};

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, {
    entities: [keeper, rex, hero], persona: hero, items: [sword], bodies: defs, ...over,
  });

describe('executeStatCode body', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads the Body in force with each slot, its capacity and the copies equipped in it', async () => {
    const res = await run(`
      const body = entities.Keeper.body;
      if (body.name !== 'Humanoid') throw new Error('name ' + body.name);
      if (body.slots.map((s) => s.name + s.capacity).join() !== 'Hand2,Head1') throw new Error('slots');
      if (body.slots[0].items.map((c) => c.id).join() !== 'c-1' || body.slots[1].items.length !== 0) throw new Error('items');
      if (persona.body.slots[1].items.map((c) => c.id).join() !== 'c-3') throw new Error('persona');
      if (entities.Keeper.body !== body) throw new Error('one view per read');
    `);
    expect(res.error).toBeNull();
  });

  it('reads null for an owner with no Body', async () => {
    const res = await run(`if (entities.Keeper.body !== null) throw new Error('not null');`, {
      entities: [{ ...keeper, body: { id: null, locked: false } }, rex, hero],
    });
    expect(res.error).toBeNull();
    const bare = await run(`if (entities.Keeper.body !== null) throw new Error('not null');`, { entities: [{ ...keeper, body: undefined }, rex, hero] });
    expect(bare.error).toBeNull();
  });

  it('lists an assignment as a base Body write and reads the new Body back in the run', async () => {
    const res = await run(`
      entities.Keeper.body = "Wolf";
      if (entities.Keeper.body.name !== 'Wolf') throw new Error('read back');
      persona.body = "Wolf";
      persona.body = null;
    `);
    expect(res.error).toBeNull();
    expect(res.worldWrites?.bodies).toEqual([
      { owner: 'e-keeper', pick: { kind: 'body', id: 'b-wolf' } },
      { owner: '', pick: { kind: 'body', id: 'b-wolf' } },
      { owner: '', pick: { kind: 'none' } },
    ]);
  });

  it('keeps the trait Body in the read while a write sets the base underneath', async () => {
    const res = await run(`
      entities.Rex.body = "Humanoid";
      if (entities.Rex.body.name !== 'Wolf') throw new Error('trait must win ' + entities.Rex.body.name);
    `);
    expect(res.error).toBeNull();
    expect(res.worldWrites?.bodies).toEqual([{ owner: 'e-rex', pick: { kind: 'body', id: 'b-human' } }]);
  });

  it('fails the script on a name the world has no Body for, and writes nothing', async () => {
    const res = await run(`entities.Keeper.body = "Dragon";`);
    expect(res.error).toContain('The world has no Body named "Dragon"');
    expect(res.worldWrites).toBeUndefined();
    const noBodies = await run(`persona.body = "Wolf";`, { bodies: [] });
    expect(noBodies.error).toContain('The world has no Body named "Wolf"');
  });

  it("writes through `owner` to the running script's entity, and fails for a script with no owner", async () => {
    const res = await run(`owner.body = "Wolf";`, { owner: keeper });
    expect(res.error).toBeNull();
    expect(res.worldWrites?.bodies).toEqual([{ owner: 'e-keeper', pick: { kind: 'body', id: 'b-wolf' } }]);
    const none = await run(`owner.body = "Wolf";`);
    expect(none.error).toContain('The game has no entity named');
  });

  it('fails on an unknown entity entry', async () => {
    const res = await run(`entities.Ghost.body = "Wolf";`);
    expect(res.error).toContain('The game has no entity named "Ghost"');
  });
});
