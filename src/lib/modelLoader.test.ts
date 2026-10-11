// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createModelLoader, loadModelMorphNames } from './modelLoader';
import { makeGlb } from '@/test/glbFixture';

/** A one-triangle GLB whose mesh carries a shape key per name, as a model data URL. The buffer rides in the BIN
 *  chunk, so the loader reads nothing beyond the file. */
async function triangleModel(targetNames: string[]): Promise<{ name: string; data: string }> {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const offsets = targetNames.map(() => new Float32Array([0, 0, 0.1, 0, 0, 0.1, 0, 0, 0.1]));
  const views = [positions, ...offsets];
  const bin = new Uint8Array(views.length * 36);
  views.forEach((view, i) => bin.set(new Uint8Array(view.buffer), i * 36));
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{ attributes: { POSITION: 0 }, targets: targetNames.map((_, i) => ({ POSITION: i + 1 })) }],
      extras: { targetNames },
    }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: views.map((_, i) => ({ buffer: 0, byteOffset: i * 36, byteLength: 36 })),
    accessors: views.map((_, i) => ({
      bufferView: i, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, i ? 0.1 : 0],
    })),
  };
  const glb = Buffer.from(await makeGlb(gltf, bin).arrayBuffer());
  return { name: 'triangle.glb', data: `data:model/gltf-binary;base64,${glb.toString('base64')}` };
}

describe('loadModelMorphNames', () => {
  it("reads a glTF model's shape-key names through the real loader", async () => {
    expect(await loadModelMorphNames(await triangleModel(['Cracks', 'Moss']))).toEqual(['Cracks', 'Moss']);
  });

  it('is empty for a model with no shape keys', async () => {
    expect(await loadModelMorphNames(await triangleModel([]))).toEqual([]);
  });

  it('is empty, without throwing, for no model data or a file that fails to load', async () => {
    expect(await loadModelMorphNames({})).toEqual([]);
    expect(await loadModelMorphNames({ name: 'broken.glb', data: 'data:model/gltf-binary;base64,bm90IGEgbW9kZWw=' })).toEqual([]);
  });
});

describe('createModelLoader', () => {
  it('has a loader for each format the viewer shows, and none for others', () => {
    for (const type of ['glb', 'gltf', 'fbx', 'obj']) expect(createModelLoader(type), type).not.toBeNull();
    expect(createModelLoader('unknown')).toBeNull();
  });
});
