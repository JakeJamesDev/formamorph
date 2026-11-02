import { describe, it, expect, vi } from 'vitest';
import factory from 'wasm-webp/dist/esm/webp-wasm.js';
import { nodeImageCodec } from './nodeImageCodec';

vi.mock('wasm-webp/dist/esm/webp-wasm.js', () => ({ default: vi.fn() }));

const GIB = 2 ** 30;
// A RIFF/WEBP header is all the codec reads before it hands the bytes to the glue.
const WEBP_URL = `data:image/webp;base64,${Buffer.from('RIFF\0\0\0\0WEBPVP8 ').toString('base64')}`;

function fakeGlue(heapBytes: number) {
  return {
    HEAP8: { buffer: { byteLength: heapBytes } },
    decodeRGBA: vi.fn(() => ({ data: new Uint8Array(4), width: 1, height: 1 })),
    encode: vi.fn(() => new Uint8Array(1)),
  };
}

describe('nodeImageCodec heap renewal', () => {
  it('starts a new wasm instance once the heap reaches 1 GiB, and keeps it below that', async () => {
    const small = fakeGlue(GIB - 1);
    const fresh = fakeGlue(GIB - 1);
    vi.mocked(factory)
      .mockResolvedValueOnce(small as never)
      .mockResolvedValueOnce(fresh as never);

    await nodeImageCodec.encode(WEBP_URL, 16, { allowGrow: true });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(small.encode).toHaveBeenCalledTimes(1);

    small.HEAP8.buffer.byteLength = GIB;
    await nodeImageCodec.encode(WEBP_URL, 16, { allowGrow: true });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(small.encode).toHaveBeenCalledTimes(1);
    expect(fresh.decodeRGBA).toHaveBeenCalledTimes(1);
    expect(fresh.encode).toHaveBeenCalledTimes(1);
  });
});
