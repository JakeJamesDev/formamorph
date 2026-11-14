/**
 * Turns a Supporter world as the gated route sent it into plain world content: each scrambled image object
 * becomes a lossless PNG data URL, and everything else passes through unchanged.
 */
import { isScrambledLayer, unscrambleToCanvas, type ScrambledLayer } from './scramble';

/** Rebuilds one layer as an image data URL. */
export type RenderLayer = (layer: ScrambledLayer) => Promise<string>;

/** Rebuild a layer on a canvas and read it back as a PNG data URL. */
export const renderLayerToPng: RenderLayer = async (layer) => (await unscrambleToCanvas(layer)).toDataURL('image/png');

/**
 * Replace every scrambled layer in `content` with its rebuilt data URL, in the same place.
 *
 * @param content - The gated route's `contentData`
 * @param render - Rebuilds one layer; the default draws it on a canvas
 * @throws RangeError when a layer is not the size its parameters describe
 */
export async function unscrambleWorldContent(content: unknown, render: RenderLayer = renderLayerToPng): Promise<unknown> {
  // One layer at a time: each holds a full decoded image, and a world can hold many.
  const walk = async (value: unknown): Promise<unknown> => {
    if (isScrambledLayer(value)) return render(value);
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const item of value) out.push(await walk(item));
      return out;
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) out[key] = await walk(item);
      return out;
    }
    return value;
  };
  return walk(content);
}
