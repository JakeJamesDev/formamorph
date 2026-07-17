import type { VrmLicense } from '@/types';

/**
 * Reads a VRM's embedded rights metadata and thumbnail straight out of the file's glTF JSON chunk.
 *
 * Deliberately does not go through `@pixiv/three-vrm`'s `VRMMetaLoaderPlugin`: that plugin checks a VRM 1.0
 * file's `licenseUrl` against a Set defaulting to just `https://vrm.dev/licenses/1.0/` and *throws* on any
 * other value, with no wildcard to opt out of — so an ordinary user file with a custom license URL would fail
 * to load entirely. Reading the JSON chunk sidesteps that, and skips parsing geometry we don't want anyway.
 *
 * Sibling of `entityCard.ts` (RIFF/WebP) and `sdMetadata.ts` (PNG chunks): same "parse the container by hand"
 * approach, different format.
 */

// GLB container: a 12-byte header then length-prefixed chunks. Values are little-endian.
const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

/** The slices of a glTF file this module reads: the JSON chunk, plus the binary chunk the thumbnail lives in. */
interface GlbChunks {
  json: GltfJson;
  bin?: Uint8Array;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
}

interface GltfImage {
  bufferView?: number;
  mimeType?: string;
  uri?: string;
}

interface GltfTexture {
  source?: number;
}

/** VRM 0.0 meta, as it appears in the `VRM` glTF extension. `texture` indexes `textures`, not `images`. */
interface Vrm0MetaRaw {
  title?: string;
  author?: string;
  texture?: number;
  licenseName?: string;
  otherLicenseUrl?: string;
  commercialUssageName?: string;
}

/** VRM 1.0 meta, as it appears in the `VRMC_vrm` glTF extension. `thumbnailImage` indexes `images` directly. */
interface Vrm1MetaRaw {
  name?: string;
  authors?: string[];
  thumbnailImage?: number;
  licenseUrl?: string;
  allowRedistribution?: boolean;
  commercialUsage?: string;
  creditNotation?: string;
}

interface GltfJson {
  images?: GltfImage[];
  textures?: GltfTexture[];
  bufferViews?: GltfBufferView[];
  extensions?: {
    VRM?: { meta?: Vrm0MetaRaw };
    VRMC_vrm?: { meta?: Vrm1MetaRaw };
  };
}

/** What a VRM file told us about itself. `thumbnail` is the embedded image as a data URL, in its own format. */
export interface VrmMetaResult {
  license: VrmLicense;
  thumbnail?: string;
}

/** A `.glb`/`.vrm` with no VRM extension: nothing is known, and nothing may be assumed. */
const UNKNOWN: VrmLicense = { metaVersion: null };

/** VRM 0.0 encodes redistribution inside its license enum rather than as a flag. */
function redistributionFromLicenseName(licenseName?: string): boolean | undefined {
  if (!licenseName) return undefined;
  if (licenseName === 'Redistribution_Prohibited') return false;
  // The CC family all permit redistribution; `Other` defers to a URL we can't interpret.
  if (licenseName.startsWith('CC')) return true;
  return undefined;
}

function normalizeV0(meta: Vrm0MetaRaw): VrmLicense {
  const commercial = meta.commercialUssageName;
  return {
    metaVersion: '0',
    title: meta.title || undefined,
    authors: meta.author ? [meta.author] : undefined,
    licenseName: meta.licenseName || undefined,
    licenseUrl: meta.otherLicenseUrl || undefined,
    allowRedistribution: redistributionFromLicenseName(meta.licenseName),
    commercialUse: commercial === 'Allow' ? 'allow' : commercial === 'Disallow' ? 'disallow' : undefined,
    // VRM 0.0 has no credit-notation field; CC_BY implies attribution but saying so would be our inference.
    creditRequired: undefined,
  };
}

function normalizeV1(meta: Vrm1MetaRaw): VrmLicense {
  const commercial = meta.commercialUsage;
  const known = commercial === 'personalNonProfit' || commercial === 'personalProfit' || commercial === 'corporation';
  return {
    metaVersion: '1',
    title: meta.name || undefined,
    authors: meta.authors?.length ? meta.authors : undefined,
    // VRM 1.0 drops the enum in favor of a URL plus explicit flags.
    licenseName: undefined,
    licenseUrl: meta.licenseUrl || undefined,
    allowRedistribution: meta.allowRedistribution,
    commercialUse: known ? commercial : undefined,
    creditRequired: meta.creditNotation === 'required' ? true : meta.creditNotation === 'unnecessary' ? false : undefined,
  };
}

/** Split a GLB into its JSON and BIN chunks. Returns null if the bytes aren't a GLB at all. */
function parseGlb(buffer: ArrayBuffer): GlbChunks | null {
  if (buffer.byteLength < HEADER_BYTES) return null;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return null;

  let json: GltfJson | undefined;
  let bin: Uint8Array | undefined;
  let offset = HEADER_BYTES;

  while (offset + CHUNK_HEADER_BYTES <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + CHUNK_HEADER_BYTES;
    if (start + length > buffer.byteLength) break; // truncated file — keep whatever parsed cleanly
    if (type === CHUNK_JSON) {
      // The spec pads this chunk with trailing spaces, which JSON.parse ignores; strip NULs too, since a
      // non-conforming exporter padding with those would otherwise make the whole file unreadable.
      const text = new TextDecoder().decode(new Uint8Array(buffer, start, length)).replace(/\0+$/, '');
      json = JSON.parse(text) as GltfJson;
    } else if (type === CHUNK_BIN) {
      bin = new Uint8Array(buffer, start, length);
    }
    offset = start + length;
  }
  return json ? { json, bin } : null;
}

/** Resolve a glTF image index to a data URL, reading its bytes out of the BIN chunk. */
function imageToDataUrl(index: number | undefined, { json, bin }: GlbChunks): string | undefined {
  if (index === undefined) return undefined;
  const image = json.images?.[index];
  if (!image) return undefined;
  // An external/embedded URI needs no buffer lookup; VRM thumbnails are normally bufferView-backed.
  if (image.uri) return image.uri.startsWith('data:') ? image.uri : undefined;
  if (image.bufferView === undefined || !bin) return undefined;

  const view = json.bufferViews?.[image.bufferView];
  if (!view) return undefined;
  const start = view.byteOffset ?? 0;
  if (start + view.byteLength > bin.byteLength) return undefined;

  const bytes = bin.subarray(start, start + view.byteLength);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${image.mimeType || 'image/png'};base64,${btoa(binary)}`;
}

/**
 * Read a VRM/GLB's license and embedded thumbnail. Never throws: an unreadable or non-VRM file reports
 * `metaVersion: null` so callers can badge it as unknown rather than treating absence as permission.
 */
export async function readVrmMeta(file: Blob): Promise<VrmMetaResult> {
  let chunks: GlbChunks | null = null;
  try {
    chunks = parseGlb(await file.arrayBuffer());
  } catch {
    return { license: UNKNOWN };
  }
  if (!chunks) return { license: UNKNOWN };

  const v1 = chunks.json.extensions?.VRMC_vrm?.meta;
  if (v1) {
    return { license: normalizeV1(v1), thumbnail: imageToDataUrl(v1.thumbnailImage, chunks) };
  }

  const v0 = chunks.json.extensions?.VRM?.meta;
  if (v0) {
    // VRM 0.0's thumbnail is a *texture* index; step through it to reach the underlying image.
    const source = v0.texture === undefined ? undefined : chunks.json.textures?.[v0.texture]?.source;
    return { license: normalizeV0(v0), thumbnail: imageToDataUrl(source, chunks) };
  }

  return { license: UNKNOWN };
}
