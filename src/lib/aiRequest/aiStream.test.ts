import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamAiRequest, AiStreamError, type AiStreamEvent } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';

const spec: AiRequestSpec = {
  url: 'http://localhost:1234/v1/chat/completions',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
  body: { model: 'test-model', messages: [{ role: 'user', content: 'hi' }], max_tokens: 64, stream: true },
  target: {
    url: 'http://localhost:1234/v1/chat/completions',
    apiToken: 'token',
    model: 'test-model',
    maxTokens: 64,
    localEngine: false,
    supportedReasoningEfforts: null,
  },
  requestType: 'narration',
};

/** A response whose body yields exactly the given chunks, so tests control every split point. */
function streamingResponse(chunks: string[], init?: { ok?: boolean; status?: number; body?: boolean }): Response {
  const encoder = new TextEncoder();
  const body = init?.body === false ? null : new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok: init?.ok ?? true, status: init?.status ?? 200, body } as unknown as Response;
}

function fetchOf(response: Response, seen?: { url?: string; init?: RequestInit }): typeof fetch {
  return ((url: string, init: RequestInit) => {
    if (seen) { seen.url = url; seen.init = init; }
    return Promise.resolve(response);
  }) as unknown as typeof fetch;
}

/** One SSE frame, in the wire form the endpoints send. */
function frame(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\n`;
}

async function collect(events: AsyncIterable<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const out: AiStreamEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

function doneOf(events: AiStreamEvent[]) {
  const done = events.filter((e) => e.type === 'done');
  expect(done).toHaveLength(1);
  return done[0] as Extract<AiStreamEvent, { type: 'done' }>;
}

afterEach(() => { vi.useRealTimers(); });

describe('streamAiRequest', () => {
  it('yields one delta per content token and a done carrying the joined content', async () => {
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([frame({ content: 'Hello' }), frame({ content: ' world' }), 'data: [DONE]\n\n'])),
    }));

    expect(events.filter((e) => e.type === 'delta').map((e) => (e as { delta: string }).delta)).toEqual(['Hello', ' world']);
    expect(doneOf(events).result.content).toBe('Hello world');
  });

  it('parses events split across chunk boundaries', async () => {
    const whole = frame({ content: 'split me' });
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([whole.slice(0, 12), whole.slice(12, 30), whole.slice(30)])),
    }));

    expect(doneOf(events).result.content).toBe('split me');
  });

  it('processes a final line that arrives without a trailing newline', async () => {
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([`data: ${JSON.stringify({ choices: [{ delta: { content: 'tail' } }] })}`])),
    }));

    expect(doneOf(events).result.content).toBe('tail');
  });

  it('accumulates both the reasoning and reasoning_content spellings', async () => {
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([frame({ reasoning: 'think ' }), frame({ reasoning_content: 'more' }), frame({ content: 'out' })])),
    }));

    expect(doneOf(events).result.reasoningText).toBe('think more');
  });

  it('reports the finish reason from the frame that carries it', async () => {
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([frame({ content: 'cut' }, 'length')])),
    }));

    expect(doneOf(events).result.finishReason).toBe('length');
  });

  it('skips a malformed JSON line and reports it as a debug event without losing later content', async () => {
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([frame({ content: 'a' }), 'data: {not json\n\n', frame({ content: 'b' })])),
    }));

    expect(doneOf(events).result.content).toBe('ab');
    const parseDebug = events.filter((e) => e.type === 'debug' && e.debug.kind === 'parse');
    expect(parseDebug).toHaveLength(1);
  });

  it('emits the built request body and url as a debug event before streaming', async () => {
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([frame({ content: 'x' })])),
    }));

    const first = events[0];
    expect(first.type).toBe('debug');
    expect(first).toMatchObject({ debug: { kind: 'request', url: spec.url, body: spec.body } });
  });

  it('sends the spec url, headers and body to fetch', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    await collect(streamAiRequest(spec, { fetchImpl: fetchOf(streamingResponse([frame({ content: 'x' })]), seen) }));

    expect(seen.url).toBe(spec.url);
    expect(seen.init?.method).toBe('POST');
    expect(seen.init?.headers).toEqual(spec.headers);
    expect(JSON.parse(seen.init?.body as string)).toEqual(spec.body);
  });

  it('throws a typed http error carrying the status', async () => {
    const iterator = streamAiRequest(spec, { fetchImpl: fetchOf(streamingResponse([], { ok: false, status: 503 })) });

    await expect(collect(iterator)).rejects.toMatchObject({ kind: 'http', status: 503 });
    await expect(collect(streamAiRequest(spec, { fetchImpl: fetchOf(streamingResponse([], { ok: false, status: 503 })) })))
      .rejects.toBeInstanceOf(AiStreamError);
  });

  it('throws a typed no-body error when the response has no stream', async () => {
    await expect(collect(streamAiRequest(spec, { fetchImpl: fetchOf(streamingResponse([], { body: false })) })))
      .rejects.toMatchObject({ kind: 'no-body' });
  });

  it('ends gracefully with the partial content when aborted mid-stream', async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(encoder.encode(frame({ content: 'kept' })));
        // Nothing more arrives, and the stream never closes — only the abort ends the read.
      },
    });
    const response = { ok: true, status: 200, body } as unknown as Response;

    const events: AiStreamEvent[] = [];
    for await (const event of streamAiRequest(spec, { fetchImpl: fetchOf(response), signal: controller.signal })) {
      events.push(event);
      if (event.type === 'delta') controller.abort();
    }

    const done = doneOf(events);
    expect(done.result.finishReason).toBe('aborted');
    expect(done.result.content).toBe('kept');
  });

  it('throttles reasoning events to one per throttle window', async () => {
    vi.useFakeTimers();
    const frames = ['a', 'b', 'c', 'd'].map((text) => frame({ reasoning: text }));
    // Each read advances the clock by 30 ms, so only every third frame clears the 80 ms window.
    const encoder = new TextEncoder();
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        vi.advanceTimersByTime(30);
        if (index >= frames.length) { controller.close(); return; }
        controller.enqueue(encoder.encode(frames[index++]));
      },
    });

    const events = await collect(streamAiRequest(spec, { fetchImpl: fetchOf({ ok: true, status: 200, body } as unknown as Response) }));

    const reasoning = events.filter((e) => e.type === 'reasoning') as Extract<AiStreamEvent, { type: 'reasoning' }>[];
    expect(reasoning.map((e) => e.text)).toEqual(['a', 'abcd']);
    expect(doneOf(events).result.reasoningText).toBe('abcd');
  });

  it('stops emitting live reasoning once content has begun', async () => {
    const events = await collect(streamAiRequest(spec, {
      reasoningThrottleMs: 0,
      fetchImpl: fetchOf(streamingResponse([frame({ reasoning: 'pre' }), frame({ content: 'go' }), frame({ reasoning: 'post' })])),
    }));

    expect(events.filter((e) => e.type === 'reasoning').map((e) => (e as { text: string }).text)).toEqual(['pre']);
    expect(doneOf(events).result.reasoningText).toBe('prepost');
  });

  it('times the first token and the first content token separately', async () => {
    let clock = 1000;
    const events = await collect(streamAiRequest(spec, {
      now: () => (clock += 10),
      fetchImpl: fetchOf(streamingResponse([frame({ reasoning: 'r' }), frame({ content: 'c' })])),
    }));

    const { timings } = doneOf(events).result;
    expect(timings.firstTokenAt).not.toBeNull();
    expect(timings.firstContentAt).not.toBeNull();
    expect(timings.firstContentAt as number).toBeGreaterThan(timings.firstTokenAt as number);
    expect(timings.endedAt).toBeGreaterThanOrEqual(timings.startedAt);
  });

  it('leaves both first-token timings null when the stream yields nothing', async () => {
    const events = await collect(streamAiRequest(spec, { fetchImpl: fetchOf(streamingResponse(['data: [DONE]\n\n'])) }));

    const { timings } = doneOf(events).result;
    expect(timings.firstTokenAt).toBeNull();
    expect(timings.firstContentAt).toBeNull();
  });
});
