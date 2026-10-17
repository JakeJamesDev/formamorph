/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeImageDataUrl } from './imageEncode';

// The WASM encoder records the frames it is handed and returns a fixed WebP payload.
const encodeAnimation = vi.fn(async (_w: number, _h: number, _alpha: boolean, frames: unknown[]) => new Uint8Array(frames.length));
vi.mock('wasm-webp', () => ({ encodeAnimation, encode: vi.fn() }));

/** A GIF whose frames decode up to `decodable`; later frames throw as Chromium does on a truncated file. */
function fakeDecoder(frameCount: number, decodable: number) {
  return class {
    tracks = { ready: Promise.resolve(), selectedTrack: { frameCount } };
    async decode({ frameIndex }: { frameIndex: number }) {
      if (frameIndex >= decodable) throw new RangeError(`Request for frame index ${frameIndex} can't be satisfied.`);
      return { image: { duration: 100_000, displayWidth: 4, displayHeight: 4, close() {} } };
    }
    close() {}
  };
}

class FakeCanvas {
  constructor(readonly width: number, readonly height: number) {}
  getContext() {
    return { clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(this.width * this.height * 4) }) };
  }
}

// A long source, so the encoded result is the smaller one and the grow-guard keeps it.
const GIF = `data:image/gif;base64,${Buffer.alloc(4096).toString('base64')}`;
const encode = () => encodeImageDataUrl(GIF, Infinity, true, true);

beforeEach(() => {
  encodeAnimation.mockClear();
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
});
afterEach(() => vi.unstubAllGlobals());

describe('an animated GIF re-encode', () => {
  it('encodes every frame of a whole file', async () => {
    vi.stubGlobal('ImageDecoder', fakeDecoder(5, 5));
    expect(await encode()).toMatch(/^data:image\/webp;/);
    expect(encodeAnimation.mock.calls[0][3]).toHaveLength(5);
  });

  it('keeps the frames before a truncated last frame', async () => {
    vi.stubGlobal('ImageDecoder', fakeDecoder(5, 4));
    expect(await encode()).toMatch(/^data:image\/webp;/);
    expect(encodeAnimation.mock.calls[0][3]).toHaveLength(4);
  });

  it('keeps the source when only one frame decodes', async () => {
    vi.stubGlobal('ImageDecoder', fakeDecoder(5, 1));
    expect(await encode()).toBe(GIF);
    expect(encodeAnimation).not.toHaveBeenCalled();
  });
});
