// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

type GltfJson = {
  images: { bufferView: number }[];
  textures: { source: number }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  materials: { extensions?: { VRMC_materials_mtoon?: { shadeMultiplyTexture?: { index: number } } } }[];
};

/** The bundled avatar with one MToon shade texture's PNG bytes zeroed, so the device fails to decode it. */
function avatarWithUndecodableMtoonTexture(): ArrayBuffer {
  const glb = new Uint8Array(readFileSync('public/default-avatar.vrm'));
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as GltfJson;
  const binStart = 20 + jsonLength + 8;
  const textureIndex = json.materials
    .map((m) => m.extensions?.VRMC_materials_mtoon?.shadeMultiplyTexture?.index)
    .find((i): i is number => i !== undefined);
  if (textureIndex === undefined) throw new Error('fixture has no MToon shade texture');
  const bufferView = json.bufferViews[json.images[json.textures[textureIndex].source].bufferView];
  const start = binStart + (bufferView.byteOffset ?? 0);
  glb.fill(0, start, start + bufferView.byteLength);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

describe('VRM load with an MToon texture that fails to decode', () => {
  let url = '';

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // three's loaders read these browser globals, which Node lacks.
    vi.stubGlobal('self', globalThis);
    vi.stubGlobal('ProgressEvent', class extends Event {});
    // Decodes valid PNGs and rejects anything else, like a browser decoder.
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
      const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      if (!PNG_SIGNATURE.every((b, i) => head[i] === b)) throw new Error('The source image could not be decoded.');
      return { width: 1, height: 1, close: () => {} };
    });
    url = URL.createObjectURL(new Blob([avatarWithUndecodableMtoonTexture()]));
  });

  afterEach(() => {
    URL.revokeObjectURL(url);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the model without that texture instead of rejecting', async () => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Couldn't load texture"), expect.anything());
    expect((gltf.userData.vrm as VRM | undefined)?.scene).toBeDefined();
  });
});
