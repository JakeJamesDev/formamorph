import { describe, it, expect, vi, afterEach } from 'vitest';
import { summarizeDescription } from './summarize';

const opts = { endpointUrl: 'http://x/v1/chat/completions', apiToken: 't', modelName: 'm' };

function mockFetch(impl: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe('summarizeDescription', () => {
  it('returns the trimmed message content on success', async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ choices: [{ message: { content: '  A short summary.  ' } }] })),
    );
    await expect(summarizeDescription('long text', opts)).resolves.toBe('A short summary.');
  });

  it('sends the model, prompt, and a bearer token', async () => {
    const fetchSpy = vi.fn((_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await summarizeDescription('desc', opts);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('m');
    expect(body.stream).toBe(false);
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'desc' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('throws on a non-OK response', async () => {
    mockFetch(() => new Response('nope', { status: 500 }));
    await expect(summarizeDescription('x', opts)).rejects.toThrow('HTTP 500');
  });

  it('throws on an empty content response', async () => {
    mockFetch(() => new Response(JSON.stringify({ choices: [{ message: { content: '   ' } }] })));
    await expect(summarizeDescription('x', opts)).rejects.toThrow('Empty summary response');
  });
});
