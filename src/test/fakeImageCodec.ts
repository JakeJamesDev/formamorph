import { vi } from 'vitest';

/**
 * A stand-in for the browser's image codec, so the real encode path runs in jsdom. A fake image's bytes are
 * its size ("4000x3000"): the bitmap reads that size back, and the canvas writes the size it was drawn at in
 * the format it was asked for. `fetch` serves data URLs and refuses anything else. Undo with
 * `vi.unstubAllGlobals()` and `vi.restoreAllMocks()`.
 */
export function installFakeImageCodec(): void {
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
  vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
    const [width, height] = (await blobText(blob)).split('x').map(Number);
    return { width, height, close: () => {} };
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!url.startsWith('data:')) throw new Error('offline (fake image codec)');
    const [head, payload] = url.split(',');
    const type = head.slice('data:'.length, head.indexOf(';'));
    return { blob: async () => new Blob([atob(payload)], { type }) };
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation((type?: string) => `data:${type};base64,`);
}

/** An image file of the given size ("800x600") for the fake codec. */
export const fakeImageFile = (size: string, type = 'image/png', name = 'photo.png') => new File([size], name, { type });

/** What the fake codec wrote into a data URL: the drawn size and the format. */
export function decodedFake(dataUrl: string): { format: string; size: string } {
  const [head, payload] = dataUrl.split(',');
  return { format: head.slice('data:'.length, head.indexOf(';')), size: atob(payload) };
}

class FakeCanvas {
  constructor(public width: number, public height: number) {}
  getContext() {
    return { drawImage: () => {}, getImageData: () => ({ data: new Uint8ClampedArray(0) }), clearRect: () => {}, fillRect: () => {}, fillStyle: '' };
  }
  // jsdom's Blob has no `arrayBuffer`, so the canvas hands back the part of a Blob the encoder reads.
  async convertToBlob({ type }: { type: string }) {
    const bytes = new TextEncoder().encode(`${this.width}x${this.height}`);
    return { type, arrayBuffer: async () => bytes.buffer };
  }
}

/** A Blob's text, read the way jsdom supports. */
const blobText = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.readAsText(blob);
});
