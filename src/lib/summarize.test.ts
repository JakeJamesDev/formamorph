import { describe, it, expect, vi, afterEach } from 'vitest';
import { summarizeDescription, SUMMARIZE_PROMPT } from './summarize';
import { sentBody, sseReply, stubStream, textSnapshot } from '@/test/aiTextFixtures';

const opts = { snapshot: textSnapshot() };

afterEach(() => vi.unstubAllGlobals());

describe('summarizeDescription', () => {
  it('returns the trimmed answer on success', async () => {
    stubStream(sseReply('  A short summary.  '));
    await expect(summarizeDescription('long text', opts)).resolves.toBe('A short summary.');
  });

  it('sends the prompt, its cap, its sampler pin, and a bearer token through the pipeline', async () => {
    const spy = stubStream(sseReply('ok'));
    await summarizeDescription('desc', opts);
    const body = sentBody(spy);
    expect(body.model).toBe('m');
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(80);
    expect(body.temperature).toBe(0.3);
    expect(body.messages).toEqual([{ role: 'system', content: SUMMARIZE_PROMPT }, { role: 'user', content: 'desc' }]);
    expect((spy.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('throws on a non-OK response', async () => {
    stubStream(() => new Response('nope', { status: 500 }));
    await expect(summarizeDescription('x', opts)).rejects.toThrow('HTTP 500');
  });

  it('throws on an empty answer', async () => {
    stubStream(sseReply('   '));
    await expect(summarizeDescription('x', opts)).rejects.toThrow('empty answer');
  });
});
