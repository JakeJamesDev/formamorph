/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyInventoryOps, type ItemScriptEvent } from './inventory';
import { ITEM_EVENT_DEPTH, runItemScripts, type ApplyInventory, type StatCodeTurn } from './statCodeTurn';
import type { Entity, Item, ItemCopy, ItemScriptTiming, PlayerStat } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const gold: PlayerStat = {
  id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0,
};
const keeper = { id: 'e-keeper', name: 'Keeper', description: '', locations: ['loc-vault'] } as Entity;

const item = (id: string, name: string, scripts: [ItemScriptTiming, string][]): Item => ({
  id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [],
  scripts: scripts.map(([timing, code], i) => ({ id: `${id}-${i}`, timing, code })),
});

const copy = (id: string, itemId: string, where: ItemCopy['where']): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where, quantity: 1, visibility: 'visible' });

const turnOf = (items: Item[], copies: ItemCopy[], over: Partial<FlatStatCodeTurn> = {}): StatCodeTurn => statCodeTurnOf({
  stats: [gold], enabled: {}, previous: [gold], asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] }, entities: [keeper] },
  places: { locations: [{ id: 'loc-vault', name: 'Vault' }], location: { id: 'loc-vault', name: 'Vault' } },
  items, itemCopies: copies, statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

let ids = 0;
const applyWith = (items: Item[]): ApplyInventory => (copies, ops) =>
  applyInventoryOps(copies, ops, { world: { items }, source: 'script', newId: () => `new-${(ids += 1)}` });

const event = (timing: ItemScriptTiming, itemId: string, copyId: string, where: ItemCopy['where']): ItemScriptEvent =>
  ({ timing, itemId, copyId, where, quantity: 1 });

describe('runItemScripts', () => {
  beforeEach(() => {
    ids = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('chains a When Gained gift to depth 3, then stops firing with a diagnostic while the write lands', async () => {
    const box = item('i-box', 'Gift Box', [['gained', 'stats.Gold.value += 1; self.give(locations.Vault);']]);
    const start = [copy('c-0', 'i-box', { kind: 'location', id: 'loc-vault' })];
    const out = await runItemScripts(
      turnOf([box], start), [event('gained', 'i-box', 'c-0', { kind: 'location', id: 'loc-vault' })], [box], applyWith([box]), (i) => i.name,
    );
    // Levels 1, 2 and 3 run; each gives one box, so the level-4 event lands its box but runs nothing.
    expect(out.result?.stats.find((s) => s.id === 'gold')?.value).toBe(ITEM_EVENT_DEPTH);
    expect(out.copies).toHaveLength(1 + ITEM_EVENT_DEPTH);
    expect(out.diagnostics).toEqual(['Item scripts nested past 3 levels; When Gained of Gift Box did not run']);
  });

  it('hands a When Lost script the Item Copy that left, as it stood', async () => {
    const coin = item('i-coin', 'Coin', [['lost', 'stats.Gold.value += self.event.copy.quantity;']]);
    const start = [{ ...copy('c-1', 'i-coin', { kind: 'you' }), quantity: 4 }];
    const lost = applyWith([coin])(start, [{ kind: 'lose', copyId: 'c-1' }]);
    const out = await runItemScripts(turnOf([coin], lost.copies), lost.events, [coin], applyWith([coin]), (i) => i.name);
    expect(out.result?.stats.find((s) => s.id === 'gold')?.value).toBe(4);
  });

  it('starts at the depth it is given, and lists the writes it landed', async () => {
    const box = item('i-box', 'Gift Box', [['gained', 'self.give(locations.Vault);']]);
    const start = [copy('c-0', 'i-box', { kind: 'location', id: 'loc-vault' })];
    const out = await runItemScripts(
      turnOf([box], start), [event('gained', 'i-box', 'c-0', { kind: 'location', id: 'loc-vault' })], [box], applyWith([box]), (i) => i.name, ITEM_EVENT_DEPTH,
    );
    expect(out.ops).toEqual([{ kind: 'gain', itemId: 'i-box', to: { kind: 'location', id: 'loc-vault' }, quantity: 1 }]);
    expect(out.diagnostics).toEqual(['Item scripts nested past 3 levels; When Gained of Gift Box did not run']);
  });

  it('runs only the scripts of the event’s timing, once per event', async () => {
    const ring = item('i-ring', 'Ring', [['equipped', 'stats.Gold.value += 10;'], ['lost', 'stats.Gold.value += 1;']]);
    const out = await runItemScripts(
      turnOf([ring], [copy('c-1', 'i-ring', { kind: 'you' })]),
      [event('equipped', 'i-ring', 'c-1', { kind: 'you' })], [ring], applyWith([ring]), (i) => i.name,
    );
    expect(out.result?.stats.find((s) => s.id === 'gold')?.value).toBe(10);
  });

  it('reads the Item Copy’s owner as owner, and none while it lies at a location', async () => {
    const lamp = item('i-lamp', 'Lamp', [['gained', 'stats.Gold.value += owner.name === "Keeper" ? 5 : owner.name === "" ? 1 : 100;']]);
    const held = await runItemScripts(
      turnOf([lamp], [copy('c-1', 'i-lamp', { kind: 'entity', id: 'e-keeper' })]),
      [event('gained', 'i-lamp', 'c-1', { kind: 'entity', id: 'e-keeper' })], [lamp], applyWith([lamp]), (i) => i.name,
    );
    expect(held.result?.stats.find((s) => s.id === 'gold')?.value).toBe(5);
    const lying = await runItemScripts(
      turnOf([lamp], [copy('c-1', 'i-lamp', { kind: 'location', id: 'loc-vault' })]),
      [event('gained', 'i-lamp', 'c-1', { kind: 'location', id: 'loc-vault' })], [lamp], applyWith([lamp]), (i) => i.name,
    );
    expect(lying.result?.stats.find((s) => s.id === 'gold')?.value).toBe(1);
  });

  it('removes a Bound Item Copy, since Bound stops the panel only', async () => {
    const curse = { ...item('i-curse', 'Curse', [['gained', 'self.event.copy.lose();']]), bound: true };
    const out = await runItemScripts(
      turnOf([curse], [copy('c-1', 'i-curse', { kind: 'you' })]),
      [event('gained', 'i-curse', 'c-1', { kind: 'you' })], [curse], applyWith([curse]), (i) => i.name,
    );
    expect(out.copies).toEqual([]);
    expect(out.diagnostics).toEqual([]);
  });

  it('runs nothing and keeps the copies when the item has no script for the timing', async () => {
    const plain = item('i-plain', 'Plain', []);
    const start = [copy('c-1', 'i-plain', { kind: 'you' })];
    const out = await runItemScripts(turnOf([plain], start), [event('gained', 'i-plain', 'c-1', { kind: 'you' })], [plain], applyWith([plain]), (i) => i.name);
    expect(out).toEqual({ result: null, copies: start, diagnostics: [], doses: [], ops: [] });
  });
});
