/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerStat, Script, Tool, ToolScriptHandler } from '@/types';
import { transportRequest, type TransportContext } from '@/lib/aiRequest/requestTransport';
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { afterRun, runStatCodeTurn, type StatCodeTurn, type StatCodeTurnResult } from '@/lib/statCodeTurn';
import { planTurn } from '@/lib/turnPipeline/planTurn';
import { runTurn, type TurnResult } from '@/lib/turnPipeline/turnRunner';
import { testInput } from '@/lib/turnPipeline/turnTestInputs';
import type { TurnMaterial } from '@/lib/turnPipeline/turnPlan';
import { sseFrame, sseResponse, sseTokens, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { onCallRunner } from './onCallRunner';
import { runToolCall } from './toolRunner';
import { emptyToolSnapshot } from './toolSnapshot';
import { parseTool } from './toolValidation';
import { withImportedWorldTools } from './worldTools';
import { DEFAULT_REPLY, openWorldToolTurn, type WorldToolTurn } from './worldToolTurn';

const health: PlayerStat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 200, value: 10, regen: 0, descriptors: [],
};

/** A turn's state for its scripts, Health at 10 and nothing else in play. */
const turnState = (over: Partial<StatCodeTurn> = {}): StatCodeTurn => ({
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

/** One model reply: a round of Tool calls, each `[name, args]`, or the narration text. */
type Round = [string, Record<string, unknown>][] | string;

const toolRound = (calls: [string, Record<string, unknown>][]) => sseResponse([
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
 */
async function playTurn(tools: readonly Tool[], rounds: Round[], { signal = new AbortController().signal, onRound = (_n: number) => {} } = {}) {
  const live: { state: StatCodeTurn; landed: StatCodeTurnResult[] } = { state: turnState(), landed: [] };
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
    const round = rounds[n++];
    return Promise.resolve(typeof round === 'string' ? sseResponse(sseTokens([round])) : toolRound(round));
  }) as unknown as typeof fetch;
  const result: TurnResult = await runTurn({
    plan: planTurn(testInput({}, NARRATION_ONLY)),
    material: material(),
    signal,
    request: (request, { signal: turnSignal }) => (request.type === 'narration'
      ? transportRequest({ ...request, signal: turnSignal, executeTool: wt.executor(fallback) }, context(tools, fetchImpl), () => {})
      : Promise.resolve('')),
  });
  return { result, wt, live, sentBack };
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
    expect(healthOf(live.state.stats)).toBe(20);
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
    expect(await runToolCall(tool, '{}', emptyToolSnapshot())).toEqual({ text: expect.stringContaining('stats'), failure: 'script' });
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
