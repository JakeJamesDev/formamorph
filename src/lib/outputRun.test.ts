/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openOutputRun } from './outputRun';
import { narrationStream, type NarrationEvent } from './aiRequest/narrationStream';
import { rewriteSentences } from './aiRequest/narrationRewrite';
import { transportRequest, type TransportContext } from './aiRequest/requestTransport';
import type { ToolExecutor } from './aiRequest/toolLoop';
import { TOOL_CATALOG } from './tools/toolCatalog';
import { UNKNOWN_REASONING_CAPABILITY } from './reasoningEffort';
import type { ScriptTrigger, StatCodeTurn } from './statCodeTurn';
import type { Placeholder, PlaceholderRolls, PlayerStat, Script, Tool, Trait } from '@/types';
import { collectPins } from './placeholderPins';
import { phValues } from '@/test/placeholderValues';
import { sseFrame, sseResponse, sseTokens, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  ...over,
});
const script = (code: string, over: Partial<Script> = {}): Script => ({ id: code, timing: 'output', code, ...over });
const calm: Trait = { id: 'calm', name: 'Calm', statChanges: [] };
const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm', 'angry']) };
const rolls: PlaceholderRolls = { world: { mood: 'calm' } };

/** A turn at its start, before the first sentence. */
const turn = (over: Partial<FlatStatCodeTurn>): StatCodeTurn => {
  const stats = over.stats ?? [];
  return statCodeTurnOf({
    stats, enabled: {}, previous: stats, asks: [], regenApplied: {}, clock: {},
    ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [calm], groups: [] } },
    statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    placeholders: {
      placeholders: [mood], rolls, pins: collectPins({ traits: [], placeholders: [mood], rolls, codePins: {} }), codePins: {},
      pinsAfter: ({ codePins, acquired, disabledTraitIds, stats }) =>
        collectPins({ traits: [...acquired], disabledTraitIds: [...disabledTraitIds], placeholders: [mood], rolls, codePins, stats: [...stats] }),
    },
    ...over,
  });
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

  it('is a run with no output script when it has a trigger source, and runs what is armed at each sentence', async () => {
    const armed: ScriptTrigger[] = [];
    const run = openOutputRun(turn({ stats: [] }), { triggers: () => [...armed] })!;
    const first = await run.rewrite('One.', { index: 0, full: 'One.', earlier: [] });
    armed.push({ name: 'shout', code: 'narration.sentence = narration.sentence.toUpperCase();', args: {} });
    expect([first, await run.rewrite('Two.', { index: 1, full: 'One. Two.', earlier: [first] })]).toEqual(['One.', 'TWO.']);
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

  it('drops a sentence run that finishes after the retract', async () => {
    const run = openOutputRun(turn({ stats: [health], worldScripts: [script('stats.Health.value += 1;')] }))!;
    const late = run.rewrite('Let me check.', { index: 0, full: 'Let me check.', earlier: [] });
    run.listener({ type: 'retract', hadPartial: true });
    await late;
    expect(run.result()).toBeNull();
    await play(run, ['The door creaks.']);
    expect(valueOf(run.result()!.stats, 'h')).toBe(11);
  });

  const reportSent = 'narration.sentence = narration.index === 3 ? JSON.stringify([narration.sent, narration.buffered]) : narration.sentence.toUpperCase();';

  it('shows every earlier sentence as sent, and none buffered, with no paced reveal', async () => {
    const run = openOutputRun(turn({ stats: [], worldScripts: [script(reportSent)] }))!;
    const out = await play(run, ['One.', 'Two.', 'Three.', 'Four.']);
    expect(out[3]).toBe(JSON.stringify([['ONE.', 'TWO.', 'THREE.'], []]));
  });

  it('splits the earlier sentences at the release count it reads', async () => {
    const run = openOutputRun(turn({ stats: [], worldScripts: [script(reportSent)] }), { released: () => 1 })!;
    const out = await play(run, ['One.', 'Two.', 'Three.', 'Four.']);
    expect(out[3]).toBe(JSON.stringify([['ONE.'], ['TWO.', 'THREE.']]));
  });

  it('answers no result before the first sentence', () => {
    expect(openOutputRun(turn({ stats: [], worldScripts: [script('x = 1;')] }))!.result()).toBeNull();
  });
});

describe('an output run through a narration round that ends in Tool calls', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const health = stat({ id: 'h', name: 'Health', value: 10 });
  const LOOKUP: Tool = { ...TOOL_CATALOG.find((t) => t.id === 'get_entity')!, offeredTo: ['narration'] };
  const executeTool: ToolExecutor = async () => ({ text: 'Maela keeps the ledger.' });
  const kept = 'The door creaks. Wind howls. Rain falls.';

  /** A body that streams `before`, waits for `gate`, then streams `after`. */
  const gated = (before: string[], gate: Promise<void>, after: string[]): Response => {
    const encoder = new TextEncoder();
    const frames = [...before];
    let passed = false;
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!frames.length && !passed) { await gate; frames.push(...after); passed = true; }
        const frame = frames.shift();
        if (frame === undefined) controller.close();
        else controller.enqueue(encoder.encode(frame));
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } });
  };

  const context = (fetchImpl: typeof fetch): TransportContext => {
    const target = {
      ...textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }),
      presetId: null, presetName: 'Cloud',
    };
    return {
      settings: textSnapshot(target), resolveEndpoint: () => target,
      tools: [LOOKUP], worldTools: [], enabledTools: { [LOOKUP.id]: true }, toolsEnabled: true,
      toolSnapshot: () => { throw new Error('No Tool Snapshot here'); },
      showSilentRequests: false, noteReasoningReply: () => {}, noteSchemaRejected: () => {}, fetchImpl,
    };
  };

  /**
   * Streams a round that completes sentences and ends in a Tool call, then a round that answers `kept`,
   * through the Narration Stream, the run and its sentence rewrite, as the game view wires them. The Tool
   * call waits until both retracted sentences have run, or with `pending` only until the first of four has.
   */
  async function narrate(code: string, { pending = false } = {}) {
    const run = openOutputRun(turn({ stats: [health], worldScripts: [script(code)] }))!;
    const heard: NarrationEvent[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const rewriting = rewriteSentences(run.rewrite, (event) => {
      heard.push(event);
      if (pending && event.type === 'sentence') release();
    });
    const retractedText = pending ? 'Let me check. The ledger. The map. The bell. Hm' : 'Let me check. The ledger. Hm';
    let replies = 0;
    // A scripted stand-in for the stream's fetch seam, which reads only the response.
    const fetchImpl = (() => Promise.resolve(replies++ === 0
      ? gated([sseFrame({ content: retractedText })], gate, [
        sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: LOOKUP.name, arguments: '{}' } }] }),
        sseFrame({}, 'tool_calls'),
      ])
      : sseResponse(sseTokens(kept.split(/(?<= )/))))) as unknown as typeof fetch;
    const sent = transportRequest(
      { systemPrompt: 'You narrate.', messages: [{ role: 'user', content: 'I walk in.' }], type: 'narration', executeTool },
      context(fetchImpl),
      narrationStream(run.listener, rewriting.listener),
    );
    if (!pending) await vi.waitFor(() => expect(heard.filter((e) => e.type === 'sentence')).toHaveLength(2));
    const retracted = run.result();
    release();
    await sent;
    return { run, heard, retracted, final: await rewriting.final() };
  }

  it('lands only the kept round\'s sentence count', async () => {
    const { run, retracted } = await narrate('stats.Health.value += 1;');
    // The retracted round ran, and wrote, before its Tool call.
    expect(valueOf(retracted!.stats, 'h')).toBe(12);
    expect(valueOf((await run.landing())!.stats, 'h')).toBe(13);
  });

  it('numbers the kept round\'s sentences from 0', async () => {
    const { final } = await narrate("narration.sentence = narration.index + ':' + narration.sentence;");
    expect(final).toBe('0:The door creaks. 1:Wind howls. 2:Rain falls.');
  });

  it('lets no rewrite of the retracted round reach a listener after the retract, the save or the final text', async () => {
    const { heard, final } = await narrate("narration.sentence = '<' + narration.sentence + '>';", { pending: true });
    const retractAt = heard.findIndex((e) => e.type === 'retract');
    // Some retracted sentences were still waiting on their rewrite when the retract landed.
    expect(heard.slice(0, retractAt).filter((e) => e.type === 'sentence').length).toBeLessThan(4);
    const afterRetract = heard.slice(retractAt + 1);
    expect(JSON.stringify(afterRetract)).not.toMatch(/check|ledger|map|bell/i);
    expect(afterRetract.filter((e) => e.type === 'sentence').map((e) => e.type === 'sentence' && e.text))
      .toEqual(['<The door creaks.>', '<Wind howls.>', '<Rain falls.>']);
    const saved = heard.filter((e) => e.type === 'partial').at(-1);
    expect(saved).toEqual({ type: 'partial', text: expect.not.stringMatching(/check|ledger/i) });
    expect(final).toBe('<The door creaks.> <Wind howls.> <Rain falls.>');
  });
});
