import React, { useRef, useEffect, useState } from 'react';
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
}

interface VRMViewerProps {
  bellySize: number;
  breastSize: number;
  bodyWeight: number;
  hairColor: string;
  eyeColor: string;
  skinColor: string;
  hairTypes?: Record<string, HairTypeDef>;
  currentHairStyle: string;
  hairLength: number;
  bodyShape: BodyShape;
  modelUrl?: string;
  animationFiles?: string[];
  /** Called once the model loads, reporting which customization morphs it supports. */
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

const VRMViewer = ({
  bellySize,
  breastSize,
  bodyWeight,
  hairColor,
  eyeColor,
  skinColor,
  hairTypes,
  currentHairStyle,
  hairLength,
  bodyShape,
  modelUrl = './readheadedit.vrm',
  animationFiles = ['./idle.fbx', './bashful.fbx', './idle_dwarf.fbx'],
  onCapabilities
}: VRMViewerProps) => {
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

  // --- Texture colorize: keep a texture's baked light/shadow detail but shift it to a target hue/saturation. ---
  const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    const d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  };

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const hslToRgb = (h, s, l) => {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
  };

  // Capture (and cache) a material's original base-color pixels so re-coloring never compounds.
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

  // Recolor a material's texture to `hex`, preserving its per-pixel lightness (so shading/detail survives).
  const colorizeMaterial = (material, hex) => {
    const src = getOriginalImageData(material);
    if (!src) return;
    const [tr, tg, tb] = hexToRgb(hex);
    const [th, ts] = rgbToHsl(tr, tg, tb);
    const d = src.data;
    const out = new Uint8ClampedArray(d.length);
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const [nr, ng, nb] = hslToRgb(th, ts, (mx + mn) / 2 / 255);
      out[i] = nr; out[i + 1] = ng; out[i + 2] = nb; out[i + 3] = d[i + 3];
    }
    const canvas = document.createElement('canvas');
    canvas.width = src.width; canvas.height = src.height;
    canvas.getContext('2d').putImageData(new ImageData(out, src.width, src.height), 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    const orig = material.map;
    if (orig) {
      tex.flipY = orig.flipY; tex.colorSpace = orig.colorSpace;
      tex.wrapS = orig.wrapS; tex.wrapT = orig.wrapT;
      tex.repeat.copy(orig.repeat); tex.offset.copy(orig.offset);
    }
    tex.needsUpdate = true;
    material.map = tex;
    if (material.uniforms?.map) material.uniforms.map.value = tex;
    material.needsUpdate = true;
  };

  // Average opaque pixels of a material's original texture → a representative hex color (used to seed sliders).
  const averageColor = (material) => {
    const src = getOriginalImageData(material);
    if (!src) return null;
    const d = src.data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (!n) return null;
    return '#' + [r, g, b].map(x => Math.round(x / n).toString(16).padStart(2, '0')).join('');
  };

  // Run a callback on every material in the current VRM whose name contains `keyword` (case-insensitive).
  // Targets VRoid/MToon's separately-named materials (e.g. *_SKIN, EyeIris) regardless of mesh layout.
  const forEachMaterialNamed = (keyword, fn) => {
    vrmRef.current?.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m && m.name && m.name.toLowerCase().includes(keyword)) fn(m);
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

  const updateHairStyle = (gltf) => {
    if (hairTypes && currentHairStyle) {
      Object.keys(hairTypes).forEach(style => {
        const hairMesh = findMesh(hairTypes[style].shapekey, gltf);
        if (hairMesh) {
          hairMesh.visible = style === currentHairStyle;
        }
      });

      // Update hair length if applicable
      const currentStyle = hairTypes[currentHairStyle];
      if (currentStyle && currentStyle.canChangeLength) {
        const currentHairMesh = findMesh(currentStyle.shapekey, gltf);
        if (currentHairMesh) {
          setMorphTarget(currentStyle.shapekey, 'LENGTH', hairLength, gltf);
        }
      }
    }
  };

  const setHairColor = (color) => {
    if (color) forEachMaterialNamed('hair', (m) => colorizeMaterial(m, color));
  };

  const setEyeColor = (color) => {
    if (color) forEachMaterialNamed('iris', (m) => colorizeMaterial(m, color));
  };

  const setSkinColor = (color) => {
    if (color) forEachMaterialNamed('skin', (m) => colorizeMaterial(m, color));
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
          const styles = hairTypes ? Object.keys(hairTypes).filter(s => !!findMesh(hairTypes[s].shapekey, gltf)) : [];
          const hairLengthSupported = styles.some(s => {
            const d = getMorphDict(hairTypes[s].shapekey, gltf);
            return hairTypes[s].canChangeLength && !!d && 'LENGTH' in d;
          });
          // Sample each part's current color from its texture so the pickers start at the model's real colors.
          const sampleColor = (keyword) => {
            let c = null;
            forEachMaterialNamed(keyword, (m) => { if (!c) c = averageColor(m); });
            return c;
          };
          const colors = { hair: sampleColor('hair'), skin: sampleColor('skin'), eye: sampleColor('iris') };
          onCapabilities({ bodyMorphs, hairStyles: styles, hairLength: hairLengthSupported, colors });
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

  useEffect(() => {
    if (vrmRef.current && ready) {
      setHairColor(hairColor);
    }
  }, [hairColor]);

  useEffect(() => {
    if (vrmRef.current && ready) {
      setEyeColor(eyeColor);
    }
  }, [eyeColor]);

  useEffect(() => {
    if (vrmRef.current && ready) {
      setSkinColor(skinColor);
    }
  }, [skinColor]);

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
        setHairColor(hairColor);
        setEyeColor(eyeColor);
        setSkinColor(skinColor);
        console.log('ready',bellySize,breastSize,bodyWeight)
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
};

export default VRMViewer;
