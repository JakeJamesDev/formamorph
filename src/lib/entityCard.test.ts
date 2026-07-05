import { describe, it, expect } from 'vitest';
import { embedEntityCard, readEntityCard } from './entityCard';

// Build a WebP container from a chunk list (mirrors the module's internal builder) so tests don't need a
// real encoder. The chunk payloads are arbitrary bytes — the module only parses the RIFF framing, not the
// image bitstream.
function makeWebp(chunks: { cc: string; data: number[] }[]): Uint8Array {
  let body = 4;
  for (const c of chunks) body += 8 + c.data.length + (c.data.length & 1);
  const out = new Uint8Array(8 + body);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0);
  view.setUint32(4, body, true);
  put4('WEBP', 8);
  let pos = 12;
  for (const c of chunks) {
    put4(c.cc, pos); pos += 4;
    view.setUint32(pos, c.data.length, true); pos += 4;
    out.set(c.data, pos); pos += c.data.length;
    if (c.data.length & 1) pos += 1;
  }
  return out;
}

/** Split a WebP into `{ fourCC }` markers for structural assertions. */
function chunkTypes(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: string[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    out.push(String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]));
    const size = view.getUint32(pos + 4, true);
    pos += 8 + size + (size & 1);
  }
  return out;
}

const simpleLossy = () => makeWebp([{ cc: 'VP8 ', data: [1, 2, 3, 4, 5] }]); // odd length → exercises padding
const simpleLossless = () => makeWebp([{ cc: 'VP8L', data: [9, 8, 7, 6] }]);
const extended = () =>
  makeWebp([{ cc: 'VP8X', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { cc: 'VP8 ', data: [1, 2, 3, 4] }]);

describe('entityCard WebP metadata I/O', () => {
  it('round-trips JSON through a simple (VP8) WebP', () => {
    const json = JSON.stringify({ formamorphKind: 'entity', name: 'Wren', aiDescription: 'a marsh guide' });
    const card = embedEntityCard(simpleLossy(), json, { w: 640, h: 480 });
    expect(readEntityCard(card)).toBe(json);
  });

  it('promotes a simple file to VP8X with the dims written in, keeping the bitstream', () => {
    const card = embedEntityCard(simpleLossy(), '{}', { w: 640, h: 480 });
    const types = chunkTypes(card);
    expect(types[0]).toBe('VP8X');
    expect(types).toContain('VP8 ');
    expect(types).toContain('XMP ');
    // VP8X carries canvas width-1 / height-1 as 24-bit LE at byte offsets 4..6 / 7..9 of its payload.
    const p = 12 + 8; // start of VP8X payload
    const w = 1 + (card[p + 4] | (card[p + 5] << 8) | (card[p + 6] << 16));
    const h = 1 + (card[p + 7] | (card[p + 8] << 8) | (card[p + 9] << 16));
    expect([w, h]).toEqual([640, 480]);
  });

  it('re-embedding is idempotent — one XMP chunk, identical bytes', () => {
    const json = JSON.stringify({ name: 'Wren' });
    const once = embedEntityCard(simpleLossy(), json, { w: 10, h: 10 });
    const twice = embedEntityCard(once, json, { w: 10, h: 10 });
    expect(chunkTypes(twice).filter((t) => t === 'XMP ')).toHaveLength(1);
    expect(Array.from(twice)).toEqual(Array.from(once));
  });

  it('embeds into an already-extended (VP8X) file without adding a second header', () => {
    const card = embedEntityCard(extended(), '{"name":"Bram"}', { w: 1, h: 1 });
    expect(chunkTypes(card).filter((t) => t === 'VP8X')).toHaveLength(1);
    expect(readEntityCard(card)).toBe('{"name":"Bram"}');
  });

  it('round-trips through a lossless (VP8L) WebP', () => {
    const card = embedEntityCard(simpleLossless(), '{"x":1}', { w: 5, h: 5 });
    expect(readEntityCard(card)).toBe('{"x":1}');
  });

  it('reads null from a plain WebP with no card chunk', () => {
    expect(readEntityCard(simpleLossy())).toBeNull();
  });

  it('reads null from non-WebP bytes and refuses to embed into them', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(readEntityCard(png)).toBeNull();
    expect(() => embedEntityCard(png, '{}', { w: 1, h: 1 })).toThrow();
  });
});
