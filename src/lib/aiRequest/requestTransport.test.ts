import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from '@/types';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseFrame, sseResponse, sseTokens, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { AiStreamError } from './aiStream';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import type { ResponseSchema } from './responseSchema';
import type { ToolExecutor } from './toolLoop';
import { narrationStream } from './narrationStream';
import {
  transportRequest, type TransportContext, type TransportEvent, type TransportRequest, type TransportTarget,
} from './requestTransport';

// --- A fake AI Stream: scripted SSE bodies behind the stream's own fetch seam -----------------------------

/** A body that streams `frames`, then stays open until the request is stopped, which errors it. */
const hanging = (frames: string[], signal: AbortSignal | undefined, onDrained: () => void): Response => {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal?.addEventListener('abort', () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    },
    pull(controller) {
      if (index < frames.length) { controller.enqueue(encoder.encode(frames[index++])); return; }
      onDrained();
      return new Promise(() => {});
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
};

type Script = Array<(init: RequestInit) => Response | Promise<Response>>;

const scripted = (script: Script) => {
  let sent = 0;
  return ((_url: string, init: RequestInit) => {
    const entry = script[sent++];
    if (!entry) throw new Error(`Unscripted request #${sent}`);
    return Promise.resolve(entry(init));
  }) as unknown as typeof fetch;
};

// --- Context ----------------------------------------------------------------------------------------------

const target = (over: Partial<TransportTarget> = {}): TransportTarget => ({
  ...textTarget({
    url: 'https://api.example.test/v1/chat/completions',
    apiToken: 'token',
    model: 'test-model',
    maxTokens: 400,
    reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } },
  }),
  presetId: null,
  presetName: 'Cloud',
  ...over,
});

// A real catalog Tool, offered to narration; the request's own executor answers its calls.
const LOOKUP: Tool = { ...TOOL_CATALOG.find((t) => t.id === 'get_entity')!, offeredTo: ['narration'] };

const context = (fetchImpl: typeof fetch, over: Partial<TransportContext> = {}): TransportContext => ({
  settings: textSnapshot(target()),
  resolveEndpoint: () => target(),
  tools: [],
  worldTools: [],
  enabledTools: {},
  toolsEnabled: false,
  toolSnapshot: () => { throw new Error('No request here builds its own Tool Snapshot'); },
  showSilentRequests: false,
  noteReasoningReply: () => {},
  noteSchemaRejected: () => {},
  fetchImpl,
  ...over,
});

const request = (over: Partial<TransportRequest> = {}): TransportRequest => ({
  systemPrompt: 'You narrate.',
  messages: [{ role: 'user', content: 'I walk to the dock.' }],
  type: 'narration',
  ...over,
});

/** Sends one request and records every event its sink saw. */
const send = async (req: TransportRequest, ctx: TransportContext) => {
  const events: TransportEvent[] = [];
  const text = await transportRequest(req, ctx, (event) => events.push(event));
  return { text, events, types: events.map((e) => e.type) };
};

/** Like {@link send}, for a request that rejects. */
const sendFailing = async (req: TransportRequest, ctx: TransportContext) => {
  const events: TransportEvent[] = [];
  const error = await transportRequest(req, ctx, (event) => events.push(event)).then(
    () => { throw new Error('Expected the request to fail'); },
    (e: unknown) => e,
  );
  return { error, events, types: events.map((e) => e.type) };
};

const rejection = (param: string) => () => new Response(JSON.stringify({
  error: { message: `${param} is not supported`, type: 'invalid_request_error', param },
}), { status: 400 });

afterEach(() => vi.restoreAllMocks());
// The transport logs every failure it classifies; the tests read the sink instead.
const quietErrors = () => vi.spyOn(console, 'error').mockImplementation(() => {});

// --- Tests ------------------------------------------------------------------------------------------------

describe('a plain reply', () => {
  it('answers the stripped final text and reports open, deltas and done in order', async () => {
    const fetchImpl = scripted([() => sseResponse(sseTokens(['<think>hm</think>', 'The gulls ', 'cry.']))]);
    const { text, types, events } = await send(request(), context(fetchImpl));
    expect(text).toBe('The gulls cry.');
    expect(types).toEqual(['requestCaptured', 'opened', 'delta', 'delta', 'delta', 'responseCaptured', 'done']);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'The gulls cry.', raw: '<think>hm</think>The gulls cry.' });
  });

  it('captures the wire body with the request and the raw reply with the response', async () => {
    const fetchImpl = scripted([() => sseResponse(sseTokens(['<think>hm</think>', 'Rain.']))]);
    const { events } = await send(request(), context(fetchImpl));
    const captured = events.find((e) => e.type === 'requestCaptured');
    const answered = events.find((e) => e.type === 'responseCaptured');
    if (captured?.type !== 'requestCaptured' || answered?.type !== 'responseCaptured') throw new Error('Both captures expected');
    // The wire list leads with the system message the request stated separately.
    expect(captured.record.messages).toEqual([
      { role: 'system', content: 'You narrate.' },
      { role: 'user', content: 'I walk to the dock.' },
    ]);
    expect(captured.record.endpoint?.model).toBe('test-model');
    expect(captured.attachTo).toBeNull();
    expect(answered.id).toBe(captured.record.id);
    expect(answered.response.response).toBe('<think>hm</think>Rain.');
  });

  it('notes the reasoning capability from the raw reply', async () => {
    const noteReasoningReply = vi.fn();
    const fetchImpl = scripted([() => sseResponse(sseTokens(['<think>hm</think>', 'Rain.']))]);
    await send(request(), context(fetchImpl, { noteReasoningReply }));
    expect(noteReasoningReply).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model' }), '', '<think>hm</think>Rain.', null);
  });
});

describe("Gemma's thought channel in the content", () => {
  // The reply shape the cloud endpoint gave with a judgment Tool offered: the channel tokens kept, then the story.
  const SPILL = ['<|channel>', 'thought\nThe user wants a scene. ', 'Plan: the harbor.', '<channel|>', 'The gulls ', 'cry.'];

  it('answers the story alone and keeps the thought out of every narration sentence', async () => {
    const sentences: string[] = [];
    const fetchImpl = scripted([() => sseResponse(sseTokens(SPILL))]);
    const events: TransportEvent[] = [];
    const sink = narrationStream((event) => { if (event.type === 'sentence') sentences.push(event.text); });
    const text = await transportRequest(request(), context(fetchImpl), (event) => { events.push(event); sink(event); });

    expect(text).toBe('The gulls cry.');
    expect(sentences).toEqual(['The gulls cry.']);
    expect(events.at(-1)).toMatchObject({ type: 'done', raw: SPILL.join('') });
  });
});

describe('the length cap', () => {
  it('trims a capped narration to its last complete sentence', async () => {
    const fetchImpl = scripted([() => sseResponse(sseTokens(['The tide turns. The boat ', 'drifts to'], 'length'))]);
    const { text, events } = await send(request(), context(fetchImpl));
    expect(text).toBe('The tide turns.');
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'The tide turns.' });
  });

  it('leaves a capped stats reply whole', async () => {
    const fetchImpl = scripted([() => sseResponse(sseTokens(['Health: -2. Gold: +', '5'], 'length'))]);
    const { text } = await send(request({ type: 'statUpdates' }), context(fetchImpl));
    expect(text).toBe('Health: -2. Gold: +5');
  });
});

describe('stopping a request', () => {
  it('answers empty text and never opens when stopped before the endpoint answers', async () => {
    const controller = new AbortController();
    const fetchImpl = scripted([(init) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      controller.abort();
    })]);
    const { text, types } = await send(request({ signal: controller.signal }), context(fetchImpl));
    expect(text).toBe('');
    expect(types).not.toContain('opened');
    expect(types).not.toContain('canceled');
    expect(types).not.toContain('done');
  });

  it('emits canceled, and nothing after it, when stopped after text arrived', async () => {
    const controller = new AbortController();
    const fetchImpl = scripted([(init) => hanging(sseTokens(['The gulls '], 'stop').slice(0, 1), init.signal ?? undefined, () => controller.abort())]);
    const { text, types } = await send(request({ signal: controller.signal }), context(fetchImpl));
    expect(text).toBe('');
    expect(types).toEqual(['requestCaptured', 'opened', 'delta', 'canceled']);
  });
});

describe('a Tool round after streamed text', () => {
  const callFrames = [
    sseFrame({ content: 'Let me check the ledger.' }),
    sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: LOOKUP.name, arguments: '{}' } }] }),
    sseFrame({}, 'tool_calls'),
  ];
  const executeTool: ToolExecutor = async () => ({ text: 'Maela keeps the ledger.' });

  it('retracts the streamed text and answers only the next round', async () => {
    const fetchImpl = scripted([() => sseResponse(callFrames), () => sseResponse(sseTokens(['Maela ', 'smiles.']))]);
    const ctx = context(fetchImpl, { tools: [LOOKUP], enabledTools: { [LOOKUP.id]: true }, toolsEnabled: true });
    const { text, types, events } = await send(request({ executeTool }), ctx);
    expect(text).toBe('Maela smiles.');
    expect(types.indexOf('retract')).toBeGreaterThan(types.indexOf('delta'));
    expect(types.indexOf('toolCalls')).toBe(types.indexOf('retract') + 1);
    expect(types).toContain('roundStarted');
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Maela smiles.' });
    expect(JSON.stringify(events.at(-1))).not.toContain('ledger');
  });

  it('retracts once when a later round calls again without text', async () => {
    const fetchImpl = scripted([() => sseResponse(callFrames), () => sseResponse(callFrames.slice(1)), () => sseResponse(sseTokens(['Maela smiles.']))]);
    const ctx = context(fetchImpl, { tools: [LOOKUP], enabledTools: { [LOOKUP.id]: true }, toolsEnabled: true });
    const { types } = await send(request({ executeTool }), ctx);
    expect(types.filter((t) => t === 'toolCalls')).toHaveLength(2);
    expect(types.filter((t) => t === 'retract')).toHaveLength(1);
  });

  it('retracts nothing when the round streamed no text', async () => {
    const fetchImpl = scripted([() => sseResponse(callFrames.slice(1)), () => sseResponse(sseTokens(['Maela smiles.']))]);
    const ctx = context(fetchImpl, { tools: [LOOKUP], enabledTools: { [LOOKUP.id]: true }, toolsEnabled: true });
    const { types } = await send(request({ executeTool }), ctx);
    expect(types).not.toContain('retract');
    expect(types).toContain('toolCalls');
  });
});

describe('World Tools', () => {
  const ROLL: Tool = {
    id: 'w-roll', name: 'roll_fate', description: 'Purpose: roll.', params: [],
    handler: { kind: 'template', body: 'Fate says yes.' }, emptyResult: '', offeredTo: ['narration'],
  };
  const offeredNames = (init: RequestInit) =>
    ((JSON.parse(String(init.body)) as { tools?: { function: { name: string } }[] }).tools ?? []).map((t) => t.function.name);
  const callRoll = [
    sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: ROLL.name, arguments: '{}' } }] }),
    sseFrame({}, 'tool_calls'),
  ];

  it('sends a World Tool the preset switches off, and names it when the AI calls it', async () => {
    const sent: RequestInit[] = [];
    const fetchImpl = scripted([(init) => { sent.push(init); return sseResponse(callRoll); }, () => sseResponse(sseTokens(['Yes.']))]);
    const executeTool = vi.fn<ToolExecutor>(async () => ({ text: 'Fate says yes.' }));
    const ctx = context(fetchImpl, { worldTools: [ROLL], enabledTools: { [ROLL.id]: false }, toolsEnabled: true });
    const { events } = await send(request({ executeTool }), ctx);
    expect(offeredNames(sent[0])).toEqual(['roll_fate']);
    expect(executeTool.mock.calls[0].slice(0, 2)).toEqual([ROLL, '{}']);
    expect(events).toContainEqual({ type: 'toolCalls', names: ['roll_fate'] });
  });

  it('sends no World Tool with the global Tools switch off', async () => {
    const sent: RequestInit[] = [];
    const fetchImpl = scripted([(init) => { sent.push(init); return sseResponse(sseTokens(['Yes.'])); }]);
    await send(request(), context(fetchImpl, { worldTools: [ROLL], toolsEnabled: false }));
    expect(offeredNames(sent[0])).toEqual([]);
  });

  it('sends a World Tool in place of the catalog Tool it is named after', async () => {
    const sent: RequestInit[] = [];
    const fetchImpl = scripted([(init) => { sent.push(init); return sseResponse(sseTokens(['Yes.'])); }]);
    const mine = { ...ROLL, name: LOOKUP.name };
    const ctx = context(fetchImpl, { tools: [LOOKUP], enabledTools: { [LOOKUP.id]: true }, worldTools: [mine], toolsEnabled: true });
    await send(request({ executeTool: async () => ({ text: '' }) }), ctx);
    const body = JSON.parse(String(sent[0].body)) as { tools: { function: { name: string; description: string } }[] };
    expect(body.tools.map((t) => t.function)).toEqual([expect.objectContaining({ name: LOOKUP.name, description: mine.description })]);
  });
});

describe('failures', () => {
  it('throws a silent failure without a failure event', async () => {
    quietErrors();
    const fetchImpl = scripted([() => new Response('down', { status: 503 })]);
    const { error, types } = await sendFailing(request({ type: 'summary', silent: true, attachTurnId: 't1' }), context(fetchImpl));
    expect(error).toBeInstanceOf(AiStreamError);
    expect(types).not.toContain('failure');
  });

  it('classifies a foreground failure once', async () => {
    quietErrors();
    const fetchImpl = scripted([() => new Response('down', { status: 503 })]);
    const { events } = await sendFailing(request(), context(fetchImpl));
    expect(events.filter((e) => e.type === 'failure')).toEqual([
      { type: 'failure', failure: { kind: 'request', error: expect.any(AiStreamError) } },
    ]);
  });

  it('emits a rejected override notice even on a silent request', async () => {
    quietErrors();
    const overrides = defaultEndpointSamplerOverrides();
    overrides.topP = { enabled: true, value: 0.9 };
    const ctx = context(scripted([rejection('top_p')]), { resolveEndpoint: () => target({ samplerOverrides: overrides }) });
    const { events } = await sendFailing(request({ type: 'summary', silent: true, attachTurnId: 't1' }), ctx);
    expect(events.filter((e) => e.type === 'failure')).toEqual([{
      type: 'failure',
      failure: { kind: 'rejectedOverride', error: expect.any(AiStreamError), override: 'topP', endpointId: 'cloud', presetName: 'Cloud' },
    }]);
  });
});

describe('a refused schema', () => {
  it('retries once on the text pass, notes the endpoint, and shows no failure', async () => {
    quietErrors();
    const noteSchemaRejected = vi.fn();
    const refused = () => new Response(JSON.stringify({ error: { message: 'response_format is not supported' } }), { status: 400 });
    const ctx = context(scripted([refused, () => sseResponse(sseTokens(['Health: -2']))]), { noteSchemaRejected });
    const schema: ResponseSchema = { name: 'stats', schema: { type: 'object', properties: {}, required: [], additionalProperties: false } };
    const { text, types } = await send(request({ type: 'statUpdates', responseSchema: schema, textFallback: { systemPrompt: 'Answer in lines.' } }), ctx);
    expect(text).toBe('Health: -2');
    expect(noteSchemaRejected).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model' }));
    expect(types).not.toContain('failure');
    expect(types.filter((t) => t === 'requestCaptured')).toHaveLength(2);
  });
});

describe('silent capture', () => {
  it('captures a silent request onto its own turn only with Show Silent Requests on', async () => {
    const silent = request({ type: 'summary', silent: true, attachTurnId: 't1' });
    const off = await send(silent, context(scripted([() => sseResponse(sseTokens(['A digest.']))])));
    expect(off.types).not.toContain('requestCaptured');
    expect(off.types).not.toContain('responseCaptured');

    const on = await send(silent, context(scripted([() => sseResponse(sseTokens(['A digest.']))]), { showSilentRequests: true }));
    expect(on.events.find((e) => e.type === 'requestCaptured')).toMatchObject({ attachTo: 't1' });
    expect(on.events.find((e) => e.type === 'responseCaptured')).toMatchObject({ attachTo: 't1' });
  });
});

describe('a presentation error', () => {
  it('logs a sink that throws on a token and carries the request on', async () => {
    const logged = quietErrors();
    const fetchImpl = scripted([() => sseResponse(sseTokens(['The gulls ', 'cry.']))]);
    const text = await transportRequest(request(), context(fetchImpl), (event) => {
      if (event.type === 'delta') throw new Error('bad split');
    });
    expect(text).toBe('The gulls cry.');
    expect(logged).toHaveBeenCalled();
  });
});
