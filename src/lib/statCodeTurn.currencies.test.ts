/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStatCodeTurn, type StatCodeTurnResult } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import type { Currency, Entity, Item, ItemCopy, PersonaRef, PlayerStat } from '@/types';
import { statCodeTurnOf } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 1000, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 1000, baseRegen: 0, aiMaxDelta: 0, ...over,
});
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, traits: [] };
const rook: Entity = { id: 'rook', name: 'Rook', traits: [] };
const asMira: PersonaRef = { source: 'world', entityId: 'mira' };

const world = (): StatCodeOwners => {
  const entities = [rook, mira];
  const entered = [...withPersonaEntry(entities, asMira, undefined)];
  return {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities, library: [],
    world: { traits: [], groups: [], entities: entered, persona: asMira, ...inPlayOwners({ traits: [], traitGroups: [], entities: entered }, asMira, []) },
  };
};

const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const MONEY: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
const item = (id: string, name: string): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], stackable: true });
const moneyCopy = (id: string, itemId: string, quantity: number): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: { kind: 'you' }, quantity, visibility: 'visible' });

const funds = (value: number, over: Partial<PlayerStat> = {}) => stat({ id: 'funds', name: 'Funds', value, ...over });

const run = (code: string, over: { mira?: PlayerStat; moneyCopies?: ItemCopy[] } = {}): Promise<StatCodeTurnResult> => runStatCodeTurn(statCodeTurnOf({
  stats: [], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, ownerTraits: world(),
  owners: [
    { id: 'mira', stats: [over.mira ?? funds(50)], enabled: {}, previous: [], regenApplied: {} },
    { id: 'rook', stats: [funds(5)], enabled: {}, previous: [], regenApplied: {} },
  ],
  worldScripts: [{ id: 'w', timing: 'after', code }],
  money: { currencies: [CREDITS, MONEY], placements: [] },
  items: [item('copper', 'Copper'), item('gold', 'Gold')], itemCopies: over.moneyCopies ?? [moneyCopy('c-gold', 'gold', 1)],
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
}));

const fundsOf = (out: StatCodeTurnResult, owner: string) => out.owners?.[owner]?.stats.find((s) => s.id === 'funds')?.value;

describe('runStatCodeTurn script pay', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lands a stat pay on the played persona and the payee through a world script', async () => {
    const out = await run('currencies.Credits.pay(persona, "Rook", 30);');
    expect(fundsOf(out, 'mira')).toBe(20);
    expect(fundsOf(out, 'rook')).toBe(35);
  });

  it('lets a toll gate branch on the balance and the refusal', async () => {
    const gate = 'if (currencies.Credits.balance(persona) >= 60) currencies.Credits.pay(persona, null, 60); else if (!currencies.Credits.pay(persona, null, 60).paid) currencies.Credits.pay(persona, "Rook", 1);';
    const out = await run(gate);
    // 50 credits can't cover the 60 toll, so the script took the fallback it chose from the refusal.
    expect(fundsOf(out, 'mira')).toBe(49);
  });

  it('refuses a locked payer stat, so the run changes nothing', async () => {
    const out = await run('currencies.Credits.pay(persona, "Rook", 30);', { mira: funds(50, { noDecrease: true }) });
    expect(fundsOf(out, 'mira')).toBe(50);
    expect(fundsOf(out, 'rook')).toBe(5);
  });

  it('writes the items of an item pay as inventory writes for the host to land', async () => {
    const out = await run('currencies.Coin.pay(persona, null, 5);');
    expect(out.worldWrites?.inventory).toEqual(expect.arrayContaining([{ kind: 'lose', copyId: 'c-gold', quantity: 1 }]));
  });
});
