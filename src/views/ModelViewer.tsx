import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/types';

interface ModelViewerProps {
  model: Partial<MediaAsset>;
  modelType: string;
  className?: string;
}

/** Square fallback for the frames before layout has measured the container (and for jsdom, which reports 0). */
const FALLBACK_SIZE = 400;

const ModelViewer = ({ model, modelType, className }: ModelViewerProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!model || !model.data) return;

    const scene = new THREE.Scene();
    scene.background = null; // Ensure the scene background is transparent

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true }); // Enable transparency
    renderer.setClearColor(0x000000, 0); // Set clear color to transparent

    const mount = mountRef.current;
    mount?.appendChild(renderer.domElement);

    // Fill whatever box the viewer is placed in — a dialog, or an entity panel's image slot — rather than a
    // fixed square. The canvas is stretched by CSS so a resize redraws immediately, before the observer fires.
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const resize = () => {
      const width = mount?.clientWidth || FALLBACK_SIZE;
      const height = mount?.clientHeight || FALLBACK_SIZE;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    // Guarded: jsdom has no ResizeObserver, and the viewer is exercised there.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (mount) observer?.observe(mount);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    // Physically-correct intensities (three r155+); the legacy 0.5/1 values render a lit model near-black.
    const ambientLight = new THREE.AmbientLight(0xffffff, Math.PI * 0.3);
    scene.add(ambientLight);

    // World-fixed key light, matching VRMViewer/vrmThumbnail so a model reads the same everywhere it's shown.
    const keyLight = new THREE.DirectionalLight(0xffffff, Math.PI);
    keyLight.position.set(1, 1, 1).normalize();
    scene.add(keyLight);

    // Fill from the opposite side, at a third of the key. The preview orbits freely, so without this the far
    // side falls to flat ambient and spinning the model walks you into an unlit half. Deliberately weaker than
    // the key: matching them would cancel the shading that shows the model's shape.
    const fillLight = new THREE.DirectionalLight(0xffffff, Math.PI / 3);
    fillLight.position.set(-1, -0.5, -1).normalize();
    scene.add(fillLight);

    let loader;
    switch (modelType) {
      case 'glb':
      case 'gltf':
        loader = new GLTFLoader();
        break;
      case 'fbx':
        loader = new FBXLoader();
        break;
      case 'obj':
        loader = new OBJLoader();
        break;
      default:
        console.error('Unsupported model type');
        return;
    }

    // Decode the data URL via fetch rather than by hand: a per-character `atob` loop over a multi-MB model
    // stalls the main thread for seconds and balloons memory before the first frame ever draws.
    let objectURL: string | null = null;
    let disposed = false;
    // Created only once a model with clips has landed, so the render loop has to null-check it.
    let mixer: THREE.AnimationMixer | null = null;
    void fetch(model.data).then((r) => r.blob()).then((blob) => {
      if (disposed) return;
      objectURL = URL.createObjectURL(blob);
      loadModel(objectURL);
    }).catch((error) => console.error('Error reading model data:', error));

    const loadModel = (url: string) => loader.load(url, (loaded) => {
      // GLTFLoader yields a { scene } wrapper; FBX/OBJ loaders yield the Object3D directly.
      const object = 'scene' in loaded ? loaded.scene : loaded;
      scene.add(object);

      // Play every clip the file carries. A Blender/glTF export splits motion into one clip per animated
      // object, so playing only the first would leave the rest of the model frozen. `animations` lives on
      // the GLTF wrapper, not its scene — hence reading it off `loaded` rather than `object`.
      if (loaded.animations?.length) {
        mixer = new THREE.AnimationMixer(object);
        loaded.animations.forEach((clip) => mixer!.clipAction(clip).play());
      }

      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan((camera.fov / 2) * Math.PI / 180));
      // The camera's fov is vertical, so a container narrower than it is tall would crop the model's sides;
      // pulling back by the aspect ratio in that case keeps it framed.
      const fit = cameraZ * Math.max(1, 1 / camera.aspect);

      camera.position.z = fit * 1.5;
      const minZ = box.min.z;
      const cameraToFarEdge = (fit - minZ) * 3;
      camera.far = cameraToFarEdge;
      camera.updateProjectionMatrix();

      camera.lookAt(center);
      controls.target.copy(center);
    }, undefined, (error) => {
      console.error('Error loading model:', error);
    });

    let animationFrameId: number;
    const clock = new THREE.Clock();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      // Consume the delta unconditionally, so a mixer created mid-loop doesn't start on the whole
      // elapsed-since-mount gap and jump straight to a late keyframe.
      const delta = clock.getDelta();
      mixer?.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(animationFrameId);
      mixer?.stopAllAction();
      mixer = null;

      // Release the model's GPU buffers, not just the renderer's — this dialog opens once per entity, and
      // leaving geometry/materials resident piles them up for the lifetime of the page.
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });

      if (mount) {
        mount.removeChild(renderer.domElement);
      }
      if (objectURL) URL.revokeObjectURL(objectURL);
      renderer.dispose();
      // Drop the WebGL context immediately; otherwise repeated opens accumulate contexts until the browser
      // evicts the oldest and rendering silently breaks (same failure VRMViewer guards against).
      renderer.forceContextLoss?.();
      controls.dispose();
    };
  }, [model, modelType]);

  return <div ref={mountRef} className={cn('w-full h-full min-h-0', className)} />;
};

export default ModelViewer;
