/**
 * Builds real GLB/VRM bytes for tests, so the container parsing under test is exercised rather than stubbed.
 * Shared by the VRM metadata reader's tests and the model library's.
 */

const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const GLB_MAGIC = 0x46546c67;

/** Assemble a GLB from a glTF JSON object and an optional binary chunk. */
export function makeGlb(json: unknown, bin?: Uint8Array, magic = GLB_MAGIC): Blob {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (n: number) => (4 - (n % 4)) % 4;
  const jsonPadded = new Uint8Array(jsonBytes.byteLength + pad(jsonBytes.byteLength));
  jsonPadded.fill(0x20); // the GLB spec pads the JSON chunk with trailing spaces
  jsonPadded.set(jsonBytes);

  const binLen = bin ? bin.byteLength + 8 : 0;
  const total = 12 + 8 + jsonPadded.byteLength + binLen;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint32(0, magic, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.byteLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  bytes.set(jsonPadded, 20);

  if (bin) {
    const at = 20 + jsonPadded.byteLength;
    view.setUint32(at, bin.byteLength, true);
    view.setUint32(at + 4, CHUNK_BIN, true);
    bytes.set(bin, at + 8);
  }
  return new Blob([buffer]);
}

/** Stand-in image bytes for an embedded thumbnail, and the data URL they decode to. */
export const THUMB_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
export const THUMB_DATA_URL = `data:image/png;base64,${btoa('\x89PNG')}`;

/** A VRM 1.0 file carrying `meta`, with its thumbnail embedded in the binary chunk. */
export function makeVrm1(meta: Record<string, unknown>, withThumbnail = false): Blob {
  const base: Record<string, unknown> = { extensions: { VRMC_vrm: { meta } } };
  if (!withThumbnail) return makeGlb(base);
  return makeGlb(
    {
      ...base,
      extensions: { VRMC_vrm: { meta: { ...meta, thumbnailImage: 0 } } },
      images: [{ bufferView: 0, mimeType: 'image/png' }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: THUMB_BYTES.byteLength }],
    },
    THUMB_BYTES,
  );
}
