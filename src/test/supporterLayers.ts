/** Supporter Mascot layers in jsdom, which decodes and draws nothing. */
import { vi } from 'vitest';
import type { ScrambledLayer } from '@/lib/supporterContent';

/** A stand-in for `unscrambleToCanvas`: a canvas at the source size that names the layer it came from. */
export async function fakeUnscramble(layer: ScrambledLayer): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = layer.sourceWidth;
  canvas.height = layer.sourceHeight;
  canvas.dataset.layer = layer.dataUrl;
  return canvas;
}

/** Makes every canvas copy record, as `data-drawn`, the layer drawn onto it. */
export function recordLayerCopies(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: (source: HTMLCanvasElement) => { this.dataset.drawn = source.dataset.layer; } };
  } as unknown as HTMLCanvasElement['getContext']);
}
