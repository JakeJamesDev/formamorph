// The harness's browser half, loaded into the dev build's page: the app's lossless WebP encode and the
// contact-sheet drawing, both of which need a canvas.

import { reencodeImageDataUrl } from '@/lib/imageOptim';
import { bytesToDataUrl, dataUrlMime } from '@/lib/imageBytes';
import { SHEET, sheetLayout, type SheetImage } from './artHarness';

/** The `image-not-webp` fix's encode: lossless WebP at full size. Throws when the result is not WebP. */
async function encode(dataUrl: string): Promise<string> {
  const out = await reencodeImageDataUrl(dataUrl);
  if (dataUrlMime(out) !== 'image/webp') throw new Error(`The encoder returned ${dataUrlMime(out)}, not WebP`);
  return out;
}

/** Draw every image fitted in its box with its label, and return the sheet as a PNG data URL. */
async function sheet(images: SheetImage[]): Promise<string> {
  const bitmaps = await Promise.all(images.map(async (image) => createImageBitmap(await (await fetch(image.data)).blob())));
  const layout = sheetLayout(images.map((image, index) => ({
    label: image.label, width: bitmaps[index].width, height: bitmaps[index].height,
  })));
  const canvas = new OffscreenCanvas(layout.width, layout.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D context for the contact sheet');
  context.fillStyle = '#1f1f23';
  context.fillRect(0, 0, layout.width, layout.height);
  context.font = '16px sans-serif';
  context.fillStyle = '#f2f2f2';
  layout.cells.forEach((cell, index) => {
    const { x, y, width, height } = cell.image;
    context.drawImage(bitmaps[index], x, y, width, height);
    bitmaps[index].close();
    context.fillText(cell.label, cell.labelX, cell.labelY, SHEET.box);
  });
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()), 'image/png');
}

export interface ArtHarnessPage {
  encode: typeof encode;
  sheet: typeof sheet;
}

declare global {
  interface Window {
    __artHarness?: ArtHarnessPage;
  }
}

window.__artHarness = { encode, sheet };
