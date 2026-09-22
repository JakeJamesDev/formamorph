import { afterEach, describe, expect, it, vi } from 'vitest';
import rawWorld from '../sedge-landing.json';
import { migrateWorld } from '@/lib/version';
import {
  MAIN_ACTION,
  CONTROL_ACTION,
  EndpointRejectionError,
  PROBE_TOOLS,
  createProbeTransport,
  lookupEntityInfo,
  prepareNarrationToolCallReview,
  prepareNarrationToolCallCase,
  runNarrationToolCallBatch,
  runNarrationToolCallTrial,
  type ProbeRequest,
  type ProbeTransport,
} from './narration-tool-call-probe';

const world = () => migrateWorld(structuredClone(rawWorld));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function toolCall(id: string, name: string, args: unknown) {
  return { id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } };
}

function scriptedTransport(responses: unknown[]): ProbeTransport & { requests: ProbeRequest[] } {
  const requests: ProbeRequest[] = [];
  return {
    requests,
    async send(request) {
      requests.push(structuredClone(request));
      if (responses.length === 0) throw new Error('Script exhausted.');
      return responses.shift();
    },
  };
}

describe('narration tool-call probe preparation', () => {
  it('renders the main case through production helpers without leaking full entity facts', () => {
    const prepared = prepareNarrationToolCallCase({
      caseId: 'main',
      action: MAIN_ACTION,
      sourceRevision: 'test-revision',
      world: world(),
    });

    expect(prepared.request).toMatchObject({
      model: 'default',
      max_tokens: 1024,
      reasoning_effort: 'none',
      stream: false,
      tool_choice: 'auto',
      tools: PROBE_TOOLS,
    });
    expect(prepared.request).not.toHaveProperty('temperature');
    expect(prepared.request).not.toHaveProperty('repetition_penalty');
    expect(prepared.request.messages).toHaveLength(2);
    expect(prepared.request.messages[0]).toMatchObject({ role: 'system' });
    expect(prepared.request.messages[1]).toEqual({
      role: 'user',
      content: `${MAIN_ACTION}\n\nThe player's action is the turn's first beat, written as it happens - an action that speaks reaches the page as the player's own quoted sentences, carrying the feeling the action names, and then the character answers in their own quoted voice with something of their own.`,
    });

    const system = prepared.request.messages[0].content;
    expect(system).toContain('## Entity information');
    expect(system).toContain('Submit the finished story through write');
    expect(system).toContain("- **Bram**\n  - **description:** The one-armed ferryman who won't cross after dark.");
    expect(system).toContain('- **Odette**\n  - **description:** The scarred eel-smoker waiting to cross; distrusts strangers.');
    expect(system).not.toContain('his left sleeve is pinned up');
    expect(system).not.toContain('green glass bead braided into her hair');
    expect(system).not.toMatch(/<[A-Z][A-Z _-]*(?:\|[^>\n]+)?>/);
  });

  it.each([
    ['summary fallback', (migrated: ReturnType<typeof world>) => { migrated.entities.find((entity) => entity.id === 'ent-bram')!.aiSummary = ''; }, 'Full description leaked'],
    ['unresolved token', (migrated: ReturnType<typeof world>) => { migrated.worldOverview.systemPrompt += ' <BROKEN TOKEN>'; }, 'Unresolved prompt token'],
    ['withheld fact', (migrated: ReturnType<typeof world>) => { migrated.worldOverview.systemPrompt += ' His left sleeve is pinned up.'; }, 'Withheld fact leaked'],
  ])('rejects %s before a transport can run', async (_label, mutate, message) => {
    const migrated = world();
    mutate(migrated);
    let calls = 0;
    const transport: ProbeTransport = { async send() { calls++; return {}; } };

    await expect(runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: migrated, transport,
    })).rejects.toThrow(message);
    expect(calls).toBe(0);
  });

  it('prepares the exact main and control requests without a transport', () => {
    const review = prepareNarrationToolCallReview(world(), 'test-revision');
    expect(review).toMatchObject({
      kind: 'narration-tool-call-preparation',
      sourceRevision: 'test-revision',
      cloudBehaviorUntested: true,
    });
    expect(review.cases.map((probeCase) => probeCase.caseId)).toEqual(['main', 'control']);
    expect(review.cases[0].request.messages[1].content).toContain(MAIN_ACTION);
    expect(review.cases[1].request.messages[1].content).toContain(CONTROL_ACTION);
  });
});

describe('narration tool-call probe lookup', () => {
  it('returns verbatim descriptions for exact names and approved aliases', () => {
    const migrated = world();
    const bram = migrated.entities.find((entity) => entity.id === 'ent-bram')!;

    expect(lookupEntityInfo(migrated.entities, '  FERRYMAN  ')).toEqual({
      matches: [{ id: bram.id, name: bram.name, description: bram.aiDescription }],
    });
    expect(lookupEntityInfo(migrated.entities, 'Bram')).toEqual({
      matches: [{ id: bram.id, name: bram.name, description: bram.aiDescription }],
    });
  });

  it('returns empty unknown results and every ambiguous exact-name match', () => {
    const entities = world().entities;
    const duplicate = { ...entities[0], id: 'ent-bram-double' };

    expect(lookupEntityInfo(entities, 'nobody here')).toEqual({ matches: [] });
    expect(lookupEntityInfo([...entities, duplicate], 'bram').matches.map((match) => match.id))
      .toEqual(['ent-bram', 'ent-bram-double']);
  });
});

describe('narration tool-call probe trial', () => {
  it('supports sequential lookups and finishes on a terminal write', async () => {
    const first = toolCall('call-bram', 'request_info', { term: 'Bram' });
    const second = toolCall('call-odette', 'request_info', { term: 'Odette' });
    const terminal = toolCall('call-write', 'write', { narration: 'You greet them beside the pale water.' });
    const transport = scriptedTransport([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [first] } }], usage: { prompt_tokens: 100 } },
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [second] } }], usage: { prompt_tokens: 140 } },
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [terminal] } }], usage: { completion_tokens: 20 } },
    ]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main',
      action: MAIN_ACTION,
      sourceRevision: 'test-revision',
      world: world(),
      transport,
    });

    expect(result.status).toBe('succeeded');
    expect(result.narration).toBe('You greet them beside the pale water.');
    expect(result.requestCount).toBe(3);
    expect(result.lookupCount).toBe(2);
    expect(result.requests).toHaveLength(3);
    expect(result.requests.every((exchange) => exchange.durationMs >= 0)).toBe(true);
    expect(result.usage).toEqual({ prompt_tokens: 240, completion_tokens: 20 });

    expect(transport.requests[1].messages.slice(-2)).toEqual([
      { role: 'assistant', content: null, tool_calls: [first] },
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-bram' }),
    ]);
    expect(JSON.parse(transport.requests[1].messages.at(-1)!.content!)).toMatchObject({
      matches: [{ id: 'ent-bram', name: 'Bram' }],
    });
    expect(transport.requests[2].messages.slice(-2)).toEqual([
      { role: 'assistant', content: null, tool_calls: [second] },
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-odette' }),
    ]);
  });

  it('supports batched and unknown lookups before the terminal write', async () => {
    const batched = [
      toolCall('call-bram', 'request_info', { term: 'Bram' }),
      toolCall('call-unknown', 'request_info', { term: 'nobody here' }),
    ];
    const terminal = toolCall('call-write', 'write', { narration: 'The ferryman watches you from the raft.' });
    const transport = scriptedTransport([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: batched } }] },
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [terminal] } }] },
    ]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result.status).toBe('succeeded');
    expect(result.lookupCount).toBe(2);
    expect(result.toolResults[1].result).toEqual({ matches: [] });
    expect(transport.requests[1].messages.slice(-3)).toEqual([
      { role: 'assistant', content: null, tool_calls: batched },
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-bram' }),
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-unknown' }),
    ]);
  });

  it('accepts a direct control write with no lookup', async () => {
    const transport = scriptedTransport([
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('call-write', 'write', { narration: 'Pale water presses soundlessly against the pilings.' }),
      ] } }] },
    ]);
    const result = await runNarrationToolCallTrial({
      caseId: 'control', action: CONTROL_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result).toMatchObject({ status: 'succeeded', requestCount: 1, lookupCount: 0 });
  });

  it.each([
    ['malformed arguments', [toolCall('bad-json', 'request_info', { term: 'Bram' })], 'invalid_arguments'],
    ['unexpected arguments', [toolCall('extra-field', 'request_info', { term: 'Bram', limit: 1 })], 'invalid_arguments'],
    ['wrong argument type', [toolCall('wrong-type', 'request_info', { term: 12 })], 'invalid_arguments'],
    ['unknown function', [toolCall('unknown', 'search_everywhere', { term: 'Bram' })], 'unknown_function'],
    ['duplicate identifiers', [
      toolCall('same-id', 'request_info', { term: 'Bram' }),
      toolCall('same-id', 'request_info', { term: 'Odette' }),
    ], 'duplicate_call_id'],
    ['multiple writes', [
      toolCall('write-a', 'write', { narration: 'One.' }),
      toolCall('write-b', 'write', { narration: 'Two.' }),
    ], 'multiple_writes'],
    ['mixed lookup and write', [
      toolCall('lookup', 'request_info', { term: 'Bram' }),
      toolCall('write', 'write', { narration: 'Too soon.' }),
    ], 'mixed_calls'],
    ['empty narration', [toolCall('write', 'write', { narration: '   ' })], 'invalid_arguments'],
  ])('records %s and makes no follow-up request', async (label, calls, failureKind) => {
    if (label === 'malformed arguments') calls[0].function.arguments = '{not json';
    const raw = { choices: [{ message: { role: 'assistant', content: null, tool_calls: calls } }] };
    const transport = scriptedTransport([raw]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result).toMatchObject({ status: 'failed', failure: { kind: failureKind }, requestCount: 1 });
    expect(result.requests[0].response).toEqual(raw);
    expect(transport.requests).toHaveLength(1);
  });

  it('does not treat function-looking prose as a native call', async () => {
    const raw = { choices: [{ message: { role: 'assistant', content: 'write({"narration":"not native"})' } }] };
    const transport = scriptedTransport([raw]);
    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result).toMatchObject({ status: 'failed', failure: { kind: 'missing_write' }, requestCount: 1 });
    expect(transport.requests).toHaveLength(1);
  });

  it('fails repeated lookups at the request budget without a fifth request', async () => {
    const transport = scriptedTransport([0, 1, 2, 3].map((round) => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall(`lookup-${round}`, 'request_info', { term: 'Bram' }),
      ] } }],
    })));
    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result).toMatchObject({
      status: 'failed', failure: { kind: 'request_budget_exhausted' }, requestCount: 4, lookupCount: 4,
    });
    expect(transport.requests).toHaveLength(4);
  });

  it('records four lookups and stops when a fifth exhausts the lookup budget', async () => {
    const raw = { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
      toolCall('lookup-1', 'request_info', { term: 'Bram' }),
      toolCall('lookup-2', 'request_info', { term: 'Odette' }),
      toolCall('lookup-3', 'request_info', { term: 'Rope Ferry' }),
      toolCall('lookup-4', 'request_info', { term: 'Tomas' }),
      toolCall('lookup-5', 'request_info', { term: 'Wick' }),
    ] } }] };
    const transport = scriptedTransport([raw]);

    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result).toMatchObject({
      status: 'failed',
      failure: { kind: 'lookup_budget_exhausted' },
      requestCount: 1,
      lookupCount: 4,
    });
    expect(result.requests[0].response).toEqual(raw);
    expect(result.toolResults).toHaveLength(4);
    expect(transport.requests).toHaveLength(1);
  });

  it('records cancellation and timeout without another request', async () => {
    const waitForAbort: ProbeTransport = {
      send: (_request, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    };
    const controller = new AbortController();
    const canceled = runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(),
      transport: waitForAbort, signal: controller.signal,
    });
    controller.abort();
    await expect(canceled).resolves.toMatchObject({ status: 'canceled', failure: { kind: 'canceled' }, requestCount: 1 });

    await expect(runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(),
      transport: waitForAbort, requestTimeoutMs: 5,
    })).resolves.toMatchObject({ status: 'failed', failure: { kind: 'request_timeout' }, requestCount: 1 });
  });

  it('stops a batch on endpoint rejection', async () => {
    let calls = 0;
    const transport: ProbeTransport = {
      async send() {
        calls++;
        throw new EndpointRejectionError(400, { error: 'unsupported tools' });
      },
    };
    const batch = await runNarrationToolCallBatch({
      sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(batch.trials).toHaveLength(1);
    expect(batch.trials[0]).toMatchObject({ status: 'failed', failure: { kind: 'endpoint_rejection' } });
    expect(calls).toBe(1);
  });

  it('runs two fresh main trials followed by two fresh controls', async () => {
    const responses = [0, 1, 2, 3].map((index) => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall(`write-${index}`, 'write', { narration: `Narration ${index}` }),
      ] } }],
    }));
    const transport = scriptedTransport(responses);
    const batch = await runNarrationToolCallBatch({ sourceRevision: 'test-revision', world: world(), transport });

    expect(batch.trials.map((trial) => trial.caseId)).toEqual(['main-1', 'main-2', 'control-1', 'control-2']);
    expect(batch.trials.every((trial) => trial.status === 'succeeded')).toBe(true);
    expect(transport.requests.map((request) => request.messages)).toEqual([
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(MAIN_ACTION) }]),
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(MAIN_ACTION) }]),
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(CONTROL_ACTION) }]),
      expect.arrayContaining([{ role: 'user', content: expect.stringContaining(CONTROL_ACTION) }]),
    ]);
    expect(transport.requests.every((request) => request.messages.length === 2)).toBe(true);
  });

  it('carries the selected model and seed through every local request', async () => {
    const responses = [
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('lookup-bram', 'request_info', { term: 'Bram' }),
      ] } }] },
      ...[0, 1, 2, 3].map((index) => ({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall(`write-${index}`, 'write', { narration: `Narration ${index}` }),
      ] } }],
      })),
    ];
    const transport = scriptedTransport(responses);

    await runNarrationToolCallBatch({
      sourceRevision: 'test-revision',
      world: world(),
      transport,
      model: 'rocinante-x-12b-v1',
      seed: 424242,
    });

    expect(transport.requests).toHaveLength(5);
    expect(transport.requests.every((request) =>
      request.model === 'rocinante-x-12b-v1' && request.seed === 424242)).toBe(true);
  });

  it('cleans the request timeout after a completed call', async () => {
    vi.useFakeTimers();
    const transport = scriptedTransport([{ choices: [{ message: {
      role: 'assistant', content: null,
      tool_calls: [toolCall('write', 'write', { narration: 'Done.' })],
    } }] }]);
    const result = await runNarrationToolCallTrial({
      caseId: 'control', action: CONTROL_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });
    expect(result.status).toBe('succeeded');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('narration tool-call cloud transport', () => {
  it('posts the prepared request once and keeps credentials outside recorded evidence', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('write', 'write', { narration: 'Done.' }),
      ] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const transport = createProbeTransport({ token: 'secret-token', fetchImpl: fetchMock });
    const result = await runNarrationToolCallTrial({
      caseId: 'control', action: CONTROL_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.lyonade.net/v1/chat/completions');
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('surfaces the endpoint status and response body without retrying', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ error: { message: 'tools unsupported' } }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    ));
    const transport = createProbeTransport({ fetchImpl: fetchMock });
    const result = await runNarrationToolCallTrial({
      caseId: 'main', action: MAIN_ACTION, sourceRevision: 'test-revision', world: world(), transport,
    });

    expect(result).toMatchObject({ status: 'failed', failure: { kind: 'endpoint_rejection' }, requestCount: 1 });
    expect(result.requests[0].error).toEqual({
      name: 'EndpointRejectionError',
      message: 'HTTP 422: {"error":{"message":"tools unsupported"}}',
      status: 422,
      responseBody: { error: { message: 'tools unsupported' } },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
