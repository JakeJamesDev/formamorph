import type * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { modelMorphNames } from './modelMorphs';
import { resolveModelType } from './UtilityComponents';
import type { MediaAsset } from '@/types';

/** The three.js loader for an entity model's format, or null for a format the viewer can't show. */
export function createModelLoader(modelType: string): GLTFLoader | FBXLoader | OBJLoader | null {
  switch (modelType) {
    case 'glb':
    case 'gltf':
      return new GLTFLoader();
    case 'fbx':
      return new FBXLoader();
    case 'obj':
      return new OBJLoader();
    default:
      return null;
  }
}

/** The object a loader yields: GLTFLoader wraps it in `{ scene }`, FBX and OBJ hand it over directly. */
export const loadedRoot = (loaded: THREE.Object3D | { scene: THREE.Object3D }): THREE.Object3D =>
  'scene' in loaded ? loaded.scene : loaded;

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}

/** Parse a model file's bytes into its object, or null for a format the viewer can't show. */
async function parseModel(modelType: string, bytes: ArrayBuffer): Promise<THREE.Object3D | null> {
  const loader = createModelLoader(modelType);
  if (loader instanceof GLTFLoader) return (await loader.parseAsync(bytes, '')).scene;
  if (loader instanceof FBXLoader) return loader.parse(bytes, '');
  if (loader instanceof OBJLoader) return loader.parse(new TextDecoder().decode(bytes));
  return null;
}

/**
 * Load an entity model headlessly to read its shape-key names across every mesh. Empty for a model with
 * none, an unsupported format, or a failed load.
 */
export async function loadModelMorphNames(model: Partial<MediaAsset>): Promise<string[]> {
  if (!model.data) return [];
  let root: THREE.Object3D | null = null;
  try {
    root = await parseModel(resolveModelType(model), await (await fetch(model.data)).arrayBuffer());
    return root ? modelMorphNames(root) : [];
  } catch {
    return [];
  } finally {
    if (root) disposeObject(root);
  }
}
