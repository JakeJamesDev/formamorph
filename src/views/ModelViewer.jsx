import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const ModelViewer = ({ model, modelType }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!model) return;

    const scene = new THREE.Scene();
    scene.background = null; // Ensure the scene background is transparent

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true }); // Enable transparency
    renderer.setSize(400, 400);
    renderer.setClearColor(0x000000, 0); // Set clear color to transparent

    mountRef.current?.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

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

    // Convert base64 to blob
    const byteCharacters = atob(model.data.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: model.type });

    const objectURL = URL.createObjectURL(blob);

    loader.load(objectURL, (object) => {
      if (modelType === 'glb' || modelType === 'gltf') {
        object = object.scene;
      }
      scene.add(object);

      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = 60;
      const cameraZ = Math.abs(maxDim / 2 / Math.tan((fov / 2) * Math.PI / 180));

      camera.position.z = cameraZ * 1.5;
      const minZ = box.min.z;
      const cameraToFarEdge = (cameraZ - minZ) * 3;
      camera.far = cameraToFarEdge;
      camera.updateProjectionMatrix();

      camera.lookAt(center);
      controls.target.copy(center);
    }, undefined, (error) => {
      console.error('Error loading model:', error);
    });

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      URL.revokeObjectURL(objectURL);
      renderer.dispose();
      controls.dispose();
    };
  }, [model, modelType]);

  return <div ref={mountRef} />;
};

export default ModelViewer;
