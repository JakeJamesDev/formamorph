import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { catalogNames, expressionBoundMorphs, vrmMorphCatalog, type CatalogMorph } from "./vrmMorphCatalog";
import { sceneColorChannels } from "./vrmColorChannels";
import type { ColorChannel } from "@/types";

export interface MorphSplit {
  body: string[];
  head: string[];
}

/** What a VRM offers stats and traits: its slider catalog, its color channels, and each channel's own color. */
export interface VrmLook {
  catalog: CatalogMorph[];
  channels: ColorChannel[];
  colors: Partial<Record<ColorChannel, string>>;
}

/**
 * Load a VRM purely to read its slider keys and color channels, as VRMViewer finds them, but headlessly: no
 * scene, renderer, or animation loop, and GPU resources are disposed afterward. Empty if the load fails.
 */
export async function loadVrmLook(url: string): Promise<VrmLook> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  let gltf: GLTF | null = null;
  try {
    gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM | undefined;
    return { catalog: vrmMorphCatalog(gltf.scene, expressionBoundMorphs(vrm)), ...sceneColorChannels(gltf.scene) };
  } catch {
    return { catalog: [], channels: [], colors: {} };
  } finally {
    if (gltf) disposeGltf(gltf);
  }
}

/** A VRM's slider catalog, the same VRMViewer reports. `[]` if the load fails. */
export async function loadMorphCatalog(url: string): Promise<CatalogMorph[]> {
  return (await loadVrmLook(url)).catalog;
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
