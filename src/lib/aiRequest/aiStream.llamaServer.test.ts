import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { streamAiRequest, type AiStreamEvent } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';

interface Recorded {
  chat: { choices: { message: { content: string; reasoning_content?: string } }[] };
  chatStream: string;
}

const recorded = (name: string): Recorded =>
  JSON.parse(readFileSync(new URL(`../../../electron/fixtures/llama-server/${name}.json`, import.meta.url), 'utf8'));

const spec: AiRequestSpec = {
  url: 'http://127.0.0.1:1234/v1/chat/completions',
  headers: { 'Content-Type': 'application/json' },
  body: { model: 'default', messages: [{ role: 'user', content: 'hi' }], max_tokens: 600, stream: true },
  target: {
    endpointId: 'engine',
    url: 'http://127.0.0.1:1234/v1/chat/completions',
    apiToken: '',
    model: 'default',
    maxTokens: 600,
    localEngine: true,
    samplerOverrides: defaultEndpointSamplerOverrides(),
    reasoning: UNKNOWN_REASONING_CAPABILITY,
  },
  requestType: 'narration',
  samplerSources: {},
};

/** Feeds a recorded SSE body to the app's own stream parser, in chunks that split frames. */
async function parse(stream: string) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < stream.length; i += 97) controller.enqueue(encoder.encode(stream.slice(i, i + 97)));
      controller.close();
    },
  });
  // The parser reads only ok, status and body, so a plain object stands in for a Response.
  const response = { ok: true, status: 200, body } as unknown as Response;
  const events: AiStreamEvent[] = [];
  for await (const event of streamAiRequest(spec, { fetchImpl: (() => Promise.resolve(response)) as unknown as typeof fetch })) events.push(event);
  const done = events.find((e) => e.type === 'done') as Extract<AiStreamEvent, { type: 'done' }>;
  return done.result;
}

const THOUGHT_TAGS = /<think>|<\/think>|<\|channel>|<channel\|>/;

describe('Recorded llama-server replies at --reasoning-format deepseek', () => {
  it.each(['b11829-gemma', 'b11829-thinking'])('%s: the thought arrives in reasoning_content, not in content', (name) => {
    const { chat } = recorded(name);
    const message = chat.choices[0].message;
    expect(message.reasoning_content?.length).toBeGreaterThan(0);
    expect(message.content).not.toMatch(THOUGHT_TAGS);
    expect(message.reasoning_content).not.toMatch(THOUGHT_TAGS);
  });

  it('b11829-gemma: the streamed deltas keep the thought out of content', () => {
    const frames = recorded('b11829-gemma').chatStream
      .split('\n\n').filter((f) => f.startsWith('data: {')).map((f) => JSON.parse(f.slice(6)).choices[0]?.delta ?? {});
    expect(frames.some((d) => typeof d.reasoning_content === 'string' && d.reasoning_content.length > 0)).toBe(true);
    expect(frames.map((d) => d.content ?? '').join('')).not.toMatch(THOUGHT_TAGS);
  });

  it('b11829-gemma: the app parser returns the answer text and the thought apart', async () => {
    const result = await parse(recorded('b11829-gemma').chatStream);
    expect(result.content).toBe(recorded('b11829-gemma').chat.choices[0].message.content);
    expect(result.reasoningField).toBe('reasoning_content');
    expect(result.reasoningText).toBe(recorded('b11829-gemma').chat.choices[0].message.reasoning_content);
    expect(result.content).not.toMatch(THOUGHT_TAGS);
  });
});
