import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamAiRequest, AiStreamError, ABORTED_FINISH_REASON, type AiStreamEvent } from './aiStream';
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

  /** A body that behaves like a real aborted fetch: the in-flight read rejects with AbortError rather
   *  than resolving done, and nothing arrives after the first frame until the abort lands. */
  function abortableBody(signal: AbortSignal, first: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let sent = false;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        // Registered at construction, before the module gets its reader — the same ordering as a real
        // fetch, whose own abort listener errors the body before any consumer-side cancel can run.
        signal.addEventListener('abort', () => {
          const error = new Error('The user aborted a request.');
          error.name = 'AbortError';
          controller.error(error);
        }, { once: true });
      },
      pull(controller) {
        if (!sent) { sent = true; controller.enqueue(encoder.encode(first)); return; }
        return new Promise(() => {}); // nothing more arrives; only the abort ends this read
      },
    });
  }

  it('ends gracefully with the partial content when aborted mid-stream', async () => {
    const controller = new AbortController();
    const response = { ok: true, status: 200, body: abortableBody(controller.signal, frame({ content: 'kept' })) } as unknown as Response;

    const events: AiStreamEvent[] = [];
    for await (const event of streamAiRequest(spec, { fetchImpl: fetchOf(response), signal: controller.signal })) {
      events.push(event);
      if (event.type === 'delta') controller.abort();
    }

    const done = doneOf(events);
    expect(done.result.finishReason).toBe('aborted');
    expect(done.result.content).toBe('kept');
  });

  it('ends gracefully when the abort lands while a read is in flight', async () => {
    const controller = new AbortController();
    // The consumer is awaiting the next event, so the generator is parked inside `reader.read()` — the
    // ordering a real Stop press hits, where the read rejects instead of resolving done.
    const response = { ok: true, status: 200, body: abortableBody(controller.signal, frame({ content: 'kept' })) } as unknown as Response;

    const events: AiStreamEvent[] = [];
    const pump = (async () => {
      for await (const event of streamAiRequest(spec, { fetchImpl: fetchOf(response), signal: controller.signal })) events.push(event);
    })();
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await pump;

    const done = doneOf(events);
    expect(done.result.finishReason).toBe('aborted');
    expect(done.result.content).toBe('kept');
  });

  it('ends gracefully when the fetch itself rejects on abort', async () => {
    const controller = new AbortController();
    controller.abort();
    const rejectingFetch = (() => {
      const error = new Error('The user aborted a request.');
      error.name = 'AbortError';
      return Promise.reject(error);
    }) as unknown as typeof fetch;

    const events = await collect(streamAiRequest(spec, { fetchImpl: rejectingFetch, signal: controller.signal }));

    expect(doneOf(events).result.finishReason).toBe('aborted');
  });

  it('rethrows a network failure so a dead endpoint surfaces instead of hanging', async () => {
    const failingFetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;

    await expect(collect(streamAiRequest(spec, { fetchImpl: failingFetch }))).rejects.toThrow('Failed to fetch');
  });

  it('still throws a non-abort read failure', async () => {
    const body = new ReadableStream<Uint8Array>({ pull() { throw new Error('connection reset'); } });

    await expect(collect(streamAiRequest(spec, { fetchImpl: fetchOf({ ok: true, status: 200, body } as unknown as Response) })))
      .rejects.toThrow('connection reset');
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

  it('keeps emitting live reasoning through a whitespace-only content frame', async () => {
    // Models routinely lead with a newline before the real output. Treating that as the start of content
    // would cut the scratchpad off mid-thought and stamp the think time at the wrong moment.
    const events = await collect(streamAiRequest(spec, {
      reasoningThrottleMs: 0,
      fetchImpl: fetchOf(streamingResponse([
        frame({ reasoning: 'pre' }),
        frame({ content: '\n' }),
        frame({ reasoning: 'still thinking' }),
        frame({ content: 'go' }),
        frame({ reasoning: 'post' }),
      ])),
    }));

    expect(events.filter((e) => e.type === 'reasoning').map((e) => (e as { text: string }).text))
      .toEqual(['pre', 'prestill thinking']);
  });

  it('stamps the first content time at the first visible character, not at leading whitespace', async () => {
    let clock = 1000;
    const events = await collect(streamAiRequest(spec, {
      now: () => (clock += 10),
      fetchImpl: fetchOf(streamingResponse([frame({ content: '  ' }), frame({ content: 'x' })])),
    }));

    const { timings, content } = doneOf(events).result;
    expect(content).toBe('  x');
    // The blank frame is skipped, so the mark lands on the second frame's tick, not the first's.
    expect(timings.firstContentAt as number).toBeGreaterThan(timings.firstTokenAt as number);
  });

  it('reports a response debug once the endpoint has accepted the request', async () => {
    const events = await collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([frame({ content: 'hi' })])),
    }));

    const debugKinds = events.filter((e) => e.type === 'debug').map((e) => (e as { debug: { kind: string } }).debug.kind);
    expect(debugKinds).toEqual(['request', 'response']);
    // It must precede every token, so a consumer can use it to commit to the turn.
    expect(events.findIndex((e) => e.type === 'debug' && e.debug.kind === 'response'))
      .toBeLessThan(events.findIndex((e) => e.type === 'delta'));
  });

  it('reports no response debug when the endpoint rejects the request', async () => {
    await expect(collect(streamAiRequest(spec, {
      fetchImpl: fetchOf(streamingResponse([], { ok: false, status: 500 })),
    }))).rejects.toThrow(AiStreamError);
  });

  it('reports no response debug when the fetch is aborted before it resolves', async () => {
    const controller = new AbortController();
    controller.abort();
    const events = await collect(streamAiRequest(spec, {
      signal: controller.signal,
      fetchImpl: (() => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))) as unknown as typeof fetch,
    }));

    expect(events.some((e) => e.type === 'debug' && e.debug.kind === 'response')).toBe(false);
    expect(doneOf(events).result.finishReason).toBe(ABORTED_FINISH_REASON);
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
