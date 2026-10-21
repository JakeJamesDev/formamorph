/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import { openOutputRun } from './outputRun';
import type { StatCodeOwners } from './statCodeTraits';
import type { PlayerStat, Script } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});
const script = (code: string, over: Partial<Script> = {}): Script => ({ id: code, timing: 'after', code, ...over });
const inForce = (): StatCodeOwners => ({ acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } });

const places: NonNullable<FlatStatCodeTurn['places']> = {
  locations: [{ id: 'inn', name: 'Inn' }, { id: 'gate', name: 'Gate' }],
  location: { id: 'inn', name: 'Inn' },
};

const turn = (over: Partial<FlatStatCodeTurn> & Pick<FlatStatCodeTurn, 'stats'>): StatCodeTurn => statCodeTurnOf({
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: inForce(), places,
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});

describe('runStatCodeTurn world writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('lands a move, an advance and a discovery from an After the AI script', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [], worldScripts: [script('location.move("Gate"); clock.advance(90); discover("Mira");')],
    }));
    expect(out.worldWrites).toEqual({ location: 'gate', minutes: 90, discover: [{ name: 'Mira' }] });
  });

  it('merges the scripts in run order: the later move wins, advances add, discoveries join', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', scripts: [script('location.move("Inn"); clock.advance(15); discover("Tor", "A smith."); return 1;')] })],
      worldScripts: [script('location.move("Gate"); clock.advance(30); discover("Mira"); discover("Tor");')],
    }));
    expect(out.worldWrites).toEqual({ location: 'inn', minutes: 45, discover: [{ name: 'Mira' }, { name: 'Tor', description: 'A smith.' }] });
  });

  it('runs the same writes from a Before the AI script', async () => {
    const out = await runStatCodeTurn(turn({ timing: 'before', stats: [], worldScripts: [script('clock.advance(5);', { timing: 'before' })] }));
    expect(out.worldWrites).toEqual({ minutes: 5 });
  });

  it('drops the world writes of a script that names an unknown place, and keeps the others', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', scripts: [script('clock.advance(10); location.move("Moon"); return 1;')] })],
      worldScripts: [script('discover("Mira");')],
    }));
    expect(out.worldWrites).toEqual({ discover: [{ name: 'Mira' }] });
  });

  it('reads the locations by their code names', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [], worldScripts: [script('location.move("Back Room");')],
      places: { ...places, locations: [{ id: 'back', name: 'Back {{ph:ph-room:world:p1}}' }] },
      placeholders: { placeholders: [{ id: 'ph-room', name: 'Room', values: [{ id: 'v-den', text: 'Den' }] }], rolls: {} },
    }));
    expect(out.worldWrites).toEqual({ location: 'back' });
  });

  it('joins two scripts’ opposite verdicts on one row in run order, the later script’s last', async () => {
    const row = {
      id: 't1', turn: 1, timestamp: 6, day: 1, daypart: 'morning', text: 'The gate fell.',
      custom: false, kept: true, inContext: true, pinned: false, forgotten: false,
    };
    const out = await runStatCodeTurn(turn({
      stats: [], memories: [row], worldScripts: [script('memories[0].pin();'), script('memories[0].forget();')],
    }));
    expect(out.worldWrites?.memoryWrites).toEqual([{ id: 't1', kind: 'pin' }, { id: 't1', kind: 'forget' }]);
  });

  it('joins the memory, pin and diary lines of every script in run order', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', scripts: [script('memories.add("First."); entities.Wick.diary("I ran."); return 1;')] })],
      worldScripts: [script('memories.add("Second."); memories.pin("Kept."); entities.Wick.diary("I hid.");')],
      ownerTraits: { ...inForce(), entities: [{ id: 'e-wick', name: 'Wick', traits: [] }] },
    }));
    expect(out.worldWrites).toEqual({
      memory: ['Second.', 'First.'], pins: ['Kept.'],
      diary: [{ entity: 'e-wick', line: 'I hid.' }, { entity: 'e-wick', line: 'I ran.' }],
    });
  });

  it('fails a diary for an entity the turn does not have, and keeps the other scripts\' lines', async () => {
    const out = await runStatCodeTurn(turn({
      stats: [stat({ id: 'a', scripts: [script('memories.add("Lost."); entities.Wick.diary("Hi."); return 1;')] })],
      worldScripts: [script('memories.add("Kept.");')],
    }));
    expect(out.worldWrites).toEqual({ memory: ['Kept.'] });
  });

  it('has no world writes when no script wrote one', async () => {
    const out = await runStatCodeTurn(turn({ stats: [], worldScripts: [script('return;')] }));
    expect(out.worldWrites).toBeUndefined();
  });
});

describe('the During AI Output run world writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const outputTurn = () => turn({ timing: 'output', stats: [], worldScripts: [script('clock.advance(10);', { timing: 'output' })] });
  const at = (index: number, sentence: string, earlier: string[]) => ({ index, full: [...earlier, sentence].join(' '), earlier });

  it('adds up every sentence\'s writes for the landing', async () => {
    const run = openOutputRun(outputTurn());
    await run?.rewrite('One.', at(0, 'One.', []));
    await run?.rewrite('Two.', at(1, 'Two.', ['One.']));
    expect((await run?.landing())?.worldWrites).toEqual({ minutes: 20 });
  });

  it('keeps none of a retracted round\'s writes', async () => {
    const run = openOutputRun(outputTurn());
    await run?.rewrite('One.', at(0, 'One.', []));
    await run?.rewrite('Two.', at(1, 'Two.', ['One.']));
    run?.listener({ type: 'retract', hadPartial: true });
    await run?.rewrite('Again.', at(0, 'Again.', []));
    expect((await run?.landing())?.worldWrites).toEqual({ minutes: 10 });
  });
});
