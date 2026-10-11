// Shape keys on an entity model, whatever its format: every mesh's morph targets, read and driven by name.
// The entity lane counterpart of VRMViewer's Body-mesh morphs, with the same alias rule.

import type * as THREE from 'three';
import { resolveMorphAlias } from './bodyMorphs';

type MorphMesh = THREE.Object3D & {
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
};
type MorphTargets = Required<Pick<MorphMesh, 'morphTargetDictionary' | 'morphTargetInfluences'>>;

/** Each mesh under `root` that carries morph targets. */
function morphMeshes(root: THREE.Object3D): MorphTargets[] {
  const meshes: MorphTargets[] = [];
  root.traverse((object) => {
    const { morphTargetDictionary, morphTargetInfluences } = object as MorphMesh;
    if (morphTargetDictionary && morphTargetInfluences) meshes.push({ morphTargetDictionary, morphTargetInfluences });
  });
  return meshes;
}

/** Every shape-key name under `root`, once each, in the order the meshes first expose them. */
export function modelMorphNames(root: THREE.Object3D): string[] {
  const names = new Set<string>();
  for (const mesh of morphMeshes(root)) for (const name of Object.keys(mesh.morphTargetDictionary)) names.add(name);
  return [...names];
}

/**
 * Apply morph influences by shape-key name to every mesh that carries the key, or its alias-mate. Keys in
 * `previous` that `next` drops go back to 0.
 */
export function applyMorphInfluences(
  root: THREE.Object3D,
  next: Readonly<Record<string, number>>,
  previous: Readonly<Record<string, number>>,
): void {
  const meshes = morphMeshes(root);
  const set = (name: string, value: number) => {
    for (const { morphTargetDictionary: dict, morphTargetInfluences: influences } of meshes) {
      const resolved = resolveMorphAlias(name, (candidate) => candidate in dict);
      if (resolved !== null) influences[dict[resolved]] = value;
    }
  };
  for (const name of Object.keys(previous)) if (!(name in next)) set(name, 0);
  for (const [name, value] of Object.entries(next)) set(name, value);
}
