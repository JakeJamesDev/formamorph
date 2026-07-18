import { describe, it, expect } from 'vitest';
import { readVrmMeta } from './vrmMeta';
import { makeGlb } from '@/test/glbFixture';

const CHUNK_JSON = 0x4e4f534a;

const PIXEL = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // the real thumbnail bytes
const DECOY = new Uint8Array([0x44, 0x45, 0x43, 0x59]); // a second image, to catch a wrong index

/**
 * A file whose thumbnail lives in the BIN chunk, wired so the indices genuinely differ: the real image is
 * `images[1]`, and `textures[0]` points at it. A reader that skipped VRM 0.0's texture→source indirection
 * would land on `images[0]` and get DECOY, so these tests can actually fail.
 */
const withThumb = (extensions: unknown) =>
  makeGlb(
    {
      extensions,
      images: [
        { bufferView: 1, mimeType: 'image/png' }, // decoy at index 0
        { bufferView: 0, mimeType: 'image/png' }, // real at index 1
      ],
      textures: [{ source: 1 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: PIXEL.byteLength },
        { buffer: 0, byteOffset: PIXEL.byteLength, byteLength: DECOY.byteLength },
      ],
    },
    new Uint8Array([...PIXEL, ...DECOY]),
  );

describe('non-VRM input', () => {
  it('reports unknown for a plain glb with no VRM extension', async () => {
    // Padded so the JSON chunk needs real padding handling — otherwise this would pass by failing to parse,
    // which is the same answer for the wrong reason.
    const { license, thumbnail } = await readVrmMeta(makeGlb({ images: [], asset: { version: '2.0' } }));
    expect(license).toEqual({ metaVersion: null });
    expect(thumbnail).toBeUndefined();
  });

  it('reads a JSON chunk padded with NULs rather than spaces', async () => {
    // Non-conforming exporters pad with NULs; JSON.parse would throw and lose an otherwise-valid file.
    const text = new TextEncoder().encode(JSON.stringify({ extensions: { VRM: { meta: { title: 'Padded' } } } }));
    const padded = new Uint8Array(text.byteLength + ((4 - (text.byteLength % 4)) % 4)); // zero-filled
    padded.set(text);
    const buffer = new ArrayBuffer(12 + 8 + padded.byteLength);
    const view = new DataView(buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, buffer.byteLength, true);
    view.setUint32(12, padded.byteLength, true);
    view.setUint32(16, CHUNK_JSON, true);
    new Uint8Array(buffer).set(padded, 20);
    const { license } = await readVrmMeta(new Blob([buffer]));
    expect(license).toMatchObject({ metaVersion: '0', title: 'Padded' });
  });

  it('reports unknown rather than throwing on bytes that are not a GLB', async () => {
    await expect(readVrmMeta(new Blob(['not a model']))).resolves.toEqual({ license: { metaVersion: null } });
  });

  it('reports unknown on an empty file', async () => {
    await expect(readVrmMeta(new Blob([]))).resolves.toEqual({ license: { metaVersion: null } });
  });

  it('reports unknown when the JSON chunk is malformed', async () => {
    // Hand-build a GLB whose JSON chunk isn't valid JSON.
    const bad = new TextEncoder().encode('{oops');
    const buffer = new ArrayBuffer(12 + 8 + bad.byteLength);
    const view = new DataView(buffer);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, buffer.byteLength, true);
    view.setUint32(12, bad.byteLength, true);
    view.setUint32(16, CHUNK_JSON, true);
    new Uint8Array(buffer).set(bad, 20);
    await expect(readVrmMeta(new Blob([buffer]))).resolves.toEqual({ license: { metaVersion: null } });
  });
});

describe('VRM 0.0', () => {
  const v0 = (meta: unknown) => makeGlb({ extensions: { VRM: { meta } } });

  it('normalizes title, author, and commercial use', async () => {
    const { license } = await readVrmMeta(
      v0({ title: 'Robot', author: 'Ada', commercialUssageName: 'Allow', licenseName: 'CC_BY' }),
    );
    expect(license).toMatchObject({
      metaVersion: '0',
      title: 'Robot',
      authors: ['Ada'],
      commercialUse: 'allow',
      licenseName: 'CC_BY',
    });
  });

  it('derives redistribution from the license enum', async () => {
    const prohibited = await readVrmMeta(v0({ licenseName: 'Redistribution_Prohibited' }));
    expect(prohibited.license.allowRedistribution).toBe(false);

    const cc = await readVrmMeta(v0({ licenseName: 'CC_BY_NC_SA' }));
    expect(cc.license.allowRedistribution).toBe(true);
  });

  it('leaves redistribution unknown for an uninterpretable license', async () => {
    const { license } = await readVrmMeta(v0({ licenseName: 'Other', otherLicenseUrl: 'https://example.com/l' }));
    expect(license.allowRedistribution).toBeUndefined();
    expect(license.licenseUrl).toBe('https://example.com/l');
  });

  it('maps Disallow to disallow', async () => {
    const { license } = await readVrmMeta(v0({ commercialUssageName: 'Disallow' }));
    expect(license.commercialUse).toBe('disallow');
  });

  it('treats a meta with every field absent as version 0 but otherwise unknown', async () => {
    // Legal in VRM 0.0: all meta fields are optional.
    const { license } = await readVrmMeta(v0({}));
    expect(license).toEqual({
      metaVersion: '0',
      title: undefined,
      authors: undefined,
      licenseName: undefined,
      licenseUrl: undefined,
      allowRedistribution: undefined,
      commercialUse: undefined,
      creditRequired: undefined,
    });
  });

  it('reads the thumbnail through the texture indirection', async () => {
    const { thumbnail } = await readVrmMeta(withThumb({ VRM: { meta: { texture: 0 } } }));
    // texture 0 -> textures[0].source = 1 -> images[1]; skipping that step would yield the decoy.
    expect(thumbnail).toBe(`data:image/png;base64,${btoa('\x89PNG')}`);
  });
});

describe('VRM 1.0', () => {
  const v1 = (meta: unknown) => makeGlb({ extensions: { VRMC_vrm: { meta } } });

  it('normalizes name, authors, and the explicit flags', async () => {
    const { license } = await readVrmMeta(
      v1({
        name: 'Android',
        authors: ['Ada', 'Grace'],
        licenseUrl: 'https://vrm.dev/licenses/1.0/',
        allowRedistribution: false,
        commercialUsage: 'corporation',
        creditNotation: 'required',
      }),
    );
    expect(license).toMatchObject({
      metaVersion: '1',
      title: 'Android',
      authors: ['Ada', 'Grace'],
      licenseUrl: 'https://vrm.dev/licenses/1.0/',
      allowRedistribution: false,
      commercialUse: 'corporation',
      creditRequired: true,
    });
  });

  it('maps creditNotation unnecessary to false', async () => {
    const { license } = await readVrmMeta(v1({ creditNotation: 'unnecessary' }));
    expect(license.creditRequired).toBe(false);
  });

  it('leaves an unrecognized commercialUsage unknown rather than guessing', async () => {
    const { license } = await readVrmMeta(v1({ commercialUsage: 'somethingNew' }));
    expect(license.commercialUse).toBeUndefined();
  });

  it('reads the thumbnail directly from the image index, with no texture indirection', async () => {
    // VRM 1.0 indexes `images` directly: index 1 is the real image, so index 0's decoy must not appear.
    const { thumbnail } = await readVrmMeta(withThumb({ VRMC_vrm: { meta: { thumbnailImage: 1 } } }));
    expect(thumbnail).toBe(`data:image/png;base64,${btoa('\x89PNG')}`);
  });

  it('is preferred over a VRM 0.0 block in the same file', async () => {
    const both = makeGlb({ extensions: { VRM: { meta: { title: 'old' } }, VRMC_vrm: { meta: { name: 'new' } } } });
    const { license } = await readVrmMeta(both);
    expect(license.metaVersion).toBe('1');
    expect(license.title).toBe('new');
  });

  it('accepts a licenseUrl that three-vrm would reject outright', async () => {
    // three-vrm's meta loader throws on any licenseUrl outside its accept-list; reading the chunk must not.
    const { license } = await readVrmMeta(v1({ name: 'Custom', licenseUrl: 'https://example.com/my-license' }));
    expect(license.licenseUrl).toBe('https://example.com/my-license');
    expect(license.title).toBe('Custom');
  });
});

describe('thumbnail edge cases', () => {
  it('returns no thumbnail when the meta names no image', async () => {
    const { thumbnail } = await readVrmMeta(withThumb({ VRMC_vrm: { meta: {} } }));
    expect(thumbnail).toBeUndefined();
  });

  it('returns no thumbnail when the image index does not exist', async () => {
    const { thumbnail } = await readVrmMeta(withThumb({ VRMC_vrm: { meta: { thumbnailImage: 7 } } }));
    expect(thumbnail).toBeUndefined();
  });

  it('returns no thumbnail when the bufferView overruns the binary chunk', async () => {
    const file = makeGlb(
      {
        extensions: { VRMC_vrm: { meta: { thumbnailImage: 0 } } },
        images: [{ bufferView: 0, mimeType: 'image/png' }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 9999 }],
      },
      PIXEL,
    );
    await expect(readVrmMeta(file)).resolves.toMatchObject({ thumbnail: undefined });
  });

  it('passes through an embedded data-uri image', async () => {
    const file = makeGlb({
      extensions: { VRMC_vrm: { meta: { thumbnailImage: 0 } } },
      images: [{ uri: 'data:image/webp;base64,AAAA' }],
    });
    await expect(readVrmMeta(file)).resolves.toMatchObject({ thumbnail: 'data:image/webp;base64,AAAA' });
  });

  it('ignores an external image uri it cannot resolve offline', async () => {
    const file = makeGlb({
      extensions: { VRMC_vrm: { meta: { thumbnailImage: 0 } } },
      images: [{ uri: 'thumb.png' }],
    });
    await expect(readVrmMeta(file)).resolves.toMatchObject({ thumbnail: undefined });
  });
});
