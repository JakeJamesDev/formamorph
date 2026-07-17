import * as THREE from 'three';
import { GLTFLoader, type GLTF, type GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMMetaLoaderPlugin } from '@pixiv/three-vrm';

/**
 * Renders a portrait thumbnail for a VRM that carries no embedded one, by loading it offscreen and taking a
 * single frame. The fallback half of the library's thumbnail story — `vrmMeta.readVrmMeta` supplies the
 * embedded image when there is one, and this runs only when there isn't.
 *
 * Follows `vrmMorphLoader.ts`'s headless discipline (load, read, dispose), but needs a real WebGL context,
 * so unlike that module it can't run without a GPU-backed canvas.
 */

/** Matches VRMViewer's framing so a thumbnail reads like the model the player will actually see. */
const FOV = 30;
/**
 * Portrait framing is expressed in head-heights rather than metres so it holds for any model — a chibi with a
 * huge head and a tall realistic one frame alike. "Head height" is the head bone up to the top of the bounds.
 */
const PORTRAIT_HEADS = 2.2;
/**
 * The VRM head bone sits at the base of the skull, not the middle of the face, so the look-at has to rise off
 * it to centre the portrait. A quarter of a head height puts the face mid-frame with the shoulders below.
 */
const HEAD_TARGET_RISE = 0.25;
/** Margin so a bounds-fitted model doesn't touch the frame edge. */
const FIT_MARGIN = 1.2;
const DEFAULT_SIZE = 256;

/** Distance at which `height` exactly fills a 30° vertical FOV. */
const distanceToFit = (height: number) => height / 2 / Math.tan((FOV * Math.PI) / 180 / 2);

/** Where to put the camera and what to aim it at. */
export interface ModelFraming {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/**
 * Choose a camera placement: a head-and-shoulders portrait when the model has a head bone, otherwise a fit
 * of the whole model. A plain `.glb` has no humanoid rig, and guessing where its "head" is would frame
 * arbitrary geometry badly — showing all of it is the honest answer.
 *
 * Assumes the model already faces +Z (VRM 1.0 natively; VRM 0.0 once rotated).
 */
export function frameModel(head: THREE.Vector3 | null, bounds: THREE.Box3): ModelFraming {
  if (head) {
    // Top of the bounds is the crown (hair included, which we want in frame). Floored so a model whose bounds
    // somehow sit below the head bone still yields a positive, usable head height instead of a camera inside it.
    const headHeight = Math.max(bounds.max.y - head.y, 0.01);
    const target = new THREE.Vector3(head.x, head.y + headHeight * HEAD_TARGET_RISE, head.z);
    const distance = distanceToFit(headHeight * PORTRAIT_HEADS);
    return { position: new THREE.Vector3(target.x, target.y, target.z + distance), target };
  }
  const size = bounds.getSize(new THREE.Vector3());
  const target = bounds.getCenter(new THREE.Vector3());
  // Fit the largest dimension, not just height: a wide, flat model would overflow the sides otherwise.
  const distance = distanceToFit(Math.max(size.x, size.y, size.z)) * FIT_MARGIN;
  return { position: new THREE.Vector3(target.x, target.y, target.z + distance), target };
}

/**
 * Stands in for the real `VRMMetaLoaderPlugin`, which throws on any VRM 1.0 `licenseUrl` outside its
 * accept-list — an ordinary user file would fail to load outright. We already have the metadata from
 * `readVrmMeta`, so skipping its parse costs nothing.
 *
 * It must still publish a `vrmMeta`, not nothing: `VRMLoaderPlugin.afterRoot` only constructs its `VRM` when
 * both `vrmMeta` and `vrmHumanoid` are set, so staying silent would leave `gltf.userData.vrm` undefined and
 * take the humanoid rig — and with it the head bone this module frames on — down with it.
 *
 * Cast because only `afterRoot` is ever called, not the full class surface.
 */
const stubMetaPlugin = (parser: GLTFParser, metaVersion: '0' | '1' | null): VRMMetaLoaderPlugin =>
  ({
    parser,
    name: 'VRMMetaLoaderPlugin',
    afterRoot: async (gltf: GLTF) => {
      if (metaVersion) gltf.userData.vrmMeta = { metaVersion };
    },
  }) as unknown as VRMMetaLoaderPlugin;

/**
 * Render a portrait of `file` and return it as a WebP data URL, or `undefined` if it can't be rendered
 * (unreadable model, or no WebGL context available). Never throws.
 *
 * `metaVersion` comes from `readVrmMeta`: VRM 0.0 models face away from the camera and need a half turn.
 * `VRMUtils.rotateVRM0` normally does this, but it reads `vrm.meta`, which the no-op meta plugin leaves unset.
 */
export async function renderVrmThumbnail(
  file: Blob,
  metaVersion: '0' | '1' | null,
  size = DEFAULT_SIZE,
): Promise<string | undefined> {
  let url: string | undefined;
  let gltf: GLTF | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    // Inside the try: creating the URL is itself a step that can fail, and the contract is to never throw.
    url = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser, { metaPlugin: stubMetaPlugin(parser, metaVersion) }));
    gltf = await loader.loadAsync(url);

    const vrm = gltf.userData.vrm as VRM | undefined;
    const root = vrm?.scene ?? gltf.scene;
    if (metaVersion === '0') root.rotation.y = Math.PI;
    root.updateWorldMatrix(true, true);

    const scene = new THREE.Scene();
    scene.add(root);
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(light);

    const head = vrm?.humanoid?.getRawBoneNode('head')?.getWorldPosition(new THREE.Vector3()) ?? null;
    const { position, target } = frameModel(head, new THREE.Box3().setFromObject(root));

    const canvas = document.createElement('canvas');
    // preserveDrawingBuffer keeps the frame readable by toDataURL after the draw call returns.
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(size, size, false);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);
    camera.position.copy(position);
    camera.lookAt(target);
    renderer.render(scene, camera);

    const dataUrl = canvas.toDataURL('image/webp', 0.9);
    // A context that can't encode WebP silently hands back a PNG data URL; treat only a real WebP as success.
    return dataUrl.startsWith('data:image/webp') ? dataUrl : undefined;
  } catch {
    return undefined;
  } finally {
    if (gltf) VRMUtils.deepDispose(gltf.scene);
    renderer?.forceContextLoss();
    renderer?.dispose();
    if (url) URL.revokeObjectURL(url);
  }
}
