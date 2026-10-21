/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerStat, Script, Tool, ToolScriptHandler, TurnToolCall } from '@/types';
import { transportRequest, type TransportContext } from '@/lib/aiRequest/requestTransport';
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { afterRun, runStatCodeTurn, type StatCodeTurn, type StatCodeTurnResult } from '@/lib/statCodeTurn';
import { planTurn } from '@/lib/turnPipeline/planTurn';
import { runTurn, type TurnResult } from '@/lib/turnPipeline/turnRunner';
import { testInput } from '@/lib/turnPipeline/turnTestInputs';
import type { TurnMaterial, TurnSettings } from '@/lib/turnPipeline/turnPlan';
import { narrationStream, type NarrationEvent } from '@/lib/aiRequest/narrationStream';
import { rewriteSentences } from '@/lib/aiRequest/narrationRewrite';
import { openOutputRun } from '@/lib/outputRun';
import { sseFrame, sseResponse, sseTokens, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { onCallRunner } from './onCallRunner';
import { runToolCall } from './toolRunner';
import { emptyToolSnapshot } from './toolSnapshot';
import { parseTool } from './toolValidation';
import { withImportedWorldTools } from './worldTools';
import { DEFAULT_REPLY, openWorldToolTurn, replayedToolEffects, type WorldToolTurn } from './worldToolTurn';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

const health: PlayerStat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 200, value: 10, regen: 0, descriptors: [],
};

/** A turn's state for its scripts, Health at 10 and nothing else in play. */
const turnState = (over: Partial<FlatStatCodeTurn> = {}): StatCodeTurn => statCodeTurnOf({
  stats: [health], enabled: {}, previous: [health], asks: [], regenApplied: {}, clock: {},
  ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
  ...over,
});

const worldTool = (name: string, handler: Omit<ToolScriptHandler, 'kind'>, over: Partial<Tool> = {}): Tool => ({
  id: `tool-${name}`, name, description: `The ${name} Tool.`, emptyResult: 'Nothing.', offeredTo: ['narration'],
  params: [{ name: 'amount', type: 'number', description: 'How much.', required: false, options: [] }],
  handler: { kind: 'script', ...handler },
  ...over,
});

const heal = (over: Partial<ToolScriptHandler> = {}) =>
  worldTool('heal', { code: 'stats.Health.value += args.amount;', timing: 'after', reply: 'The healing takes hold.', ...over });
const roll = worldTool('roll', { code: "stats.Health.value += 5; return 'rolled ' + stats.Health.value;" });

/** One model reply: a round of Tool calls, each `[name, args]`, the narration text, or text that ends in Tool calls. */
type Calls = [string, Record<string, unknown>][];
type Round = Calls | string | { text: string; calls: Calls };

const replyOf = (round: Round) => (typeof round === 'string' ? sseResponse(sseTokens([round]))
  : Array.isArray(round) ? toolRound(round) : toolRound(round.calls, round.text));

const toolRound = (calls: Calls, text?: string) => sseResponse([
  ...(text ? [sseFrame({ content: text })] : []),
  sseFrame({
    tool_calls: calls.map(([name, args], index) => ({ index, id: `call-${index}`, type: 'function', function: { name, arguments: JSON.stringify(args) } })),
  }),
  sseFrame({}, 'tool_calls'),
]);

const context = (tools: readonly Tool[], fetchImpl: typeof fetch): TransportContext => {
  const target = {
    ...textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }),
    presetId: null, presetName: 'Cloud',
  };
  return {
    settings: textSnapshot(target), resolveEndpoint: () => target,
    tools: [], worldTools: tools, enabledTools: {}, toolsEnabled: true, toolSnapshot: emptyToolSnapshot,
    showSilentRequests: false, noteReasoningReply: () => {}, noteSchemaRejected: () => {}, fetchImpl,
  };
};

const material = (): TurnMaterial => ({
  action: 'I rest.', effectiveAction: 'I rest.', turnId: 'turn-1', ctx: {}, baseCtx: {}, sceneEntityTokens: {}, destinations: [],
  narrationSystemPrompt: 'You narrate.', narrationSystemPromptRuns: [], historyRuns: [], trimmedHistory: [],
  narration: '', lastStory: '', plannerRecap: '', turnPlan: '', activeCharacterGuidance: '', directorScene: '', npcCastSize: 0,
  intents: [], overflow: [], sceneCast: [],
});

/** Every pass but narration off, so the turn is the narration request alone. */
const NARRATION_ONLY = {
  thinkingMode: 'off', choicesEnabled: false, statUpdatesEnabled: false, locationChangeEnabled: false, aiClock: false,
  memoryDigests: false, characterDiaries: false, describeCharacters: false,
} as const;

/**
 * Plays one turn through `runTurn`, its narration request through the Request Transport and a scripted stream
 * that answers `rounds` in order, with the world's Tools run by a fresh World Tool turn. Each On Call run lands on
 * `live`, the turn's state as the game view keeps it. Answers the turn, `live`, and the Tool results each round sent back.
 * With `output`, the narration streams through a During AI Output run over those world Scripts and the turn's
 * armed triggers, as the game view wires it, and `shown` records each sentence the screen got.
 */
async function playTurn(tools: readonly Tool[], rounds: Round[], {
  signal = new AbortController().signal, onRound = (_n: number) => {}, output, settings = NARRATION_ONLY, start = turnState(),
}: { signal?: AbortSignal; onRound?: (n: number) => void; output?: Script[]; settings?: Partial<TurnSettings>; start?: StatCodeTurn } = {}) {
  const live: { state: StatCodeTurn; landed: StatCodeTurnResult[] } = { state: start, landed: [] };
  const onCall = onCallRunner(() => ({
    turn: live.state,
    land: (ran) => { live.landed.push(ran); live.state = afterRun(live.state, ran); },
  }));
  const wt: WorldToolTurn = openWorldToolTurn(tools, onCall);
  const fallback: ToolExecutor = async () => ({ text: 'fallback' });
  const sentBack: string[][] = [];
  let n = 0;
  // A scripted stand-in for the stream's fetch seam: it records the Tool results each request carries.
  const fetchImpl = ((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    sentBack.push(body.messages.filter((m) => m.role === 'tool').map((m) => m.content));
    onRound(n);
    return Promise.resolve(replyOf(rounds[n++]));
  }) as unknown as typeof fetch;
  const shown: NarrationEvent[] = [];
  const run = output && openOutputRun(turnState({ worldScripts: output }), { triggers: wt.outputTriggers(tools) });
  const rewriting = run ? rewriteSentences(run.rewrite, (event) => shown.push(event)) : null;
  const narrationSink = run && rewriting ? narrationStream(run.listener, rewriting.listener) : () => {};
  const result: TurnResult = await runTurn({
    plan: planTurn(testInput({}, settings)),
    material: material(),
    signal,
    request: async (request, { signal: turnSignal }) => {
      const narration = request.type === 'narration';
      const text = await transportRequest(
        { ...request, signal: turnSignal, executeTool: wt.executor(fallback) }, context(tools, fetchImpl), narration ? narrationSink : () => {},
      );
      // The turn reads the narration its scripts left, as the game view's request does.
      return (narration && text && rewriting ? await rewriting.final() : undefined) ?? text;
    },
  });
  return { result, wt, live, sentBack, run, shown };
}

/** The After the AI batch as the turn lands it: the armed triggers, then the world's After Scripts. */
const afterBatch = (wt: WorldToolTurn, worldScripts: Script[] = []) =>
  runStatCodeTurn(turnState({ triggers: wt.armed('after'), worldScripts }));

const healthOf = (stats: readonly PlayerStat[]) => stats.find((s) => s.id === 'h')?.value;

describe('World Tools through a turn', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it('answers an After the AI call with its Reply, and its script\'s write lands with the turn', async () => {
    const { result, wt, sentBack } = await playTurn([heal()], [[['heal', { amount: 7 }]], 'You rest.']);
    expect(result.status).toBe('ok');
    expect(sentBack[1]).toEqual(['The healing takes hold.']);
    expect(healthOf((await afterBatch(wt)).stats)).toBe(17);
  });

  it('runs no code at the call: the reply comes back and nothing moved before the batch', async () => {
    const { live } = await playTurn([heal()], [[['heal', { amount: 7 }]], 'You rest.']);
    expect(live.landed).toEqual([]);
  });

  it('answers "Done." when the Reply is blank', async () => {
    const { sentBack } = await playTurn([heal({ reply: '  ' })], [[['heal', { amount: 1 }]], 'You rest.']);
    expect(sentBack[1]).toEqual([DEFAULT_REPLY]);
  });

  it('answers an On Call Tool with its script\'s value, and a later call reads the earlier one\'s write', async () => {
    const { sentBack, live } = await playTurn([roll], [[['roll', {}]], [['roll', {}]], 'You rest.']);
    expect(sentBack[1]).toEqual(['rolled 15']);
    expect(sentBack[2]).toEqual(['rolled 15', 'rolled 20']);
    expect(healthOf(live.state.state.stats)).toBe(20);
  });

  it('lands each On Call run at once, so the After batch reads its write', async () => {
    const { wt, live } = await playTurn([roll, heal()], [[['roll', {}], ['heal', { amount: 1 }]], 'You rest.']);
    expect(live.landed).toHaveLength(1);
    const batch = await runStatCodeTurn({ ...live.state, triggers: wt.armed('after') });
    expect(healthOf(batch.stats)).toBe(16);
  });

  it('answers a failing On Call script with an error and lands none of its writes', async () => {
    const broken = worldTool('broken', { code: "stats.Health.value = 99; throw new Error('no dice');" });
    const { sentBack, live } = await playTurn([broken], [[['broken', {}]], 'You rest.']);
    expect(JSON.parse(sentBack[1][0])).toEqual({ error: expect.stringContaining('no dice') });
    expect(live.landed).toEqual([]);
  });

  it('refuses arguments the Tool does not take, and arms nothing', async () => {
    const { sentBack, wt } = await playTurn([heal()], [[['heal', { amount: 'lots' }]], 'You rest.']);
    expect(JSON.parse(sentBack[1][0])).toEqual({ error: expect.stringContaining('amount') });
    expect(wt.armed('after')).toEqual([]);
  });

  it('with Stack Calls off, fires once with the later call\'s args', async () => {
    const { wt } = await playTurn([heal()], [[['heal', { amount: 1 }]], [['heal', { amount: 3 }]], 'You rest.']);
    expect(wt.armed('after').map((t) => t.args)).toEqual([{ amount: 3 }]);
    expect(healthOf((await afterBatch(wt)).stats)).toBe(13);
  });

  it('with Stack Calls on, fires every call in call order', async () => {
    const stacked = heal({ stack: true, code: 'stats.Health.value = args.amount;' });
    const { wt } = await playTurn([stacked], [[['heal', { amount: 1 }]], [['heal', { amount: 3 }]], 'You rest.']);
    expect(wt.armed('after').map((t) => t.args)).toEqual([{ amount: 1 }, { amount: 3 }]);
    // The later call's write wins the shared field.
    expect(healthOf((await afterBatch(wt)).stats)).toBe(3);
  });

  it('runs armed Tools in Tools-tab order, whatever order the AI called them in', async () => {
    const first = worldTool('first', { code: 'stats.Health.value = 1;', timing: 'after' });
    const second = worldTool('second', { code: 'stats.Health.value = 2;', timing: 'after' });
    const { wt } = await playTurn([first, second], [[['second', {}], ['first', {}]], 'You rest.']);
    expect(wt.armed('after').map((t) => t.name)).toEqual(['first', 'second']);
    expect(healthOf((await afterBatch(wt)).stats)).toBe(2);
  });

  it('runs an armed trigger before the world\'s After Scripts, ordered ones included, so a Script wins a shared field', async () => {
    const set50 = heal({ code: 'stats.Health.value = 50;' });
    const { wt } = await playTurn([set50], [[['heal', {}]], 'You rest.']);
    const script = (order?: number): Script => ({ id: 's', timing: 'after', code: 'stats.Health.value = 70;', ...(order === undefined ? {} : { order }) });
    expect(healthOf((await afterBatch(wt, [script()])).stats)).toBe(70);
    expect(healthOf((await afterBatch(wt, [script(0)])).stats)).toBe(70);
  });

  it('arms During AI Output Tools apart from After the AI ones', async () => {
    const filter = worldTool('filter', { code: 'narration.sentence = narration.sentence.toUpperCase();', timing: 'output' });
    const { wt } = await playTurn([filter, heal()], [[['filter', {}], ['heal', { amount: 1 }]], 'You rest.']);
    expect(wt.armed('output').map((t) => t.name)).toEqual(['filter']);
    expect(wt.armed('after').map((t) => t.name)).toEqual(['heal']);
  });

  it('hands a Lookup World Tool to the usual runner', async () => {
    const lookup: Tool = { ...worldTool('find', { code: '' }), handler: { kind: 'template', body: 'x' } };
    const { sentBack } = await playTurn([lookup], [[['find', {}]], 'You rest.']);
    expect(sentBack[1]).toEqual(['fallback']);
  });

  it('keeps nothing armed past a stopped turn: the next turn starts empty and reads its own state', async () => {
    const controller = new AbortController();
    const stopped = await playTurn([roll, heal()], [[['roll', {}], ['heal', { amount: 1 }]], 'You rest.'], {
      signal: controller.signal, onRound: (n) => { if (n === 1) controller.abort(); },
    });
    expect(stopped.result.status).toBe('aborted');
    // The view lands neither half of a stopped turn; the next turn opens its own.
    const next = await playTurn([roll, heal()], [[['roll', {}]], 'You rest.']);
    expect(next.sentBack[1]).toEqual(['rolled 15']);
    expect(next.wt.armed('after')).toEqual([]);
  });
});

/**
 * A stat re-roll over a turn's saved calls, as the game view replays it: the calls go through a save, the On
 * Call writes land on `start`, then the After batch fires the saved After calls.
 */
async function reroll(tools: readonly Tool[], calls: readonly TurnToolCall[], start = turnState()) {
  const { onCallWrites, afterTriggers } = replayedToolEffects(tools, JSON.parse(JSON.stringify(calls)) as TurnToolCall[]);
  const onCalled = onCallWrites.length
    ? afterRun(start, await runStatCodeTurn({ ...start, replayed: onCallWrites, triggersOnly: true }))
    : start;
  return runStatCodeTurn({ ...onCalled, triggers: afterTriggers });
}

describe('A stat re-roll replays the turn\'s Tool effects', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  const luck: PlayerStat = { ...health, id: 'l', name: 'Luck', max: 1e9, value: 0 };
  const lucky = worldTool('lucky', { code: 'stats.Luck.value = Math.floor(Math.random() * 1e9); return stats.Luck.value;' });
  const luckOf = (stats: readonly PlayerStat[]) => stats.find((s) => s.id === 'l')?.value;

  it('keeps each call\'s Tool id, args and timing, in call order', async () => {
    const filter = worldTool('filter', { code: 'narration.sentence = "x";', timing: 'output' });
    const { wt } = await playTurn([filter, heal()], [[['heal', { amount: 7 }], ['filter', {}]], 'You rest.']);
    expect(wt.calls()).toEqual([
      { toolId: 'tool-heal', args: { amount: 7 }, timing: 'after' },
      { toolId: 'tool-filter', args: {}, timing: 'output' },
    ]);
  });

  it('re-runs an After the AI call with its saved args, and its write survives', async () => {
    const { wt } = await playTurn([heal()], [[['heal', { amount: 7 }]], 'You rest.']);
    expect(healthOf((await reroll([heal()], wt.calls())).stats)).toBe(17);
  });

  it('fires the After batch the turn fired: with Stack Calls off, the later call only', async () => {
    const { wt } = await playTurn([heal()], [[['heal', { amount: 1 }]], [['heal', { amount: 3 }]], 'You rest.']);
    expect(healthOf((await reroll([heal()], wt.calls())).stats)).toBe(13);
  });

  it('reapplies an On Call write without running the script, so a random value matches the first run', async () => {
    const start = turnState({ stats: [luck], previous: [luck] });
    const { wt, live } = await playTurn([lucky], [[['lucky', {}]], 'You rest.'], { start });
    const first = luckOf(live.state.state.stats);
    expect(first).not.toBe(0);
    expect(luckOf((await reroll([lucky], wt.calls(), start)).stats)).toBe(first);
  });

  it('hands the After batch the replayed On Call write to build on', async () => {
    const { wt } = await playTurn([roll, heal()], [[['roll', {}], ['heal', { amount: 1 }]], 'You rest.']);
    expect(healthOf((await reroll([roll, heal()], wt.calls())).stats)).toBe(16);
  });

  it('replays no write for an On Call script that failed', async () => {
    const broken = worldTool('broken', { code: "stats.Health.value = 99; throw new Error('no dice');" });
    const { wt } = await playTurn([broken], [[['broken', {}]], 'You rest.']);
    expect(replayedToolEffects([broken], wt.calls()).onCallWrites).toEqual([]);
  });

  it('fires no During AI Output call, as a re-roll runs no output Script', async () => {
    const filter = worldTool('filter', { code: 'stats.Health.value = 1;', timing: 'output' });
    const { wt } = await playTurn([filter], [[['filter', {}]], 'You rest.']);
    expect(replayedToolEffects([filter], wt.calls())).toEqual({ onCallWrites: [], afterTriggers: [] });
  });
});

describe('During AI Output World Tools through a turn', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  const filter = (name: string, code: string, over: Partial<Tool> = {}) => worldTool(name, { code, timing: 'output' }, over);
  const tag = (name: string) => filter(name, `narration.sentence = narration.sentence + '[${name}]';`);
  const outputScript = (code: string): Script => ({ id: 'out', timing: 'output', code });
  const sentences = (events: readonly NarrationEvent[]) => events.flatMap((e) => (e.type === 'sentence' ? [e.text] : []));
  const narrationOf = (result: TurnResult) => result.run.material.narration;

  it('rewrites every sentence after the call, and the saved narration is the rewrite', async () => {
    const upper = filter('upper', 'narration.sentence = narration.sentence.toUpperCase();');
    const { result, shown, sentBack } = await playTurn([upper], [[['upper', {}]], 'You rest. The fire crackles.'], { output: [] });
    expect(sentBack[1]).toEqual([DEFAULT_REPLY]);
    expect(sentences(shown)).toEqual(['YOU REST.', 'THE FIRE CRACKLES.']);
    expect(shown.find((e) => e.type === 'finished')).toEqual({ type: 'finished', text: 'YOU REST. THE FIRE CRACKLES.' });
    expect(narrationOf(result)).toBe('YOU REST. THE FIRE CRACKLES.');
  });

  it('leaves the narration as written when the AI calls no filter', async () => {
    const { result } = await playTurn([tag('a')], ['You rest.'], { output: [] });
    expect(narrationOf(result)).toBe('You rest.');
  });

  it('composes armed filters in Tools-tab order, then a world output Script sees their result', async () => {
    const { result } = await playTurn([tag('a'), tag('b')], [[['b', {}], ['a', {}]], 'You rest.'], {
      output: [outputScript("narration.sentence = narration.sentence + '[script]';")],
    });
    expect(narrationOf(result)).toBe('You rest.[a][b][script]');
  });

  it('reads the call\'s args, and with Stack Calls off a later call replaces the earlier one', async () => {
    const suffix = filter('suffix', 'narration.sentence = narration.sentence + args.amount;');
    const { result } = await playTurn([suffix], [[['suffix', { amount: 1 }]], [['suffix', { amount: 2 }]], 'You rest.'], { output: [] });
    expect(narrationOf(result)).toBe('You rest.2');
  });

  it('covers the whole narration when a Planning request armed it', async () => {
    const planned = { ...tag('a'), offeredTo: ['thinking', 'narration'] } satisfies Tool;
    const { result } = await playTurn([planned], [[['a', {}]], 'Plan.', 'You rest. You wake.'], {
      output: [], settings: { ...NARRATION_ONLY, thinkingMode: 'precall' },
    });
    expect(narrationOf(result)).toBe('You rest.[a] You wake.[a]');
  });

  it('stays armed through a retracted round: the run restarts and the filter writes on the kept round only', async () => {
    const counting = filter('count', "stats.Health.value += 1; narration.sentence = '<' + narration.sentence + '>';");
    const lookup: Tool = { ...worldTool('find', { code: '' }), handler: { kind: 'template', body: 'x' } };
    const { result, run, shown } = await playTurn([counting, lookup], [
      [['count', {}]], { text: 'Let me check. Hm', calls: [['find', {}]] }, 'The door creaks. Wind howls.',
    ], { output: [] });
    expect(shown.some((e) => e.type === 'retract')).toBe(true);
    expect(narrationOf(result)).toBe('<The door creaks.> <Wind howls.>');
    expect(healthOf((await run!.landing())!.stats)).toBe(12);
  });

  it('passes the sentence unchanged and keeps none of its writes when a filter throws', async () => {
    const broken = filter('broken', "stats.Health.value = 99; narration.sentence = 'lost'; throw new Error('no');");
    const { result, run } = await playTurn([broken], [[['broken', {}]], 'You rest.'], { output: [] });
    expect(narrationOf(result)).toBe('You rest.');
    expect(healthOf((await run!.landing())!.stats)).toBe(10);
  });

  it('opens the narration\'s run only for an output Tool that narration offers, or a trigger already armed', async () => {
    const upper = filter('upper', 'narration.sentence = narration.sentence.toUpperCase();');
    const wt = openWorldToolTurn([upper, heal()], async () => ({ reply: { text: '' } }));
    expect(wt.outputTriggers([heal()])).toBeUndefined();
    // Tools off, or an endpoint without Tool support, offers nothing.
    expect(wt.outputTriggers([])).toBeUndefined();
    expect(wt.outputTriggers([upper])?.()).toEqual([]);
    // A Planning call armed it, though narration does not offer it.
    await wt.executor(async () => ({ text: 'fallback' }))(upper, '{}', new AbortController().signal);
    expect(wt.outputTriggers([])?.().map((t) => t.name)).toEqual(['upper']);
  });

  it('fails a filter that calls player.tell, and the next filter still runs', async () => {
    const asks = filter('asks', "narration.sentence = 'lost'; player.tell('Hello.');");
    const { result } = await playTurn([asks, tag('b')], [[['asks', {}], ['b', {}]], 'You rest.'], { output: [] });
    expect(narrationOf(result)).toBe('You rest.[b]');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Tool asks'), expect.stringContaining('player.tell'));
  });
});

describe('World Tool fields on a user Tool', () => {
  // A name no catalog Tool holds, which a user Tool may take.
  const raw = (handler: Record<string, unknown>) => ({ ...roll, id: 'u1', name: 'dice', handler: { kind: 'script', code: 'return 1;', ...handler } });

  it('rejects a timing, a Reply or Stack Calls', () => {
    expect(parseTool(raw({ timing: 'after' }))).toEqual({ error: 'only a World Tool can have a timing, Reply or Stack Calls' });
    expect(parseTool(raw({ reply: 'Ok.' }))).toEqual({ error: 'only a World Tool can have a timing, Reply or Stack Calls' });
    expect(parseTool(raw({ stack: true }))).toEqual({ error: 'only a World Tool can have a timing, Reply or Stack Calls' });
    expect(parseTool(raw({}))).toHaveProperty('tool');
  });

  it('keeps a World Tool\'s fields, and drops Reply and Stack Calls from an On Call one', () => {
    expect(parseTool(raw({ timing: 'after', reply: 'Ok.', stack: true }), { world: true }))
      .toEqual({ tool: expect.objectContaining({ handler: { kind: 'script', code: 'return 1;', timing: 'after', reply: 'Ok.', stack: true } }) });
    expect(parseTool(raw({ timing: 'call', reply: 'Ok.', stack: true }), { world: true }))
      .toEqual({ tool: expect.objectContaining({ handler: { kind: 'script', code: 'return 1;', timing: 'call' } }) });
    expect(parseTool(raw({ timing: 'later' }), { world: true })).toEqual({ error: 'its timing is unknown' });
  });

  it('still cannot write from its script', async () => {
    const user = parseTool(raw({}));
    if (!('tool' in user)) throw new Error(user.error);
    const tool = { ...user.tool, handler: { kind: 'script' as const, code: 'stats.Health.value = 1; return "wrote";' } };
    // The write drops and lists, and the Tool runs on (Q44).
    expect(await runToolCall(tool, '{}', emptyToolSnapshot())).toEqual({
      text: 'wrote', warnings: ['Read-only fields. Writes ignored: stats.Health.value.'],
    });
  });
});

describe('importing a world\'s Tools', () => {
  it('drops a malformed and a duplicate-name World Tool, and names each with its reason', () => {
    const tools = [roll, { ...heal(), id: 'tool-other', name: 'ROLL' }, { ...heal(), handler: { kind: 'script', code: 'x', timing: 'soon' } }];
    const { world, warning } = withImportedWorldTools({ tools: tools as Tool[] });
    expect(world.tools).toEqual([roll]);
    expect(warning).toBe('Dropped 2 World Tools. "ROLL": another World Tool has its name; "heal": its timing is unknown.');
  });

  it('leaves a world with only good Tools as it is', () => {
    const world = { tools: [roll] };
    expect(withImportedWorldTools(world)).toEqual({ world, warning: null });
  });
});
