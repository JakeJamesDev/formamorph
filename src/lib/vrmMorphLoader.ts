import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { catalogNames, expressionBoundMorphs, vrmMorphCatalog, type CatalogMorph } from "./vrmMorphCatalog";

export interface MorphSplit {
  body: string[];
  head: string[];
}

/**
 * Load a VRM purely to read its slider keys, the same catalog VRMViewer reports, but headlessly: no scene,
 * renderer, or animation loop, and GPU resources are disposed afterward. Returns `[]` if the load fails.
 */
export async function loadMorphCatalog(url: string): Promise<CatalogMorph[]> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  let gltf: GLTF | null = null;
  try {
    gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM | undefined;
    return vrmMorphCatalog(gltf.scene, expressionBoundMorphs(vrm));
  } catch {
    return [];
  } finally {
    if (gltf) disposeGltf(gltf);
  }
}

/** The slider names a VRM exposes, split into the keys on its `Body` mesh and its head features. */
export async function loadMorphSplit(url: string): Promise<MorphSplit> {
  const catalog = await loadMorphCatalog(url);
  return { body: catalogNames(catalog, "body"), head: catalogNames(catalog, "head") };
}

function disposeGltf(gltf: GLTF): void {
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  });
}
