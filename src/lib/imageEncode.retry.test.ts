/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeImageDataUrl } from './imageEncode';

// The encoder chunk fails its first fetch, as on a dropped connection, and loads on the next.
let fetches = 0;
vi.mock('wasm-webp', () => {
  fetches += 1;
  if (fetches === 1) throw new TypeError('Failed to fetch dynamically imported module');
  return { encodeAnimation: async (_w: number, _h: number, _alpha: boolean, frames: unknown[]) => new Uint8Array(frames.length), encode: vi.fn() };
});

class FakeDecoder {
  tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: 3 } };
  async decode() { return { image: { duration: 100_000, displayWidth: 4, displayHeight: 4, close() {} } }; }
  close() {}
}
class FakeCanvas {
  constructor(readonly width: number, readonly height: number) {}
  getContext() {
    return { clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(this.width * this.height * 4) }) };
  }
}

const GIF = `data:image/gif;base64,${Buffer.alloc(4096).toString('base64')}`;
afterEach(() => vi.unstubAllGlobals());

describe('an animated re-encode after the encoder failed to load', () => {
  it('keeps the source that time and loads the encoder again on the next encode', async () => {
    vi.stubGlobal('ImageDecoder', FakeDecoder);
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);

    expect(await encodeImageDataUrl(GIF, Infinity, true, true)).toBe(GIF);
    expect(await encodeImageDataUrl(GIF, Infinity, true, true)).toMatch(/^data:image\/webp;/);
  });
});
