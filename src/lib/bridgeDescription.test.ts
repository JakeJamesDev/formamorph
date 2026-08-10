import { describe, it, expect, vi, afterEach } from 'vitest';
import { bridgeDescription, bridgePrompt } from './bridgeDescription';

const opts = { endpointUrl: 'http://x/v1/chat/completions', apiToken: 't', modelName: 'm' };

function mockFetch(impl: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

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
  it('returns the trimmed message content on success', async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ choices: [{ message: { content: '  Rewritten.  ' } }] })),
    );
    await expect(bridgeDescription('note', 'playerDesc', 'character', opts)).resolves.toBe('Rewritten.');
  });

  it('sends the direction-specific prompt, the source text, sampler pins, and a bearer token', async () => {
    const fetchSpy = vi.fn((_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await bridgeDescription('blurb', 'aiDesc', 'location', opts);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('m');
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.6);
    expect(body.max_tokens).toBe(400);
    expect(body.messages[0]).toEqual({ role: 'system', content: bridgePrompt('aiDesc', 'location') });
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'blurb' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('throws on a non-OK response', async () => {
    mockFetch(() => new Response('nope', { status: 500 }));
    await expect(bridgeDescription('x', 'playerDesc', 'character', opts)).rejects.toThrow('HTTP 500');
  });

  it('throws on an empty content response', async () => {
    mockFetch(() => new Response(JSON.stringify({ choices: [{ message: { content: '   ' } }] })));
    await expect(bridgeDescription('x', 'playerDesc', 'character', opts)).rejects.toThrow('Empty description response');
  });
});
