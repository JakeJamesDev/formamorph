// Which shape keys on a VRM get a customization slider, and whether each belongs to the body or the head.
// Shared by the viewer's capability report and the headless loader that stats read.

import type * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

/** `body`: a key on the `Body` mesh. `head`: any other slider key (face, ears, hair shapes). */
export type MorphGroup = 'body' | 'head';

export interface CatalogMorph {
  name: string;
  group: MorphGroup;
}

type MorphMesh = THREE.Object3D & { morphTargetDictionary?: Record<string, number> };
// The fields of three-vrm's morph-target bind; other bind kinds (material color, texture) lack them.
type MorphBind = { primitives?: MorphMesh[]; index?: number };

// Apple ARKit's 52 face blend shapes, which face-tracking exporters name verbatim.
const ARKIT_FACE = new Set([
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight', 'mouthSmileLeft', 'mouthSmileRight',
  'mouthFrownLeft', 'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper', 'mouthPressLeft', 'mouthPressRight',
  'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
].map((name) => name.toLowerCase()));

/** True for a key from a known facial rig: VRoid's `Fcl_` set, ARKit's face shapes, or VRChat visemes. */
export function isFaceRigMorph(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('fcl_') || lower.startsWith('vrc.') || ARKIT_FACE.has(lower);
}

/** Names of the morphs the VRM's expressions drive; three-vrm sets those every frame. */
export function expressionBoundMorphs(vrm: VRM | undefined): Set<string> {
  const names = new Set<string>();
  for (const expression of vrm?.expressionManager?.expressions ?? []) {
    for (const bind of expression.binds) {
      const { primitives, index } = bind as MorphBind;
      if (!primitives || index === undefined) continue;
      for (const primitive of primitives) {
        const dict = primitive.morphTargetDictionary ?? {};
        const name = Object.keys(dict).find((key) => dict[key] === index);
        if (name !== undefined) names.add(name);
      }
    }
  }
  return names;
}

/**
 * Every slider key under `root`, once each: the `Body` mesh's keys first, in their file order, then head keys
 * in first-seen order. Head keys skip expression-driven morphs, known facial rigs and hair `LENGTH`, which has
 * its own control. A key on the `Body` mesh is `body` even when other meshes carry it too.
 */
export function vrmMorphCatalog(root: THREE.Object3D, expressionBound: ReadonlySet<string> = new Set()): CatalogMorph[] {
  const body = root.children.find((child) => child.name === 'Body');
  const bodyNames: string[] = [];
  body?.traverse((object) => {
    for (const name of Object.keys((object as MorphMesh).morphTargetDictionary ?? {})) {
      if (!bodyNames.includes(name)) bodyNames.push(name);
    }
  });
  const headNames: string[] = [];
  root.traverse((object) => {
    for (const name of Object.keys((object as MorphMesh).morphTargetDictionary ?? {})) {
      if (bodyNames.includes(name) || headNames.includes(name)) continue;
      if (name === 'LENGTH' || expressionBound.has(name) || isFaceRigMorph(name)) continue;
      headNames.push(name);
    }
  });
  return [
    ...bodyNames.map((name) => ({ name, group: 'body' as const })),
    ...headNames.map((name) => ({ name, group: 'head' as const })),
  ];
}

/** The catalog's names in one group, in catalog order. */
export function catalogNames(catalog: readonly CatalogMorph[], group: MorphGroup): string[] {
  return catalog.filter((morph) => morph.group === group).map((morph) => morph.name);
}
