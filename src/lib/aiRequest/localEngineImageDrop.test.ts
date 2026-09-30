import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { toast } from 'react-toastify';
import { streamAiRequest } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';
import { IMAGES_DROPPED_HEADER, noteImagesDropped, resetImagesDroppedWarning } from './localEngineImageDrop';

vi.mock('react-toastify', () => ({ toast: { warning: vi.fn() } }));

const responseWith = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

beforeEach(() => {
  vi.mocked(toast.warning).mockClear();
  resetImagesDroppedWarning();
});

describe('noteImagesDropped', () => {
  it('warns once per session however many responses report a drop', () => {
    noteImagesDropped(responseWith({ [IMAGES_DROPPED_HEADER]: '2' }));
    noteImagesDropped(responseWith({ [IMAGES_DROPPED_HEADER]: '1' }));
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the header is missing or zero', () => {
    noteImagesDropped(responseWith({}));
    noteImagesDropped(responseWith({ [IMAGES_DROPPED_HEADER]: '0' }));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('warns on the first drop after quiet responses', () => {
    noteImagesDropped(responseWith({}));
    noteImagesDropped(responseWith({ [IMAGES_DROPPED_HEADER]: '1' }));
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
});

describe('engine header name', () => {
  it('matches the header the engine sets', () => {
    const engine = readFileSync('electron/llmEngine.cjs', 'utf8');
    expect(engine).toContain(`IMAGES_DROPPED_HEADER = '${IMAGES_DROPPED_HEADER}'`);
  });
});

describe('streamAiRequest', () => {
  it('warns when the response carries the drop header', async () => {
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); c.close(); } });
    // Partial doubles: the stream reads only these fields.
    const response = { ok: true, status: 200, body, headers: new Headers({ [IMAGES_DROPPED_HEADER]: '1' }) } as unknown as Response;
    const spec = { url: 'http://localhost:1/v1/chat/completions', headers: {}, body: { model: 'm', messages: [], stream: true } } as unknown as AiRequestSpec;
    for await (const event of streamAiRequest(spec, { fetchImpl: (() => Promise.resolve(response)) as unknown as typeof fetch })) void event;
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });
});
