/** A one-chunk WebP. Card code reads the RIFF framing only, so the bitstream bytes are arbitrary. */
export function tinyWebp(): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(24);
  const view = new DataView(out.buffer);
  const put = (text: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = text.charCodeAt(i); };
  put('RIFF', 0);
  view.setUint32(4, 16, true);
  put('WEBP', 8);
  put('VP8L', 12);
  view.setUint32(16, 4, true);
  out.set([0x2f, 1, 2, 3], 20);
  return out;
}
