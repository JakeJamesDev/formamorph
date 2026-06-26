import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// Minimal view of a mesh exposing morph targets (the shape setMorphTarget/getMorphDict read).
type MorphMesh = THREE.Object3D & { morphTargetDictionary?: Record<string, number> };

/**
 * Load a VRM purely to read the body slider names — the morph targets on its `Body` mesh. Mirrors
 * VRMViewer's `getMorphDict('Body', …)` lookup but headlessly: no scene, renderer, or animation loop,
 * and GPU resources are disposed afterward. Returns `[]` if there's no `Body` mesh or the load fails.
 */
export async function loadBodyMorphNames(url: string): Promise<string[]> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  let gltf: GLTF | null = null;
  try {
    gltf = await loader.loadAsync(url);
    const body = gltf.scene.children.find((child) => child.name === "Body");
    if (!body) return [];
    const child = (body.children[0] || body) as MorphMesh;
    return Object.keys(child.morphTargetDictionary ?? {});
  } catch {
    return [];
  } finally {
    if (gltf) disposeGltf(gltf);
  }
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
