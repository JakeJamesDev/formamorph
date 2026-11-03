/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyInventoryOps, type ItemScriptEvent } from './inventory';
import { openOutputRun } from './outputRun';
import { runItemScripts, runStatCodeTurn, runSwitchScripts, SWITCH_DEPTH_CAP, SWITCH_RUN_TOTAL, type ApplyInventory, type StatCodeTurn } from './statCodeTurn';
import type { ScriptPromptHost, ScriptPromptRequest } from './scriptPrompts';
import type { StatCodeOwners } from './statCodeTraits';
import type { Item, PlayerStat, Script, ScriptTiming, Trait } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 1e6, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 1e6, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const hp = () => stat({ id: 'hp', name: 'HP' });
const echo = () => stat({ id: 'echo', name: 'Echo', value: 0 });

/** Scripts of one timing, each with an id of its own. */
const scripts = (timing: ScriptTiming, ...codes: string[]): Script[] =>
  codes.map((code, i) => ({ id: `${timing}${i}`, timing, code }));

const trait = (id: string, name: string, own: Script[] = []): Trait => ({ id, name, statChanges: [], scripts: own });

const held = (traits: Trait[], acquired: Trait[] = []): StatCodeOwners =>
  ({ acquired, disabledTraitIds: [], appliedValues: {}, world: { traits, groups: [] } });

const turnOf = (over: Partial<FlatStatCodeTurn>): StatCodeTurn => {
  const stats = over.stats ?? [hp(), echo()];
  return statCodeTurnOf({
    stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: held([]),
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
  });
};

const valueOf = (out: { stats: readonly PlayerStat[] } | null | undefined, id: string) => out?.stats.find((s) => s.id === id)?.value;

const SWITCH_ON = 'traits.Brave.enabled = true;';
const READ = 'stats.Echo.value = stats.HP.value;';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a script that switches a trait', () => {
  it.each(['before', 'after', 'start'] as const)('fires the switch script before the next script at %s', async (timing) => {
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value = 7;'));
    const out = await runStatCodeTurn(turnOf({ timing, ownerTraits: held([brave]), worldScripts: scripts(timing, SWITCH_ON, READ) }));
    expect(valueOf(out, 'echo')).toBe(7);
  });

  it('hands the next script the full result of a nested chain', async () => {
    const calm = trait('calm', 'Calm', scripts('switch', 'stats.HP.value = stats.HP.value + 1;'));
    const brave = trait('brave', 'Brave', scripts('switch', 'traits.Calm.enabled = true;', 'stats.HP.value = stats.HP.value * 2;'));
    const out = await runStatCodeTurn(turnOf({ ownerTraits: held([brave, calm]), worldScripts: scripts('after', SWITCH_ON, READ) }));
    // Calm's run lands between Brave's two scripts: 50 + 1, then doubled.
    expect(valueOf(out, 'echo')).toBe(102);
    expect(valueOf(out, 'hp')).toBe(102);
    expect(out.traits?.acquired.map((t) => t.id)).toEqual(['brave', 'calm']);
  });

  it('stops the next script when a switch script switches its trait off', async () => {
    const calm = trait('calm', 'Calm', scripts('after', READ));
    const brave = trait('brave', 'Brave', scripts('switch', 'traits.Calm.enabled = false;'));
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held([brave, calm], [calm]), worldScripts: scripts('after', SWITCH_ON),
    }));
    expect(valueOf(out, 'echo')).toBe(0);
  });

  it('hands a switch script the choices the scripts above it left', async () => {
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.Echo.value = turn.choices.length;'));
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held([brave]), turn: { action: '', number: 1, narration: '', choices: [] },
      worldScripts: scripts('after', 'turn.choices = ["One", "Two", "Three"];', SWITCH_ON),
    }));
    expect(valueOf(out, 'echo')).toBe(3);
    expect(out.choices).toEqual(['One', 'Two', 'Three']);
  });

  it('fires the switch of an item script before that event’s next script', async () => {
    const gem: Item = {
      id: 'gem', name: 'Gem', stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: scripts('gained', SWITCH_ON, READ),
    };
    const event: ItemScriptEvent = { timing: 'gained', itemId: 'gem', copyId: 'c', where: { kind: 'you' }, quantity: 1 };
    const apply: ApplyInventory = (copies, ops) => applyInventoryOps(copies, ops, { world: { items: [gem] }, source: 'script', newId: () => 'new' });
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value = 7;'));
    const out = await runItemScripts(
      turnOf({ ownerTraits: held([brave]), items: [gem], itemCopies: [{ id: 'c', item: { kind: 'item', itemId: 'gem' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' }] }),
      [event], { items: [gem], apply, itemNameOf: (item) => item.name },
    );
    expect(valueOf(out.result, 'echo')).toBe(7);
  });
});

describe('the depth cap', () => {
  const flip = scripts('switch', 'stats.HP.value = stats.HP.value + 1; traits.Brave.enabled = !trait.enabled;');

  it('stops the chain and reports it, and the next script still runs and reads the chain', async () => {
    const out = await runStatCodeTurn(turnOf({
      timing: 'before', ownerTraits: held([trait('brave', 'Brave')]), worldScripts: [...scripts('before', SWITCH_ON, READ), ...flip],
    }));
    expect(valueOf(out, 'echo')).toBe(50 + SWITCH_DEPTH_CAP);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`${SWITCH_DEPTH_CAP} rounds`));
  });

  it('counts each script’s switches from the timing, so one script’s chain leaves the next its own rounds', async () => {
    const out = await runStatCodeTurn(turnOf({
      timing: 'before', ownerTraits: held([trait('brave', 'Brave')]),
      worldScripts: [...scripts('before', SWITCH_ON, 'traits.Brave.enabled = !traits.Brave.enabled;'), ...flip],
    }));
    expect(valueOf(out, 'hp')).toBe(50 + 2 * SWITCH_DEPTH_CAP);
  });
});

describe('the total of switch runs in one action', () => {
  const COUNT = 'stats.Echo.value = stats.Echo.value + 1;';
  const manyTraits = (count: number) => Array.from({ length: count }, (_, i) => trait(`t${i}`, `T${i}`));
  const switchAll = (from: number, to: number) => `for (let i = ${from}; i < ${to}; i += 1) traits["T" + i].enabled = true;`;
  const warned = () => vi.mocked(console.warn).mock.calls.filter(([line]) => String(line).includes(`${SWITCH_RUN_TOTAL} runs`));

  it('fires no script past the total and warns once, while the switches still apply', async () => {
    const traits = manyTraits(SWITCH_RUN_TOTAL + 5);
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held(traits), worldScripts: [...scripts('after', switchAll(0, SWITCH_RUN_TOTAL + 5), 'stats.HP.value = stats.Echo.value;'), ...scripts('switch', COUNT)],
    }));
    expect(valueOf(out, 'echo')).toBe(SWITCH_RUN_TOTAL);
    // The next script still runs, and reads what the runs left.
    expect(valueOf(out, 'hp')).toBe(SWITCH_RUN_TOTAL);
    expect(out.traits?.acquired).toHaveLength(SWITCH_RUN_TOTAL + 5);
    expect(warned()).toHaveLength(1);
  });

  it('starts fresh for the next action', async () => {
    const turn = turnOf({ ownerTraits: held(manyTraits(SWITCH_RUN_TOTAL)), worldScripts: [...scripts('after', switchAll(0, SWITCH_RUN_TOTAL)), ...scripts('switch', COUNT)] });
    for (const _action of [1, 2]) expect(valueOf(await runStatCodeTurn(turn), 'echo')).toBe(SWITCH_RUN_TOTAL);
    expect(warned()).toHaveLength(0);
  });

  it('counts every depth, which keeps switch scripts that each flip a trait from branching', async () => {
    const flip = 'traits.Brave.enabled = !traits.Brave.enabled;';
    const out = await runStatCodeTurn(turnOf({
      timing: 'before', ownerTraits: held([trait('brave', 'Brave')]),
      worldScripts: [...scripts('before', SWITCH_ON), ...scripts('switch', COUNT, flip, flip, flip)],
    }));
    expect(valueOf(out, 'echo')).toBe(SWITCH_RUN_TOTAL);
    expect(warned()).toHaveLength(1);
  });

  it('counts every script of an item batch as one action', async () => {
    const gem: Item = {
      id: 'gem', name: 'Gem', stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: scripts('gained', switchAll(0, 60)),
    };
    const ring: Item = {
      id: 'ring', name: 'Ring', stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: scripts('gained', switchAll(60, 120)),
    };
    const event = (itemId: string): ItemScriptEvent => ({ timing: 'gained', itemId, copyId: 'c', where: { kind: 'you' }, quantity: 1 });
    const apply: ApplyInventory = (copies, ops) => applyInventoryOps(copies, ops, { world: { items: [gem, ring] }, source: 'script', newId: () => 'new' });
    const out = await runItemScripts(
      turnOf({ ownerTraits: held(manyTraits(120)), items: [gem, ring], worldScripts: scripts('switch', COUNT) }),
      [event('gem'), event('ring')], { items: [gem, ring], apply, itemNameOf: (item) => item.name },
    );
    expect(valueOf(out.result, 'echo')).toBe(SWITCH_RUN_TOTAL);
  });
});

describe('a trait two scripts switch in one timing', () => {
  // Each run shifts Echo one digit left: 1 for an on, 2 for an off.
  const tally = scripts('switch', 'stats.Echo.value = stats.Echo.value * 10 + (trait.enabled ? 1 : 2);');

  it('fires what each switch fires, in order', async () => {
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held([trait('brave', 'Brave')]), worldScripts: [...scripts('after', SWITCH_ON, 'traits.Brave.enabled = false;'), ...tally],
    }));
    expect(valueOf(out, 'echo')).toBe(12);
    expect(out.traits?.disabledTraitIds).toEqual(['brave']);
  });

  it('fires nothing for one script whose own last write leaves the trait where it was', async () => {
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held([trait('brave', 'Brave')]), worldScripts: [...scripts('after', 'traits.Brave.enabled = true; traits.Brave.enabled = false;'), ...tally],
    }));
    expect(valueOf(out, 'echo')).toBe(0);
  });
});

describe('a World Tool that switches a trait', () => {
  const tool = { name: 'Strike', code: 'stats.HP.value -= 5; traits.Brave.enabled = true;', args: {} };
  const brave = () => trait('brave', 'Brave', scripts('switch', 'stats.Echo.value = stats.Echo.value + 100;'));

  it('runs once and fires its switch script, armed or On Call', async () => {
    for (const triggersOnly of [false, true]) {
      const out = await runStatCodeTurn(turnOf({ ownerTraits: held([brave()]), triggers: [tool], triggersOnly }));
      expect(valueOf(out, 'hp')).toBe(45);
      expect(valueOf(out, 'echo')).toBe(100);
    }
  });

  it('hands the switch script the prompt host of the Tool’s run', async () => {
    const asked: ScriptPromptRequest[] = [];
    const prompts: ScriptPromptHost = {
      prompt: (request) => { asked.push(request); return Promise.resolve(1 as never); },
    };
    const asking = trait('brave', 'Brave', scripts('switch', 'stats.Echo.value = player.ask("Door?", ["Left", "Right"]) === "Right" ? 9 : 1;'));
    const out = await runStatCodeTurn(turnOf({ ownerTraits: held([asking]), triggers: [tool], triggersOnly: true, prompts }));
    expect(asked).toEqual([{ kind: 'ask', question: 'Door?', options: ['Left', 'Right'], multiple: false }]);
    expect(valueOf(out, 'echo')).toBe(9);
  });
});

describe('a nested run', () => {
  it('lands a replayed write once, so a deeper run keeps what a switch script wrote over it', async () => {
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value = 7; traits.Calm.enabled = true;'));
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held([brave, trait('calm', 'Calm')]),
      replayed: [{ name: 'Strike', writes: { stats: [{ owner: null, writes: [{ id: 'hp', value: 45 }] }], traits: { world: [{ name: 'Brave', enabled: true }], entities: [] } } }],
    }));
    expect(valueOf(out, 'hp')).toBe(7);
  });

  it('reads a further switch off in the current world, not the one a persona change left', async () => {
    const brave = trait('brave', 'Brave', scripts('switch', 'traits.Calm.enabled = false;'));
    const now = trait('calm', 'Calm', scripts('switch', 'stats.HP.value = 7;'));
    const left = trait('calm', 'Calm', scripts('switch', 'stats.HP.value = 9;'));
    const turn = {
      ...turnOf({ ownerTraits: { ...held([brave, now], [brave, now]), disabledTraitIds: ['brave'] } }),
      switchedFrom: held([brave, left]).world,
    };
    const out = await runSwitchScripts(turn, [{ traitId: 'brave', ownerId: null, enabled: false }]);
    expect(valueOf(out, 'hp')).toBe(7);
  });
});

describe('a re-roll', () => {
  it('replays a Tool’s saved writes from its clean start and fires its switch script again, counting neither twice', async () => {
    const tool = { name: 'Strike', code: 'stats.HP.value -= 5; traits.Brave.enabled = true;', args: {} };
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.Echo.value = stats.Echo.value + 100;'));
    const start = turnOf({ ownerTraits: held([brave]), triggers: [tool] });
    const first = await runStatCodeTurn(start);
    expect(first.triggerWrites?.stats?.flatMap(({ writes }) => writes.map((write) => write.id))).toEqual(['hp']);
    const { triggers: _armed, ...clean } = start;
    const replayed = [{ name: 'Strike', writes: JSON.parse(JSON.stringify(first.triggerWrites)) }];
    const again = await runStatCodeTurn({ ...clean, replayed });
    expect(valueOf(again, 'hp')).toBe(45);
    expect(valueOf(again, 'echo')).toBe(100);
    expect(again.traits?.acquired.map((t) => t.id)).toEqual(['brave']);
  });

  it('fires the switches again from its clean start, with nothing counted twice', async () => {
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value -= 5;'));
    const start = turnOf({ ownerTraits: held([brave]), worldScripts: scripts('after', SWITCH_ON, READ) });
    const first = await runStatCodeTurn(start);
    const reroll = await runStatCodeTurn(start);
    for (const out of [first, reroll]) {
      expect(valueOf(out, 'hp')).toBe(45);
      expect(valueOf(out, 'echo')).toBe(45);
      expect(out.traits?.log.filter((line) => line.includes('Brave'))).toHaveLength(1);
    }
  });
});

describe('the final gateStats across a nested switch run', () => {
  const stamina = () => stat({ id: 'stamina', name: 'Stamina' });
  const brave = () => trait('brave', 'Brave', scripts('switch', 'stats.Echo.value = 1;'));

  it('applies no penalty to a stat a script moved before the switch', async () => {
    const out = await runStatCodeTurn(turnOf({
      stats: [hp(), echo(), stamina()], penalties: { hp: 10, stamina: 10 }, ownerTraits: held([brave()]),
      worldScripts: scripts('after', 'stats.HP.value = 40;', SWITCH_ON),
    }));
    expect(out.gateStats.global.hp.value).toBe(40);
    // A stat nothing moved still reads the penalty, once.
    expect(out.gateStats.global.stamina.value).toBe(40);
    expect(valueOf(out, 'stamina')).toBe(50);
  });

  it('applies no penalty when the moving script is the one that switches, or a deeper run', async () => {
    const calm = trait('calm', 'Calm', scripts('switch', 'stats.Echo.value = 2;'));
    const moving = trait('brave', 'Brave', scripts('switch', 'stats.Stamina.value = 30; traits.Calm.enabled = true;'));
    const out = await runStatCodeTurn(turnOf({
      stats: [hp(), echo(), stamina()], penalties: { hp: 10, stamina: 10 }, ownerTraits: held([moving, calm]),
      worldScripts: scripts('after', 'stats.HP.value = 40; traits.Brave.enabled = true;'),
    }));
    expect(out.gateStats.global.hp.value).toBe(40);
    expect(out.gateStats.global.stamina.value).toBe(30);
  });
});

describe('a switch run’s order', () => {
  // A row of a world script and a row of a stat's script, which only a drag puts in this order.
  const box = stat({ id: 'box', name: 'Box', scripts: [{ id: 'own', timing: 'switch', code: READ }] });
  const world: Script[] = [{ id: 'on', timing: 'after', code: SWITCH_ON }, { id: 'take', timing: 'switch', code: 'stats.HP.value = 7;' }];
  const WORLD_ROW = 'world|take';
  const BOX_ROW = 'stat/box|own';

  it('reads the Scripts tab’s rows at When a Trait Switches, not the outer timing’s', async () => {
    const at = (switchRowOrder: string[]) => runStatCodeTurn(turnOf({
      stats: [hp(), echo(), box], ownerTraits: held([trait('brave', 'Brave')]), worldScripts: world, rowOrder: ['world|on'], switchRowOrder,
    }));
    expect(valueOf(await at([WORLD_ROW, BOX_ROW]), 'echo')).toBe(7);
    expect(valueOf(await at([BOX_ROW, WORLD_ROW]), 'echo')).toBe(50);
  });

  it('reads them on a switch the player made too', async () => {
    const turn = turnOf({
      timing: 'switch', stats: [hp(), echo(), box], ownerTraits: held([trait('brave', 'Brave')]), worldScripts: world, rowOrder: [], switchRowOrder: [BOX_ROW, WORLD_ROW],
    });
    expect(valueOf(await runSwitchScripts(turn, [{ traitId: 'brave', ownerId: null, enabled: true }]), 'echo')).toBe(50);
  });
});

describe('During AI Output', () => {
  it('fires no switch run per script, so a later script reads none, and fires one at the landing', async () => {
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value = 7;'));
    const run = openOutputRun(turnOf({ ownerTraits: held([brave]), worldScripts: scripts('output', SWITCH_ON, READ) }))!;
    await run.rewrite('One.', { index: 0, full: 'One.', earlier: [] });
    expect(valueOf(run.result(), 'echo')).toBe(50);
    expect(valueOf(await run.landing(), 'hp')).toBe(7);
  });

  it('fires nothing for a trait switched on and off across one reply', async () => {
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value = 7;'));
    const run = openOutputRun(turnOf({
      ownerTraits: held([brave]), worldScripts: scripts('output', SWITCH_ON, 'traits.Brave.enabled = false;'),
    }))!;
    await run.rewrite('One.', { index: 0, full: 'One.', earlier: [] });
    const landed = await run.landing();
    expect(valueOf(landed, 'hp')).toBe(50);
    expect(landed?.traits?.disabledTraitIds).toEqual(['brave']);
  });
});

describe('Regenerate Choices', () => {
  it('builds the choices over a switch run and lands none of its writes', async () => {
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value = 7;'));
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held([brave]), choicesOnly: true, turn: { action: '', number: 1, narration: '', choices: [] },
      worldScripts: scripts('after', SWITCH_ON, 'turn.choices = ["HP " + stats.HP.value];'),
    }));
    expect(out.choices).toEqual(['HP 7']);
    expect(valueOf(out, 'hp')).toBe(50);
    expect(out.moved).toEqual([]);
    expect(out.traits).toBeUndefined();
  });

  it('asks the player nothing from a switch run', async () => {
    const prompt = vi.fn(() => new Promise<never>(() => {}));
    const brave = trait('brave', 'Brave', scripts('switch', 'stats.HP.value = player.confirm("Sure?") ? 1 : 7;'));
    const out = await runStatCodeTurn(turnOf({
      ownerTraits: held([brave]), choicesOnly: true, prompts: { prompt }, turn: { action: '', number: 1, narration: '', choices: [] },
      worldScripts: scripts('after', SWITCH_ON, 'turn.choices = ["HP " + stats.HP.value];'),
    }));
    expect(prompt).not.toHaveBeenCalled();
    expect(out.choices).toEqual(['HP 7']);
  });
});
