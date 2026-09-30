import { describe, it, expect, vi, afterEach } from 'vitest';
import { bridgeDescription, bridgePrompt } from './bridgeDescription';
import { sentBody, sseReply, stubStream, textSnapshot } from '@/test/aiTextFixtures';

const opts = { snapshot: textSnapshot() };

afterEach(() => vi.unstubAllGlobals());

describe('bridgePrompt', () => {
  it('tells the player-facing direction to hold private material back', () => {
    const prompt = bridgePrompt('playerDesc', 'character');
    expect(prompt).toMatch(/secrets/i);
    expect(prompt).toMatch(/player reads/i);
  });

  it('tells the AI-facing direction to stay consistent with the blurb', () => {
    expect(bridgePrompt('aiDesc', 'character')).toMatch(/consistent with every fact/i);
  });

  it('describes the subject differently per kind', () => {
    expect(bridgePrompt('playerDesc', 'character')).toMatch(/appearance/i);
    expect(bridgePrompt('playerDesc', 'location')).toMatch(/atmosphere/i);
  });
});

describe('bridgeDescription', () => {
  it('returns the trimmed answer on success', async () => {
    stubStream(sseReply('  Rewritten.  '));
    await expect(bridgeDescription('note', 'playerDesc', 'character', opts)).resolves.toBe('Rewritten.');
  });

  it('sends the direction-specific prompt, the source text, its cap and its sampler pin', async () => {
    const spy = stubStream(sseReply('ok'));
    await bridgeDescription('blurb', 'aiDesc', 'location', opts);
    const body = sentBody(spy);
    expect(body.model).toBe('m');
    expect(body.temperature).toBe(0.6);
    expect(body.max_tokens).toBe(400);
    expect(body.messages).toEqual([
      { role: 'system', content: bridgePrompt('aiDesc', 'location') },
      { role: 'user', content: 'blurb' },
    ]);
  });

  it('throws on a non-OK response', async () => {
    stubStream(() => new Response('nope', { status: 500 }));
    await expect(bridgeDescription('x', 'playerDesc', 'character', opts)).rejects.toThrow('HTTP 500');
  });

  it('throws on an empty answer', async () => {
    stubStream(sseReply('   '));
    await expect(bridgeDescription('x', 'playerDesc', 'character', opts)).rejects.toThrow('empty answer');
  });
});
