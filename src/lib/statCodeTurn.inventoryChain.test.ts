/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemScriptEvent } from './inventory';
import { openOutputRun } from './outputRun';
import { inPlayOwners } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import { ITEM_EVENT_DEPTH, ITEM_RUN_TOTAL, runItemScripts, runStatCodeTurn, stateInventory, SWITCH_RUN_TOTAL, type SavedScriptWrites, type StatCodeTurn, type StatCodeTurnResult } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import type { Currency, Entity, Item, ItemCopy, ItemScriptTiming, PersonaRef, PlayerStat, Script, ScriptTiming, Slot, Trait } from '@/types';
import { bodyFixture } from '@/test/bodyFixture';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 1000, value: 0, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 1000, baseRegen: 0, aiMaxDelta: 0, ...over,
});
const echo = () => stat({ id: 'echo', name: 'Echo', max: 1e6, baseMax: 1e6 });
const funds = (value: number) => stat({ id: 'funds', name: 'Funds', value });

const mira: Entity = { id: 'mira', name: 'Mira', persona: true, traits: [] };
const rook: Entity = { id: 'rook', name: 'Rook', traits: [] };
const asMira: PersonaRef = { source: 'world', entityId: 'mira' };

const world = (traits: Trait[] = []): StatCodeOwners => {
  const entities = [rook, mira];
  const entered = [...withPersonaEntry(entities, asMira, undefined)];
  return {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities, library: [],
    world: { traits, groups: [], entities: entered, persona: asMira, ...inPlayOwners({ traits, traitGroups: [], entities: entered }, asMira, []) },
  };
};

const scripts = (timing: ScriptTiming | ItemScriptTiming, ...codes: string[]): Script[] => codes.map((code, i) => ({ id: `${timing}${i}`, timing, code }));
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const copy = (id: string, itemId: string, quantity = 1): ItemCopy => ({ id, item: { kind: 'item', itemId }, where: { kind: 'you' }, quantity, visibility: 'visible' });
const trait = (id: string, name: string, own: Script[] = []): Trait => ({ id, name, statChanges: [], scripts: own });

const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const COIN: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
const COIN_ITEMS = [item('copper', 'Copper', { stackable: true }), item('gold', 'Gold', { stackable: true })];

const turnOf = (over: Partial<FlatStatCodeTurn>): StatCodeTurn => statCodeTurnOf({
  stats: [echo()], enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, ownerTraits: world(),
  owners: [
    { id: 'mira', stats: [funds(50)], enabled: {}, previous: [], regenApplied: {} },
    { id: 'rook', stats: [funds(5)], enabled: {}, previous: [], regenApplied: {} },
  ],
  money: { currencies: [CREDITS, COIN], placements: [] }, items: COIN_ITEMS, itemCopies: [copy('c-gold', 'gold')],
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

const echoOf = (out: { stats: readonly PlayerStat[] } | null | undefined) => out?.stats.find((s) => s.id === 'echo')?.value;
const fundsOf = (out: StatCodeTurnResult, owner: string) => out.owners?.[owner]?.stats.find((s) => s.id === 'funds')?.value;
const heldOf = (out: StatCodeTurnResult, itemId: string) => (out.items?.copies ?? [])
  .filter((c) => c.item.kind === 'item' && c.item.itemId === itemId).reduce((sum, c) => sum + c.quantity, 0);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a later script reads an earlier script’s inventory write', () => {
  const gem = item('gem', 'Gem');
  const ring = item('ring', 'Ring', { slotRule: { mode: 'either', slotIds: ['finger'] } });
  const finger: Slot = { id: 'finger', name: 'Finger' };

  it.each(['before', 'after', 'start'] as const)('a give at %s', async (timing) => {
    const out = await runStatCodeTurn(turnOf({
      timing, items: [gem], worldScripts: scripts(timing, 'items.Gem.give(persona, 2);', 'stats.Echo.value = persona.items.filter((c) => c.item === "Gem").length + items.Gem.copies.length * 10;'),
    }));
    expect(echoOf(out)).toBe(22);
    expect(heldOf(out, 'gem')).toBe(2);
  });

  it('a gain that stacks', async () => {
    const out = await runStatCodeTurn(turnOf({
      worldScripts: scripts('after', 'items.Gold.give(persona, 3);', 'stats.Echo.value = persona.items.find((c) => c.item === "Gold").quantity;'),
    }));
    expect(echoOf(out)).toBe(4);
  });

  it('a loss', async () => {
    const out = await runStatCodeTurn(turnOf({
      worldScripts: scripts('after', 'persona.items[0].lose();', 'stats.Echo.value = persona.items.length + 7;'),
    }));
    expect(echoOf(out)).toBe(7);
  });

  it('an equip', async () => {
    const worn = copy('c-ring', 'ring');
    const out = await runStatCodeTurn(turnOf({
      items: [ring], slots: [finger], itemCopies: [worn],
      bodies: { world: { bodies: [bodyFixture({ id: 'body', name: 'Body', entries: [{ slotId: 'finger' }] })], slots: [finger], entities: [rook, mira] }, persona: asMira },
      worldScripts: scripts('after', 'persona.items[0].equip();', 'stats.Echo.value = persona.items[0].equipped ? 1 : 2;'),
    }));
    expect(out.items?.copies[0].equipped).toBeTruthy();
    expect(echoOf(out)).toBe(1);
  });
});

describe('an item event a script fires', () => {
  it('runs before the next script', async () => {
    const gem = item('gem', 'Gem', { scripts: scripts('gained', 'stats.Echo.value = 7;') });
    const out = await runStatCodeTurn(turnOf({
      items: [gem], worldScripts: [...scripts('after', 'items.Gem.give(persona);', 'stats.Echo.value = stats.Echo.value * 10;')],
    }));
    expect(echoOf(out)).toBe(70);
  });

  it('stops at the depth cap with its line, and its writes still land', async () => {
    const box = item('box', 'Box', { scripts: scripts('gained', 'stats.Echo.value += 1; items.Box.give(persona);') });
    const out = await runStatCodeTurn(turnOf({ items: [box], worldScripts: scripts('after', 'items.Box.give(persona);', 'stats.Echo.value = stats.Echo.value * 10;') }));
    // A script's event is level 1, so three levels run, and the fourth's copy lands with no script.
    expect(echoOf(out)).toBe(ITEM_EVENT_DEPTH * 10);
    expect(heldOf(out, 'box')).toBe(1 + ITEM_EVENT_DEPTH);
    expect(out.items?.log).toEqual([`Item scripts nested past ${ITEM_EVENT_DEPTH} levels; When Gained of Box did not run`]);
  });

  it('fires the item’s level from the run that holds it, through a switch run', async () => {
    const box = item('box', 'Box', { scripts: scripts('gained', 'stats.Echo.value += 1; traits.Brave.enabled = !traits.Brave.enabled;') });
    const brave = trait('brave', 'Brave', scripts('switch', 'items.Box.give(persona);'));
    const out = await runStatCodeTurn(turnOf({ items: [box], ownerTraits: world([brave]), worldScripts: scripts('after', 'items.Box.give(persona);') }));
    // Item level 1, its switch run, item level 2, its switch run, item level 3: then the cap stops it.
    expect(echoOf(out)).toBe(ITEM_EVENT_DEPTH);
    expect(out.items?.log).toEqual([`Item scripts nested past ${ITEM_EVENT_DEPTH} levels; When Gained of Box did not run`]);
  });

  it('leaves a World Tool’s call out of its run, so the Tool runs once', async () => {
    const gem = item('gem', 'Gem', { scripts: scripts('gained', 'stats.Echo.value += 100;') });
    const out = await runStatCodeTurn(turnOf({
      items: [gem], timing: 'before', triggersOnly: true,
      triggers: [{ name: 'Find', code: 'stats.Echo.value += 1; items.Gem.give(persona);', args: {} }],
    }));
    expect(echoOf(out)).toBe(101);
    expect(heldOf(out, 'gem')).toBe(1);
  });

  it('settles after the write, so its automatic unequip fires a level below it', async () => {
    const ring = item('ring', 'Ring', { scripts: scripts('unequipped', 'stats.Echo.value = 9;') });
    const worn: ItemCopy = { ...copy('c-ring', 'ring'), equipped: { slotId: 'finger', order: 1 } };
    const out = await runStatCodeTurn(turnOf({
      items: [ring, item('gem', 'Gem')], itemCopies: [worn],
      inventory: {
        ...stateInventory({ items: [ring, item('gem', 'Gem')] }),
        settle: (copies, _uses, so) => {
          const held = copies.find((c) => c.id === 'c-ring' && c.equipped);
          if (!held) return { copies, events: [], log: [] };
          // The settle reads the writes so far.
          if (so.stats.find((s) => s.id === 'echo')?.value !== 3) return { copies, events: [], log: [] };
          return {
            copies: copies.map((c) => (c === held ? { ...c, equipped: undefined } : c)),
            events: [{ timing: 'unequipped', itemId: 'ring', copyId: 'c-ring', where: { kind: 'you' }, quantity: 1 }],
            log: ['Unequipped Ring'],
          };
        },
      },
      worldScripts: scripts('after', 'stats.Echo.value = 3; items.Gem.give(persona);', 'stats.Echo.value = stats.Echo.value + 1;'),
    }));
    expect(echoOf(out)).toBe(10);
    expect(out.items?.log).toEqual(['Unequipped Ring']);
    expect(out.worldWrites?.inventory?.filter((op) => op.kind === 'unequip')).toEqual([{ kind: 'unequip', copyId: 'c-ring' }]);
  });

  it('reads the turn’s choices and hands the next script their chain, as a switch run does', async () => {
    const gem = item('gem', 'Gem', { scripts: scripts('gained', 'stats.Echo.value = turn.choices.length;') });
    const out = await runStatCodeTurn(turnOf({
      items: [gem], turn: { action: '', number: 1, narration: '', choices: [] },
      worldScripts: scripts('after', 'turn.choices = ["One", "Two"]; items.Gem.give(persona);'),
    }));
    expect(echoOf(out)).toBe(2);
  });
});

describe('a loop of item events and switch runs', () => {
  it('stays bounded when each run branches, and logs one line past the total', async () => {
    // Three levels of a broad tree: 1 + 12 + 144 runs without the total.
    const fan = item('fan', 'Fan', { scripts: scripts('gained', 'stats.Echo.value += 1; for (let i = 0; i < 12; i += 1) items.Fan.give(persona);') });
    const out = await runStatCodeTurn(turnOf({ items: [fan], worldScripts: scripts('after', 'items.Fan.give(persona);', 'stats.Echo.value = stats.Echo.value + 0;') }));
    expect(echoOf(out)).toBe(ITEM_RUN_TOTAL);
    expect(out.items?.log.filter((line) => line.includes(`${ITEM_RUN_TOTAL} runs`))).toHaveLength(1);
  });

  it('caps both kinds together when they feed each other', async () => {
    const box = item('box', 'Box', { scripts: scripts('gained', 'stats.Echo.value += 1; traits.Brave.enabled = !traits.Brave.enabled; traits.Calm.enabled = !traits.Calm.enabled;') });
    const giving = scripts('switch', 'items.Box.give(persona, 3);');
    const out = await runStatCodeTurn(turnOf({
      items: [box], ownerTraits: world([trait('brave', 'Brave', giving), trait('calm', 'Calm', giving)]), worldScripts: scripts('after', 'items.Box.give(persona);'),
    }));
    expect(echoOf(out)).toBeLessThanOrEqual(ITEM_RUN_TOTAL);
    expect(vi.mocked(console.warn).mock.calls.filter(([line]) => String(line).includes(`${SWITCH_RUN_TOTAL} runs`)).length).toBeLessThanOrEqual(1);
  });

  it('starts fresh for the next action', async () => {
    const fan = item('fan', 'Fan', { scripts: scripts('gained', 'stats.Echo.value += 1;') });
    const turn = turnOf({ items: [fan], worldScripts: scripts('after', 'items.Fan.give(persona, 1);') });
    for (const _action of [1, 2]) expect((await runStatCodeTurn(turn)).items?.log).toEqual([]);
  });
});

describe('money across scripts', () => {
  const TWO_SCRIPTS = (currency: string, price: number) => scripts('after', `currencies.${currency}.pay(persona, null, ${price});`, `currencies.${currency}.pay(persona, null, ${price});`);

  it('charges a stat Currency the full sum', async () => {
    const out = await runStatCodeTurn(turnOf({ worldScripts: TWO_SCRIPTS('Credits', 20) }));
    expect(fundsOf(out, 'mira')).toBe(10);
  });

  it('charges a coin Currency the full sum', async () => {
    const out = await runStatCodeTurn(turnOf({ worldScripts: TWO_SCRIPTS('Coin', 30) }));
    expect(heldOf(out, 'gold')).toBe(0);
    expect(heldOf(out, 'copper')).toBe(40);
  });

  it('lets a later script spend the change an earlier one made', async () => {
    const out = await runStatCodeTurn(turnOf({
      worldScripts: scripts('after', 'currencies.Coin.pay(persona, null, 5);', 'stats.Echo.value = currencies.Coin.pay(persona, null, 90).paid ? 1 : 2;'),
    }));
    expect(echoOf(out)).toBe(1);
    expect(heldOf(out, 'copper')).toBe(5);
  });

  it('refuses a second payment the first left short', async () => {
    const out = await runStatCodeTurn(turnOf({ worldScripts: TWO_SCRIPTS('Credits', 30) }));
    expect(fundsOf(out, 'mira')).toBe(20);
  });

  it('reads earlier payments and direct writes in a third script’s balance, for each backing', async () => {
    const out = await runStatCodeTurn(turnOf({
      worldScripts: scripts(
        'after',
        'currencies.Credits.pay(persona, "Rook", 10); currencies.Coin.pay(persona, null, 25);',
        'persona.stats.Funds.value += 5; items.Copper.give(persona, 3);',
        'stats.Echo.value = currencies.Credits.balance(persona) * 1000 + currencies.Coin.balance(persona) + (currencies.Credits.balance("Rook") === 15 ? 0.5 : 0);',
      ),
    }));
    // Credits: 50 - 10 + 5 = 45. Coin: 100 - 25 + 3 = 78.
    expect(echoOf(out)).toBe(45078.5);
  });

  it('moves no money for a script that fails after its pay, and the next script reads as if it never ran', async () => {
    const out = await runStatCodeTurn(turnOf({
      worldScripts: scripts(
        'after',
        'currencies.Credits.pay(persona, "Rook", 10); currencies.Coin.pay(persona, null, 25); throw new Error("no");',
        'stats.Echo.value = currencies.Credits.balance(persona) + currencies.Coin.balance(persona);',
      ),
    }));
    expect(fundsOf(out, 'mira')).toBe(50);
    expect(fundsOf(out, 'rook')).toBe(5);
    expect(echoOf(out)).toBe(150);
    expect(out.items).toBeUndefined();
  });
});

describe('what the result holds', () => {
  it('lists each inventory write once, in order, with the Item Copies they left', async () => {
    const gem = item('gem', 'Gem', { scripts: scripts('gained', 'items.Gold.give(persona);') });
    const out = await runStatCodeTurn(turnOf({ items: [gem, ...COIN_ITEMS], worldScripts: scripts('after', 'items.Gem.give(persona);', 'items.Copper.give(persona, 2);') }));
    expect(out.worldWrites?.inventory).toEqual([
      { kind: 'gain', itemId: 'gem', to: { kind: 'you' }, quantity: 1 },
      { kind: 'gain', itemId: 'gold', to: { kind: 'you' }, quantity: 1 },
      { kind: 'gain', itemId: 'copper', to: { kind: 'you' }, quantity: 2 },
    ]);
    expect([heldOf(out, 'gem'), heldOf(out, 'gold'), heldOf(out, 'copper')]).toEqual([1, 2, 2]);
    expect(out.items?.from).toEqual([copy('c-gold', 'gold')]);
  });

  it('holds no write for a turn whose scripts wrote none, or a choices-only run’s', async () => {
    expect((await runStatCodeTurn(turnOf({ worldScripts: scripts('after', 'stats.Echo.value = 1;') }))).items).toBeUndefined();
    const quiet = await runStatCodeTurn(turnOf({
      choicesOnly: true, turn: { action: '', number: 1, narration: '', choices: [] },
      worldScripts: scripts('after', 'items.Gold.give(persona);', 'turn.choices = ["Held " + persona.items[0].quantity];'),
    }));
    expect(quiet.items).toBeUndefined();
    expect(quiet.worldWrites).toBeUndefined();
    expect(quiet.choices).toEqual(['Held 2']);
  });

  it('lands a nested switch script’s write once, at its item level', async () => {
    const box = item('box', 'Box', { scripts: scripts('gained', 'traits.Brave.enabled = true;') });
    const brave = trait('brave', 'Brave', scripts('switch', 'items.Gold.give(persona, 2);'));
    const event: ItemScriptEvent = { timing: 'gained', itemId: 'box', copyId: 'c-box', where: { kind: 'you' }, quantity: 1 };
    const items = [box, ...COIN_ITEMS];
    const apply = vi.fn(stateInventory({ items }).apply);
    const out = await runItemScripts(
      turnOf({ items, ownerTraits: world([brave]), itemCopies: [copy('c-gold', 'gold'), copy('c-box', 'box')] }), [event], items, apply, (i) => i.name,
    );
    expect(apply).toHaveBeenCalledTimes(1);
    expect(out.copies.find((c) => c.id === 'c-gold')?.quantity).toBe(3);
    expect(out.ops).toEqual([{ kind: 'gain', itemId: 'gold', to: { kind: 'you' }, quantity: 2 }]);
    // The runner hands the writes back apart, so a landing of the result can't apply them again.
    expect(out.result?.worldWrites?.inventory).toBeUndefined();
    expect(out.result?.items).toBeUndefined();
  });
});

describe('During AI Output', () => {
  const gem = item('gem', 'Gem', { scripts: scripts('gained', 'stats.Echo.value += 100;') });
  const sentence = { index: 0, full: 'One.', earlier: [] };
  const outputTurn = (...codes: string[]) => turnOf({ items: [gem], worldScripts: scripts('output', ...codes) });

  it('reads the copies across scripts and sentences, and fires nothing until the landing', async () => {
    const run = openOutputRun(outputTurn('items.Gem.give(persona);', 'stats.Echo.value += items.Gem.copies.length;'));
    await run?.rewrite('One.', sentence);
    await run?.rewrite('Two.', { ...sentence, index: 1 });
    // 1 after the first sentence, 2 after the second, and no item event yet.
    expect(echoOf(run?.result())).toBe(3);
    expect(run?.result()?.items?.held).toHaveLength(2);
    const landed = await run?.landing();
    expect(echoOf(landed)).toBe(203);
    expect(landed?.items?.held).toEqual([]);
    expect(landed && heldOf(landed, 'gem')).toBe(2);
  });

  it('settles at the landing, for a write that fired no event, and hands the settle the reply’s uses', async () => {
    const worn: ItemCopy = { ...copy('c-gem', 'gem'), equipped: { slotId: 'finger', order: 1 } };
    const settled: number[] = [];
    const out = openOutputRun(turnOf({
      items: [gem], itemCopies: [worn], worldScripts: scripts('output', 'persona.items[0].setUses(0);'),
      inventory: {
        ...stateInventory({ items: [gem] }),
        apply: (copies) => ({ copies: [...copies], events: [], diagnostics: [], itemUses: [{ copyId: 'c-gem' } as never] }),
        settle: (copies, uses) => {
          settled.push(uses.length);
          const held = copies.find((c) => c.equipped);
          return held ? {
            copies: copies.map((c) => (c === held ? { ...c, equipped: undefined } : c)),
            events: [{ timing: 'unequipped', itemId: 'gem', copyId: 'c-gem', where: { kind: 'you' }, quantity: 1 }],
            log: [],
          } : { copies, events: [], log: [] };
        },
      },
    }));
    await out?.rewrite('One.', sentence);
    expect(settled).toEqual([]);
    const landed = await out?.landing();
    expect(settled).toEqual([1]);
    expect(landed?.items?.copies[0].equipped).toBeUndefined();
    expect(landed?.worldWrites?.inventory?.filter((op) => op.kind === 'unequip')).toEqual([{ kind: 'unequip', copyId: 'c-gem' }]);
  });

  it('drops every write on a retract', async () => {
    const run = openOutputRun(outputTurn('items.Gem.give(persona);'));
    await run?.rewrite('One.', sentence);
    run?.listener({ type: 'retract' } as never);
    expect(run?.result()).toBeNull();
    await run?.rewrite('Two.', sentence);
    expect(run?.result() && heldOf(run.result()!, 'gem')).toBe(1);
  });
});

describe('an On Call Tool’s write during a reply', () => {
  const sentence = { index: 0, full: 'One.', earlier: [] };
  const gem = item('gem', 'Gem');
  const toolRun = (turn: StatCodeTurn, code: string) =>
    runStatCodeTurn({ ...turn, triggers: [{ name: 'tool', code, args: {} }], triggersOnly: true });

  it('reaches a later sentence’s script', async () => {
    const turn = turnOf({ items: [gem], worldScripts: scripts('output', 'stats.Echo.value = items.Gem.copies.length;') });
    const run = openOutputRun(turn)!;
    run.onCallLanded(await toolRun(turn, 'items.Gem.give(persona);'));
    await run.rewrite('One.', sentence);
    expect(echoOf(run.result())).toBe(1);
  });

  it('leaves `previous` at the reply’s start', async () => {
    const turn = turnOf({ worldScripts: scripts('output', 'stats.Echo.value = stats.Echo.value * 10 + stats.Echo.previous.value;') });
    const run = openOutputRun(turn)!;
    run.onCallLanded(await toolRun(turn, 'stats.Echo.value = 5;'));
    await run.rewrite('One.', sentence);
    expect(echoOf(run.result())).toBe(50);
  });

  it('survives a retract, which drops only the sentences’ writes', async () => {
    const turn = turnOf({ items: [gem], worldScripts: scripts('output', 'stats.Echo.value += 1 + items.Gem.copies.length * 10;') });
    const run = openOutputRun(turn)!;
    await run.rewrite('Lost.', sentence);
    run.listener({ type: 'retract', hadPartial: false });
    run.onCallLanded(await toolRun(turn, 'items.Gem.give(persona);'));
    run.listener({ type: 'retract', hadPartial: false });
    await run.rewrite('One.', sentence);
    expect(echoOf(run.result())).toBe(11);
  });

  it('reaches a held item run at the landing', async () => {
    const counted = item('gem', 'Gem', { scripts: scripts('gained', 'stats.Echo.value = items.Gem.copies.length;') });
    const turn = turnOf({ items: [counted], worldScripts: scripts('output', 'items.Gem.give(persona);') });
    const run = openOutputRun(turn)!;
    run.onCallLanded(await toolRun(turn, 'items.Gem.give(persona);'));
    await run.rewrite('One.', sentence);
    const landed = await run.landing();
    expect(echoOf(landed)).toBe(2);
    expect(landed && heldOf(landed, 'gem')).toBe(2);
  });

  it.each([
    ['a stat', 'Credits', (out: StatCodeTurnResult) => fundsOf(out, 'mira'), 10],
    ['a coin', 'Coin', (out: StatCodeTurnResult) => heldOf(out, 'gold') * 100 + heldOf(out, 'copper'), 60],
  ])('charges the full sum when the Tool and a script both pay %s Currency', async (_kind, currency, balance, left) => {
    const pay = `currencies.${currency}.pay(persona, null, 20);`;
    const turn = turnOf({ worldScripts: scripts('output', pay) });
    const run = openOutputRun(turn)!;
    run.onCallLanded(await toolRun(turn, pay));
    await run.rewrite('One.', sentence);
    expect(balance((await run.landing())!)).toBe(left);
  });
});

describe('an On Call Tool’s saved item writes', () => {
  const gem = item('gem', 'Gem', { scripts: scripts('gained', 'stats.Echo.value += 1;') });
  /** The turn a re-roll replays over, and the writes as a save hands them back. */
  const savedFrom = async (code: string) => {
    const turn = turnOf({ items: [gem, ...COIN_ITEMS] });
    const { triggerWrites } = await runStatCodeTurn({ ...turn, triggers: [{ name: 'tool', code, args: {} }], triggersOnly: true });
    return { turn, writes: JSON.parse(JSON.stringify(triggerWrites)) as SavedScriptWrites };
  };
  const replay = (turn: StatCodeTurn, writes: SavedScriptWrites) =>
    runStatCodeTurn({ ...turn, replayed: [{ name: 'tool', writes }], triggersOnly: true });

  it('bring back a give and a coin pay once, and the give’s item script runs once', async () => {
    const { turn, writes } = await savedFrom('items.Gem.give(persona); currencies.Coin.pay(persona, null, 30);');
    const out = await replay(turn, writes);
    expect(heldOf(out, 'gem')).toBe(1);
    expect(heldOf(out, 'gold')).toBe(0);
    expect(heldOf(out, 'copper')).toBe(70);
    expect(echoOf(out)).toBe(1);
  });

  it('leave a write out of the save when the script made none', async () => {
    const { writes } = await savedFrom('stats.Echo.value = 7;');
    expect(writes).not.toHaveProperty('inventory');
  });

  it('skip a write that names a copy the replay can’t find, with a log line', async () => {
    const { turn } = await savedFrom('');
    const out = await replay(turn, { inventory: [{ kind: 'lose', copyId: 'made-by-the-first-run' }, { kind: 'gain', itemId: 'gem', quantity: 1, to: { kind: 'you' } }] });
    expect(heldOf(out, 'gem')).toBe(1);
    expect(out.items?.log.join(' ')).toContain('made-by-the-first-run');
  });
});
