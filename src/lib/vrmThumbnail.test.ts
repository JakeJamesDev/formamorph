import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { frameModel, renderVrmThumbnail } from './vrmThumbnail';

const box = (min: [number, number, number], max: [number, number, number]) =>
  new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));

describe('frameModel with a head bone', () => {
  // Proportions measured from the bundled VRM: head bone at 1.351, crown of the bounds at 1.558.
  const head = new THREE.Vector3(0, 1.351, 0);
  const body = box([-0.686, 0, -0.149], [0.686, 1.558, 0.133]);
  const headHeight = 1.558 - 1.351;
  const fit = (h: number) => h / 2 / Math.tan(Math.PI / 12);

  it('aims above the head bone, which sits at the base of the skull rather than the face', () => {
    const { target } = frameModel(head, body);
    expect(target.y).toBeGreaterThan(head.y);
    expect(target.y).toBeCloseTo(head.y + headHeight * 0.25, 5);
  });

  it('frames a couple of head-heights so the shoulders sit below the face', () => {
    const { position, target } = frameModel(head, body);
    expect(position.z - target.z).toBeCloseTo(fit(headHeight * 2.2), 5);
  });

  it('stands the camera off along +Z, the direction the model faces', () => {
    const { position, target } = frameModel(head, body);
    expect(position.z).toBeGreaterThan(target.z);
    expect(position.x).toBe(target.x);
    expect(position.y).toBe(target.y);
  });

  it('follows an off-centre head rather than assuming the origin', () => {
    const offset = new THREE.Vector3(0.5, 1.2, -0.4);
    const { target } = frameModel(offset, box([-5, 0, -5], [5, 1.4, 5]));
    expect(target.x).toBe(0.5);
    expect(target.z).toBe(-0.4);
  });

  it('scales with head size, so a big-headed model is not framed too tightly', () => {
    const chibi = frameModel(head, box([-0.5, 0, -0.5], [0.5, 1.351 + 0.5, 0.5])); // 0.5 head height
    const realistic = frameModel(head, body); // ~0.21 head height
    expect(chibi.position.z - chibi.target.z).toBeGreaterThan(realistic.position.z - realistic.target.z);
  });

  it('stays in front of the head when the bounds sit below the head bone', () => {
    // Degenerate rig: without a floor on head height the camera would land on or behind the face.
    const { position, target } = frameModel(head, box([-0.1, 0, -0.1], [0.1, 1.0, 0.1]));
    expect(position.z).toBeGreaterThan(target.z);
  });
});

describe('frameModel without a head bone', () => {
  it('centres on the model and pulls back far enough to fit it', () => {
    const { position, target } = frameModel(null, box([-1, 0, -1], [1, 2, 1]));
    expect(target.toArray()).toEqual([0, 1, 0]);
    // Largest dimension is 2; at a 30° FOV that needs ~3.73 of distance, plus the 1.2 margin.
    expect(position.z - target.z).toBeCloseTo((2 / 2 / Math.tan(Math.PI / 12)) * 1.2, 4);
  });

  it('pulls back further for a larger model', () => {
    const small = frameModel(null, box([-1, 0, -1], [1, 2, 1]));
    const large = frameModel(null, box([-10, 0, -10], [10, 20, 10]));
    expect(large.position.z - large.target.z).toBeGreaterThan(small.position.z - small.target.z);
  });

  it('fits the largest dimension, not just height', () => {
    const wide = frameModel(null, box([-5, 0, -0.1], [5, 0.2, 0.1]));
    // A 10-wide, 0.2-tall model must be framed on its width or it would overflow the sides.
    expect(wide.position.z - wide.target.z).toBeCloseTo((10 / 2 / Math.tan(Math.PI / 12)) * 1.2, 4);
  });

  it('handles an off-centre model', () => {
    const { target } = frameModel(null, box([4, 0, 4], [6, 2, 6]));
    expect(target.toArray()).toEqual([5, 1, 5]);
  });
});

describe('renderVrmThumbnail', () => {
  it('returns undefined rather than throwing when the model cannot be loaded', async () => {
    // jsdom has no WebGL context either, so this also covers the no-GPU path.
    await expect(renderVrmThumbnail(new Blob(['not a model']), null)).resolves.toBeUndefined();
  });

  it('returns undefined for an empty file', async () => {
    await expect(renderVrmThumbnail(new Blob([]), '0')).resolves.toBeUndefined();
  });
});
