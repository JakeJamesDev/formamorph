/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyInventoryOps, type ItemScriptEvent } from './inventory';
import { openOutputRun } from './outputRun';
import { inPlayOwners } from './ownedTraitsInPlay';
import { runItemScripts, runStatCodeTurn, type ApplyInventory, type OwnerCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import { collectPins } from './placeholderPins';
import type { Dictionary, Item, Placeholder, PlaceholderRolls, PlayerStat, Script, ScriptTiming, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const hp = () => stat({ id: 'hp', name: 'HP' });
const echo = () => stat({ id: 'echo', name: 'Echo', value: 0 });

/** Scripts of one timing, each with its own id. */
const scripts = (timing: ScriptTiming | 'after', ...codes: string[]): Script[] =>
  codes.map((code, i) => ({ id: `s${i}`, timing: timing as ScriptTiming, code }));

const trait = (id: string, name: string, own: Script[] = [], over: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], scripts: own, ...over });

const heldTraits = (traits: Trait[], acquired: Trait[] = traits): StatCodeOwners =>
  ({ acquired, disabledTraitIds: [], appliedValues: {}, world: { traits, groups: [] } });

/** A playthrough with Bram in the world and no traits. */
const withBram = (): StatCodeOwners => {
  const entities = [{ id: 'bram', name: 'Bram' }];
  const persona = { source: 'none' } as const;
  return { ...heldTraits([]), entities, library: [], world: { traits: [], groups: [], entities, persona, ...inPlayOwners({ traits: [], traitGroups: [], entities }, persona, []) } };
};

const owner = (id: string, stats: PlayerStat[], over: Partial<OwnerCodeTurn> = {}): OwnerCodeTurn => ({
  id, stats, enabled: {}, previous: stats, regenApplied: {}, ...over,
});

const turnOf = (over: Partial<FlatStatCodeTurn> & Pick<FlatStatCodeTurn, 'stats'>): StatCodeTurn => statCodeTurnOf({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: heldTraits([]),
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

const run = (over: Partial<FlatStatCodeTurn> & Pick<FlatStatCodeTurn, 'stats'>) => runStatCodeTurn(turnOf(over));

const valueOf = (stats: readonly PlayerStat[] | undefined, id: string) => stats?.find((s) => s.id === id)?.value;

const TAKE = 'stats.HP.value -= 5;';
/** Reads HP after the earlier scripts took from it. */
const READ = 'stats.Echo.value = stats.HP.value;';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe.each(['before', 'after', 'start', 'switch'] as const)('scripts at %s', (timing) => {
  const switched = timing === 'switch' ? { switched: { traitId: 'spark', ownerId: null, enabled: true } } : {};
  const at = { timing, ...switched };
  const spark = (own: Script[] = []) => trait('spark', 'Spark', own);

  it('stack and read an earlier write in the world’s scripts', async () => {
    const out = await run({ ...at, stats: [hp(), echo()], ownerTraits: heldTraits([spark()]), worldScripts: scripts(timing, TAKE, TAKE, READ) });
    expect(valueOf(out.stats, 'hp')).toBe(40);
    expect(valueOf(out.stats, 'echo')).toBe(40);
  });

  it('stack and read an earlier write in stats’ scripts', async () => {
    const box = (id: string, code: string) => stat({ id, name: id, scripts: scripts(timing, code) });
    const out = await run({ ...at, stats: [hp(), echo(), box('a', TAKE), box('b', TAKE), box('c', READ)], ownerTraits: heldTraits([spark()]) });
    expect(valueOf(out.stats, 'hp')).toBe(40);
    expect(valueOf(out.stats, 'echo')).toBe(40);
  });

  it('stack and read an earlier write in a trait’s scripts', async () => {
    const out = await run({ ...at, stats: [hp(), echo()], ownerTraits: heldTraits([spark(scripts(timing, TAKE, TAKE, READ))]) });
    expect(valueOf(out.stats, 'hp')).toBe(40);
    expect(valueOf(out.stats, 'echo')).toBe(40);
  });

  it('stack a Blueprint stat’s write to a global stat once per owner', async () => {
    const hub = stat({ id: 'hub', name: 'Hub', scripts: scripts(timing, TAKE) });
    const out = await run({
      ...at, stats: [hp()], ownerTraits: heldTraits([spark()]), owners: [owner('bram', [hub]), owner('odette', [hub]), owner('rook', [hub])],
    });
    expect(valueOf(out.stats, 'hp')).toBe(35);
  });
});

describe('what a script reads from the scripts above it', () => {
  it('reads an earlier script’s write to an entity’s stat', async () => {
    const out = await run({
      stats: [stat({ id: 'gold', name: 'Gold', scripts: scripts('after', 'entities.Bram.stats.Trust.value = 99;') })],
      owners: [owner('bram', [stat({ id: 'trust', name: 'Trust', value: 30, scripts: scripts('after', 'return self.value - 9;') })])],
      ownerTraits: withBram(),
    });
    expect(valueOf(out.owners?.bram.stats, 'trust')).toBe(90);
    expect(out.owners?.bram.moved).toEqual(['trust']);
  });

  it('reads an earlier script’s trait switch, and the bounds it moved', async () => {
    const cursed = trait('cursed', 'Cursed', [], { statChanges: [{ statId: 'hp', value: 50, type: 'max' }] });
    const out = await run({
      stats: [stat({ id: 'hp', name: 'HP', value: 100, max: 100 }), echo()], ownerTraits: heldTraits([cursed], []),
      worldScripts: scripts('after', 'traits.Cursed.enabled = true;', 'stats.Echo.value = traits.Cursed.enabled ? stats.HP.max / 10 : 0;'),
    });
    expect(valueOf(out.stats, 'echo')).toBe(15);
  });

  it('reads an earlier script’s placeholder pin', async () => {
    const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm', 'angry']) };
    const rolls: PlaceholderRolls = { world: { mood: 'calm' } };
    const out = await run({
      stats: [echo()],
      placeholders: {
        placeholders: [mood], rolls, pins: collectPins({ traits: [], placeholders: [mood], rolls, codePins: {} }), codePins: {},
        pinsAfter: ({ codePins, acquired, disabledTraitIds, stats }) =>
          collectPins({ traits: [...acquired], disabledTraitIds: [...disabledTraitIds], placeholders: [mood], rolls, codePins, stats: [...stats] }),
      },
      worldScripts: scripts('after', 'placeholders.Mood.value = "angry";', 'stats.Echo.value = placeholders.Mood.value === "angry" ? 1 : 2;'),
    });
    expect(valueOf(out.stats, 'echo')).toBe(1);
    expect(out.pinWrites).toEqual({ mood: 'angry' });
  });

  it('reads an earlier script’s dictionary write', async () => {
    const book: Dictionary = { id: 'lore', name: 'Lore', entries: [{ id: 'gate', name: 'Gate', key: ['gate'], value: 'Shut.', enabled: false }] };
    const out = await run({
      stats: [echo()],
      placeholders: { placeholders: [], dictionaries: [book], rolls: { world: {} } },
      worldScripts: scripts('after', 'dictionaries.Lore.entries.Gate.enabled = true;', 'stats.Echo.value = dictionaries.Lore.entries.Gate.enabled ? 1 : 2;'),
    });
    expect(valueOf(out.stats, 'echo')).toBe(1);
    expect(out.loreWrites).toHaveLength(1);
  });

  it('changes what a later script reads when a drag swaps the rows', async () => {
    const worldScripts: Script[] = [
      { id: 'take', timing: 'after', code: TAKE }, { id: 'read', timing: 'after', code: READ },
    ];
    const rows = (...ids: string[]) => ids.map((id) => `world|${id}`);
    const down = await run({ stats: [hp(), echo()], worldScripts, rowOrder: rows('take', 'read') });
    expect(valueOf(down.stats, 'echo')).toBe(45);
    const dragged = worldScripts.map((script, i) => ({ ...script, order: 1 - i }));
    const up = await run({ stats: [hp(), echo()], worldScripts: dragged, rowOrder: rows('read', 'take') });
    expect(valueOf(up.stats, 'echo')).toBe(50);
    expect(valueOf(up.stats, 'hp')).toBe(45);
  });

  it('holds a later script that never names player until the answer lands', async () => {
    const out = await run({
      stats: [hp(), echo()],
      prompts: { prompt: () => Promise.resolve(true as never) },
      worldScripts: scripts('before', 'if (player.confirm("Sure?")) stats.HP.value = 7;', READ),
      timing: 'before',
    });
    expect(valueOf(out.stats, 'echo')).toBe(7);
  });

  it('keeps the same array when no script moved anything', async () => {
    const stats = [hp(), stat({ id: 'a', name: 'A', scripts: scripts('after', 'const unused = stats.HP.value;') })];
    const out = await run({ stats });
    expect(out.stats).toBe(stats);
    expect(out.moved).toEqual([]);
  });
});

describe('a choices-only run', () => {
  it('builds the choices from earlier scripts’ writes, and lands none of them', async () => {
    const stats = [hp()];
    const out = await run({
      stats, choicesOnly: true, turn: { action: '', index: 1, choices: [] } as never,
      worldScripts: scripts('after', TAKE, 'turn.choices = ["HP " + stats.HP.value];'),
    });
    expect(out.choices).toEqual(['HP 45']);
    expect(out.stats).toBe(stats);
    expect(out.moved).toEqual([]);
  });
});

describe('two scripts with one id', () => {
  it('each run at its own place', async () => {
    const out = await run({
      stats: [hp(), echo()],
      worldScripts: [{ id: 'same', timing: 'after', code: TAKE }, { id: 'same', timing: 'after', code: READ }],
    });
    expect(valueOf(out.stats, 'echo')).toBe(45);
  });
});

describe('a failed script', () => {
  it('adds nothing, and the scripts below it still run over the state as if it never ran', async () => {
    const out = await run({
      stats: [hp(), echo()],
      worldScripts: scripts('after', TAKE, 'stats.HP.value = 1; traits.Spark.enabled = true; throw new Error("boom");', READ),
      ownerTraits: heldTraits([trait('spark', 'Spark')], []),
    });
    expect(valueOf(out.stats, 'hp')).toBe(45);
    expect(valueOf(out.stats, 'echo')).toBe(45);
    expect(out.traits).toBeUndefined();
  });
});

describe('which scripts run reads at each script’s turn', () => {
  const brave = (own: Script[], order?: number) => trait('brave', 'Brave', own.map((script) => (order === undefined ? script : { ...script, order })));

  it('skips a trait’s script an earlier script switched off', async () => {
    const out = await run({
      stats: [hp()], ownerTraits: heldTraits([brave(scripts('after', TAKE))]), worldScripts: scripts('after', 'traits.Brave.enabled = false;'),
    });
    expect(valueOf(out.stats, 'hp')).toBe(50);
  });

  it('runs a trait’s script an earlier script switched on, when it is lower in the list', async () => {
    const out = await run({
      stats: [hp()], ownerTraits: heldTraits([brave(scripts('after', TAKE))], []), worldScripts: scripts('after', 'traits.Brave.enabled = true;'),
    });
    expect(valueOf(out.stats, 'hp')).toBe(45);
  });

  it('leaves unrun a trait’s script switched on from below it in the list', async () => {
    const out = await run({
      stats: [hp()], ownerTraits: heldTraits([brave(scripts('after', TAKE), 0)], []),
      worldScripts: scripts('after', 'traits.Brave.enabled = true;').map((script) => ({ ...script, order: 1 })),
    });
    expect(valueOf(out.stats, 'hp')).toBe(50);
    expect(out.traits?.acquired.map((held) => held.id)).toEqual(['brave']);
  });

  it('keeps the list’s places when a script switches its own trait off', async () => {
    const quit = brave(scripts('after', 'traits.Brave.enabled = false;'));
    const gone = trait('gone', 'Gone', scripts('after', TAKE));
    const out = await run({ stats: [hp()], ownerTraits: heldTraits([quit, gone]) });
    expect(valueOf(out.stats, 'hp')).toBe(45);
  });

  it('skips a stat’s script when an earlier script’s trait switches the stat off, and runs one it switches on', async () => {
    const swap = trait('swap', 'Swap', [], {
      statToggles: [{ statId: 'on', enabled: false }, { statId: 'off', enabled: true }],
    });
    const out = await run({
      stats: [
        hp(),
        stat({ id: 'on', name: 'On', scripts: scripts('after', TAKE) }),
        stat({ id: 'off', name: 'Off', enabled: false, scripts: scripts('after', 'stats.HP.value -= 20;') }),
      ],
      enabled: { off: false },
      ownerTraits: heldTraits([swap], []),
      worldScripts: scripts('after', 'traits.Swap.enabled = true;'),
    });
    expect(valueOf(out.stats, 'hp')).toBe(30);
  });
});

describe('previous and delta at each script’s turn', () => {
  it('keeps previous at the turn’s start and folds earlier writes into delta.actual, after the AI', async () => {
    const own = 'self.min = self.previous.value; self.regen = self.delta.actual.value;';
    const out = await run({
      stats: [stat({ id: 'hp', name: 'HP', value: 55, scripts: scripts('after', own) })],
      previous: [stat({ id: 'hp', name: 'HP', value: 40 })], regenApplied: { hp: 15 },
      worldScripts: scripts('after', 'stats.HP.value = 70;'),
    });
    expect(out.stats[0]).toMatchObject({ value: 70, min: 40, regen: 30 });
  });

  it('keeps delta.ai and delta.regen as the turn’s own', async () => {
    const own = 'self.min = self.delta.ai.value; self.regen = self.delta.regen.value;';
    const out = await run({
      stats: [stat({ id: 'hp', name: 'HP', value: 55, scripts: scripts('after', own) })],
      previous: [stat({ id: 'hp', name: 'HP', value: 40 })], asks: [{ id: 'hp', value: 10, max: 0 }], regenApplied: { hp: 5 },
      worldScripts: scripts('after', 'stats.HP.value = 70;'),
    });
    expect(out.stats[0]).toMatchObject({ min: 10, regen: 5 });
  });

  it('reads previous as the value when the timing began, before the AI', async () => {
    const own = 'self.min = self.previous.value; self.regen = self.delta.actual.value;';
    const out = await run({
      timing: 'before',
      stats: [stat({ id: 'hp', name: 'HP', value: 50, scripts: scripts('before', own) })],
      // What the turn carries never reaches a timing that reads the turn start.
      previous: [stat({ id: 'hp', name: 'HP', value: 10 })],
      worldScripts: scripts('before', 'stats.HP.value = 80;'),
    });
    expect(out.stats[0]).toMatchObject({ value: 80, min: 50, regen: 30 });
  });

  it('reads an entity stat’s previous at the turn’s start when the turn names no owner part', async () => {
    const trust = stat({ id: 'trust', name: 'Trust', value: 30, scripts: scripts('after', 'self.min = self.previous.value;') });
    const turn = turnOf({ stats: [], ownerTraits: withBram(), owners: [owner('bram', [trust])], worldScripts: scripts('after', 'entities.Bram.stats.Trust.value = 80;') });
    const out = await runStatCodeTurn({ ...turn, ownerTurns: undefined });
    expect(out.owners?.bram.stats[0]).toMatchObject({ value: 80, min: 30 });
  });
});

describe('replayed writes and re-rolls', () => {
  it('lays replayed writes at the head of the chain, where every script reads them', async () => {
    const out = await run({
      stats: [hp(), echo()],
      replayed: [{ name: 'Strike', writes: { stats: [{ owner: null, writes: [{ id: 'hp', value: 20 }] }] } }],
      worldScripts: scripts('after', TAKE, READ),
    });
    expect(valueOf(out.stats, 'hp')).toBe(15);
    expect(valueOf(out.stats, 'echo')).toBe(15);
  });

  it('runs a World Tool’s call ahead of every row, and keeps its reply and its writes alone', async () => {
    const out = await run({
      stats: [hp(), echo()],
      triggers: [{ name: 'Strike', code: 'stats.HP.value = 20; return "hit";', args: {} }],
      worldScripts: scripts('after', TAKE, READ),
    });
    expect(valueOf(out.stats, 'echo')).toBe(15);
    expect(out.reply).toEqual({ text: 'hit' });
    expect(out.triggerWrites?.stats).toMatchObject([{ owner: null, writes: [{ id: 'hp', value: 20 }] }]);
    expect(out.triggerWrites?.stats?.[0].writes).toHaveLength(1);
  });

  it('starts a re-roll clean, so its running totals count once', async () => {
    const turn = turnOf({ stats: [hp(), echo()], worldScripts: scripts('after', TAKE, TAKE) });
    const first = await runStatCodeTurn(turn);
    const again = await runStatCodeTurn(turn);
    expect(valueOf(first.stats, 'hp')).toBe(40);
    expect(valueOf(again.stats, 'hp')).toBe(40);
  });
});

describe('penalties', () => {
  const stamina = () => stat({ id: 'stamina', name: 'Stamina' });

  it('apply once per timing to a stat no script moved, however many scripts run', async () => {
    const out = await run({
      stats: [hp(), stamina()], penalties: { stamina: 10 }, worldScripts: scripts('after', TAKE, TAKE, TAKE),
    });
    expect(out.gateStats.global.stamina.value).toBe(40);
    // The real loss lands after the run, so the stat itself stays put.
    expect(valueOf(out.stats, 'stamina')).toBe(50);
  });

  it('spare a stat any script moved, the last script’s write or not', async () => {
    const out = await run({
      stats: [hp(), stamina()], penalties: { hp: 10 }, worldScripts: scripts('after', TAKE, 'stats.Stamina.value = 1;'),
    });
    expect(out.gateStats.global.hp.value).toBe(45);
  });

  it('apply with no script at all', async () => {
    const out = await run({ stats: [stamina()], penalties: { stamina: 10 } });
    expect(out.gateStats.global.stamina.value).toBe(40);
  });
});

describe('two scripts on one item event', () => {
  it('read each other’s writes through runItemScripts', async () => {
    const gem: Item = {
      id: 'gem', name: 'Gem', stackable: false, statEffects: [], traitEffects: [], equipRequires: [],
      scripts: [
        { id: 'a', timing: 'gained', code: TAKE },
        { id: 'b', timing: 'gained', code: READ },
      ],
    };
    const event: ItemScriptEvent = { timing: 'gained', itemId: 'gem', copyId: 'c', where: { kind: 'you' }, quantity: 1 };
    const apply: ApplyInventory = (copies, ops) => applyInventoryOps(copies, ops, { world: { items: [gem] }, source: 'script', newId: () => 'new' });
    const out = await runItemScripts(
      turnOf({ stats: [hp(), echo()], items: [gem], itemCopies: [{ id: 'c', item: { kind: 'item', itemId: 'gem' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' }] }),
      [event], { items: [gem], apply, itemNameOf: (item) => item.name },
    );
    expect(valueOf(out.result?.stats, 'echo')).toBe(45);
  });
});

describe('During AI Output', () => {
  const outputTurn = (worldScripts: Script[]) => turnOf({ stats: [hp(), echo()], worldScripts });
  const sentence = (index: number, earlier: string[] = []) => ({ index, full: '', earlier });

  it('chains within one sentence, and the writes land only with the result', async () => {
    const turn = outputTurn(scripts('output', TAKE, READ));
    const opened = openOutputRun(turn)!;
    await opened.rewrite('One.', sentence(0));
    expect(valueOf(opened.result()?.stats, 'echo')).toBe(45);
    expect(valueOf(turn.state.stats, 'hp')).toBe(50);
  });

  it('applies none of a sentence’s writes on a stopped turn', async () => {
    const opened = openOutputRun(outputTurn(scripts('output', TAKE, READ)))!;
    await opened.rewrite('One.', sentence(0));
    opened.listener({ type: 'retract' } as never);
    expect(opened.result()).toBeNull();
    await expect(opened.landing()).resolves.toBeNull();
  });

  it('reads previous as the value at the reply’s start on every sentence', async () => {
    const opened = openOutputRun(outputTurn(scripts('output', TAKE, 'narration.sentence = `${stats.HP.previous.value}/${stats.HP.value}`;')))!;
    await expect(opened.rewrite('One.', sentence(0))).resolves.toBe('50/45');
    await expect(opened.rewrite('Two.', sentence(1, ['50/45']))).resolves.toBe('50/40');
  });
});
