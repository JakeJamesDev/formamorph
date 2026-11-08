import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  VRMExpression,
  VRMExpressionManager,
  VRMExpressionMaterialColorBind,
  VRMExpressionMorphTargetBind,
  type VRM,
} from '@pixiv/three-vrm';
import { catalogNames, expressionBoundMorphs, isFaceRigMorph, vrmMorphCatalog } from './vrmMorphCatalog';
import { morphMesh } from '@/test/morphMesh';

/** A VRoid-shaped scene: Body, Face and Hair nodes, each holding one primitive per material. */
function avatar(parts: { body?: string[][]; face?: string[][]; hair?: string[][] }) {
  const root = new THREE.Group();
  const node = (name: string, primitives: string[][] = []) => {
    const group = new THREE.Group();
    group.name = name;
    for (const keys of primitives) group.add(morphMesh(keys));
    root.add(group);
    return group;
  };
  const face = node('Face', parts.face);
  node('Body', parts.body);
  node('Hair', parts.hair);
  return { root, face };
}

describe('vrmMorphCatalog', () => {
  it('lists Body keys as body and keys on other meshes as head, once each', () => {
    const { root } = avatar({
      face: [['Ear Shape'], ['Ear Shape']],
      body: [['Waist', 'Bust'], ['Waist', 'Bust']],
      hair: [['Ear Shape']],
    });

    expect(vrmMorphCatalog(root)).toEqual([
      { name: 'Waist', group: 'body' },
      { name: 'Bust', group: 'body' },
      { name: 'Ear Shape', group: 'head' },
    ]);
  });

  it('keeps a key that is on the Body mesh in body even when another mesh carries it', () => {
    const { root } = avatar({ face: [['Thickness']], body: [['Thickness']] });

    expect(vrmMorphCatalog(root)).toEqual([{ name: 'Thickness', group: 'body' }]);
  });

  it('skips facial-rig keys, hair LENGTH and expression-driven keys from head', () => {
    const { root } = avatar({
      face: [['Fcl_MTH_A', 'Fcl_HA_Fung1', 'JawOpen', 'vrc.v_aa', 'Blush', 'Ear Shape']],
      hair: [['LENGTH', 'Bangs']],
    });

    expect(catalogNames(vrmMorphCatalog(root, new Set(['Blush'])), 'head')).toEqual(['Ear Shape', 'Bangs']);
  });

  it('does not filter Body keys, whatever their name', () => {
    const { root } = avatar({ body: [['Fcl_Body_Test', 'LENGTH']] });

    expect(catalogNames(vrmMorphCatalog(root, new Set(['LENGTH'])), 'body')).toEqual(['Fcl_Body_Test', 'LENGTH']);
  });

  it('is empty for a model without shape keys or a Body node', () => {
    expect(vrmMorphCatalog(new THREE.Group())).toEqual([]);
  });
});

describe('isFaceRigMorph', () => {
  it('recognizes VRoid, ARKit and VRChat face keys in any case', () => {
    for (const name of ['Fcl_EYE_Close', 'fcl_brw_joy', 'eyeBlinkLeft', 'MOUTHSMILERIGHT', 'tongueOut', 'vrc.v_oh']) {
      expect(isFaceRigMorph(name)).toBe(true);
    }
  });

  it('leaves shape keys outside those rigs alone', () => {
    for (const name of ['Ear Shape', 'Horns', 'eyeBlink', 'Bust']) expect(isFaceRigMorph(name)).toBe(false);
  });
});

describe('expressionBoundMorphs', () => {
  it('names the morphs each expression binds, by their key on the bound primitive', () => {
    const { face } = avatar({ face: [['Fcl_ALL_Joy', 'Blush', 'Ear Shape']] });
    const primitive = face.children[0] as THREE.Mesh;
    const joy = new VRMExpression('happy');
    joy.addBind(new VRMExpressionMorphTargetBind({ primitives: [primitive], index: 1, weight: 1 }));
    joy.addBind(new VRMExpressionMaterialColorBind({
      material: new THREE.MeshStandardMaterial(),
      type: 'color',
      targetValue: new THREE.Color(1, 0, 0),
    }));
    const manager = new VRMExpressionManager();
    manager.registerExpression(joy);

    expect(expressionBoundMorphs({ expressionManager: manager } as unknown as VRM)).toEqual(new Set(['Blush']));
  });

  it('is empty without a VRM', () => {
    expect(expressionBoundMorphs(undefined)).toEqual(new Set());
  });
});
