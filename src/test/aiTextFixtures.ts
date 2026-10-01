import { vi } from 'vitest';
import type { AiEndpointTarget, AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';

/** An external endpoint that nothing has probed yet. */
export const textTarget = (over: Partial<AiEndpointTarget> = {}): AiEndpointTarget => ({
  endpointId: 'cloud',
  url: 'https://api.example.com/v1/chat/completions',
  apiToken: 't',
  model: 'm',
  maxTokens: undefined,
  localEngine: false,
  samplerOverrides: defaultEndpointSamplerOverrides(),
  reasoning: UNKNOWN_REASONING_CAPABILITY,
  ...over,
});

export const textSnapshot = (target: AiEndpointTarget = textTarget(), over: Partial<AiSettingsSnapshot> = {}): AiSettingsSnapshot => ({
  resolveTarget: () => target,
  thinkingMode: 'off',
  reasoningEffort: 'auto',
  reasoningEngaged: false,
  promptReasoning: {},
  promptReasoningBudget: {},
  promptSamplers: {},
  promptMaxOutput: {},
  genTemperature: 0.9,
  genRepetitionPenalty: 1.1,
  genTopP: 0.95,
  genTopK: 40,
  genMinP: 0.05,
  paragraphLimit: 'none',
  disableThinking: false,
  ...over,
});

/** One SSE frame, in the wire form the endpoints send. */
export const sseFrame = (delta: Record<string, unknown>, finishReason: string | null = null): string =>
  `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\n`;

/** A streamed reply of `content`, ending on `finishReason`. */
export const sseReply = (content: string, finishReason = 'stop'): string[] =>
  [sseFrame({ content }), sseFrame({}, finishReason), 'data: [DONE]\n\n'];

export function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

/**
 * A streamed reply that sends its frames and then stays open, as a model that is still writing. `cancel`
 * records that the reader closed the request.
 */
export function openSseReply(frames: string[]) {
  const cancel = vi.fn();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) { for (const frame of frames) controller.enqueue(encoder.encode(frame)); },
    cancel,
  });
  return { cancel, respond: () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }) };
}

/** Stubs the global fetch with one streamed reply and returns the spy, so a test can read the body it got. */
export function stubStream(chunks: string[] | (() => Response)) {
  const spy = vi.fn((_url: string, _init: RequestInit) => (typeof chunks === 'function' ? chunks() : sseResponse(chunks)));
  vi.stubGlobal('fetch', spy);
  return spy;
}

/** The JSON body of the spy's first request. */
export const sentBody = (spy: ReturnType<typeof stubStream>): Record<string, unknown> =>
  JSON.parse(spy.mock.calls[0][1].body as string) as Record<string, unknown>;
