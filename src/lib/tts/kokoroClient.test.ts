import { describe, it, expect, vi } from 'vitest';
import { Tensor } from '@huggingface/transformers';
import { KokoroClient, KOKORO_VOICES, type KokoroModel, type Tokenizer } from './kokoroClient';

const STYLE_DIM = 256;

/** A voice whose style row `n` is filled with the value `n`, so the picked row is readable. */
function rowVoice(rows = 600): Float32Array {
  const data = new Float32Array(rows * STYLE_DIM);
  for (let r = 0; r < rows; r++) data.fill(r, r * STYLE_DIM, (r + 1) * STYLE_DIM);
  return data;
}

function setup(tokenCount: number) {
  const calls: Record<string, Tensor>[] = [];
  const model = Object.assign(
    vi.fn(async (inputs: Record<string, Tensor>) => {
      calls.push(inputs);
      return { waveform: { data: new Float32Array([0.5, -0.5]) } };
    }),
    { dispose: vi.fn(async () => undefined) },
  ) as unknown as KokoroModel;
  const tokenizer: Tokenizer = vi.fn(() => ({
    input_ids: new Tensor('int64', new BigInt64Array(tokenCount), [1, tokenCount]),
  }));
  const phonemize = vi.fn(async (text: string) => `ph:${text}`);
  const loadVoice = vi.fn(async () => rowVoice());
  const client = new KokoroClient(model, tokenizer, { phonemize, loadVoice });
  return { client, calls, tokenizer, phonemize, loadVoice };
}

describe('KokoroClient.dispose', () => {
  it('releases the speech model', async () => {
    const { client } = setup(10);
    await client.dispose();
    expect(client.model.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('KokoroClient.generate', () => {
  it('phonemizes the text, tokenizes the phonemes with truncation, and returns 24 kHz audio', async () => {
    const { client, tokenizer, phonemize } = setup(10);
    const audio = await client.generate('Hello there', { voice: 'af_heart' });
    expect(phonemize).toHaveBeenCalledWith('Hello there', 'a');
    expect(tokenizer).toHaveBeenCalledWith('ph:Hello there', { truncation: true });
    expect(audio.sampling_rate).toBe(24000);
    expect(Array.from(audio.audio)).toEqual([0.5, -0.5]);
  });

  it.each([
    ['af_heart', 'a'],
    ['am_adam', 'a'],
    ['bf_emma', 'b'],
    ['bm_george', 'b'],
  ])('voice %s phonemizes with the %s accent', async (voice, accent) => {
    const { client, phonemize } = setup(10);
    await client.generate('Hi', { voice });
    expect(phonemize).toHaveBeenCalledWith('Hi', accent);
  });

  it('defaults to af_heart at speed 1', async () => {
    const { client, calls, loadVoice } = setup(10);
    await client.generate('Hi');
    expect(loadVoice).toHaveBeenCalledWith('af_heart');
    expect(Array.from(calls[0].speed.data as Float32Array)).toEqual([1]);
  });

  it('passes the speed to the model', async () => {
    const { client, calls } = setup(10);
    await client.generate('Hi', { voice: 'af_heart', speed: 1.25 });
    expect(Array.from(calls[0].speed.data as Float32Array)).toEqual([1.25]);
    expect(calls[0].speed.dims).toEqual([1]);
  });

  it('rejects an unknown voice before phonemizing', async () => {
    const { client, phonemize } = setup(10);
    await expect(client.generate('Hi', { voice: 'zz_nobody' })).rejects.toThrow(/Voice "zz_nobody" not found/);
    expect(phonemize).not.toHaveBeenCalled();
  });

  it('lists 28 voices, all American or British', () => {
    expect(KOKORO_VOICES).toHaveLength(28);
    expect(KOKORO_VOICES.every((v) => /^[ab][fm]_/.test(v))).toBe(true);
  });
});

describe('style row selection', () => {
  async function styleRow(tokenCount: number): Promise<number> {
    const { client, calls } = setup(tokenCount);
    await client.generate('x', { voice: 'af_heart' });
    const style = calls[0].style;
    expect(style.dims).toEqual([1, STYLE_DIM]);
    return (style.data as Float32Array)[0];
  }

  it('picks the row for the token count minus the two boundary tokens', async () => {
    expect(await styleRow(12)).toBe(10);
  });

  it('clamps a tiny input to row 0', async () => {
    expect(await styleRow(1)).toBe(0);
  });

  it('clamps a long input to row 509', async () => {
    expect(await styleRow(600)).toBe(509);
  });
});
