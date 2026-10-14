import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'react-toastify';
import { streamAiRequest } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';
import { noteUnusableExtraParams, resetExtraParamsWarning } from './extraParamsWarning';

vi.mock('react-toastify', () => ({ toast: { warning: vi.fn() } }));

beforeEach(() => {
  vi.mocked(toast.warning).mockClear();
  resetExtraParamsWarning();
});

describe('noteUnusableExtraParams', () => {
  it('warns once per session however many requests carry unusable text', () => {
    noteUnusableExtraParams('{not json');
    noteUnusableExtraParams('{"model": "x"}');
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('without them'));
  });

  it('stays quiet for empty or usable text', () => {
    noteUnusableExtraParams(undefined);
    noteUnusableExtraParams('');
    noteUnusableExtraParams('{"top_a": 0.1}');
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe('streamAiRequest', () => {
  it('warns when the request target has unusable Extra Parameters', async () => {
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); c.close(); } });
    // Partial doubles: the stream reads only these fields.
    const response = { ok: true, status: 200, body, headers: new Headers() } as unknown as Response;
    const spec = {
      url: 'http://localhost:1/v1/chat/completions', headers: {},
      body: { model: 'm', messages: [], stream: true }, target: { extraParams: '[1]' },
    } as unknown as AiRequestSpec;
    for await (const event of streamAiRequest(spec, { fetchImpl: (() => Promise.resolve(response)) as unknown as typeof fetch })) void event;
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
});
