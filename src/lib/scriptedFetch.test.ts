import { describe, it, expect } from 'vitest';
import { streamAiRequest, ABORTED_FINISH_REASON, type AiStreamEvent } from './aiRequest/aiStream';
import type { AiRequestSpec } from './aiRequest/aiRequestSpec';
import { defaultEndpointSamplerOverrides } from './endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from './reasoningEffort';
import { scriptedFetch } from './scriptedFetch';

const spec: AiRequestSpec = {
  url: 'http://localhost:1234/v1/chat/completions',
  headers: { 'Content-Type': 'application/json' },
  body: { model: 'test-model', messages: [{ role: 'user', content: 'hi' }], max_tokens: 64, stream: true },
  target: {
    endpointId: 'test-endpoint',
    url: 'http://localhost:1234/v1/chat/completions',
    apiToken: '',
    model: 'test-model',
    maxTokens: 64,
    localEngine: false,
    samplerOverrides: defaultEndpointSamplerOverrides(),
    reasoning: UNKNOWN_REASONING_CAPABILITY,
  },
  requestType: 'narration',
  samplerSources: {},
};

async function collect(fetchImpl: typeof fetch, signal?: AbortSignal) {
  const events: AiStreamEvent[] = [];
  for await (const event of streamAiRequest(spec, { fetchImpl, signal })) events.push(event);
  return events;
}

describe('scriptedFetch', () => {
  it('streams the text as deltas at the schedule, and ends with the whole text', async () => {
    const text = 'The door opens. A lamp flickers.';
    const events = await collect(scriptedFetch(text, [{ atMs: 0, chars: 9 }, { atMs: 5, chars: 16 }, { atMs: 10, chars: text.length }]));
    const deltas = events.flatMap((e) => (e.type === 'delta' ? [e.delta] : []));
    expect(deltas).toEqual(['The door ', 'opens. ', 'A lamp flickers.']);
    const done = events.find((e) => e.type === 'done');
    expect(done?.type === 'done' && done.result.content).toBe(text);
  });

  it('sends what the schedule left out when it ends', async () => {
    const events = await collect(scriptedFetch('Short reply', [{ atMs: 0, chars: 5 }]));
    const done = events.find((e) => e.type === 'done');
    expect(done?.type === 'done' && done.result.content).toBe('Short reply');
  });

  it('stops when the request is aborted mid-stream', async () => {
    const controller = new AbortController();
    const fetchImpl = scriptedFetch('one two three', [{ atMs: 0, chars: 4 }, { atMs: 60_000, chars: 13 }]);
    setTimeout(() => controller.abort(), 20);
    const events = await collect(fetchImpl, controller.signal);
    const done = events.find((e) => e.type === 'done');
    expect(done?.type === 'done' && done.result.finishReason).toBe(ABORTED_FINISH_REASON);
    expect(done?.type === 'done' && done.result.content).toBe('one ');
  });
});
