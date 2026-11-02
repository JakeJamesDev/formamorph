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
const defs: SandboxBodyDef[] = [{ id: 'b-human', name: 'Humanoid', slots: [{ name: 'Main Hand', capacity: 1 }, { name: 'Off Hand', capacity: 1 }] }];
const hero: SandboxEntity = { id: 'e-hero', name: 'Hero', traits: [], body: { id: 'b-human', locked: false } };
const hands = [{ id: 'main', name: 'Main Hand' }, { id: 'off', name: 'Off Hand' }];
const base = { where: { kind: 'you' }, quantity: 1, hidden: false } as const;

const items: SandboxItem[] = [
  {
    id: 'i-dagger', name: 'Dagger', copies: [
      { ...base, id: 'c-dagger', equipped: true, slot: 'Off Hand', occupies: ['Off Hand'], allowed: hands },
      { ...base, id: 'c-spare', equipped: false, slot: '', occupies: [], allowed: hands },
    ],
  },
  { id: 'i-sword', name: 'Greatsword', copies: [{ ...base, id: 'c-sword', equipped: true, slot: 'Main Hand', occupies: ['Main Hand', 'Off Hand'], allowed: hands }] },
];

const run = (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  executeStatCode(code, [health], null, { entities: [hero], persona: hero, items, bodies: defs, ...over });

describe('executeStatCode slot names', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads the slot a copy sits in; an All of copy reads its first slot', async () => {
    const res = await run(`
      if (items.Dagger.copies[0].slot !== 'Off Hand') throw new Error('dagger');
      if (items.Greatsword.copies[0].slot !== 'Main Hand') throw new Error('sword');
    `);
    expect(res.error).toBeNull();
  });

  it('lists an All of copy under each slot it occupies', async () => {
    const res = await run(`
      const [main, off] = persona.body.slots;
      if (main.items.map((c) => c.id).join() !== 'c-sword') throw new Error('main ' + main.items.map((c) => c.id));
      if (off.items.map((c) => c.id).join() !== 'c-dagger,c-sword') throw new Error('off ' + off.items.map((c) => c.id));
    `);
    expect(res.error).toBeNull();
  });

  it('maps an equip slot name to the item rule slot id and passes an unlisted name through for the validator', async () => {
    const res = await run(`
      const spare = items.Dagger.copies[1];
      spare.equip('Main Hand'); spare.equip(); spare.equip('Tail');
    `);
    expect(res.error).toBeNull();
    expect(res.worldWrites?.inventory).toEqual([
      { kind: 'equip', copyId: 'c-spare', slotId: 'main' },
      { kind: 'equip', copyId: 'c-spare' },
      { kind: 'equip', copyId: 'c-spare', slotId: 'Tail' },
    ]);
  });

  it('throws a TypeError on a slot that is not a name', async () => {
    const res = await run(`items.Dagger.copies[1].equip(3);`);
    expect(res.error).toMatch(/equip needs a slot name/);
  });
});
