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

  it('names the prompt and the endpoint of a request that fails', async () => {
    const cut = [sseFrame({ reasoning_content: 'Let me think about' }), sseFrame({}, 'length'), 'data: [DONE]\n\n'];
    const locationChange: Omit<AiCall, 'tools'> = { ...call, requestType: 'locationChange', maxTokensOverride: 12 };
    stubStream(cut);
    const error = await requestAiText(textSnapshot(textTarget({ presetName: 'GLM 5.3' })), locationChange).then(
      () => { throw new Error('expected a cut thought'); },
      (e: unknown) => e as Error & { details?: string; prompt?: string; endpoint?: string },
    );
    expect(error.message).toBe('The model reached its token limit before it wrote an answer');
    expect({ prompt: error.prompt, endpoint: error.endpoint }).toEqual({ prompt: 'Location Change', endpoint: 'GLM 5.3' });
    expect(error.details).toContain('Prompt: Location Change\nEndpoint: GLM 5.3\n');

    stubStream(() => new Response('nope', { status: 500 }));
    await expect(requestAiText(textSnapshot(), call)).rejects.toMatchObject({ prompt: 'Generate Summary' });
  });

  it('names the prompt of a request the network failed, keeping the error a connection error', async () => {
    stubStream(() => { throw new TypeError('Failed to fetch'); });
    const error = await requestAiText(textSnapshot(textTarget({ presetName: 'DeepSeek' })), call).then(
      () => { throw new Error('expected a network failure'); },
      (e: unknown) => e as TypeError & { details?: string; prompt?: string },
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(error.prompt).toBe('Generate Summary');
    expect(error.details).toContain('Endpoint: DeepSeek');
  });

  it('names the finish reason of an empty answer', async () => {
    stubStream(sseReply('   '));
    await expect(requestAiText(textSnapshot(), call)).rejects.toThrow('The model sent an empty answer (finish reason: stop)');
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
