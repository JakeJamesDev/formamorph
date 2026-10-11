import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyMorphInfluences, modelMorphNames } from './modelMorphs';
import { morphMesh } from '@/test/morphMesh';

const influence = (mesh: THREE.Mesh, name: string) => mesh.morphTargetInfluences![mesh.morphTargetDictionary![name]];

describe('modelMorphNames', () => {
  it('lists every shape key across every mesh, once each, in first-seen order', () => {
    const root = new THREE.Group();
    const body = morphMesh(['Belly', 'Fat']);
    const shirt = morphMesh(['Fat', 'Sleeves']);
    root.add(body);
    body.add(shirt);
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));

    expect(modelMorphNames(root)).toEqual(['Belly', 'Fat', 'Sleeves']);
  });

  it('is empty for a model with no shape keys', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    expect(modelMorphNames(root)).toEqual([]);
  });
});

describe('applyMorphInfluences', () => {
  it('sets the key on every mesh that carries it, and leaves meshes without it alone', () => {
    const root = new THREE.Group();
    const body = morphMesh(['Belly', 'Fat']);
    const shirt = morphMesh(['Belly']);
    const hat = morphMesh(['Brim']);
    root.add(body, shirt, hat);

    applyMorphInfluences(root, { Belly: 0.6 }, {});

    expect(influence(body, 'Belly')).toBeCloseTo(0.6);
    expect(influence(shirt, 'Belly')).toBeCloseTo(0.6);
    expect(influence(body, 'Fat')).toBe(0);
    expect(influence(hat, 'Brim')).toBe(0);
  });

  it('resolves a bound name to its alias-mate when the mesh lacks the exact key', () => {
    const root = new THREE.Group();
    const older = morphMesh(['Belly']);
    const newer = morphMesh(['Waist']);
    root.add(older, newer);

    applyMorphInfluences(root, { Abdomen: 0.4 }, {});

    expect(influence(older, 'Belly')).toBeCloseTo(0.4);
    expect(influence(newer, 'Waist')).toBeCloseTo(0.4);
  });

  it('prefers the exact key over an alias-mate on the same mesh', () => {
    const root = new THREE.Group();
    const mesh = morphMesh(['Belly', 'Waist']);
    root.add(mesh);

    applyMorphInfluences(root, { Belly: 0.5 }, {});

    expect(influence(mesh, 'Belly')).toBeCloseTo(0.5);
    expect(influence(mesh, 'Waist')).toBe(0);
  });

  it('zeroes a key applied last time that the new map drops', () => {
    const root = new THREE.Group();
    const mesh = morphMesh(['Belly', 'Fat']);
    root.add(mesh);
    applyMorphInfluences(root, { Belly: 0.7, Fat: 0.3 }, {});

    applyMorphInfluences(root, { Fat: 0.9 }, { Belly: 0.7, Fat: 0.3 });

    expect(influence(mesh, 'Belly')).toBe(0);
    expect(influence(mesh, 'Fat')).toBeCloseTo(0.9);
  });

  it('ignores a key no mesh carries', () => {
    const root = new THREE.Group();
    const mesh = morphMesh(['Belly']);
    root.add(mesh);

    expect(() => applyMorphInfluences(root, { Horns: 1 }, {})).not.toThrow();
    expect(influence(mesh, 'Belly')).toBe(0);
  });
});
