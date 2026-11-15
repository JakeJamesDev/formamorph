/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';
import { applyInventoryOps, applyInventoryPass, equipRequirement, settleInventory, type InventoryCall, type InventoryOp, type ItemScriptEvent, type PassScene } from './inventory';
import { inPlayOwners } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import { seedStatBases } from './traitRuntime';
import { runItemScripts, stateInventory } from './statCodeTurn';
import type { Entity, InventoryPassOp, Item, ItemInstance, ItemScriptTiming, PersonaRef, PlayerStat, TraitRequirementRow } from '@/types';

const gold: PlayerStat = {
  id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 10000, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 10000, baseRegen: 0, aiMaxDelta: 0,
};
const keeper: Entity = { id: 'e-keeper', name: 'Keeper', traits: [] };
const ash: Entity = { id: 'e-ash', name: 'Ash', persona: true, traits: [] };
const cast = [keeper, ash];
const asAsh: PersonaRef = { source: 'world', entityId: 'e-ash' };
const you = { kind: 'you' } as const;
const keeperAt = { kind: 'entity', id: 'e-keeper' } as const;
const vault = { kind: 'location', id: 'loc-vault' } as const;

// A run adds `args.by` in the tens and the side in the ones: When Gained reads `from`, When Lost `to` times 100.
const CODE = `
  const side = (v) => v === persona ? 1 : v === entities.Keeper ? 2 : v === locations.Vault ? 3 : v === null ? 4 : 9;
  const cause = ({ story: 10, player: 20, script: 30, rule: 40 })[args.by] ?? 90;
`;
const RECORD: Partial<Record<ItemScriptTiming, string>> = {
  gained: `${CODE} stats.Gold.value += cause + side(args.from);`,
  lost: `${CODE} stats.Gold.value += (cause + side(args.to)) * 100;`,
  unequipped: `${CODE} stats.Gold.value += cause;`,
};

const item = (id: string, name: string, timings: ItemScriptTiming[], over: Partial<Item> = {}): Item => ({
  id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [],
  scripts: timings.map((timing, i) => ({ id: `${id}-${i}`, timing, code: RECORD[timing] ?? '' })), ...over,
});
const instance = (id: string, itemId: string, where: ItemInstance['where'], over: Partial<ItemInstance> = {}): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where, quantity: 1, visibility: 'visible', ...over });

let ids = 0;
const callOf = (items: Item[], source: InventoryCall['source'], over: Partial<InventoryCall> = {}): InventoryCall => ({
  world: { items, slots: [{ id: 'finger', name: 'Finger' }], bodies: [bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'finger' }] })] },
  source, newId: () => `new-${(ids += 1)}`, ...over,
});

/** Runs the item scripts of `landed`'s events over the Item Instances it left, and reads Gold. */
async function goldAfter(items: Item[], landed: { instances: readonly ItemInstance[]; events: readonly ItemScriptEvent[] }): Promise<number | undefined> {
  const entered = [...withPersonaEntry(cast, asAsh, undefined)];
  const turn = statCodeTurnOf({
    stats: [gold], enabled: {}, previous: [gold], asks: [], regenApplied: {}, clock: {},
    ownerTraits: {
      acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities: cast, library: [],
      world: { traits: [], groups: [], entities: entered, persona: asAsh, ...inPlayOwners({ traits: [], traitGroups: [], entities: entered }, asAsh, []) },
    },
    places: { locations: [{ id: 'loc-vault', name: 'Vault' }], location: { id: 'loc-vault', name: 'Vault' } },
    items, itemInstances: landed.instances, statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  });
  const out = await runItemScripts(turn, landed.events, stateInventory({ items }));
  expect(out.diagnostics).toEqual([]);
  return out.result?.stats.find((s) => s.id === 'gold')?.value;
}

const passOp = (kind: InventoryPassOp['op'], name: string, over: Partial<InventoryPassOp> = {}): InventoryPassOp =>
  ({ op: kind, item: name, quantity: 1, owner: '', to: '', ...over });
const scene = (items: Item[]): PassScene => ({
  items, runtimeItems: [], playerNames: ['Ash'], owners: [{ id: 'e-keeper', name: 'Keeper' }], location: { id: 'loc-vault', name: 'Vault' },
  resolve: (text) => text,
});
const pass = (items: Item[], start: ItemInstance[], ops: InventoryPassOp[]) => {
  const { source: _pass, ...call } = callOf(items, 'pass');
  return applyInventoryPass(start, ops, scene(items), call);
};

describe('item event cause and parties', () => {
  beforeEach(() => {
    ids = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  describe('the Inventory pass', () => {
    it('reads a transfer from the persona as story, from persona on the receiver and to the receiver on the giver', async () => {
      const gem = item('i-gem', 'Gem', ['gained', 'lost']);
      const landed = pass([gem], [instance('c-gem', 'i-gem', you)], [passOp('transfer', 'Gem', { owner: 'Ash', to: 'Keeper' })]);
      expect(await goldAfter([gem], landed)).toBe(11 + 1200);
    });

    it('reads a transfer from an entity as from that entity', async () => {
      const gem = item('i-gem', 'Gem', ['gained']);
      const landed = pass([gem], [instance('c-gem', 'i-gem', keeperAt)], [passOp('transfer', 'Gem', { owner: 'Keeper', to: 'Ash' })]);
      expect(await goldAfter([gem], landed)).toBe(12);
    });

    it('reads a pickup from the ground as from the location', async () => {
      const gem = item('i-gem', 'Gem', ['gained']);
      const landed = pass([gem], [instance('c-gem', 'i-gem', vault)], [passOp('gain', 'Gem', { to: 'Ash' })]);
      expect(await goldAfter([gem], landed)).toBe(13);
    });

    it('reads a new stack as from null', async () => {
      const gem = item('i-gem', 'Gem', ['gained'], { stackable: true });
      const landed = pass([gem], [], [passOp('gain', 'Gem', { to: 'Ash' })]);
      expect(await goldAfter([gem], landed)).toBe(14);
    });

    it('reads a script grant nested under a pass transfer as script, from null (Q8)', async () => {
      const berry = item('i-berry', 'Berry', ['gained']);
      const box = item('i-box', 'Gift Box', [], { scripts: [{ id: 'box-0', timing: 'gained', code: `${RECORD.gained} items.Berry.give(persona);` }] });
      const landed = pass([box, berry], [instance('c-box', 'i-box', keeperAt)], [passOp('transfer', 'Gift Box', { owner: 'Keeper', to: 'Ash' })]);
      expect(await goldAfter([box, berry], landed)).toBe(12 + 34);
    });
  });

  describe('the Inventory panel', () => {
    it('reads a give as player, to the receiver', async () => {
      const gem = item('i-gem', 'Gem', ['gained', 'lost']);
      const landed = applyInventoryOps([instance('c-gem', 'i-gem', you)], [{ kind: 'transfer', instanceId: 'c-gem', to: keeperAt }], callOf([gem], 'panel'));
      expect(await goldAfter([gem], landed)).toBe(21 + 2200);
    });

    it('reads a drop as player, to the location', async () => {
      const gem = item('i-gem', 'Gem', ['lost']);
      const landed = applyInventoryOps([instance('c-gem', 'i-gem', you)], [{ kind: 'transfer', instanceId: 'c-gem', to: vault }], callOf([gem], 'panel'));
      expect(await goldAfter([gem], landed)).toBe(2300);
    });
  });

  describe("a script's write", () => {
    it('reads a gain as script, from null, and a lose as script, to null', async () => {
      const gem = item('i-gem', 'Gem', ['gained', 'lost']);
      const ops: InventoryOp[] = [{ kind: 'gain', itemId: 'i-gem', quantity: 1, to: you }, { kind: 'lose', instanceId: 'c-old' }];
      const landed = applyInventoryOps([instance('c-old', 'i-gem', you)], ops, callOf([gem], 'script'));
      expect(await goldAfter([gem], landed)).toBe(34 + 3400);
    });
  });

  describe('a rule', () => {
    it('reads a Becomes result as rule, from null, while the use reads its writer', async () => {
      const bottle = item('i-bottle', 'Bottle', ['gained']);
      const flask = item('i-flask', 'Flask', [], {
        uses: 1, whenEmpty: { kind: 'becomes', itemId: 'i-bottle' }, scripts: [{ id: 'flask-0', timing: 'used', code: `${CODE} stats.Gold.value += cause * 100;` }],
      });
      const landed = applyInventoryOps([instance('c-flask', 'i-flask', you)], [{ kind: 'use', instanceId: 'c-flask' }], callOf([flask, bottle], 'panel'));
      expect(await goldAfter([flask, bottle], landed)).toBe(2000 + 44);
    });

    it('reads an unequip a full slot forced as rule', async () => {
      const ring = item('i-ring', 'Ring', ['unequipped'], { slotRule: { mode: 'either', slotIds: ['finger'] } });
      const start = [instance('c-old', 'i-ring', you, { equipped: { slotId: 'finger', order: 1 } }), instance('c-new', 'i-ring', you)];
      const landed = applyInventoryOps(start, [{ kind: 'equip', instanceId: 'c-new' }], callOf([ring], 'panel'));
      expect(await goldAfter([ring], landed)).toBe(40);
    });

    it('reads an unequip a requirement forced as rule', async () => {
      const needs: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'strength', operator: '>=', value: 5, unit: 'raw' }] }];
      const ring = item('i-ring', 'Ring', ['unequipped'], { slotRule: { mode: 'either', slotIds: ['finger'] }, equipRequires: needs });
      const strength = (value: number) => ({ id: 'strength', name: 'Strength', value, min: 0, max: 10 } as PlayerStat);
      const traits = (value: number) => ({
        stats: [], traits: [], disabledTraitIds: [], appliedValues: {}, entityStats: { 'e-keeper': seedStatBases([strength(value)]) }, ownedTraits: {},
      });
      const world = {
        items: [ring], traits: {
          traits: [], groups: [], entities: cast, persona: asAsh,
          global: { traits: [], groups: [] }, owners: [{ id: 'e-keeper', name: 'Keeper', traits: [], groups: [] }], items: [ring],
        },
      };
      const worn = applyInventoryOps([instance('c-ring', 'i-ring', keeperAt)], [{ kind: 'equip', instanceId: 'c-ring' }], {
        ...callOf([ring], 'panel'), requirement: equipRequirement({ traits: traits(6), ledger: undefined }, world),
      });
      expect(worn.diagnostics).toEqual([]);
      const settled = settleInventory({ instances: worn.instances, traits: traits(4), ledger: undefined }, world);
      expect(await goldAfter([ring], settled)).toBe(40);
    });
  });
});
