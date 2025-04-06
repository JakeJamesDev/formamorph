import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Loader2 } from "lucide-react";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

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
  animationFiles = ['./idle.fbx', './bashful.fbx', './idle_dwarf.fbx']
}) => {
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


  // Define default colors
  const defaultHairColor = '#7d0909';
  const defaultSkinColor = '#fcdec7';
  const defaultEyeColor = '#86ff70';

  const findMesh= (meshName, gltf) =>{
    return gltf.scene.children.find(child => child.name === meshName);
  }

  
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
    if (!(color !== defaultHairColor && vrmRef.current && vrmRef.current.scene))
      return;

    if (vrmRef.current && vrmRef.current.scene) {
      vrmRef.current.scene.traverse((object) => {
        if (object.isMesh && object.name.toLowerCase().includes('hair')) {
          if (object.material) {
            // Convert hex color to RGB
            const r = parseInt(color.slice(1, 3), 16) / 255;
            const g = parseInt(color.slice(3, 5), 16) / 255;
            const b = parseInt(color.slice(5, 7), 16) / 255;

            // Create a new texture with the desired color
            const size = 256;
            const data = new Uint8Array(4 * size * size);

            for (let i = 0; i < size * size; i++) {
              const stride = i * 4;
              data[stride] = r * 255;
              data[stride + 1] = g * 255;
              data[stride + 2] = b * 255;
              data[stride + 3] = 255; // Full opacity
            }

            const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
            texture.needsUpdate = true;

            // Replace the existing texture(s) with the new one
            if (object.material.map) {
              object.material.map = texture;
            }
            if (object.material.emissiveMap) {
              object.material.emissiveMap = texture;
            }

            // Update relevant uniforms if it's a ShaderMaterial
            if (object.material.type === 'ShaderMaterial' && object.material.uniforms) {
              if (object.material.uniforms.map) {
                object.material.uniforms.map.value = texture;
              }
              if (object.material.uniforms.diffuseMap) {
                object.material.uniforms.diffuseMap.value = texture;
              }
            }

            // Force material update
            object.material.needsUpdate = true;
          }
        }
      });
    }
  };

  const setEyeColor = (color) => {
    if (!(color !== defaultEyeColor && vrmRef.current && vrmRef.current.scene))
      return;
    if (vrmRef.current && vrmRef.current.scene) {
        const object = findMesh('Face', gltfRef.current);
        console.log("FACE:", object)
        if (object) {
          const eyeMesh = object.children[1]; // Get the second child of the Face mesh
          if (eyeMesh && eyeMesh.material) {
            // Convert hex color to RGB
            const r = parseInt(color.slice(1, 3), 16) / 255;
            const g = parseInt(color.slice(3, 5), 16) / 255;
            const b = parseInt(color.slice(5, 7), 16) / 255;

            // Set the material color
            eyeMesh.material.color.setRGB(r, g, b);

            // If it's a ShaderMaterial, update relevant uniforms
            if (eyeMesh.material.type === 'ShaderMaterial' && eyeMesh.material.uniforms) {
              if (eyeMesh.material.uniforms.diffuse) {
                eyeMesh.material.uniforms.diffuse.value.setRGB(r, g, b);
              }
              if (eyeMesh.material.uniforms.litFactor) {
                eyeMesh.material.uniforms.litFactor.value.setRGB(r, g, b);
              }
            }

            // Force material update
            eyeMesh.material.needsUpdate = true;
          }
        }
    }
  };

  const setSkinObject = (object, color, childIdx = 0) => {
    const bodyMesh = object.children[childIdx];
          if (bodyMesh && bodyMesh.material && bodyMesh.material.length > 0) {
            const skinMaterial = bodyMesh.material[0];
            console.log(skinMaterial)
            // Convert hex color to RGB
            const r = parseInt(color.slice(1, 3), 16) / 255;
            const g = parseInt(color.slice(3, 5), 16) / 255;
            const b = parseInt(color.slice(5, 7), 16) / 255;

            // Create a new texture with the desired color
            const size = 256;
            const data = new Uint8Array(4 * size * size);

            for (let i = 0; i < size * size; i++) {
              const stride = i * 4;
              data[stride] = r * 255;
              data[stride + 1] = g * 255;
              data[stride + 2] = b * 255;
              data[stride + 3] = 255; // Full opacity
            }

            const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
            texture.needsUpdate = true;

            // Replace the existing texture(s) with the new one
            if (skinMaterial.map) {
              skinMaterial.map = texture;
            }
            if (skinMaterial.emissiveMap) {
              skinMaterial.emissiveMap = texture;
            }

            // Calculate 20% lighter color
            let factor = 0.7;
            let lightenedColor = new THREE.Color(
              Math.min(r * factor, 255),
              Math.min(g * factor, 255),
              Math.min(b * factor, 255)
            );
            skinMaterial.shadeColorFactor = lightenedColor;
            if (skinMaterial.type === 'ShaderMaterial' && skinMaterial.uniforms) {
              if (skinMaterial.uniforms.map) {
                skinMaterial.uniforms.map.value = texture;
              }
              if (skinMaterial.uniforms.diffuseMap) {
                skinMaterial.uniforms.diffuseMap.value = texture;
              }
              if (skinMaterial.uniforms.diffuse) {
                skinMaterial.uniforms.diffuse.value.setRGB(r, g, b);
              }
              if (skinMaterial.uniforms.litFactor) {
                skinMaterial.uniforms.litFactor.value.setRGB(r, g, b);
              }
            }

            // Force material update
            skinMaterial.needsUpdate = true;
          }
  }

  const setSkinColor = (color) => {
    if (!(color !== defaultSkinColor && vrmRef.current && vrmRef.current.scene) )
      return;
    if (vrmRef.current && vrmRef.current.scene) {
      const body = findMesh('Body',gltfRef.current);
      const face = findMesh('Face',gltfRef.current)
        setSkinObject(body, color);
        setSkinObject(face, color,3);
        //setSkinObject(face, color,2);
        //setSkinObject(face, color,1);
        }
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
      './readheadedit.vrm',
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
                    return _quatA.x;
                  }
                  if (i % 4 === 1) return _quatA.y;
                  if (i % 4 === 2) return _quatA.z;
                  if (i % 4 === 3) return _quatA.w;
                })
              );
              tracks.push(newTrack);
            } else if (track instanceof THREE.VectorKeyframeTrack) {
              const newTrack = new THREE.VectorKeyframeTrack(
                `${vrmNodeName}.${propertyName}`,
                track.times,
                track.values.map((v, i) => v * hipsPositionScale)
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
