/**
 * @vitest-environment node
 * (The Stop case runs a real Tool script, and node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import rawWorld from '../../../testing/baseline/sedge-landing.json';
import { migrateWorld } from '@/lib/version';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { runToolCall } from '@/lib/tools/toolRunner';
import { toolSchema } from '@/lib/tools/toolSchema';
import { buildToolSnapshot } from '@/lib/tools/toolSnapshot';
import type { AssistantToolCallMessage, RequestMessage, Tool, ToolResultMessage, WireMessage } from '@/types';
import type { AiRequestBody, AiRequestSpec } from './aiRequestSpec';
import { AiStreamError } from './aiStream';
import { DEFAULT_TOOL_ROUND_CAP, streamAiToolLoop, type AiToolLoopEvent, type AiToolLoopOptions } from './toolLoop';

// --- Fixture: the Sedge Landing world behind the catalog's real entity lookup ------------------------------

const world: AuthoredWorld = migrateWorld(structuredClone(rawWorld));
const snapshot = buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? []);
const GET_ENTITY: Tool = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;
const BRAM_FACT = 'only one arm';
const ODETTE_FACT = 'burn scar';

/** A request whose offered functions are Tools, which the Tool Runner can run. */
type ToolRequestSpec = AiRequestSpec<RequestMessage, Tool>;

const spec = (tools: readonly Tool[] | null = [GET_ENTITY]): ToolRequestSpec => ({
  url: 'http://localhost:1234/v1/chat/completions',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
  body: {
    model: 'test-model',
    messages: [{ role: 'system', content: 'You narrate.' }, { role: 'user', content: 'I greet Bram.' }],
    max_tokens: 64,
    stream: true,
    ...(tools ? { tools: tools.map(toolSchema), tool_choice: 'auto' } : {}),
  },
  target: {
    endpointId: 'test-endpoint',
    url: 'http://localhost:1234/v1/chat/completions',
    apiToken: 'token',
    model: 'test-model',
    maxTokens: 64,
    localEngine: false,
    samplerOverrides: defaultEndpointSamplerOverrides(),
    reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: !!tools, sources: tools ? { tools: 'native' } : {} },
  },
  requestType: 'narration',
  samplerSources: {},
  ...(tools ? { tools } : {}),
});

const execute: AiToolLoopOptions['execute'] = (tool, args) => runToolCall(tool, args, snapshot);

// --- Scripted transport: one streamed response per request, every body recorded --------------------------

/** One SSE frame in the wire form the endpoints send. */
const frame = (delta: Record<string, unknown>, finishReason: string | null = null): string =>
  `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\n`;

/** The frames of a response that calls `name` once per argument set, then stops on `tool_calls`. */
const callFrames = (...calls: Array<[name: string, args: unknown]>): string[] => [
  ...calls.map(([name, args], index) => frame({ tool_calls: [{ index, id: `srv-${index}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] })),
  frame({}, 'tool_calls'),
];

/** A plain reply, streamed one token at a time. */
const proseFrames = (...tokens: string[]): string[] => [...tokens.map((content) => frame({ content })), frame({}, 'stop')];

/** A body that stays open after its frames until the abort errors it, like a real stopped fetch. */
function hangingResponse(signal: AbortSignal | undefined, frames: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal?.addEventListener('abort', () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    },
    pull(controller) {
      if (index < frames.length) { controller.enqueue(encoder.encode(frames[index++])); return; }
      return new Promise(() => {});
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

function streamingResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

type SentBody = AiRequestBody<WireMessage>;

interface Transport {
  fetchImpl: typeof fetch;
  /** Every request body, in send order. */
  sent: SentBody[];
}

/** A transport that answers request N with script entry N. A response that is a function builds itself from
 *  the request, so a test can hold the body open until an abort lands. */
function scripted(script: Array<string[] | ((signal: AbortSignal | undefined) => Response)>): Transport {
  const sent: SentBody[] = [];
  const fetchImpl = ((_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string) as SentBody);
    const entry = script[sent.length - 1];
    if (!entry) throw new Error(`Unscripted request #${sent.length}`);
    return Promise.resolve(typeof entry === 'function' ? entry(init.signal ?? undefined) : streamingResponse(entry));
  }) as unknown as typeof fetch;
  return { fetchImpl, sent };
}

async function run(transport: Transport, options: Partial<AiToolLoopOptions> = {}, s: ToolRequestSpec = spec()): Promise<AiToolLoopEvent[]> {
  const events: AiToolLoopEvent[] = [];
  for await (const event of streamAiToolLoop(s, { execute, fetchImpl: transport.fetchImpl, reasoningThrottleMs: 0, ...options })) events.push(event);
  return events;
}

const doneOf = (events: AiToolLoopEvent[]) => {
  const done = events.filter((e) => e.type === 'done');
  expect(done).toHaveLength(1);
  return (done[0] as Extract<AiToolLoopEvent, { type: 'done' }>).result;
};
const deltasOf = (events: AiToolLoopEvent[]) => events.filter((e) => e.type === 'delta').map((e) => (e as { delta: string }).delta);
const roundsOf = (events: AiToolLoopEvent[]) => events.filter((e) => e.type === 'toolRound').map((e) => (e as Extract<AiToolLoopEvent, { type: 'toolRound' }>).round);
const assistantOf = (body: SentBody) => body.messages.filter((m): m is AssistantToolCallMessage => m.role === 'assistant' && 'tool_calls' in m);
const toolMessagesOf = (body: SentBody) => body.messages.filter((m): m is ToolResultMessage => m.role === 'tool');
const errorOf = (text: string) => (JSON.parse(text) as { error: string }).error;

const NINE_ALNUM = /^[A-Za-z0-9]{9}$/;

// --- The loop -----------------------------------------------------------------------------------------------

describe('streamAiToolLoop: one lookup, then prose', () => {
  it('reassembles a call split across chunks, answers it, and sends the next round with the assistant and tool messages', async () => {
    const whole = callFrames(['get_entity', { name: 'Bram' }]).join('');
    const transport = scripted([[whole.slice(0, 40), whole.slice(40, 95), whole.slice(95)], proseFrames('Bram ', 'nods.')]);

    const events = await run(transport);

    expect(transport.sent).toHaveLength(2);
    const [first, second] = transport.sent;
    expect(first.tools).toEqual([toolSchema(GET_ENTITY)]);
    expect(first.tool_choice).toBe('auto');
    // The next round continues the same conversation with tools still on offer.
    expect(second.tools).toEqual([toolSchema(GET_ENTITY)]);
    expect(second.messages.slice(0, 2)).toEqual(first.messages);
    const [assistant] = assistantOf(second);
    expect(assistant.tool_calls).toHaveLength(1);
    expect(assistant.tool_calls[0].function).toEqual({ name: 'get_entity', arguments: JSON.stringify({ name: 'Bram' }) });
    const [tool] = toolMessagesOf(second);
    expect(tool.tool_call_id).toBe(assistant.tool_calls[0].id);
    expect(tool.content).toContain(BRAM_FACT);
    expect(doneOf(events).content).toBe('Bram nods.');
    expect(doneOf(events).finishReason).toBe('stop');
  });

  it('remaps outgoing call ids to nine alphanumeric characters and keeps each result matched to its call', async () => {
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }], ['get_entity', { name: 'Odette' }]), proseFrames('done')]);

    await run(transport);

    const [assistant] = assistantOf(transport.sent[1]);
    const tools = toolMessagesOf(transport.sent[1]);
    expect(assistant.tool_calls.map((c) => c.id)).toEqual(expect.arrayContaining([expect.stringMatching(NINE_ALNUM)]));
    expect(new Set(assistant.tool_calls.map((c) => c.id)).size).toBe(2);
    expect(assistant.tool_calls.some((c) => c.id.startsWith('srv-'))).toBe(false);
    expect(tools.map((t) => t.tool_call_id)).toEqual(assistant.tool_calls.map((c) => c.id));
    expect(tools[0].content).toContain(BRAM_FACT);
    expect(tools[1].content).toContain(ODETTE_FACT);
  });

  it('handles two calls in one response together: two results, one next round', async () => {
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }], ['get_entity', { name: 'Odette' }]), proseFrames('both')]);

    const events = await run(transport, { captureRounds: true });

    expect(transport.sent).toHaveLength(2);
    expect(toolMessagesOf(transport.sent[1])).toHaveLength(2);
    expect(roundsOf(events)).toHaveLength(1);
    expect(roundsOf(events)[0].calls.map((c) => c.arguments)).toEqual([JSON.stringify({ name: 'Bram' }), JSON.stringify({ name: 'Odette' })]);
  });

  it('leaves the caller\'s messages untouched, so the tool exchange never reaches the next turn\'s history', async () => {
    const s = spec();
    const before = structuredClone(s.body.messages);
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }]), proseFrames('x')]);

    const events = await run(transport, {}, s);

    expect(s.body.messages).toEqual(before);
    expect(doneOf(events).toolCalls).toEqual([]);
    expect(doneOf(events).content).not.toContain(BRAM_FACT);
  });

  it('carries the assistant content between rounds as null when the model wrote nothing', async () => {
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }]), proseFrames('x')]);
    await run(transport);
    expect(assistantOf(transport.sent[1])[0].content).toBeNull();
  });
});

describe('streamAiToolLoop: what reaches the reply', () => {
  it('streams text written in a tool round, then marks it void with toolCalls; the reply is the final round alone', async () => {
    const transport = scripted([
      [frame({ content: 'Let me look. ' }), ...callFrames(['get_entity', { name: 'Bram' }])],
      proseFrames('The ', 'ferryman ', 'waits.'),
    ]);

    const events = await run(transport);

    const marks = events.flatMap((e) => (e.type === 'delta' ? [e.delta] : e.type === 'toolCalls' ? ['<calls>'] : []));
    expect(marks).toEqual(['Let me look. ', '<calls>', 'The ', 'ferryman ', 'waits.']);
    expect(doneOf(events).content).toBe('The ferryman waits.');
    // The model still sees what it wrote, so the history it continues is its own.
    expect(assistantOf(transport.sent[1])[0].content).toBe('Let me look. ');
  });

  it('streams a tools-offered round live from its first visible character, before the round ends', async () => {
    const controller = new AbortController();
    const transport = scripted([(signal) => hangingResponse(signal, [frame({ content: 'The ' })])]);
    // A held delta never arrives while the body is open, so this backstop ends the stream for a clean failure.
    const backstop = setTimeout(() => controller.abort(), 200);

    const events: AiToolLoopEvent[] = [];
    for await (const event of streamAiToolLoop(spec(), { execute, fetchImpl: transport.fetchImpl, signal: controller.signal })) {
      if (event.type === 'delta' && !controller.signal.aborted) events.push(event);
      if (event.type === 'delta') controller.abort();
    }
    clearTimeout(backstop);

    expect(deltasOf(events)).toEqual(['The ']);
  });

  it('holds leading whitespace, then flushes it in order once visible text arrives', async () => {
    const events = await run(scripted([proseFrames('\n\n', 'No ', 'lookup.')]));
    expect(deltasOf(events)).toEqual(['\n\n', 'No ', 'lookup.']);
    expect(doneOf(events).content).toBe('\n\nNo lookup.');
  });

  it('never streams a tool round that wrote only whitespace', async () => {
    const transport = scripted([[frame({ content: '\n\n' }), ...callFrames(['get_entity', { name: 'Bram' }])], proseFrames('x')]);
    const events = await run(transport);
    expect(deltasOf(events)).toEqual(['x']);
  });

  it('echoes the round\'s reasoning on the assistant message under the field the server streamed', async () => {
    for (const field of ['reasoning_content', 'reasoning'] as const) {
      const transport = scripted([
        [frame({ [field]: 'Bram is involved.' }), ...callFrames(['get_entity', { name: 'Bram' }])],
        [frame({ [field]: 'Now write.' }), ...proseFrames('He nods.')],
      ]);

      const events = await run(transport);

      const [assistant] = assistantOf(transport.sent[1]);
      expect(assistant[field]).toBe('Bram is involved.');
      expect(assistant).not.toHaveProperty(field === 'reasoning' ? 'reasoning_content' : 'reasoning');
      // The player's reasoning block sees every round's thinking.
      expect(doneOf(events).reasoningText).toBe('Bram is involved.\n\nNow write.');
      expect(doneOf(events).reasoningField).toBe(field);
    }
  });

  it('sends no reasoning field on the assistant message when the round had none', async () => {
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }]), proseFrames('x')]);
    await run(transport);
    const [assistant] = assistantOf(transport.sent[1]);
    expect(assistant).not.toHaveProperty('reasoning');
    expect(assistant).not.toHaveProperty('reasoning_content');
  });

  it('streams live reasoning from every round as the running text so far', async () => {
    const transport = scripted([
      [frame({ reasoning: 'first' }), ...callFrames(['get_entity', { name: 'Bram' }])],
      [frame({ reasoning: 'second' }), ...proseFrames('x')],
    ]);

    const events = await run(transport);

    const live = events.filter((e) => e.type === 'reasoning').map((e) => (e as { text: string }).text);
    expect(live).toEqual(['first', 'first\n\nsecond']);
  });

  it('reports one response debug for the whole loop, so a consumer commits to the turn once', async () => {
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }]), proseFrames('x')]);
    const events = await run(transport);
    const debugKinds = events.filter((e) => e.type === 'debug').map((e) => (e as { debug: { kind: string } }).debug.kind);
    expect(debugKinds.filter((k) => k === 'response')).toHaveLength(1);
    expect(debugKinds.filter((k) => k === 'request')).toHaveLength(2);
  });

  it('spans the timings from the first round\'s start to the final round\'s end', async () => {
    let clock = 0;
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }]), proseFrames('x')]);
    const events = await run(transport, { now: () => (clock += 10) });
    const { timings } = doneOf(events);
    expect(timings.startedAt).toBe(10);
    expect(timings.endedAt).toBe(clock);
    expect(timings.firstContentAt).toBeGreaterThan(timings.firstTokenAt as number);
  });
});

describe('streamAiToolLoop: limits and bad calls end in a prose round', () => {
  const noTools = (body: SentBody) => {
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
  };

  it('answers a call past the Tool\'s own limit with a readable result and sends the next round without Tools', async () => {
    const limited: Tool = { ...GET_ENTITY, callLimit: 1 };
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }], ['get_entity', { name: 'Odette' }]), proseFrames('x')]);

    await run(transport, {}, spec([limited]));

    const [first, second] = toolMessagesOf(transport.sent[1]);
    expect(first.content).toContain(BRAM_FACT);
    expect(errorOf(second.content)).toMatch(/get_entity.*1 call/);
    noTools(transport.sent[1]);
  });

  it('counts calls across rounds against the global default when the Tool sets no limit', async () => {
    const transport = scripted([
      callFrames(['get_entity', { name: 'Bram' }]),
      callFrames(['get_entity', { name: 'Odette' }]),
      callFrames(['get_entity', { name: 'Bram' }]),
      proseFrames('x'),
    ]);

    await run(transport, { callLimit: 2 });

    expect(transport.sent).toHaveLength(4);
    expect(transport.sent[2].tools).toBeDefined();
    expect(errorOf(toolMessagesOf(transport.sent[3]).at(-1)!.content)).toMatch(/2 calls/);
    noTools(transport.sent[3]);
  });

  it('never sends more rounds than the cap: the last one goes out without Tools', async () => {
    const forever = Array.from({ length: DEFAULT_TOOL_ROUND_CAP + 3 }, () => callFrames(['get_entity', { name: 'Bram' }]));
    forever[DEFAULT_TOOL_ROUND_CAP - 1] = proseFrames('finally');
    const transport = scripted(forever);

    const events = await run(transport, { callLimit: 100 });

    expect(transport.sent).toHaveLength(DEFAULT_TOOL_ROUND_CAP);
    transport.sent.slice(0, -1).forEach((body) => expect(body.tools).toBeDefined());
    noTools(transport.sent.at(-1)!);
    expect(doneOf(events).content).toBe('finally');
  });

  it('answers a malformed call with the runner\'s readable error and finishes in prose', async () => {
    const transport = scripted([callFrames(['get_entity', { who: 'Bram' }]), proseFrames('x')]);

    const events = await run(transport, { captureRounds: true });

    const [tool] = toolMessagesOf(transport.sent[1]);
    expect(errorOf(tool.content)).toMatch(/Unknown parameter "who"/);
    noTools(transport.sent[1]);
    expect(roundsOf(events)[0].calls[0].failure).toBe('arguments');
  });

  it('answers an unknown Tool by name, lists the Tools it does have, and finishes in prose', async () => {
    const transport = scripted([callFrames(['get_weather', { city: 'Sedge' }]), proseFrames('x')]);

    const events = await run(transport, { captureRounds: true });

    const [tool] = toolMessagesOf(transport.sent[1]);
    expect(errorOf(tool.content)).toBe('Unknown Tool "get_weather". Tools: get_entity.');
    noTools(transport.sent[1]);
    expect(roundsOf(events)[0].calls[0].failure).toBe('unknown');
  });

  it('keeps offering Tools after a handler failure, which is the Tool\'s fault and not the model\'s', async () => {
    const broken: Tool = { ...GET_ENTITY, id: 'broken', name: 'broken', handler: { kind: 'lookup', source: 'entities', param: 'nope', returns: 'full' } };
    const transport = scripted([callFrames(['broken', { name: 'Bram' }]), proseFrames('x')]);

    await run(transport, {}, spec([broken]));

    expect(errorOf(toolMessagesOf(transport.sent[1])[0].content)).toMatch(/parameter "nope"/);
    expect(transport.sent[1].tools).toBeDefined();
  });

  it('ignores calls a model makes in a round that offered no Tools and takes its content as the reply', async () => {
    const transport = scripted([callFrames(['get_weather', {}]), [frame({ content: 'stubborn' }), ...callFrames(['get_weather', {}])]]);

    const events = await run(transport);

    expect(transport.sent).toHaveLength(2);
    expect(doneOf(events).content).toBe('stubborn');
  });
});

describe('streamAiToolLoop: Stop', () => {
  it('aborts mid-stream in a tool round: no further round is sent and nothing held is revealed', async () => {
    const controller = new AbortController();
    // The model thinks, then starts writing; Stop lands on the first thought, with the content already held.
    const transport = scripted([(signal) => hangingResponse(signal, [frame({ reasoning: 'hmm' }), frame({ content: 'peek ' })]), proseFrames('never')]);

    const events: AiToolLoopEvent[] = [];
    for await (const event of streamAiToolLoop(spec(), { execute, fetchImpl: transport.fetchImpl, reasoningThrottleMs: 0, signal: controller.signal })) {
      events.push(event);
      if (event.type === 'reasoning') controller.abort();
    }

    expect(transport.sent).toHaveLength(1);
    expect(doneOf(events).finishReason).toBe('aborted');
    expect(doneOf(events).content).toBe('');
    expect(deltasOf(events)).toEqual([]);
  });

  it('aborts after a tools-offered round streamed text: done carries the text the consumer already saw', async () => {
    const controller = new AbortController();
    const transport = scripted([(signal) => hangingResponse(signal, [frame({ content: 'The ' }), frame({ content: 'door' })])]);
    const backstop = setTimeout(() => controller.abort(), 200);

    const events: AiToolLoopEvent[] = [];
    for await (const event of streamAiToolLoop(spec(), { execute, fetchImpl: transport.fetchImpl, reasoningThrottleMs: 0, signal: controller.signal })) {
      events.push(event);
      if (event.type === 'delta' && event.delta === 'door') controller.abort();
    }
    clearTimeout(backstop);

    expect(deltasOf(events)).toEqual(['The ', 'door']);
    expect(doneOf(events).content).toBe('The door');
  });

  it('aborts while a Tool runs: its result is dropped and no further round is sent', async () => {
    const controller = new AbortController();
    const transport = scripted([callFrames(['get_entity', { name: 'Bram' }]), proseFrames('never')]);
    // Stop lands while the call is in flight, after the executor has started work.
    const stopping: AiToolLoopOptions['execute'] = async (tool, args) => {
      controller.abort();
      return runToolCall(tool, args, snapshot);
    };

    const events = await run(transport, { execute: stopping, signal: controller.signal });

    expect(transport.sent).toHaveLength(1);
    expect(doneOf(events).finishReason).toBe('aborted');
    expect(doneOf(events).content).toBe('');
  });

  it('bounds a spinning script by the sandbox deadline, then stops without a further round once Stop has landed', async () => {
    const controller = new AbortController();
    const slow: Tool = { ...GET_ENTITY, id: 'slow', name: 'slow', params: [], handler: { kind: 'script', code: 'while (true) {} return "never";' } };
    const transport = scripted([callFrames(['slow', {}]), proseFrames('never')]);
    // The script blocks the thread, so the Stop press queued behind it is seen once the deadline returns.
    const stopping: AiToolLoopOptions['execute'] = async (tool, args) => {
      const result = await runToolCall(tool, args, snapshot);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return result;
    };
    setTimeout(() => controller.abort(), 20);

    const events = await run(transport, { execute: stopping, signal: controller.signal }, spec([slow]));

    expect(transport.sent).toHaveLength(1);
    expect(doneOf(events).finishReason).toBe('aborted');
  });
});

describe('streamAiToolLoop: no Tools on the wire', () => {
  it('sends one plain request with the body unchanged when the spec offers no Tools', async () => {
    const transport = scripted([proseFrames('plain ', 'reply')]);
    const s = spec(null);

    const events = await run(transport, {}, s);

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toEqual(s.body);
    expect(deltasOf(events)).toEqual(['plain ', 'reply']);
    expect(doneOf(events).content).toBe('plain reply');
  });
});

describe('streamAiToolLoop: cut thoughts', () => {
  const CUT = 'Bram is involved, so I should look him up before';
  /** A round the server cut on length while the model was still thinking. */
  const cutFrames = (...before: string[]): string[] => [...before, frame({ reasoning_content: CUT }), frame({}, 'length')];

  /** Runs the loop to its end and returns the error it threw, with every event it yielded first. */
  async function runUntilThrow(transport: Transport, s: ToolRequestSpec = spec()): Promise<{ error: unknown; events: AiToolLoopEvent[] }> {
    const events: AiToolLoopEvent[] = [];
    try {
      for await (const event of streamAiToolLoop(s, { execute, fetchImpl: transport.fetchImpl, reasoningThrottleMs: 0 })) events.push(event);
    } catch (error) {
      return { error, events };
    }
    throw new Error('The loop finished without failing');
  }

  it.each([
    ['no Tools', null, undefined],
    ['Tools offered', [GET_ENTITY], undefined],
    ['no Tools, Answer Cap set', null, 5],
    ['Tools offered, Answer Cap set', [GET_ENTITY], 5],
  ] as const)(
    'fails a reasoning-only round that ends on length as a request failure, with no done (%s)',
    async (_label, tools, answerCap) => {
      const { error, events } = await runUntilThrow(scripted([cutFrames()]), { ...spec(tools), answerCap });

      expect(error).toBeInstanceOf(AiStreamError);
      expect(error).toMatchObject({ kind: 'cut-thought' });
      expect((error as AiStreamError).details).toContain('max_tokens: 64');
      expect(events.some((e) => e.type === 'done')).toBe(false);
    },
  );

  it('fails an Inline-mode round cut inside its <think> block', async () => {
    const { error } = await runUntilThrow(scripted([[frame({ content: '<think>' }), frame({ content: CUT }), frame({}, 'length')]]), spec(null));

    expect(error).toMatchObject({ kind: 'cut-thought' });
  });

  it('fails a round cut after a whitespace-only answer', async () => {
    const { error } = await runUntilThrow(scripted([cutFrames(frame({ content: '\n\n' }))]));

    expect(error).toMatchObject({ kind: 'cut-thought' });
  });

  it('fails a cut round after a lookup and keeps its reasoning out of every request body', async () => {
    const transport = scripted([
      [frame({ reasoning_content: 'Look up Bram.' }), ...callFrames(['get_entity', { name: 'Bram' }])],
      cutFrames(),
      // A loop that carried the cut thought forward would send this round.
      proseFrames('Bram waves.'),
    ]);

    const error = await run(transport).then(() => null, (e: unknown) => e);

    for (const body of transport.sent) expect(JSON.stringify(body)).not.toContain(CUT);
    expect(transport.sent).toHaveLength(2);
    expect(error).toMatchObject({ kind: 'cut-thought' });
  });

  it('runs the call of a round whose thought finished, even when the server then stopped it on length', async () => {
    const transport = scripted([
      [frame({ reasoning_content: 'Look up Bram.' }), ...callFrames(['get_entity', { name: 'Bram' }]).slice(0, -1), frame({}, 'length')],
      proseFrames('Bram waves.'),
    ]);

    const events = await run(transport);

    expect(transport.sent).toHaveLength(2);
    expect(toolMessagesOf(transport.sent[1])[0].content).toContain(BRAM_FACT);
    expect(doneOf(events)).toMatchObject({ content: 'Bram waves.', finishReason: 'stop' });
  });

  it('returns a server-cut answer as today, finishing on length', async () => {
    const events = await run(scripted([[frame({ reasoning_content: 'Write.' }), frame({ content: 'Bram waves and' }), frame({}, 'length')]]));

    expect(doneOf(events)).toMatchObject({ content: 'Bram waves and', finishReason: 'length' });
  });
});

describe('streamAiToolLoop: Tools running', () => {
  it('says which Tools a round calls before the first one runs, once per round with calls', async () => {
    const order: string[] = [];
    const logged: AiToolLoopOptions['execute'] = (tool, args, signal) => {
      order.push(`run ${tool.name}`);
      return execute(tool, args, signal);
    };
    const transport = scripted([
      callFrames(['get_entity', { name: 'Bram' }], ['get_entity', { name: 'Odette' }]),
      proseFrames('Both greet you.'),
    ]);
    for await (const event of streamAiToolLoop(spec(), { execute: logged, fetchImpl: transport.fetchImpl })) {
      if (event.type === 'toolCalls') order.push(`calls ${event.names.join(',')}`);
    }
    expect(order).toEqual(['calls get_entity,get_entity', 'run get_entity', 'run get_entity']);
  });

  it('says when the round after a call sends its first token, once per such round', async () => {
    const transport = scripted([
      callFrames(['get_entity', { name: 'Bram' }]),
      [frame({ reasoning: 'Odette too.' }), frame({ content: 'Also. ' }), ...callFrames(['get_entity', { name: 'Odette' }])],
      proseFrames('Both ', 'greet you.'),
    ]);
    const events = await run(transport);
    const marks = events.flatMap((e) => (e.type === 'toolCalls' || e.type === 'roundStarted' ? [e.type] : []));
    expect(marks).toEqual(['toolCalls', 'roundStarted', 'toolCalls', 'roundStarted']);
    const kinds = events.map((e) => e.type);
    // A round that thinks first starts at its first reasoning token.
    expect(kinds.indexOf('roundStarted')).toBeLessThan(kinds.indexOf('reasoning'));
    // The second mark comes before the reply round's first token.
    const replyAt = events.findIndex((e) => e.type === 'delta' && e.delta === 'Both ');
    expect(kinds.lastIndexOf('roundStarted')).toBeLessThan(replyAt);
  });

  it('says nothing for a round that ends in prose', async () => {
    const events = await run(scripted([proseFrames('Hello.')]));
    expect(events.some((e) => e.type === 'toolCalls' || e.type === 'roundStarted')).toBe(false);
  });
});

describe('streamAiToolLoop: silent capture', () => {
  const twoRounds = () => scripted([
    [frame({ reasoning: 'Need Bram.' }), ...callFrames(['get_entity', { name: 'Bram' }])],
    [frame({ content: 'Also Odette. ' }), ...callFrames(['get_entity', { name: 'Odette' }])],
    proseFrames('Both greet you.'),
  ]);

  it('records nothing with Show Silent Requests off', async () => {
    const events = await run(twoRounds(), { captureRounds: false });
    expect(roundsOf(events)).toEqual([]);
    expect(doneOf(events).content).toBe('Both greet you.');
  });

  it('records each tool round with its call, arguments, result and reasoning with Show Silent Requests on', async () => {
    const transport = twoRounds();
    const events = await run(transport, { captureRounds: true });

    const rounds = roundsOf(events);
    expect(rounds.map((r) => r.index)).toEqual([1, 2]);
    expect(rounds[0].reasoning).toBe('Need Bram.');
    expect(rounds[0].content).toBe('');
    expect(rounds[0].calls).toHaveLength(1);
    expect(rounds[0].calls[0]).toMatchObject({ name: 'get_entity', arguments: JSON.stringify({ name: 'Bram' }) });
    expect(rounds[0].calls[0].result).toContain(BRAM_FACT);
    expect(rounds[0].calls[0].id).toMatch(NINE_ALNUM);
    expect(rounds[0].messages).toEqual(transport.sent[0].messages);
    expect(rounds[1].content).toBe('Also Odette. ');
    expect(rounds[1].calls[0].result).toContain(ODETTE_FACT);
    expect(rounds[1].messages).toEqual(transport.sent[1].messages);
    // The final prose round is the reply, not a tool round.
    expect(rounds).toHaveLength(2);
  });
});

describe('streamAiToolLoop: Answer Cap', () => {
  const capped = (answerCap: number, tools: readonly Tool[] | null = null): ToolRequestSpec => ({ ...spec(tools), answerCap });
  // At a cap of 5 the answer holds 20 characters, so the cut lands inside the second piece.
  const LONG_PROSE = ['The door opens. ', 'Bram looks up and ', 'waves. ', 'He smiles.'];

  /** A transport for one response that remembers the signal its request was sent with. */
  function watched(frames: string[] | string): Transport & { signal: () => AbortSignal | undefined } {
    let seen: AbortSignal | undefined;
    const transport = scripted([(signal) => { seen = signal; return streamingResponse(typeof frames === 'string' ? [frames] : frames); }]);
    return { ...transport, signal: () => seen };
  }

  it.each([['no Tools', null], ['Tools offered', [GET_ENTITY]]] as const)(
    'aborts the request past the cap, trims to the last sentence end, and finishes on length (%s)',
    async (_label, tools) => {
      const transport = watched(proseFrames(...LONG_PROSE));

      const events = await run(transport, {}, capped(5, tools));

      expect(transport.signal()?.aborted).toBe(true);
      expect(doneOf(events)).toMatchObject({ content: 'The door opens.', finishReason: 'length', toolCalls: [] });
      expect(deltasOf(events).join('')).toBe('The door opens. Bram');
    },
  );

  it('keeps the raw cut text on a prompt other than narration, still finishing on length', async () => {
    const events = await run(watched(proseFrames(...LONG_PROSE)), {}, { ...capped(5), requestType: 'choices' });

    expect(doneOf(events)).toMatchObject({ content: 'The door opens. Bram', finishReason: 'length' });
  });

  it('keeps the cut text when the answer has no sentence end', async () => {
    const events = await run(watched(proseFrames('The door opens and ', 'Bram looks up')), {}, capped(5));

    expect(doneOf(events)).toMatchObject({ content: 'The door opens and B', finishReason: 'length' });
  });

  it('never counts reasoning, however long it runs', async () => {
    const thought = Array.from({ length: 10 }, () => frame({ reasoning: 'x'.repeat(400) }));
    const transport = watched([...thought, ...proseFrames('Bram waves.')]);

    const events = await run(transport, {}, capped(5));

    expect(transport.signal()?.aborted).toBe(false);
    expect(doneOf(events)).toMatchObject({ content: 'Bram waves.', finishReason: 'stop' });
    expect(doneOf(events).reasoningText).toHaveLength(4000);
  });

  it('gives the same trimmed text when every event arrives in one chunk, or the answer in one frame', async () => {
    const oneChunk = await run(watched(proseFrames(...LONG_PROSE).join('')), {}, capped(5));
    const oneFrame = await run(watched(proseFrames(LONG_PROSE.join(''))), {}, capped(5));

    for (const events of [oneChunk, oneFrame]) {
      expect(doneOf(events)).toMatchObject({ content: 'The door opens.', finishReason: 'length' });
      expect(deltasOf(events).join('')).toBe('The door opens. Bram');
    }
  });

  it('counts the answer from the close of a leading <think> block', async () => {
    const think = `<think>${'x'.repeat(300)}</think>`;
    const long = await run(watched(proseFrames('<think>', 'x'.repeat(300), '</think>', ...LONG_PROSE)), {}, capped(5));
    const short = await run(watched(proseFrames('<think>', 'x'.repeat(300), '</think>', 'Bram waves.')), {}, capped(5));

    expect(doneOf(long)).toMatchObject({ content: `${think}The door opens.`, finishReason: 'length' });
    expect(doneOf(short)).toMatchObject({ content: `${think}Bram waves.`, finishReason: 'stop' });
  });

  it('counts each round on its own, so text a tool round wrote takes none of the reply\'s room', async () => {
    const transport = scripted([
      [frame({ content: 'Let me check. ' }), ...callFrames(['get_entity', { name: 'Bram' }])],
      proseFrames('The door opens.'),
    ]);

    const events = await run(transport, {}, capped(5, [GET_ENTITY]));

    expect(doneOf(events)).toMatchObject({ content: 'The door opens.', finishReason: 'stop' });
  });

  it('finishes a player cancel as aborted, not length, with a cap set', async () => {
    const controller = new AbortController();
    const transport = scripted([(signal) => hangingResponse(signal, [frame({ content: 'The ' })])]);

    const events: AiToolLoopEvent[] = [];
    for await (const event of streamAiToolLoop(capped(5), { fetchImpl: transport.fetchImpl, reasoningThrottleMs: 0, signal: controller.signal })) {
      events.push(event);
      if (event.type === 'delta') controller.abort();
    }

    expect(doneOf(events)).toMatchObject({ content: 'The ', finishReason: 'aborted' });
  });

  it('finishes a player cancel that lands on the cut as aborted, with the text the consumer saw', async () => {
    const controller = new AbortController();
    const transport = watched(proseFrames(...LONG_PROSE));

    const events: AiToolLoopEvent[] = [];
    for await (const event of streamAiToolLoop(capped(5), { fetchImpl: transport.fetchImpl, reasoningThrottleMs: 0, signal: controller.signal })) {
      events.push(event);
      if (event.type === 'delta' && event.content.length >= 20) controller.abort();
    }

    expect(doneOf(events)).toMatchObject({ content: 'The door opens. Bram', finishReason: 'aborted', toolCalls: [] });
  });
});
