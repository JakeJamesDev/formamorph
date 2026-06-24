import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { Loader2 } from "lucide-react";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { BodyShape, HairTypeDef } from '@/types';

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
  bellySize: number;
  breastSize: number;
  bodyWeight: number;
  hairColor?: string;
  eyeColor?: string;
  skinColor?: string;
  hairTypes?: Record<string, HairTypeDef>;
  currentHairStyle: string;
  hairLength: number;
  bodyShape: BodyShape;
  modelUrl?: string;
  animationFiles?: string[];
  /** Colors to apply to extra (non-channel) materials, keyed by material name. */
  extraColors?: Record<string, string>;
  /** Called once the model loads, reporting which customization morphs/colorables it supports. */
  onCapabilities?: (caps: VRMCapabilities) => void;
}

// Mixamo VRM Rig Mapping
const mixamoVRMRigMap = {
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

const VRMViewer = forwardRef<VRMViewerHandle, VRMViewerProps>(({
  bellySize,
  breastSize,
  bodyWeight,
  hairColor,
  eyeColor,
  skinColor,
  currentHairStyle,
  hairLength,
  bodyShape,
  modelUrl = './readheadedit.vrm',
  animationFiles = ['./idle.fbx', './bashful.fbx', './idle_dwarf.fbx'],
  extraColors,
  onCapabilities
}, ref) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const vrmRef = useRef(null);
  const mixerRef = useRef(null);
  const gltfRef = useRef(null);
  
  const animationsRef = useRef({});
  const currentAnimationRef = useRef(null);
  const animationIndexRef = useRef(0);
  const extrasAppliedRef = useRef({});

  const [ready, setReady] = useState(false);

  const cylinderRef = useRef(null);

  const attachCylinderToHand = (vrm) => {
    if (!vrm || !vrm.humanoid) return;

    // Create a cylinder geometry
    const geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cylinder = new THREE.Mesh(geometry, material);

    // Get the right hand bone
    const rightHandBone = vrm.humanoid.getNormalizedBoneNode('hips');

    if (rightHandBone) {
      // Adjust the cylinder's position and rotation relative to the hand
      cylinder.position.set(0, 0.05, 0); // Adjust these values as needed
      cylinder.rotation.set(Math.PI / 2, 0, 0); // Adjust rotation as needed

      // Add the cylinder to the hand bone
      rightHandBone.add(cylinder);

      // Store the cylinder reference
      cylinderRef.current = cylinder;

      console.log('Cylinder attached to right hand');
    } else {
      console.error('Right hand bone not found');
    }
  };


  const findMesh= (meshName, gltf) =>{
    return gltf.scene.children.find(child => child.name === meshName);
  }

  // The morph-target dictionary for a named mesh (matches setMorphTarget's lookup), or null if absent.
  const getMorphDict = (meshName, gltf) => {
    const mesh = findMesh(meshName, gltf);
    if (!mesh) return null;
    const child = mesh.children[0] || mesh;
    return child.morphTargetDictionary || null;
  };

  // --- Color customization: tint skin/hair/eye materials to match the pickers, on the GPU (no per-pixel work). ---
  const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

  // Capture (and cache) a material's base-color texture pixels once, for averaging.
  const getOriginalImageData = (material) => {
    if (material.userData.__origImageData !== undefined) return material.userData.__origImageData;
    const img = material.map?.image;
    let result = null;
    if (img && img.width && img.height) {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      try {
        ctx.drawImage(img, 0, 0);
        result = ctx.getImageData(0, 0, img.width, img.height);
      } catch { result = null; }
    }
    material.userData.__origImageData = result;
    return result;
  };

  // Average opaque pixels of a material's texture → normalized [r,g,b] (0..1), cached. Null if it has no texture.
  const getAvgRGB = (material) => {
    if (material.userData.__avgRGB !== undefined) return material.userData.__avgRGB;
    const src = getOriginalImageData(material);
    let avg = null;
    if (src) {
      const d = src.data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 10) continue;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      if (n) avg = [r / n / 255, g / n / 255, b / n / 255];
    }
    material.userData.__avgRGB = avg;
    return avg;
  };

  // A representative current color for a material (to seed a picker): texture average, else the color factor.
  const averageColor = (material) => {
    const avg = getAvgRGB(material);
    const rgb = avg ?? (material.color?.isColor ? [material.color.r, material.color.g, material.color.b] : null);
    if (!rgb) return null;
    return '#' + rgb.map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
  };

  // GPU tint (no per-pixel work). Textured material: scale the color factor so the texture's average shifts to
  // `hex` (result ≈ texture × target/avg → matches the picker; target==avg is identity). Factor-only material
  // (no texture, e.g. some Blender exports): set the color factor to `hex` directly.
  const tintByAverage = (material, hex) => {
    // Remember the untinted colors once, so a revert can restore them exactly.
    if (material.userData.__origColor === undefined)
      material.userData.__origColor = material.color?.isColor ? material.color.clone() : null;
    if (material.userData.__origShade === undefined)
      material.userData.__origShade = material.shadeColorFactor?.isColor ? material.shadeColorFactor.clone() : null;
    const [tr, tg, tb] = hexToRgb(hex).map(v => v / 255);
    const avg = getAvgRGB(material);
    let r = tr, g = tg, b = tb;
    if (avg) {
      const f = (t, a) => Math.max(0, Math.min(4, t / Math.max(a, 0.01)));
      r = f(tr, avg[0]); g = f(tg, avg[1]); b = f(tb, avg[2]);
    }
    if (material.color?.isColor) material.color.setRGB(r, g, b);
    if (material.shadeColorFactor?.isColor) material.shadeColorFactor.setRGB(r, g, b);
    material.needsUpdate = true;
  };

  // Whether a material belongs to a customization channel — by material name OR mesh name, so it works across
  // VRoid (materials like *_SKIN/*_HAIR/EyeIris) and other rigs (meshes named Body/Hair/...). Clothing is excluded
  // from skin so garments sharing the Body mesh aren't recolored.
  const clothWords = ['cloth', 'top', 'bottom', 'shoe', 'skirt', 'pant', 'shirt', 'dress', 'jacket', 'sock', 'glove', 'sleeve', 'coat', 'bra', 'accessor'];
  const channelMatch = (channel, matName, meshName) => {
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
  const forEachChannelMaterial = (channel, fn) => {
    vrmRef.current?.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m && !m.isOutline && channelMatch(channel, m.name, obj.name)) fn(m);
      });
    });
  };

  
  const setMorphTarget = (meshName, morphTargetName, value, gltf) => {
    if (!gltf.scene)
      return;
    
      // const dict = {
      //   "Belly":0,
      //   "Breasts":1,
      //   "Weight":2
      // }

    let mesh = gltf.scene.children.find(child => child.name === meshName);
    if (!mesh)
        mesh = findMesh(meshName, gltf);
    let child = mesh.children[0];
    if (!child)
      child = mesh;
    //console.log(mesh)
    if (mesh && child.morphTargetDictionary) {
      const morphTargetIndex = child.morphTargetDictionary[morphTargetName];//dict[morphTargetName];
      if (morphTargetIndex !== undefined) {
        child.morphTargetInfluences[morphTargetIndex] = value;
      } else {
        console.warn(`Morph target "${morphTargetName}" not found in mesh "${meshName}".`);
      }
    } else {
      console.warn(`Mesh "${meshName}" not found or does not have morph targets.`);
    }
  };

  // Hair "styles" are the model's distinct hair meshes — top-level scene nodes named like *hair*.
  // Scanning only direct children (not a full traverse) keeps actual hair meshes (Hair, Hair.001) while
  // ignoring VRM spring-bone joints (e.g. J_Sec_Hair*) that live deep under the armature.
  const getHairMeshes = (gltf) =>
    gltf.scene.children.filter(c => c.name && c.name.toLowerCase().includes('hair'));

  // Set a LENGTH morph directly on a hair object (works even when it isn't a direct scene child).
  const applyHairLength = (obj, value) => {
    const child = obj.children[0] || obj;
    const dict = child.morphTargetDictionary;
    if (dict && 'LENGTH' in dict && child.morphTargetInfluences) {
      child.morphTargetInfluences[dict['LENGTH']] = value;
    }
  };

  const updateHairStyle = (gltf) => {
    const hairMeshes = getHairMeshes(gltf);
    // Multiple hair meshes = selectable styles; show only the chosen one. If the selection matches none
    // (e.g. skipped customization or a model swap), show the first so the avatar is never left bald.
    if (hairMeshes.length > 1) {
      const matches = hairMeshes.some(c => c.name === currentHairStyle);
      hairMeshes.forEach((c, i) => { c.visible = matches ? c.name === currentHairStyle : i === 0; });
    }
    // Apply hair length to the active hair mesh (or the only one) if it exposes a LENGTH morph.
    const active = hairMeshes.find(c => c.name === currentHairStyle) || hairMeshes[0];
    if (active) applyHairLength(active, hairLength);
  };

  // Apply `fn` to a target's materials: a channel keyword ('hair'|'skin'|'eye') or an exact extra-material name.
  const forEachTargetMaterial = (target, fn) => {
    if (target === 'hair' || target === 'skin' || target === 'eye') return forEachChannelMaterial(target, fn);
    vrmRef.current?.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => { if (m && !m.isOutline && m.name === target) fn(m); });
    });
  };

  const tintTarget = (target, hex) => forEachTargetMaterial(target, (m) => tintByAverage(m, hex));

  // Restore a target's materials to their untinted colors (the "no color" / revert state).
  const resetTarget = (target) => forEachTargetMaterial(target, (m) => {
    if (m.userData.__origColor) m.color.copy(m.userData.__origColor);
    if (m.userData.__origShade) m.shadeColorFactor.copy(m.userData.__origShade);
    m.needsUpdate = true;
  });

  // Calculated representative color of a target (its first material's average) — for seeding a picker.
  const calcColor = (target) => {
    let c = null;
    forEachTargetMaterial(target, (m) => { if (!c) c = averageColor(m); });
    return c;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- calcColor reads live refs; a stable handle is fine.
  useImperativeHandle(ref, () => ({ calcColor }), []);

  // Extra colorable materials = anything that isn't a primary channel or a face/eye detail (clothing, etc.).
  const getColorableExtras = (gltf) => {
    const names = new Set<string>();
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
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
      const aspectRatio = width / height;
      
      cameraRef.current.aspect = aspectRatio;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      
      // Adjust camera position based on aspect ratio
      if (aspectRatio < 1) {
        // Portrait orientation
        cameraRef.current.position.set(0.0, 1.2, 3.0); // Closer view, slightly higher
        controlsRef.current.target.set(0.0, 1.0, 0.0); // Look at upper body
      } else {
        // Landscape orientation
        cameraRef.current.position.set(0.0, 1.0, 5.0);
        controlsRef.current.target.set(0.0, 1.0, 0.0);
      }
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
    };
  

   useEffect(() => {
    if (!mountRef.current) return;
    // Set up scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30.0, 1, 0.1, 20.0);
    const renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

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

    // Load VRM model
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      modelUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm;
        
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
        setMorphTarget('Body', 'Belly', bellySize, gltf);
        setMorphTarget('Body', 'Breasts', breastSize, gltf);
        setMorphTarget('Body', 'Fat', bodyWeight, gltf);

        //attachCylinderToHand(vrm);

        updateHairStyle(gltf);

        // Report which customization morphs this model exposes so the UI hides unsupported sliders.
        if (onCapabilities) {
          const bodyDict = getMorphDict('Body', gltf) || {};
          const bodyMorphs = ['Belly', 'Breasts', 'Fat', 'B_Pear', 'B_HourGlass', 'B_Apple'].filter(n => n in bodyDict);
          const hairMeshes = getHairMeshes(gltf);
          const styles = hairMeshes.map(c => c.name);
          const hairLengthSupported = hairMeshes.some(c => {
            const child = c.children[0] || c;
            return child.morphTargetDictionary && 'LENGTH' in child.morphTargetDictionary;
          });
          // Sample each part's current color from its texture so the pickers start at the model's real colors.
          const sampleColor = (channel) => {
            let c = null;
            forEachChannelMaterial(channel, (m) => { if (!c) c = averageColor(m); });
            return c;
          };
          const colors = { hair: sampleColor('hair'), skin: sampleColor('skin'), eye: sampleColor('eye') };
          onCapabilities({ bodyMorphs, hairStyles: styles, hairLength: hairLengthSupported, colors, extras: getColorableExtras(gltf) });
        }

        setReady(true);
        // Load Mixamo animation after VRM is loaded
        //loadMixamoAnimation('./idle_tired.fbx');


        animationFiles.forEach(file => loadMixamoAnimation(file));
      },
      (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
      (error) => console.error('Error loading VRM:', error)
    );


    

    // Load Mixamo animation
    const loadMixamoAnimation = (animationPath) => {
      const animationName = animationPath.split('/').pop().split('.')[0]; // Extract name from filename
      const loader = new FBXLoader();
      loader.load(animationPath, (asset) => {
        const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com');
        
        if (!clip || !vrmRef.current) {
          console.error('Animation clip not found or VRM not loaded');
          return;
        }

        

        const tracks = [];

        const restRotationInverse = new THREE.Quaternion();
        const parentRestWorldRotation = new THREE.Quaternion();
        const _quatA = new THREE.Quaternion();
        const _vec3 = new THREE.Vector3();

        // Adjust with reference to hips height
        const motionHipsHeight = asset.getObjectByName('mixamorigHips').position.y;
        const vrmHipsY = vrmRef.current.humanoid?.getNormalizedBoneNode('hips').getWorldPosition(_vec3).y;
        const vrmRootY = vrmRef.current.scene.getWorldPosition(_vec3).y;
        const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
        const hipsPositionScale = vrmHipsHeight / motionHipsHeight;

        // VRM 0.0 faces -Z while Mixamo / VRM 1.0 face +Z, so mirror the X/Z axes for 0.0 models.
        const isVRM0 = vrmRef.current.meta?.metaVersion === '0';

        clip.tracks.forEach((track) => {
          const trackSplitted = track.name.split('.');
          const mixamoRigName = trackSplitted[0];
          const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
          const vrmNodeName = vrmRef.current.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name;
          const mixamoRigNode = asset.getObjectByName(mixamoRigName);

          if (vrmNodeName != null) {
            const propertyName = trackSplitted[1];

            mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
            mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

            if (track instanceof THREE.QuaternionKeyframeTrack) {
              // Retarget rotation
              const newTrack = new THREE.QuaternionKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v, i) => {
                  if (i % 4 === 0) {
                    _quatA.fromArray(track.values, i);
                    _quatA
                      .premultiply(parentRestWorldRotation)
                      .multiply(restRotationInverse);
                    return isVRM0 ? -_quatA.x : _quatA.x;
                  }
                  if (i % 4 === 1) return _quatA.y;
                  if (i % 4 === 2) return isVRM0 ? -_quatA.z : _quatA.z;
                  if (i % 4 === 3) return _quatA.w;
                })
              );
              tracks.push(newTrack);
            } else if (track instanceof THREE.VectorKeyframeTrack) {
              const newTrack = new THREE.VectorKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v, i) => (isVRM0 && i % 3 !== 1 ? -v : v) * hipsPositionScale)
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

      }, undefined, (error) => console.error(`Error loading ${animationName} animation:`, error));
    };

    const startAnimationLoop = () => {
      const playNextAnimation = () => {
        if (currentAnimationRef.current) {
          currentAnimationRef.current.fadeOut(0.5);
        }
  
        const animationName = animationFiles[animationIndexRef.current].split('/').pop().split('.')[0];
        const nextAction = mixerRef.current.clipAction(animationsRef.current[animationName]);
        nextAction.reset().fadeIn(0.5).play();
        currentAnimationRef.current = nextAction;
  
        // Schedule the next animation
        animationIndexRef.current = (animationIndexRef.current + 1) % animationFiles.length;
        setTimeout(() => playNextAnimation(), 
          (animationsRef.current[animationName].duration - 0.5) * 1000);
      };
  
      playNextAnimation();
    };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      const deltaTime = clock.getDelta();

      if (mixerRef.current) {
        mixerRef.current.update(deltaTime);
      }

      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);
      }

      renderer.render(scene, camera);
    };

    const clock = new THREE.Clock();
    animate();

     

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Safe cleanup of THREE.js resources
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
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
      if (mountRef.current && rendererRef.current) {
        const rendererDomElement = rendererRef.current.domElement;
        if (mountRef.current.contains(rendererDomElement)) {
          mountRef.current.removeChild(rendererDomElement);
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
  }, []);


  useEffect(() => {
    if (gltfRef.current && ready) {
      setMorphTarget('Body', 'Belly', bellySize, gltfRef.current);
    }
  }, [bellySize]);

  useEffect(() => {
    if (gltfRef.current && ready) {
      setMorphTarget('Body', 'Breasts', breastSize, gltfRef.current);
    }
  }, [breastSize]);

  useEffect(() => {
    if (gltfRef.current && ready) {
      setMorphTarget('Body', 'Fat', bodyWeight, gltfRef.current);
    }
  }, [bodyWeight]);

  useEffect(() => {
    if (gltfRef.current && ready) {
      setMorphTarget('Body', 'B_Pear', bodyShape.pear, gltfRef.current);
    }
  }, [bodyShape.pear]);

  useEffect(() => {
    if (gltfRef.current && ready) {
      setMorphTarget('Body', 'B_HourGlass', bodyShape.hourglass, gltfRef.current);
    }
  }, [bodyShape.hourglass]);

  useEffect(() => {
    if (gltfRef.current && ready) {
      setMorphTarget('Body', 'B_Apple', bodyShape.apple, gltfRef.current);
    }
  }, [bodyShape.apple]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tint/reset helpers intentionally omitted (would re-run every render).
  }, [extraColors, ready]);

  useEffect(() => {
    if (gltfRef.current && ready) {
      updateHairStyle(gltfRef.current);
    }
  }, [currentHairStyle, hairLength]);

  useEffect(() => {
    setTimeout(()=>{
        setMorphTarget('Body', 'Belly', bellySize, gltfRef.current);
        setMorphTarget('Body', 'Breasts', breastSize, gltfRef.current);
        setMorphTarget('Body', 'Fat', bodyWeight, gltfRef.current);
        setMorphTarget('Body', 'B_Pear', bodyShape.pear, gltfRef.current);
        setMorphTarget('Body', 'B_HourGlass', bodyShape.hourglass, gltfRef.current);
        setMorphTarget('Body', 'B_Apple', bodyShape.apple, gltfRef.current);
        // Colors are applied by the dedicated [color, ready] effects below — applying them here too
        // re-ran with stale (pre-seed) values and clobbered the seeded colors.
        updateHairStyle(gltfRef.current);
    }, 500)
  }, [ready]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {!ready && (
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
