/**
 * Downscale's codec for Node: the app's libwebp through wasm-webp and a fixed area-average resize, so every
 * machine makes the same bytes.
 */
import factory from 'wasm-webp/dist/esm/webp-wasm.js';
import { bytesToDataUrl, dataUrlBytes, dataUrlImageSize, fitWithin, sniffDataUrlMime } from './imageBytes';
import { QUALITY } from './imageEncode';
import type { ImageCodec } from './imageOptimCore';

let gluePromise: ReturnType<typeof factory> | null = null;
const glue = () => (gluePromise ??= factory());

const payload = (url: string): Uint8Array => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

/** Whether a data URL holds an animated WebP: a VP8X header with its animation flag set. */
export function isAnimatedWebpUrl(url: string): boolean {
  if (sniffDataUrlMime(url) !== 'image/webp') return false;
  const head = Buffer.from(url.slice(url.indexOf(',') + 1, url.indexOf(',') + 41), 'base64');
  return head.toString('latin1', 12, 16) === 'VP8X' && (head[20] & 0x02) !== 0;
}

/** A static image's RGBA pixels: WebP through the app's libwebp, JPEG and PNG through sharp. */
async function decodeRgba(url: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const bytes = payload(url);
  const mime = sniffDataUrlMime(url);
  if (mime === 'image/webp' && !isAnimatedWebpUrl(url)) {
    const image = (await glue()).decodeRGBA(bytes);
    if (!image) throw new Error('WebP decode failed');
    return image;
  }
  if (mime === 'image/jpeg' || mime === 'image/png') {
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  }
  throw new Error(`The Node codec reads static WebP, JPEG and PNG, not ${mime === 'image/webp' ? 'animated WebP' : mime || 'this image'}`);
}

/** For each output index along one axis, the first source index it covers and each source's share of it. */
function areaWeights(src: number, dst: number): { start: number; weights: number[] }[] {
  const scale = src / dst;
  return Array.from({ length: dst }, (_, i) => {
    const lo = i * scale;
    const hi = lo + scale;
    const start = Math.floor(lo);
    const weights: number[] = [];
    for (let s = start; s < hi && s < src; s++) weights.push((Math.min(s + 1, hi) - Math.max(s, lo)) / scale);
    return { start, weights };
  });
}

/** Area-average RGBA downscale in premultiplied alpha, so a transparent pixel lends no color. */
export function resizeRgba(px: Uint8Array, w: number, h: number, dw: number, dh: number): Uint8Array {
  const pre = new Float64Array(w * h * 4);
  for (let i = 0; i < w * h * 4; i += 4) {
    const a = px[i + 3] / 255;
    pre[i] = px[i] * a;
    pre[i + 1] = px[i + 1] * a;
    pre[i + 2] = px[i + 2] * a;
    pre[i + 3] = px[i + 3];
  }
  const xs = areaWeights(w, dw);
  const ys = areaWeights(h, dh);
  const rows = new Float64Array(dw * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < dw; x++) {
      const { start, weights } = xs[x];
      const o = (y * dw + x) * 4;
      for (let k = 0; k < weights.length; k++) {
        const i = (y * w + start + k) * 4;
        for (let c = 0; c < 4; c++) rows[o + c] += pre[i + c] * weights[k];
      }
    }
  }
  const out = new Uint8Array(dw * dh * 4);
  const acc = [0, 0, 0, 0];
  for (let y = 0; y < dh; y++) {
    const { start, weights } = ys[y];
    for (let x = 0; x < dw; x++) {
      acc.fill(0);
      for (let k = 0; k < weights.length; k++) {
        const i = ((start + k) * dw + x) * 4;
        for (let c = 0; c < 4; c++) acc[c] += rows[i + c] * weights[k];
      }
      const o = (y * dw + x) * 4;
      const a = acc[3];
      const unpremultiply = a > 0 ? 255 / a : 0;
      for (let c = 0; c < 3; c++) out[o + c] = Math.min(255, Math.round(acc[c] * unpremultiply));
      out[o + 3] = Math.min(255, Math.round(a));
    }
  }
  return out;
}

/**
 * The Node codec. `encode` makes Downscale's lossy WebP and keeps the source when the result is not smaller.
 * It throws on an image it cannot read, and on a lossless request, which Downscale never makes.
 */
export const nodeImageCodec: ImageCodec = {
  measure: (url) => {
    const size = dataUrlImageSize(url);
    if (!size) return Promise.reject(new Error('Unreadable image header'));
    return Promise.resolve({ w: size.width, h: size.height, bytes: dataUrlBytes(url) });
  },
  encode: async (url, maxDim, options) => {
    if (options?.lossless) throw new Error('The Node codec encodes lossy WebP only');
    const image = await decodeRgba(url);
    const webp = await glue();
    const { w, h } = fitWithin(image.width, image.height, maxDim);
    const pixels = w === image.width && h === image.height
      ? new Uint8Array(image.data)
      : resizeRgba(image.data, image.width, image.height, w, h);
    const encoded = webp.encode(pixels, w, h, true, { lossless: 0, quality: Math.round(QUALITY * 100) });
    if (!encoded) throw new Error('WebP encode failed');
    const out = bytesToDataUrl(encoded, 'image/webp');
    return options?.allowGrow || out.length < url.length ? out : url;
  },
};
