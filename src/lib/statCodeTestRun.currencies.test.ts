/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { openingStateOf, type OpeningFoldWorld, type OpeningPersona } from '@/lib/openingState';
import { snapshotOf } from '@/lib/sandboxSnapshot';
import { answerMoney, type SandboxMoney } from '@/lib/statCodeExecutor';
import { runTestCode } from '@/lib/statCodeTestRun';
import { benchSnapshotOf, checkScripts, SCRIPT_EXECUTION } from '@/lib/testBench/scriptCheck';
import type { RuleWorld } from '@/lib/testBench/rules';
import { runToolScript } from '@/lib/tools/toolScript';
import { buildToolSnapshot } from '@/lib/tools/toolSnapshot';
import type { Currency, Entity, GameLocation, Item, Placement, Stat, WorldOverview } from '@/types';

const item = (id: string, name: string): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], stackable: true });
const stat = (id: string, name: string, value: number): Stat => ({ id, name, type: 'number', description: '', min: 0, max: 1000, value, regen: 0, descriptors: [] });
const entity = (id: string, name: string, over: Partial<Entity> = {}): Entity =>
  ({ id, name, description: '', locations: [], stats: [], traits: [], ...over }) as Entity;
const placed = (id: string, entityId: string, itemId: string, quantity: number): Placement =>
  ({ id, where: { kind: 'entity', id: entityId }, quantity, source: { kind: 'item', itemId } });

const COIN: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };

const opening = {
  items: [item('copper', 'Copper'), item('gold', 'Gold')],
  // The Hero holds 1 Gold and 50 Funds. The Gatekeeper is placed with 3 Copper. The Stranger holds nothing.
  entities: [
    entity('hero', 'Hero', { persona: true, stats: [stat('funds', 'Funds', 50)] }),
    entity('keeper', 'Gatekeeper'),
    entity('stranger', 'Stranger'),
  ],
  placements: [placed('p-gold', 'hero', 'gold', 1), placed('p-copper', 'keeper', 'copper', 3)],
  currencies: [COIN, CREDITS],
  stats: [], statGroups: [], traits: [], traitGroups: [], dictionaries: [], placeholders: [],
  locations: [{ id: 'gate', name: 'Gate', description: '', isStarting: true } as GameLocation],
};
const world: OpeningFoldWorld = opening;
const ruleWorld = (code: string): RuleWorld => ({
  ...opening, worldOverview: { name: 'Toll', description: '', systemPrompt: '' } as WorldOverview, statUpdates: [],
  scripts: [{ id: 'toll', timing: 'after', code }],
});
const hero: OpeningPersona = { ref: { source: 'world', entityId: 'hero' } };
const worldHome = { kind: 'world' } as const;
const gauge = stat('gauge', 'Gauge', 0);

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('Test Code builds the Currencies', () => {
  it('reads a placed entity’s balance, which a world with no Currency stops on', async () => {
    const code = 'return currencies.Coin.balance("Gatekeeper");';
    const home = { kind: 'globalStat', stat: gauge } as const;
    expect(await runTestCode(code, 'after', home, world)).toMatchObject({ error: null, value: 3 });
    const none = await runTestCode(code, 'after', home, { ...world, currencies: [] });
    expect(none.error).toContain('The world has no Currency named "Coin"');
  });

  it('lists a settled pay with its parties and applies nothing', async () => {
    const before = structuredClone(world);
    const report = await runTestCode('currencies.Coin.pay("Gatekeeper", null, 2); currencies.Coin.pay(null, "Gatekeeper", "1 Gold");', 'after', worldHome, world);
    expect(report).toMatchObject({ error: null, writes: ['currencies.Coin.pay: 2 from Gatekeeper', 'currencies.Coin.pay: 1 Gold to Gatekeeper'] });
    expect(world).toEqual(before);
  });

  it('lists a stat pay beside its stat write', async () => {
    const report = await runTestCode('currencies.Credits.pay("Hero", null, 5);', 'after', worldHome, world);
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['entities.Hero.stats.Funds.value = 45', 'currencies.Credits.pay: 5 from Hero']);
  });

  it('runs a toll from the blank persona to a refusal that says why', async () => {
    const code = `
      if (currencies.Coin.balance(persona) !== 0) throw new Error('coin');
      if (currencies.Credits.balance(persona) !== null) throw new Error('credits');
      const toll = currencies.Coin.pay(persona, "Gatekeeper", 5);
      if (toll.paid) throw new Error('paid');
    `;
    const report = await runTestCode(code, 'after', worldHome, world);
    expect(report.error).toBeNull();
    expect(report.writes).toEqual(['currencies.Coin.pay: 5 from persona to Gatekeeper, refused: the player has no money: no persona is in play']);
  });

  it('keeps a payment refusal’s own reason when a persona is not the cause', async () => {
    const report = await runTestCode('currencies.Coin.pay("Gatekeeper", null, 50);', 'after', worldHome, world);
    expect(report.writes).toEqual(['currencies.Coin.pay: 50 from Gatekeeper, refused: it costs 50 and the payer has 3']);
  });

  it('reads a Blueprint box’s blank owner as the player with nothing', async () => {
    const home = { kind: 'blueprintStat', stat: gauge, groupStats: [gauge] } as const;
    const report = await runTestCode('if (currencies.Coin.balance(owner) !== 0) throw new Error("coin"); currencies.Coin.pay(owner, null, 1);', 'after', home, world);
    expect(report.error).toBeNull();
    expect(report.writes.join()).toContain('refused: the player has no money');
  });

  it('reads a Global Stat wallet under the blank persona, since the wallet is no one’s own', async () => {
    const wallet: OpeningFoldWorld = { ...world, stats: [stat('treasury', 'Treasury', 40)], currencies: [{ id: 'chest', name: 'Chest', backing: { kind: 'stat', statId: 'treasury' } }] };
    const report = await runTestCode('if (currencies.Chest.balance(persona) !== 40) throw new Error("wallet"); currencies.Chest.pay(persona, null, 5);', 'after', worldHome, wallet);
    expect(report).toMatchObject({ error: null, writes: ['stats.Treasury.value = 35', 'currencies.Chest.pay: 5 from persona'] });
  });

  it('still stops on an unknown entity, whose entry is blank too', async () => {
    const report = await runTestCode('currencies.Coin.pay(entities.Nobody, null, 1);', 'after', worldHome, world);
    expect(report.error).toContain('needs an entity or the persona the game has');
  });
});

describe('the Test Bench builds the Currencies', () => {
  const toll = 'if (!currencies.Coin.pay(persona, "Gatekeeper", 5).paid) throw new Error("refused");';

  it('settles a real pay under a persona lens, and refuses it under none', async () => {
    expect(await checkScripts(ruleWorld(toll), { persona: hero })).toEqual([]);
    const [found] = await checkScripts(ruleWorld(toll));
    expect(found?.ruleId).toBe(SCRIPT_EXECUTION.id);
  });

  it('moves the money in the run and leaves the world as it was', async () => {
    const lensed = ruleWorld(toll);
    const before = structuredClone(lensed);
    const paid = await benchSnapshotOf(lensed, 'after', { persona: hero }).run({ home: worldHome, timing: 'after', code: toll });
    expect(paid.payments).toEqual([expect.objectContaining({ currencyId: 'coin', paid: true, payer: { kind: 'you' }, payee: { kind: 'entity', id: 'keeper' } })]);
    expect(paid.worldWrites?.inventory?.length).toBeGreaterThan(0);
    expect(lensed).toEqual(before);
  });
});

describe('a user Tool reads a balance and can’t pay', () => {
  const state = () => openingStateOf(world, undefined, hero);
  const snapshot = (over = state()) => buildToolSnapshot(authoredChipScene(world as AuthoredWorld), [], null, { state: over, authored: null });

  it('reads a held balance, a stat balance and an untracked owner’s null', async () => {
    const code = 'return [currencies.Coin.balance(persona), currencies.Credits.balance(persona), currencies.Coin.balance("Gatekeeper"), currencies.Coin.balance(entities.Stranger)];';
    expect(await runToolScript(code, {}, snapshot())).toEqual({ text: '[100,50,3,null]' });
  });

  it('reads the blank persona as the player with nothing', async () => {
    const code = 'return [currencies.Coin.balance(persona), currencies.Credits.balance(persona)];';
    expect(await runToolScript(code, {}, snapshot(openingStateOf(world)))).toEqual({ text: '[0,null]' });
  });

  it('stops on pay, and on an unknown Currency', async () => {
    expect(await runToolScript('return currencies.Coin.pay(persona, "Gatekeeper", 5);', {}, snapshot()))
      .toEqual({ error: 'The script failed: currencies.Coin.pay isn’t available in a Tool script', kind: 'script' });
    expect(await runToolScript('return currencies.Rubles.balance(persona);', {}, snapshot()))
      .toEqual({ error: 'The script failed: The world has no Currency named "Rubles"', kind: 'script' });
  });

  it('stops on pay even when the script catches the throw, and settles nothing', async () => {
    const opened = state();
    const copies = structuredClone(opened.itemCopies);
    const result = await snapshotOf(opened).run({
      home: { kind: 'tool' }, timing: 'before', readOnly: true, args: {},
      code: 'try { currencies.Coin.pay(persona, "Gatekeeper", 5); } catch (e) {} return currencies.Coin.balance(persona);',
    });
    expect(result.error).toContain('pay isn’t available');
    expect(result.payments).toBeUndefined();
    expect(result.worldWrites?.inventory).toBeUndefined();
    expect(opened.itemCopies).toEqual(copies);
  });

  it('lists only the fields to a loop over an entry', async () => {
    const result = await runToolScript('return Object.keys(currencies.Coin);', {}, snapshot());
    expect(result).toEqual({ text: '["id","name","kind"]' });
  });

  it('has the money host answer a balance and refuse a pay in a read-only run', () => {
    const money: SandboxMoney = {
      balance: vi.fn(() => 7), pay: vi.fn(() => ({ paid: true, reason: '' })), settled: () => ({ ops: [], payments: [], stats: [] }),
    };
    const you = { kind: 'you' };
    expect(JSON.parse(answerMoney(money, JSON.stringify(['pay', 'coin', you, null, 5]), true))).toEqual({ paid: false, reason: 'a Tool can’t pay' });
    expect(money.pay).not.toHaveBeenCalled();
    expect(JSON.parse(answerMoney(money, JSON.stringify(['balance', 'coin', you]), true))).toBe(7);
    // The control: the same call pays in a script's run.
    expect(JSON.parse(answerMoney(money, JSON.stringify(['pay', 'coin', you, null, 5]), false))).toEqual({ paid: true, reason: '' });
  });
});
