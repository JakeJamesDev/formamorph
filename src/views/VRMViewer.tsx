import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { Loader2 } from "lucide-react";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { HairTypeDef } from '@/types';
import { BUNDLED_DEFAULT_URL } from '@/lib/defaultAvatar';
import { resolveMorphAlias } from '@/lib/bodyMorphs';
import { medianOpaqueRGB, tintFactors, tintSeedRGB, toByte } from '@/lib/textureMedian';
import { watchOnScreen } from '@/lib/watchOnScreen';

// VRM/MToon material: the base three Material plus the standard/MToon fields the color code touches.
type VrmMaterial = THREE.Material & {
  color?: THREE.Color;
  map?: THREE.Texture | null;
  shadeColorFactor?: THREE.Color;
  isOutline?: boolean;
};

// A scene object viewed as a (possibly morph-target) mesh — three's Mesh fields, optional on Object3D.
type MorphMesh = THREE.Object3D & {
  isMesh?: boolean;
  material?: VrmMaterial | VrmMaterial[];
  geometry?: THREE.BufferGeometry;
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
};

/** Which optional customization morphs the loaded VRM actually exposes, so the UI can hide unsupported sliders. */
export interface VRMCapabilities {
  /** Body-shape/feature morphs present on the `Body` mesh (e.g. 'Belly', 'Breasts', 'Fat', 'B_Pear', …). */
  bodyMorphs: string[];
  /** Hair-style keys (from `hairTypes`) whose shapekey mesh exists in the model. */
  hairStyles: string[];
  /** True if a supported hair style also exposes the `LENGTH` morph. */
  hairLength: boolean;
  /** Representative current colors sampled from the model's textures, to seed the color pickers. */
  colors: { hair?: string; skin?: string; eye?: string };
  /** Names of other colorable materials (clothing, accessories, …) the player may tint. */
  extras: string[];
}

/** Imperative handle for on-demand color sampling (used to lazily seed the "extras" picker). */
export interface VRMViewerHandle {
  /** Calculated current color of a target ('hair'|'skin'|'eye' or a material name); null if unavailable. */
  calcColor: (target: string) => string | null;
}

interface VRMViewerProps {
  /** Body-mesh morph influences keyed by morph name (Belly/Breasts/Fat/B_Pear/…). Composed by the
   *  caller from customization choices and stat-driven values; applied to every Body primitive. */
  bodyMorphValues?: Record<string, number>;
  hairColor?: string;
  eyeColor?: string;
  skinColor?: string;
  hairTypes?: Record<string, HairTypeDef>;
  /** Absent, every hair mesh keeps the visibility its file gives it. */
  currentHairStyle?: string;
  /** Absent, the hair's LENGTH morph keeps its file value. */
  hairLength?: number;
  modelUrl?: string;
  animationFiles?: string[];
  /** Colors to apply to extra (non-channel) materials, keyed by material name. */
  extraColors?: Record<string, string>;
  /** Called once the model loads, reporting which customization morphs/colorables it supports. */
  onCapabilities?: (caps: VRMCapabilities) => void;
  /** When false, the idle animation and secondary motion freeze in place (the scene still renders, so orbit
   *  and slider changes stay live). Defaults to true. */
  animate?: boolean;
}

// Mixamo VRM Rig Mapping
const mixamoVRMRigMap: Record<string, string> = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal',
  mixamorigLeftHandThumb2: 'leftThumbProximal',
  mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal',
  mixamorigLeftHandIndex2: 'leftIndexIntermediate',
  mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal',
  mixamorigLeftHandMiddle2: 'leftMiddleIntermediate',
  mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal',
  mixamorigLeftHandRing2: 'leftRingIntermediate',
  mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal',
  mixamorigLeftHandPinky2: 'leftLittleIntermediate',
  mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigRightHandPinky1: 'rightLittleProximal',
  mixamorigRightHandPinky2: 'rightLittleIntermediate',
  mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigRightHandRing1: 'rightRingProximal',
  mixamorigRightHandRing2: 'rightRingIntermediate',
  mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal',
  mixamorigRightHandMiddle2: 'rightMiddleIntermediate',
  mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal',
  mixamorigRightHandIndex2: 'rightIndexIntermediate',
  mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal',
  mixamorigRightHandThumb2: 'rightThumbProximal',
  mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
};

/** Parsed animation files, shared by every viewer: retargeting reads them and never changes them. */
const fbxCache = new Map<string, Promise<THREE.Group>>();
function loadFbx(path: string): Promise<THREE.Group> {
  let pending = fbxCache.get(path);
  if (!pending) {
    pending = new FBXLoader().loadAsync(path);
    // A failed load isn't kept, so a later mount tries again.
    pending.catch(() => fbxCache.delete(path));
    fbxCache.set(path, pending);
  }
  return pending;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Every texture the object's materials use, once each. */
function texturesOf(root: THREE.Object3D): THREE.Texture[] {
  const textures = new Set<THREE.Texture>();
  root.traverse((obj) => {
    const material = (obj as THREE.Mesh).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
      // MToon keeps its maps in uniforms as well.
      const uniforms = (m as THREE.ShaderMaterial).uniforms;
      if (uniforms) for (const { value } of Object.values(uniforms)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  return [...textures];
}

const VRMViewer = forwardRef<VRMViewerHandle, VRMViewerProps>(({
  bodyMorphValues,
  hairColor,
  eyeColor,
  skinColor,
  currentHairStyle,
  hairLength,
  modelUrl = BUNDLED_DEFAULT_URL,
  animationFiles = ['./idle.fbx', './bashful.fbx', './idle_dwarf.fbx'],
  extraColors,
  onCapabilities,
  animate = true
}, ref) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Read live in the render loop so toggling it doesn't tear down/rebuild the scene.
  const pausedRef = useRef(!animate);
  useEffect(() => { pausedRef.current = !animate; }, [animate]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const gltfRef = useRef<GLTF | null>(null);

  const animationsRef = useRef<Record<string, THREE.AnimationClip>>({});
  const currentAnimationRef = useRef<THREE.AnimationAction | null>(null);
  const animationIndexRef = useRef(0);
  const extrasAppliedRef = useRef<Record<string, string>>({});
  const bodyMorphsAppliedRef = useRef<Record<string, number>>({});

  const [ready, setReady] = useState(false);

  const findMesh = (meshName: string, gltf: GLTF) => {
    return gltf.scene.children.find((child) => child.name === meshName);
  };

  // The morph-target dictionary for a named mesh (matches setMorphTarget's lookup), or null if absent.
  const getMorphDict = (meshName: string, gltf: GLTF) => {
    const mesh = findMesh(meshName, gltf);
    if (!mesh) return null;
    const child = (mesh.children[0] || mesh) as MorphMesh;
    return child.morphTargetDictionary || null;
  };

  // --- Color customization: tint skin/hair/eye materials to match the pickers, on the GPU (no per-pixel work). ---
  const hexToRgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

  // Capture (and cache) a material's base-color texture pixels once, for averaging.
  const getOriginalImageData = (material: VrmMaterial): ImageData | null => {
    if (material.userData.__origImageData !== undefined) return material.userData.__origImageData;
    const img = material.map?.image as HTMLImageElement | undefined;
    let result: ImageData | null = null;
    if (img && img.width && img.height) {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          ctx.drawImage(img, 0, 0);
          result = ctx.getImageData(0, 0, img.width, img.height);
        } catch { result = null; }
      }
    }
    material.userData.__origImageData = result;
    return result;
  };

  // Median opaque pixel of a material's texture → normalized [r,g,b] (0..1), cached. Null if it has no texture.
  const getMedianRGB = (material: VrmMaterial): [number, number, number] | null => {
    if (material.userData.__medianRGB !== undefined) return material.userData.__medianRGB;
    const src = getOriginalImageData(material);
    const median = src ? medianOpaqueRGB(src.data) : null;
    material.userData.__medianRGB = median;
    return median;
  };

  // A material's untinted color (to seed a picker): texture median under the original color factor, else that factor.
  const untintedColor = (material: VrmMaterial) => {
    const median = getMedianRGB(material);
    const color: THREE.Color | null | undefined = material.userData.__origColor ?? material.color;
    const factor: [number, number, number] | null = color?.isColor ? [color.r, color.g, color.b] : null;
    const rgb = median ? tintSeedRGB(median, factor ?? [1, 1, 1]) : factor;
    if (!rgb) return null;
    return '#' + rgb.map(x => toByte(x).toString(16).padStart(2, '0')).join('');
  };

  // GPU tint (no per-pixel work). Textured material: scale the color factor so the texture's median shifts to
  // `hex` (result ≈ texture × target/median → matches the picker). Factor-only material (no texture, e.g. some
  // Blender exports): set the color factor to `hex` directly.
  const tintByMedian = (material: VrmMaterial, hex: string) => {
    // Remember the untinted colors once, so a revert can restore them exactly.
    if (material.userData.__origColor === undefined)
      material.userData.__origColor = material.color?.isColor ? material.color.clone() : null;
    if (material.userData.__origShade === undefined)
      material.userData.__origShade = material.shadeColorFactor?.isColor ? material.shadeColorFactor.clone() : null;
    const [tr, tg, tb] = hexToRgb(hex).map(v => v / 255);
    const origColor: THREE.Color | null = material.userData.__origColor;
    const origShade: THREE.Color | null = material.userData.__origShade;
    const base: [number, number, number] = origColor ? [origColor.r, origColor.g, origColor.b] : [1, 1, 1];
    const { color, shade } = tintFactors([tr, tg, tb], getMedianRGB(material), base, origShade ? [origShade.r, origShade.g, origShade.b] : base);
    if (material.color?.isColor) material.color.setRGB(...color);
    if (material.shadeColorFactor?.isColor) material.shadeColorFactor.setRGB(...shade);
    material.needsUpdate = true;
  };

  // Whether a material belongs to a customization channel — by material name OR mesh name, so it works across
  // VRoid (materials like *_SKIN/*_HAIR/EyeIris) and other rigs (meshes named Body/Hair/...). Clothing is excluded
  // from skin so garments sharing the Body mesh aren't recolored.
  const clothWords = ['cloth', 'top', 'bottom', 'shoe', 'skirt', 'pant', 'shirt', 'dress', 'jacket', 'sock', 'glove', 'sleeve', 'coat', 'bra', 'accessor'];
  const channelMatch = (channel: string, matName: string, meshName: string) => {
    const m = (matName || '').toLowerCase();
    const mesh = (meshName || '').toLowerCase();
    if (channel === 'hair') return m.includes('hair') || mesh.includes('hair');
    if (channel === 'eye') return m.includes('iris') || (m.includes('eye') && !/white|highlight|lash|line|brow/.test(m));
    if (channel === 'skin') {
      if (m.includes('hair') || m.includes('eye') || m.includes('iris') || clothWords.some(w => m.includes(w))) return false;
      return m.includes('skin') || mesh.includes('body') || mesh.includes('skin');
    }
    return false;
  };

  // Run `fn` on every material in the current VRM that belongs to `channel`.
  const forEachChannelMaterial = (channel: string, fn: (m: VrmMaterial) => void) => {
    vrmRef.current?.scene.traverse((obj) => {
      const mesh = obj as MorphMesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m && !m.isOutline && channelMatch(channel, m.name, mesh.name)) fn(m);
      });
    });
  };

  
  const setMorphTarget = (meshName: string, morphTargetName: string, value: number, gltf: GLTF) => {
    if (!gltf.scene) return;

    const node = gltf.scene.children.find((child) => child.name === meshName) ?? findMesh(meshName, gltf);
    if (!node) return;

    // A multi-material mesh (body skin + each clothing piece) is split by GLTFLoader into one
    // primitive per material, each a sibling mesh carrying the same body morphs. Apply the influence
    // to every primitive that exposes the morph so clothing scales with the body (matches v1.2);
    // setting only the first primitive moved the body alone and clipped the clothes.
    let applied = false;
    node.traverse((obj) => {
      const mesh = obj as MorphMesh;
      const dict = mesh.morphTargetDictionary;
      if (!dict || !mesh.morphTargetInfluences) return;
      // Resolve per primitive: a bound name from an older world/model maps onto this model's alias-mate.
      const resolved = resolveMorphAlias(morphTargetName, (candidate) => candidate in dict);
      if (resolved === null) return;
      mesh.morphTargetInfluences[dict[resolved]] = value;
      applied = true;
    });
    if (!applied) {
      console.warn(`Morph target "${morphTargetName}" not found under mesh "${meshName}".`);
    }
  };

  // Apply the whole body-morph map to the Body mesh, zeroing morphs that were applied last time but
  // are no longer present (so unbinding a slider relaxes it rather than freezing its last value).
  const applyBodyMorphs = (gltf: GLTF) => {
    const next = bodyMorphValues ?? {};
    for (const [name, value] of Object.entries(next)) setMorphTarget('Body', name, value, gltf);
    Object.keys(bodyMorphsAppliedRef.current).forEach((name) => {
      if (!(name in next)) setMorphTarget('Body', name, 0, gltf);
    });
    bodyMorphsAppliedRef.current = next;
  };

  // Hair "styles" are the model's distinct hair meshes — top-level scene nodes named like *hair*.
  // Scanning only direct children (not a full traverse) keeps actual hair meshes (Hair, Hair.001) while
  // ignoring VRM spring-bone joints (e.g. J_Sec_Hair*) that live deep under the armature.
  const getHairMeshes = (gltf: GLTF) =>
    gltf.scene.children.filter((c) => c.name && c.name.toLowerCase().includes('hair'));

  // Set a LENGTH morph directly on a hair object (works even when it isn't a direct scene child).
  const applyHairLength = (obj: THREE.Object3D, value: number) => {
    const child = (obj.children[0] || obj) as MorphMesh;
    const dict = child.morphTargetDictionary;
    if (dict && 'LENGTH' in dict && child.morphTargetInfluences) {
      child.morphTargetInfluences[dict['LENGTH']] = value;
    }
  };

  const updateHairStyle = (gltf: GLTF) => {
    const hairMeshes = getHairMeshes(gltf);
    // Multiple hair meshes = selectable styles; show only the chosen one. If the selection matches none
    // (e.g. skipped customization or a model swap), show the first so the avatar is never left bald.
    if (currentHairStyle !== undefined && hairMeshes.length > 1) {
      const matches = hairMeshes.some(c => c.name === currentHairStyle);
      hairMeshes.forEach((c, i) => { c.visible = matches ? c.name === currentHairStyle : i === 0; });
    }
    // Apply hair length to the active hair mesh (or the only one) if it exposes a LENGTH morph.
    const active = hairMeshes.find(c => c.name === currentHairStyle) || hairMeshes[0];
    if (active && hairLength !== undefined) applyHairLength(active, hairLength);
  };

  // Apply `fn` to a target's materials: a channel keyword ('hair'|'skin'|'eye') or an exact extra-material name.
  const forEachTargetMaterial = (target: string, fn: (m: VrmMaterial) => void) => {
    if (target === 'hair' || target === 'skin' || target === 'eye') return forEachChannelMaterial(target, fn);
    vrmRef.current?.scene.traverse((obj) => {
      const mesh = obj as MorphMesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => { if (m && !m.isOutline && m.name === target) fn(m); });
    });
  };

  const tintTarget = (target: string, hex: string) => forEachTargetMaterial(target, (m) => tintByMedian(m, hex));

  // Restore a target's materials to their untinted colors (the "no color" / revert state).
  const resetTarget = (target: string) => forEachTargetMaterial(target, (m) => {
    if (m.userData.__origColor) m.color?.copy(m.userData.__origColor);
    if (m.userData.__origShade) m.shadeColorFactor?.copy(m.userData.__origShade);
    m.needsUpdate = true;
  });

  // Calculated representative color of a target (its first material's median) — for seeding a picker.
  const calcColor = (target: string) => {
    let c: string | null = null;
    forEachTargetMaterial(target, (m) => { if (!c) c = untintedColor(m); });
    return c;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- calcColor reads live refs; a stable handle is fine.
  useImperativeHandle(ref, () => ({ calcColor }), []);

  // Extra colorable materials = anything that isn't a primary channel or a face/eye detail (clothing, etc.).
  const getColorableExtras = (gltf: GLTF) => {
    const names = new Set<string>();
    gltf.scene.traverse((obj) => {
      const mesh = obj as MorphMesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m || !m.name || m.isOutline) return;
        if (channelMatch('hair', m.name, obj.name) || channelMatch('skin', m.name, obj.name) || channelMatch('eye', m.name, obj.name)) return;
        if (/face|mouth|brow|lash|eyeline|eyewhite|highlight|tooth|teeth|tongue|eye/.test(m.name.toLowerCase())) return;
        names.add(m.name);
      });
    });
    return [...names];
  };

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      // A stowed or hidden mount has no box; keep the last size until it shows again.
      if (!width || !height) return;
      const aspectRatio = width / height;
      
      cameraRef.current.aspect = aspectRatio;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      
      // Adjust camera position based on aspect ratio
      if (aspectRatio < 1) {
        // Portrait orientation
        cameraRef.current.position.set(0.0, 1.2, 3.0); // Closer view, slightly higher
        controlsRef.current?.target.set(0.0, 1.0, 0.0); // Look at upper body
      } else {
        // Landscape orientation
        cameraRef.current.position.set(0.0, 1.0, 5.0);
        controlsRef.current?.target.set(0.0, 1.0, 0.0);
      }
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
    };
  

   useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const onScreen = watchOnScreen(mount);
    // Set up scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30.0, 1, 0.1, 20.0);
    const renderer = new THREE.WebGLRenderer();
    // The check reads every program's logs on its first draw, a long stall for a VRM's many materials.
    renderer.debug.checkShaderErrors = import.meta.env.DEV;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Set up lights
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(light);

    // Set up camera and controls
    camera.position.set(0.0, 1.0, 5.0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.screenSpacePanning = true;
    controls.target.set(0.0, 1.0, 0.0);
    controls.update();

    // Set up helpers
    //const gridHelper = new THREE.GridHelper(10, 10);
    //scene.add(gridHelper);

    //const axesHelper = new THREE.AxesHelper(5);
    //scene.add(axesHelper);

    // Store refs
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    // Initial resize to set correct dimensions
    handleResize();

    // GLTFLoader/FBXLoader have no abort, so a flag gates their async callbacks: on unmount (model swap,
    // layout change) an in-flight load must not repopulate nulled refs, attach to the disposed scene, or —
    // once all FBX clips land — start the self-rescheduling animation timer chain that cleanup can no
    // longer clear (its clearTimeout already ran while animTimeout was still undefined).
    let cancelled = false;
    let holdDraw = false;

    // Load VRM model
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    // No URL on a build with no bundled default: the scene stays empty.
    if (modelUrl) loader.load(
      modelUrl,
      (gltf) => { void (async () => {
        if (cancelled) return;
        const vrm: VRM = gltf.userData.vrm;
        // No frame draws until the model's shaders and textures are ready.
        holdDraw = true;
        scene.add(vrm.scene);
        vrmRef.current = vrm;
        gltfRef.current = gltf;

        // Disable frustum culling
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });

        // Rotate if the VRM is VRM0.0
        VRMUtils.rotateVRM0(vrm);

        console.log('VRM model loaded:', vrm);

        // Initial morph target setup
        applyBodyMorphs(gltf);

        //attachCylinderToHand(vrm);

        updateHairStyle(gltf);

        // Compile the shaders off the main thread and upload one texture a frame, so the first draw
        // doesn't stall the page. This runs after the setup above, which decides the programs drawn.
        await renderer.compileAsync(scene, camera);
        for (const texture of texturesOf(vrm.scene)) {
          if (cancelled) return;
          renderer.initTexture(texture);
          await nextFrame();
        }
        if (cancelled) return;
        holdDraw = false;

        // Report which customization morphs this model exposes so the UI hides unsupported sliders.
        if (onCapabilities) {
          const bodyDict = getMorphDict('Body', gltf) || {};
          const bodyMorphs = Object.keys(bodyDict);
          const hairMeshes = getHairMeshes(gltf);
          const styles = hairMeshes.map(c => c.name);
          const hairLengthSupported = hairMeshes.some((c) => {
            const child = (c.children[0] || c) as MorphMesh;
            return child.morphTargetDictionary && 'LENGTH' in child.morphTargetDictionary;
          });
          // Sample each part's current color from its texture so the pickers start at the model's real colors.
          const sampleColor = (channel: string) => {
            let c: string | null = null;
            forEachChannelMaterial(channel, (m) => { if (!c) c = untintedColor(m); });
            return c;
          };
          const colors = { hair: sampleColor('hair') ?? undefined, skin: sampleColor('skin') ?? undefined, eye: sampleColor('eye') ?? undefined };
          onCapabilities({ bodyMorphs, hairStyles: styles, hairLength: hairLengthSupported, colors, extras: getColorableExtras(gltf) });
        }

        setReady(true);
        // Load Mixamo animation after VRM is loaded
        //loadMixamoAnimation('./idle_tired.fbx');


        animationFiles.forEach(file => loadMixamoAnimation(file));
      })().catch((error: unknown) => console.error('Error preparing VRM:', error)); },
      (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
      (error) => console.error('Error loading VRM:', error)
    );


    

    // Load Mixamo animation
    const loadMixamoAnimation = (animationPath: string) => {
      const animationName = (animationPath.split('/').pop() ?? '').split('.')[0]; // Extract name from filename
      loadFbx(animationPath).then((asset) => {
        if (cancelled) return;
        const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com');
        
        if (!clip || !vrmRef.current) {
          console.error('Animation clip not found or VRM not loaded');
          return;
        }

        

        const tracks: THREE.KeyframeTrack[] = [];

        const restRotationInverse = new THREE.Quaternion();
        const parentRestWorldRotation = new THREE.Quaternion();
        const _quatA = new THREE.Quaternion();
        const _vec3 = new THREE.Vector3();

        // Adjust with reference to hips height
        const motionHipsHeight = asset.getObjectByName('mixamorigHips')!.position.y;
        const vrmHipsY = vrmRef.current.humanoid?.getNormalizedBoneNode('hips' as VRMHumanBoneName)?.getWorldPosition(_vec3).y ?? 0;
        const vrmRootY = vrmRef.current.scene.getWorldPosition(_vec3).y;
        const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
        const hipsPositionScale = vrmHipsHeight / motionHipsHeight;

        // VRM 0.0 faces -Z while Mixamo / VRM 1.0 face +Z, so mirror the X/Z axes for 0.0 models.
        const isVRM0 = vrmRef.current.meta?.metaVersion === '0';

        clip.tracks.forEach((track) => {
          const trackSplitted = track.name.split('.');
          const mixamoRigName = trackSplitted[0];
          const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
          const vrmNodeName = vrmRef.current?.humanoid?.getNormalizedBoneNode(vrmBoneName as VRMHumanBoneName)?.name;
          const mixamoRigNode = asset.getObjectByName(mixamoRigName);

          if (vrmNodeName != null && mixamoRigNode) {
            const propertyName = trackSplitted[1];

            mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
            mixamoRigNode.parent?.getWorldQuaternion(parentRestWorldRotation);

            if (track instanceof THREE.QuaternionKeyframeTrack) {
              // Retarget rotation
              const newTrack = new THREE.QuaternionKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v: number, i: number) => {
                  if (i % 4 === 0) {
                    _quatA.fromArray(track.values, i);
                    _quatA
                      .premultiply(parentRestWorldRotation)
                      .multiply(restRotationInverse);
                    return isVRM0 ? -_quatA.x : _quatA.x;
                  }
                  if (i % 4 === 1) return _quatA.y;
                  if (i % 4 === 2) return isVRM0 ? -_quatA.z : _quatA.z;
                  return _quatA.w;
                })
              );
              tracks.push(newTrack);
            } else if (track instanceof THREE.VectorKeyframeTrack) {
              const newTrack = new THREE.VectorKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v: number, i: number) => (isVRM0 && i % 3 !== 1 ? -v : v) * hipsPositionScale)
              );
              tracks.push(newTrack);
            }
          }
        });

        const newClip = new THREE.AnimationClip(animationName, clip.duration, tracks);

        // Store the animation clip
        animationsRef.current[animationName] = newClip;

        if (!mixerRef.current) {
          mixerRef.current = new THREE.AnimationMixer(vrmRef.current.scene);
        }

        console.log(`${animationName} animation loaded`);

        // If all animations are loaded, start the animation loop
        if (Object.keys(animationsRef.current).length === animationFiles.length) {
          startAnimationLoop();
        }

      }, (error: unknown) => console.error(`Error loading ${animationName} animation:`, error));
    };

    let animTimeout: ReturnType<typeof setTimeout> | undefined;
    const startAnimationLoop = () => {
      const playNextAnimation = () => {
        // Stop the chain if the effect was cleaned up while a timer was pending (guards the post-unmount tick).
        if (cancelled) return;
        // While frozen, don't swap/reset the clip (that would snap the pose to a new keyframe); re-check
        // shortly so the cycle resumes once animation is re-enabled.
        if (pausedRef.current) {
          animTimeout = setTimeout(() => playNextAnimation(), 500);
          return;
        }
        if (currentAnimationRef.current) {
          currentAnimationRef.current.fadeOut(0.5);
        }

        const animationName = (animationFiles[animationIndexRef.current].split('/').pop() ?? '').split('.')[0];
        const nextAction = mixerRef.current!.clipAction(animationsRef.current[animationName]);
        nextAction.reset().fadeIn(0.5).play();
        currentAnimationRef.current = nextAction;
  
        // Schedule the next animation
        animationIndexRef.current = (animationIndexRef.current + 1) % animationFiles.length;
        animTimeout = setTimeout(() => playNextAnimation(),
          (animationsRef.current[animationName].duration - 0.5) * 1000);
      };
  
      playNextAnimation();
    };

    // Animation loop. Track the RAF id and the pending animation timeout so cleanup can cancel them —
    // otherwise every remount (model swap, layout change) leaks another loop/timer driving a disposed scene.
    let rafId = 0;
    const renderFrame = () => {
      rafId = requestAnimationFrame(renderFrame);
      // Always consume the delta (so unpausing doesn't jump); feed 0 while paused to freeze in place.
      const deltaTime = clock.getDelta();
      const dt = pausedRef.current ? 0 : deltaTime;

      if (mixerRef.current) {
        mixerRef.current.update(dt);
      }

      if (vrmRef.current) {
        vrmRef.current.update(dt);
      }

      // Out of sight (a stowed or off-screen panel), or while the model prepares, the frame isn't drawn.
      if (!holdDraw && onScreen.visible && mount.clientWidth && mount.clientHeight) renderer.render(scene, camera);
    };

    const clock = new THREE.Clock();
    renderFrame();

     

    window.addEventListener('resize', handleResize);
    // Re-measure whenever the mount's own box changes (layout swaps, drawer reflow, orientation) — a window
    // resize alone reads stale dimensions because it fires before the new layout settles.
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mount);

    // Cleanup function
    return () => {
      // Gate any still-in-flight GLTF/FBX callbacks so they can't restart the animation loop post-unmount.
      cancelled = true;
      onScreen.stop();
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
      clearTimeout(animTimeout);

      // Safe cleanup of THREE.js resources
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          const mesh = object as MorphMesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((material) => material.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        });
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        // Release the WebGL context immediately; otherwise rapid model swaps pile up contexts until the
        // browser drops the oldest and rendering/loads silently break.
        rendererRef.current.forceContextLoss?.();
      }

      // Safely remove renderer from DOM
      if (mount && rendererRef.current) {
        const rendererDomElement = rendererRef.current.domElement;
        if (mount.contains(rendererDomElement)) {
          mount.removeChild(rendererDomElement);
        }
      }

      // Clear references
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      vrmRef.current = null;
      mixerRef.current = null;
      gltfRef.current = null;
    };
    // Build the scene/model once on mount; the listed values are applied by the dedicated effects
    // below, so re-running full setup would needlessly rebuild the renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Each effect re-applies one morph/color value when it (or `ready`) changes. The morph/color
  // helpers are recreated every render, so they're intentionally excluded from the dep arrays —
  // listing them would re-run on every render. The ready-timeout effect seeds all values once.
  /* eslint-disable react-hooks/exhaustive-deps */
  // Re-apply the whole body-morph map whenever it changes (covers customization + stat-driven values).
  useEffect(() => {
    if (gltfRef.current && ready) {
      applyBodyMorphs(gltfRef.current);
    }
  }, [bodyMorphValues]);

  // Apply a channel color, or revert it to the model's own when unset (untouched / reverted).
  useEffect(() => {
    if (ready) { if (hairColor) tintTarget('hair', hairColor); else resetTarget('hair'); }
  }, [hairColor, ready]);

  useEffect(() => {
    if (ready) { if (eyeColor) tintTarget('eye', eyeColor); else resetTarget('eye'); }
  }, [eyeColor, ready]);

  useEffect(() => {
    if (ready) { if (skinColor) tintTarget('skin', skinColor); else resetTarget('skin'); }
  }, [skinColor, ready]);

  // Apply / revert extra-material colors (clothing, accessories, …).
  useEffect(() => {
    if (!ready) return;
    const next = extraColors || {};
    Object.entries(next).forEach(([name, hex]) => { if (hex) tintTarget(name, hex); });
    Object.keys(extrasAppliedRef.current).forEach((name) => { if (!(name in next)) resetTarget(name); });
    extrasAppliedRef.current = next;
  }, [extraColors, ready]);

  useEffect(() => {
    if (gltfRef.current && ready) {
      updateHairStyle(gltfRef.current);
    }
  }, [currentHairStyle, hairLength]);

  useEffect(() => {
    setTimeout(()=>{
        if (!gltfRef.current) return;
        applyBodyMorphs(gltfRef.current);
        // Colors are applied by the dedicated [color, ready] effects below — applying them here too
        // re-ran with stale (pre-seed) values and clobbered the seeded colors.
        updateHairStyle(gltfRef.current);
    }, 500)
  }, [ready]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {modelUrl && !ready && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Loader2 className="animate-spin" size={32} />
        </div>
      )}
    </div>
  );
});

VRMViewer.displayName = 'VRMViewer';

export default VRMViewer;
