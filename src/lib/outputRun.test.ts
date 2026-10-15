/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openOutputRun } from './outputRun';
import { narrationStream } from './aiRequest/narrationStream';
import { rewriteSentences } from './aiRequest/narrationRewrite';
import type { StatCodeTurn } from './statCodeTurn';
import type { Placeholder, PlaceholderRolls, PlayerStat, Script, Trait } from '@/types';
import { collectPins } from './placeholderPins';
import { phValues } from '@/test/placeholderValues';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});
const script = (code: string, over: Partial<Script> = {}): Script => ({ id: code, timing: 'output', code, ...over });
const calm: Trait = { id: 'calm', name: 'Calm', statChanges: [] };
const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm', 'angry']) };
const rolls: PlaceholderRolls = { world: { mood: 'calm' } };

/** A turn at its start, before the first sentence. */
const turn = (over: Partial<StatCodeTurn>): StatCodeTurn => {
  const stats = over.stats ?? [];
  return {
    stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {},
    ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [calm], groups: [] } },
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    placeholders: {
      placeholders: [mood], rolls, pins: collectPins({ traits: [], placeholders: [mood], rolls, codePins: {} }), codePins: {},
      pinsAfter: ({ codePins, acquired, disabledTraitIds, stats }) =>
        collectPins({ traits: [...acquired], disabledTraitIds: [...disabledTraitIds], placeholders: [mood], rolls, codePins, stats: [...stats] }),
    },
    ...over,
  };
};

/** Plays `sentences` through a run, one after another, and answers what each one came out as. */
async function play(run: NonNullable<ReturnType<typeof openOutputRun>>, sentences: string[]) {
  const out: string[] = [];
  for (const [index, sentence] of sentences.entries()) {
    out.push(await run.rewrite(sentence, { index, full: sentences.slice(0, index + 1).join(' '), earlier: [...out] }));
  }
  return out;
}
const valueOf = (stats: readonly PlayerStat[], id: string) => stats.find((s) => s.id === id)?.value;

describe('openOutputRun', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const health = stat({ id: 'h', name: 'Health', value: 10 });

  it('is null when no script of the timing has code', () => {
    expect(openOutputRun(turn({ stats: [stat({ scripts: [script('  ')] })] }))).toBeNull();
    expect(openOutputRun(turn({ stats: [stat({ scripts: [script('x = 1;', { timing: 'after' })] })] }))).toBeNull();
    expect(openOutputRun(turn({ stats: [stat({ id: 'a', scripts: [script('x = 1;')] })], enabled: { a: false } }))).toBeNull();
  });

  it('is a run when a world script, a stat or an owner stat has code', () => {
    expect(openOutputRun(turn({ stats: [], worldScripts: [script('x = 1;')] }))).not.toBeNull();
    expect(openOutputRun(turn({ stats: [stat({ scripts: [script('x = 1;')] })] }))).not.toBeNull();
    const owner = { id: 'ann', stats: [stat({ scripts: [script('x = 1;')] })], enabled: {}, previous: [], regenApplied: {} };
    expect(openOutputRun(turn({ stats: [], owners: [owner] }))).not.toBeNull();
  });

  it('sums what a script writes on each sentence and lands it as one result', async () => {
    const run = openOutputRun(turn({ stats: [health], worldScripts: [script('stats.Health.value += 1;')] }))!;
    await play(run, ['One.', 'Two.', 'Three.']);
    const result = run.result()!;
    expect(valueOf(result.stats, 'h')).toBe(13);
    expect(result.moved).toEqual(['h']);
  });

  it('lets a later sentence read what an earlier one wrote to a stat', async () => {
    const run = openOutputRun(turn({
      stats: [health], worldScripts: [script('narration.sentence = String(stats.Health.value); stats.Health.value += 5;')],
    }))!;
    expect(await play(run, ['One.', 'Two.', 'Three.'])).toEqual(['10', '15', '20']);
  });

  it('lets a later sentence read the pin an earlier one wrote', async () => {
    const run = openOutputRun(turn({
      stats: [], worldScripts: [script("if (narration.index === 0) placeholders.Mood.value = 'angry'; else narration.sentence = placeholders.Mood.value;")],
    }))!;
    expect(await play(run, ['One.', 'Two.'])).toEqual(['One.', 'angry']);
    expect(run.result()!.pinWrites).toEqual({ mood: 'angry' });
  });

  it('lets a later sentence read the trait an earlier one switched, and logs the switch once', async () => {
    const run = openOutputRun(turn({
      stats: [], worldScripts: [script("if (narration.index === 0) traits.Calm.enabled = true; else narration.sentence = String(traits.Calm.enabled);")],
    }))!;
    expect(await play(run, ['One.', 'Two.'])).toEqual(['One.', 'true']);
    const { traits } = run.result()!;
    expect(traits?.acquired.map((t) => t.id)).toEqual(['calm']);
    expect(traits?.log).toHaveLength(1);
  });

  it('lets a later sentence read what an earlier one wrote to an owner stat', async () => {
    const hunger = stat({ id: 'ann-hunger', name: 'Hunger', value: 10, scripts: [script('self.value += 1;')] });
    const run = openOutputRun(turn({
      stats: [], owners: [{ id: 'ann', stats: [hunger], enabled: {}, previous: [hunger], regenApplied: {} }],
    }))!;
    await play(run, ['One.', 'Two.', 'Three.']);
    const ann = run.result()!.owners!.ann;
    expect(valueOf(ann.stats, 'ann-hunger')).toBe(13);
    expect(ann.moved).toEqual(['ann-hunger']);
  });

  it('drops a failed sentence run\'s writes and goes on with the next sentence', async () => {
    const run = openOutputRun(turn({
      stats: [health], worldScripts: [script("stats.Health.value += 1; if (narration.index === 1) throw new Error('late');")],
    }))!;
    expect(await play(run, ['One.', 'Two.', 'Three.'])).toEqual(['One.', 'Two.', 'Three.']);
    expect(valueOf(run.result()!.stats, 'h')).toBe(12);
  });

  it('reports nothing moved, on the turn\'s own stats, when no script wrote', async () => {
    const stats = [health];
    const run = openOutputRun(turn({ stats, worldScripts: [script('narration.sentence = narration.sentence.toUpperCase();')] }))!;
    expect(await play(run, ['One.', 'Two.'])).toEqual(['ONE.', 'TWO.']);
    const result = run.result()!;
    expect(result.moved).toEqual([]);
    expect(result.boundsChanged).toEqual([]);
    expect(result.traits).toBeUndefined();
    expect(result.pinWrites).toEqual({});
    expect(result.stats.map((s) => s.value)).toEqual([10]);
  });

  it('keeps the narration in order through the stream when a script is slow on the even sentences', async () => {
    const slowEven = "if (narration.index % 2 === 0) { for (let i = 0; i < 200000; i++) {} } narration.sentence = narration.index + ':' + narration.sentence;";
    const run = openOutputRun(turn({ stats: [], worldScripts: [script(slowEven)] }))!;
    const heard: string[] = [];
    const rewriting = rewriteSentences(run.rewrite, (event) => { if (event.type === 'sentence') heard.push(event.text); });
    const sink = narrationStream(rewriting.listener);
    const text = 'One. Two. Three. Four. Five.';
    sink({ type: 'opened' });
    let content = '';
    for (const step of text.split(/(?<=\s)/)) sink({ type: 'delta', content: (content += step) });
    sink({ type: 'done', text, raw: text, reasoningText: '', finishReason: 'stop' });
    expect(await rewriting.final()).toBe('0:One. 1:Two. 2:Three. 3:Four. 4:Five.');
    expect(heard).toEqual(['0:One.', '1:Two.', '2:Three.', '3:Four.', '4:Five.']);
  });

  it('counts only the writes of the reply that stands when a retract restarts it', async () => {
    const run = openOutputRun(turn({ stats: [health], worldScripts: [script('stats.Health.value += 1;')] }))!;
    const sink = narrationStream(rewriteSentences(run.rewrite).listener);
    const feed = (content: string) => sink({ type: 'delta', content });
    sink({ type: 'opened' });
    feed('Let me check. Hm. Plan');
    // Both sentences of the first attempt have run, and written, before the retract lands.
    await vi.waitFor(() => expect(valueOf(run.result()?.stats ?? [], 'h')).toBe(12));
    sink({ type: 'retract' });
    feed('The door creaks. Wind howls. Rain');
    sink({ type: 'done', text: 'The door creaks. Wind howls. Rain falls.', raw: '', reasoningText: '', finishReason: 'stop' });
    // Two sentences came before the retract, three after: only the three count.
    await vi.waitFor(() => expect(valueOf(run.result()!.stats, 'h')).toBe(13));
  });

  const reportSent = 'narration.sentence = narration.index === 3 ? JSON.stringify([narration.sent, narration.buffered]) : narration.sentence.toUpperCase();';

  it('shows every earlier sentence as sent, and none buffered, with no paced reveal', async () => {
    const run = openOutputRun(turn({ stats: [], worldScripts: [script(reportSent)] }))!;
    const out = await play(run, ['One.', 'Two.', 'Three.', 'Four.']);
    expect(out[3]).toBe(JSON.stringify([['ONE.', 'TWO.', 'THREE.'], []]));
  });

  it('splits the earlier sentences at the release count it reads', async () => {
    const run = openOutputRun(turn({ stats: [], worldScripts: [script(reportSent)] }), () => 1)!;
    const out = await play(run, ['One.', 'Two.', 'Three.', 'Four.']);
    expect(out[3]).toBe(JSON.stringify([['ONE.'], ['TWO.', 'THREE.']]));
  });

  it('answers no result before the first sentence', () => {
    expect(openOutputRun(turn({ stats: [], worldScripts: [script('x = 1;')] }))!.result()).toBeNull();
  });
});
