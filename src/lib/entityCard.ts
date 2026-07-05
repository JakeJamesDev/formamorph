// Read/write a metadata chunk inside a WebP so a character's Entity JSON can ride along inside its portrait
// image (a "character card"). WebP is a RIFF container: 'RIFF' <u32 LE size> 'WEBP' then even-padded chunks
// (<fourCC><u32 LE len><bytes><pad>). Metadata chunks are only legal in the extended (VP8X) form, so a simple
// VP8/VP8L file is wrapped in a synthesized VP8X first. Mirrors the binary approach in `sdMetadata.ts` (which
// does the same for PNG's big-endian tEXt/iTXt chunks).

const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8');

/** The chunk that carries our JSON. WebP's standard metadata slot; the fourCC's trailing space is required. */
const XMP_FOURCC = 'XMP ';
/** VP8X feature-flag byte bits: XMP-present and alpha-present. */
const VP8X_FLAG_XMP = 0x04;
const VP8X_FLAG_ALPHA = 0x10;

interface Chunk {
  fourCC: string;
  data: Uint8Array;
}

const fourCCBytes = (cc: string): Uint8Array =>
  Uint8Array.from([0, 1, 2, 3].map((i) => cc.charCodeAt(i) & 0xff));

/** True when `bytes` starts with a `RIFF....WEBP` container header. */
function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // 'RIFF'
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // 'WEBP'
  );
}

/** The container's chunk list in order, or null for non-WebP / truncated input. */
function parseChunks(bytes: Uint8Array): Chunk[] | null {
  if (!isWebp(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  let pos = 12; // skip 'RIFF' + size + 'WEBP'
  while (pos + 8 <= bytes.length) {
    const fourCC = latin1.decode(bytes.subarray(pos, pos + 4));
    const size = view.getUint32(pos + 4, true); // RIFF is little-endian
    const dataStart = pos + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) break; // truncated/invalid
    chunks.push({ fourCC, data: bytes.subarray(dataStart, dataEnd) });
    pos = dataEnd + (size & 1); // chunks are padded to an even length
  }
  return chunks;
}

/** Assemble a WebP container from an ordered chunk list, stamping the corrected even-padded RIFF size. */
function buildWebp(chunks: Chunk[]): Uint8Array<ArrayBuffer> {
  let body = 4; // 'WEBP'
  for (const c of chunks) body += 8 + c.data.length + (c.data.length & 1);
  const out = new Uint8Array(8 + body);
  const view = new DataView(out.buffer);
  out.set(fourCCBytes('RIFF'), 0);
  view.setUint32(4, body, true);
  out.set(fourCCBytes('WEBP'), 8);
  let pos = 12;
  for (const c of chunks) {
    out.set(fourCCBytes(c.fourCC), pos); pos += 4;
    view.setUint32(pos, c.data.length, true); pos += 4;
    out.set(c.data, pos); pos += c.data.length;
    if (c.data.length & 1) pos += 1; // pad byte (already 0)
  }
  return out;
}

/** A 10-byte VP8X header: feature flags + 24-bit LE canvas width-1 / height-1. */
function makeVp8x(flags: number, w: number, h: number): Uint8Array {
  const d = new Uint8Array(10);
  d[0] = flags & 0xff;
  const wm1 = Math.max(0, w - 1);
  const hm1 = Math.max(0, h - 1);
  d[4] = wm1 & 0xff; d[5] = (wm1 >> 8) & 0xff; d[6] = (wm1 >> 16) & 0xff;
  d[7] = hm1 & 0xff; d[8] = (hm1 >> 8) & 0xff; d[9] = (hm1 >> 16) & 0xff;
  return d;
}

/**
 * Return a copy of `webpBytes` carrying `json` in an `XMP ` chunk. A simple (VP8/VP8L) file is promoted to the
 * extended VP8X form using `dims` as the canvas size; a file that's already VP8X keeps its header (flag set).
 * Idempotent: any pre-existing `XMP ` chunk is replaced, so re-embedding never accumulates chunks. Throws on
 * non-WebP input.
 */
export function embedEntityCard(webpBytes: Uint8Array, json: string, dims: { w: number; h: number }): Uint8Array<ArrayBuffer> {
  const chunks = parseChunks(webpBytes);
  if (!chunks || chunks.length === 0) throw new Error('Not a WebP image.');
  const xmpChunk: Chunk = { fourCC: XMP_FOURCC, data: new TextEncoder().encode(json) };

  if (chunks[0].fourCC === 'VP8X') {
    const header = new Uint8Array(chunks[0].data); // copy before mutating the flag byte
    header[0] |= VP8X_FLAG_XMP;
    const kept = chunks.slice(1).filter((c) => c.fourCC !== XMP_FOURCC);
    return buildWebp([{ fourCC: 'VP8X', data: header }, ...kept, xmpChunk]);
  }

  const bitstream = chunks.find((c) => c.fourCC === 'VP8 ' || c.fourCC === 'VP8L') ?? chunks[0];
  const flags = VP8X_FLAG_XMP | (bitstream.fourCC === 'VP8L' ? VP8X_FLAG_ALPHA : 0);
  const kept = chunks.filter((c) => c.fourCC !== XMP_FOURCC);
  return buildWebp([{ fourCC: 'VP8X', data: makeVp8x(flags, dims.w, dims.h) }, ...kept, xmpChunk]);
}

/** The JSON string embedded by `embedEntityCard`, or null when the file is not a WebP card / carries no chunk. */
export function readEntityCard(bytes: Uint8Array): string | null {
  const chunks = parseChunks(bytes);
  if (!chunks) return null;
  const xmp = chunks.find((c) => c.fourCC === XMP_FOURCC);
  return xmp ? utf8.decode(xmp.data) : null;
}
