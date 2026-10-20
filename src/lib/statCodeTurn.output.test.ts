/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeOwners } from './statCodeTraits';
import type { PlayerStat, Script } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});
const script = (code: string, over: Partial<Script> = {}): Script => ({ id: code, timing: 'output', code, ...over });
const inForce = (): StatCodeOwners => ({ acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } });

/** A During AI Output run over `sentence`, with nothing else happening unless a case says so. */
const output = (over: Partial<FlatStatCodeTurn> & Pick<FlatStatCodeTurn, 'stats'>, sentence = 'The door creaks.'): StatCodeTurn => statCodeTurnOf({
  timing: 'output', narration: { sentence, full: sentence, index: 0, sent: [], buffered: [] },
  enabled: {}, previous: over.stats, asks: [], regenApplied: {}, clock: {}, ownerTraits: inForce(),
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, ...over,
});
const append = (mark: string) => `narration.sentence += '${mark}';`;
const valueOf = (stats: readonly PlayerStat[], id: string) => stats.find((s) => s.id === id)?.value;

describe('runStatCodeTurn at During AI Output', () => {
  let failure: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { failure = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it('answers the sentence a world script rewrote', async () => {
    const out = await runStatCodeTurn(output({
      stats: [], worldScripts: [script("narration.sentence = narration.sentence.replace('door', '[door](https://example.test)');")],
    }));
    expect(out.sentence).toBe('The [door](https://example.test) creaks.');
  });

  it('answers the sentence as it came when no script has code', async () => {
    const out = await runStatCodeTurn(output({ stats: [stat({ scripts: [script('')] })] }));
    expect(out.sentence).toBe('The door creaks.');
  });

  it('answers no sentence on any other timing', async () => {
    const out = await runStatCodeTurn({ ...output({ stats: [] }), timing: 'after' });
    expect(out.sentence).toBeUndefined();
  });

  it('chains the sentence through the scripts in run order: the world first, then each stat', async () => {
    const out = await runStatCodeTurn(output({
      stats: [stat({ id: 'a', scripts: [script(append('-a'))] }), stat({ id: 'b', scripts: [script(append('-b'))] })],
      worldScripts: [script(append('-world'))],
    }));
    expect(out.sentence).toBe('The door creaks.-world-a-b');
  });

  it('runs a script with an order before the ones without', async () => {
    const out = await runStatCodeTurn(output({
      stats: [stat({ id: 'a', scripts: [script(append('-a'), { order: 1 })] })],
      worldScripts: [script(append('-world'))],
    }));
    expect(out.sentence).toBe('The door creaks.-a-world');
  });

  it('runs a stat that exists for every owner once per owner, in owner order', async () => {
    const mark = script(append('+'));
    const owner = (id: string) => ({
      id, stats: [stat({ id: `${id}-hunger`, name: 'Hunger', scripts: [mark] })],
      enabled: {}, previous: [stat({ id: `${id}-hunger`, name: 'Hunger' })], regenApplied: {},
    });
    const out = await runStatCodeTurn(output({
      stats: [stat({ id: 'g', name: 'Hunger', scripts: [mark] })], owners: [owner('ann'), owner('bo')],
    }));
    expect(out.sentence).toBe('The door creaks.+++');
  });

  it('skips the script of a switched-off stat', async () => {
    const out = await runStatCodeTurn(output({
      stats: [stat({ id: 'a', scripts: [script(append('-a'))] })], enabled: { a: false },
    }));
    expect(out.sentence).toBe('The door creaks.');
  });

  it('passes the sentence unchanged when a script throws, logs its name and timing, and runs the next', async () => {
    const out = await runStatCodeTurn(output({
      stats: [stat({ id: 'a', name: 'Filter', scripts: [script("narration.sentence = 'half'; throw new Error('boom');")] })],
      worldScripts: [script(append('-world'), { name: 'Link words' })],
    }));
    expect(out.sentence).toBe('The door creaks.-world');
    expect(failure).toHaveBeenCalledWith(expect.stringMatching(/Stat Filter.*During AI Output/), expect.stringContaining('boom'));
  });

  it('names a script in the log by its own name, with its timing', async () => {
    await runStatCodeTurn(output({ stats: [], worldScripts: [script("throw new Error('no');", { name: 'Link words' })] }));
    expect(failure).toHaveBeenCalledWith(expect.stringMatching(/Link words.*During AI Output/), expect.stringContaining('no'));
  });

  it('passes the sentence unchanged when a script times out', async () => {
    const out = await runStatCodeTurn(output({ stats: [], worldScripts: [script('while (true) {}'), script(append('-next'))] }));
    expect(out.sentence).toBe('The door creaks.-next');
    expect(failure).toHaveBeenCalledWith(expect.stringMatching(/During AI Output/), expect.stringMatching(/timed out/i));
  });

  it('fails a script that calls player.ask, naming the timing, and keeps the sentence', async () => {
    const out = await runStatCodeTurn(output({ stats: [], worldScripts: [script("player.ask('Sure?', ['Yes', 'No']);")] }));
    expect(out.sentence).toBe('The door creaks.');
    expect(failure).toHaveBeenCalledWith(expect.stringMatching(/During AI Output/), expect.stringMatching(/player\.ask.*During AI Output/s));
  });

  it('merges other writes over one snapshot, the later script winning the field', async () => {
    const health = stat({ id: 'h', name: 'Health', value: 10 });
    const out = await runStatCodeTurn(output({
      stats: [health], worldScripts: [script('stats.Health.value += 1;'), script('stats.Health.value += 5;')],
    }));
    expect(valueOf(out.stats, 'h')).toBe(15);
    expect(out.moved).toEqual(['h']);
  });

  it('reads the turn start: previous is self and every delta is zero', async () => {
    const out = await runStatCodeTurn(output({
      stats: [stat({ id: 'a', value: 70, scripts: [script('narration.sentence = `${self.previous.value}/${self.value}`;')] })],
      previous: [stat({ id: 'a', value: 50 })], asks: [{ id: 'a', value: 20, max: 0 }], regenApplied: { a: 5 },
    }));
    expect(out.sentence).toBe('70/70');
  });
});
