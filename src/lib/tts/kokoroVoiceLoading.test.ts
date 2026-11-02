import { describe, it, expect, vi, afterEach } from 'vitest';
import { Tensor } from '@huggingface/transformers';
import { KokoroClient, type KokoroModel, type Tokenizer } from './kokoroClient';

const STYLE_DIM = 256;
const voiceUrl = (id: string) => `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${id}.bin`;

/** Two style rows: row 0 filled with 0, row 1 filled with 1. */
function voiceBytes(): ArrayBuffer {
  const data = new Float32Array(2 * STYLE_DIM);
  data.fill(1, STYLE_DIM);
  return data.buffer;
}

/** A client on the real voice loader; three tokens select style row 1. */
function client() {
  const calls: Record<string, Tensor>[] = [];
  const model = Object.assign(
    vi.fn(async (inputs: Record<string, Tensor>) => { calls.push(inputs); return { waveform: { data: new Float32Array(1) } }; }),
    { dispose: vi.fn() },
  ) as unknown as KokoroModel;
  const tokenizer: Tokenizer = () => ({ input_ids: new Tensor('int64', new BigInt64Array(3), [1, 3]) });
  return { client: new KokoroClient(model, tokenizer, { phonemize: async (text) => text }), calls };
}

function stubCache(stored: Map<string, ArrayBuffer>) {
  vi.stubGlobal('caches', {
    open: async () => ({
      match: async (url: string) => (stored.has(url) ? new Response(stored.get(url)) : undefined),
      put: async (url: string, res: Response) => { stored.set(url, await res.arrayBuffer()); },
    }),
  });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('voice loading', () => {
  it('fetches a voice once, stores it in the browser cache, and reads the style row from it', async () => {
    const stored = new Map<string, ArrayBuffer>();
    stubCache(stored);
    const fetchMock = vi.fn(async () => new Response(voiceBytes()));
    vi.stubGlobal('fetch', fetchMock);
    const { client: tts, calls } = client();

    await tts.generate('a', { voice: 'am_adam' });
    await tts.generate('b', { voice: 'am_adam' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(voiceUrl('am_adam'));
    expect(stored.has(voiceUrl('am_adam'))).toBe(true);
    expect((calls[0].style.data as Float32Array)[0]).toBe(1);
  });

  it('reads a voice from the browser cache without fetching', async () => {
    stubCache(new Map([[voiceUrl('am_echo'), voiceBytes()]]));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { client: tts, calls } = client();

    await tts.generate('a', { voice: 'am_echo' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect((calls[0].style.data as Float32Array)[0]).toBe(1);
  });

  it('rejects a voice whose download fails instead of using the error body', async () => {
    stubCache(new Map());
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    const { client: tts } = client();

    await expect(tts.generate('a', { voice: 'am_eric' })).rejects.toThrow(/am_eric.*404/);
  });
});
