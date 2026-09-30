import { describe, it, expect, afterEach, vi } from 'vitest';
import { requestAiText } from './aiText';
import type { AiCall } from './aiRequestSpec';
import { reasoningCapabilityFromLevels } from '@/lib/reasoningEffort';
import { sentBody, sseFrame, sseReply, sseResponse, stubStream, textSnapshot, textTarget } from '@/test/aiTextFixtures';

afterEach(() => vi.unstubAllGlobals());

const call: Omit<AiCall, 'tools'> = {
  systemPrompt: 'Summarize.',
  messages: [{ role: 'user', content: 'text' }],
  requestType: 'descriptionSummary',
  maxTokensOverride: 80,
};

/** A Novita model that reasons by default and takes the off switch. */
const novita = textTarget({
  reasoning: { ...reasoningCapabilityFromLevels([], 'probe'), reasons: true, dialect: 'novita' },
});

describe('requestAiText', () => {
  it('returns the streamed answer without its reasoning block', async () => {
    stubStream([sseFrame({ content: '<think>hmm</think>' }), ...sseReply('  A summary.  ')]);
    await expect(requestAiText(textSnapshot(), call)).resolves.toBe('A summary.');
  });

  it('switches reasoning off for an editor kind, whatever the stored prompt setting says', async () => {
    const spy = stubStream(sseReply('ok'));
    const snapshot = textSnapshot(novita, { reasoningEngaged: true, promptReasoning: { descriptionSummary: 'low' } });
    await requestAiText(snapshot, call);
    expect(sentBody(spy).enable_thinking).toBe(false);
  });

  it('names the cut thought when the model spends the cap reasoning', async () => {
    stubStream([sseFrame({ reasoning_content: 'Let me think about' }), sseFrame({}, 'length'), 'data: [DONE]\n\n']);
    await expect(requestAiText(textSnapshot(), call)).rejects.toThrow('token limit before it wrote an answer');
  });

  it('names the finish reason of an empty answer', async () => {
    stubStream(sseReply('   '));
    await expect(requestAiText(textSnapshot(), call)).rejects.toThrow('empty answer (finish reason: stop)');
  });

  it('throws the HTTP status of a failed request', async () => {
    stubStream(() => new Response('nope', { status: 500 }));
    await expect(requestAiText(textSnapshot(), call)).rejects.toThrow('HTTP 500');
  });

  it('throws an AbortError when stopped', async () => {
    const controller = new AbortController();
    stubStream(() => { controller.abort(); return sseResponse(sseReply('late')); });
    await expect(requestAiText(textSnapshot(), call, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
